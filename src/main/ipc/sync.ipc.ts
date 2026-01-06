/**
 * Sync & Offline Queue IPC Handlers
 *
 * Handles connectivity status, offline queue management, and sync operations.
 */

import { registerDynamicHandler, unregisterHandler, success, error, CHANNELS } from './contracts';
import {
  getOfflineQueueService,
} from '../services/offline-queue.service';

// Track registered handlers for cleanup
const registeredChannels: string[] = [];

/**
 * Register all sync-related IPC handlers.
 */
export function registerSyncHandlers(): void {
  // ===========================================================================
  // Sync Status
  // ===========================================================================

  /**
   * Get current sync/connectivity status.
   */
  registerDynamicHandler(CHANNELS.SYNC_STATUS, async () => {
    try {
      const queueService = getOfflineQueueService();
      const stats = await queueService.getStats();
      const isOnline = queueService.getOnlineStatus();
      const syncInfo = queueService.getLastSyncInfo();

      return success({
        online: isOnline,
        pendingItems: stats.pending,
        processingItems: stats.processing,
        failedItems: stats.failed,
        lastSync: syncInfo.lastSync?.toISOString() ?? null,
        lastSyncSuccess: syncInfo.success,
        lastSyncItemCount: syncInfo.itemCount,
      });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to get sync status');
    }
  });
  registeredChannels.push(CHANNELS.SYNC_STATUS);

  /**
   * Force sync - process all pending queue items.
   */
  registerDynamicHandler(CHANNELS.SYNC_FORCE, async () => {
    try {
      const queueService = getOfflineQueueService();

      // Check connectivity first
      const isOnline = await queueService.checkConnectivity();
      if (!isOnline) {
        return error('Cannot sync: No connectivity to Claude API');
      }

      // Trigger queue processing
      await queueService.processQueue();

      // Return updated stats
      const stats = await queueService.getStats();
      return success({
        processed: stats.completed,
        remaining: stats.pending,
        failed: stats.failed,
      });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Sync failed');
    }
  });
  registeredChannels.push(CHANNELS.SYNC_FORCE);

  /**
   * Get offline queue size.
   */
  registerDynamicHandler(CHANNELS.OFFLINE_QUEUE_SIZE, async () => {
    try {
      const queueService = getOfflineQueueService();
      const count = await queueService.getPendingCount();
      return success({ count });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to get queue size');
    }
  });
  registeredChannels.push(CHANNELS.OFFLINE_QUEUE_SIZE);

  // ===========================================================================
  // Queue Management (Additional handlers)
  // ===========================================================================

  /**
   * Get detailed queue statistics.
   */
  registerDynamicHandler('sync:queue-stats', async () => {
    try {
      const queueService = getOfflineQueueService();
      const stats = await queueService.getStats();
      return success(stats);
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to get queue stats');
    }
  });
  registeredChannels.push('sync:queue-stats');

  /**
   * Clear completed queue items.
   */
  registerDynamicHandler('sync:clear-completed', async (_event, request: { olderThanHours?: number }) => {
    try {
      // Validate input: olderThanHours must be 0-8760 (max 1 year)
      if (request.olderThanHours !== undefined) {
        if (typeof request.olderThanHours !== 'number' ||
            request.olderThanHours < 0 ||
            request.olderThanHours > 8760) {
          return error('olderThanHours must be a number between 0 and 8760');
        }
      }

      const queueService = getOfflineQueueService();
      const olderThanMs = (request.olderThanHours || 24) * 60 * 60 * 1000;
      const cleared = await queueService.clearCompleted(olderThanMs);
      return success({ cleared });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to clear queue');
    }
  });
  registeredChannels.push('sync:clear-completed');

  /**
   * Retry failed queue items.
   */
  registerDynamicHandler('sync:retry-failed', async () => {
    try {
      const queueService = getOfflineQueueService();
      const retried = await queueService.retryFailed();
      return success({ retried });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to retry items');
    }
  });
  registeredChannels.push('sync:retry-failed');

  /**
   * Set online/offline status manually (for testing or user override).
   */
  registerDynamicHandler('sync:set-online', async (_event, request: { online: boolean }) => {
    try {
      // Validate input: online must be a boolean
      if (typeof request.online !== 'boolean') {
        return error('online must be a boolean value');
      }

      const queueService = getOfflineQueueService();
      queueService.setOnline(request.online);
      return success({ online: request.online });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Failed to set online status');
    }
  });
  registeredChannels.push('sync:set-online');

  /**
   * Check Claude API connectivity.
   */
  registerDynamicHandler('sync:check-connectivity', async () => {
    try {
      const queueService = getOfflineQueueService();
      const online = await queueService.checkConnectivity();
      return success({ online });
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Connectivity check failed');
    }
  });
  registeredChannels.push('sync:check-connectivity');
}

/**
 * Unregister all sync-related IPC handlers.
 */
export function unregisterSyncHandlers(): void {
  for (const channel of registeredChannels) {
    unregisterHandler(channel);
  }
  registeredChannels.length = 0;
}
