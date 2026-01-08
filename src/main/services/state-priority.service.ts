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
import { selectNextItem, fisherInformation } from '../../core/irt';
import type { ComponentCode, ItemParameter, GeneralizationEstimate } from '../../core/types';
import { getBlockingComponents } from './component-prerequisite.service';
import { estimateGeneralization } from './generalization-estimation.service';

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
  syntactic: number;      // SYNT weight - Lu (2010, 2011) L2SCA complexity
  pragmatic: number;      // Pragmatic/register fit weight
  urgency: number;        // Review urgency weight
  bottleneck: number;     // Bottleneck boost weight
  prerequisite: number;   // Blocking component boost weight (Processability Theory)
  coverageGap: number;    // Usage space coverage gap weight (Generalization)
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

/**
 * Default priority weights for the FRE formula.
 *
 * Weight distribution rationale (sum = 1.0):
 * - Linguistic features (F, R, D, M, P, SYNT, PRAG): 60% - core learning priority
 * - Scheduling factors (urgency, bottleneck): 20% - temporal adjustments
 * - Processability/Transfer (prerequisite, coverageGap): 20% - developmental sequencing
 *
 * References:
 * - Lu, X. (2010, 2011) for syntactic complexity weighting
 * - Nation (2006) for frequency/relational importance
 * - Pienemann (1998, 2005) for Processability Theory
 * - Perkins & Salomon (1992) for transfer of learning
 */
