/**
 * Offline Queue Service
 *
 * Manages a queue of operations that require network access (Claude API calls).
 * When offline, operations are queued and processed when connectivity returns.
 *
 * Supports:
 * - Task generation queue
 * - Error analysis queue
 * - Content generation queue
 * - Automatic retry with exponential backoff
 */

import { getPrisma } from '../db/prisma';
import { getClaudeService } from './claude.service';

// =============================================================================
// Types
// =============================================================================

export type QueueItemType = 'task_generation' | 'error_analysis' | 'content_generation' | 'vocabulary_extraction';

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  type: QueueItemType;
  payload: Record<string, unknown>;
  status: QueueItemStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
  result?: Record<string, unknown>;
}

export interface OfflineQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  byType: Record<QueueItemType, number>;
}

// =============================================================================
// In-Memory Queue (persisted to SQLite)
// =============================================================================

class OfflineQueueService {
  private isOnline: boolean = true;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private checkInterval: number = 30000; // 30 seconds
  private maxConcurrent: number = 3;
  private lastSyncTime: Date | null = null;
  private lastSyncSuccess: boolean = false;
  private lastSyncItemCount: number = 0;

  constructor() {
    // Start periodic processing
    this.startProcessing();
  }

  /**
   * Get the last sync time and status.
   */
  getLastSyncInfo(): { lastSync: Date | null; success: boolean; itemCount: number } {
    return {
      lastSync: this.lastSyncTime,
      success: this.lastSyncSuccess,
      itemCount: this.lastSyncItemCount,
    };
  }

  // ===========================================================================
  // Queue Management
  // ===========================================================================

