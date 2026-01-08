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
  | 'recognition'           // Identify correct option (MCQ)
  | 'recall_cued'           // Recall with partial cue
  | 'recall_free'           // Recall without cues
  | 'production'            // Generate/produce language
  | 'timed'                 // Time-pressured response
  // Extended task types for content generation
  | 'fill_blank'            // Fill in the blank
  | 'definition_match'      // Match word to definition
  | 'translation'           // Translation task
  | 'sentence_writing'      // Write a sentence using word
  | 'reading_comprehension' // Read and answer questions
  | 'rapid_response'        // Quick response (fluency)
  | 'error_correction'      // Find and fix errors
  | 'collocation'           // Complete collocations
  | 'word_formation'        // Form words from roots
  | 'register_shift'        // Change register/formality
  // Syntactic complexity tasks (Lu, 2010, 2011)
  | 'sentence_combining'    // Combine simple sentences into complex ones
  | 'clause_selection';     // Select appropriate subordinate/coordinate clause

/**
 * Task presentation formats
 */
export type TaskFormat =
  | 'mcq'            // Multiple choice question
  | 'fill_blank'     // Fill in the blank
  | 'free_response'  // Open-ended response
  | 'matching'       // Match items
  | 'ordering'       // Order items correctly
  | 'dictation'      // Listen and write
  | 'typing';        // Character-by-character typing with real-time validation

/**
 * Input/output modality for tasks
 */
export type TaskModality =
  | 'visual'         // Reading/text
  | 'auditory'       // Listening
  | 'mixed'          // Both
  | 'text'           // Alias for visual (used in content-spec)
  | 'audio';         // Alias for auditory (used in task types)

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
  | 'PHON'        // Phonology
  | 'MORPH'       // Morphology
  | 'LEX'         // Lexical
  | 'SYNT'        // Syntactic
  | 'PRAG'        // Pragmatic
  // Lowercase aliases for compatibility
  | 'phonological'
  | 'morphological'
  | 'lexical'
  | 'syntactic'
  | 'pragmatic';

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

  /** Translation in user's native language */
  translation?: string;

  /** Domain distribution (JSON string or object) */
  domainDistribution?: string | Record<string, number>;

  /** Frequency score (0-1) */
  frequency?: number;

  /** Relational density / PMI score (0-1) */
  relationalDensity?: number;

  /** Morphological complexity score (0-1) */
  morphologicalScore?: number;

  /** Phonological difficulty score (0-1) */
  phonologicalDifficulty?: number;
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

  /** User settings */
  settings?: UserSettings;
}

/**
 * User application settings
 */
export interface UserSettings {
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';

  /** Daily goal (minutes) */
  dailyGoal: number;

  /** Notifications enabled */
  notificationsEnabled: boolean;

  /** Sound effects enabled */
  soundEnabled: boolean;

  /** Default session duration (minutes) */
  defaultSessionDuration: number;

  /** New item ratio in sessions */
  newItemRatio: number;

  /** Show hints automatically */
  autoHints: boolean;

  /** Keyboard shortcuts enabled */
  keyboardShortcuts: boolean;
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

// =============================================================================
// Multi-Component Calibration Types (MIRT/CDM Framework)
// =============================================================================

/**
 * Component type codes for Q-matrix mapping.
 * Based on LOGOS 5-component linguistic model.
 */
export type ComponentCode = 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';

/**
 * Cognitive process required by a task.
 * Maps to different processing depths and skill requirements.
 */
export type CognitiveProcess =
  | 'recognition'      // Identify among options (lowest load)
  | 'recall'           // Retrieve from memory
  | 'transformation'   // Apply morphological/syntactic rules
  | 'production'       // Generate novel output
  | 'analysis'         // Decompose and evaluate
  | 'synthesis';       // Combine multiple elements (highest load)

/**
 * Target object in a multi-object task.
 * Represents one component-object being measured/trained.
 *
 * Based on Q-matrix cognitive diagnostic model (de la Torre, 2011)
 * and Within-Item MIRT (Hartig & Höhler, 2008).
 */
export interface MultiObjectTarget {
  /** Language object ID */
  objectId: string;

  /** Component type this object belongs to */
  componentType: ComponentCode;

  /** Object content (word, pattern, rule) */
  content: string;

  /**
   * Contribution weight (0-1).
   * Sum of all weights in a task should equal 1.
   * Higher weight = more theta contribution from this object.
   *
   * Based on G-DINA attribute contribution (de la Torre, 2011).
   */
  weight: number;

  /**
   * Whether this is a primary design-purpose object.
   * Primary objects are the main learning targets.
   * Secondary objects provide context or incidental practice.
   */
  isPrimaryTarget: boolean;

  /**
   * Cognitive process required for this object in the task.
   * Different processes have different difficulty multipliers.
   */
  cognitiveProcess: CognitiveProcess;

  /**
   * Item difficulty for this specific object (IRT b parameter).
   * Used in compensatory MIRT probability calculation.
   */
  difficulty: number;

  /**
   * Item discrimination for this object (IRT a parameter).
   * Higher = more sensitive to ability differences.
   */
  discrimination: number;
}

/**
 * Multi-object task specification.
 * Extends TaskSpec to support multiple target objects.
 *
 * Implements Within-Item Multidimensional IRT structure.
 */
export interface MultiObjectTaskSpec {
  /** Unique task ID */
  taskId: string;

  /** Session ID */
  sessionId: string;

  /** Goal ID for context */
  goalId: string;

  /**
   * Target objects with Q-matrix weights.
   * Order: primary targets first, then secondary.
   */
  targetObjects: MultiObjectTarget[];

  /** Task type */
  taskType: TaskType;

  /** Task format */
  taskFormat: TaskFormat;

  /** Input/output modality */
  modality: TaskModality;

  /** Domain context */
  domain: string;

  /**
   * Overall task difficulty (composite).
   * Calculated from weighted object difficulties.
   */
  compositeDifficulty: number;

  /**
   * Whether this is a fluency-focused task.
   * Fluency tasks have time pressure and lower cognitive load.
   */
  isFluencyTask: boolean;

  /** Expected correct answer */
  expectedAnswer: string;

