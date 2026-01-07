/**
 * LOGOS Shared IPC Type Definitions
 *
 * This file contains types shared between main and renderer processes
 * for Inter-Process Communication (IPC) in Electron.
 *
 * Architecture (per AGENT-MANIFEST.md):
 * UI (React) --IPC--> Main Process --Prisma--> SQLite
 *                          |
 *                          +--async--> Claude API (optional)
 */

// Import core types that are used in IPC messages
import type {
  // IRT
  ItemParameter,
  ThetaEstimate,
  IRTModel,

  // PMI
  PMIResult,
  PMIPair,
  DifficultyMapping,

  // FSRS
  FSRSCard,
  FSRSParameters,
  FSRSRating,
  FSRSState,
  FSRSScheduleResult,

  // Mastery
  MasteryStage,
  MasteryState,
  MasteryResponse,
  ScaffoldingGap,
  CueLevel,

  // Tasks
  TaskType,
  TaskFormat,
  TaskModality,
  TaskSpec,
  TaskContent,
  Task,

  // Sessions
  SessionMode,
  SessionConfig,
  SessionState,
  SessionSummary,

  // Priority
  FREMetrics,
  PriorityCalculation,

  // Bottleneck
  ComponentType,
  BottleneckEvidence,
  BottleneckAnalysis,

  // Language Objects
  LanguageObject,
  LanguageObjectType,

  // Goals
  GoalSpec,
  Domain,
  Modality,

  // Users
  User,
  UserThetaProfile,

  // Queue
  LearningQueueItem,

  // Evaluation
  ResponseEvaluation,
  EvaluationScores,
  ResponseError,

  // Utility
  Result,
  PaginationParams,
  PaginatedResult,
  DateRange,
} from '../core/types';

// Re-export all imported types
export type {
  ItemParameter, ThetaEstimate, IRTModel,
  PMIResult, PMIPair, DifficultyMapping,
  FSRSCard, FSRSParameters, FSRSRating, FSRSState, FSRSScheduleResult,
  MasteryStage, MasteryState, MasteryResponse, ScaffoldingGap, CueLevel,
  TaskType, TaskFormat, TaskModality, TaskSpec, TaskContent, Task,
  SessionMode, SessionConfig, SessionState, SessionSummary,
  FREMetrics, PriorityCalculation,
  ComponentType, BottleneckEvidence, BottleneckAnalysis,
  LanguageObject, LanguageObjectType,
  GoalSpec, Domain, Modality,
  User, UserThetaProfile,
  LearningQueueItem,
  ResponseEvaluation, EvaluationScores, ResponseError,
  Result, PaginationParams, PaginatedResult, DateRange,
};

// =============================================================================
// IPC Channel Names (Type-Safe)
// =============================================================================

/**
 * All IPC channel names as const for type safety
 */
