/**
 * Priority-Transfer Integration Module
 *
 * Integrates L1-L2 transfer coefficients into the priority calculation.
 * This module bridges the transfer analysis with the learning queue.
 *
 * The key insight: Words that transfer well from L1 should have LOWER priority
 * because they require less learning effort. Conversely, words with negative
 * transfer (interference) need MORE attention.
 *
 * Priority Formula with Transfer:
 *   S_eff(w) = S_base(w) × g(m) × (1 + T_penalty) + Urgency + Bottleneck
 *
 * Where T_penalty = -transferGain × 0.3 (positive transfer reduces priority)
 *                 = +|negativeTransfer| × 0.3 (negative transfer increases priority)
 *
 * @module core/priority-transfer
 */

import {
  getTransferCoefficients,
  calculateTransferGain,
  getLanguageFamily,
  type TransferCoefficients,
  type LanguageFamily,
} from './transfer';

// =============================================================================
// Types
// =============================================================================

/**
 * Transfer-adjusted priority calculation result.
 */
export interface TransferAdjustedPriority {
  /** Original base priority */
  basePriority: number;

  /** Transfer gain (0-1, higher = more L1 help) */
  transferGain: number;

  /** Transfer penalty/boost applied to priority */
  transferAdjustment: number;

  /** Final adjusted priority */
  adjustedPriority: number;

  /** Which component transfer was most relevant */
  dominantTransferComponent: keyof TransferCoefficients;

  /** Whether this word benefits from L1 transfer */
  benefitsFromTransfer: boolean;

  /** Explanation of transfer effect */
  explanation: string;
}

/**
 * Cost calculation with transfer factored in.
 * From spec: Cost = BaseDifficulty - TransferGain + ExposureNeed
 */
export interface CostWithTransfer {
  /** Base difficulty from IRT parameters */
  baseDifficulty: number;

  /** Transfer gain (reduces cost) */
  transferGain: number;

  /** Exposure need based on mastery state */
  exposureNeed: number;

  /** Final cost value */
  totalCost: number;
}

/**
 * Language pair context for transfer calculations.
 */
export interface TransferContext {
  /** Native language code */
  nativeLanguage: string;

  /** Target language code */
  targetLanguage: string;

  /** Object type for component-specific transfer */
  objectType: string;

