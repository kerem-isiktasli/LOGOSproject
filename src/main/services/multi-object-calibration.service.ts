/**
 * Multi-Object Calibration Service
 *
 * Implements simultaneous calibration of multiple linguistic component objects
 * within a single task response. Based on:
 *
 * - Within-Item MIRT (Hartig & Höhler, 2008)
 * - Compensatory MIRT model (Reckase, 1985)
 * - G-DINA Cognitive Diagnostic Model (de la Torre, 2011)
 * - Multivariate Elo (Pelánek, 2016)
 *
 * Key Features:
 * - Q-matrix weight allocation for component contributions
 * - Multi-component response evaluation with partial credit
 * - Simultaneous theta updates across all 5 linguistic components
 * - Component-specific feedback generation
 */

import { getPrisma } from '../db/prisma';
import {
  updateMasteryState,
  recordExposure,
  updateFSRSParameters,
  transitionStage,
} from '../db/repositories/mastery.repository';
import {
  recordResponse,
  applyThetaRules,
  type ThetaState,
} from '../db/repositories/session.repository';
import { updateObjectPriority } from '../db/repositories/goal.repository';
import {
  calculateEffectivePriority,
  calculateMasteryAdjustment,
  calculateUrgencyScore,
} from './state-priority.service';
import type {
  ComponentCode,
  CognitiveProcess,
  MultiObjectTarget,
  MultiObjectTaskSpec,
  ComponentEvaluation,
  MultiComponentEvaluation,
  MultiComponentThetaContribution,
  MultiObjectResponseOutcome,
  QMatrixEntry,
  UserThetaProfile,
  MasteryStage,
  TaskType,
  LanguageObjectType,
} from '../../core/types';
import {
  DEFAULT_Q_MATRIX,
  COGNITIVE_PROCESS_MULTIPLIERS,
} from '../../core/types';

// =============================================================================
// Types
// =============================================================================

export interface MultiObjectUserResponse {
  /** Session ID */
  sessionId: string;

  /** Multi-object task specification */
  taskSpec: MultiObjectTaskSpec;

  /** User's response text */
  response: string;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Number of hints used */
  hintsUsed: number;

  /** Cue level used (0-3) */
  cueLevel: number;
}

export interface MultiObjectScoringConfig {
  /** Strictness level */
  strictness: 'lenient' | 'normal' | 'strict';

  /** Enable partial credit scoring */
  partialCreditEnabled: boolean;

  /** Learning rate (K) for Elo-style updates */
  learningRate: number;

  /** Interaction model override */
  interactionModel?: 'compensatory' | 'conjunctive' | 'disjunctive';
}

// Default configuration
const DEFAULT_CONFIG: MultiObjectScoringConfig = {
  strictness: 'normal',
  partialCreditEnabled: true,
  learningRate: 0.1,
};

// =============================================================================
// Q-Matrix Weight Allocation
// =============================================================================

/**
 * Map LanguageObjectType to ComponentCode.
 */
export function objectTypeToComponent(type: LanguageObjectType): ComponentCode {
  const mapping: Record<LanguageObjectType, ComponentCode> = {
    LEX: 'LEX',
    MWE: 'LEX',
    TERM: 'LEX',
    MORPH: 'MORPH',
    G2P: 'PHON',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };
  return mapping[type] || 'LEX';
}

/**
 * Get default Q-matrix entry for a task type.
 */
export function getQMatrixEntry(taskType: TaskType): QMatrixEntry {
  return DEFAULT_Q_MATRIX[taskType] || DEFAULT_Q_MATRIX['recognition'];
}

/**
 * Allocate weights to target objects based on Q-matrix and design intent.
 *
 * Weight allocation principles:
 * 1. Primary targets get 50-70% of weight
 * 2. Secondary targets share remaining weight
 * 3. Q-matrix provides baseline component weights
 * 4. Weights are normalized to sum to 1
 *
 * @param objects - Target objects to weight
 * @param taskType - Task type for Q-matrix lookup
 * @returns Objects with allocated weights
 */