export const IPC_CHANNELS = {
  // Goal Management
  GOAL_CREATE: 'goal:create',
  GOAL_UPDATE: 'goal:update',
  GOAL_DELETE: 'goal:delete',
  GOAL_GET: 'goal:get',
  GOAL_LIST: 'goal:list',
  GOAL_SET_ACTIVE: 'goal:set-active',

  // Learning Session
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  SESSION_GET_NEXT_TASK: 'session:get-next-task',
  SESSION_SUBMIT_RESPONSE: 'session:submit-response',
  SESSION_GET_STATE: 'session:get-state',
  SESSION_GET_SUMMARY: 'session:get-summary',
  SESSION_LIST: 'session:list',

  // Learning Queue
  QUEUE_GET: 'queue:get',
  QUEUE_REFRESH: 'queue:refresh',

  // Language Objects
  OBJECT_GET: 'object:get',
  OBJECT_SEARCH: 'object:search',
  OBJECT_GET_COLLOCATIONS: 'object:get-collocations',
  OBJECT_GET_MASTERY: 'object:get-mastery',

  // User Profile
  USER_GET_PROFILE: 'user:get-profile',
  USER_UPDATE_SETTINGS: 'user:update-settings',
  USER_GET_THETA: 'user:get-theta',

  // Analytics
  ANALYTICS_GET_PROGRESS: 'analytics:get-progress',
  ANALYTICS_GET_BOTTLENECKS: 'analytics:get-bottlenecks',
  ANALYTICS_GET_HISTORY: 'analytics:get-history',

  // Content Generation (Claude API)
  CLAUDE_GENERATE_TASK: 'claude:generate-task',
  CLAUDE_EVALUATE_RESPONSE: 'claude:evaluate-response',
  CLAUDE_EXTRACT_VOCABULARY: 'claude:extract-vocabulary',
  CLAUDE_CHECK_STATUS: 'claude:check-status',

  // Offline/Sync
  SYNC_STATUS: 'sync:status',
  SYNC_FORCE: 'sync:force',
  OFFLINE_QUEUE_SIZE: 'offline:queue-size',

  // System
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_EXPORT_DATA: 'system:export-data',
  SYSTEM_IMPORT_DATA: 'system:import-data',
  SYSTEM_BACKUP: 'system:backup',

  // Learning Objects CRUD
  OBJECT_CREATE: 'object:create',
  OBJECT_LIST: 'object:list',
  OBJECT_UPDATE: 'object:update',
  OBJECT_DELETE: 'object:delete',
  OBJECT_IMPORT: 'object:import',

  // Agent channels
  AGENT_DETECT_TRIGGERS: 'agent:detectTriggers',
  AGENT_REGISTER_BOTTLENECK: 'agent:registerBottleneck',
  AGENT_GET_BOTTLENECKS: 'agent:getBottlenecks',
  AGENT_RESOLVE_BOTTLENECK: 'agent:resolveBottleneck',
  AGENT_GET_TRIGGER_HISTORY: 'agent:getTriggerHistory',
  AGENT_GENERATE_SPEC: 'agent:generateSpec',
  AGENT_CLEAR_HISTORY: 'agent:clearHistory',

  // Corpus Sources
  CORPUS_LIST_SOURCES: 'goal:list-sources',
  CORPUS_GET_RECOMMENDED: 'goal:get-recommended-sources',
  CORPUS_POPULATE: 'goal:populate-vocabulary',
  CORPUS_GET_STATUS: 'goal:get-population-status',
  CORPUS_CLEAR: 'goal:clear-vocabulary',
  CORPUS_UPLOAD: 'goal:upload-corpus',
} as const;

/**
 * Type for all valid IPC channel names
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// =============================================================================
// IPC Request/Response Payload Types
// =============================================================================

/**
 * Base IPC response wrapper
 */
export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: IPCError;
}

/**
 * IPC error details
 */
export interface IPCError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Goal IPC Types
// -----------------------------------------------------------------------------

export interface GoalCreateRequest {
  domain: string;
  modality: string[];
  genre: string;
  purpose: string;
  benchmark?: string;
  deadline?: string; // ISO date string
}

export interface GoalUpdateRequest {
  id: string;
  updates: Partial<Omit<GoalCreateRequest, 'id'>>;
}

