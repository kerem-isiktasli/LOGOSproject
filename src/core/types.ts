/**
 * LOGOS Core Type Definitions
 *
 * This file contains ALL TypeScript interfaces and types for the core algorithms.
 * Based on ALGORITHMIC-FOUNDATIONS.md specifications.
 *
 * Naming conventions (per AGENT-MANIFEST.md):
 * - User ability: `theta` (not score, level, ability)
 * - Learning priority: `priority` (not weight, importance)
 * - Item difficulty: `irtDifficulty` (not hardness)
 * - Frequency metric: `frequency` (F)
 * - Relational metric: `relationalDensity` (R)
 * - Contextual metric: `contextualContribution` (E)
 */

// =============================================================================
// IRT Types (Item Response Theory) - Part 1
// =============================================================================

/**
 * IRT model types supported by LOGOS
 * - 1PL (Rasch): Equal discrimination, used for Phonology
 * - 2PL: Variable discrimination, used for Lexical/Syntactic
 * - 3PL: Includes guessing parameter, used for Pragmatic
 */
export type IRTModel = '1PL' | '2PL' | '3PL';

/**
 * Item parameters for IRT calculations
 * These define the psychometric properties of each language object
 */
export interface ItemParameter {
  /** Unique identifier for the item */
  id: string;

  /** Discrimination parameter (slope), typically 0.5 to 2.5 */
  a: number;

  /** Difficulty parameter (logit scale), typically -3 to +3 */
  b: number;

  /** Guessing parameter (lower asymptote), typically 0 to 0.35 */
  c?: number;

  /** Standard error of discrimination estimate */
  se_a?: number;

  /** Standard error of difficulty estimate */
  se_b?: number;
}

/**
 * Theta (ability) estimate with standard error
 * Theta is on logit scale, typically -3 to +3
 */
export interface ThetaEstimate {
  /** Estimated ability parameter */
  theta: number;

  /** Standard error of the estimate */
  se: number;
}

/**
 * Configuration for theta estimation algorithms
 */
export interface ThetaEstimationConfig {
  /** Maximum iterations for Newton-Raphson */
  maxIterations: number;

  /** Convergence tolerance */
  tolerance: number;

  /** Prior mean for EAP estimation */
  priorMean: number;

  /** Prior standard deviation for EAP estimation */
  priorSD: number;

  /** Number of quadrature points for EAP */
  quadPoints: number;
}

/**
 * Response pattern for IRT analysis
 */
export interface IRTResponse {
  /** Item that was presented */
  itemId: string;

  /** Whether the response was correct */
  correct: boolean;

  /** Response time in milliseconds */
  responseTimeMs?: number;
}

/**
 * Result of item calibration (parameter estimation from data)
 */
export interface ItemCalibrationResult {
  /** Discrimination parameter */
  a: number;

  /** Difficulty parameter */
  b: number;

  /** Standard error of discrimination */
  se_a: number;

  /** Standard error of difficulty */
  se_b: number;
}

/**
 * Fisher Information for item selection
 */
export interface ItemInformation {
  /** Item being evaluated */
  itemId: string;

  /** Information value at current theta */
  information: number;
}

// =============================================================================
// PMI Types (Pointwise Mutual Information) - Part 2
// =============================================================================

/**
 * Result of PMI calculation between two words
 */
export interface PMIResult {
  /** First word in the pair */
  word1: string;

  /** Second word in the pair */
  word2: string;

  /** Raw PMI value */
  pmi: number;

  /** Normalized PMI, bounded [-1, 1] */
  npmi: number;

  /** Raw co-occurrence count */
  cooccurrence: number;

  /** Statistical significance (log-likelihood ratio) */
  significance: number;
}

/**
 * Word pair for PMI analysis
 */
export interface PMIPair {
  /** First word */
  word1: string;

  /** Second word */
  word2: string;
}

/**
 * Mapping from PMI values to IRT difficulty
 */
export interface DifficultyMapping {
  /** Base IRT difficulty parameter (b) */
  baseDifficulty: number;

  /** Task-specific modifiers to base difficulty */
  taskModifier: Record<TaskType, number>;
}

/**
 * Corpus statistics for PMI calculation
 */
export interface CorpusStatistics {
  /** Total word count in corpus */
  totalWords: number;

  /** Individual word frequencies */
  wordCounts: Map<string, number>;

