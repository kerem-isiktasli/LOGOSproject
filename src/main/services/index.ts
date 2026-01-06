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
  generateHints,
  getCachedTask,
  cacheTask,
  getOrGenerateTask,
  // Claude-enhanced
  generateTaskWithClaude,
  getOrGenerateTaskWithClaude,
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

// Corpus Sources Registry
export {
  // Types
  type SourceType,
  type AccessMethod,
  type CorpusSource,
  // Functions
  getEnabledSources,
  getSourceById,
  getSourcesByType,
  getSourcesByDomain,
  getSourcesByBenchmark,
  getSourcesByModality,
  CORPUS_SOURCES,
} from './corpus-sources/registry';

// Corpus Source Filter
export {
  // Types
  type SourceFilter,
  type RankedSource,
  type GoalSpec as FilterGoalSpec,
  // Functions
  filterSources,
  rankSourcesForGoal,
  getSourcesForBenchmark,
  getSourcesForDomain,
  getSourcesForModalities,
  getRecommendedSources,
  getDefaultSourceIds,
  validateSourceSelection,
} from './corpus-sources/filter';

// Corpus Pipeline Service
export {
  // Types
  type PopulationOptions,
  type VocabularyItem,
  type PopulationResult,
  type CorpusDocument,
  type ExtractionResult,
  // Functions
  populateVocabularyForGoal,
  processUserUploads,
  getPopulationStatus,
  clearVocabulary,
} from './corpus-sources/corpus-pipeline.service';

// Offline Queue Service
export {
  // Types
  type QueueItemType,
  type QueueItemStatus,
  type QueueItem,
  type OfflineQueueStats,
  // Functions
  getOfflineQueueService,
  resetOfflineQueueService,
  queueTaskGeneration,
  queueErrorAnalysis,
  queueContentGeneration,
} from './offline-queue.service';

// Claude API Service
export {
  // Types
  type ClaudeConfig,
  type ContentRequest,
  type ErrorAnalysisRequest,
  type HintRequest,
  type ContentResponse,
  type ErrorAnalysisResponse,
  type HintResponse,
  // Functions
  getClaudeService,
  ClaudeService,
} from './claude.service';

// Agent Trigger Service
export {
  // Types
  type BottleneckType,
  type AgentType,
  type TriggerContext,
  type DevelopmentBottleneck,
  type AgentTrigger,
  type TriggerResult,
  // Functions
  getAgentTriggerService,
  detectAgentTriggers,
  registerBottleneck,
} from './agent-trigger.service';

// Agent Hooks Service
export {
  // Types
  type OperationType,
  type OperationContext,
  type HookResult,
  // Functions
  createOperationHook,
  wrapWithAgentDetection,
} from './agent-hooks.service';