  /** Alternative acceptable answers */
  alternativeAnswers?: string[];
}

/**
 * Component-level evaluation result.
 * Tracks correctness at each component granularity.
 */
export interface ComponentEvaluation {
  /** Object ID evaluated */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Whether this component aspect was correct */
  correct: boolean;

  /**
   * Partial credit (0-1).
   * Allows nuanced scoring for partially correct responses.
   */
  partialCredit: number;

  /**
   * Error type if incorrect.
   * Used for error pattern analysis and targeted feedback.
   */
  errorType?: 'omission' | 'substitution' | 'addition' | 'ordering' | 'form' | 'usage';

  /**
   * Specific feedback for this component.
   * E.g., "Good vocabulary choice, but check the verb form."
   */
  feedback: string;

  /** Correction hint if incorrect */
  correction?: string;
}

/**
 * Multi-component evaluation result.
 * Aggregates evaluations across all target objects.
 */
export interface MultiComponentEvaluation {
  /** Overall correctness (all components correct) */
  overallCorrect: boolean;

  /**
   * Weighted composite score (0-1).
   * Σ(weight_i × partialCredit_i)
   */
  compositeScore: number;

  /** Per-component evaluations */
  componentEvaluations: ComponentEvaluation[];

  /** Aggregated feedback message */
  feedback: string;

  /** Detailed explanation */
  explanation?: string;
}

/**
 * Theta contribution for multi-component update.
 * Based on Compensatory MIRT model:
 * P(correct|θ) = σ(Σ aᵢθᵢ + d)
 */
export interface MultiComponentThetaContribution {
  /** Component type */
  componentType: ComponentCode;

  /**
   * Theta delta for this component.
   * Calculated as: K × wᵢ × (observed - expected) × boundaryDecay
   */
  thetaDelta: number;

  /** Weight used in calculation */
  weight: number;

  /** Object ID this contribution came from */
  sourceObjectId: string;
}

/**
 * Complete multi-object response outcome.
 * Comprehensive result of processing a multi-object task response.
 */
export interface MultiObjectResponseOutcome {
  /** Response record ID */
  responseId: string;

  /** Multi-component evaluation */
  evaluation: MultiComponentEvaluation;

  /** Per-component theta contributions */
  thetaContributions: MultiComponentThetaContribution[];

  /** Aggregated theta state change */
  aggregatedThetaChange: Partial<UserThetaProfile>;

  /** Per-object mastery updates */
  masteryUpdates: Array<{
    objectId: string;
    componentType: ComponentCode;
    previousStage: MasteryStage;
    newStage: MasteryStage;
    stageChanged: boolean;
    newAccuracy: number;
  }>;

  /** Per-object priority updates */
  priorityUpdates: Array<{
    objectId: string;
    previousPriority: number;
    newPriority: number;
  }>;

  /** FSRS updates for review scheduling */
  fsrsUpdates?: Array<{
    objectId: string;
    nextReview: Date;
    stability: number;
    difficulty: number;
  }>;
}

/**
 * Q-matrix entry for cognitive diagnostic modeling.
 * Maps task types to required component attributes.
 *
 * Based on G-DINA framework (de la Torre, 2011).
 */
export interface QMatrixEntry {
  /** Task type */
  taskType: TaskType;

  /**
   * Required components with default weights.
   * Weight indicates relative importance of each component.
   */
  components: Partial<Record<ComponentCode, number>>;

  /**
   * Interaction model type.
   * - 'compensatory': High ability in one can compensate for low in another
   * - 'conjunctive': Must have all required abilities (DINA-like)
   * - 'disjunctive': Any one ability sufficient (DINO-like)
   */
  interactionModel: 'compensatory' | 'conjunctive' | 'disjunctive';

  /** Primary cognitive process */
  primaryProcess: CognitiveProcess;
}

/**
 * Default Q-matrix for task-component mapping.
 * Provides baseline weights when not explicitly specified.
 */
export const DEFAULT_Q_MATRIX: Record<string, QMatrixEntry> = {
  recognition: {
    taskType: 'recognition',
    components: { LEX: 0.7, PHON: 0.2, MORPH: 0.1 },
    interactionModel: 'compensatory',
    primaryProcess: 'recognition',
  },
  recall_cued: {
    taskType: 'recall_cued',
    components: { LEX: 0.6, MORPH: 0.2, PHON: 0.2 },
    interactionModel: 'compensatory',
    primaryProcess: 'recall',
  },
  recall_free: {
    taskType: 'recall_free',
    components: { LEX: 0.5, MORPH: 0.25, PHON: 0.25 },
    interactionModel: 'compensatory',
    primaryProcess: 'recall',
  },
  production: {
    taskType: 'production',
    components: { LEX: 0.3, SYNT: 0.3, PRAG: 0.2, MORPH: 0.2 },
    interactionModel: 'compensatory',
    primaryProcess: 'production',
  },
  word_formation: {
    taskType: 'word_formation',
    components: { MORPH: 0.6, LEX: 0.3, PHON: 0.1 },
    interactionModel: 'conjunctive',
    primaryProcess: 'transformation',
  },
  collocation: {
    taskType: 'collocation',
    components: { LEX: 0.5, SYNT: 0.3, PRAG: 0.2 },
    interactionModel: 'compensatory',
    primaryProcess: 'recall',
  },
  sentence_combining: {
    taskType: 'sentence_combining',
    components: { SYNT: 0.6, LEX: 0.2, PRAG: 0.2 },
    interactionModel: 'conjunctive',
    primaryProcess: 'synthesis',
  },
  register_shift: {
    taskType: 'register_shift',
    components: { PRAG: 0.5, LEX: 0.3, SYNT: 0.2 },
    interactionModel: 'compensatory',
    primaryProcess: 'transformation',
  },
  error_correction: {
    taskType: 'error_correction',
    components: { SYNT: 0.4, MORPH: 0.3, LEX: 0.2, PHON: 0.1 },
    interactionModel: 'disjunctive',
    primaryProcess: 'analysis',
  },
  translation: {
    taskType: 'translation',
    components: { LEX: 0.4, SYNT: 0.3, PRAG: 0.2, MORPH: 0.1 },
    interactionModel: 'compensatory',
    primaryProcess: 'production',
  },
  sentence_writing: {
    taskType: 'sentence_writing',
    components: { SYNT: 0.35, LEX: 0.3, PRAG: 0.2, MORPH: 0.15 },
    interactionModel: 'compensatory',
    primaryProcess: 'synthesis',
  },
  rapid_response: {
    taskType: 'rapid_response',
    components: { LEX: 0.6, PHON: 0.3, MORPH: 0.1 },
    interactionModel: 'compensatory',
    primaryProcess: 'recognition',
  },
};

/**
 * Cognitive process difficulty multipliers.
 * Higher processes require more cognitive resources.
 * Based on Bloom's taxonomy and Anderson & Krathwohl (2001).
 */
export const COGNITIVE_PROCESS_MULTIPLIERS: Record<CognitiveProcess, number> = {
  recognition: 1.0,      // Base difficulty
  recall: 1.2,           // 20% harder
  transformation: 1.4,   // 40% harder
  production: 1.6,       // 60% harder
  analysis: 1.5,         // 50% harder
  synthesis: 1.8,        // 80% harder (highest)
};

// =============================================================================
// Flexible Object-Role Allocation Framework
// =============================================================================

/**
 * Object role in a task - continuous spectrum, not binary.
 *
 * Roles determine:
 * - How much theta update the object receives
 * - What kind of evaluation is applied
 * - How the object's state is updated after the task
 *
 * This replaces the binary isPrimaryTarget with a gradient model.
 */
export type ObjectRole =
  | 'assessment'      // Full evaluation, full theta/mastery update
  | 'practice'        // Evaluation tracked, partial theta update
  | 'reinforcement'   // Light check, exposure-focused, minimal theta
  | 'incidental';     // No evaluation, exposure count only

/**
 * Role configuration parameters.
 * Defines how each role affects learning metrics.
 */
export interface RoleConfig {
  /** Theta update multiplier (0-1) */
  thetaMultiplier: number;