  /** Co-occurrence counts for word pairs */
  pairCounts: Map<string, number>;

  /** Window size used for co-occurrence */
  windowSize: number;
}

// =============================================================================
// FSRS Types (Free Spaced Repetition Scheduler) - Part 3
// =============================================================================

/**
 * FSRS rating scale (1-4)
 * Based on ts-fsrs implementation
 */
export type FSRSRating = 1 | 2 | 3 | 4;

/**
 * FSRS card state
 */
export type FSRSState = 'new' | 'learning' | 'review' | 'relearning';

/**
 * FSRS card representing a schedulable item
 */
export interface FSRSCard {
  /** Difficulty parameter, D in [1, 10] */
  difficulty: number;

  /** Stability (days until 90% retention) */
  stability: number;

  /** Retrievability R = e^(-t/S) */
  retrievability: number;

  /** Timestamp of last review */
  lastReview: Date | null;

  /** Number of successful reviews */
  reps: number;

  /** Number of lapses (failures) */
  lapses: number;

  /** Current card state */
  state: FSRSState;
}

/**
 * FSRS algorithm parameters
 */
export interface FSRSParameters {
  /** Target retention rate (default: 0.9) */
  requestRetention: number;

  /** Maximum interval between reviews in days */
  maximumInterval: number;

  /** 17 weight parameters for the algorithm */
  w: number[];
}

/**
 * Default FSRS weights based on ts-fsrs
 */
export const DEFAULT_FSRS_WEIGHTS: number[] = [
  0.4, 0.6, 2.4, 5.8,       // Initial stability by rating
  4.93, 0.94, 0.86, 0.01,   // Difficulty modifiers
  1.49, 0.14, 0.94,         // Stability modifiers
  2.18, 0.05, 0.34, 1.26,   // Success/fail modifiers
  0.29, 2.61                 // Additional
];

/**
 * Scheduling result from FSRS
 */
export interface FSRSScheduleResult {
  /** Updated card state */
  card: FSRSCard;

  /** Next review date */
  nextReview: Date;

  /** Interval in days */
  intervalDays: number;
}

// =============================================================================
// Mastery Types - Part 3.2
// =============================================================================

/**
 * Mastery stage (0-4)
 * Represents the learner's proficiency level with a language object
 *
 * 0: New/Unknown
 * 1: Recognition (can identify with cues)
 * 2: Recall (can remember with some effort)
 * 3: Controlled Production (can produce with focus)
 * 4: Automatic (fluent, fast access)
 */
export type MasteryStage = 0 | 1 | 2 | 3 | 4;

/**
 * Cue level for scaffolded practice
 * 0 = cue-free, 1-3 = progressively more assistance
 */
export type CueLevel = 0 | 1 | 2 | 3;

/**
 * Complete mastery state for a language object
 */
export interface MasteryState {
  /** Current mastery stage (0-4) */
  stage: MasteryStage;

  /** FSRS card for scheduling */
  fsrsCard: FSRSCard;

  /** Accuracy without cues (rolling average) */
  cueFreeAccuracy: number;

  /** Accuracy with cues (rolling average) */
  cueAssistedAccuracy: number;

  /** Total number of exposures/practice attempts */
  exposureCount: number;
}

/**
 * Gap between cue-assisted and cue-free performance
 * Indicates scaffolding needs
 */
export interface ScaffoldingGap {
  /** Language object ID */
  objectId: string;

  /** Accuracy with assistance */
  cueAssistedAccuracy: number;

  /** Accuracy without assistance */
  cueFreeAccuracy: number;

  /** Gap size (assisted - free), larger = more scaffolding needed */
  gap: number;

  /** Recommended cue level for next practice */
  recommendedCueLevel: CueLevel;
}

/**
 * Response data for mastery updates
 */
export interface MasteryResponse {
  /** Whether the response was correct */
  correct: boolean;

  /** Cue level used (0 = cue-free) */
  cueLevel: CueLevel;

  /** Response time in milliseconds */
  responseTimeMs: number;
}

/**
 * Stage transition thresholds
 */
export interface StageThresholds {
  /** Minimum cue-free accuracy for stage 4 */
  stage4CueFreeAccuracy: number;

  /** Minimum stability for stage 4 */
  stage4Stability: number;

  /** Maximum gap for stage 4 */
  stage4MaxGap: number;