export function allocateQMatrixWeights(
  objects: Omit<MultiObjectTarget, 'weight'>[],
  taskType: TaskType
): MultiObjectTarget[] {
  if (objects.length === 0) {
    return [];
  }

  const qEntry = getQMatrixEntry(taskType);
  const primaryObjects = objects.filter(o => o.isPrimaryTarget);
  const secondaryObjects = objects.filter(o => !o.isPrimaryTarget);

  // Base weights from Q-matrix
  const componentWeights = qEntry.components;

  // Calculate raw weights
  const rawWeights: number[] = objects.map(obj => {
    // Start with Q-matrix component weight (default 0.1 if not in Q-matrix)
    const qWeight = componentWeights[obj.componentType] || 0.1;

    // Primary target bonus: 1.5x weight
    const primaryBonus = obj.isPrimaryTarget ? 1.5 : 1.0;

    // Cognitive process adjustment
    const processMultiplier = COGNITIVE_PROCESS_MULTIPLIERS[obj.cognitiveProcess] || 1.0;

    // Raw weight = Q-weight × primary bonus × inverse process difficulty
    // (easier processes contribute more to final score)
    return qWeight * primaryBonus * (1 / processMultiplier);
  });

  // Normalize weights to sum to 1
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = rawWeights.map(w =>
    totalWeight > 0 ? w / totalWeight : 1 / objects.length
  );

  // Ensure primary objects get at least 50% total weight
  const primaryWeightSum = normalizedWeights
    .filter((_, i) => objects[i].isPrimaryTarget)
    .reduce((sum, w) => sum + w, 0);

  if (primaryObjects.length > 0 && primaryWeightSum < 0.5) {
    // Redistribute: boost primary, reduce secondary
    const boostFactor = 0.5 / primaryWeightSum;
    const remainingForSecondary = 0.5;
    const secondaryTotal = normalizedWeights
      .filter((_, i) => !objects[i].isPrimaryTarget)
      .reduce((sum, w) => sum + w, 0);

    return objects.map((obj, i) => ({
      ...obj,
      weight: obj.isPrimaryTarget
        ? normalizedWeights[i] * boostFactor
        : secondaryTotal > 0
          ? normalizedWeights[i] * (remainingForSecondary / secondaryTotal)
          : remainingForSecondary / secondaryObjects.length,
    }));
  }

  return objects.map((obj, i) => ({
    ...obj,
    weight: normalizedWeights[i],
  }));
}

/**
 * Calculate composite task difficulty from target objects.
 *
 * Uses weighted average of object difficulties with cognitive process adjustments.
 */
export function calculateCompositeDifficulty(
  targets: MultiObjectTarget[]
): number {
  if (targets.length === 0) return 0;

  const weightedSum = targets.reduce((sum, target) => {
    const processMultiplier = COGNITIVE_PROCESS_MULTIPLIERS[target.cognitiveProcess] || 1.0;
    return sum + target.weight * target.difficulty * processMultiplier;
  }, 0);

  // Clamp to IRT difficulty range [-3, 3]
  return Math.max(-3, Math.min(3, weightedSum));
}

// =============================================================================
// Compensatory MIRT Probability Model
// =============================================================================

/**
 * Calculate response probability using Compensatory MIRT model.
 *
 * P(X=1|θ) = σ(Σᵢ aᵢθᵢ + d)
 *
 * Where:
 * - θᵢ = ability on dimension i
 * - aᵢ = discrimination for dimension i
 * - d = overall difficulty intercept
 *
 * @param thetaProfile - User's theta profile
 * @param targets - Target objects with weights
 * @param compositeDifficulty - Overall task difficulty
 */
