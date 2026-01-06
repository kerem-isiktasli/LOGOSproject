/**
 * Priority Calculation Module
 *
 * Pure TypeScript implementation of FRE-based priority system.
 * Determines learning order based on Frequency, Relational density, and contextual contribution (E).
 *
 * From THEORETICAL-FOUNDATIONS.md and FINAL-SPEC.md
 * Formula: Priority = (w_F × F + w_R × R + w_E × E) / Cost
 *
 * Enhanced with:
 * - Pragmatics difficulty integration
 * - L1-L2 transfer coefficient adjustment
 * - Morphological/phonological complexity factors
 */

import { calculatePragmaticDifficulty, type PragmaticProfile } from './pragmatics';
import { calculateTransferGain, getTransferCoefficients } from './transfer';

// ============================================================================
// Types
// ============================================================================

export interface FREMetrics {
  frequency: number;           // F: How often in target texts (0-1)
  relationalDensity: number;   // R: Hub score, connections (0-1)
  contextualContribution: number; // E: Meaning importance (0-1)
}

export interface PriorityWeights {
  f: number;  // Frequency weight
  r: number;  // Relational density weight
  e: number;  // Contextual contribution weight
}

export interface CostFactors {
  baseDifficulty: number;     // IRT difficulty (0-1 normalized)
  transferGain: number;       // L1 similarity benefit (0-1)
  exposureNeed: number;       // How much more exposure needed (0-1)
}

export interface LanguageObject {
  id: string;
  content: string;
  type: string;
  frequency: number;
  relationalDensity: number;
  contextualContribution: number;
  irtDifficulty: number;
}

export interface UserState {
  theta: number;              // Global ability estimate
  weights: PriorityWeights;   // User's priority preferences
  l1Language?: string;        // Native language for transfer
}

export interface MasteryInfo {
  stage: number;
  nextReview: Date | null;
  cueFreeAccuracy: number;
}

export interface QueueItem {
  object: LanguageObject;
  priority: number;
  urgency: number;
  finalScore: number;
  masteryInfo?: MasteryInfo;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default priority weights.
 * Slightly favor frequency for beginners, balanced for advanced.
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  f: 0.4,   // Frequency matters most for vocabulary coverage
  r: 0.3,   // Relations help build mental networks
  e: 0.3    // Context helps with actual usage
};

/**
 * Weight adjustments by proficiency level.
 */