  /** Minimum cue-free accuracy for stage 3 */
  stage3CueFreeAccuracy: number;

  /** Minimum stability for stage 3 */
  stage3Stability: number;

  /** Minimum cue-free accuracy for stage 2 */
  stage2CueFreeAccuracy: number;

  /** Minimum cue-assisted accuracy for stage 2 */
  stage2CueAssistedAccuracy: number;

  /** Minimum cue-assisted accuracy for stage 1 */
  stage1CueAssistedAccuracy: number;
}

/**
 * Default stage thresholds (from ALGORITHMIC-FOUNDATIONS.md)
 */
export const DEFAULT_STAGE_THRESHOLDS: StageThresholds = {
  stage4CueFreeAccuracy: 0.9,
  stage4Stability: 30,
  stage4MaxGap: 0.1,
  stage3CueFreeAccuracy: 0.75,
  stage3Stability: 7,
  stage2CueFreeAccuracy: 0.6,
  stage2CueAssistedAccuracy: 0.8,
  stage1CueAssistedAccuracy: 0.5
};

// =============================================================================
// Task Types - Part 5
// =============================================================================

/**
 * Types of learning tasks
 */
export type TaskType =
  | 'recognition'    // Identify correct option (MCQ)
  | 'recall_cued'    // Recall with partial cue
  | 'recall_free'    // Recall without cues
  | 'production'     // Generate/produce language
  | 'timed';         // Time-pressured response

/**
 * Task presentation formats
 */
export type TaskFormat =
  | 'mcq'            // Multiple choice question
  | 'fill_blank'     // Fill in the blank
  | 'free_response'  // Open-ended response
  | 'matching'       // Match items
  | 'ordering'       // Order items correctly
  | 'dictation';     // Listen and write

/**
 * Input/output modality for tasks
 */
export type TaskModality =
  | 'visual'         // Reading/text
  | 'auditory'       // Listening
  | 'mixed';         // Both

/**
 * Task specification (what to generate)
 */
export interface TaskSpec {
  /** Target language object ID */
  objectId: string;

  /** Target word/pattern content */
  targetContent: string;

  /** Target mastery stage */
  targetStage: MasteryStage;

  /** Task type to generate */
  taskType: TaskType;

  /** Task format */
  taskFormat: TaskFormat;

  /** Input/output modality */
  modality: TaskModality;

  /** Domain context (e.g., 'medical', 'legal') */
  domain: string;

  /** User's current theta for difficulty calibration */
  userTheta: number;
}

/**
 * Generated task content (from Claude or cache)
 */
export interface TaskContent {
  /** Task prompt shown to user */
  prompt: string;

  /** Expected correct answer */
  correctAnswer: string;

  /** Distractor options for MCQ */
  distractors: string[];

  /** Progressive hints (level 1, 2, 3) */
  hints: string[];

  /** Background context for the task */
  context: string;

  /** Explanation of why answer is correct */
  explanation: string;

  /** Audio URL for listening tasks (optional) */
  audioUrl?: string;
}

/**
 * Complete task ready for presentation
 */
export interface Task {
  /** Unique task ID */
  id: string;

  /** Task specification */
  spec: TaskSpec;

  /** Generated content */
  content: TaskContent;

  /** When this task was generated */
  generatedAt: Date;

  /** Expiration time for cached content */
  expiresAt: Date;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Session modes
 * - learning: Introducing new material
 * - training: Practice and reinforcement
 * - evaluation: Assessment without learning support
 */
export type SessionMode = 'learning' | 'training' | 'evaluation';

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session mode */
  mode: SessionMode;

  /** Target goal ID */
  goalId: string;

  /** Maximum items per session */
  maxItems: number;

  /** Target session duration in minutes */
  targetDurationMinutes: number;

  /** Whether to include new items */
  includeNew: boolean;

  /** Whether to include review items */
  includeReview: boolean;

  /** Focus on specific component types (optional) */
  focusComponents?: ComponentType[];
}

/**
 * Session state during active practice
 */
export interface SessionState {
  /** Session ID */
  id: string;

  /** Session configuration */
  config: SessionConfig;

  /** When session started */
  startedAt: Date;

  /** Items practiced so far */
  itemsPracticed: number;

  /** Stage transitions during session */
  stageTransitions: number;

