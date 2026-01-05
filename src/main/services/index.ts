/**
 * Services Index
 *
 * Central export point for all learning engine services.
 * Implements the 3-layer learning pipeline:
 *   Layer 1: State + Priority
 *   Layer 2: Task Generation
 *   Layer 3: Scoring + Update
 * Plus Phase 3.4: Fluency/Versatility Balance
 */

// Layer 1: State + Priority
export {
  // Types
  type ThetaState,
  type PriorityWeights,
  type LearningQueueItem,
  type StateAnalysis,
  type QueueAnalysis,
  // Functions
  getUserThetaState,
  calculateBasePriority,
  calculateMasteryAdjustment,
  calculateUrgencyScore,
  calculateEffectivePriority,
  getLearningQueue,
  getNextLearningItem,
  recalculatePriorities,
  getStateAnalysis,
  analyzeQueue,
  // IRT-based selection
  applyIRTReordering,
  getNextItemWithIRT,
  getLearningQueueWithIRT,
} from './state-priority.service';

// Layer 2: Task Generation
export {
  // Types
  type TaskFormat,
  type TaskModality,
  type TaskSpec,
  type GeneratedTask,
  type TaskGenerationConfig,
  // Functions
  selectTaskFormat,
  determineCueLevel,
  calculateTaskDifficulty,
  shouldBeFluencyTask,
  generateTaskSpec,
  generateTask,
  generateMCQOptions,
  generateHints,
  getCachedTask,
  cacheTask,
  getOrGenerateTask,
} from './task-generation.service';

// Layer 3: Scoring + Update
export {
  // Types
  type UserResponse,
  type EvaluationResult,
  type MasteryUpdate,
  type ResponseOutcome,
  type ScoringConfig,
  // Functions
  evaluateResponse,
  calculateMasteryUpdates,
  calculateThetaContribution,
  processResponse,
} from './scoring-update.service';

// Phase 3.4: Fluency vs Versatility Balance
export {
  // Types
  type TrainingMode,
  type FluencyVersatilityRatio,
  type SessionBalance,
  type FluencyTask,
  type VersatilityTask,
  type TransitionAnalysis,
  // Functions
  calculateTargetRatio,
  getSessionBalance,
  analyzeTransition,
  selectTrainingMode,
  generateFluencyTasks,
  generateVersatilityTasks,
  getBalancedTask,
  updateSessionBalance,
  getBalanceStatistics,
} from './fluency-versatility.service';

// PMI (Pointwise Mutual Information) Service
export {
  // Types
  type WordDifficultyResult,
  type CollocationResult,
  // Functions
  getWordDifficulty,
  getCollocations,
  getRelationalDensity,
  updateIRTDifficulties,
  updateRelationalDensities,
  storeCollocations,
  clearCalculatorCache,
  clearAllCalculatorCaches,
} from './pmi.service';
