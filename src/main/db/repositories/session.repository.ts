/**
 * Session Repository
 *
 * Data access layer for Session and Response tracking.
 * Implements Phase 2.3: Session Recording.
 */

import type { Session, Response, ThetaSnapshot, Prisma } from '@prisma/client';
import { getPrisma } from '../prisma';

// =============================================================================
// Types
// =============================================================================

export type SessionMode = 'learning' | 'training' | 'evaluation';

export interface CreateSessionInput {
  userId: string;
  goalId: string;
  mode: SessionMode;
}

export interface RecordResponseInput {
  sessionId: string;
  objectId: string;
  taskType: string;
  taskFormat: string;
  modality: string;
  correct: boolean;
  responseTimeMs: number;
  cueLevel: number;
  responseContent?: string;
  expectedContent?: string;
  irtThetaContribution?: number;
}

export interface SessionWithResponses extends Session {
  responses: Response[];
  thetaSnapshots: ThetaSnapshot[];
  _count: {
    responses: number;
  };
}

export interface SessionSummary {
  sessionId: string;
  mode: SessionMode;
  duration: number; // minutes
  itemsPracticed: number;
  correctCount: number;
  accuracy: number;
  stageTransitions: number;
  averageResponseTime: number;
}

export interface ThetaState {
  thetaGlobal: number;
  thetaPhonology: number;
  thetaMorphology: number;
  thetaLexical: number;
  thetaSyntactic: number;
  thetaPragmatic: number;
  seGlobal: number;
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Start a new session.
 */
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const db = getPrisma();

  return db.session.create({
    data: {
      userId: input.userId,
      goalId: input.goalId,
      mode: input.mode,
    },
  });
}

/**
 * Get a session by ID.
 */
export async function getSessionById(sessionId: string): Promise<Session | null> {
  const db = getPrisma();

  return db.session.findUnique({
    where: { id: sessionId },
  });
}

/**
 * Get a session with all responses.
 */
export async function getSessionWithResponses(
  sessionId: string
): Promise<SessionWithResponses | null> {
  const db = getPrisma();

  return db.session.findUnique({
    where: { id: sessionId },
    include: {
      responses: {
        orderBy: { createdAt: 'asc' },
      },
      thetaSnapshots: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { responses: true },
      },
    },
  });
}

/**
 * End a session.
 */
export async function endSession(sessionId: string): Promise<Session> {
  const db = getPrisma();

  return db.session.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
}

/**
 * Record a response within a session.
 * Uses a transaction to ensure atomicity of response creation and session update.
 */
export async function recordResponse(input: RecordResponseInput): Promise<Response> {
  const db = getPrisma();

  // Use transaction to ensure atomicity
  return db.$transaction(async (tx) => {
    // Create the response
    const response = await tx.response.create({
      data: {
        sessionId: input.sessionId,
        objectId: input.objectId,
        taskType: input.taskType,
        taskFormat: input.taskFormat,
        modality: input.modality,
        correct: input.correct,
        responseTimeMs: input.responseTimeMs,
        cueLevel: input.cueLevel,
        responseContent: input.responseContent,
        expectedContent: input.expectedContent,
        irtThetaContribution: input.irtThetaContribution,
      },
    });

    // Update session metrics
    await tx.session.update({
      where: { id: input.sessionId },
      data: {
        itemsPracticed: { increment: 1 },
      },
    });

    return response;
  });
}

/**
 * Record a stage transition during a session.
 */
export async function recordStageTransition(sessionId: string): Promise<void> {
  const db = getPrisma();

  await db.session.update({
    where: { id: sessionId },
    data: {
      stageTransitions: { increment: 1 },
    },
  });
}

/**
 * Record fluency vs versatility task counts.
 */
export async function recordTaskType(
  sessionId: string,
  isFluencyTask: boolean
): Promise<void> {
  const db = getPrisma();

  await db.session.update({
    where: { id: sessionId },
    data: isFluencyTask
      ? { fluencyTaskCount: { increment: 1 } }
      : { versatilityTaskCount: { increment: 1 } },
  });
}

/**
 * Save a theta snapshot during a session.
 */
export async function saveThetaSnapshot(
  sessionId: string,
  state: ThetaState
): Promise<ThetaSnapshot> {
  const db = getPrisma();

  return db.thetaSnapshot.create({
    data: {
      sessionId,
      ...state,
    },
  });
}

/**
 * Get session history for a user.
 */
export async function getSessionHistory(
  userId: string,
  limit: number = 20
): Promise<Session[]> {
  const db = getPrisma();

  return db.session.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}

/**
 * Get sessions for a specific goal.
 */