export interface GoalListRequest {
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface GoalListResponse {
  goals: GoalSpec[];
  total: number;
}

// -----------------------------------------------------------------------------
// Session IPC Types
// -----------------------------------------------------------------------------

export interface SessionStartRequest {
  goalId: string;
  mode: SessionMode;
  maxItems?: number;
  targetDurationMinutes?: number;
  focusComponents?: ComponentType[];
}

export interface SessionStartResponse {
  sessionId: string;
  firstTask: Task;
  queueLength: number;
}

export interface SessionEndRequest {
  sessionId: string;
}

export interface SessionSubmitResponseRequest {
  sessionId: string;
  taskId: string;
  response: string;
  responseTimeMs: number;
  hintsUsed: number;
}

export interface SessionSubmitResponseResponse {
  evaluation: ResponseEvaluation;
  masteryUpdate: {
    previousStage: MasteryStage;
    newStage: MasteryStage;
    transitioned: boolean;
  };
  nextTask: Task | null;
  sessionComplete: boolean;
}

export interface SessionListRequest {
  goalId?: string;
  limit?: number;
  offset?: number;
  dateRange?: {
    from: string; // ISO date
    to: string;   // ISO date
  };
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
}

// -----------------------------------------------------------------------------
// Queue IPC Types
// -----------------------------------------------------------------------------

export interface QueueGetRequest {
  goalId: string;
  limit?: number;
  includeNew?: boolean;
  includeDue?: boolean;
}

export interface QueueGetResponse {
  items: LearningQueueItem[];
  newCount: number;
  dueCount: number;
  totalCount: number;
}

// -----------------------------------------------------------------------------
// Language Object IPC Types
// -----------------------------------------------------------------------------

export interface ObjectSearchRequest {
  goalId: string;
  query: string;
  types?: LanguageObjectType[];
  limit?: number;
}

export interface ObjectSearchResponse {
  objects: LanguageObject[];
  total: number;
}

export interface ObjectGetCollocationsRequest {
  objectId: string;
  limit?: number;
}

export interface ObjectGetCollocationsResponse {
  collocations: Array<{
    word: string;
    pmi: number;
    npmi: number;
    significance: number;
  }>;
}

export interface ObjectGetMasteryRequest {
  objectId: string;
}

export interface ObjectGetMasteryResponse {
  mastery: MasteryState | null;
  history: Array<{
    date: string;
    correct: boolean;
    responseTimeMs: number;
    cueLevel: number;
  }>;
}

// -----------------------------------------------------------------------------
// User IPC Types
// -----------------------------------------------------------------------------

export interface UserSettings {
  dailyGoalMinutes: number;
  sessionLength: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  targetRetention: number;
}

export interface UserUpdateSettingsRequest {
  settings: Partial<UserSettings>;
}

export interface UserGetThetaResponse {
  theta: UserThetaProfile;
  lastUpdated: string;
  confidenceIntervals: {
    global: [number, number];
    byComponent: Record<ComponentType, [number, number]>;
  };
}

// -----------------------------------------------------------------------------
// Analytics IPC Types
// -----------------------------------------------------------------------------

export interface AnalyticsGetProgressRequest {
  goalId: string;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface AnalyticsGetProgressResponse {
  overall: {
    completionPercent: number;
    itemsLearned: number;
    itemsTotal: number;
    averageAccuracy: number;
    streakDays: number;
  };
  byStage: Record<MasteryStage, number>;
  byComponent: Record<ComponentType, {
    theta: number;
    itemCount: number;
    accuracy: number;
  }>;
  timeline: Array<{
    date: string;
    itemsPracticed: number;
    accuracy: number;
    minutesSpent: number;
  }>;
}

export interface AnalyticsGetBottlenecksRequest {
  goalId: string;
  windowDays?: number;
}

export interface AnalyticsGetHistoryRequest {
  goalId?: string;
  objectId?: string;
  limit?: number;
  offset?: number;
}

export interface AnalyticsGetHistoryResponse {
  responses: Array<{
    id: string;
    date: string;
    objectId: string;
    objectContent: string;
    correct: boolean;
    responseTimeMs: number;
    taskType: TaskType;
  }>;
  total: number;
}

// -----------------------------------------------------------------------------
// Claude API IPC Types
// -----------------------------------------------------------------------------

export interface ClaudeGenerateTaskRequest {
  objectId: string;
  targetStage: MasteryStage;
  taskType: TaskType;
  taskFormat: TaskFormat;
  domain: string;
  userTheta: number;
}

export interface ClaudeEvaluateResponseRequest {
  taskPrompt: string;
  expectedAnswer: string;
  userResponse: string;
  taskType: TaskType;
}

export interface ClaudeExtractVocabularyRequest {
  text: string;
  domain: string;
  targetLanguage: string;
}

export interface ClaudeExtractVocabularyResponse {
  vocabulary: Array<{
    content: string;
    type: LanguageObjectType;
    pos: string;
    frequencyEstimate: number;
    register: 'formal' | 'neutral' | 'informal';
    domainSpecificity: number;
    morphologicalRoot: string;
    collocations: string[];
  }>;
}

export interface ClaudeStatusResponse {
  available: boolean;
  quotaRemaining?: number;
  lastError?: string;
}

// -----------------------------------------------------------------------------
// Sync/Offline IPC Types
// -----------------------------------------------------------------------------

export interface SyncStatusResponse {
  isOnline: boolean;
  lastSync: string | null;
  pendingOperations: number;
  syncInProgress: boolean;
}

export interface OfflineQueueSizeResponse {
  taskGenerationQueue: number;
  evaluationQueue: number;
  total: number;
}

// -----------------------------------------------------------------------------
// System IPC Types
// -----------------------------------------------------------------------------

export interface SystemInfoResponse {
  version: string;
  platform: string;
  databaseSize: number;
  cacheSize: number;
  lastBackup: string | null;
}

export interface SystemExportDataRequest {
  format: 'json' | 'csv';
  includeHistory?: boolean;
  goalIds?: string[];
}

export interface SystemExportDataResponse {
  filePath: string;
  size: number;
}

export interface SystemImportDataRequest {
  filePath: string;
  merge?: boolean;
}

export interface SystemImportDataResponse {
  imported: {
    goals: number;
    objects: number;
    sessions: number;
  };
  skipped: number;
  errors: string[];
}

// =============================================================================
// IPC Handler Type Map
// =============================================================================

/**
 * Type-safe mapping of IPC channels to their request/response types
 * This enables full type inference when using IPC handlers
 */
export interface IPCHandlerMap {
  // Goals
  [IPC_CHANNELS.GOAL_CREATE]: {
    request: GoalCreateRequest;
    response: GoalSpec;
  };
  [IPC_CHANNELS.GOAL_UPDATE]: {
    request: GoalUpdateRequest;
    response: GoalSpec;
  };
  [IPC_CHANNELS.GOAL_DELETE]: {
    request: { id: string };
    response: { deleted: boolean };
  };
  [IPC_CHANNELS.GOAL_GET]: {
    request: { id: string };
    response: GoalSpec;
  };
  [IPC_CHANNELS.GOAL_LIST]: {
    request: GoalListRequest;
    response: GoalListResponse;
  };
  [IPC_CHANNELS.GOAL_SET_ACTIVE]: {
    request: { id: string; active: boolean };
    response: GoalSpec;
  };

