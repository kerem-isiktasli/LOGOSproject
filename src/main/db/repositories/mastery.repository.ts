/**
 * Mastery State Repository
 *
 * Data access layer for MasteryState tracking and FSRS scheduling.
 * Implements Phase 2.2: Mastery State Tracking.
 */

import type { MasteryState, LanguageObject, Prisma } from '@prisma/client';
import { getPrisma } from '../prisma';

// =============================================================================
// Types
// =============================================================================

export interface CreateMasteryStateInput {
  objectId: string;
  stage?: number;
  fsrsDifficulty?: number;
  fsrsStability?: number;
  nextReview?: Date;
}

export interface UpdateMasteryStateInput {
  stage?: number;
  fsrsDifficulty?: number;
  fsrsStability?: number;
  fsrsLastReview?: Date;
  fsrsReps?: number;
  fsrsLapses?: number;
  fsrsState?: string;
  cueFreeAccuracy?: number;
  cueAssistedAccuracy?: number;
  exposureCount?: number;
  nextReview?: Date;
  priority?: number;
}

export interface MasteryWithObject extends MasteryState {
  object: LanguageObject;
}

export interface ReviewQueueItem {
  objectId: string;
  content: string;
  type: string;
  stage: number;
  nextReview: Date | null;
  priority: number;
  cueFreeAccuracy: number;
  cueAssistedAccuracy: number;
  scaffoldingGap: number;
}

