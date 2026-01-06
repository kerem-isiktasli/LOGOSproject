/**
 * Scoring + Update Service (Layer 3)
 *
 * Implements Phase 3.3: Layer 3 of the learning pipeline.
 * Captures user responses, evaluates correctness, updates mastery state,
 * recalculates priority, and logs analytics.
 */

import { getPrisma } from '../db/prisma';
import {
  updateMasteryState,
  recordExposure,
  updateFSRSParameters,
  transitionStage,
  type StageTransition,
} from '../db/repositories/mastery.repository';
import {
  recordResponse,
  recordStageTransition,
  recordTaskType,
  applyThetaRules,
  type SessionMode,
  type ThetaState,
} from '../db/repositories/session.repository';
import {
  createErrorAnalysis,
  recalculateComponentStats,
  detectBottlenecks,
  type ComponentCode,
} from '../db/repositories/error-analysis.repository';
import { updateObjectPriority } from '../db/repositories/goal.repository';
import type { GeneratedTask, TaskSpec } from './task-generation.service';
import { calculateEffectivePriority, calculateMasteryAdjustment, calculateUrgencyScore } from './state-priority.service';
import { calibrateItems } from '../../core/irt';

// =============================================================================
// Types
// =============================================================================

export interface UserResponse {
  sessionId: string;
  task: GeneratedTask;
  response: string;
  responseTimeMs: number;
  hintsUsed: number;
}

export interface EvaluationResult {
  correct: boolean;
  partialCredit?: number; // 0-1 for partial correctness
  feedback: string;
  explanation?: string;
  correction?: string;
}

export interface ResponseOutcome {
  responseId: string;
  evaluation: EvaluationResult;
  masteryUpdate: {
    previousStage: number;
    newStage: number;
    stageChanged: boolean;
    newAccuracy: number;
  };
  priorityUpdate: {
    previousPriority: number;
    newPriority: number;
  };
  fsrsUpdate?: {
    nextReview: Date;
    stability: number;
    difficulty: number;
  };
  thetaContribution?: Partial<ThetaState>;
}

export interface ScoringConfig {
  sessionMode: SessionMode;
  strictness?: 'lenient' | 'normal' | 'strict';
  partialCreditEnabled?: boolean;
}

// Stage transition thresholds (from Gap 1.2)
const STAGE_THRESHOLDS = {
  0: { promote: 0.5, demote: 0 },      // Unknown → Recognized
  1: { promote: 0.6, demote: 0.3 },    // Recognized → Recall
  2: { promote: 0.75, demote: 0.4 },   // Recall → Controlled
  3: { promote: 0.9, demote: 0.6 },    // Controlled → Automatic
  4: { promote: 1, demote: 0.8 },      // Automatic (no further promotion)
};

// =============================================================================
// Response Evaluation
// =============================================================================

/**
 * Evaluate user response correctness.
 */
export function evaluateResponse(
  userResponse: string,
  expectedAnswer: string,
  config: ScoringConfig
): EvaluationResult {
  const normalized = normalizeResponse(userResponse);
  const expected = normalizeResponse(expectedAnswer);

  // Exact match
  if (normalized === expected) {
    return {
      correct: true,
      partialCredit: 1,
      feedback: 'Correct!',
    };
  }

  // Check for partial credit
  if (config.partialCreditEnabled) {
    const similarity = calculateSimilarity(normalized, expected);

    if (similarity >= 0.9) {
      return {
        correct: true,
        partialCredit: 0.95,
        feedback: 'Almost perfect! Minor spelling variation.',
        correction: expectedAnswer,
      };
    }

    if (similarity >= 0.7 && config.strictness !== 'strict') {
      return {
        correct: false,
        partialCredit: similarity,
        feedback: 'Close, but not quite right.',
        correction: expectedAnswer,
        explanation: `Expected: "${expectedAnswer}"`,
      };
    }
  }

  // Check for common errors
  const errorAnalysis = analyzeError(normalized, expected);

  return {
    correct: false,
    partialCredit: 0,
    feedback: 'Incorrect.',
    correction: expectedAnswer,
    explanation: errorAnalysis.explanation,
  };
}

/**
 * Normalize response for comparison.
 */