  // Sessions
  [IPC_CHANNELS.SESSION_START]: {
    request: SessionStartRequest;
    response: SessionStartResponse;
  };
  [IPC_CHANNELS.SESSION_END]: {
    request: SessionEndRequest;
    response: SessionSummary;
  };
  [IPC_CHANNELS.SESSION_GET_NEXT_TASK]: {
    request: { sessionId: string };
    response: Task | null;
  };
  [IPC_CHANNELS.SESSION_SUBMIT_RESPONSE]: {
    request: SessionSubmitResponseRequest;
    response: SessionSubmitResponseResponse;
  };
  [IPC_CHANNELS.SESSION_GET_STATE]: {
    request: { sessionId: string };
    response: SessionState;
  };
  [IPC_CHANNELS.SESSION_GET_SUMMARY]: {
    request: { sessionId: string };
    response: SessionSummary;
  };
  [IPC_CHANNELS.SESSION_LIST]: {
    request: SessionListRequest;
    response: SessionListResponse;
  };

  // Queue
  [IPC_CHANNELS.QUEUE_GET]: {
    request: QueueGetRequest;
    response: QueueGetResponse;
  };
  [IPC_CHANNELS.QUEUE_REFRESH]: {
    request: { goalId: string };
    response: QueueGetResponse;
  };

  // Objects
  [IPC_CHANNELS.OBJECT_GET]: {
    request: { id: string };
    response: LanguageObject;
  };
  [IPC_CHANNELS.OBJECT_SEARCH]: {
    request: ObjectSearchRequest;
    response: ObjectSearchResponse;
  };
  [IPC_CHANNELS.OBJECT_GET_COLLOCATIONS]: {
    request: ObjectGetCollocationsRequest;
    response: ObjectGetCollocationsResponse;
  };
  [IPC_CHANNELS.OBJECT_GET_MASTERY]: {
    request: ObjectGetMasteryRequest;
    response: ObjectGetMasteryResponse;
  };
  [IPC_CHANNELS.OBJECT_CREATE]: {
    request: { goalId: string; content: string; type: string; frequency?: number; relationalDensity?: number; contextualContribution?: number; irtDifficulty?: number; metadata?: Record<string, unknown> };
    response: LanguageObject;
  };
  [IPC_CHANNELS.OBJECT_LIST]: {
    request: { goalId: string; type?: string; limit?: number; offset?: number };
    response: { objects: LanguageObject[]; total: number };
  };
  [IPC_CHANNELS.OBJECT_UPDATE]: {
    request: { id: string; updates: Partial<LanguageObject> };
    response: LanguageObject;
  };
  [IPC_CHANNELS.OBJECT_DELETE]: {
    request: { id: string };
    response: { deleted: boolean };
  };
  [IPC_CHANNELS.OBJECT_IMPORT]: {
    request: { goalId: string; objects: Array<Partial<LanguageObject> & { content: string }> };
    response: { imported: number; errors: string[] };
  };