  /** Domain for domain-specific transfer bonuses */
  domain?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Weight of transfer adjustment in priority calculation.
 * Higher values make transfer effects more pronounced.
 */
const TRANSFER_PRIORITY_WEIGHT = 0.25;

/**
 * Weight of transfer in cost calculation (from spec).
 */
const TRANSFER_COST_WEIGHT = 1.0;

/**
 * Minimum transfer effect to consider (avoid noise).
 */
const TRANSFER_THRESHOLD = 0.1;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate transfer-adjusted priority for a language object.
 *
 * @param basePriority - Original priority from FRE calculation
 * @param context - Transfer context (languages, object type, domain)
 * @returns Transfer-adjusted priority with explanation
 */
export function calculateTransferAdjustedPriority(
  basePriority: number,
  context: TransferContext
): TransferAdjustedPriority {
  // Get transfer gain for this object type
  const transferGain = calculateTransferGain(
    context.nativeLanguage,
    context.targetLanguage,
    context.objectType,
    context.domain
  );

  // Get full coefficients for analysis
  const coefficients = getTransferCoefficients(
    context.nativeLanguage,
    context.targetLanguage
  );

  // Find dominant component
  const componentMapping: Record<string, keyof TransferCoefficients> = {
    LEX: 'lexical',
    MORPH: 'morphological',
    G2P: 'phonological',
    SYNT: 'syntactic',
    PRAG: 'pragmatic',
  };

  const dominantComponent = componentMapping[context.objectType] ?? 'lexical';
  const componentTransfer = coefficients[dominantComponent];

  // Calculate adjustment:
  // - Positive transfer (gain > 0.5): reduce priority (easier to learn)
  // - Negative transfer (gain < 0.5): increase priority (needs more attention)
  // - Neutral transfer (gain ≈ 0.5): no adjustment
  const normalizedGain = transferGain - 0.5; // Center around 0
  const transferAdjustment = -normalizedGain * TRANSFER_PRIORITY_WEIGHT;

  // Apply adjustment to priority
  const adjustedPriority = Math.max(0, Math.min(1,
    basePriority * (1 + transferAdjustment)
  ));

  // Determine if beneficial
  const benefitsFromTransfer = transferGain > 0.6;

  // Generate explanation
  const l1Family = getLanguageFamily(context.nativeLanguage);
  let explanation: string;

  if (componentTransfer > 0.5) {
    explanation = `Positive ${dominantComponent} transfer from ${l1Family} reduces learning effort`;
  } else if (componentTransfer < -0.1) {
    explanation = `Negative ${dominantComponent} transfer from ${l1Family} may cause interference`;
  } else {
    explanation = `Minimal transfer effect for ${dominantComponent} component`;
  }

  return {
    basePriority,
    transferGain,
    transferAdjustment,
    adjustedPriority,
    dominantTransferComponent: dominantComponent,
    benefitsFromTransfer,
    explanation,
  };
}

/**
 * Calculate cost with transfer factored in.
 * Implements: Cost = BaseDifficulty - TransferGain + ExposureNeed
 *
 * @param baseDifficulty - IRT difficulty parameter
 * @param exposureNeed - How much more exposure is needed (0-1)
 * @param context - Transfer context
 * @returns Cost calculation breakdown
 */
export function calculateCostWithTransfer(
  baseDifficulty: number,
  exposureNeed: number,
  context: TransferContext
): CostWithTransfer {
  const transferGain = calculateTransferGain(
    context.nativeLanguage,
    context.targetLanguage,
    context.objectType,
    context.domain
  );

  // Cost formula from spec
  const totalCost = baseDifficulty - (transferGain * TRANSFER_COST_WEIGHT) + exposureNeed;

  return {
    baseDifficulty,
    transferGain,
    exposureNeed,
    totalCost: Math.max(0, totalCost), // Cost can't be negative
  };
}

/**
 * Calculate complete priority with all factors including transfer.
 * This is the full S_eff(w) calculation.
 *
 * @param params - All priority calculation parameters
 * @returns Final effective priority
 */
export function calculateFullPriority(params: {
  // Base metrics
  frequency: number;
  relationalDensity: number;
  domainRelevance: number;
  morphological: number;
  phonological: number;
  pragmatic: number;

  // Mastery state
  masteryStage: number;
  cueFreeAccuracy: number;
  scaffoldingGap: number;

  // Scheduling
  urgencyScore: number;
  isBottleneck: boolean;

  // Transfer context
  nativeLanguage: string;
  targetLanguage: string;
  objectType: string;
  domain?: string;

  // Optional weights
  weights?: {
    frequency: number;
    relational: number;
    domain: number;
    morphological: number;
    phonological: number;
    pragmatic: number;
    urgency: number;
    bottleneck: number;
  };
}): {
  priority: number;
  components: {
    fre: number;
    mastery: number;
    urgency: number;
    bottleneck: number;
    transfer: number;
  };
} {
  const weights = params.weights ?? {
    frequency: 0.18,
    relational: 0.14,
    domain: 0.14,
    morphological: 0.09,
    phonological: 0.09,
    pragmatic: 0.08,
    urgency: 0.18,
    bottleneck: 0.10,
  };

  // 1. Calculate base FRE score
  const fre =
    weights.frequency * params.frequency +
    weights.relational * params.relationalDensity +
    weights.domain * params.domainRelevance +
    weights.morphological * params.morphological +
    weights.phonological * params.phonological +
    weights.pragmatic * params.pragmatic;

  // 2. Calculate mastery adjustment g(m)
  const mastery = calculateMasteryFactor(
    params.masteryStage,
    params.cueFreeAccuracy,
    params.scaffoldingGap
  );

  // 3. Get transfer adjustment
  const transferResult = calculateTransferAdjustedPriority(fre, {
    nativeLanguage: params.nativeLanguage,
    targetLanguage: params.targetLanguage,
    objectType: params.objectType,
    domain: params.domain,
  });

  // 4. Urgency component
  const urgency = weights.urgency * params.urgencyScore;

  // 5. Bottleneck boost
  const bottleneck = params.isBottleneck ? weights.bottleneck : 0;

  // 6. Combine all factors
  const priority =
    transferResult.adjustedPriority * mastery +
    urgency +
    bottleneck;

  return {
    priority: Math.max(0, Math.min(1, priority)),
    components: {
      fre,
      mastery,
      urgency,
      bottleneck,
      transfer: transferResult.transferAdjustment,
    },
  };
}

/**
 * Internal helper: Calculate mastery factor g(m).
 * Implements inverted U-curve from ZPD theory.
 */
function calculateMasteryFactor(
  stage: number,
  cueFreeAccuracy: number,
  scaffoldingGap: number
): number {
  // Convert to mastery estimate (0-1)
  const stageMastery = stage / 4;
  const mastery = (stageMastery + cueFreeAccuracy) / 2;

  // Inverted U-curve
  let masteryFactor: number;

  if (mastery < 0.2) {
    masteryFactor = 0.5; // Foundation lacking
  } else if (mastery <= 0.7) {
    // ZPD - peak at 0.45
    const midpoint = 0.45;
    if (mastery <= midpoint) {
      masteryFactor = 0.8 + (mastery - 0.2) * (0.2 / (midpoint - 0.2));
    } else {
      masteryFactor = 1.0 - (mastery - midpoint) * (0.2 / (0.7 - midpoint));
    }
  } else if (mastery <= 0.9) {
    masteryFactor = 0.8 - (mastery - 0.7) * (0.5 / 0.2);
  } else {
    masteryFactor = 0.3; // Mastered
  }

  // Scaffolding gap adjustment
  const gapFactor = 1 + scaffoldingGap * 0.5;

  return masteryFactor * gapFactor;
}

/**
 * Batch calculate transfer adjustments for multiple objects.
 * More efficient than calling individually.
 *
 * @param objects - Array of objects with type and priority
 * @param context - Common transfer context (languages, domain)
 * @returns Map of object ID to transfer-adjusted priority
 */
export function batchCalculateTransfer(
  objects: Array<{
    id: string;
    type: string;
    priority: number;
  }>,
  context: Omit<TransferContext, 'objectType'>
): Map<string, TransferAdjustedPriority> {
  const results = new Map<string, TransferAdjustedPriority>();

  for (const obj of objects) {
    const result = calculateTransferAdjustedPriority(obj.priority, {
      ...context,
      objectType: obj.type,
    });
    results.set(obj.id, result);
  }

  return results;
}

/**
 * Get transfer summary for a user's language pair.
 * Useful for displaying to the user or analytics.
 */
export function getTransferSummary(
  nativeLanguage: string,
  targetLanguage: string
): {
  overallTransfer: number;
  strengths: string[];
  challenges: string[];
  recommendations: string[];
} {
  const coefficients = getTransferCoefficients(nativeLanguage, targetLanguage);
  const l1Family = getLanguageFamily(nativeLanguage);

  const strengths: string[] = [];
  const challenges: string[] = [];
  const recommendations: string[] = [];

  // Analyze each component
  if (coefficients.lexical > 0.5) {
    strengths.push('Many vocabulary cognates available');
  } else if (coefficients.lexical < 0) {
    challenges.push('Few shared vocabulary roots');
    recommendations.push('Focus on building core vocabulary through spaced repetition');
  }

  if (coefficients.phonological > 0.5) {
    strengths.push('Similar sound system aids pronunciation');
  } else if (coefficients.phonological < 0) {
    challenges.push('Different phoneme inventory may cause pronunciation difficulties');
    recommendations.push('Practice with audio exercises and minimal pairs');
  }

  if (coefficients.morphological > 0.5) {
    strengths.push('Familiar word formation patterns');
  } else if (coefficients.morphological < 0) {
    challenges.push('Different morphological system requires adjustment');
    recommendations.push('Study common affixes and word families');
  }

  if (coefficients.syntactic > 0.5) {
    strengths.push('Similar sentence structure');
  } else if (coefficients.syntactic < -0.2) {
    challenges.push('Different word order patterns (potential interference)');
    recommendations.push('Practice sentence construction exercises');
  }

  if (coefficients.pragmatic > 0.3) {
    strengths.push('Similar communication conventions');
  } else if (coefficients.pragmatic < 0) {
    challenges.push('Different politeness and directness norms');
    recommendations.push('Study register-appropriate expressions');
  }

  // Calculate overall transfer
  const values = Object.values(coefficients);
  const overallTransfer = (values.reduce((a, b) => a + b, 0) / values.length + 1) / 2;

  return {
    overallTransfer,
    strengths,
    challenges,
    recommendations,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  calculateTransferAdjustedPriority,
  calculateCostWithTransfer,
  calculateFullPriority,
  batchCalculateTransfer,
  getTransferSummary,
  TRANSFER_PRIORITY_WEIGHT,
  TRANSFER_COST_WEIGHT,
  TRANSFER_THRESHOLD,
};