const DEFAULT_WEIGHTS: PriorityWeights = {
  frequency: 0.14,       // F: corpus frequency - foundation of vocabulary selection
  relational: 0.10,      // R: hub connectivity - network centrality
  domain: 0.10,          // D: domain relevance - goal alignment
  morphological: 0.06,   // M: morphological productivity
  phonological: 0.06,    // P: phonological difficulty (L1-L2 transfer)
  syntactic: 0.07,       // SYNT: syntactic complexity (Lu L2SCA)
  pragmatic: 0.07,       // PRAG: register/pragmatic fit
  urgency: 0.14,         // Temporal: review scheduling priority
  bottleneck: 0.06,      // Adaptive: error pattern boosting
  prerequisite: 0.12,    // Processability: blocking component boost
  coverageGap: 0.08,     // Generalization: usage space expansion priority
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
 *
 * Implements the complete 7-dimension linguistic feature vector:
 * z(w) = [F, R, D, M, P, SYNT, PRAG]
 *
 * Each dimension is normalized to [0, 1] and weighted according to
 * empirical importance for L2 acquisition.
 *
 * References:
 * - Nation (2006): Frequency and collocational importance
 * - Lu (2010, 2011): Syntactic complexity metrics (L2SCA)
 * - Crossley et al. (2011): Domain and register effects
 */
export function calculateBasePriority(
  object: {
    frequency: number;
    relationalDensity: number;
    domainDistribution: string | null;
    morphologicalScore: number | null;
    phonologicalDifficulty: number | null;
    syntacticComplexity?: number | null;
    pragmaticScore?: number | null;
  },
  targetDomain: string,
  targetRegister?: string,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number {
  // F: Frequency (higher = more important for acquisition)
  // Log-normalized corpus frequency, range [0, 1]
  const F = object.frequency;

  // R: Relational density (hub score, PMI-weighted centrality)
  // Higher values indicate more collocational connections
  const R = object.relationalDensity;

  // D: Domain relevance (distribution in target domain)
  let D = 0.5; // Default if no domain data
  if (object.domainDistribution) {
    try {
      const domains = typeof object.domainDistribution === 'string'
        ? JSON.parse(object.domainDistribution)
        : object.domainDistribution;
      D = domains[targetDomain] ?? 0.5;
    } catch {
      D = 0.5;
    }
  }

  // M: Morphological complexity
  // familySize × productivity × log(familyFrequencySum)
  const M = object.morphologicalScore ?? 0.5;

  // P: Phonological difficulty
  // g2pEntropy + syllableComplexity + errorPronePatterns
  const P = object.phonologicalDifficulty ?? 0.5;

  // SYNT: Syntactic complexity (Lu, 2010, 2011)
  // Based on L2SCA metrics: MLC, CN/C, DC/C normalized to [0, 1]
  // Higher complexity items may need more practice but also offer more learning value
  const SYNT = object.syntacticComplexity ?? 0.5;

  // PRAG: Pragmatic/register fit score
  // registerVariance + contextSensitivity + formalityRange
  const PRAG = object.pragmaticScore ?? 0.5;

  // Weighted sum of all 7 z(w) dimensions
  // Note: urgency and bottleneck weights are applied separately in calculateEffectivePriority
  const S_base =
    weights.frequency * F +
    weights.relational * R +
    weights.domain * D +
    weights.morphological * M +
    weights.phonological * P +
    weights.syntactic * SYNT +
    weights.pragmatic * PRAG;

  return Math.min(1, Math.max(0, S_base));
}

/**
 * Continuous g(m) function based on mastery level.
 * Implements inverted U-curve from DEVELOPMENT-PROTOCOL.md:
 * - g(m < 0.2) = 0.5 (Foundation lacking)
 * - g(m ∈ [0.2, 0.7]) = 0.8-1.0 (Optimal zone - ZPD)
 * - g(m > 0.9) = 0.3 (Mastered)
 */
export function calculateMasteryFunction(mastery: number): number {
  if (mastery < 0.2) {
    // Foundation lacking - moderate priority
    return 0.5;
  } else if (mastery <= 0.7) {
    // Optimal learning zone (ZPD) - highest priority
    // Linear interpolation from 0.8 at m=0.2 to 1.0 at m=0.45, then back to 0.8 at m=0.7
    // Peak at m=0.45 (exactly in middle of ZPD)
    const midpoint = 0.45;
    if (mastery <= midpoint) {
      return 0.8 + (mastery - 0.2) * (0.2 / (midpoint - 0.2)); // 0.8 to 1.0
    } else {
      return 1.0 - (mastery - midpoint) * (0.2 / (0.7 - midpoint)); // 1.0 to 0.8
    }
  } else if (mastery <= 0.9) {
    // Getting easier - declining priority
    return 0.8 - (mastery - 0.7) * (0.5 / 0.2); // 0.8 to 0.3
  } else {
    // Mastered - low priority (maintenance only)
    return 0.3;
  }
}

/**
 * Calculate mastery adjustment g(m) for Zone of Proximal Development.
 * Items slightly above current ability get highest priority.
 * Now uses continuous g(m) function based on actual mastery level.
 */
export function calculateMasteryAdjustment(
  stage: number,
  cueFreeAccuracy: number,
  scaffoldingGap: number
): number {
  // Convert accuracy to mastery estimate (0-1 scale)
  // Use combination of stage and accuracy for more accurate mastery
  const stageMastery = stage / 4; // 0, 0.25, 0.5, 0.75, 1.0
  const mastery = (stageMastery + cueFreeAccuracy) / 2;

  // Use continuous g(m) function
  const masteryFactor = calculateMasteryFunction(mastery);

  // Scaffolding gap factor: items with high gap need more practice
  // High gap (>0.3) indicates cue-dependency, boost priority
  const gapFactor = 1 + scaffoldingGap * 0.5;

  return masteryFactor * gapFactor;
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
 *
 * Combines base priority with mastery adjustment, urgency, bottleneck boost,
 * prerequisite boost (Processability Theory), and coverage gap adjustment.
 * Output is clamped to [0, 1] range for consistency with IRT scale expectations.
 *
 * Extended priority formula:
 * S_eff(w) = S_base(w) × g(m) + urgency + bottleneck + prerequisite + coverageGap
 *
 * @param basePriority - Base priority from z(w) vector (FRE formula)
 * @param masteryAdjustment - g(m) function output (ZPD adjustment)
 * @param urgencyScore - Review urgency score (0-1)
 * @param isBottleneck - Whether this object is in a bottleneck component
 * @param prerequisiteBoost - Boost for objects that unblock higher components (0-1)
 * @param coverageGapScore - Coverage gap for generalization expansion (0-1)
 * @param weights - Priority weight configuration
 */
export function calculateEffectivePriority(
  basePriority: number,
  masteryAdjustment: number,
  urgencyScore: number,
  isBottleneck: boolean,
  prerequisiteBoost: number = 0,
  coverageGapScore: number = 0,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number {
  const urgencyComponent = weights.urgency * urgencyScore;
  const bottleneckBoost = isBottleneck ? weights.bottleneck : 0;

  // Prerequisite boost: Higher for objects in blocking components
  // Objects in components that block higher-level learning get priority
  const prerequisiteComponent = weights.prerequisite * prerequisiteBoost;

  // Coverage gap: Higher for objects with low usage space coverage
  // Encourages expansion into new contexts for better generalization
  const coverageGapComponent = weights.coverageGap * coverageGapScore;

  const rawPriority =
    basePriority * masteryAdjustment +
    urgencyComponent +
    bottleneckBoost +
    prerequisiteComponent +
    coverageGapComponent;

  // Clamp to [0, 1] range for consistency
  return Math.min(1, Math.max(0, rawPriority));
}

// =============================================================================
// Learning Queue Management
// =============================================================================

/**
 * Recalculate priorities for all objects in a goal.
 *
 * Integrates:
 * - FRE-based base priority from z(w) vector
 * - ZPD mastery adjustment g(m)
 * - Review urgency score
 * - Bottleneck component boost
 * - Prerequisite blocking boost (Processability Theory)
 * - Usage space coverage gap (Generalization estimation)
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

  // Get blocking components (Processability Theory integration)
  // Components that need stabilization to unlock higher-level learning
  const blockingComponents = await getBlockingComponents(userId, goalId);
  const blockingComponentMap = new Map(
    blockingComponents.map((bc) => [bc.component, bc.automationGap])
  );

  // Get all objects with mastery states
  const objects = await db.languageObject.findMany({
    where: { goalId },
    include: { masteryState: true },
  });

  const updates: Array<{ objectId: string; priority: number }> = [];

  // Pre-calculate generalization estimates for efficient batch processing
  // Note: This can be expensive; consider caching for production
  const generalizationCache = new Map<string, GeneralizationEstimate>();

  for (const obj of objects) {
    const basePriority = calculateBasePriority(
      obj,
      goal.domain,
      undefined, // No target register filter
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
    const componentCode = mapTypeToComponentCode(obj.type);
    const isBottleneck = bottleneckComponents.has(componentCode);

    // Calculate prerequisite boost based on blocking status
    // Objects in blocking components get higher priority to unblock higher-level learning
    let prerequisiteBoost = 0;
    if (blockingComponentMap.has(componentCode)) {
      const automationGap = blockingComponentMap.get(componentCode)!;
      // Higher automation gap = higher priority (normalized to 0-1)
      // Objects in blocking components get 2-3x boost proportional to gap
      prerequisiteBoost = Math.min(1, automationGap * 2);
    }

    // Calculate coverage gap for generalization-based priority
    // Low coverage = high gap = higher priority for expansion
    let coverageGapScore = 0;
    try {
      // Lazy load generalization estimate (expensive operation)
      if (!generalizationCache.has(obj.id)) {
        const estimate = await estimateGeneralization(
          obj.id,
          componentCode,
          [] // Goal contexts would be populated from goal configuration
        );
        generalizationCache.set(obj.id, estimate);
      }

      const genEstimate = generalizationCache.get(obj.id);
      if (genEstimate) {
        // Invert coverage: low coverage = high gap score
        coverageGapScore = Math.max(0, 1 - genEstimate.estimatedTotalCoverage);
      }
    } catch {
      // If generalization fails, skip coverage gap (graceful degradation)
      coverageGapScore = 0;
    }

    const effectivePriority = calculateEffectivePriority(
      basePriority,
      masteryAdjustment,
      urgencyScore,
      isBottleneck,
      prerequisiteBoost,
      coverageGapScore,
      weights
    );

    updates.push({ objectId: obj.id, priority: effectivePriority });
  }

  await bulkUpdatePriorities(updates);

  return updates.length;
}

/**
 * Map object type string to ComponentCode.
 */
function mapTypeToComponentCode(type: string): ComponentCode {
  const mapping: Record<string, ComponentCode> = {
    LEX: 'LEX',
    MORPH: 'MORPH',
    G2P: 'PHON',
    PHON: 'PHON',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };
  return mapping[type] || 'LEX';
}

/**
 * Get the learning queue sorted by priority.
 *
 * Queue sorting considers:
 * - Pre-calculated priority (from recalculatePriorities)
 * - Urgency score for overdue items
 * - Bottleneck component status
 * - Blocking component boost (Processability Theory)
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

  // Get blocking components for prerequisite-aware sorting
  const blockingComponents = await getBlockingComponents(userId, goalId);
  const blockingComponentSet = new Set(
    blockingComponents.map((bc) => bc.component)
  );

  // Transform and add metadata
  const queueItems: LearningQueueItem[] = reviewItems.map((item) => {
    const componentCode = mapTypeToComponentCode(item.type);

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

  // Sort by effective priority (considering urgency, bottleneck, and blocking status)
  queueItems.sort((a, b) => {
    const aComponent = mapTypeToComponentCode(a.type);
    const bComponent = mapTypeToComponentCode(b.type);

    // Blocking component boost (Processability Theory)
    const aBlockingBoost = blockingComponentSet.has(aComponent) ? 0.15 : 0;
    const bBlockingBoost = blockingComponentSet.has(bComponent) ? 0.15 : 0;

    const aScore =
      a.priority +
      a.urgencyScore * 0.3 +
      (a.isBottleneck ? 0.2 : 0) +
      aBlockingBoost;
    const bScore =
      b.priority +
      b.urgencyScore * 0.3 +
      (b.isBottleneck ? 0.2 : 0) +
      bBlockingBoost;

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
 * Transform priority (0-1) to IRT difficulty scale (logit, -3 to +3).
 *
 * IRT difficulty parameter b follows the logit scale where:
 * - b = -3: very easy item (95% correct for average ability)
 * - b = 0: average difficulty (50% correct for average ability)
 * - b = +3: very hard item (5% correct for average ability)
 *
 * Reference: Baker, F. B., & Kim, S. H. (2004). Item Response Theory:
 * Parameter Estimation Techniques (2nd ed.). Marcel Dekker.
 *
 * @param priority - Priority value in [0, 1] range
 * @returns IRT difficulty b in [-3, +3] range (logit scale)
 */
function priorityToIRTDifficulty(priority: number): number {
  // Linear transformation: priority [0, 1] → b [-3, +3]
  // priority 0 → b -3 (easy)
  // priority 0.5 → b 0 (medium)
  // priority 1 → b +3 (hard)
  return 6 * priority - 3;
}

/**
 * Convert learning queue items to IRT item parameters.
 *
 * Note: The b parameter must be on the logit scale (-3 to +3), not the
 * priority scale (0-1). If irtDifficulty is not available, we transform
 * priority to the IRT scale using linear mapping.
 *
 * Reference: Baker & Kim (2004) - Item Response Theory
 */
function toItemParameters(items: LearningQueueItem[]): ItemParameter[] {
  return items.map((item) => ({
    id: item.objectId,
    a: 1.0, // Default discrimination (can be updated from LanguageObject.irtDiscrimination)
    // Transform priority (0-1) to IRT b scale (-3 to +3)
    // This is a fallback; getNextItemWithIRT uses actual irtDifficulty when available
    b: priorityToIRTDifficulty(item.priority),
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