  // Agent
  [IPC_CHANNELS.AGENT_DETECT_TRIGGERS]: {
    request: { operation: string; location: string[]; layers: string[]; issues?: string[]; securitySensitive?: boolean; externalApi?: boolean };
    response: { triggers: Array<{ agent: string; confidence: number; reason: string }> };
  };
  [IPC_CHANNELS.AGENT_REGISTER_BOTTLENECK]: {
    request: { type: string; description: string; severity: number; location: string; agentType?: string };
    response: { id: string; registered: boolean };
  };
  [IPC_CHANNELS.AGENT_GET_BOTTLENECKS]: {
    request: { active?: boolean; limit?: number };
    response: { bottlenecks: Array<{ id: string; type: string; description: string; severity: number; location: string; resolved: boolean }> };
  };
  [IPC_CHANNELS.AGENT_RESOLVE_BOTTLENECK]: {
    request: { id: string; resolution: string };
    response: { resolved: boolean };
  };
  [IPC_CHANNELS.AGENT_GET_TRIGGER_HISTORY]: {
    request: { limit?: number };
    response: { history: Array<{ timestamp: string; operation: string; triggeredAgents: string[] }> };
  };
  [IPC_CHANNELS.AGENT_GENERATE_SPEC]: {
    request: { bottleneckId: string };
    response: { spec: string };
  };
  [IPC_CHANNELS.AGENT_CLEAR_HISTORY]: {
    request: void;
    response: { cleared: boolean };
  };


  // User
  [IPC_CHANNELS.USER_GET_PROFILE]: {
    request: void;
    response: User;
  };
  [IPC_CHANNELS.USER_UPDATE_SETTINGS]: {
    request: UserUpdateSettingsRequest;
    response: UserSettings;
  };
  [IPC_CHANNELS.USER_GET_THETA]: {
    request: void;
    response: UserGetThetaResponse;
  };

  // Analytics
  [IPC_CHANNELS.ANALYTICS_GET_PROGRESS]: {
    request: AnalyticsGetProgressRequest;
    response: AnalyticsGetProgressResponse;
  };
  [IPC_CHANNELS.ANALYTICS_GET_BOTTLENECKS]: {
    request: AnalyticsGetBottlenecksRequest;
    response: BottleneckAnalysis;
  };
  [IPC_CHANNELS.ANALYTICS_GET_HISTORY]: {
    request: AnalyticsGetHistoryRequest;
    response: AnalyticsGetHistoryResponse;
  };

  // Claude
  [IPC_CHANNELS.CLAUDE_GENERATE_TASK]: {
    request: ClaudeGenerateTaskRequest;
    response: TaskContent;
  };
  [IPC_CHANNELS.CLAUDE_EVALUATE_RESPONSE]: {
    request: ClaudeEvaluateResponseRequest;
    response: ResponseEvaluation;
  };
  [IPC_CHANNELS.CLAUDE_EXTRACT_VOCABULARY]: {
    request: ClaudeExtractVocabularyRequest;
    response: ClaudeExtractVocabularyResponse;
  };
  [IPC_CHANNELS.CLAUDE_CHECK_STATUS]: {
    request: void;
    response: ClaudeStatusResponse;
  };

  // Sync
  [IPC_CHANNELS.SYNC_STATUS]: {
    request: void;
    response: SyncStatusResponse;
  };
  [IPC_CHANNELS.SYNC_FORCE]: {
    request: void;
    response: SyncStatusResponse;
  };
  [IPC_CHANNELS.OFFLINE_QUEUE_SIZE]: {
    request: void;
    response: OfflineQueueSizeResponse;
  };

