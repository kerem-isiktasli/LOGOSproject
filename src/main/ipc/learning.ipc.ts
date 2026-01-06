/**
 * Learning Object IPC Handlers
 *
 * Handles all learning object and queue-related IPC communication.
 * Learning objects are the atomic units of learning (words, phrases, grammar).
 */

import { registerHandler, success, error, validateNonEmpty, validateUUID } from './contracts';
import { prisma } from '../db/client';
import { buildLearningQueue, getSessionItems, inferLevel, getWeightsForLevel } from '../../core/priority';
import type { LanguageObject, UserState, MasteryInfo, QueueItem } from '../../core/priority';

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all learning object IPC handlers.
 */
export function registerLearningHandlers(): void {
  // Create a learning object
  registerHandler('object:create', async (_event, request) => {
    const {
      goalId,
      content,
      type,
      frequency,
      relationalDensity,
      contextualContribution,
      irtDifficulty,
      metadata
    } = request as {
      goalId: string;
      content: string;
      type: string;
      frequency?: number;
      relationalDensity?: number;
      contextualContribution?: number;
      irtDifficulty?: number;
      metadata?: Record<string, unknown>;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    const contentError = validateNonEmpty(content, 'content');
    if (contentError) return error(contentError);

    const typeError = validateNonEmpty(type, 'type');
    if (typeError) return error(typeError);

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
    const { goalId, type, limit, offset } = request as {
      goalId: string;
      type?: string;
      limit?: number;
      offset?: number;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    try {
      const objects = await prisma.languageObject.findMany({
        where: {
          goalId,
          ...(type ? { type } : {}),
        },
        include: { masteryState: true },
        take: limit || 100,
        skip: offset || 0,
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
    const {
      id,
      content,
      translation,
      frequency,
      relationalDensity,
      contextualContribution,
      irtDifficulty,
      metadata
    } = request as {
      id: string;
      content?: string;
      translation?: string;
      frequency?: number;
      relationalDensity?: number;
      contextualContribution?: number;
      irtDifficulty?: number;
      metadata?: Record<string, unknown>;
    };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    const updateData: Record<string, unknown> = {};
    if (content !== undefined) {
      const contentError = validateNonEmpty(content, 'content');
      if (contentError) return error(contentError);
      updateData.content = content.trim();
    }
    if (translation !== undefined) updateData.translation = translation?.trim() || null;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (relationalDensity !== undefined) updateData.relationalDensity = relationalDensity;
    if (contextualContribution !== undefined) updateData.contextualContribution = contextualContribution;
    if (irtDifficulty !== undefined) updateData.irtDifficulty = irtDifficulty;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

    if (Object.keys(updateData).length === 0) {
      return error('No fields to update');
    }

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
    const { goalId, objects } = request as {
      goalId: string;
      objects: Array<{
        content: string;
        type: string;
        translation?: string;
        frequency?: number;
        relationalDensity?: number;
        contextualContribution?: number;
        irtDifficulty?: number;
      }>;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    if (!Array.isArray(objects) || objects.length === 0) {
      return error('objects must be a non-empty array');
    }

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
    const { goalId, sessionSize, newItemRatio } = request as {
      goalId: string;
      sessionSize?: number;
      newItemRatio?: number;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

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
      const sessionItems = getSessionItems(queue, sessionSize ?? 20, newItemRatio ?? 0.3);

      return success(sessionItems.map(mapQueueItemToResponse));
    } catch (err) {
      console.error('Failed to build queue:', err);
      return error('Failed to build learning queue');
    }
  });

  // Search language objects
  registerHandler('object:search', async (_event, request) => {
    const { goalId, query, type, limit } = request as {
      goalId: string;
      query?: string;
      type?: string;
      limit?: number;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    try {
      const objects = await prisma.languageObject.findMany({
        where: {
          goalId,
          ...(query ? { content: { contains: query } } : {}),
          ...(type ? { type } : {}),
        },
        include: { masteryState: true },
        take: limit || 50,
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