  /** Whether to update mastery state */
  updateMastery: boolean;

  /** Whether to track accuracy */
  trackAccuracy: boolean;

  /** Whether to update FSRS scheduling */
  updateFSRS: boolean;

  /** Exposure weight for this role */
  exposureWeight: number;

  /** Minimum cognitive engagement required */
  minEngagement: 'passive' | 'recognition' | 'recall' | 'production';
}

/**
 * Default configurations for each object role.
 */
export const ROLE_CONFIGS: Record<ObjectRole, RoleConfig> = {
  assessment: {
    thetaMultiplier: 1.0,
    updateMastery: true,
    trackAccuracy: true,
    updateFSRS: true,
    exposureWeight: 1.0,
    minEngagement: 'recall',
  },
  practice: {
    thetaMultiplier: 0.5,
    updateMastery: true,
    trackAccuracy: true,
    updateFSRS: true,
    exposureWeight: 0.8,
    minEngagement: 'recognition',
  },
  reinforcement: {
    thetaMultiplier: 0.2,
    updateMastery: false,
    trackAccuracy: false,
    updateFSRS: false,
    exposureWeight: 0.5,
    minEngagement: 'recognition',
  },
  incidental: {
    thetaMultiplier: 0,
    updateMastery: false,
    trackAccuracy: false,
    updateFSRS: false,
    exposureWeight: 0.3,
    minEngagement: 'passive',
  },
};

/**
 * Object slot in a task template.
 * Defines a position where any qualifying object can be placed.
 *
 * This enables flexible task composition - the task generator
 * can fill slots with objects based on user state optimization.
 */
export interface ObjectSlot {
  /** Unique slot identifier within the task */
  slotId: string;

  /** Acceptable component types for this slot */
  acceptedComponents: ComponentCode[];

  /** Role this slot assigns to its object */
  role: ObjectRole;

  /** Weight contribution to task (0-1) */
  weight: number;

  /** Required cognitive process for this slot */
  requiredProcess: CognitiveProcess;

  /** Constraints on object selection */
  constraints?: ObjectSlotConstraints;

  /** Whether this slot must be filled */
  required: boolean;
}

/**
 * Constraints for object slot filling.
 * Allows expressing complex selection criteria.
 */
export interface ObjectSlotConstraints {
  /** Minimum mastery stage required */
  minMasteryStage?: MasteryStage;

  /** Maximum mastery stage allowed */
  maxMasteryStage?: MasteryStage;

  /** Minimum automaticity level (0-1) */
  minAutomaticity?: number;

  /** Required relationship to another slot's object */
  relatedToSlot?: {
    slotId: string;
    relationshipType: 'collocation' | 'morphological_family' | 'semantic_field' | 'syntactic_pattern';
  };

  /** Domain filter */
  domains?: string[];

  /** Recency constraint - exclude if seen within N sessions */
  minSessionsSinceExposure?: number;

  /** Priority threshold */
  minPriority?: number;
}

/**
 * Task template with flexible object slots.
 * Separates task structure from specific object assignment.
 */
export interface TaskTemplate {
  /** Template identifier */
  templateId: string;

  /** Human-readable name */
  name: string;

  /** Task type this template produces */
  taskType: TaskType;

  /** Task format */
  taskFormat: TaskFormat;

  /** Supported modalities */
  modalities: TaskModality[];

  /** Object slots to be filled */
  slots: ObjectSlot[];

  /** Interaction model for multi-component scoring */
  interactionModel: 'compensatory' | 'conjunctive' | 'disjunctive';

  /** Base difficulty before object adjustments */
  baseDifficulty: number;

  /** Content generation template/prompt */
  contentTemplate: string;

  /** Minimum total weight from assessment+practice roles */
  minEvaluatedWeight: number;
}

/**
 * Filled slot - a slot with an assigned object.
 */
export interface FilledSlot extends ObjectSlot {
  /** Assigned object ID */
  objectId: string;

  /** Object content */
  content: string;

  /** Object's IRT difficulty */
  objectDifficulty: number;

  /** Object's IRT discrimination */
  objectDiscrimination: number;

  /** Object's current mastery stage */
  currentMasteryStage: MasteryStage;

  /** Object's automaticity level (0-1) */
  automaticityLevel: number;
}

/**
 * Composed task - a template with all slots filled.
 */
export interface ComposedTask {
  /** Unique task ID */
  taskId: string;

  /** Source template */
  templateId: string;

  /** Session context */
  sessionId: string;

  /** Goal context */
  goalId: string;