  // System
  [IPC_CHANNELS.SYSTEM_GET_INFO]: {
    request: void;
    response: SystemInfoResponse;
  };
  [IPC_CHANNELS.SYSTEM_EXPORT_DATA]: {
    request: SystemExportDataRequest;
    response: SystemExportDataResponse;
  };
  [IPC_CHANNELS.SYSTEM_IMPORT_DATA]: {
    request: SystemImportDataRequest;
    response: SystemImportDataResponse;
  };
  [IPC_CHANNELS.SYSTEM_BACKUP]: {
    request: void;
    response: { path: string; timestamp: string };
  };
}

// =============================================================================
// Type Helpers for IPC Usage
// =============================================================================

/**
 * Extract request type for a given channel
 */
export type IPCRequest<T extends IPCChannel> = T extends keyof IPCHandlerMap
  ? IPCHandlerMap[T]['request']
  : never;

/**
 * Extract response type for a given channel
 */
export type IPCResponseData<T extends IPCChannel> = T extends keyof IPCHandlerMap
  ? IPCHandlerMap[T]['response']
  : never;

/**
 * Type for the invoke function in renderer
 */
export type IPCInvoke = <T extends IPCChannel>(
  channel: T,
  ...args: IPCRequest<T> extends void ? [] : [IPCRequest<T>]
) => Promise<IPCResponse<IPCResponseData<T>>>;

/**
 * Type for handler registration in main process
 */
export type IPCHandler<T extends IPCChannel> = (
  request: IPCRequest<T>
) => Promise<IPCResponseData<T>>;

// =============================================================================
// Preload API Type (for contextBridge)
// =============================================================================

/**
 * Goal management API
 *
 * Goals use the GoalSpec schema with domain/modality/genre/purpose fields.
 */
export interface GoalAPI {
  create: (data: GoalCreateRequest) => Promise<GoalSpec>;
  get: (id: string) => Promise<GoalSpec | null>;
  list: (includeInactive?: boolean) => Promise<GoalSpec[]>;
  update: (data: GoalUpdateRequest) => Promise<GoalSpec>;
  delete: (id: string, hard?: boolean) => Promise<void>;
}

/**
 * Learning object management API
 */
export interface ObjectAPI {
  create: (data: Partial<LanguageObject> & { goalId: string; content: string }) => Promise<LanguageObject>;
  get: (id: string) => Promise<LanguageObject | null>;
  list: (goalId: string, options?: { limit?: number; offset?: number; type?: string }) => Promise<LanguageObject[]>;
  update: (data: { id: string } & Partial<LanguageObject>) => Promise<LanguageObject>;
  delete: (id: string) => Promise<void>;
  import: (goalId: string, objects: Partial<LanguageObject>[]) => Promise<{ imported: number; errors: string[] }>;
}

/**
 * Session management API
 */
export interface SessionAPI {
  start: (goalId: string, sessionType: SessionMode, targetDuration?: number) => Promise<{ sessionId: string; firstTask: Task | null }>;
  end: (sessionId: string) => Promise<SessionSummary>;
  getCurrent: (goalId: string) => Promise<SessionState | null>;
  recordResponse: (data: { sessionId: string; objectId: string; correct: boolean; cueLevel: number; responseTimeMs: number; errorComponents?: string[] }) => Promise<{ feedback: ResponseEvaluation; nextTask: Task | null }>;
  getHistory: (goalId: string, options?: { limit?: number; offset?: number }) => Promise<SessionSummary[]>;
}

/**
 * Learning queue API
 */
export interface QueueAPI {
  build: (goalId: string, options?: { sessionSize?: number; newItemRatio?: number }) => Promise<LearningQueueItem[]>;
  getNext: (goalId: string, excludeIds?: string[]) => Promise<LearningQueueItem | null>;
  refresh: (goalId: string) => Promise<LearningQueueItem[]>;
}

/**
 * Mastery tracking API
 */
export interface MasteryAPI {
  get: (objectId: string) => Promise<MasteryState | null>;
  getStats: (goalId: string) => Promise<{ distribution: Record<MasteryStage, number>; averageRetention: number }>;
}

/**
 * Analytics API
 */
export interface AnalyticsAPI {
  getProgress: (goalId: string, timeRange?: 'day' | 'week' | 'month' | 'all') => Promise<{ total: number; mastered: number; learning: number; accuracy: number; streak: number }>;
  getBottlenecks: (goalId: string, minResponses?: number) => Promise<BottleneckAnalysis>;
  getSessionStats: (goalId: string, days?: number) => Promise<{ sessions: number; totalTime: number; averageAccuracy: number }>;
}

/**
 * User profile API
 */
export interface ProfileAPI {
  get: () => Promise<User>;
  update: (data: Partial<User>) => Promise<User>;
  getSettings: () => Promise<UserSettings>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<UserSettings>;
}

/**
 * Error analysis result
 */
export interface ErrorAnalysisResult {
  objectId: string;
  responseId?: string;
  errorType: string;
  component: ComponentType;
  explanation: string;
  correction: string;
  similarErrors?: string[];
}

/**
 * Bottleneck info with component details
 */
export interface ComponentBottleneck {
  component: ComponentType;
  errorRate: number;
  totalErrors: number;
  recentErrors: number;
  trend: number;
  recommendation: string;
  confidence: number;
}

/**
 * Claude AI integration API
 */
export interface ClaudeAPI {
  generateContent: (type: 'exercise' | 'explanation' | 'example', objectId: string, context?: string) => Promise<TaskContent>;
  analyzeError: (objectId: string, userResponse: string, expectedResponse: string, responseId?: string) => Promise<ErrorAnalysisResult>;
  getHint: (objectId: string, hintLevel: 1 | 2 | 3, previousHints?: string[]) => Promise<{ hint: string; level: number; remainingLevels: number }>;
  getBottlenecks: (goalId: string, limit?: number) => Promise<{ bottlenecks: ComponentBottleneck[]; primaryBottleneck: ComponentBottleneck | null }>;
}

/**
 * App info API
 */
export interface AppAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => NodeJS.Platform;
}

/**
 * Onboarding data collected from wizard
 */
export interface OnboardingData {
  nativeLanguage: string;
  targetLanguage: string;
  domain: string;
  modality: string[];
  purpose: string;
  benchmark?: string;
  deadline?: string;
  dailyTime: number;
}

/**
 * Onboarding status check result
 */
export interface OnboardingStatus {
  needsOnboarding: boolean;
  hasUser: boolean;
  hasGoals: boolean;
  userId?: string;
}

/**
 * Onboarding completion result
 */
export interface OnboardingResult {
  userId: string;
  goalId: string;
  nativeLanguage: string;
  targetLanguage: string;
  domain: string;
  modality: string[];
  purpose: string;
}

/**
 * Onboarding API for new user setup
 */
export interface OnboardingAPI {
  checkStatus: () => Promise<OnboardingStatus>;
  complete: (data: OnboardingData) => Promise<OnboardingResult>;
  skip: () => Promise<{ userId: string; skipped: boolean }>;
  getUser: () => Promise<{
    id: string;
    nativeLanguage: string;
    targetLanguage: string;
    hasActiveGoal: boolean;
    activeGoal: GoalSpec | null;
  } | null>;
}

/**
 * Corpus source definition
 */
export interface CorpusSourceInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  domains: string[];
  modalities: string[];
  benchmarks: string[];
  reliability: number;
  priority?: number;
}