  /**
   * Add an item to the offline queue.
   */
  async enqueue(
    type: QueueItemType,
    payload: Record<string, unknown>,
    maxRetries: number = 3
  ): Promise<string> {
    const db = getPrisma();

    const item = await db.offlineQueueItem.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: 'pending',
        retryCount: 0,
        maxRetries,
      },
    });

    // Try immediate processing if online
    if (this.isOnline) {
      this.processQueue();
    }

    return item.id;
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<OfflineQueueStats> {
    const db = getPrisma();

    const items = await db.offlineQueueItem.groupBy({
      by: ['status', 'type'],
      _count: true,
    });

    const stats: OfflineQueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
      byType: {
        task_generation: 0,
        error_analysis: 0,
        content_generation: 0,
        vocabulary_extraction: 0,
      },
    };

    for (const item of items) {
      const count = item._count;
      stats[item.status as keyof Omit<OfflineQueueStats, 'total' | 'byType'>] += count;
      stats.total += count;
      stats.byType[item.type as QueueItemType] += count;
    }

    return stats;
  }

  /**
   * Get pending items count.
   */
  async getPendingCount(): Promise<number> {
    const db = getPrisma();
    return db.offlineQueueItem.count({
      where: { status: 'pending' },
    });
  }

  /**
   * Clear completed items older than the specified age.
   */
  async clearCompleted(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const db = getPrisma();
    const cutoff = new Date(Date.now() - olderThanMs);

    const result = await db.offlineQueueItem.deleteMany({
      where: {
        status: 'completed',
        processedAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Retry failed items that haven't exceeded max retries.
   */
  async retryFailed(): Promise<number> {
    const db = getPrisma();

    // Get failed items that can be retried
    const failedItems = await db.offlineQueueItem.findMany({
      where: { status: 'failed' },
      select: { id: true, retryCount: true, maxRetries: true },
    });

    // Filter items where retryCount < maxRetries
    const retryableIds = failedItems
      .filter((item) => item.retryCount < item.maxRetries)
      .map((item) => item.id);

    if (retryableIds.length === 0) {
      return 0;
    }

    const result = await db.offlineQueueItem.updateMany({
      where: { id: { in: retryableIds } },
      data: {
        status: 'pending',
        error: null,
      },
    });

    return result.count;
  }

  // ===========================================================================
  // Online/Offline Status
  // ===========================================================================

  /**
   * Set online status.
   */
  setOnline(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    // If coming back online, process queue
    if (wasOffline && online) {
      this.processQueue();
    }
  }

  /**
   * Check if currently online.
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Check Claude API connectivity.
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const claude = getClaudeService();
      const status = await claude.checkStatus();
      this.isOnline = status.online;
      return status.online;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  // ===========================================================================
  // Queue Processing
  // ===========================================================================

  /**
   * Start periodic queue processing.
   */
  startProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      if (this.isOnline) {
        this.processQueue();
      }
    }, this.checkInterval);

    // Initial processing
    this.processQueue();
  }

  /**
   * Stop periodic queue processing.
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process pending queue items.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline) return;

    this.isProcessing = true;

    try {
      const db = getPrisma();

      // Get pending items
      const items = await db.offlineQueueItem.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: this.maxConcurrent,
      });

      if (items.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Mark as processing
      await db.offlineQueueItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { status: 'processing' },
      });

      // Process each item
      const results = await Promise.allSettled(
        items.map((item) => this.processItem(item))
      );

      // Update statuses based on results
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
          await db.offlineQueueItem.update({
            where: { id: item.id },
            data: {
              status: 'completed',
              processedAt: new Date(),
              result: result.value ? JSON.stringify(result.value) : null,
            },
          });
          successCount++;
        } else {
          const newRetryCount = item.retryCount + 1;
          const shouldFail = newRetryCount >= item.maxRetries;

          await db.offlineQueueItem.update({
            where: { id: item.id },
            data: {
              status: shouldFail ? 'failed' : 'pending',
              retryCount: newRetryCount,
              error: result.reason?.message || 'Unknown error',
            },
          });
          failCount++;
        }
      }

      // Update sync tracking info
      this.lastSyncTime = new Date();
      this.lastSyncSuccess = failCount === 0;
      this.lastSyncItemCount = successCount;
    } catch (err) {
      console.error('Queue processing error:', err);
      // Track failed sync attempt
      this.lastSyncTime = new Date();
      this.lastSyncSuccess = false;
      this.lastSyncItemCount = 0;
    } finally {
      this.isProcessing = false;

      // Check for more items
      const remaining = await this.getPendingCount();
      if (remaining > 0 && this.isOnline) {
        // Schedule next batch with small delay
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * Process a single queue item.
   */
  private async processItem(item: {
    id: string;
    type: string;
    payload: string;
  }): Promise<Record<string, unknown> | null> {
    const payload = JSON.parse(item.payload);
    const claude = getClaudeService();

    switch (item.type) {
      case 'task_generation':
        return this.processTaskGeneration(payload);

      case 'error_analysis':
        const analysis = await claude.analyzeError({
          content: payload.content,
          userResponse: payload.userResponse,
          expectedResponse: payload.expectedResponse,
          targetLanguage: payload.targetLanguage,
          nativeLanguage: payload.nativeLanguage,
        });
        return analysis as unknown as Record<string, unknown>;

      case 'content_generation':
        const content = await claude.generateContent({
          type: payload.type,
          content: payload.content,
          targetLanguage: payload.targetLanguage,
          nativeLanguage: payload.nativeLanguage,
          context: payload.context,
          difficulty: payload.difficulty,
        });
        return content as unknown as Record<string, unknown>;

      case 'vocabulary_extraction':
        // Claude vocabulary extraction is handled by corpus pipeline
        return null;

      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }

  /**
   * Process task generation request.
   */
  private async processTaskGeneration(
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const claude = getClaudeService();

    const content = await claude.generateContent({
      type: 'exercise',
      content: payload.content as string,
      targetLanguage: payload.targetLanguage as string,
      nativeLanguage: payload.nativeLanguage as string,
      difficulty: payload.difficulty as number,
    });

    // Store in cache
    const db = getPrisma();
    await db.cachedTask.upsert({
      where: {
        objectId_taskType_taskFormat: {
          objectId: payload.objectId as string,
          taskType: payload.taskType as string,
          taskFormat: payload.taskFormat as string,
        },
      },
      create: {
        objectId: payload.objectId as string,
        taskType: payload.taskType as string,
        taskFormat: payload.taskFormat as string,
        taskContent: JSON.stringify(content),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        taskContent: JSON.stringify(content),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return content as unknown as Record<string, unknown>;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let serviceInstance: OfflineQueueService | null = null;

/**
 * Get the offline queue service instance.
 */
export function getOfflineQueueService(): OfflineQueueService {
  if (!serviceInstance) {
    serviceInstance = new OfflineQueueService();
  }
  return serviceInstance;
}

/**
 * Reset the service instance (for testing).
 */
export function resetOfflineQueueService(): void {
  if (serviceInstance) {
    serviceInstance.stopProcessing();
  }
  serviceInstance = null;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Queue a task generation request.
 */
export async function queueTaskGeneration(
  objectId: string,
  content: string,
  targetLanguage: string,
  nativeLanguage: string,
  taskType: string,
  taskFormat: string,
  difficulty: number
): Promise<string> {
  const service = getOfflineQueueService();
  return service.enqueue('task_generation', {
    objectId,
    content,
    targetLanguage,
    nativeLanguage,
    taskType,
    taskFormat,
    difficulty,
  });
}

/**
 * Queue an error analysis request.
 */
export async function queueErrorAnalysis(
  content: string,
  userResponse: string,
  expectedResponse: string,
  targetLanguage: string,
  nativeLanguage: string
): Promise<string> {
  const service = getOfflineQueueService();
  return service.enqueue('error_analysis', {
    content,
    userResponse,
    expectedResponse,
    targetLanguage,
    nativeLanguage,
  });
}

/**
 * Queue a content generation request.
 */
export async function queueContentGeneration(
  type: 'exercise' | 'explanation' | 'example',
  content: string,
  targetLanguage: string,
  nativeLanguage: string,
  context?: string,
  difficulty?: number
): Promise<string> {
  const service = getOfflineQueueService();
  return service.enqueue('content_generation', {
    type,
    content,
    targetLanguage,
    nativeLanguage,
    context,
    difficulty,
  });
}
