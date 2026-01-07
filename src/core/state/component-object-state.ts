/**
 * Component Object State
 *
 * Unified tracking of learning state across all language components.
 * Manages exposure history, cognitive induction, IRT metrics, and relationships
 * for vocabulary, grammar, phonology, morphology, and pragmatics.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.3
 */

import type { MasteryStage, ComponentType, TaskModality } from '../types';
import type { PedagogicalIntent } from '../content/pedagogical-intent';
import type { TraditionalTaskType } from '../tasks/traditional-task-types';

// =============================================================================
// Types
// =============================================================================

/**
 * Language component categories.
 */
export type LanguageComponent =
  | 'g2p'          // Grapheme-phoneme correspondence
  | 'morphology'   // Word formation
  | 'vocabulary'   // Lexical items
  | 'grammar'      // Syntactic constructions
  | 'pragmatic';   // Register and context usage

/**
 * Task phase in learning cycle.
 */
export type TaskPhase =
  | 'learning'     // Initial introduction
  | 'training'     // Deliberate practice
  | 'evaluation';  // Assessment

/**
 * Problem type for IRT tracking.
 */
export type ProblemType =
  | 'recognition'        // Identify correct answer
  | 'recall'            // Retrieve from memory
  | 'production'        // Generate output
  | 'transformation'    // Convert/modify
  | 'analysis'          // Break down/evaluate
  | 'synthesis';        // Combine/create

/**
 * Exposure pattern entry.
 */
export interface ExposurePattern {
  /** Timestamp */
  timestamp: Date;

  /** Task type used */
  taskType: TraditionalTaskType;

  /** Task phase */
  phase: TaskPhase;

  /** Modality */
  modality: TaskModality;

  /** Success (true/false/partial) */
  success: boolean | 'partial';

  /** Response time (ms) */
  responseTime: number;

  /** Cue level used (0-3) */
  cueLevel: number;
}

/**
 * Cognitive induction metrics.
 */
export interface CognitiveInduction {
  /** How automated the knowledge is (0-1) */
  automationLevel: number;

  /** Contexts where successfully used */
  usageSpaceExpansion: number;

  /** Speed/accuracy in procedural tasks (0-1) */
  proceduralFluency: number;

  /** Explicit knowledge recall strength (0-1) */
  declarativeStrength: number;

  /** Trend direction (-1 to 1) */
  trendDirection: number;
}

/**
 * IRT performance metrics.
 */
export interface IRTMetrics {
  /** Overall accuracy (0-1) */
  overallAccuracy: number;

  /** Accuracy by pedagogical intent */
  accuracyByIntent: Partial<Record<PedagogicalIntent, number>>;

  /** Accuracy by problem type */
  accuracyByProblemType: Partial<Record<ProblemType, number>>;

  /** Current theta estimate */
  thetaEstimate: number;

  /** Item difficulty calibration */
  difficultyCalibration: number;

  /** Item discrimination index */
  discriminationIndex: number;

  /** Standard error of measurement */
  standardError: number;
}

/**
 * Transfer effects tracking.
 */
export interface TransferEffects {
  /** Objects this helps learn */
  positiveTransferTo: string[];

  /** Objects this interferes with */
  negativeTransferTo: string[];

  /** Self-reinforcing score (0-1) */
  autoReinforcementScore: number;

  /** Transfer to other components */
  crossComponentTransfer: Partial<Record<LanguageComponent, number>>;
}

/**
 * Feature vector z(w) for an object.
 */
export interface FeatureVector {
  /** Frequency (0-1) */
  F: number;

  /** Relational density */
  R: number;

  /** Domain distribution */
  D: Record<string, number>;

  /** Morphological score (0-1) */
  M: number;

  /** Phonological difficulty (0-1) */
  P: number;
}

/**
 * Object relationships.
 */
export interface ObjectRelations {
  /** Collocation pairs with PMI */
  collocations: Array<{ objectId: string; pmi: number }>;

  /** Morphological family members */
  morphologicalFamily: string[];

  /** Semantically similar objects */
  semanticNeighbors: string[];

  /** Syntactic patterns using this object */
  syntacticPatterns: string[];

  /** Objects this is prerequisite for */
  prerequisiteOf: string[];

  /** Objects this depends on */
  dependsOn: string[];
}