/**
 * Ranked corpus source with score and reasons
 */
export interface RankedCorpusSource {
  source: CorpusSourceInfo;
  score: number;
  reasons: string[];
}

/**
 * Population result from corpus pipeline
 */
export interface VocabularyPopulationResult {
  success: boolean;
  goalId: string;
  sourcesUsed: string[];
  vocabularyCount: number;
  collocationsCount: number;
  errors: string[];
  duration: number;
}

/**
 * Population status for a goal
 */
export interface PopulationStatus {
  hasVocabulary: boolean;
  vocabularyCount: number;
  lastUpdated: Date | null;
}

/**
 * Corpus sources API
 */
export interface CorpusAPI {
  listSources: () => Promise<{ sources: CorpusSourceInfo[] }>;
  getRecommendedSources: (goalId: string, nlDescription?: string) => Promise<{
    recommended: RankedCorpusSource[];
    defaultSourceIds: string[];
  }>;
  populateVocabulary: (
    goalId: string,
    options?: {
      nlDescription?: string;
      selectedSourceIds?: string[];
      maxSources?: number;
      targetVocabSize?: number;
    }
  ) => Promise<VocabularyPopulationResult>;
  getPopulationStatus: (goalId: string) => Promise<PopulationStatus>;
  clearVocabulary: (goalId: string) => Promise<{ cleared: boolean; deletedCount: number }>;
  uploadDocuments: (
    goalId: string,
    documents: Array<{ filename: string; content: string; mimeType: string }>
  ) => Promise<{ documentsProcessed: number; tokensExtracted: number; vocabularyInserted: number }>;
}