function normalizeResponse(response: string): string {
  return response
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');    // Normalize whitespace
}

/**
 * Calculate string similarity (Levenshtein-based).
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // Deletion
        matrix[i][j - 1] + 1,     // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * Analyze error type for feedback.
 */
function analyzeError(
  response: string,
  expected: string
): { type: string; explanation: string } {
  // Check for transposition
  if (response.length === expected.length) {
    let differences = 0;
    for (let i = 0; i < response.length; i++) {
      if (response[i] !== expected[i]) differences++;
    }
    if (differences <= 2) {
      return {
        type: 'spelling',
        explanation: 'Letter order or spelling error.',
      };
    }
  }

  // Check for missing/extra letters
  if (Math.abs(response.length - expected.length) <= 2) {
    return {
      type: 'typo',
      explanation: 'Missing or extra letters.',
    };
  }

  // Default
  return {
    type: 'wrong_word',
    explanation: 'This is not the expected answer.',
  };
}

// =============================================================================
// Mastery State Updates
// =============================================================================

// Maximum scaffolding gap allowed for Stage 3→4 promotion
const MAX_GAP_FOR_AUTOMATIC = 0.15;

/**
 * Determine if stage should change based on accuracy and scaffolding gap.
 * For Stage 3→4 (Automatic), requires scaffolding gap < 0.15.
 */
function determineStageTransition(
  currentStage: number,
  cueFreeAccuracy: number,
  cueAssistedAccuracy: number,
  scaffoldingGap?: number
): { newStage: number; changed: boolean } {
  const thresholds = STAGE_THRESHOLDS[currentStage as keyof typeof STAGE_THRESHOLDS];

  if (!thresholds) {
    return { newStage: currentStage, changed: false };
  }

  // Check for promotion
  if (currentStage < 4 && cueFreeAccuracy >= thresholds.promote) {
    // Special check for Stage 3→4: must have low scaffolding gap
    // This ensures the learner can perform WITHOUT cue assistance
    if (currentStage === 3) {
      const gap = scaffoldingGap ?? (cueAssistedAccuracy - cueFreeAccuracy);
      if (gap > MAX_GAP_FOR_AUTOMATIC) {
        // Gap too high - learner still depends on cues
        return { newStage: currentStage, changed: false };
      }
    }
    return { newStage: currentStage + 1, changed: true };
  }

  // Check for demotion
  if (currentStage > 0 && cueFreeAccuracy < thresholds.demote) {
    return { newStage: currentStage - 1, changed: true };
  }

  return { newStage: currentStage, changed: false };
}

/**
 * Calculate FSRS parameters for next review.
 */
function calculateFSRSUpdate(
  correct: boolean,
  currentDifficulty: number,
  currentStability: number,
  responseTimeMs: number
): { difficulty: number; stability: number; nextReview: Date; rating: 1 | 2 | 3 | 4 } {
  // FSRS rating: 1=Again, 2=Hard, 3=Good, 4=Easy
  let rating: 1 | 2 | 3 | 4;

  if (!correct) {
    rating = 1; // Again
  } else if (responseTimeMs > 10000) {
    rating = 2; // Hard (slow but correct)
  } else if (responseTimeMs > 5000) {
    rating = 3; // Good
  } else {
    rating = 4; // Easy (fast and correct)
  }

  // Update difficulty (D)
  const difficultyDelta = rating === 1 ? 0.2 : rating === 4 ? -0.1 : 0;
  const newDifficulty = Math.max(1, Math.min(10, currentDifficulty + difficultyDelta));

  // Update stability (S)
  let newStability: number;
  if (rating === 1) {
    // Lapse - reset stability
    newStability = Math.max(0.1, currentStability * 0.2);
  } else {
    // Success - increase stability
    const stabilityFactor = rating === 4 ? 2.5 : rating === 3 ? 2.0 : 1.5;
    newStability = currentStability * stabilityFactor + 0.5;
  }

  // Calculate next review interval
  const intervalDays = Math.max(1, newStability * (1 + (5 - newDifficulty) / 10));
  const nextReview = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    difficulty: newDifficulty,
    stability: newStability,
    nextReview,
    rating,
  };
}

