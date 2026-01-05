/**
 * State + Priority Service (Layer 1)
 *
 * Implements Phase 3.1: Layer 1 of the learning pipeline.
 * Analyzes user theta state, applies FRE formula, calculates cost adjustments,
 * sorts learning queue, and detects bottlenecks.
 */

import { getPrisma } from '../db/prisma';
import {
  getMasteryStatistics,
  getReviewQueue,
  type ReviewQueueItem,
} from '../db/repositories/mastery.repository';
import {
  getLanguageObjects,
  bulkUpdatePriorities,
} from '../db/repositories/goal.repository';
import {
  detectBottlenecks,
  getPrimaryBottleneck,
  type BottleneckResult,
} from '../db/repositories/error-analysis.repository';
import { selectNextItem, fisherInformation, type ItemParameter } from '../../core/irt';

// =============================================================================
// Types
// =============================================================================

export interface ThetaState {
  global: number;
  phonology: number;
  morphology: number;
  lexical: number;
  syntactic: number;
  pragmatic: number;
}

export interface PriorityWeights {
  frequency: number;      // F weight
  relational: number;     // R weight
  domain: number;         // D weight
  morphological: number;  // M weight
  phonological: number;   // P weight
  urgency: number;        // Review urgency weight
  bottleneck: number;     // Bottleneck boost weight
}

export interface LearningQueueItem {
  objectId: string;
  content: string;
  type: string;
  priority: number;
  stage: number;
  nextReview: Date | null;
  cueFreeAccuracy: number;
  scaffoldingGap: number;
  isBottleneck: boolean;
  urgencyScore: number;
}

export interface QueueAnalysis {
  totalItems: number;
  dueItems: number;
  newItems: number;
  bottleneckItems: number;
  averagePriority: number;
  componentDistribution: Record<string, number>;
}

const DEFAULT_WEIGHTS: PriorityWeights = {
  frequency: 0.20,
  relational: 0.15,
  domain: 0.15,
  morphological: 0.10,
  phonological: 0.10,
  urgency: 0.20,
  bottleneck: 0.10,
};

// =============================================================================
// Theta State Analysis
// =============================================================================

/**
 * Get current theta state for a user.
 */
export async function getUserThetaState(userId: string): Promise<ThetaState> {
  const db = getPrisma();

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  return {
    global: user.thetaGlobal,
    phonology: user.thetaPhonology,
    morphology: user.thetaMorphology,
    lexical: user.thetaLexical,
    syntactic: user.thetaSyntactic,
    pragmatic: user.thetaPragmatic,
  };
}

/**
 * Get theta for a specific component type.
 */
export function getThetaForComponent(
  theta: ThetaState,
  componentType: string
): number {
  const mapping: Record<string, keyof ThetaState> = {
    LEX: 'lexical',
    MORPH: 'morphology',
    G2P: 'phonology',
    SYNT: 'syntactic',
    PRAG: 'pragmatic',
  };

  const key = mapping[componentType];
  return key ? theta[key] : theta.global;
}

// =============================================================================
// Priority Calculation
// =============================================================================

/**
 * Calculate base priority S_base(w) from z(w) vector.
 */
