/**
 * Learning Object IPC Handlers
 *
 * Handles all learning object and queue-related IPC communication.
 * Learning objects are the atomic units of learning (words, phrases, grammar).
 */

import { registerHandler, success, error, validateUUID } from './contracts';
import { prisma } from '../db/client';
import {
  validateInput,
  QueueGetSchema,
  ObjectCreateSchema,
  ObjectUpdateSchema,
  ObjectListSchema,
  ObjectImportSchema,
  ObjectSearchSchema,
} from '../../shared/schemas/ipc-schemas';
import { buildLearningQueue, getSessionItems, inferLevel, getWeightsForLevel } from '../../core/priority';
import type { LanguageObject, UserState, MasteryInfo, QueueItem } from '../../core/priority';
import {
  getOrGenerateTaskWithMatching,
  type GeneratedTask,
  type EnhancedTaskGenerationConfig,
} from '../services/task-generation.service';
import type { LearningQueueItem } from '../services/state-priority.service';

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all learning object IPC handlers.
 */
export function registerLearningHandlers(): void {
  // Create a learning object
  registerHandler('object:create', async (_event, request) => {
    const validation = validateInput(ObjectCreateSchema, request);
    if (!validation.success) {
      return error(validation.error);
    }

    const { goalId, content, type, frequency, relationalDensity, contextualContribution, irtDifficulty, metadata } = validation.data;

    try {
      const object = await prisma.languageObject.create({
        data: {
          goalId,
          content: content.trim(),
          type: type.trim(),
          frequency: frequency ?? 0.5,
          relationalDensity: relationalDensity ?? 0.5,
          contextualContribution: contextualContribution ?? 0.5,
          irtDifficulty: irtDifficulty ?? 0,
          contentJson: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return success(mapObjectToResponse(object));
    } catch (err) {
      console.error('Failed to create learning object:', err);
      return error('Failed to create learning object');
    }
  });

  // Get a single learning object
  registerHandler('object:get', async (_event, request) => {
    const { id } = request as { id: string };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    try {
      const object = await prisma.languageObject.findUnique({
        where: { id },
        include: { masteryState: true },
      });

      if (!object) {
        return error('Learning object not found');
      }

      return success(mapObjectToResponse(object));
    } catch (err) {
      console.error('Failed to get learning object:', err);
      return error('Failed to get learning object');
    }
  });

  // List learning objects for a goal
  registerHandler('object:list', async (_event, request) => {
    const validation = validateInput(ObjectListSchema, request);
    if (!validation.success) {
      return error(validation.error);
    }

    const { goalId, type, limit, offset } = validation.data;

    try {
      const objects = await prisma.languageObject.findMany({
        where: {
          goalId,
          ...(type ? { type } : {}),
        },
        include: { masteryState: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      return success(objects.map(mapObjectToResponse));
    } catch (err) {
      console.error('Failed to list learning objects:', err);
      return error('Failed to list learning objects');
    }
  });

  // Update a learning object
  registerHandler('object:update', async (_event, request) => {
    const validation = validateInput(ObjectUpdateSchema, request);
    if (!validation.success) {
      return error(validation.error);
    }

    const { id, content, translation, frequency, relationalDensity, contextualContribution, irtDifficulty, metadata } = validation.data;

    const updateData: Record<string, unknown> = {};
    if (content !== undefined) updateData.content = content.trim();
    if (translation !== undefined) updateData.translation = translation?.trim() || null;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (relationalDensity !== undefined) updateData.relationalDensity = relationalDensity;
    if (contextualContribution !== undefined) updateData.contextualContribution = contextualContribution;
    if (irtDifficulty !== undefined) updateData.irtDifficulty = irtDifficulty;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

    try {
      const object = await prisma.languageObject.update({
        where: { id },
        data: updateData,
      });

      return success(mapObjectToResponse(object));
    } catch (err) {
      console.error('Failed to update learning object:', err);
      return error('Failed to update learning object');
    }
  });

  // Delete a learning object
  registerHandler('object:delete', async (_event, request) => {
    const { id } = request as { id: string };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    try {
      await prisma.languageObject.delete({
        where: { id },
      });

      return success({ deleted: true });
    } catch (err) {
      console.error('Failed to delete learning object:', err);
      return error('Failed to delete learning object');
    }
  });

  // Bulk import learning objects
  registerHandler('object:import', async (_event, request) => {
    const validation = validateInput(ObjectImportSchema, request);
    if (!validation.success) {
      return error(validation.error);
    }

    const { goalId, objects } = validation.data;

    try {
      const created = await prisma.languageObject.createMany({
        data: objects.map(obj => ({
          goalId,
          content: obj.content.trim(),
          type: obj.type.trim(),
          frequency: obj.frequency ?? 0.5,
          relationalDensity: obj.relationalDensity ?? 0.5,
          contextualContribution: obj.contextualContribution ?? 0.5,
          irtDifficulty: obj.irtDifficulty ?? 0,
        })),
      });

      return success({ imported: created.count });
    } catch (err) {
      console.error('Failed to import learning objects:', err);
      return error('Failed to import learning objects');
    }
  });

  // Get learning queue
  registerHandler('queue:get', async (_event, request) => {
    const validation = validateInput(QueueGetSchema, request);
    if (!validation.success) {
      return error(validation.error);
    }

    const { goalId, sessionSize, newItemRatio } = validation.data;

    try {
      // Get user profile for theta
      const user = await prisma.user.findFirst();
      const theta = user?.thetaGlobal ?? 0;

      // Get all objects with mastery
      const objects = await prisma.languageObject.findMany({
        where: { goalId },
        include: { masteryState: true },
      });

      // Convert to core types
      const languageObjects: LanguageObject[] = objects.map(obj => ({
        id: obj.id,
        content: obj.content,
        type: obj.type,
        frequency: obj.frequency,
        relationalDensity: obj.relationalDensity,
        contextualContribution: obj.contextualContribution,
        irtDifficulty: obj.irtDifficulty,
      }));

      // Build mastery map
      const masteryMap = new Map<string, MasteryInfo>();
      for (const obj of objects) {
        if (obj.masteryState) {
          masteryMap.set(obj.id, {
            stage: obj.masteryState.stage,
            nextReview: obj.masteryState.nextReview,
            cueFreeAccuracy: obj.masteryState.cueFreeAccuracy,
          });
        }
      }

      // Build user state
      const level = inferLevel(theta);
      const userState: UserState = {
        theta,
        weights: getWeightsForLevel(level),
        l1Language: user?.nativeLanguage || undefined,
      };

      // Build and get session items
      const queue = buildLearningQueue(languageObjects, userState, masteryMap, new Date());
      const sessionItems = getSessionItems(queue, sessionSize, newItemRatio);

      // Get goal domain for task matching
      const goal = await prisma.goalSpec.findUnique({
        where: { id: goalId },
        select: { domain: true },
      });

      // Generate tasks for each queue item using z(w) vector matching
      // Reference: Nation (2001) - vocabulary learning depth, Lu (2010) - syntactic complexity
      const config: EnhancedTaskGenerationConfig = {
        fluencyRatio: 0.3,
        useTaskMatching: true,  // Enable z(w) vector-based task selection
        focusDomain: goal?.domain,
      };

      const tasksWithItems = await Promise.all(
        sessionItems.map(async (item) => {
          try {
            // Convert QueueItem to LearningQueueItem format
            const learningItem: LearningQueueItem = {
              objectId: item.object.id,
              content: item.object.content,
              type: item.object.type,
              priority: item.priority,
              stage: item.masteryInfo?.stage ?? 0,
              nextReview: item.masteryInfo?.nextReview ?? null,
              cueFreeAccuracy: item.masteryInfo?.cueFreeAccuracy ?? 0,
              scaffoldingGap: 0, // Will be calculated if needed
              isBottleneck: false,
              urgencyScore: item.urgency,
            };

            const task = await getOrGenerateTaskWithMatching(learningItem, config);
            return {
              ...mapQueueItemToResponse(item),
              task: {
                prompt: task.prompt,
                options: task.options,
                hints: task.hints,
                expectedAnswer: task.expectedAnswer,
                format: task.spec.format,
                difficulty: task.spec.difficulty,
                cueLevel: task.spec.cueLevel,
                modality: task.spec.modality,
                isFluencyTask: task.spec.isFluencyTask,
              },
            };
          } catch (err) {
            console.error(`Failed to generate task for ${item.object.id}:`, err);
            // Return item without task on error
            return {
              ...mapQueueItemToResponse(item),
              task: null,
            };
          }
        })
      );

      return success(tasksWithItems);
    } catch (err) {
      console.error('Failed to build queue:', err);
      return error('Failed to build learning queue');
    }
  });

  // Search language objects
  registerHandler('object:search', async (_event, request) => {
    const validation = validateInput(ObjectSearchSchema, request);
    if (!validation.success) {
      return error(validation.error);
    }

    const { goalId, query, type, limit } = validation.data;

    try {
      const objects = await prisma.languageObject.findMany({
        where: {
          goalId,
          ...(query ? { content: { contains: query } } : {}),
          ...(type ? { type } : {}),
        },
        include: { masteryState: true },
        take: limit,
        orderBy: { priority: 'desc' },
      });

      return success(objects.map(mapObjectToResponse));
    } catch (err) {
      console.error('Failed to search objects:', err);
      return error('Failed to search objects');
    }
  });

  // Get collocations for an object
  registerHandler('object:get-collocations', async (_event, request) => {
    const { objectId, limit } = request as { objectId: string; limit?: number };

    const idError = validateUUID(objectId, 'objectId');
    if (idError) return error(idError);

    try {
      const object = await prisma.languageObject.findUnique({
        where: { id: objectId },
        select: { contentJson: true, goalId: true },
      });

      if (!object) {
        return error('Object not found');
      }

      // Get related objects from same goal with similar type
      const related = await prisma.languageObject.findMany({
        where: {
          goalId: object.goalId,
          id: { not: objectId },
        },
        take: limit || 10,
        orderBy: { relationalDensity: 'desc' },
      });

      return success(related.map(obj => ({
        id: obj.id,
        content: obj.content,
        type: obj.type,
        relationalDensity: obj.relationalDensity,
      })));
    } catch (err) {
      console.error('Failed to get collocations:', err);
      return error('Failed to get collocations');
    }
  });

  // Get mastery for an object
  registerHandler('object:get-mastery', async (_event, request) => {
    const { objectId } = request as { objectId: string };

    const idError = validateUUID(objectId, 'objectId');
    if (idError) return error(idError);

    try {
      const mastery = await prisma.masteryState.findUnique({
        where: { objectId },
      });

      if (!mastery) {
        return success({
          objectId,
          stage: 0,
          stability: 0,
          difficulty: 5,
          cueFreeAccuracy: 0,
          cueAssistedAccuracy: 0,
          exposureCount: 0,
          nextReview: null,
        });
      }

      return success(mastery);
    } catch (err) {
      console.error('Failed to get mastery:', err);
      return error('Failed to get mastery');
    }
  });

  // Refresh queue (recalculate priorities)
  registerHandler('queue:refresh', async (_event, request) => {
    const { goalId } = request as { goalId: string };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    // Just rebuild the queue - same as build but indicates intent
    try {
      const user = await prisma.user.findFirst();
      const theta = user?.thetaGlobal ?? 0;

      const objects = await prisma.languageObject.findMany({
        where: { goalId },
        include: { masteryState: true },
      });

      const languageObjects: LanguageObject[] = objects.map(obj => ({
        id: obj.id,
        content: obj.content,
        type: obj.type,
        frequency: obj.frequency,
        relationalDensity: obj.relationalDensity,
        contextualContribution: obj.contextualContribution,
        irtDifficulty: obj.irtDifficulty,
      }));

      const masteryMap = new Map<string, MasteryInfo>();
      for (const obj of objects) {
        if (obj.masteryState) {
          masteryMap.set(obj.id, {
            stage: obj.masteryState.stage,
            nextReview: obj.masteryState.nextReview,
            cueFreeAccuracy: obj.masteryState.cueFreeAccuracy,
          });
        }
      }

      const level = inferLevel(theta);
      const userState: UserState = {
        theta,
        weights: getWeightsForLevel(level),
        l1Language: user?.nativeLanguage || undefined,
      };

      const queue = buildLearningQueue(languageObjects, userState, masteryMap, new Date());

      return success({
        refreshed: true,
        queueSize: queue.length,
        dueCount: queue.filter(q => q.urgency > 0).length,
        newCount: queue.filter(q => !q.masteryInfo || q.masteryInfo.stage === 0).length,
      });
    } catch (err) {
      console.error('Failed to refresh queue:', err);
      return error('Failed to refresh queue');
    }
  });

}

// ============================================================================
// Helper Functions
// ============================================================================

function mapObjectToResponse(object: {
  id: string;
  goalId: string;
  content: string;
  type: string;
  contentJson?: string | null;
  frequency: number;
  relationalDensity: number;
  contextualContribution: number;
  irtDifficulty: number;
  priority?: number;
  createdAt: Date;
  masteryState?: {
    stage: number;
    nextReview: Date | null;
    cueFreeAccuracy: number;
  } | null;
}) {
  return {
    id: object.id,
    goalId: object.goalId,
    content: object.content,
    type: object.type,
    frequency: object.frequency,
    relationalDensity: object.relationalDensity,
    contextualContribution: object.contextualContribution,
    irtDifficulty: object.irtDifficulty,
    priority: object.priority ?? 0,
    contentJson: object.contentJson ? JSON.parse(object.contentJson) : undefined,
    createdAt: object.createdAt,
    mastery: object.masteryState ? {
      stage: object.masteryState.stage,
      nextReview: object.masteryState.nextReview,
      cueFreeAccuracy: object.masteryState.cueFreeAccuracy,
    } : undefined,
  };
}

function mapQueueItemToResponse(item: QueueItem) {
  return {
    object: {
      id: item.object.id,
      content: item.object.content,
      type: item.object.type,
    },
    priority: item.priority,
    urgency: item.urgency,
    finalScore: item.finalScore,
    masteryStage: item.masteryInfo?.stage ?? 0,
  };
}

export function unregisterLearningHandlers(): void {
  const { unregisterHandler } = require('./contracts') as { unregisterHandler: (channel: string) => void };
  const channels = [
    'object:create',
    'object:get',
    'object:list',
    'object:update',
    'object:delete',
    'object:import',
    'object:search',
    'object:get-collocations',
    'object:get-mastery',
    'queue:get',
    'queue:refresh',
  ];
  channels.forEach(unregisterHandler);
}