/**
 * Calculate theta contribution for IRT update.
 */
function calculateThetaContribution(
  correct: boolean,
  itemDifficulty: number,
  itemDiscrimination: number,
  componentType: string
): Partial<ThetaState> {
  // IRT-based theta adjustment
  // Correct: positive contribution, Incorrect: negative
  const sign = correct ? 1 : -1;

  // Larger adjustment for discriminating items
  const magnitude = 0.1 * itemDiscrimination * (1 - Math.abs(itemDifficulty) / 3);
  const contribution = sign * magnitude;

  // Map to component-specific theta
  const result: Partial<ThetaState> = {
    thetaGlobal: contribution * 0.5, // Partial global update
  };

  switch (componentType) {
    case 'LEX':
      result.thetaLexical = contribution;
      break;
    case 'MORPH':
      result.thetaMorphology = contribution;
      break;
    case 'G2P':
      result.thetaPhonology = contribution;
      break;
    case 'SYNT':
      result.thetaSyntactic = contribution;
      break;
    case 'PRAG':
      result.thetaPragmatic = contribution;
      break;
  }

  return result;
}

// =============================================================================
// Main Processing Functions
// =============================================================================

/**
 * Process a user response through the complete pipeline.
 */
export async function processResponse(
  userId: string,
  userResponse: UserResponse,
  config: ScoringConfig
): Promise<ResponseOutcome> {
  const db = getPrisma();
  const { task, response, responseTimeMs, hintsUsed } = userResponse;
  const { spec } = task;

  // 1. Evaluate correctness
  const evaluation = evaluateResponse(response, task.expectedAnswer, config);

  // 2. Get current mastery state
  const object = await db.languageObject.findUnique({
    where: { id: spec.objectId },
    include: { masteryState: true },
  });

  if (!object) {
    throw new Error(`Object not found: ${spec.objectId}`);
  }

  const mastery = object.masteryState;
  const previousStage = mastery?.stage ?? 0;
  const previousPriority = object.priority;

  // 3. Determine cue level from hints used
  const effectiveCueLevel = Math.min(hintsUsed, spec.cueLevel) as 0 | 1 | 2 | 3;

  // 4. Record the response
  const responseRecord = await recordResponse({
    sessionId: userResponse.sessionId,
    objectId: spec.objectId,
    taskType: task.metadata.source,
    taskFormat: spec.format,
    modality: spec.modality,
    correct: evaluation.correct,
    responseTimeMs,
    cueLevel: effectiveCueLevel,
    responseContent: response,
    expectedContent: task.expectedAnswer,
  });

  // 5. Update exposure and accuracy
  await recordExposure(spec.objectId, evaluation.correct, effectiveCueLevel);

  // 6. Get updated mastery state
  const updatedMastery = await db.masteryState.findUnique({
    where: { objectId: spec.objectId },
  });

  if (!updatedMastery) {
    throw new Error(`Mastery state not found after update: ${spec.objectId}`);
  }

  // 7. Determine stage transition
  const stageTransition = determineStageTransition(
    previousStage,
    updatedMastery.cueFreeAccuracy,
    updatedMastery.cueAssistedAccuracy
  );

  if (stageTransition.changed) {
    await transitionStage(spec.objectId, stageTransition.newStage);
    await recordStageTransition(userResponse.sessionId);
  }

  // 8. Calculate and apply FSRS update
  const fsrsUpdate = calculateFSRSUpdate(
    evaluation.correct,
    updatedMastery.fsrsDifficulty,
    updatedMastery.fsrsStability,
    responseTimeMs
  );

  await updateFSRSParameters(
    spec.objectId,
    fsrsUpdate.difficulty,
    fsrsUpdate.stability,
    fsrsUpdate.nextReview,
    fsrsUpdate.rating
  );

  // 9. Recalculate priority
  const masteryAdjustment = calculateMasteryAdjustment(
    stageTransition.newStage,
    updatedMastery.cueFreeAccuracy,
    updatedMastery.cueAssistedAccuracy - updatedMastery.cueFreeAccuracy
  );
  const urgencyScore = calculateUrgencyScore(fsrsUpdate.nextReview);

  // Check if this object's component is a bottleneck
  const componentCode = mapTypeToComponent(object.type);
  const bottlenecks = await detectBottlenecks(userId, object.goalId);
  const isBottleneck = bottlenecks.some(
    (b) => b.component === componentCode && b.isBottleneck
  );

  const newPriority = calculateEffectivePriority(
    object.priority * 0.8, // Decay base priority slightly
    masteryAdjustment,
    urgencyScore,
    isBottleneck
  );

  await updateObjectPriority(spec.objectId, newPriority);

  // 10. Record task type for fluency/versatility tracking
  await recordTaskType(userResponse.sessionId, spec.isFluencyTask);

  // 11. Calculate theta contribution
  let thetaContribution: Partial<ThetaState> | undefined;

  if (config.sessionMode !== 'learning') {
    thetaContribution = calculateThetaContribution(
      evaluation.correct,
      object.irtDifficulty,
      object.irtDiscrimination,
      spec.type
    );

    // Apply theta rules
    await applyThetaRules(userId, config.sessionMode, thetaContribution);
  }

  // 12. Create error analysis for incorrect responses
  if (!evaluation.correct) {
    const componentCode = mapTypeToComponent(spec.type);
    const errorAnalysis = analyzeError(
      normalizeResponse(response),
      normalizeResponse(task.expectedAnswer)
    );

    await createErrorAnalysis({
      responseId: responseRecord.id,
      objectId: spec.objectId,
      component: componentCode,
      errorType: errorAnalysis.type,
      explanation: errorAnalysis.explanation,
      correction: evaluation.correction ?? task.expectedAnswer,
    });

    // Update component stats
    await recalculateComponentStats(userId);
  }

  return {
    responseId: responseRecord.id,
    evaluation,
    masteryUpdate: {
      previousStage,
      newStage: stageTransition.newStage,
      stageChanged: stageTransition.changed,
      newAccuracy: updatedMastery.cueFreeAccuracy,
    },
    priorityUpdate: {
      previousPriority,
      newPriority,
    },
    fsrsUpdate: {
      nextReview: fsrsUpdate.nextReview,
      stability: fsrsUpdate.stability,
      difficulty: fsrsUpdate.difficulty,
    },
    thetaContribution,
  };
}