  /** Filled slots */
  filledSlots: FilledSlot[];

  /** Task type */
  taskType: TaskType;

  /** Task format */
  taskFormat: TaskFormat;

  /** Modality */
  modality: TaskModality;

  /** Domain */
  domain: string;

  /** Composite difficulty (weighted from slots) */
  compositeDifficulty: number;

  /** Generated content/prompt */
  content: string;

  /** Expected answer(s) */
  expectedAnswers: string[];

  /** Evaluation rubric */
  rubric: TaskRubric;
}

/**
 * Evaluation rubric for multi-slot tasks.
 */
export interface TaskRubric {
  /** Per-slot evaluation criteria */
  slotCriteria: Array<{
    slotId: string;
    criteria: string;
    partialCreditLevels?: Array<{
      score: number;
      description: string;
    }>;
  }>;

  /** Overall task success criteria */
  overallCriteria: string;

  /** Acceptable answer patterns */
  acceptablePatterns?: RegExp[];
}

/**
 * Economic value of including an object in a task.
 * Used by the optimizer to select optimal object combinations.
 */
export interface ObjectEconomicValue {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /**
   * Learning value - how much including this object advances learning goals.
   * Higher for objects that need practice, are due for review, or are high priority.
   */
  learningValue: number;

  /**
   * Cognitive cost - how much mental load this object adds.
   * Higher for difficult objects, unfamiliar objects, or complex processes.
   */
  cognitiveCost: number;

  /**
   * Synergy potential - bonus value when combined with specific other objects.
   * E.g., collocations, morphological families, related concepts.
   */
  synergyMap: Map<string, number>;

  /**
   * Role affinity - how suitable this object is for each role.
   * Based on mastery stage, automaticity, learning needs.
   */
  roleAffinity: Record<ObjectRole, number>;

  /**
   * Urgency - time-sensitive priority.
   * Due reviews, approaching deadlines, skill decay risk.
   */
  urgency: number;

  /**
   * Exposure balance - adjustment based on modality exposure history.
   * Favors objects that need more balanced exposure.
   */
  exposureBalance: number;
}

/**
 * Task composition optimization parameters.
 */
export interface CompositionOptimizationConfig {
  /** Maximum cognitive load allowed */
  maxCognitiveLoad: number;

  /** Minimum learning value threshold */
  minLearningValue: number;

  /** How much to weight synergy in selection */
  synergyWeight: number;

  /** How much to weight urgency in selection */
  urgencyWeight: number;

  /** How much to weight exposure balance */
  exposureBalanceWeight: number;

  /** Prefer fewer high-value objects vs more low-value objects */
  densityPreference: 'sparse' | 'balanced' | 'dense';

  /** Maximum objects per task */
  maxObjectsPerTask: number;

  /** Minimum objects per task */
  minObjectsPerTask: number;
}

/**
 * Default optimization configuration.
 */
export const DEFAULT_COMPOSITION_CONFIG: CompositionOptimizationConfig = {
  maxCognitiveLoad: 7,  // Miller's 7±2
  minLearningValue: 0.1,
  synergyWeight: 0.3,
  urgencyWeight: 0.4,
  exposureBalanceWeight: 0.2,
  densityPreference: 'balanced',
  maxObjectsPerTask: 8,
  minObjectsPerTask: 1,
};

/**
 * Result of task composition optimization.
 */
export interface CompositionResult {
  /** The composed task */
  task: ComposedTask;

  /** Total learning value achieved */
  totalLearningValue: number;

  /** Total cognitive cost */
  totalCognitiveCost: number;

  /** Efficiency ratio (value / cost) */
  efficiency: number;

  /** Synergy bonus captured */
  synergyBonus: number;

  /** Objects considered but not included */
  excludedObjects: Array<{
    objectId: string;
    reason: 'cognitive_overload' | 'low_value' | 'constraint_mismatch' | 'slot_full';
  }>;

  /** Alternative compositions considered (for debugging/explanation) */
  alternativesConsidered?: number;
}

// =============================================================================
// Cascading Constraint & Evaluation System
// =============================================================================

/**
 * Object evaluation mode - how correctness is determined.
 * Different objects require different evaluation approaches.
 */
export type EvaluationMode =
  | 'binary'           // Simple correct/incorrect
  | 'partial_credit'   // Multi-layer scoring
  | 'range_based'      // Acceptable answer range
  | 'rubric_based';    // Complex rubric with criteria

/**
 * Evaluation layer for partial credit scoring.
 * Each layer represents a different aspect of correctness.
 */
export interface EvaluationLayer {
  /** Layer identifier */
  layerId: string;

  /** Layer name (e.g., "Form Accuracy", "Contextual Appropriateness") */
  name: string;

  /** Weight of this layer in final score (0-1) */
  weight: number;

  /** Criteria for full credit */
  fullCreditCriteria: string;

  /** Partial credit levels */
  levels: Array<{
    score: number;        // 0-1
    description: string;  // What earns this score
    examples?: string[];  // Example responses at this level
  }>;
}

/**
 * Range-based answer specification.
 * For objects where multiple answers are acceptable.
 */
export interface AnswerRange {
  /** Exact matches (highest score) */
  exactMatches: string[];

  /** Acceptable variants (full credit but not exact) */
  acceptableVariants: string[];

  /** Partial credit patterns */
  partialCreditPatterns: Array<{
    pattern: string;      // Regex or template
    score: number;        // 0-1
    feedback: string;     // Why partial credit
  }>;

  /** Semantic similarity threshold (0-1) for fuzzy matching */
  semanticThreshold?: number;
}

/**
 * Object-specific evaluation configuration.
 * Defines how each object's correctness is assessed.
 */
export interface ObjectEvaluationConfig {
  /** Object ID this config applies to */
  objectId?: string;

  /** Component type */
  componentType?: ComponentCode;

  /** Primary evaluation mode */
  evaluationMode: EvaluationMode;

  /** Score threshold for passing (0-1) */
  threshold?: number;

  /** For partial_credit mode: evaluation layers */
  layers?: EvaluationLayer[];

  /** For range_based mode: acceptable answer range */
  answerRange?: AnswerRange;

  /** For rubric_based mode: full rubric */
  rubric?: ObjectRubric;