  /** Fluency task count */
  fluencyTaskCount: number;

  /** Versatility task count */
  versatilityTaskCount: number;

  /** Running theta estimates by component */
  currentTheta: Record<ComponentType, number>;

  /** Items remaining in queue */
  queueLength: number;
}

/**
 * Session summary after completion
 */
export interface SessionSummary {
  /** Session ID */
  id: string;

  /** Session mode */
  mode: SessionMode;

  /** Total duration in milliseconds */
  durationMs: number;

  /** Total items practiced */
  itemsPracticed: number;

  /** Overall accuracy */
  accuracy: number;

  /** Stage transitions achieved */
  stageTransitions: number;

  /** Theta changes by component */
  thetaChanges: Record<ComponentType, ThetaChange>;

  /** Detected bottlenecks (if any) */
  bottlenecks: BottleneckAnalysis | null;
}

/**
 * Theta change tracking
 */
export interface ThetaChange {
  /** Previous theta value */
  before: number;

  /** New theta value */
  after: number;

  /** Change amount */
  delta: number;

  /** Standard error of new estimate */
  se: number;
}

// =============================================================================
// Priority Types (FRE Metrics) - Part 4
// =============================================================================

/**
 * FRE (Frequency, Relational, Contextual) metrics
 * Used for calculating learning priority
 */
export interface FREMetrics {
  /** Frequency: normalized occurrence rate (0-1) */
  frequency: number;

  /** Relational density: hub score in language network (0-1) */
  relationalDensity: number;

  /** Contextual contribution: meaning importance (0-1) */
  contextualContribution: number;
}

/**
 * Priority calculation result
 */
export interface PriorityCalculation {
  /** Language object ID */
  objectId: string;

  /** FRE metrics */
  fre: FREMetrics;

  /** Computed priority score */
  priority: number;

  /** Current mastery stage */
  currentStage: MasteryStage;

  /** Due for review? */
  isDue: boolean;

  /** Urgency level (1 = most urgent) */
  urgency: number;
}

/**
 * Priority weights for FRE combination
 */
export interface PriorityWeights {
  /** Weight for frequency */
  frequencyWeight: number;

  /** Weight for relational density */
  relationalWeight: number;

  /** Weight for contextual contribution */
  contextualWeight: number;

  /** Multiplier for due items */
  dueMultiplier: number;

  /** Multiplier for low-stage items */
  lowStageMultiplier: number;
}

/**
 * Default priority weights
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  frequencyWeight: 0.4,
  relationalWeight: 0.3,
  contextualWeight: 0.3,
  dueMultiplier: 1.5,
  lowStageMultiplier: 1.2
};

// =============================================================================
// Bottleneck Types - Part 7
// =============================================================================

/**
 * Language component types
 * Follows the theoretical cascade: PHON -> MORPH -> LEX -> SYNT -> PRAG
 */
export type ComponentType =
  | 'PHON'   // Phonology
  | 'MORPH'  // Morphology
  | 'LEX'    // Lexical
  | 'SYNT'   // Syntactic
  | 'PRAG';  // Pragmatic

/**
 * Evidence for a bottleneck in a specific component
 */
export interface BottleneckEvidence {
  /** Component type being analyzed */
  componentType: ComponentType;

  /** Error rate (0-1) */
  errorRate: number;

  /** Detected error patterns */
  errorPatterns: string[];

  /** Other components with co-occurring errors */
  cooccurringErrors: ComponentType[];

  /** Improvement trend (positive = improving) */
  improvement: number;
}

/**
 * Complete bottleneck analysis result
 */
export interface BottleneckAnalysis {
  /** Primary bottleneck component (null if none detected) */
  primaryBottleneck: ComponentType | null;

  /** Confidence in the analysis (0-1) */
  confidence: number;

  /** Evidence for each component */
  evidence: BottleneckEvidence[];

  /** Recommendation for addressing the bottleneck */
  recommendation: string;
}

/**
 * Cascade analysis for error propagation
 */
export interface CascadeAnalysis {
  /** Root cause component */
  rootCause: ComponentType | null;

  /** Chain of affected components */
  cascadeChain: ComponentType[];

  /** Confidence in cascade detection */
  confidence: number;
}

/**
 * Bottleneck detection configuration
 */
export interface BottleneckDetectionConfig {
  /** Minimum responses needed for analysis */
  minResponses: number;

