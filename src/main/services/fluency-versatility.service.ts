/**
 * Fluency vs Versatility Balance Service
 *
 * Implements Phase 3.4: Fluency-Versatility Balance.
 * Tracks session ratios, adjusts based on progress, and generates
 * appropriate task types for fluency (high-PMI, speed-focused)
 * vs versatility (low-PMI, creative extension).
 */

import { getPrisma } from '../db/prisma';
import {
  getTopCollocations,
  getLowPMIPairs,
  type CollocationWithWords,
} from '../db/repositories/collocation.repository';
import { getMasteryStatistics } from '../db/repositories/mastery.repository';

// =============================================================================
// Types
// =============================================================================

export type TrainingMode = 'fluency_focus' | 'balanced' | 'versatility_focus';

export interface FluencyVersatilityRatio {
  fluency: number;  // 0-1
  versatility: number; // 0-1
}

export interface SessionBalance {
  targetRatio: FluencyVersatilityRatio;
  currentRatio: FluencyVersatilityRatio;
  fluencyTaskCount: number;
  versatilityTaskCount: number;
  recommendedNextType: 'fluency' | 'versatility';
}

export interface FluencyTask {
  type: 'fluency';
  word1: string;
  word2: string;
  pmi: number;
  prompt: string;
  expectedCombination: string;
  speedTarget: number; // milliseconds
}

export interface VersatilityTask {
  type: 'versatility';
  word1: string;
  word2: string;
  pmi: number;
  prompt: string;
  creativityRequired: 'low' | 'medium' | 'high';
}

export interface TransitionAnalysis {
  shouldShift: boolean;
  currentMode: TrainingMode;
  recommendedMode: TrainingMode;
  reasons: string[];
  metrics: {
    headDomainCoverage: number;
    fluencySpeed: number;
    productionImprovement: number;
  };
}

// Default ratios by learning level (from Gap 2.2)
const LEVEL_RATIOS: Record<string, FluencyVersatilityRatio> = {
  beginner: { fluency: 0.8, versatility: 0.2 },
  intermediate: { fluency: 0.6, versatility: 0.4 },
  advanced: { fluency: 0.4, versatility: 0.6 },
};

// =============================================================================
// Ratio Calculation
// =============================================================================

/**
 * Calculate target fluency/versatility ratio based on user progress.
 */
export async function calculateTargetRatio(
  userId: string,
  goalId: string
): Promise<FluencyVersatilityRatio> {
  const db = getPrisma();

  // Get user theta
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return LEVEL_RATIOS.beginner;
  }

  // Get mastery statistics
  const masteryStats = await getMasteryStatistics(goalId);

  // Calculate overall progress
  const totalItems = masteryStats.totalItems;
  const masteredItems = masteryStats.byStage[4] ?? 0;
  const controlledItems = masteryStats.byStage[3] ?? 0;
  const progressRatio = totalItems > 0
    ? (masteredItems + controlledItems * 0.5) / totalItems
    : 0;

  // Determine level based on theta and progress
  const avgTheta = user.thetaGlobal;

  if (avgTheta < -1 || progressRatio < 0.2) {
    return LEVEL_RATIOS.beginner;
  } else if (avgTheta < 1 || progressRatio < 0.6) {
    return LEVEL_RATIOS.intermediate;
  } else {
    return LEVEL_RATIOS.advanced;
  }
}

/**
 * Get current session balance.
 */
export async function getSessionBalance(
  sessionId: string
): Promise<SessionBalance> {
  const db = getPrisma();

  const session = await db.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const fluencyCount = session.fluencyTaskCount;
  const versatilityCount = session.versatilityTaskCount;
  const total = fluencyCount + versatilityCount;

  const currentRatio: FluencyVersatilityRatio = total > 0
    ? {
        fluency: fluencyCount / total,
        versatility: versatilityCount / total,
      }
    : { fluency: 0.5, versatility: 0.5 };

  // Get target ratio
  const targetRatio = await calculateTargetRatio(session.userId, session.goalId);

  // Determine recommended next type
  const fluencyDeficit = targetRatio.fluency - currentRatio.fluency;
  const recommendedNextType = fluencyDeficit > 0 ? 'fluency' : 'versatility';

  return {
    targetRatio,
    currentRatio,
    fluencyTaskCount: fluencyCount,
    versatilityTaskCount: versatilityCount,
    recommendedNextType,
  };
}

// =============================================================================
// Transition Logic (Gap 2.2)
// =============================================================================

/**
 * Determine if system should shift emphasis from fluency to versatility.
 */