export function calculateCompensatoryProbability(
  thetaProfile: UserThetaProfile,
  targets: MultiObjectTarget[],
  compositeDifficulty: number
): number {
  // Map theta profile to components
  const thetaByComponent: Record<ComponentCode, number> = {
    PHON: thetaProfile.thetaPhonology,
    MORPH: thetaProfile.thetaMorphology,
    LEX: thetaProfile.thetaLexical,
    SYNT: thetaProfile.thetaSyntactic,
    PRAG: thetaProfile.thetaPragmatic,
  };

  // Calculate weighted linear combination: Σ aᵢwᵢθᵢ
  const weightedThetaSum = targets.reduce((sum, target) => {
    const theta = thetaByComponent[target.componentType];
    const discriminationWeight = target.discrimination * target.weight;
    return sum + discriminationWeight * theta;
  }, 0);

  // Logistic function: σ(x) = 1 / (1 + e^(-x))
  const logit = weightedThetaSum - compositeDifficulty;
  const probability = 1 / (1 + Math.exp(-logit));

  return probability;
}

/**
 * Calculate probability using Conjunctive (DINA-like) model.
 *
 * Requires mastery of ALL components for high success probability.
 * P = (1-s) if all mastered, g if any not mastered
 *
 * @param thetaProfile - User's theta profile
 * @param targets - Target objects
 * @param slipRate - Probability of error despite mastery (default 0.1)
 * @param guessRate - Probability of success without mastery (default 0.2)
 */
export function calculateConjunctiveProbability(
  thetaProfile: UserThetaProfile,
  targets: MultiObjectTarget[],
  slipRate: number = 0.1,
  guessRate: number = 0.2
): number {
  const thetaByComponent: Record<ComponentCode, number> = {
    PHON: thetaProfile.thetaPhonology,
    MORPH: thetaProfile.thetaMorphology,
    LEX: thetaProfile.thetaLexical,
    SYNT: thetaProfile.thetaSyntactic,
    PRAG: thetaProfile.thetaPragmatic,
  };

  // Check if all required components are "mastered" (theta > difficulty)
  const allMastered = targets.every(target => {
    const theta = thetaByComponent[target.componentType];
    return theta >= target.difficulty;
  });

  return allMastered ? (1 - slipRate) : guessRate;
}

/**
 * Calculate probability using Disjunctive (DINO-like) model.
 *
 * Requires mastery of ANY component for high success probability.
 * P = (1-s) if any mastered, g if none mastered
 */
export function calculateDisjunctiveProbability(
  thetaProfile: UserThetaProfile,
  targets: MultiObjectTarget[],
  slipRate: number = 0.1,
  guessRate: number = 0.2
): number {
  const thetaByComponent: Record<ComponentCode, number> = {
    PHON: thetaProfile.thetaPhonology,
    MORPH: thetaProfile.thetaMorphology,
    LEX: thetaProfile.thetaLexical,
    SYNT: thetaProfile.thetaSyntactic,
    PRAG: thetaProfile.thetaPragmatic,
  };

  // Check if ANY required component is mastered
  const anyMastered = targets.some(target => {
    const theta = thetaByComponent[target.componentType];
    return theta >= target.difficulty;
  });

  return anyMastered ? (1 - slipRate) : guessRate;
}

/**
 * Select probability model based on task type and Q-matrix.
 */
export function calculateExpectedProbability(
  thetaProfile: UserThetaProfile,
  taskSpec: MultiObjectTaskSpec,
  interactionModel?: 'compensatory' | 'conjunctive' | 'disjunctive'
): number {
  const qEntry = getQMatrixEntry(taskSpec.taskType);
  const model = interactionModel || qEntry.interactionModel;

  switch (model) {
    case 'conjunctive':
      return calculateConjunctiveProbability(
        thetaProfile,
        taskSpec.targetObjects
      );
    case 'disjunctive':
      return calculateDisjunctiveProbability(
        thetaProfile,
        taskSpec.targetObjects
      );
    case 'compensatory':
    default:
      return calculateCompensatoryProbability(
        thetaProfile,
        taskSpec.targetObjects,
        taskSpec.compositeDifficulty
      );
  }
}