export interface StageTransition {
  objectId: string;
  previousStage: number;
  newStage: number;
  timestamp: Date;
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Initialize mastery state for a language object.
 */
export async function createMasteryState(
  input: CreateMasteryStateInput
): Promise<MasteryState> {
  const db = getPrisma();

  return db.masteryState.create({
    data: {
      objectId: input.objectId,
      stage: input.stage ?? 0,
      fsrsDifficulty: input.fsrsDifficulty ?? 5,
      fsrsStability: input.fsrsStability ?? 0,
      nextReview: input.nextReview,
    },
  });
}

/**
 * Get mastery state by object ID.
 */
export async function getMasteryState(objectId: string): Promise<MasteryState | null> {
  const db = getPrisma();

  return db.masteryState.findUnique({
    where: { objectId },
  });
}

/**
 * Get mastery state with the associated language object.
 */
export async function getMasteryWithObject(objectId: string): Promise<MasteryWithObject | null> {
  const db = getPrisma();

  return db.masteryState.findUnique({
    where: { objectId },
    include: { object: true },
  });
}

/**
 * Update mastery state after a response.
 */
export async function updateMasteryState(
  objectId: string,
  input: UpdateMasteryStateInput
): Promise<MasteryState> {
  const db = getPrisma();

  const data: Prisma.MasteryStateUpdateInput = {};

  if (input.stage !== undefined) data.stage = input.stage;
  if (input.fsrsDifficulty !== undefined) data.fsrsDifficulty = input.fsrsDifficulty;
  if (input.fsrsStability !== undefined) data.fsrsStability = input.fsrsStability;
  if (input.fsrsLastReview !== undefined) data.fsrsLastReview = input.fsrsLastReview;
  if (input.fsrsReps !== undefined) data.fsrsReps = input.fsrsReps;
  if (input.fsrsLapses !== undefined) data.fsrsLapses = input.fsrsLapses;
  if (input.fsrsState !== undefined) data.fsrsState = input.fsrsState;
  if (input.cueFreeAccuracy !== undefined) data.cueFreeAccuracy = input.cueFreeAccuracy;
  if (input.cueAssistedAccuracy !== undefined) data.cueAssistedAccuracy = input.cueAssistedAccuracy;
  if (input.exposureCount !== undefined) data.exposureCount = input.exposureCount;
  if (input.nextReview !== undefined) data.nextReview = input.nextReview;
  if (input.priority !== undefined) data.priority = input.priority;

  return db.masteryState.update({
    where: { objectId },
    data,
  });
}

/**
 * Increment exposure count and update accuracy metrics.
 */
export async function recordExposure(
  objectId: string,
  correct: boolean,
  cueLevel: number
): Promise<MasteryState> {
  const db = getPrisma();

  const current = await db.masteryState.findUnique({
    where: { objectId },
  });

  if (!current) {
    throw new Error(`Mastery state not found for object: ${objectId}`);
  }

  // Exponential moving average for accuracy (alpha = 0.2)
  const alpha = 0.2;
  const correctValue = correct ? 1 : 0;

  let newCueFreeAccuracy = current.cueFreeAccuracy;
  let newCueAssistedAccuracy = current.cueAssistedAccuracy;

  if (cueLevel === 0) {
    // Cue-free response
    newCueFreeAccuracy = current.cueFreeAccuracy * (1 - alpha) + correctValue * alpha;
  } else {
    // Cue-assisted response
    newCueAssistedAccuracy = current.cueAssistedAccuracy * (1 - alpha) + correctValue * alpha;
  }

  return db.masteryState.update({
    where: { objectId },
    data: {
      exposureCount: current.exposureCount + 1,
      cueFreeAccuracy: newCueFreeAccuracy,
      cueAssistedAccuracy: newCueAssistedAccuracy,
    },
  });
}

/**
 * Get items due for review.
 */
export async function getReviewQueue(
  goalId: string,
  limit: number = 20
): Promise<ReviewQueueItem[]> {
  const db = getPrisma();
  const now = new Date();

  const items = await db.masteryState.findMany({
    where: {
      object: { goalId },
      OR: [
        { nextReview: null },
        { nextReview: { lte: now } },
      ],
    },
    include: { object: true },
    orderBy: [
      { stage: 'asc' },
      { priority: 'desc' },
    ],
    take: limit,
  });

  return items.map((item) => ({
    objectId: item.objectId,
    content: item.object.content,
    type: item.object.type,
    stage: item.stage,
    nextReview: item.nextReview,
    priority: item.priority,
    cueFreeAccuracy: item.cueFreeAccuracy,
    cueAssistedAccuracy: item.cueAssistedAccuracy,
    scaffoldingGap: item.cueAssistedAccuracy - item.cueFreeAccuracy,
  }));
}

/**
 * Get items by mastery stage.
 */
export async function getItemsByStage(
  goalId: string,
  stage: number
): Promise<MasteryWithObject[]> {
  const db = getPrisma();

  return db.masteryState.findMany({
    where: {
      stage,
      object: { goalId },
    },
    include: { object: true },
    orderBy: { priority: 'desc' },
  });
}

/**
 * Calculate scaffolding gap for an object.
 */
export async function getScaffoldingGap(objectId: string): Promise<number> {
  const state = await getMasteryState(objectId);
  if (!state) return 0;

  return state.cueAssistedAccuracy - state.cueFreeAccuracy;
}

/**
 * Bulk initialize mastery states for new objects.
 */
export async function bulkCreateMasteryStates(
  objectIds: string[]
): Promise<number> {
  const db = getPrisma();

  const result = await db.masteryState.createMany({
    data: objectIds.map((objectId) => ({
      objectId,
      stage: 0,
      fsrsDifficulty: 5,
      fsrsStability: 0,
    })),
    
  });

  return result.count;
}

/**
 * Update FSRS parameters after a review.
 */
export async function updateFSRSParameters(
  objectId: string,
  difficulty: number,
  stability: number,
  nextReview: Date,
  rating: 1 | 2 | 3 | 4
): Promise<MasteryState> {
  const db = getPrisma();

  const current = await db.masteryState.findUnique({
    where: { objectId },
  });

  if (!current) {
    throw new Error(`Mastery state not found for object: ${objectId}`);
  }

  // Determine if this is a lapse (rating 1 or 2 indicates forgetting)
  const isLapse = rating <= 2;

  return db.masteryState.update({
    where: { objectId },
    data: {
      fsrsDifficulty: difficulty,
      fsrsStability: stability,
      fsrsLastReview: new Date(),
      fsrsReps: current.fsrsReps + 1,
      fsrsLapses: isLapse ? current.fsrsLapses + 1 : current.fsrsLapses,
      fsrsState: stability > 0 ? 'review' : 'learning',
      nextReview,
    },
  });
}

/**
 * Transition to a new mastery stage.
 */
export async function transitionStage(
  objectId: string,
  newStage: number
): Promise<StageTransition> {
  const db = getPrisma();

  const current = await db.masteryState.findUnique({
    where: { objectId },
  });

  if (!current) {
    throw new Error(`Mastery state not found for object: ${objectId}`);
  }

  const previousStage = current.stage;

  await db.masteryState.update({
    where: { objectId },
    data: { stage: newStage },
  });

  return {
    objectId,
    previousStage,
    newStage,
    timestamp: new Date(),
  };
}

/**
 * Get mastery statistics for a goal.
 */
export async function getMasteryStatistics(goalId: string): Promise<{
  totalItems: number;
  byStage: Record<number, number>;
  averageAccuracy: number;
  averageScaffoldingGap: number;
  itemsDueForReview: number;
}> {
  const db = getPrisma();
  const now = new Date();

  const items = await db.masteryState.findMany({
    where: { object: { goalId } },
  });

  const byStage: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let totalAccuracy = 0;
  let totalGap = 0;
  let dueCount = 0;

  for (const item of items) {
    byStage[item.stage] = (byStage[item.stage] || 0) + 1;
    totalAccuracy += item.cueFreeAccuracy;
    totalGap += item.cueAssistedAccuracy - item.cueFreeAccuracy;

    if (!item.nextReview || item.nextReview <= now) {
      dueCount++;
    }
  }

  const count = items.length;

  return {
    totalItems: count,
    byStage,
    averageAccuracy: count > 0 ? totalAccuracy / count : 0,
    averageScaffoldingGap: count > 0 ? totalGap / count : 0,
    itemsDueForReview: dueCount,
  };
}