/**
 * Map object type to component code.
 */
function mapTypeToComponent(type: string): ComponentCode {
  const mapping: Record<string, ComponentCode> = {
    LEX: 'LEX',
    MORPH: 'MORPH',
    G2P: 'PHON',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };

  return mapping[type] ?? 'LEX';
}

/**
 * Batch process multiple responses (for session end).
 */
export async function batchProcessResponses(
  userId: string,
  responses: UserResponse[],
  config: ScoringConfig
): Promise<ResponseOutcome[]> {
  const outcomes: ResponseOutcome[] = [];

  for (const response of responses) {
    const outcome = await processResponse(userId, response, config);
    outcomes.push(outcome);
  }

  return outcomes;
}

/**
 * Get session scoring summary.
 */
export function summarizeOutcomes(outcomes: ResponseOutcome[]): {
  totalResponses: number;
  correctCount: number;
  accuracy: number;
  stagePromotions: number;
  stageDemotions: number;
  averageResponseTime: number;
  thetaChange: Partial<ThetaState>;
} {
  const correctCount = outcomes.filter((o) => o.evaluation.correct).length;
  const stagePromotions = outcomes.filter(
    (o) => o.masteryUpdate.stageChanged && o.masteryUpdate.newStage > o.masteryUpdate.previousStage
  ).length;
  const stageDemotions = outcomes.filter(
    (o) => o.masteryUpdate.stageChanged && o.masteryUpdate.newStage < o.masteryUpdate.previousStage
  ).length;

  // Aggregate theta changes
  const thetaChange: Partial<ThetaState> = {};
  for (const outcome of outcomes) {
    if (outcome.thetaContribution) {
      for (const [key, value] of Object.entries(outcome.thetaContribution)) {
        const k = key as keyof ThetaState;
        thetaChange[k] = (thetaChange[k] ?? 0) + (value ?? 0);
      }
    }
  }

  return {
    totalResponses: outcomes.length,
    correctCount,
    accuracy: outcomes.length > 0 ? correctCount / outcomes.length : 0,
    stagePromotions,
    stageDemotions,
    averageResponseTime: 0, // Would need response times
    thetaChange,
  };
}

