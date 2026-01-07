/**
 * IPC Contracts Module
 *
 * Type-safe IPC channel definitions and handler contracts.
 * This module bridges the renderer and main process with full type safety.
 *
 * Architecture: src/shared/types.ts defines the types, this module defines
 * the runtime contracts and validation.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type {
  IPCHandlerMap,
  GoalSpec,
  LanguageObject,
  SessionState,
  SessionSummary,
  MasteryState,
  LearningQueueItem,
  User,
  UserThetaProfile,
  BottleneckAnalysis,
  ComponentType,
  Domain,
  Modality,
} from '../../shared/types';

// ============================================================================
// Channel Constants (Runtime)
// ============================================================================

/**
 * All IPC channel names as runtime constants.
 * Synchronized with IPC_CHANNELS from shared/types.ts
 */
export const CHANNELS = {
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

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Generic IPC response wrapper.
 */
export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * IPC handler function signature.
 */
export type IPCHandler<TRequest, TResponse> = (
  event: IpcMainInvokeEvent,
  request: TRequest
) => Promise<IPCResponse<TResponse>>;

/**
 * Handler registry type for type-safe handler registration.
 */
export type HandlerRegistry = {
  [K in keyof typeof CHANNELS]?: IPCHandler<unknown, unknown>;
};

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register a type-safe IPC handler.
 *
 * @param channel - The IPC channel name
 * @param handler - The async handler function
 */
export function registerHandler<TChannel extends keyof IPCHandlerMap>(
  channel: TChannel,
  handler: (
    event: IpcMainInvokeEvent,
    request: IPCHandlerMap[TChannel]['request']
  ) => Promise<IPCResponse<IPCHandlerMap[TChannel]['response']> | IPCResponse<unknown>>
): void {
  ipcMain.handle(channel, async (event, request) => {
    try {
      return await handler(event, request);
    } catch (error) {
      console.error(`IPC Error [${channel}]:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}

/**
 * Register an IPC handler with dynamic typing (for channels not in IPCHandlerMap).
 */
export function registerDynamicHandler(
  channel: string,
  handler: (
    event: IpcMainInvokeEvent,
    request: any
  ) => Promise<IPCResponse<any>>
): void {
  ipcMain.handle(channel, async (event, request) => {
    try {
      return await handler(event, request);
    } catch (error) {
      console.error(`IPC Error [${channel}]:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}

/**
 * Unregister an IPC handler.
 */
export function unregisterHandler(channel: string): void {
  ipcMain.removeHandler(channel);
}

/**
 * Create a success response.
 */
export function success<T>(data: T): IPCResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response.
 */
export function error<T>(message: string): IPCResponse<T> {
  return { success: false, error: message };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate required fields in a request object.
 */
export function validateRequired<T extends object>(
  request: T,
  fields: (keyof T)[]
): string | null {
  for (const field of fields) {
    if (request[field] === undefined || request[field] === null) {
      return `Missing required field: ${String(field)}`;
    }
  }
  return null;
}

/**
 * Validate string field is non-empty.
 */
export function validateNonEmpty(value: unknown, fieldName: string): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `${fieldName} must be a non-empty string`;
  }
  return null;
}

/**
 * Validate number is within range.
 */
export function validateRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): string | null {
  if (typeof value !== 'number' || value < min || value > max) {
    return `${fieldName} must be a number between ${min} and ${max}`;
  }
  return null;
}

/**
 * Validate UUID format.
 */
export function validateUUID(value: unknown, fieldName: string): string | null {
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

// ============================================================================
// Request/Response Type Definitions
// ============================================================================

// Goal Requests
export interface CreateGoalRequest {
  name: string;
  targetLanguage: string;
  nativeLanguage: string;
  description?: string;
  targetLevel?: number;
}

export interface UpdateGoalRequest {
  id: string;
  name?: string;
  description?: string;
  targetLevel?: number;
  isActive?: boolean;
}

// Session Requests
export interface StartSessionRequest {
  goalId: string;
  sessionType: 'learn' | 'review' | 'mixed';
  targetDuration?: number; // minutes
}

export interface RecordResponseRequest {
  sessionId: string;
  objectId: string;
  correct: boolean;
  cueLevel: 0 | 1 | 2 | 3;
  responseTimeMs: number;
  errorComponents?: string[];
}

// Queue Requests
export interface BuildQueueRequest {
  goalId: string;
  sessionSize?: number;
  newItemRatio?: number;
}

// Analytics Requests
export interface GetProgressRequest {
  goalId: string;
  timeRange?: 'day' | 'week' | 'month' | 'all';
}

export interface GetBottlenecksRequest {
  goalId: string;
  minResponses?: number;
}

// Claude Requests
export interface GenerateContentRequest {
  type: 'exercise' | 'explanation' | 'example';
  objectId: string;
  context?: string;
}

export interface AnalyzeErrorRequest {
  objectId: string;
  userResponse: string;
  expectedResponse: string;
}

export interface GetHintRequest {
  objectId: string;
  hintLevel: 1 | 2 | 3;
  previousHints?: string[];
}
