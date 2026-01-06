/**
 * Preload Script
 *
 * Exposes a safe, limited API to the renderer process via contextBridge.
 * This is the ONLY way the renderer can communicate with the main process.
 *
 * Security: All IPC calls go through ipcRenderer.invoke() which is async
 * and prevents direct access to Node.js APIs from the renderer.
 *
 * Handler Channels (from IPC handlers):
 * - session:start, session:end, session:get-state, session:get-next-task,
 *   session:get-summary, session:submit-response, session:list
 * - analytics:get-progress, analytics:get-bottlenecks, analytics:get-history
 * - goal:create, goal:get, goal:list, goal:update, goal:delete
 * - object:create, object:get, object:list, object:update, object:delete,
 *   object:import, object:search, object:get-collocations, object:get-mastery
 * - queue:get, queue:refresh
 * - claude:generateContent, claude:analyzeError, claude:getHint, claude:getBottlenecks
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { LogosAPI } from '../shared/types';

/**
 * Type-safe IPC invoke wrapper.
 */
async function invoke<T>(channel: string, request?: unknown): Promise<T> {
  const response = await ipcRenderer.invoke(channel, request);
  if (!response.success) {
    throw new Error(response.error || 'Unknown error');
  }
  return response.data as T;
}

/**
 * LOGOS API exposed to renderer process.
 */