export async function analyzeTransition(
  userId: string,
  goalId: string
): Promise<TransitionAnalysis> {
  const db = getPrisma();

  // Get mastery statistics
  const masteryStats = await getMasteryStatistics(goalId);

  // Calculate head domain coverage (items at stage 2+)
  const totalItems = masteryStats.totalItems;
  const coveredItems = (masteryStats.byStage[2] ?? 0) +
    (masteryStats.byStage[3] ?? 0) +
    (masteryStats.byStage[4] ?? 0);
  const headDomainCoverage = totalItems > 0 ? coveredItems / totalItems : 0;

  // Calculate fluency speed (from recent sessions)
  const recentSessions = await db.session.findMany({
    where: { userId, goalId },
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: {
      responses: {
        where: { correct: true },
        select: { responseTimeMs: true },
      },
    },
  });

  const allResponseTimes = recentSessions.flatMap((s) =>
    s.responses.map((r) => r.responseTimeMs)
  );
  const avgResponseTime = allResponseTimes.length > 0
    ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
    : 10000;

  // Normalize to percentile (faster = higher)
  // Assume 3000ms is 90th percentile speed
  const fluencySpeed = Math.min(1, 3000 / avgResponseTime);

  // Calculate production improvement rate - get sessions with full response data
  const recentSessionsWithAccuracy = await db.session.findMany({
    where: { userId, goalId },
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: {
      responses: {
        select: { correct: true },
      },
    },
  });

  const olderSessions = await db.session.findMany({
    where: { userId, goalId },
    orderBy: { startedAt: 'desc' },
    skip: 5,
    take: 5,
    include: {
      responses: {
        select: { correct: true },
      },
    },
  });

  const recentAccuracy = recentSessionsWithAccuracy.length > 0
    ? recentSessionsWithAccuracy.reduce((sum, s) => {
        const correct = s.responses.filter((r) => r.correct).length;
        return sum + (s.responses.length > 0 ? correct / s.responses.length : 0);
      }, 0) / recentSessionsWithAccuracy.length
    : 0;

  const olderAccuracy = olderSessions.length > 0
    ? olderSessions.reduce((sum, s) => {
        const correct = s.responses.filter((r) => r.correct).length;
        return sum + (s.responses.length > 0 ? correct / s.responses.length : 0);
      }, 0) / olderSessions.length
    : 0;

  const productionImprovement = olderAccuracy > 0
    ? (recentAccuracy - olderAccuracy) / olderAccuracy
    : recentAccuracy;

  // Determine current and recommended modes
  const currentRatio = await calculateTargetRatio(userId, goalId);
  let currentMode: TrainingMode;
  if (currentRatio.fluency >= 0.7) {
    currentMode = 'fluency_focus';
  } else if (currentRatio.fluency >= 0.5) {
    currentMode = 'balanced';
  } else {
    currentMode = 'versatility_focus';
  }

  // Check transition triggers (from Gap 2.2)
  const reasons: string[] = [];
  let shouldShift = false;
  let recommendedMode = currentMode;

  if (headDomainCoverage > 0.8) {
    reasons.push(`Head domain coverage (${(headDomainCoverage * 100).toFixed(0)}%) exceeds 80%`);
    shouldShift = true;
  }

  if (fluencySpeed > 0.7) {
    reasons.push(`Fluency speed (${(fluencySpeed * 100).toFixed(0)}th percentile) exceeds 70%`);
    shouldShift = true;
  }

  if (productionImprovement < 0.02 && recentAccuracy > 0.7) {
    reasons.push(`Production improvement plateaued (${(productionImprovement * 100).toFixed(1)}%)`);
    shouldShift = true;
  }

  if (shouldShift) {
    if (currentMode === 'fluency_focus') {
      recommendedMode = 'balanced';
    } else if (currentMode === 'balanced') {
      recommendedMode = 'versatility_focus';
    }
  }

  return {
    shouldShift,
    currentMode,
    recommendedMode,
    reasons,
    metrics: {
      headDomainCoverage,
      fluencySpeed,
      productionImprovement,
    },
  };
}

/**
 * Get training mode based on scaffolding gap.
 */
export function selectTrainingMode(scaffoldingGap: number): TrainingMode {
  if (scaffoldingGap > 0.4) {
    return 'fluency_focus'; // Need more automation
  } else if (scaffoldingGap > 0.2) {
    return 'balanced';
  } else {
    return 'versatility_focus'; // Ready for creative extension
  }
}

// =============================================================================
// Task Generation
// =============================================================================

/**
 * Generate fluency-focused tasks (high-PMI combinations).
 */
export async function generateFluencyTasks(
  goalId: string,
  count: number = 5
): Promise<FluencyTask[]> {
  const collocations = await getTopCollocations(goalId, count * 2);

  return collocations.slice(0, count).map((c) => ({
    type: 'fluency' as const,
    word1: c.word1.content,
    word2: c.word2.content,
    pmi: c.pmi,
    prompt: generateFluencyPrompt(c),
    expectedCombination: `${c.word1.content} ${c.word2.content}`,
    speedTarget: calculateSpeedTarget(c.pmi),
  }));
}