// =============================================================================
// Multi-Component Response Evaluation
// =============================================================================

/**
 * Normalize response for comparison.
 */
function normalizeResponse(response: string): string {
  return response
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');
}

/**
 * Calculate string similarity using Levenshtein distance.
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

/**
 * Detect error type from response analysis.
 */
function detectErrorType(
  response: string,
  expected: string
): ComponentEvaluation['errorType'] {
  const normalizedResponse = normalizeResponse(response);
  const normalizedExpected = normalizeResponse(expected);

  if (normalizedResponse.length < normalizedExpected.length * 0.5) {
    return 'omission';
  }
  if (normalizedResponse.length > normalizedExpected.length * 1.5) {
    return 'addition';
  }

  // Check for word order issues
  const responseWords = normalizedResponse.split(' ');
  const expectedWords = normalizedExpected.split(' ');
  const sameWords = responseWords.filter(w => expectedWords.includes(w));
  if (sameWords.length === expectedWords.length && normalizedResponse !== normalizedExpected) {
    return 'ordering';
  }

  // Check for form errors (morphological)
  const stems = expectedWords.map(w => w.slice(0, Math.floor(w.length * 0.6)));
  const hasCorrectStems = stems.every(stem =>
    responseWords.some(w => w.startsWith(stem))
  );
  if (hasCorrectStems && normalizedResponse !== normalizedExpected) {
    return 'form';
  }

  return 'substitution';
}

/**
 * Evaluate a single component's contribution to the response.
 */
export function evaluateComponent(
  response: string,
  expected: string,
  target: MultiObjectTarget,
  config: MultiObjectScoringConfig
): ComponentEvaluation {
  const normalizedResponse = normalizeResponse(response);
  const normalizedExpected = normalizeResponse(expected);

  // For now, use overall response similarity as base
  // In a full implementation, this would parse and evaluate each component separately
  const similarity = calculateSimilarity(normalizedResponse, normalizedExpected);

  // Exact match
  if (similarity >= 0.95) {
    return {
      objectId: target.objectId,
      componentType: target.componentType,
      correct: true,
      partialCredit: 1.0,
      feedback: `Correct ${target.componentType} usage.`,
    };
  }

  // Partial credit based on strictness
  const thresholds = {
    lenient: { high: 0.8, medium: 0.6 },
    normal: { high: 0.85, medium: 0.7 },
    strict: { high: 0.9, medium: 0.8 },
  };
  const threshold = thresholds[config.strictness];

  if (config.partialCreditEnabled && similarity >= threshold.high) {
    return {
      objectId: target.objectId,
      componentType: target.componentType,
      correct: true,
      partialCredit: similarity,
      feedback: `Good ${target.componentType} - minor variation detected.`,
      correction: expected,
    };
  }

  if (config.partialCreditEnabled && similarity >= threshold.medium) {
    return {
      objectId: target.objectId,
      componentType: target.componentType,
      correct: false,
      partialCredit: similarity * 0.7,
      errorType: detectErrorType(response, expected),
      feedback: `Partial ${target.componentType} - review needed.`,
      correction: expected,
    };
  }

  // Incorrect
  return {
    objectId: target.objectId,
    componentType: target.componentType,
    correct: false,
    partialCredit: 0,
    errorType: detectErrorType(response, expected),
    feedback: `Incorrect ${target.componentType} usage.`,
    correction: expected,
  };
}

/**
 * Evaluate multi-component response.
 *
 * Aggregates per-component evaluations into overall result.
 */