  /** Context-dependent evaluation adjustments */
  contextAdjustments?: Array<{
    context: string;      // Context identifier
    adjustment: number;   // Score multiplier
    reason: string;       // Why adjustment applies
  }>;
}

/**
 * Object-specific rubric for complex evaluation.
 */
export interface ObjectRubric {
  /** Rubric identifier */
  rubricId: string;

  /** Criteria to evaluate */
  criteria: Array<{
    criterionId: string;
    name: string;
    description: string;
    weight: number;
    scoringGuide: Array<{
      score: number;
      descriptor: string;
    }>;
  }>;

  /** Holistic scoring option */
  holisticOption?: {
    enabled: boolean;
    levels: Array<{
      score: number;
      descriptor: string;
    }>;
  };
}

// =============================================================================
// Cascading Constraint Graph
// =============================================================================

/**
 * Constraint relationship types between objects.
 * Defines how selecting one object affects others.
 */
export type ConstraintType =
  | 'requires'          // Must also include this object
  | 'excludes'          // Cannot include this object
  | 'prefers'           // Bonus if included together
  | 'restricts_to'      // Limits choices to subset
  | 'enables'           // Makes object available for selection
  | 'modifies';         // Changes object's properties when combined

/**
 * Single constraint edge in the constraint graph.
 */
export interface ConstraintEdge {
  /** Source object/slot triggering the constraint */
  sourceId: string;

  /** Target object/slot/set affected */
  targetId: string;

  /** Constraint type */
  type: ConstraintType;

  /** Constraint strength (0-1, for soft constraints) */
  strength: number;

  /** Condition for constraint activation */
  condition?: ConstraintCondition;

  /** Modification details (for 'modifies' type) */
  modification?: {
    property: string;
    newValue: unknown;
    reason: string;
  };
}

/**
 * Condition for constraint activation.
 */
export interface ConstraintCondition {
  /** Property to check */
  property: 'componentType' | 'masteryStage' | 'content' | 'role' | 'taskType';

  /** Operator */
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';

  /** Value to compare against */
  value: unknown;
}

/**
 * Constraint propagation result.
 * Shows how constraints cascade through object selection.
 */
export interface ConstraintPropagation {
  /** Initial selection that triggered propagation */
  trigger: {
    slotId: string;
    objectId: string;
  };

  /** Required objects (must select) */
  required: Array<{
    objectId: string;
    reason: string;
    fromConstraint: string;
  }>;

  /** Excluded objects (cannot select) */
  excluded: Array<{
    objectId: string;
    reason: string;
    fromConstraint: string;
  }>;

  /** Restricted pools (limited choices) */
  restrictions: Array<{
    slotId: string;
    allowedObjectIds: string[];
    reason: string;
  }>;

  /** Preference adjustments */
  preferences: Array<{
    objectId: string;
    adjustment: number;  // Additive to economic value
    reason: string;
  }>;

  /** Property modifications */
  modifications: Array<{
    objectId: string;
    property: string;
    originalValue: unknown;
    newValue: unknown;
    reason: string;
  }>;
}

/**
 * Linguistic constraint rules.
 * Pre-defined constraints based on linguistic relationships.
 */
export interface LinguisticConstraintRule {
  /** Rule identifier */
  ruleId: string;

  /** Rule name */
  name: string;

  /** Description */
  description: string;

  /** Source component type */
  sourceComponent: ComponentCode;

  /** Target component type */
  targetComponent: ComponentCode;

  /** Constraint type */
  constraintType: ConstraintType;

  /** Rule logic (predicate function signature) */
  predicateType: 'syntactic_agreement' | 'phonological_compatibility' |
                 'morphological_derivation' | 'collocation' |
                 'register_consistency' | 'semantic_coherence';

  /** Default strength */
  defaultStrength: number;
}

/**
 * Pre-defined linguistic constraint rules.
 */
export const LINGUISTIC_CONSTRAINT_RULES: LinguisticConstraintRule[] = [
  // Syntax → Morphology: verb form agreement
  {
    ruleId: 'synt-morph-verb-agreement',
    name: 'Verb Form Agreement',
    description: 'Syntactic structure requires specific morphological form',
    sourceComponent: 'SYNT',
    targetComponent: 'MORPH',
    constraintType: 'restricts_to',
    predicateType: 'syntactic_agreement',
    defaultStrength: 1.0,
  },
  // Syntax → Lexicon: transitivity requirement
  {
    ruleId: 'synt-lex-transitivity',
    name: 'Transitivity Requirement',
    description: 'Syntactic pattern requires transitive/intransitive verb',
    sourceComponent: 'SYNT',
    targetComponent: 'LEX',
    constraintType: 'restricts_to',
    predicateType: 'syntactic_agreement',
    defaultStrength: 1.0,
  },
  // Lexicon → Lexicon: collocation preference
  {
    ruleId: 'lex-lex-collocation',
    name: 'Collocation Preference',
    description: 'Words that frequently co-occur',
    sourceComponent: 'LEX',
    targetComponent: 'LEX',
    constraintType: 'prefers',
    predicateType: 'collocation',
    defaultStrength: 0.7,
  },
  // Lexicon → Phonology: G2P mapping
  {
    ruleId: 'lex-phon-g2p',
    name: 'Grapheme-Phoneme Mapping',
    description: 'Word requires specific pronunciation pattern',
    sourceComponent: 'LEX',
    targetComponent: 'PHON',
    constraintType: 'requires',
    predicateType: 'phonological_compatibility',
    defaultStrength: 1.0,
  },
  // Lexicon → Morphology: derivational family
  {
    ruleId: 'lex-morph-derivation',
    name: 'Morphological Family',
    description: 'Words sharing morphological derivation',
    sourceComponent: 'LEX',
    targetComponent: 'MORPH',
    constraintType: 'enables',
    predicateType: 'morphological_derivation',
    defaultStrength: 0.8,
  },
  // Pragmatics → Lexicon: register consistency
  {
    ruleId: 'prag-lex-register',
    name: 'Register Consistency',
    description: 'Pragmatic context requires appropriate register vocabulary',
    sourceComponent: 'PRAG',
    targetComponent: 'LEX',
    constraintType: 'restricts_to',
    predicateType: 'register_consistency',
    defaultStrength: 0.9,
  },
  // Pragmatics → Syntax: discourse structure
  {
    ruleId: 'prag-synt-discourse',
    name: 'Discourse Structure',
    description: 'Pragmatic function suggests syntactic patterns',
    sourceComponent: 'PRAG',
    targetComponent: 'SYNT',
    constraintType: 'prefers',
    predicateType: 'semantic_coherence',
    defaultStrength: 0.6,
  },
];

// =============================================================================
// Usage Space Tracking
// =============================================================================

/**
 * Usage context - a specific situation where an object can be used.
 */
export interface UsageContext {
  /** Context identifier */
  contextId: string;