/**
 * Generate versatility-focused tasks (low-PMI combinations).
 */
export async function generateVersatilityTasks(
  goalId: string,
  count: number = 5
): Promise<VersatilityTask[]> {
  const lowPMIPairs = await getLowPMIPairs(goalId, 2.0, count * 2);

  return lowPMIPairs.slice(0, count).map((c) => ({
    type: 'versatility' as const,
    word1: c.word1.content,
    word2: c.word2.content,
    pmi: c.pmi,
    prompt: generateVersatilityPrompt(c),
    creativityRequired: determineCreativityLevel(c.pmi),
  }));
}

/**
 * Get next task based on session balance.
 */
export async function getBalancedTask(
  sessionId: string,
  goalId: string
): Promise<FluencyTask | VersatilityTask | null> {
  const balance = await getSessionBalance(sessionId);

  if (balance.recommendedNextType === 'fluency') {
    const tasks = await generateFluencyTasks(goalId, 1);
    return tasks[0] ?? null;
  } else {
    const tasks = await generateVersatilityTasks(goalId, 1);
    return tasks[0] ?? null;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateFluencyPrompt(collocation: CollocationWithWords): string {
  const prompts = [
    `Complete quickly: "${collocation.word1.content} ____"`,
    `What word commonly follows "${collocation.word1.content}"?`,
    `Fill in the collocation: ____ ${collocation.word2.content}`,
  ];

  return prompts[Math.floor(Math.random() * prompts.length)];
}

function generateVersatilityPrompt(collocation: CollocationWithWords): string {
  const prompts = [
    `Create a sentence using both "${collocation.word1.content}" and "${collocation.word2.content}"`,
    `Connect these words in an unusual way: ${collocation.word1.content}, ${collocation.word2.content}`,
    `Write a creative phrase combining: ${collocation.word1.content} + ${collocation.word2.content}`,
  ];

  return prompts[Math.floor(Math.random() * prompts.length)];
}

function calculateSpeedTarget(pmi: number): number {
  // Higher PMI = more expected = faster response expected
  // Base target: 5000ms, reduced by PMI
  const base = 5000;
  const reduction = Math.min(pmi * 300, 3000);
  return Math.max(2000, base - reduction);
}

function determineCreativityLevel(pmi: number): 'low' | 'medium' | 'high' {
  // Lower PMI = less common combination = more creativity needed
  if (pmi < 0.5) return 'high';
  if (pmi < 1.5) return 'medium';
  return 'low';
}

// =============================================================================
// Session Tracking
// =============================================================================

/**
 * Update session fluency/versatility counts.
 */
export async function updateSessionBalance(
  sessionId: string,
  taskType: 'fluency' | 'versatility'
): Promise<void> {
  const db = getPrisma();

  if (taskType === 'fluency') {
    await db.session.update({
      where: { id: sessionId },
      data: { fluencyTaskCount: { increment: 1 } },
    });
  } else {
    await db.session.update({
      where: { id: sessionId },
      data: { versatilityTaskCount: { increment: 1 } },
    });
  }
}

/**
 * Get fluency/versatility statistics for a goal.
 */
export async function getBalanceStatistics(
  userId: string,
  goalId: string
): Promise<{
  totalFluencyTasks: number;
  totalVersatilityTasks: number;
  overallRatio: FluencyVersatilityRatio;
  recommendedAdjustment: string | null;
}> {
  const db = getPrisma();

  const sessions = await db.session.findMany({
    where: { userId, goalId },
    select: {
      fluencyTaskCount: true,
      versatilityTaskCount: true,
    },
  });

  const totalFluency = sessions.reduce((sum, s) => sum + s.fluencyTaskCount, 0);
  const totalVersatility = sessions.reduce((sum, s) => sum + s.versatilityTaskCount, 0);
  const total = totalFluency + totalVersatility;

  const overallRatio: FluencyVersatilityRatio = total > 0
    ? {
        fluency: totalFluency / total,
        versatility: totalVersatility / total,
      }
    : { fluency: 0.5, versatility: 0.5 };

  // Get target ratio
  const targetRatio = await calculateTargetRatio(userId, goalId);

  // Determine if adjustment needed
  let recommendedAdjustment: string | null = null;
  const fluencyDiff = overallRatio.fluency - targetRatio.fluency;

  if (Math.abs(fluencyDiff) > 0.15) {
    if (fluencyDiff > 0) {
      recommendedAdjustment = 'Increase versatility tasks to improve creative language use.';
    } else {
      recommendedAdjustment = 'Increase fluency tasks to build automatic recall.';
    }
  }

  return {
    totalFluencyTasks: totalFluency,
    totalVersatilityTasks: totalVersatility,
    overallRatio,
    recommendedAdjustment,
  };
}