export const LEVEL_WEIGHT_ADJUSTMENTS: Record<string, PriorityWeights> = {
  beginner: { f: 0.5, r: 0.25, e: 0.25 },    // Focus on high-frequency
  intermediate: { f: 0.4, r: 0.3, e: 0.3 },   // Balanced
  advanced: { f: 0.3, r: 0.3, e: 0.4 }        // Focus on contextual nuance
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Compute weighted FRE score.
 *
 * FRE = w_F × F + w_R × R + w_E × E
 *
 * @param metrics - The F, R, E values for an object
 * @param weights - Priority weights (should sum to 1)
 * @returns Weighted FRE score (0-1)
 */
export function computeFRE(
  metrics: FREMetrics,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS
): number {
  return (
    weights.f * metrics.frequency +
    weights.r * metrics.relationalDensity +
    weights.e * metrics.contextualContribution
  );
}

/**
 * Compute learning cost for an object.
 *
 * Cost = BaseDifficulty - TransferGain + ExposureNeed
 *
 * Lower cost = easier to learn = higher effective priority.
 *
 * @param factors - Cost factors for the object
 * @returns Cost value (typically 0.1 to 2.0)
 */
export function computeCost(factors: CostFactors): number {
  const rawCost = factors.baseDifficulty - factors.transferGain + factors.exposureNeed;
  // Ensure positive cost (avoid division issues)
  return Math.max(0.1, rawCost);
}

/**
 * Estimate cost factors for a language object given user state.
 *
 * Uses real L1-L2 transfer coefficients when available.
 */
export function estimateCostFactors(
  object: LanguageObject,
  userState: UserState,
  targetLanguage: string = 'en'
): CostFactors {
  // Base difficulty from IRT (normalize from logit scale)
  const baseDifficulty = (object.irtDifficulty + 3) / 6; // -3 to +3 → 0 to 1

  // Transfer gain using real coefficients
  let transferGain = 0;
  if (userState.l1Language) {
    try {
      // Get transfer gain based on object type and languages
      transferGain = calculateTransferGain(
        userState.l1Language,
        targetLanguage,
        object.type
      );
    } catch {
      // Fallback if transfer module not available
      transferGain = 0.1;
    }
  }

  // Exposure need based on ability gap
  // If theta is much lower than difficulty, need more exposure
  const abilityGap = Math.max(0, object.irtDifficulty - userState.theta);
  const exposureNeed = Math.min(1, abilityGap / 3);

  return { baseDifficulty, transferGain, exposureNeed };
}

/**
 * Compute priority for a single language object.
 *
 * Priority = FRE / Cost
 *
 * Higher priority = learn first.
 *
 * @param object - Language object with FRE metrics
 * @param userState - Current user state
 * @returns Priority value (typically 0.1 to 10)
 */
export function computePriority(
  object: LanguageObject,
  userState: UserState
): number {
  const metrics: FREMetrics = {
    frequency: object.frequency,
    relationalDensity: object.relationalDensity,
    contextualContribution: object.contextualContribution
  };

  const fre = computeFRE(metrics, userState.weights);
  const costFactors = estimateCostFactors(object, userState);
  const cost = computeCost(costFactors);

  return fre / cost;
}

// ============================================================================
// Urgency Calculation (Spaced Repetition Integration)
// ============================================================================

/**
 * Compute urgency based on spaced repetition schedule.
 *
 * Urgency increases as items become overdue.
 * - Before due date: urgency = 0
 * - On due date: urgency = 1
 * - Overdue: urgency increases (max ~3)
 *
 * @param nextReview - Scheduled review date
 * @param now - Current time
 * @returns Urgency multiplier (0 to ~3)
 */
export function computeUrgency(
  nextReview: Date | null,
  now: Date
): number {
  if (!nextReview) {
    // New items have high urgency to introduce them
    return 1.5;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysOverdue = (now.getTime() - nextReview.getTime()) / msPerDay;

  if (daysOverdue < 0) {
    // Not yet due - low urgency
    return 0;
  }

  // Urgency grows with overdue days, but caps at 3
  return Math.min(3, 1 + daysOverdue * 0.5);
}

/**
 * Compute final queue score combining priority and urgency.
 *
 * Final = Priority × (1 + Urgency)
 *
 * This ensures overdue items rise to the top while still
 * respecting base priority for new items.
 */
export function computeFinalScore(priority: number, urgency: number): number {
  return priority * (1 + urgency);
}

// ============================================================================
// Queue Sorting
// ============================================================================

/**
 * Sort language objects by priority.
 *
 * @param objects - Array of language objects
 * @param userState - Current user state
 * @returns Sorted array (highest priority first)
 */
export function sortByPriority(
  objects: LanguageObject[],
  userState: UserState
): LanguageObject[] {
  return [...objects].sort((a, b) => {
    const priorityA = computePriority(a, userState);
    const priorityB = computePriority(b, userState);
    return priorityB - priorityA;  // Descending
  });
}

/**
 * Get top N priority items.
 */
export function getTopPriorityItems(
  objects: LanguageObject[],
  userState: UserState,
  count: number
): LanguageObject[] {
  return sortByPriority(objects, userState).slice(0, count);
}

/**
 * Build complete learning queue with urgency.
 *
 * @param objects - Language objects with mastery info
 * @param userState - Current user state
 * @param masteryMap - Map of object ID to mastery info
 * @param now - Current time
 * @returns Sorted queue items with scores
 */
export function buildLearningQueue(
  objects: LanguageObject[],
  userState: UserState,
  masteryMap: Map<string, MasteryInfo>,
  now: Date
): QueueItem[] {
  const items: QueueItem[] = objects.map(object => {
    const priority = computePriority(object, userState);
    const masteryInfo = masteryMap.get(object.id);
    const urgency = computeUrgency(masteryInfo?.nextReview ?? null, now);
    const finalScore = computeFinalScore(priority, urgency);

    return {
      object,
      priority,
      urgency,
      finalScore,
      masteryInfo
    };
  });

  // Sort by final score (highest first)
  return items.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Get next items for a learning session.
 *
 * Balances:
 * - Due items (urgency > 0)
 * - New items (no mastery yet)
 * - High priority items
 *
 * @param queue - Full learning queue
 * @param sessionSize - Target session size
 * @param newItemRatio - Fraction of session for new items (0-1)
 */
export function getSessionItems(
  queue: QueueItem[],
  sessionSize: number,
  newItemRatio: number = 0.3
): QueueItem[] {
  const dueItems = queue.filter(q => q.urgency > 0 && q.masteryInfo);
  const newItems = queue.filter(q => !q.masteryInfo || q.masteryInfo.stage === 0);

  const maxNewItems = Math.floor(sessionSize * newItemRatio);
  const maxDueItems = sessionSize - maxNewItems;

  const selectedDue = dueItems.slice(0, maxDueItems);
  const selectedNew = newItems.slice(0, maxNewItems);

  // Combine and re-sort
  return [...selectedDue, ...selectedNew]
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, sessionSize);
}

// ============================================================================
// Weight Adjustment
// ============================================================================

/**
 * Get adjusted weights based on user proficiency level.
 */
export function getWeightsForLevel(
  level: 'beginner' | 'intermediate' | 'advanced'
): PriorityWeights {
  return LEVEL_WEIGHT_ADJUSTMENTS[level] || DEFAULT_PRIORITY_WEIGHTS;
}

/**
 * Infer proficiency level from theta.
 */
export function inferLevel(theta: number): 'beginner' | 'intermediate' | 'advanced' {
  if (theta < -1) return 'beginner';
  if (theta < 1) return 'intermediate';
  return 'advanced';
}

// ============================================================================
// Enhanced Priority with Pragmatics & Transfer
// ============================================================================

/**
 * Extended language object with additional properties for enhanced priority.
 */
export interface ExtendedLanguageObject extends LanguageObject {
  /** Morphological complexity score (0-1) */
  morphologicalScore?: number;
  /** Phonological difficulty (0-1) */
  phonologicalScore?: number;
  /** Domain distribution (domain -> relevance) */
  domainDistribution?: Record<string, number>;
  /** Pragmatic profile if available */
  pragmaticProfile?: PragmaticProfile;
}

/**
 * Extended cost factors including pragmatics.
 */
export interface ExtendedCostFactors extends CostFactors {
  /** Pragmatic complexity (0-1) */
  pragmaticDifficulty: number;
  /** Morphological complexity modifier */
  morphologicalModifier: number;
  /** Phonological difficulty modifier */
  phonologicalModifier: number;
}

/**
 * Configuration for enhanced priority calculation.
 */
export interface EnhancedPriorityConfig {
  /** Target language */
  targetLanguage: string;
  /** User's current domain focus (e.g., 'medical', 'business') */
  focusDomain?: string;
  /** Whether to penalize pragmatically complex items for beginners */
  pragmaticPenalty: boolean;
  /** Weight for morphological complexity in cost (0-1) */
  morphologicalWeight: number;
  /** Weight for phonological complexity in cost (0-1) */
  phonologicalWeight: number;
  /** Weight for pragmatic complexity in cost (0-1) */
  pragmaticWeight: number;
}

/**
 * Default enhanced priority configuration.
 */
export const DEFAULT_ENHANCED_CONFIG: EnhancedPriorityConfig = {
  targetLanguage: 'en',
  pragmaticPenalty: true,
  morphologicalWeight: 0.15,
  phonologicalWeight: 0.10,
  pragmaticWeight: 0.20,
};

/**
 * Compute extended cost factors including pragmatics and complexity scores.
 *
 * @param object - Extended language object
 * @param userState - Current user state
 * @param config - Enhanced priority configuration
 * @returns Extended cost factors
 */
export function computeExtendedCostFactors(
  object: ExtendedLanguageObject,
  userState: UserState,
  config: EnhancedPriorityConfig = DEFAULT_ENHANCED_CONFIG
): ExtendedCostFactors {
  // Get base cost factors
  const baseCost = estimateCostFactors(object, userState, config.targetLanguage);

  // Pragmatic difficulty
  let pragmaticDifficulty = 0;
  if (object.pragmaticProfile) {
    pragmaticDifficulty = calculatePragmaticDifficulty(object.pragmaticProfile);

    // Apply beginner penalty for high pragmatic items
    if (config.pragmaticPenalty && userState.theta < 0) {
      // Beginners struggle more with pragmatically complex items
      pragmaticDifficulty *= 1 + Math.abs(userState.theta) * 0.5;
    }
  }

  // Morphological modifier (higher = harder)
  const morphologicalModifier = object.morphologicalScore ?? 0.5;

  // Phonological modifier (higher = harder)
  const phonologicalModifier = object.phonologicalScore ?? 0.5;

  return {
    ...baseCost,
    pragmaticDifficulty: Math.min(1, pragmaticDifficulty),
    morphologicalModifier,
    phonologicalModifier,
  };
}

/**
 * Compute enhanced cost incorporating all complexity factors.
 *
 * EnhancedCost = BaseCost + (MorphWeight × Morph) + (PhonWeight × Phon) + (PragWeight × Prag)
 *
 * @param factors - Extended cost factors
 * @param config - Configuration with weights
 * @returns Enhanced cost value
 */
export function computeEnhancedCost(
  factors: ExtendedCostFactors,
  config: EnhancedPriorityConfig = DEFAULT_ENHANCED_CONFIG
): number {
  const baseCost = factors.baseDifficulty - factors.transferGain + factors.exposureNeed;

  const complexityPenalty =
    config.morphologicalWeight * factors.morphologicalModifier +
    config.phonologicalWeight * factors.phonologicalModifier +
    config.pragmaticWeight * factors.pragmaticDifficulty;

  return Math.max(0.1, baseCost + complexityPenalty);
}

/**
 * Compute enhanced priority with all factors.
 *
 * This is the full S_eff(w) calculation from the spec:
 *   Priority = FRE / EnhancedCost × DomainRelevance
 *
 * @param object - Extended language object
 * @param userState - Current user state
 * @param config - Enhanced priority configuration
 * @returns Enhanced priority value with breakdown
 */
export function computeEnhancedPriority(
  object: ExtendedLanguageObject,
  userState: UserState,
  config: EnhancedPriorityConfig = DEFAULT_ENHANCED_CONFIG
): {
  priority: number;
  fre: number;
  cost: number;
  domainBoost: number;
  breakdown: {
    baseDifficulty: number;
    transferGain: number;
    pragmaticDifficulty: number;
    morphologicalModifier: number;
    phonologicalModifier: number;
  };
} {
  // Compute FRE
  const metrics: FREMetrics = {
    frequency: object.frequency,
    relationalDensity: object.relationalDensity,
    contextualContribution: object.contextualContribution,
  };
  const fre = computeFRE(metrics, userState.weights);

  // Compute extended cost
  const costFactors = computeExtendedCostFactors(object, userState, config);
  const cost = computeEnhancedCost(costFactors, config);

  // Domain relevance boost
  let domainBoost = 1.0;
  if (config.focusDomain && object.domainDistribution) {
    const domainRelevance = object.domainDistribution[config.focusDomain] ?? 0;
    // Boost items relevant to focus domain (up to 50% boost)
    domainBoost = 1 + domainRelevance * 0.5;
  }

  const priority = (fre / cost) * domainBoost;

  return {
    priority,
    fre,
    cost,
    domainBoost,
    breakdown: {
      baseDifficulty: costFactors.baseDifficulty,
      transferGain: costFactors.transferGain,
      pragmaticDifficulty: costFactors.pragmaticDifficulty,
      morphologicalModifier: costFactors.morphologicalModifier,
      phonologicalModifier: costFactors.phonologicalModifier,
    },
  };
}

/**
 * Build enhanced learning queue with all priority factors.
 *
 * @param objects - Extended language objects
 * @param userState - Current user state
 * @param masteryMap - Map of object ID to mastery info
 * @param now - Current time
 * @param config - Enhanced priority configuration
 * @returns Sorted queue items with enhanced scores
 */
export function buildEnhancedLearningQueue(
  objects: ExtendedLanguageObject[],
  userState: UserState,
  masteryMap: Map<string, MasteryInfo>,
  now: Date,
  config: EnhancedPriorityConfig = DEFAULT_ENHANCED_CONFIG
): QueueItem[] {
  const items: QueueItem[] = objects.map(object => {
    const { priority } = computeEnhancedPriority(object, userState, config);
    const masteryInfo = masteryMap.get(object.id);
    const urgency = computeUrgency(masteryInfo?.nextReview ?? null, now);
    const finalScore = computeFinalScore(priority, urgency);

    return {
      object,
      priority,
      urgency,
      finalScore,
      masteryInfo,
    };
  });

  // Sort by final score (highest first)
  return items.sort((a, b) => b.finalScore - a.finalScore);
}