  /** Context name */
  name: string;

  /** Domain (medical, legal, general, etc.) */
  domain: string;

  /** Register (formal, informal, technical, etc.) */
  register: string;

  /** Modality (spoken, written, etc.) */
  modality: 'spoken' | 'written' | 'both';

  /** Genre (email, report, conversation, etc.) */
  genre?: string;

  /** Task types where this context applies */
  applicableTaskTypes: TaskType[];
}

/**
 * Object usage space - tracked contexts where object has been used.
 */
export interface ObjectUsageSpace {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Contexts where object has been successfully used */
  successfulContexts: Array<{
    contextId: string;
    exposureCount: number;
    successRate: number;
    lastExposure: Date;
  }>;

  /** Contexts attempted but not yet mastered */
  attemptedContexts: Array<{
    contextId: string;
    exposureCount: number;
    successRate: number;
    lastExposure: Date;
  }>;

  /** Target contexts for this object (from goal) */
  targetContexts: string[];

  /** Coverage ratio (successful / target) */
  coverageRatio: number;

  /** Expansion readiness - which new contexts could be attempted */
  expansionCandidates: Array<{
    contextId: string;
    readinessScore: number;  // 0-1, based on related context mastery
    prerequisites: string[]; // Contexts that should be mastered first
  }>;
}

/**
 * Usage space expansion event.
 * Recorded when an object is successfully used in a new context.
 */
export interface UsageSpaceExpansion {
  /** Object ID */
  objectId: string;

  /** New context ID */
  newContextId: string;

  /** Session where expansion occurred */
  sessionId: string;

  /** Task that triggered expansion */
  taskId: string;

  /** Timestamp */
  timestamp: Date;

  /** Previous coverage ratio */
  previousCoverage: number;

  /** New coverage ratio */
  newCoverage: number;
}

/**
 * Goal progress based on usage space coverage.
 */
export interface UsageSpaceProgress {
  /** Goal ID */
  goalId: string;

  /** Per-component coverage */
  componentCoverage: Record<ComponentCode, {
    totalObjects: number;
    objectsWithFullCoverage: number;
    averageCoverage: number;
    criticalGaps: Array<{
      objectId: string;
      missingContexts: string[];
    }>;
  }>;

  /** Overall readiness estimate */
  overallReadiness: number;

  /** Recommended focus areas */
  recommendations: Array<{
    priority: number;
    componentType: ComponentCode;
    objectIds: string[];
    targetContexts: string[];
    reason: string;
  }>;
}

// =============================================================================
// Component Prerequisite Chain
// =============================================================================

/**
 * Component prerequisite definition.
 *
 * Defines the hierarchical dependency between language components.
 * Lower components must be automated before higher components can be
 * effectively learned.
 *
 * Academic basis:
 * - Processability Theory (Pienemann, 1998, 2005)
 * - Skill Acquisition Theory / ACT-R (Anderson, 1982, 1993)
 * - Levelt's Speech Production Model (1999)
 * - Metalinguistic Development Sequence (Deacon & Kirby, 2004)
 */
export interface ComponentPrerequisite {
  /** Target component */
  component: ComponentCode;

  /** Required prerequisite components */
  prerequisites: ComponentCode[];

  /**
   * FSRS stability threshold for prerequisite automation.
   * Prerequisites must reach this stability level before
   * the target component can be effectively learned.
   */
  automationThreshold: number;

  /** Academic references for this dependency */
  academicBasis: string[];
}

/**
 * Component prerequisite chain.
 *
 * Based on:
 * - Processability Theory stages (Pienemann, 2005)
 * - Levelt's speech production model (1999)
 * - Metalinguistic development sequence (Deacon & Kirby, 2004)
 */
export const COMPONENT_PREREQUISITES: Record<ComponentCode, ComponentPrerequisite> = {
  PHON: {
    component: 'PHON',
    prerequisites: [],
    automationThreshold: 0,
    academicBasis: [
      'Phonological awareness as foundation (ILA Position Statement)',
      'Levelt (1999) - phonological encoding is base layer',
    ],
  },
  MORPH: {
    component: 'MORPH',
    prerequisites: ['PHON'],
    automationThreshold: 0.7,
    academicBasis: [
      'Metalinguistic development sequence (Deacon & Kirby, 2004)',
      'Processability Theory Stage 2 (Pienemann, 2005)',
    ],
  },
  LEX: {
    component: 'LEX',
    prerequisites: ['PHON', 'MORPH'],
    automationThreshold: 0.6,
    academicBasis: [
      'Levelt (1999) - lemma access requires phonological encoding',
      'Morphological awareness aids vocabulary (meta-analysis, 2023)',
    ],
  },
  SYNT: {
    component: 'SYNT',
    prerequisites: ['LEX', 'MORPH'],
    automationThreshold: 0.7,
    academicBasis: [
      'Processability Theory Stage 3-4 (Pienemann, 2005)',
      'ACT-R - proceduralized lexical access frees resources',
    ],
  },
  PRAG: {
    component: 'PRAG',
    prerequisites: ['LEX', 'SYNT'],
    automationThreshold: 0.8,
    academicBasis: [
      'Skill Acquisition Theory - freed cognitive resources (Anderson, 1993)',
      'Processability Theory Stage 5 (Pienemann, 2005)',
    ],
  },
};

/**
 * Prerequisite status for a component.
 */
export interface PrerequisiteStatus {
  /** Target component being checked */
  component: ComponentCode;

  /** Whether all prerequisites are satisfied */
  allSatisfied: boolean;

  /** Per-prerequisite status */
  prerequisites: Array<{
    component: ComponentCode;
    requiredThreshold: number;
    currentAutomation: number;
    isSatisfied: boolean;
  }>;