export function evaluateMultiComponentResponse(
  response: string,
  taskSpec: MultiObjectTaskSpec,
  config: MultiObjectScoringConfig = DEFAULT_CONFIG
): MultiComponentEvaluation {
  const componentEvaluations: ComponentEvaluation[] = taskSpec.targetObjects.map(
    target => evaluateComponent(response, taskSpec.expectedAnswer, target, config)
  );

  // Calculate weighted composite score
  const compositeScore = componentEvaluations.reduce((sum, eval_, i) => {
    const weight = taskSpec.targetObjects[i].weight;
    return sum + weight * eval_.partialCredit;
  }, 0);

  // Overall correctness: all components must be correct
  const overallCorrect = componentEvaluations.every(e => e.correct);

  // Generate aggregated feedback
  const correctComponents = componentEvaluations.filter(e => e.correct);
  const incorrectComponents = componentEvaluations.filter(e => !e.correct);

  let feedback: string;
  if (overallCorrect) {
    feedback = 'Excellent! All components correct.';
  } else if (compositeScore >= 0.7) {
    const incorrect = incorrectComponents.map(e => e.componentType).join(', ');
    feedback = `Good attempt! Review: ${incorrect}.`;
  } else if (compositeScore >= 0.4) {
    feedback = 'Partial understanding. Multiple areas need review.';
  } else {
    feedback = 'Review needed. Check the explanation below.';
  }

  // Build explanation from component feedback
  const explanation = componentEvaluations
    .map(e => `${e.componentType}: ${e.feedback}`)
    .join('\n');

  return {
    overallCorrect,
    compositeScore,
    componentEvaluations,
    feedback,
    explanation,
  };
}

// =============================================================================
// Multi-Component Theta Update
// =============================================================================

/**
 * Calculate theta contributions for all components.
 *
 * Uses Multivariate Elo-inspired update:
 * Δθᵢ = K × wᵢ × (observed - expected) × boundaryDecay
 *
 * Where:
 * - K = learning rate
 * - wᵢ = component weight from Q-matrix
 * - observed = 1 for correct, 0 for incorrect (or partial credit)
 * - expected = probability from MIRT model
 * - boundaryDecay = (1 - |θᵢ|/3) to prevent theta going outside [-3, 3]
 */
export function calculateMultiComponentThetaContributions(
  thetaProfile: UserThetaProfile,
  taskSpec: MultiObjectTaskSpec,
  evaluation: MultiComponentEvaluation,
  config: MultiObjectScoringConfig = DEFAULT_CONFIG
): MultiComponentThetaContribution[] {
  // Calculate expected probability
  const expectedProbability = calculateExpectedProbability(
    thetaProfile,
    taskSpec,
    config.interactionModel
  );

  // Map theta profile to components
  const thetaByComponent: Record<ComponentCode, number> = {
    PHON: thetaProfile.thetaPhonology,
    MORPH: thetaProfile.thetaMorphology,
    LEX: thetaProfile.thetaLexical,
    SYNT: thetaProfile.thetaSyntactic,
    PRAG: thetaProfile.thetaPragmatic,
  };

  // Calculate contributions for each target
  return evaluation.componentEvaluations.map((compEval, i) => {
    const target = taskSpec.targetObjects[i];
    const currentTheta = thetaByComponent[target.componentType];

    // Observed score (use partial credit)
    const observed = compEval.partialCredit;

    // Boundary decay: prevent theta from going outside [-3, 3]
    const boundaryDecay = 1 - Math.abs(currentTheta) / 3;

    // Calculate delta
    const delta = config.learningRate *
      target.weight *
      (observed - expectedProbability) *
      boundaryDecay *
      target.discrimination;

    return {
      componentType: target.componentType,
      thetaDelta: delta,
      weight: target.weight,
      sourceObjectId: target.objectId,
    };
  });
}

/**
 * Aggregate theta contributions into a single ThetaState update.
 *
 * Handles multiple contributions to the same component by summing.
 */
