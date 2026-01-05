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

// Re-export core types that are used in IPC messages
export type {
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
 * API exposed to renderer via contextBridge
 */
export interface LogosAPI {
  /**
   * Invoke an IPC handler and get typed response
   */
  invoke: IPCInvoke;

  /**
   * Subscribe to IPC events (for push notifications from main)
   */
  on: (channel: string, callback: (...args: unknown[]) => void) => void;

  /**
   * Unsubscribe from IPC events
   */
  off: (channel: string, callback: (...args: unknown[]) => void) => void;

  /**
   * Platform information
   */
  platform: NodeJS.Platform;

  /**
   * App version
   */
  version: string;
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