const logosAPI: LogosAPI = {
  // ============================================================================
  // Goal Management
  // ============================================================================

  goal: {
    create: (data) => invoke('goal:create', data),
    get: (id) => invoke('goal:get', { id }),
    list: (includeInactive) => invoke('goal:list', { activeOnly: !includeInactive }),
    update: (data) => invoke('goal:update', { id: data.id, updates: data }),
    delete: (id, _hard) => invoke('goal:delete', { id }),
  },

  // ============================================================================
  // Learning Object Management
  // ============================================================================

  object: {
    create: (data) => invoke('object:create', data),
    get: (id) => invoke('object:get', { id }),
    list: (goalId, options) => invoke('object:list', { goalId, ...options }),
    update: (data) => invoke('object:update', data),
    delete: (id) => invoke('object:delete', { id }),
    import: (goalId, objects) => invoke('object:import', { goalId, objects }),
  },

  // ============================================================================
  // Session Management
  // Handler channels: session:start, session:end, session:get-state,
  // session:get-next-task, session:get-summary, session:submit-response, session:list
  // ============================================================================

  session: {
    // session:start expects { goalId, mode, maxItems?, targetDurationMinutes?, focusComponents? }
    start: (goalId, sessionType, targetDuration) =>
      invoke('session:start', {
        goalId,
        mode: sessionType, // API uses 'mode', not 'sessionType'
        targetDurationMinutes: targetDuration,
      }),

    // session:end expects { sessionId }
    end: (sessionId) => invoke('session:end', { sessionId }),

    // session:get-state expects { sessionId } - use goalId to find active session
    // Note: Handler expects sessionId, but interface uses goalId
    // This requires finding the active session first or adjusting the handler
    getCurrent: async (goalId) => {
      // Get list of sessions and find the active one
      const sessions = await invoke<Array<{ id: string; endedAt: Date | null }>>('session:list', {
        goalId,
        limit: 1,
      });
      const activeSession = sessions.find((s) => s.endedAt === null);
      if (!activeSession) return null;
      return invoke('session:get-state', { sessionId: activeSession.id });
    },

    // session:submit-response expects { sessionId, objectId, correct, cueLevel, responseTimeMs, ... }
    recordResponse: (data) =>
      invoke('session:submit-response', {
        sessionId: data.sessionId,
        objectId: data.objectId,
        correct: data.correct,
        cueLevel: data.cueLevel,
        responseTimeMs: data.responseTimeMs,
        errorComponents: data.errorComponents,
      }),

    // session:list expects { goalId, limit?, offset? }
    getHistory: (goalId, options) =>
      invoke('session:list', { goalId, ...options }),
  },

  // ============================================================================
  // Queue Management
  // Handler channels: queue:get, queue:refresh
  // ============================================================================

  queue: {
    // queue:get expects { goalId, sessionSize?, newItemRatio? }
    build: (goalId, options) =>
      invoke('queue:get', {
        goalId,
        sessionSize: options?.sessionSize,
        newItemRatio: options?.newItemRatio,
      }),

    // Get next item from queue - use queue:get and return first item
    getNext: async (goalId, excludeIds) => {
      const queue = await invoke<Array<{ object: { id: string } }>>('queue:get', {
        goalId,
        sessionSize: 10,
      });
      const filtered = excludeIds
        ? queue.filter((item) => !excludeIds.includes(item.object.id))
        : queue;
      return filtered.length > 0 ? filtered[0] : null;
    },

    // queue:refresh expects { goalId }
    refresh: async (goalId) => {
      await invoke('queue:refresh', { goalId });
      // Return updated queue
      return invoke('queue:get', { goalId });
    },
  },

  // ============================================================================
  // Mastery Management
  // Handler channel: object:get-mastery
  // ============================================================================

  mastery: {
    // object:get-mastery expects { objectId }
    get: (objectId) => invoke('object:get-mastery', { objectId }),

    // Calculate stats from objects list
    getStats: async (goalId) => {
      const objects = await invoke<
        Array<{ mastery?: { stage: number; cueFreeAccuracy: number } }>
      >('object:list', { goalId, limit: 1000 });

      const distribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      let totalRetention = 0;
      let masteryCount = 0;

      for (const obj of objects) {
        const stage = obj.mastery?.stage ?? 0;
        distribution[stage] = (distribution[stage] || 0) + 1;
        if (obj.mastery) {
          totalRetention += obj.mastery.cueFreeAccuracy;
          masteryCount++;
        }
      }

      return {
        distribution,
        averageRetention: masteryCount > 0 ? totalRetention / masteryCount : 0,
      };
    },
  },

  // ============================================================================
  // Analytics
  // Handler channels: analytics:get-progress, analytics:get-bottlenecks, analytics:get-history
  // ============================================================================

  analytics: {
    // analytics:get-progress expects { goalId, timeRange? }
    getProgress: (goalId, timeRange) =>
      invoke('analytics:get-progress', { goalId, timeRange }),

    // analytics:get-bottlenecks expects { goalId, minResponses? }
    getBottlenecks: (goalId, minResponses) =>
      invoke('analytics:get-bottlenecks', { goalId, minResponses }),

    // analytics:get-history expects { goalId, days? }
    getSessionStats: (goalId, days) =>
      invoke('analytics:get-history', { goalId, days }),
  },

  // ============================================================================
  // User Profile
  // Note: These handlers may not exist yet - implement graceful fallbacks
  // ============================================================================

  profile: {
    get: () =>
      invoke('profile:get', {}).catch(() => ({
        id: 'default',
        email: 'default@logos.local',
        name: 'Default User',
      })),
    update: (data) =>
      invoke('profile:update', data).catch(() => data),
    getSettings: () =>
      invoke('profile:getSettings', {}).catch(() => ({
        dailyGoalMinutes: 30,
        sessionLength: 20,
        notificationsEnabled: true,
        soundEnabled: true,
        theme: 'system' as const,
        targetRetention: 0.9,
      })),
    updateSettings: (settings) =>
      invoke('profile:updateSettings', settings).catch(() => settings),
  },

  // ============================================================================
  // Claude Integration
  // Handler channels: claude:generateContent, claude:analyzeError, claude:getHint, claude:getBottlenecks
  // ============================================================================

  claude: {
    // claude:generateContent expects { type, objectId, context? }
    generateContent: (type, objectId, context) =>
      invoke('claude:generateContent', { type, objectId, context }),

    // claude:analyzeError expects { objectId, userResponse, expectedResponse, responseId? }
    analyzeError: (objectId, userResponse, expectedResponse, responseId) =>
      invoke('claude:analyzeError', { objectId, userResponse, expectedResponse, responseId }),

    // claude:getHint expects { objectId, hintLevel, previousHints? }
    getHint: (objectId, hintLevel, previousHints) =>
      invoke('claude:getHint', { objectId, hintLevel, previousHints }),

    // claude:getBottlenecks expects { userId?, goalId?, limit? }
    getBottlenecks: (goalId, limit) =>
      invoke('claude:getBottlenecks', { goalId, limit }),
  },

  // ============================================================================
  // Corpus Sources
  // Handler channels: goal:list-sources, goal:get-recommended-sources,
  // goal:populate-vocabulary, goal:get-population-status, goal:clear-vocabulary, goal:upload-corpus
  // ============================================================================

  corpus: {
    // goal:list-sources - get all available corpus sources
    listSources: () => invoke('goal:list-sources', {}),

    // goal:get-recommended-sources - get recommended sources for a goal
    getRecommendedSources: (goalId: string, nlDescription?: string) =>
      invoke('goal:get-recommended-sources', { goalId, nlDescription }),

    // goal:populate-vocabulary - populate vocabulary from corpus sources
    populateVocabulary: (
      goalId: string,
      options?: {
        nlDescription?: string;
        selectedSourceIds?: string[];
        maxSources?: number;
        targetVocabSize?: number;
      }
    ) => invoke('goal:populate-vocabulary', { goalId, ...options }),

    // goal:get-population-status - get vocabulary population status
    getPopulationStatus: (goalId: string) =>
      invoke('goal:get-population-status', { goalId }),

    // goal:clear-vocabulary - clear vocabulary for repopulation
    clearVocabulary: (goalId: string) =>
      invoke('goal:clear-vocabulary', { goalId }),

    // goal:upload-corpus - upload documents for vocabulary extraction
    uploadDocuments: (
      goalId: string,
      documents: Array<{ filename: string; content: string; mimeType: string }>
    ) => invoke('goal:upload-corpus', { goalId, documents }),
  },

  // ============================================================================
  // Sync & Offline Queue
  // Handler channels: sync:status, sync:force, offline:queue-size,
  // sync:queue-stats, sync:clear-completed, sync:retry-failed,
  // sync:set-online, sync:check-connectivity
  // ============================================================================

  sync: {
    // sync:status - get current sync/connectivity status
    getStatus: () => invoke('sync:status', {}),

    // sync:force - force sync of all pending queue items
    forceSync: () => invoke('sync:force', {}),

    // offline:queue-size - get number of pending queue items
    getQueueSize: () => invoke('offline:queue-size', {}),

    // sync:queue-stats - get detailed queue statistics
    getQueueStats: () => invoke('sync:queue-stats', {}),

    // sync:clear-completed - clear completed queue items
    clearCompleted: (olderThanHours?: number) =>
      invoke('sync:clear-completed', { olderThanHours }),

    // sync:retry-failed - retry failed queue items
    retryFailed: () => invoke('sync:retry-failed', {}),

    // sync:set-online - manually set online/offline status
    setOnline: (online: boolean) => invoke('sync:set-online', { online }),

    // sync:check-connectivity - check Claude API connectivity
    checkConnectivity: () => invoke('sync:check-connectivity', {}),
  },

  // ============================================================================
  // Onboarding
  // Handler channels: onboarding:check-status, onboarding:complete, onboarding:skip
  // ============================================================================

  onboarding: {
    // onboarding:check-status - check if user needs onboarding
    checkStatus: () => invoke('onboarding:check-status', {}),

    // onboarding:complete - complete onboarding with user data
    complete: (data: {
      nativeLanguage: string;
      targetLanguage: string;
      domain: string;
      modality: string[];
      purpose: string;
      benchmark?: string;
      deadline?: string;
      dailyTime: number;
    }) => invoke('onboarding:complete', data),

    // onboarding:skip - skip onboarding (create minimal user)
    skip: () => invoke('onboarding:skip', {}),

    // onboarding:get-user - get current user for resume/edit
    getUser: () => invoke('onboarding:get-user', {}),
  },

  // ============================================================================
  // App Info
  // ============================================================================

  app: {
    getVersion: () =>
      invoke<string>('app:getVersion', {}).catch(() => '1.0.0'),
    getPlatform: () => process.platform,
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('logos', logosAPI);

// Type declaration for renderer access
declare global {
  interface Window {
    logos: LogosAPI;
  }
}