/**
 * Offline queue statistics
 */
export interface OfflineQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  byType: {
    task_generation: number;
    error_analysis: number;
    content_generation: number;
    vocabulary_extraction: number;
  };
}

/**
 * Sync status response
 */
export interface SyncStatus {
  online: boolean;
  pendingItems: number;
  processingItems: number;
  failedItems: number;
  lastSync: string;
}

/**
 * Force sync result
 */
export interface ForceSyncResult {
  processed: number;
  remaining: number;
  failed: number;
}

/**
 * Sync & offline queue management API
 */
export interface SyncAPI {
  getStatus: () => Promise<SyncStatus>;
  forceSync: () => Promise<ForceSyncResult>;
  getQueueSize: () => Promise<{ count: number }>;
  getQueueStats: () => Promise<OfflineQueueStats>;
  clearCompleted: (olderThanHours?: number) => Promise<{ cleared: number }>;
  retryFailed: () => Promise<{ retried: number }>;
  setOnline: (online: boolean) => Promise<{ online: boolean }>;
  checkConnectivity: () => Promise<{ online: boolean }>;
}

/**
 * Structured API exposed to renderer via contextBridge.
 * This provides a clean, organized interface for renderer code.
 */
export interface LogosAPI {
  goal: GoalAPI;
  object: ObjectAPI;
  session: SessionAPI;
  queue: QueueAPI;
  mastery: MasteryAPI;
  analytics: AnalyticsAPI;
  profile: ProfileAPI;
  claude: ClaudeAPI;
  corpus: CorpusAPI;
  sync: SyncAPI;
  onboarding: OnboardingAPI;
  app: AppAPI;
}

/**
 * Low-level IPC invoke function (alternative to structured API)
 */
export type IPCInvokeFn = IPCInvoke;

/**
 * Event subscription interface
 */
export interface LogosEvents {
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

/**
 * Augment Window interface for TypeScript
 */
declare global {
  interface Window {
    logos: LogosAPI;
  }
}

// =============================================================================
// Event Types (Main -> Renderer push notifications)
// =============================================================================

export const IPC_EVENTS = {
  // Session events
  SESSION_TASK_READY: 'event:session:task-ready',
  SESSION_COMPLETED: 'event:session:completed',

  // Sync events
  SYNC_STARTED: 'event:sync:started',
  SYNC_COMPLETED: 'event:sync:completed',
  SYNC_ERROR: 'event:sync:error',

  // Notification events
  REVIEW_REMINDER: 'event:notification:review-reminder',
  GOAL_MILESTONE: 'event:notification:goal-milestone',
  STREAK_UPDATE: 'event:notification:streak-update',

  // System events
  CLAUDE_STATUS_CHANGE: 'event:system:claude-status',
  OFFLINE_MODE_CHANGE: 'event:system:offline-mode',
} as const;

export type IPCEvent = typeof IPC_EVENTS[keyof typeof IPC_EVENTS];

/**
 * Event payload types
 */
export interface IPCEventPayloads {
  [IPC_EVENTS.SESSION_TASK_READY]: {
    sessionId: string;
    task: Task;
  };
  [IPC_EVENTS.SESSION_COMPLETED]: {
    sessionId: string;
    summary: SessionSummary;
  };
  [IPC_EVENTS.SYNC_STARTED]: {
    timestamp: string;
  };
  [IPC_EVENTS.SYNC_COMPLETED]: {
    timestamp: string;
    itemsSynced: number;
  };
  [IPC_EVENTS.SYNC_ERROR]: {
    error: string;
    retryIn: number;
  };
  [IPC_EVENTS.REVIEW_REMINDER]: {
    dueCount: number;
    goalId: string;
  };
  [IPC_EVENTS.GOAL_MILESTONE]: {
    goalId: string;
    milestone: string;
    completionPercent: number;
  };
  [IPC_EVENTS.STREAK_UPDATE]: {
    streakDays: number;
    isNewRecord: boolean;
  };
  [IPC_EVENTS.CLAUDE_STATUS_CHANGE]: {
    available: boolean;
    reason?: string;
  };
  [IPC_EVENTS.OFFLINE_MODE_CHANGE]: {
    isOffline: boolean;
  };
}