  /** Time window for analysis in days */
  windowDays: number;

  /** Minimum responses per component type */
  minResponsesPerType: number;

  /** Error rate threshold for bottleneck detection */
  errorRateThreshold: number;

  /** Confidence threshold for cascade detection */
  cascadeConfidenceThreshold: number;
}

/**
 * Default bottleneck detection config
 */
export const DEFAULT_BOTTLENECK_CONFIG: BottleneckDetectionConfig = {
  minResponses: 20,
  windowDays: 14,
  minResponsesPerType: 5,
  errorRateThreshold: 0.3,
  cascadeConfidenceThreshold: 0.7
};

// =============================================================================
// Language Object Types
// =============================================================================

/**
 * Language object type classification
 */
export type LanguageObjectType =
  | 'LEX'    // Lexical (single word)
  | 'MWE'    // Multi-word expression
  | 'TERM'   // Technical term
  | 'MORPH'  // Morphological pattern
  | 'G2P'    // Grapheme-to-phoneme rule
  | 'SYNT'   // Syntactic pattern
  | 'PRAG';  // Pragmatic convention

/**
 * Language object (vocabulary item, pattern, etc.)
 */
export interface LanguageObject {
  /** Unique identifier */
  id: string;

  /** Type classification */
  type: LanguageObjectType;

  /** The actual content (word, pattern, rule) */
  content: string;

  /** Full vector representation (JSON) */
  contentJson?: Record<string, unknown>;

  /** FRE metrics */
  fre: FREMetrics;

  /** Computed priority */
  priority: number;

  /** IRT difficulty parameter */
  irtDifficulty: number;

  /** IRT discrimination parameter */
  irtDiscrimination: number;

  /** Associated goal ID */
  goalId: string;
}

// =============================================================================
// Morphological Analysis Types - Part 6.1
// =============================================================================

/**
 * Affix (prefix, suffix, infix)
 */
export interface Affix {
  /** Surface form (e.g., 'pre-', '-tion') */
  form: string;

  /** Affix type */
  type: 'prefix' | 'suffix' | 'infix';

  /** Meaning/function of the affix */
  meaning: string;

  /** Productivity (how freely it combines, 0-1) */
  productivity: number;
}

/**
 * Morphological analysis result
 */
export interface MorphologicalAnalysis {
  /** Root/stem of the word */
  root: string;

  /** Identified prefixes */
  prefixes: Affix[];

  /** Identified suffixes */
  suffixes: Affix[];

  /** Inflection type */
  inflection: 'base' | 'past' | 'progressive' | 'plural/3sg' | 'other';

  /** Derivation type */
  derivationType: 'simple' | 'derived' | 'compound';
}

// =============================================================================
// Syntactic Complexity Types - Part 6.2
// =============================================================================

/**
 * Syntactic complexity metrics
 */
export interface SyntacticComplexity {
  /** Number of words */
  sentenceLength: number;

  /** Maximum depth of dependency tree */
  dependencyDepth: number;

  /** Number of clauses */
  clauseCount: number;

  /** Subordinate clauses / total clauses */
  subordinationIndex: number;

  /** Passive constructions / total verbs */
  passiveRatio: number;

  /** Nouns / (nouns + verbs) */
  nominalRatio: number;

  /** Mean distance between head and dependent */
  averageDependencyDistance: number;
}

// =============================================================================
// G2P (Grapheme-to-Phoneme) Types - Part 6.3
// =============================================================================

/**
 * G2P rule
 */
export interface G2PRule {
  /** Pattern to match */
  pattern: RegExp;

  /** Resulting phoneme */
  phoneme: string;

  /** Context where rule applies */
  context: 'initial' | 'medial' | 'final' | 'any';

  /** Exception words */
  exceptions: string[];
}

/**
 * G2P difficulty analysis
 */
export interface G2PDifficulty {
  /** Word being analyzed */
  word: string;

  /** Irregular patterns found */
  irregularPatterns: string[];

  /** Difficulty score (0-1) */
  difficultyScore: number;

  /** Potential mispronunciations */
  potentialMispronunciations: string[];
}

// =============================================================================
// Response Evaluation Types - Part 5
// =============================================================================

/**
 * Evaluation scores for a response
 */
export interface EvaluationScores {
  /** Grammar, spelling, morphology correctness (0-1) */
  grammaticalAccuracy: number;