  /** Components blocking this one */
  blockingComponents: ComponentCode[];
}

// =============================================================================
// Component-Specific Usage Space Dimensions
// =============================================================================

/**
 * Usage space dimensions for PHON (Phonology/Orthography) component.
 *
 * Tracks where G2P rules and phonological patterns can be applied.
 */
export interface PhonUsageSpaceDimensions {
  /** Words containing this phonological pattern */
  applicableWords: string[];

  /** Position in word where pattern occurs */
  positions: ('initial' | 'medial' | 'final')[];

  /** Phonological environments (preceding/following sounds) */
  phonologicalEnvironments: string[];

  /** Modality of use */
  modality: ('decoding' | 'encoding')[];
}

/**
 * Usage space dimensions for MORPH (Morphology) component.
 *
 * Tracks where morphological rules can be applied.
 */
export interface MorphUsageSpaceDimensions {
  /** Roots/stems that can combine with this morpheme */
  combinableRoots: string[];

  /** Part-of-speech transformations enabled */
  posTransformations: Array<{
    from: string;
    to: string;
  }>;

  /** Semantic shift types */
  semanticShifts: ('nominalization' | 'agentive' | 'causative' | 'adjectival' | 'adverbial')[];

  /** Applicable domains */
  domains: string[];
}

/**
 * Usage space dimensions for LEX (Vocabulary) component.
 *
 * Tracks the full range of contexts where a word can be used.
 */
export interface LexUsageSpaceDimensions {
  /** Collocations (words that frequently co-occur) */
  collocations: Array<{
    word: string;
    pmi: number;
    frequency: number;
  }>;

  /** Register levels where word is appropriate */
  registers: ('informal' | 'neutral' | 'formal' | 'technical')[];

  /** Domains where word is commonly used */
  domains: string[];

  /** Semantic relations */
  semanticRelations: Array<{
    type: 'synonym' | 'antonym' | 'hypernym' | 'hyponym' | 'meronym';
    relatedWords: string[];
  }>;

  /** Pragmatic constraints */
  pragmaticConstraints: {
    appropriateContexts: string[];
    inappropriateContexts: string[];
  };
}

/**
 * Usage space dimensions for SYNT (Syntax) component.
 *
 * Tracks where grammatical structures can be applied.
 */
export interface SyntUsageSpaceDimensions {
  /** Compatible verb types */
  verbTypes: ('transitive' | 'intransitive' | 'ditransitive' | 'copular' | 'modal')[];

  /** Tense/aspect combinations */
  tenseAspects: string[];

  /** Text types (genres) */
  textTypes: ('narrative' | 'expository' | 'argumentative' | 'descriptive' | 'instructional')[];

  /** Complexity levels */
  complexityLevels: Array<{
    clauseType: 'simple' | 'compound' | 'complex' | 'compound-complex';
    embeddingDepth: number;
  }>;

  /** Information structure patterns */
  informationStructure: ('topic-comment' | 'focus-presupposition' | 'given-new')[];
}

/**
 * Usage space dimensions for PRAG (Pragmatics) component.
 *
 * Tracks where pragmatic strategies can be applied.
 */
export interface PragUsageSpaceDimensions {
  /** Communicative purposes */
  communicativePurposes: ('persuade' | 'inform' | 'request' | 'apologize' | 'complain' | 'suggest')[];

  /** Formality levels (Joos, 1967) */
  formalityLevels: ('intimate' | 'casual' | 'consultative' | 'formal' | 'frozen')[];

  /** Interlocutor relationship dimensions */
  interlocutorRelations: Array<{
    powerDifferential: 'higher' | 'equal' | 'lower';
    socialDistance: 'close' | 'neutral' | 'distant';
  }>;

  /** Applicable domains */
  domains: string[];

  /** Text types */
  textTypes: string[];

  /** Politeness strategies (Brown & Levinson, 1987) */
  politenessStrategies: ('bald-on-record' | 'positive-politeness' | 'negative-politeness' | 'off-record')[];
}

/**
 * Union type for component-specific usage space dimensions.
 */
export type ComponentUsageSpaceDimensions =
  | { type: 'PHON'; dimensions: PhonUsageSpaceDimensions }
  | { type: 'MORPH'; dimensions: MorphUsageSpaceDimensions }
  | { type: 'LEX'; dimensions: LexUsageSpaceDimensions }
  | { type: 'SYNT'; dimensions: SyntUsageSpaceDimensions }
  | { type: 'PRAG'; dimensions: PragUsageSpaceDimensions };

// =============================================================================
// Representative Sampling Strategy
// =============================================================================

/**
 * Strategy for selecting representative samples from usage space.
 *
 * Based on:
 * - Prototype Theory (Rosch, 1975)
 * - Variability of Practice (Schmidt, 1975)
 * - Power Law of Practice (Newell & Rosenbloom, 1981)
 */
export interface RepresentativeSamplingStrategy {
  /** Strategy identifier */
  strategyId: string;

  /** Component this strategy applies to */
  componentType: ComponentCode;

  /**
   * Weight for goal alignment in sample selection.
   * Higher = prefer samples aligned with user's goal.
   */
  goalWeight: number;

  /**
   * Weight for diversity in sample selection.
   * Higher = prefer samples that increase coverage variety.
   * Based on Variability of Practice (Schmidt, 1975).
   */
  diversityWeight: number;

  /**
   * Weight for transfer potential in sample selection.
   * Higher = prefer samples likely to generalize to other contexts.
   * Based on Transfer of Learning (Thorndike; Perkins & Salomon, 1992).
   */
  transferWeight: number;

  /**
   * Minimum samples needed for generalization.
   * Based on Power Law of Practice.
   */
  minSamplesForGeneralization: number;

  /** Primary selection criterion */
  primaryCriterion: 'prototype' | 'diversity' | 'transfer' | 'goal_aligned';