export function aggregateThetaContributions(
  contributions: MultiComponentThetaContribution[]
): Partial<UserThetaProfile> {
  const aggregated: Partial<UserThetaProfile> = {};

  // Sum contributions by component
  const byComponent = new Map<ComponentCode, number>();
  for (const contrib of contributions) {
    const current = byComponent.get(contrib.componentType) || 0;
    byComponent.set(contrib.componentType, current + contrib.thetaDelta);
  }

  // Map to theta profile fields
  if (byComponent.has('PHON')) {
    aggregated.thetaPhonology = byComponent.get('PHON');
  }
  if (byComponent.has('MORPH')) {
    aggregated.thetaMorphology = byComponent.get('MORPH');
  }
  if (byComponent.has('LEX')) {
    aggregated.thetaLexical = byComponent.get('LEX');
  }
  if (byComponent.has('SYNT')) {
    aggregated.thetaSyntactic = byComponent.get('SYNT');
  }
  if (byComponent.has('PRAG')) {
    aggregated.thetaPragmatic = byComponent.get('PRAG');
  }

  // Calculate global theta change as weighted average
  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  const weightedDelta = contributions.reduce(
    (sum, c) => sum + c.weight * c.thetaDelta,
    0
  );
  if (totalWeight > 0) {
    aggregated.thetaGlobal = weightedDelta / totalWeight;
  }

  return aggregated;
}

// =============================================================================
// Component-Specific Feedback Generation
// =============================================================================

/**
 * Generate detailed feedback for each component.
 */
export function generateComponentFeedback(
  evaluation: ComponentEvaluation,
  target: MultiObjectTarget
): string {
  const componentNames: Record<ComponentCode, string> = {
    PHON: 'Pronunciation/Spelling',
    MORPH: 'Word Form',
    LEX: 'Vocabulary',
    SYNT: 'Grammar',
    PRAG: 'Usage/Register',
  };

  const componentName = componentNames[target.componentType];

  if (evaluation.correct) {
    if (evaluation.partialCredit >= 0.95) {
      return `${componentName}: Excellent!`;
    }
    return `${componentName}: Good - minor variation acceptable.`;
  }

  // Error-specific feedback
  const errorMessages: Record<string, string> = {
    omission: `${componentName}: Some elements are missing. Check for completeness.`,
    substitution: `${componentName}: Wrong choice used. Expected: "${evaluation.correction}".`,
    addition: `${componentName}: Extra elements added. Simplify your response.`,
    ordering: `${componentName}: Word order issue. Review the structure.`,
    form: `${componentName}: Form error (e.g., tense, number). Expected: "${evaluation.correction}".`,
    usage: `${componentName}: Inappropriate in this context. Consider the register.`,
  };

  return errorMessages[evaluation.errorType || 'substitution'];
}

/**
 * Generate comprehensive feedback for all components.
 */
export function generateMultiComponentFeedback(
  evaluation: MultiComponentEvaluation,
  taskSpec: MultiObjectTaskSpec
): string {
  const feedbackLines: string[] = [];

  // Overall status
  if (evaluation.overallCorrect) {
    feedbackLines.push('All components correct!');
  } else {
    const score = Math.round(evaluation.compositeScore * 100);
    feedbackLines.push(`Score: ${score}%`);
  }

  feedbackLines.push('');

  // Per-component feedback
  evaluation.componentEvaluations.forEach((compEval, i) => {
    const target = taskSpec.targetObjects[i];
    const feedback = generateComponentFeedback(compEval, target);
    const icon = compEval.correct ? '✓' : '✗';
    feedbackLines.push(`${icon} ${feedback}`);
  });

  return feedbackLines.join('\n');
}

// =============================================================================
// Main Processing Function
// =============================================================================

/**
 * Process a multi-object task response.
 *
 * Complete pipeline:
 * 1. Evaluate response per component
 * 2. Calculate theta contributions
 * 3. Update mastery state for each object
 * 4. Update priorities
 * 5. Update FSRS scheduling
 * 6. Record analytics
 *
 * @param userResponse - User's response data
 * @param config - Scoring configuration
 * @returns Complete outcome with all updates
 */