/**
 * Activity participation tracking.
 */
export interface ActivityParticipation {
  /** Comprehension activities count */
  interpretationTasks: number;

  /** Production activities count */
  creationTasks: number;

  /** Total engagement time (minutes) */
  totalEngagementTime: number;

  /** Average response quality (0-1) */
  qualityScore: number;
}

/**
 * Mastery state summary.
 */
export interface MasteryStateSummary {
  /** Current mastery stage (0-4) */
  stage: MasteryStage;

  /** Cue-free accuracy */
  cueFreeAccuracy: number;

  /** Cue-assisted accuracy */
  cueAssistedAccuracy: number;

  /** Gap between cue-free and assisted */
  scaffoldingGap: number;

  /** Days at current stability */
  stabilityDays: number;

  /** Next scheduled review */
  nextReviewDate: Date;

  /** FSRS parameters */
  fsrsState?: {
    stability: number;
    difficulty: number;
    retrievability: number;
  };
}

/**
 * Complete component object state.
 */
export interface ComponentObjectState {
  /** Unique object ID */
  objectId: string;

  /** Language component */
  component: LanguageComponent;

  /** Content (word, pattern, etc.) */
  content: string;

  /** Goal context priority */
  goalContextPriority: number;

  /** Highlighted for current context */
  emphasizedForContext: boolean;

  /** Exposure history */
  exposureHistory: {
    totalExposures: number;
    byModality: Record<TaskModality, number>;
    byTaskPhase: Record<TaskPhase, number>;
    lastExposure: Date | null;
    exposurePattern: ExposurePattern[];
  };

  /** Cognitive process induction */
  cognitiveInduction: CognitiveInduction;

  /** IRT performance metrics */
  irtMetrics: IRTMetrics;

  /** Transfer effects */
  transferEffects: TransferEffects;

  /** Feature vector */
  featureVector: FeatureVector;

  /** Activity participation */
  activityParticipation: ActivityParticipation;

  /** Object relationships */
  relations: ObjectRelations;

  /** Mastery state */
  masteryState: MasteryStateSummary;