export function calculateBasePriority(
  object: {
    frequency: number;
    relationalDensity: number;
    domainDistribution: string | null;
    morphologicalScore: number | null;
    phonologicalDifficulty: number | null;
  },
  targetDomain: string,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number {
  // F: Frequency (higher = more important)
  const F = object.frequency;

  // R: Relational density (higher = more connections)
  const R = object.relationalDensity;

  // D: Domain relevance (how much in target domain)
  let D = 0.5; // Default if no domain data
  if (object.domainDistribution) {
    try {
      const domains = JSON.parse(object.domainDistribution);
      D = domains[targetDomain] ?? 0.5;
    } catch {
      D = 0.5;
    }
  }

  // M: Morphological complexity (inverted - higher complexity = higher priority)
  const M = object.morphologicalScore ?? 0.5;

  // P: Phonological difficulty (inverted - higher difficulty = higher priority)
  const P = object.phonologicalDifficulty ?? 0.5;

  // Weighted sum
  const S_base =
    weights.frequency * F +
    weights.relational * R +
    weights.domain * D +
    weights.morphological * M +
    weights.phonological * P;

  return Math.min(1, Math.max(0, S_base));
}

/**
 * Calculate mastery adjustment g(m) for Zone of Proximal Development.
 * Items slightly above current ability get highest priority.
 */
export function calculateMasteryAdjustment(
  stage: number,
  cueFreeAccuracy: number,
  scaffoldingGap: number
): number {
  // Stage-based factor: prioritize items in active learning stages
  const stageFactor = [1.0, 0.9, 0.7, 0.5, 0.3][stage] ?? 0.3;

  // Accuracy-based factor: prioritize items with moderate difficulty
  // Items with 40-70% accuracy are in ZPD
  let accuracyFactor: number;
  if (cueFreeAccuracy < 0.4) {
    accuracyFactor = 0.8; // Too hard, but still important
  } else if (cueFreeAccuracy < 0.7) {
    accuracyFactor = 1.0; // In ZPD - highest priority
  } else if (cueFreeAccuracy < 0.9) {
    accuracyFactor = 0.6; // Getting easier
  } else {
    accuracyFactor = 0.3; // Mastered
  }

  // Scaffolding gap factor: items with high gap need more practice
  const gapFactor = 1 + scaffoldingGap * 0.5;

  return stageFactor * accuracyFactor * gapFactor;
}

/**
 * Calculate urgency score based on review schedule.
 */
export function calculateUrgencyScore(nextReview: Date | null): number {
  if (!nextReview) return 1.0; // New items are urgent

  const now = Date.now();
  const reviewTime = nextReview.getTime();
  const hoursOverdue = (now - reviewTime) / (1000 * 60 * 60);

  if (hoursOverdue > 0) {
    // Overdue: urgency increases with time
    return Math.min(1.0, 0.5 + hoursOverdue / 48);
  } else {
    // Not yet due: low urgency
    const hoursUntilDue = -hoursOverdue;
    return Math.max(0.1, 0.5 - hoursUntilDue / 168); // 168 = 1 week
  }
}

/**
 * Calculate effective priority S_eff(w).
 */
export function calculateEffectivePriority(
  basePriority: number,
  masteryAdjustment: number,
  urgencyScore: number,
  isBottleneck: boolean,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number {
  const urgencyComponent = weights.urgency * urgencyScore;
  const bottleneckBoost = isBottleneck ? weights.bottleneck : 0;

  return basePriority * masteryAdjustment + urgencyComponent + bottleneckBoost;
}

// =============================================================================
// Learning Queue Management
// =============================================================================

/**
 * Recalculate priorities for all objects in a goal.
 */
export async function recalculatePriorities(
  userId: string,
  goalId: string,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): Promise<number> {
  const db = getPrisma();

  // Get goal's target domain
  const goal = await db.goalSpec.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  // Get bottleneck components
  const bottlenecks = await detectBottlenecks(userId, goalId);
  const bottleneckComponents = new Set(
    bottlenecks.filter((b) => b.isBottleneck).map((b) => b.component)
  );

  // Get all objects with mastery states
  const objects = await db.languageObject.findMany({
    where: { goalId },
    include: { masteryState: true },
  });

  const updates: Array<{ objectId: string; priority: number }> = [];

  for (const obj of objects) {
    const basePriority = calculateBasePriority(
      obj,
      goal.domain,
      weights
    );

    const mastery = obj.masteryState;
    const masteryAdjustment = mastery
      ? calculateMasteryAdjustment(
          mastery.stage,
          mastery.cueFreeAccuracy,
          mastery.cueAssistedAccuracy - mastery.cueFreeAccuracy
        )
      : 1.0;

    const urgencyScore = mastery?.nextReview
      ? calculateUrgencyScore(mastery.nextReview)
      : 1.0;

    // Map object type to component code
    const componentCode = {
      LEX: 'LEX',
      MORPH: 'MORPH',
      G2P: 'PHON',
      SYNT: 'SYNT',
      PRAG: 'PRAG',
    }[obj.type] ?? obj.type;

    const isBottleneck = bottleneckComponents.has(componentCode);

    const effectivePriority = calculateEffectivePriority(
      basePriority,
      masteryAdjustment,
      urgencyScore,
      isBottleneck,
      weights
    );

    updates.push({ objectId: obj.id, priority: effectivePriority });
  }

  await bulkUpdatePriorities(updates);

  return updates.length;
}

/**
 * Get the learning queue sorted by priority.
 */
export async function getLearningQueue(
  userId: string,
  goalId: string,
  limit: number = 20
): Promise<LearningQueueItem[]> {
  const db = getPrisma();

  // Get review queue items
  const reviewItems = await getReviewQueue(goalId, limit * 2);

  // Get bottleneck info
  const bottlenecks = await detectBottlenecks(userId, goalId);
  const bottleneckComponents = new Set(
    bottlenecks.filter((b) => b.isBottleneck).map((b) => b.component)
  );

  // Transform and add metadata
  const queueItems: LearningQueueItem[] = reviewItems.map((item) => {
    const componentCode = {
      LEX: 'LEX',
      MORPH: 'MORPH',
      G2P: 'PHON',
      SYNT: 'SYNT',
      PRAG: 'PRAG',
    }[item.type] ?? item.type;

    return {
      objectId: item.objectId,
      content: item.content,
      type: item.type,
      priority: item.priority,
      stage: item.stage,
      nextReview: item.nextReview,
      cueFreeAccuracy: item.cueFreeAccuracy,
      scaffoldingGap: item.scaffoldingGap,
      isBottleneck: bottleneckComponents.has(componentCode),
      urgencyScore: calculateUrgencyScore(item.nextReview),
    };
  });

  // Sort by effective priority (considering urgency and bottleneck)
  queueItems.sort((a, b) => {
    const aScore = a.priority + a.urgencyScore * 0.3 + (a.isBottleneck ? 0.2 : 0);
    const bScore = b.priority + b.urgencyScore * 0.3 + (b.isBottleneck ? 0.2 : 0);
    return bScore - aScore;
  });

  return queueItems.slice(0, limit);
}

/**
 * Get next item from the learning queue.
 */
export async function getNextLearningItem(
  userId: string,
  goalId: string
): Promise<LearningQueueItem | null> {
  const queue = await getLearningQueue(userId, goalId, 1);
  return queue[0] ?? null;
}

/**
 * Analyze the learning queue composition.
 */
export async function analyzeQueue(
  userId: string,
  goalId: string
): Promise<QueueAnalysis> {
  const queue = await getLearningQueue(userId, goalId, 100);
  const now = new Date();

  const componentDistribution: Record<string, number> = {};
  let dueItems = 0;
  let newItems = 0;
  let bottleneckItems = 0;
  let totalPriority = 0;

  for (const item of queue) {
    componentDistribution[item.type] = (componentDistribution[item.type] || 0) + 1;
    totalPriority += item.priority;

    if (!item.nextReview || item.nextReview <= now) {
      dueItems++;
    }
    if (item.stage === 0) {
      newItems++;
    }
    if (item.isBottleneck) {
      bottleneckItems++;
    }
  }

  return {
    totalItems: queue.length,
    dueItems,
    newItems,
    bottleneckItems,
    averagePriority: queue.length > 0 ? totalPriority / queue.length : 0,
    componentDistribution,
  };
}

// =============================================================================
// Bottleneck Integration
// =============================================================================

/**
 * Get comprehensive state analysis for decision making.
 */
export async function getStateAnalysis(
  userId: string,
  goalId: string
): Promise<{
  theta: ThetaState;
  mastery: Awaited<ReturnType<typeof getMasteryStatistics>>;
  queue: QueueAnalysis;
  primaryBottleneck: BottleneckResult | null;
}> {
  const [theta, mastery, queue, primaryBottleneck] = await Promise.all([
    getUserThetaState(userId),
    getMasteryStatistics(goalId),
    analyzeQueue(userId, goalId),
    getPrimaryBottleneck(userId, goalId),
  ]);

  return { theta, mastery, queue, primaryBottleneck };
}

// =============================================================================
// IRT-Based Item Selection
// =============================================================================

/**
 * Convert learning queue items to IRT item parameters.
 */
function toItemParameters(items: LearningQueueItem[]): ItemParameter[] {
  return items.map((item) => ({
    id: item.objectId,
    a: 1.0, // Default discrimination (can be updated from LanguageObject.irtDiscrimination)
    b: item.priority, // Use priority as proxy for difficulty until IRT params are set
  }));
}

/**
 * Apply IRT-based reordering to prioritize items matching user ability.
 * Uses Fisher Information maximization to select optimal items.
 */
export function applyIRTReordering(
  items: LearningQueueItem[],
  userTheta: number,
  topK: number = 10
): LearningQueueItem[] {
  if (items.length === 0) return [];

  // Convert to IRT parameters
  const irtItems = toItemParameters(items);

  // Create lookup map for quick access
  const itemMap = new Map(items.map((item) => [item.objectId, item]));

  // Calculate Fisher Information for each item at user's theta
  const itemsWithInfo = irtItems.map((irtItem) => ({
    id: irtItem.id,
    info: fisherInformation(userTheta, irtItem.a, irtItem.b),
  }));

  // Sort by information (highest first)
  itemsWithInfo.sort((a, b) => b.info - a.info);

  // Return top K items by information, then the rest by original priority
  const selectedIds = new Set(itemsWithInfo.slice(0, topK).map((i) => i.id));
  const selectedItems = itemsWithInfo
    .slice(0, topK)
    .map((i) => itemMap.get(i.id)!)
    .filter(Boolean);

  const remainingItems = items.filter((item) => !selectedIds.has(item.objectId));

  return [...selectedItems, ...remainingItems];
}

/**
 * Get the optimal next item using IRT item selection.
 * Considers both priority and item information at current theta.
 */
export async function getNextItemWithIRT(
  userId: string,
  goalId: string,
  usedItemIds: Set<string> = new Set()
): Promise<LearningQueueItem | null> {
  const db = getPrisma();

  // Get user theta
  const theta = await getUserThetaState(userId);

  // Get queue with priority ordering
  const queue = await getLearningQueue(userId, goalId, 50);

  // Filter out used items
  const availableItems = queue.filter((item) => !usedItemIds.has(item.objectId));

  if (availableItems.length === 0) return null;

  // Get full IRT parameters from database
  const objectIds = availableItems.map((item) => item.objectId);
  const objects = await db.languageObject.findMany({
    where: { id: { in: objectIds } },
    select: { id: true, irtDifficulty: true, irtDiscrimination: true },
  });

  const objectMap = new Map(objects.map((obj) => [obj.id, obj]));

  // Build IRT item array with actual parameters
  const irtItems: ItemParameter[] = availableItems.map((item) => {
    const obj = objectMap.get(item.objectId);
    return {
      id: item.objectId,
      a: obj?.irtDiscrimination ?? 1.0,
      b: obj?.irtDifficulty ?? 0,
    };
  });

  // Use IRT item selection (Fisher Information maximization)
  const selectedIrt = selectNextItem(theta.global, irtItems, usedItemIds);

  if (!selectedIrt) return availableItems[0];

  // Return the corresponding queue item
  return availableItems.find((item) => item.objectId === selectedIrt.id) ?? availableItems[0];
}

/**
 * Get learning queue with IRT-based reordering applied.
 */
export async function getLearningQueueWithIRT(
  userId: string,
  goalId: string,
  limit: number = 20
): Promise<LearningQueueItem[]> {
  // Get base queue
  const queue = await getLearningQueue(userId, goalId, limit * 2);

  // Get user theta
  const theta = await getUserThetaState(userId);

  // Apply IRT reordering
  const reordered = applyIRTReordering(queue, theta.global, limit);

  return reordered.slice(0, limit);
}