export async function processMultiObjectResponse(
  userResponse: MultiObjectUserResponse,
  config: MultiObjectScoringConfig = DEFAULT_CONFIG
): Promise<MultiObjectResponseOutcome> {
  const db = getPrisma();
  const { sessionId, taskSpec, response, responseTimeMs, hintsUsed, cueLevel } = userResponse;

  // 1. Get session and user data
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Build theta profile from session
  const thetaProfile: UserThetaProfile = {
    thetaGlobal: session.thetaGlobal,
    thetaPhonology: session.thetaPhonology,
    thetaMorphology: session.thetaMorphology,
    thetaLexical: session.thetaLexical,
    thetaSyntactic: session.thetaSyntactic,
    thetaPragmatic: session.thetaPragmatic,
  };

  // 2. Evaluate multi-component response
  const evaluation = evaluateMultiComponentResponse(response, taskSpec, config);

  // 3. Calculate theta contributions
  const thetaContributions = calculateMultiComponentThetaContributions(
    thetaProfile,
    taskSpec,
    evaluation,
    config
  );

  // 4. Aggregate theta changes
  const aggregatedThetaChange = aggregateThetaContributions(thetaContributions);

  // 5. Update session theta
  await applyThetaRules(sessionId, {
    thetaGlobal: aggregatedThetaChange.thetaGlobal || 0,
    thetaPhonology: aggregatedThetaChange.thetaPhonology || 0,
    thetaMorphology: aggregatedThetaChange.thetaMorphology || 0,
    thetaLexical: aggregatedThetaChange.thetaLexical || 0,
    thetaSyntactic: aggregatedThetaChange.thetaSyntactic || 0,
    thetaPragmatic: aggregatedThetaChange.thetaPragmatic || 0,
  } as ThetaState);

  // 6. Update each object's mastery and priority
  const masteryUpdates: MultiObjectResponseOutcome['masteryUpdates'] = [];
  const priorityUpdates: MultiObjectResponseOutcome['priorityUpdates'] = [];
  const fsrsUpdates: MultiObjectResponseOutcome['fsrsUpdates'] = [];

  for (let i = 0; i < taskSpec.targetObjects.length; i++) {
    const target = taskSpec.targetObjects[i];
    const compEval = evaluation.componentEvaluations[i];

    // Get current mastery
    const mastery = await db.masteryState.findUnique({
      where: {
        userId_objectId: {
          userId: session.userId,
          objectId: target.objectId,
        },
      },
    });

    if (!mastery) continue;

    const previousStage = mastery.stage as MasteryStage;

    // Record exposure
    await recordExposure(session.userId, target.objectId, {
      correct: compEval.correct,
      responseTime: responseTimeMs,
      cueLevel,
      taskType: taskSpec.taskType,
      modality: taskSpec.modality,
    });

    // Update mastery accuracy
    const exposureCount = mastery.exposureCount + 1;
    const newAccuracy = (mastery.cueFreeAccuracy * mastery.exposureCount + compEval.partialCredit) / exposureCount;

    await updateMasteryState(session.userId, target.objectId, {
      cueFreeAccuracy: cueLevel === 0 ? newAccuracy : mastery.cueFreeAccuracy,
      cueAssistedAccuracy: cueLevel > 0 ? newAccuracy : mastery.cueAssistedAccuracy,
      lastSeen: new Date(),
    });

    // Check for stage transition
    const stageTransition = await transitionStage(session.userId, target.objectId);
    const newStage = stageTransition.newStage;

    masteryUpdates.push({
      objectId: target.objectId,
      componentType: target.componentType,
      previousStage,
      newStage,
      stageChanged: stageTransition.changed,
      newAccuracy,
    });

    // Update FSRS
    const fsrsRating = compEval.correct ? (compEval.partialCredit >= 0.95 ? 4 : 3) : 1;
    const fsrsResult = await updateFSRSParameters(session.userId, target.objectId, fsrsRating);
    if (fsrsResult) {
      fsrsUpdates.push({
        objectId: target.objectId,
        nextReview: fsrsResult.nextReview,
        stability: fsrsResult.stability,
        difficulty: fsrsResult.difficulty,
      });
    }

    // Update priority
    const languageObject = await db.languageObject.findUnique({
      where: { id: target.objectId },
    });

    if (languageObject) {
      const previousPriority = languageObject.priority;
      const newPriority = calculateEffectivePriority(
        languageObject.fre as { F: number; R: number; E: number },
        { stage: newStage, cueFreeAccuracy: newAccuracy, cueAssistedAccuracy: mastery.cueAssistedAccuracy },
        languageObject.irtDifficulty
      );

      await updateObjectPriority(target.objectId, newPriority);

      priorityUpdates.push({
        objectId: target.objectId,
        previousPriority,
        newPriority,
      });
    }
  }

  // 7. Record response in database
  const responseRecord = await recordResponse(sessionId, {
    correct: evaluation.overallCorrect,
    responseTimeMs,
    partialCredit: evaluation.compositeScore,
  });

  // 8. Generate comprehensive feedback
  const feedback = generateMultiComponentFeedback(evaluation, taskSpec);
  evaluation.feedback = feedback;

  return {
    responseId: responseRecord.id,
    evaluation,
    thetaContributions,
    aggregatedThetaChange,
    masteryUpdates,
    priorityUpdates,
    fsrsUpdates,
  };
}