// =============================================================================
// IRT Calibration Trigger
// =============================================================================

// Minimum responses per item before calibration
const MIN_RESPONSES_FOR_CALIBRATION = 10;

// Cache for tracking response counts per item
const itemResponseCounts = new Map<string, number>();

/**
 * Check if IRT calibration should be triggered for an item.
 * Calibration runs when an item accumulates enough responses.
 */
export async function checkAndTriggerCalibration(
  objectId: string,
  goalId: string
): Promise<{ calibrated: boolean; newDifficulty?: number; newDiscrimination?: number }> {
  const prisma = getPrisma();

  // Increment response count
  const currentCount = (itemResponseCounts.get(objectId) ?? 0) + 1;
  itemResponseCounts.set(objectId, currentCount);

  // Only calibrate when threshold is reached
  if (currentCount < MIN_RESPONSES_FOR_CALIBRATION) {
    return { calibrated: false };
  }

  // Reset counter
  itemResponseCounts.set(objectId, 0);

  try {
    // Fetch all responses for this item
    const responses = await prisma.response.findMany({
      where: {
        objectId,
        session: { goalId },
      },
      select: {
        correct: true,
        responseTimeMs: true,
        session: {
          select: { userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Last 100 responses
    });

    if (responses.length < MIN_RESPONSES_FOR_CALIBRATION) {
      return { calibrated: false };
    }

    // Group responses by user for ability estimation
    const userResponses = new Map<string, { correct: boolean; itemId: string }[]>();
    for (const r of responses) {
      const userId = r.session.userId;
      if (!userResponses.has(userId)) {
        userResponses.set(userId, []);
      }
      userResponses.get(userId)!.push({
        correct: r.correct,
        itemId: objectId,
      });
    }

    // Build response patterns for calibration
    const responsePatterns: { thetaEstimate: number; responses: { itemId: string; correct: boolean }[] }[] = [];

    for (const [userId, userResps] of userResponses) {
      // Get user's current theta as ability estimate
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { thetaGlobal: true },
      });

      if (user) {
        responsePatterns.push({
          thetaEstimate: user.thetaGlobal,
          responses: userResps,
        });
      }
    }

    if (responsePatterns.length < 5) {
      return { calibrated: false };
    }

    // Convert response patterns to boolean matrix for calibrateItems
    // Each row is a person, each column is an item (in this case, single item)
    const responseMatrix: boolean[][] = responsePatterns.map((pattern) => {
      // For single item calibration, each person has one response
      const correct = pattern.responses.find((r) => r.itemId === objectId)?.correct ?? false;
      return [correct];
    });

    // Run IRT calibration
    const calibrationResult = calibrateItems(responseMatrix);

    if (calibrationResult.length > 0) {
      const newParams = calibrationResult[0];

      // Update database with new parameters
      await prisma.languageObject.update({
        where: { id: objectId },
        data: {
          irtDifficulty: newParams.b,
          irtDiscrimination: newParams.a,
        },
      });

      return {
        calibrated: true,
        newDifficulty: newParams.b,
        newDiscrimination: newParams.a,
      };
    }
  } catch (err) {
    console.error('IRT calibration failed:', err);
  }

  return { calibrated: false };
}

/**
 * Trigger calibration for all items in a goal after session end.
 */
export async function triggerSessionEndCalibration(goalId: string): Promise<number> {
  const prisma = getPrisma();
  let calibratedCount = 0;

  try {
    // Get items with enough responses
    const itemsWithResponses = await prisma.response.groupBy({
      by: ['objectId'],
      where: {
        session: { goalId },
      },
      _count: { objectId: true },
      having: {
        objectId: { _count: { gte: MIN_RESPONSES_FOR_CALIBRATION } },
      },
    });

    for (const item of itemsWithResponses) {
      const result = await checkAndTriggerCalibration(item.objectId, goalId);
      if (result.calibrated) {
        calibratedCount++;
      }
    }
  } catch (err) {
    console.error('Session end calibration failed:', err);
  }

  return calibratedCount;
}