  /** Academic basis for this strategy */
  basis: string;
}

/**
 * Default sampling strategies per component.
 */
export const COMPONENT_SAMPLING_STRATEGIES: Record<ComponentCode, RepresentativeSamplingStrategy> = {
  PHON: {
    strategyId: 'phon-position-variety',
    componentType: 'PHON',
    goalWeight: 0.2,
    diversityWeight: 0.5,  // High: need variety in positions
    transferWeight: 0.3,
    minSamplesForGeneralization: 5,
    primaryCriterion: 'diversity',
    basis: 'Phonological rules transfer across positions with varied practice',
  },
  MORPH: {
    strategyId: 'morph-productive-roots',
    componentType: 'MORPH',
    goalWeight: 0.3,
    diversityWeight: 0.3,
    transferWeight: 0.4,  // High: morphological rules generalize well
    minSamplesForGeneralization: 4,
    primaryCriterion: 'transfer',
    basis: 'Morphological patterns transfer to novel combinations (Carlisle, 2000)',
  },
  LEX: {
    strategyId: 'lex-collocation-register',
    componentType: 'LEX',
    goalWeight: 0.4,  // High: vocabulary should align with goals
    diversityWeight: 0.3,
    transferWeight: 0.3,
    minSamplesForGeneralization: 7,
    primaryCriterion: 'goal_aligned',
    basis: 'Vocabulary use is highly goal-dependent (Nation, 2001)',
  },
  SYNT: {
    strategyId: 'synt-verb-genre',
    componentType: 'SYNT',
    goalWeight: 0.3,
    diversityWeight: 0.4,  // Need variety in verb types and genres
    transferWeight: 0.3,
    minSamplesForGeneralization: 6,
    primaryCriterion: 'diversity',
    basis: 'Syntactic patterns require varied contexts (Pienemann, 2005)',
  },
  PRAG: {
    strategyId: 'prag-purpose-formality',
    componentType: 'PRAG',
    goalWeight: 0.5,  // Highest: pragmatics is goal-driven
    diversityWeight: 0.2,
    transferWeight: 0.3,
    minSamplesForGeneralization: 8,
    primaryCriterion: 'goal_aligned',
    basis: 'Pragmatic competence is purpose-driven (Brown & Levinson, 1987)',
  },
};

// =============================================================================
// Generalization Estimation (Transfer of Learning)
// =============================================================================

/**
 * Transfer estimate between two usage contexts.
 *
 * Based on Transfer of Learning research (Thorndike, 1901;
 * Perkins & Salomon, 1992).
 */
export interface TransferEstimate {
  /** Source context (trained) */
  sourceContext: UsageContext;

  /** Target context (to be estimated) */
  targetContext: UsageContext;

  /**
   * Transfer distance (0-1).
   * Lower = more similar, higher transfer probability.
   */
  transferDistance: number;

  /**
   * Estimated transfer probability (0-1).
   * Probability that mastery in source transfers to target.
   */
  transferProbability: number;

  /** Type of transfer */
  transferType: 'near' | 'far';

  /** Confidence in this estimate */
  confidence: number;

  /** Basis for transfer (which dimensions are similar) */
  transferBasis: string[];
}

/**
 * Overall generalization estimate for an object.
 *
 * Estimates total usage space coverage including both
 * directly trained contexts and inferred coverage via transfer.
 */
export interface GeneralizationEstimate {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Directly trained contexts */
  directlyCovered: UsageContext[];

  /** Direct coverage ratio (0-1) */
  directCoverage: number;

  /** Contexts covered via transfer */
  inferredCoverage: TransferEstimate[];

  /**
   * Total estimated coverage (0-1).
   * Combines direct + inferred with confidence weighting.
   */
  estimatedTotalCoverage: number;

  /**
   * Goal-aligned coverage (0-1).
   * Weighted by relevance to user's goal.
   */
  goalAlignedCoverage: number;

  /** Automation level of the object (FSRS stability) */
  automationLevel: number;

  /**
   * Recommended next contexts to train.
   * Selected for maximum coverage expansion.
   */
  recommendedNextContexts: UsageContext[];
}

// =============================================================================
// Learning Goal (Stabilization vs Expansion)
// =============================================================================

/**
 * Learning goal type for an object.
 *
 * - Stabilization: Focus on automaticity (high frequency, time pressure)
 * - Expansion: Focus on usage space coverage (new contexts, diversity)
 *
 * Based on:
 * - Skill Acquisition Theory (Anderson, 1993)
 * - Desirable Difficulties (Bjork, 1994)
 */
export type LearningGoal = 'stabilization' | 'expansion';

/**
 * Reason for the assigned learning goal.
 */
export type LearningGoalReason =
  | 'not_automated_yet'           // Automation level below threshold
  | 'automated_low_coverage'      // Automated but usage space not covered
  | 'prerequisite_not_met'        // Lower component needs stabilization first
  | 'supporting_higher_component' // Stabilizing to support higher component
  | 'goal_context_gap'            // Goal requires contexts not yet covered
  | 'maintenance';                // Fully acquired, just maintaining

/**
 * Learning strategy for an object.
 *
 * Combines prerequisite status, automation level, and usage space
 * coverage to determine optimal learning approach.
 */
export interface ObjectLearningStrategy {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Current learning goal */
  currentGoal: LearningGoal;

  /** Reason for this goal */
  goalReason: LearningGoalReason;

  /** Prerequisite status */
  prerequisiteStatus: PrerequisiteStatus;

  /** Current automation level (FSRS stability) */
  automationLevel: number;

  /** Required automation threshold */
  automationThreshold: number;

  /** Current usage space coverage */
  usageSpaceCoverage: number;

  /** Higher components this object supports */
  supportsComponents: ComponentCode[];

  /** Priority score for learning (higher = more urgent) */
  priority: number;
}

/**
 * Integrated object learning state.
 *
 * Complete state representation combining all aspects:
 * - Prerequisite chain position
 * - Automation (stabilization) status
 * - Usage space (expansion) status
 * - Generalization estimates
 */
export interface IntegratedObjectState {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Learning strategy */
  strategy: ObjectLearningStrategy;

  /** Generalization estimate */
  generalization: GeneralizationEstimate;

  /** Is this object ready for higher component support */
  canSupportHigherComponents: boolean;

  /** Recommended task parameters */
  recommendedTaskParams: {
    /** Prefer fluency tasks (time pressure, high frequency) */
    preferFluency: boolean;
    /** Prefer versatility tasks (new contexts, low PMI) */
    preferVersatility: boolean;
    /** Suggested contexts for next task */
    suggestedContexts: string[];
    /** Cognitive process to target */
    targetProcess: CognitiveProcess;
  };
}