// =============================================================================
// Helper Functions for Task Generation Integration
// =============================================================================

/**
 * Create a MultiObjectTaskSpec from individual language objects.
 *
 * Utility for task generation service integration.
 */
export function createMultiObjectTaskSpec(
  taskId: string,
  sessionId: string,
  goalId: string,
  objects: Array<{
    id: string;
    type: LanguageObjectType;
    content: string;
    irtDifficulty: number;
    irtDiscrimination: number;
    isPrimary: boolean;
  }>,
  taskType: TaskType,
  taskFormat: import('../../core/types').TaskFormat,
  modality: import('../../core/types').TaskModality,
  domain: string,
  expectedAnswer: string,
  isFluencyTask: boolean = false
): MultiObjectTaskSpec {
  // Map objects to targets without weights
  const targetsWithoutWeights: Omit<MultiObjectTarget, 'weight'>[] = objects.map(obj => ({
    objectId: obj.id,
    componentType: objectTypeToComponent(obj.type),
    content: obj.content,
    isPrimaryTarget: obj.isPrimary,
    cognitiveProcess: getQMatrixEntry(taskType).primaryProcess,
    difficulty: obj.irtDifficulty,
    discrimination: obj.irtDiscrimination,
  }));

  // Allocate Q-matrix weights
  const targetObjects = allocateQMatrixWeights(targetsWithoutWeights, taskType);

  // Calculate composite difficulty
  const compositeDifficulty = calculateCompositeDifficulty(targetObjects);

  return {
    taskId,
    sessionId,
    goalId,
    targetObjects,
    taskType,
    taskFormat,
    modality,
    domain,
    compositeDifficulty,
    isFluencyTask,
    expectedAnswer,
  };
}

/**
 * Check if a task specification should use multi-object processing.
 *
 * Use multi-object processing when:
 * - Multiple target objects specified
 * - Task type involves multiple components (from Q-matrix)
 * - Explicit multi-component mode requested
 */
export function shouldUseMultiObjectProcessing(
  targetObjects: MultiObjectTarget[] | undefined,
  taskType: TaskType
): boolean {
  // Multiple explicit targets
  if (targetObjects && targetObjects.length > 1) {
    return true;
  }

  // Task type naturally involves multiple components
  const qEntry = getQMatrixEntry(taskType);
  const componentCount = Object.keys(qEntry.components).length;
  return componentCount >= 3;
}