  /** Meaning matches expected (0-1) */
  semanticAccuracy: number;

  /** Register and context fit (0-1) */
  pragmaticAppropriateness: number;

  /** Word choice quality (0-1) */
  lexicalPrecision: number;
}

/**
 * Detected error in a response
 */
export interface ResponseError {
  /** Error type */
  type: 'grammar' | 'spelling' | 'vocabulary' | 'register' | 'meaning';

  /** The problematic part */
  location: string;

  /** Suggested correction */
  correction: string;

  /** Explanation */
  explanation: string;
}

/**
 * Complete response evaluation
 */
export interface ResponseEvaluation {
  /** Overall correctness */
  overallCorrect: boolean;

  /** Detailed scores */
  scores: EvaluationScores;

  /** Detected errors */
  errors: ResponseError[];

  /** Feedback for the learner */
  feedback: string;
}

// =============================================================================
// Goal Types
// =============================================================================

/**
 * Domain specialization
 */
export type Domain =
  | 'medical'
  | 'legal'
  | 'business'
  | 'academic'
  | 'general'
  | string; // Allow custom domains

/**
 * Language modality
 */
export type Modality = 'reading' | 'listening' | 'writing' | 'speaking';

/**
 * Goal specification
 */
export interface GoalSpec {
  /** Unique identifier */
  id: string;

  /** Domain (e.g., 'medical', 'legal') */
  domain: Domain;

  /** Target modalities */
  modality: Modality[];

  /** Genre (e.g., 'report', 'conversation') */
  genre: string;

  /** Purpose (e.g., 'certification', 'professional') */
  purpose: string;

  /** Target benchmark (e.g., 'CELBAN', 'IELTS') */
  benchmark?: string;

  /** Deadline (optional) */
  deadline?: Date;

  /** Completion percentage (0-100) */
  completionPercent: number;

  /** Is this goal active? */
  isActive: boolean;

  /** Associated user ID */
  userId: string;
}

// =============================================================================
// User Types
// =============================================================================

/**
 * User theta values by component
 */
export interface UserThetaProfile {
  /** Global theta estimate */
  thetaGlobal: number;

  /** Phonology theta */
  thetaPhonology: number;

  /** Morphology theta */
  thetaMorphology: number;

  /** Lexical theta */
  thetaLexical: number;

  /** Syntactic theta */
  thetaSyntactic: number;

  /** Pragmatic theta */
  thetaPragmatic: number;
}

/**
 * User profile
 */
export interface User {
  /** Unique identifier */
  id: string;

  /** Native language code */
  nativeLanguage: string;

  /** Target language code */
  targetLanguage: string;

  /** Theta profile */
  theta: UserThetaProfile;

  /** Account creation date */
  createdAt: Date;
}

// =============================================================================
// Learning Queue Types
// =============================================================================

/**
 * Item in the learning queue
 */
export interface LearningQueueItem {
  /** Language object ID */
  objectId: string;

  /** Content preview */
  content: string;

  /** Object type */
  type: LanguageObjectType;

  /** Priority score */
  priority: number;

  /** Current mastery stage */
  stage: MasteryStage;

  /** Next scheduled review */
  nextReview: Date | null;

  /** Cue-free accuracy */
  cueFreeAccuracy: number;

  /** Cue-assisted accuracy */
  cueAssistedAccuracy: number;

  /** Urgency level (1 = new, 2 = due, 3 = future) */
  urgency: number;
}

// =============================================================================
// Collocation Types
// =============================================================================

/**
 * Collocation (word association)
 */
export interface Collocation {
  /** Unique identifier */
  id: string;

  /** First word ID */
  word1Id: string;

  /** Second word ID */
  word2Id: string;

  /** PMI value */
  pmi: number;

  /** Normalized PMI */
  npmi: number;

  /** Co-occurrence count */
  cooccurrence: number;

  /** Statistical significance */
  significance: number;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Number of items per page */
  limit: number;

  /** Offset from start */
  offset: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Items in this page */
  items: T[];

  /** Total number of items */
  total: number;

  /** Whether there are more items */
  hasMore: boolean;
}

/**
 * Date range for filtering
 */
export interface DateRange {
  /** Start date (inclusive) */
  from: Date;

  /** End date (inclusive) */
  to: Date;
}