export async function getSessionsByGoal(
  goalId: string,
  limit?: number
): Promise<Session[]> {
  const db = getPrisma();

  return db.session.findMany({
    where: { goalId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}

/**
 * Calculate session summary.
 */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const db = getPrisma();

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      responses: true,
    },
  });

  if (!session) return null;

  const responses = session.responses;
  const correctCount = responses.filter((r) => r.correct).length;
  const totalResponseTime = responses.reduce((sum, r) => sum + r.responseTimeMs, 0);

  const startTime = session.startedAt.getTime();
  const endTime = session.endedAt?.getTime() ?? Date.now();
  const durationMinutes = (endTime - startTime) / (1000 * 60);

  return {
    sessionId: session.id,
    mode: session.mode as SessionMode,
    duration: Math.round(durationMinutes * 10) / 10,
    itemsPracticed: session.itemsPracticed,
    correctCount,
    accuracy: responses.length > 0 ? correctCount / responses.length : 0,
    stageTransitions: session.stageTransitions,
    averageResponseTime: responses.length > 0 ? totalResponseTime / responses.length : 0,
  };
}

/**
 * Get responses for an object (learning history).
 */
export async function getResponseHistory(
  objectId: string,
  limit: number = 50
): Promise<Response[]> {
  const db = getPrisma();

  return db.response.findMany({
    where: { objectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get theta progression over time.
 */
export async function getThetaProgression(
  userId: string,
  since?: Date
): Promise<ThetaSnapshot[]> {
  const db = getPrisma();

  return db.thetaSnapshot.findMany({
    where: {
      session: {
        userId,
        ...(since ? { startedAt: { gte: since } } : {}),
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get aggregate statistics for a user.
 */
export async function getUserStatistics(userId: string): Promise<{
  totalSessions: number;
  totalResponses: number;
  totalTimeMinutes: number;
  averageAccuracy: number;
  totalStageTransitions: number;
}> {
  const db = getPrisma();

  const sessions = await db.session.findMany({
    where: { userId },
    include: {
      responses: true,
    },
  });

  let totalResponses = 0;
  let correctResponses = 0;
  let totalTimeMs = 0;
  let totalTransitions = 0;

  for (const session of sessions) {
    totalResponses += session.responses.length;
    correctResponses += session.responses.filter((r) => r.correct).length;
    totalTransitions += session.stageTransitions;

    if (session.endedAt) {
      totalTimeMs += session.endedAt.getTime() - session.startedAt.getTime();
    }
  }

  return {
    totalSessions: sessions.length,
    totalResponses,
    totalTimeMinutes: Math.round(totalTimeMs / (1000 * 60)),
    averageAccuracy: totalResponses > 0 ? correctResponses / totalResponses : 0,
    totalStageTransitions: totalTransitions,
  };
}

/**
 * Apply theta rules based on session mode.
 * - Learning: Freeze theta (no updates)
 * - Training: Soft-track (weighted update)
 * - Evaluation: Full IRT update
 */
export async function applyThetaRules(
  userId: string,
  sessionMode: SessionMode,
  thetaContribution: Partial<ThetaState>
): Promise<void> {
  const db = getPrisma();

  if (sessionMode === 'learning') {
    // Freeze theta - no updates
    return;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Weight factor: training = 0.5, evaluation = 1.0
  const weight = sessionMode === 'training' ? 0.5 : 1.0;

  const updates: Prisma.UserUpdateInput = {};

  if (thetaContribution.thetaGlobal !== undefined) {
    updates.thetaGlobal = user.thetaGlobal + thetaContribution.thetaGlobal * weight;
  }
  if (thetaContribution.thetaPhonology !== undefined) {
    updates.thetaPhonology = user.thetaPhonology + thetaContribution.thetaPhonology * weight;
  }
  if (thetaContribution.thetaMorphology !== undefined) {
    updates.thetaMorphology = user.thetaMorphology + thetaContribution.thetaMorphology * weight;
  }
  if (thetaContribution.thetaLexical !== undefined) {
    updates.thetaLexical = user.thetaLexical + thetaContribution.thetaLexical * weight;
  }
  if (thetaContribution.thetaSyntactic !== undefined) {
    updates.thetaSyntactic = user.thetaSyntactic + thetaContribution.thetaSyntactic * weight;
  }
  if (thetaContribution.thetaPragmatic !== undefined) {
    updates.thetaPragmatic = user.thetaPragmatic + thetaContribution.thetaPragmatic * weight;
  }

  if (Object.keys(updates).length > 0) {
    await db.user.update({
      where: { id: userId },
      data: updates,
    });
  }
}

/**
 * Get incorrect responses for error analysis.
 */
export async function getIncorrectResponses(
  sessionId: string
): Promise<Response[]> {
  const db = getPrisma();

  return db.response.findMany({
    where: {
      sessionId,
      correct: false,
    },
    include: { object: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get responses with their error analyses.
 */
export async function getResponsesWithErrorAnalysis(
  sessionId: string
): Promise<Array<Response & { object: { errorAnalyses: Array<{ component: string; errorType: string; explanation: string }> } }>> {
  const db = getPrisma();

  return db.response.findMany({
    where: { sessionId },
    include: {
      object: {
        include: {
          errorAnalyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}