  /** Metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new component object state with defaults.
 */
export function createComponentObjectState(
  objectId: string,
  component: LanguageComponent,
  content: string,
  initialFeatures?: Partial<FeatureVector>
): ComponentObjectState {
  const now = new Date();

  return {
    objectId,
    component,
    content,
    goalContextPriority: 0,
    emphasizedForContext: false,

    exposureHistory: {
      totalExposures: 0,
      byModality: { visual: 0, auditory: 0, mixed: 0, text: 0, audio: 0 },
      byTaskPhase: { learning: 0, training: 0, evaluation: 0 },
      lastExposure: null,
      exposurePattern: [],
    },

    cognitiveInduction: {
      automationLevel: 0,
      usageSpaceExpansion: 0,
      proceduralFluency: 0,
      declarativeStrength: 0,
      trendDirection: 0,
    },

    irtMetrics: {
      overallAccuracy: 0,
      accuracyByIntent: {},
      accuracyByProblemType: {},
      thetaEstimate: 0,
      difficultyCalibration: 0.5,
      discriminationIndex: 1,
      standardError: 1,
    },

    transferEffects: {
      positiveTransferTo: [],
      negativeTransferTo: [],
      autoReinforcementScore: 0,
      crossComponentTransfer: {},
    },

    featureVector: {
      F: 0.5,
      R: 0,
      D: { general: 1 },
      M: 0.5,
      P: 0.5,
      ...initialFeatures,
    },

    activityParticipation: {
      interpretationTasks: 0,
      creationTasks: 0,
      totalEngagementTime: 0,
      qualityScore: 0,
    },

    relations: {
      collocations: [],
      morphologicalFamily: [],
      semanticNeighbors: [],
      syntacticPatterns: [],
      prerequisiteOf: [],
      dependsOn: [],
    },

    masteryState: {
      stage: 0,
      cueFreeAccuracy: 0,
      cueAssistedAccuracy: 0,
      scaffoldingGap: 0,
      stabilityDays: 0,
      nextReviewDate: now,
    },

    metadata: {
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  };
}

/**
 * Record an exposure to an object.
 */
export function recordExposure(
  state: ComponentObjectState,
  exposure: Omit<ExposurePattern, 'timestamp'>
): ComponentObjectState {
  const pattern: ExposurePattern = {
    ...exposure,
    timestamp: new Date(),
  };

  const newState = { ...state };

  // Update exposure history
  newState.exposureHistory = {
    ...state.exposureHistory,
    totalExposures: state.exposureHistory.totalExposures + 1,
    byModality: {
      ...state.exposureHistory.byModality,
      [exposure.modality]: (state.exposureHistory.byModality[exposure.modality] || 0) + 1,
    },
    byTaskPhase: {
      ...state.exposureHistory.byTaskPhase,
      [exposure.phase]: (state.exposureHistory.byTaskPhase[exposure.phase] || 0) + 1,
    },
    lastExposure: pattern.timestamp,
    exposurePattern: [...state.exposureHistory.exposurePattern.slice(-99), pattern],
  };

  // Update activity participation
  if (exposure.phase === 'learning' || exposure.phase === 'training') {
    newState.activityParticipation = {
      ...state.activityParticipation,
      interpretationTasks: state.activityParticipation.interpretationTasks +
        (exposure.success === true ? 1 : 0),
    };
  }

  // Update metadata
  newState.metadata = {
    ...state.metadata,
    updatedAt: new Date(),
    version: state.metadata.version + 1,
  };

  return newState;
}

/**
 * Update IRT metrics after a response.
 */
export function updateIRTMetrics(
  state: ComponentObjectState,
  correct: boolean,
  intent: PedagogicalIntent,
  problemType: ProblemType,
  responseTime: number
): ComponentObjectState {
  const newState = { ...state };
  const metrics = { ...state.irtMetrics };

  // Update overall accuracy (exponential moving average)
  const alpha = 0.1;
  metrics.overallAccuracy = metrics.overallAccuracy * (1 - alpha) +
    (correct ? 1 : 0) * alpha;

  // Update intent-specific accuracy
  const prevIntentAcc = metrics.accuracyByIntent[intent] ?? 0.5;
  metrics.accuracyByIntent = {
    ...metrics.accuracyByIntent,
    [intent]: prevIntentAcc * (1 - alpha) + (correct ? 1 : 0) * alpha,
  };

  // Update problem type accuracy
  const prevTypeAcc = metrics.accuracyByProblemType[problemType] ?? 0.5;
  metrics.accuracyByProblemType = {
    ...metrics.accuracyByProblemType,
    [problemType]: prevTypeAcc * (1 - alpha) + (correct ? 1 : 0) * alpha,
  };

  // Update theta estimate (simplified)
  const delta = correct ? 0.1 : -0.1;
  metrics.thetaEstimate = Math.max(-3, Math.min(3,
    metrics.thetaEstimate + delta * (1 - Math.abs(metrics.thetaEstimate) / 3)
  ));

  // Update standard error (decreases with more data)
  metrics.standardError = Math.max(0.1,
    metrics.standardError * 0.98
  );

  newState.irtMetrics = metrics;
  newState.metadata = {
    ...state.metadata,
    updatedAt: new Date(),
    version: state.metadata.version + 1,
  };

  return newState;
}

/**
 * Update cognitive induction metrics.
 */
export function updateCognitiveInduction(
  state: ComponentObjectState,
  responseTime: number,
  cueLevel: number,
  contextNovel: boolean
): ComponentObjectState {
  const newState = { ...state };
  const induction = { ...state.cognitiveInduction };

  // Automation level increases with faster responses and lower cue needs
  const speedFactor = Math.max(0, 1 - responseTime / 10000); // 10s = 0
  const cueFactor = 1 - cueLevel / 3;
  induction.automationLevel = induction.automationLevel * 0.9 +
    (speedFactor * cueFactor) * 0.1;

  // Usage space expands with novel contexts
  if (contextNovel) {
    induction.usageSpaceExpansion = Math.min(1,
      induction.usageSpaceExpansion + 0.05
    );
  }

  // Procedural fluency from response time
  induction.proceduralFluency = induction.proceduralFluency * 0.9 +
    speedFactor * 0.1;

  // Calculate trend
  const previousAvg = (state.cognitiveInduction.automationLevel +
    state.cognitiveInduction.proceduralFluency) / 2;
  const currentAvg = (induction.automationLevel + induction.proceduralFluency) / 2;
  induction.trendDirection = Math.max(-1, Math.min(1,
    (currentAvg - previousAvg) * 10
  ));

  newState.cognitiveInduction = induction;
  newState.metadata = {
    ...state.metadata,
    updatedAt: new Date(),
    version: state.metadata.version + 1,
  };

  return newState;
}

/**
 * Update mastery state.
 */
export function updateMasteryState(
  state: ComponentObjectState,
  newStage: MasteryStage,
  cueFreeAcc: number,
  cueAssistedAcc: number,
  nextReview: Date
): ComponentObjectState {
  const newState = { ...state };

  const prevStage = state.masteryState.stage;
  const stabilityDays = newStage === prevStage
    ? state.masteryState.stabilityDays + 1
    : 0;

  newState.masteryState = {
    stage: newStage,
    cueFreeAccuracy: cueFreeAcc,
    cueAssistedAccuracy: cueAssistedAcc,
    scaffoldingGap: cueAssistedAcc - cueFreeAcc,
    stabilityDays,
    nextReviewDate: nextReview,
  };

  newState.metadata = {
    ...state.metadata,
    updatedAt: new Date(),
    version: state.metadata.version + 1,
  };

  return newState;
}

/**
 * Add a relationship to an object.
 */
export function addRelation(
  state: ComponentObjectState,
  relationType: keyof ObjectRelations,
  targetId: string,
  metadata?: { pmi?: number }
): ComponentObjectState {
  const newState = { ...state };
  const relations = { ...state.relations };

  switch (relationType) {
    case 'collocations':
      if (!relations.collocations.find(c => c.objectId === targetId)) {
        relations.collocations = [
          ...relations.collocations,
          { objectId: targetId, pmi: metadata?.pmi ?? 0 },
        ];
      }
      break;

    case 'morphologicalFamily':
    case 'semanticNeighbors':
    case 'syntacticPatterns':
    case 'prerequisiteOf':
    case 'dependsOn':
      if (!relations[relationType].includes(targetId)) {
        relations[relationType] = [...relations[relationType], targetId];
      }
      break;
  }

  newState.relations = relations;
  newState.metadata = {
    ...state.metadata,
    updatedAt: new Date(),
    version: state.metadata.version + 1,
  };

  return newState;
}

/**
 * Calculate effective priority score.
 */
export function calculateEffectivePriority(
  state: ComponentObjectState,
  contextWeights?: { goalWeight?: number; reviewWeight?: number; automationWeight?: number }
): number {
  const weights = {
    goalWeight: 0.3,
    reviewWeight: 0.3,
    automationWeight: 0.2,
    transferWeight: 0.2,
    ...contextWeights,
  };

  // Goal context priority
  const goalScore = state.goalContextPriority * weights.goalWeight;

  // Review urgency (days overdue)
  const now = new Date();
  const daysTillReview = (state.masteryState.nextReviewDate.getTime() - now.getTime()) /
    (1000 * 60 * 60 * 24);
  const reviewScore = Math.max(0, 1 - daysTillReview / 7) * weights.reviewWeight;

  // Automation need (inverse of automation level)
  const automationScore = (1 - state.cognitiveInduction.automationLevel) *
    weights.automationWeight;

  // Transfer value
  const transferScore = (
    state.transferEffects.positiveTransferTo.length * 0.1 +
    state.transferEffects.autoReinforcementScore
  ) * weights.transferWeight;

  return Math.min(1, goalScore + reviewScore + automationScore + transferScore);
}

/**
 * Check if object needs review.
 */
export function needsReview(state: ComponentObjectState): boolean {
  const now = new Date();
  return state.masteryState.nextReviewDate <= now;
}

/**
 * Check if object is automized (high automation, low scaffolding gap).
 */
export function isAutomized(state: ComponentObjectState): boolean {
  return state.cognitiveInduction.automationLevel > 0.7 &&
    state.masteryState.scaffoldingGap < 0.15;
}

/**
 * Get bottleneck score (higher = blocking more learning).
 */
export function getBottleneckScore(state: ComponentObjectState): number {
  const dependentCount = state.relations.prerequisiteOf.length;
  const masteryDeficit = 1 - state.masteryState.stage / 4;

  return dependentCount * masteryDeficit * 0.5;
}
