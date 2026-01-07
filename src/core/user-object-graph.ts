/**
 * LOGOS User-Object Relationship Graph Module
 *
 * Tracks and analyzes the relationship between users and learning objects,
 * including encounter patterns, success rates, and modality balance.
 *
 * Academic Foundations:
 * - Deep Knowledge Tracing (Piech et al., 2015) - LSTM-based student modeling
 * - DyGKT (2024) - Dynamic graph learning for knowledge tracing
 * - Knowledge Relation Rank (PMC 2023) - Heterogeneous learning interaction modeling
 *
 * This module implements:
 * 1. Encounter recording with full context
 * 2. Interpretation/Production ratio tracking
 * 3. Modality balance analysis
 * 4. Learning cost estimation
 * 5. Derived effect calculation (cascade benefits)
 *
 * @module core/user-object-graph
 */

import type { TaskType, TaskFormat, TaskModality } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Task category: interpretation (receptive) vs production (generative)
 *
 * Based on the distinction in language learning research between:
 * - Receptive skills (reading, listening) - interpretation
 * - Productive skills (writing, speaking) - production
 */
export type TaskCategory = 'interpretation' | 'production';

/**
 * Context in which an encounter occurred.
 * Captures all relevant dimensions for later analysis.
 */
export interface EncounterContext {
  /** High-level task category */
  taskCategory: TaskCategory;

  /** Specific task type */
  taskType: TaskType;

  /** Task format (MCQ, fill-blank, etc.) */
  taskFormat: TaskFormat;

  /** Sensory modality used */
  modality: TaskModality;

  /** Domain context (medical, legal, etc.) */
  domain: string;

  /** Genre within domain (optional) */
  genre?: string;

  /** User's theta at time of encounter */
  userTheta: number;

  /** Item's IRT difficulty parameter */
  itemDifficulty: number;
}

/**
 * Outcome of an encounter.
 */
export interface EncounterOutcome {
  /** Whether the response was correct */
  successful: boolean;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Cue level used (0 = cue-free) */
  cueLevel: number;
}

/**
 * A single encounter record.
 */
export interface ObjectEncounter {
  id: string;
  createdAt: Date;
  objectId: string;
  userId: string;
  context: EncounterContext;
  outcome: EncounterOutcome;
}

/**
 * Aggregated statistics for a user-object relationship.
 *
 * Tracks encounter patterns, success rates, and derived metrics
 * that inform learning prioritization and task selection.
 */
export interface ObjectRelationshipStats {
  objectId: string;
  userId: string;
  updatedAt: Date;

  // ========== Encounter Counts ==========
  totalEncounters: number;
  interpretationEncounters: number;
  productionEncounters: number;
  visualEncounters: number;
  auditoryEncounters: number;
  mixedEncounters: number;

  // ========== Success Rates ==========
  overallSuccessRate: number;
  interpretationSuccessRate: number;
  productionSuccessRate: number;
  visualSuccessRate: number;
  auditorySuccessRate: number;
  mixedSuccessRate: number;

  // ========== Ratios & Balance ==========
  /** 0 = all production, 1 = all interpretation */
  interpretationRatio: number;

  /** 0 = single modality, 1 = perfectly balanced */
  modalityBalance: number;

  // ========== Domain Exposure ==========
  domainExposure: Record<string, number>;

  // ========== Learning Economics ==========
  estimatedLearningCost: number;
  derivedEffectScore: number;

  // ========== Temporal Patterns ==========
  lastEncounter: Date | null;
  avgInterEncounterDays: number;

  // ========== Strength Indicators ==========
  knowledgeStrength: number;
  retrievalFluency: number;
}

/**
 * Complete profile of a user-object relationship.
 * Extends stats with additional computed metrics.
 */
export interface ObjectRelationshipProfile extends ObjectRelationshipStats {
  /** Trend direction: positive = improving, negative = declining */
  progressTrend: number;

  /** Recommended next task type based on balance */
  recommendedTaskCategory: TaskCategory;

  /** Recommended modality to balance exposure */
  recommendedModality: TaskModality;

  /** Gaps in exposure that should be addressed */
  exposureGaps: {
    category: TaskCategory | null;
    modality: TaskModality | null;
    domain: string | null;
  };
}

/**
 * Visualization data for relationship graphs.
 */
export interface RelationshipVisualizationData {
  /** For pie/donut charts of task category distribution */
  categoryDistribution: {
    interpretation: number;
    production: number;
  };

  /** For pie/donut charts of modality distribution */
  modalityDistribution: {
    visual: number;
    auditory: number;
    mixed: number;
  };

  /** For bar charts of success rates */
  successRates: {
    overall: number;
    interpretation: number;
    production: number;
    visual: number;
    auditory: number;
    mixed: number;
  };

  /** For line charts of progress over time */
  progressTimeline: Array<{
    date: Date;
    successRate: number;
    encounters: number;
  }>;

  /** For radar charts of multi-dimensional strength */
  strengthRadar: {
    interpretationStrength: number;
    productionStrength: number;
    visualStrength: number;
    auditoryStrength: number;
    fluency: number;
    retention: number;
  };
}

// ============================================================================
// Task Category Classification
// ============================================================================

/**
 * Interpretation task types - receptive skills
 * Based on language acquisition research distinguishing receptive from productive skills
 */
const INTERPRETATION_TASK_TYPES: Set<string> = new Set([
  'recognition',
  'definition_match',
  'synonym_match',
  'listening_comprehension',
  'reading_comprehension',
  'context_identification',
  'collocation_recognition',
]);

/**
 * Production task types - generative skills
 */
const PRODUCTION_TASK_TYPES: Set<string> = new Set([
  'recall_free',
  'recall_cued',
  'production',
  'translation',
  'sentence_completion',
  'free_response',
  'speaking',
  'writing',
  'dictation',
]);

/**
 * Classifies a task type into interpretation or production category.
 *
 * @param taskType - The specific task type
 * @returns The task category
 */
export function classifyTaskCategory(taskType: string): TaskCategory {
  if (INTERPRETATION_TASK_TYPES.has(taskType)) {
    return 'interpretation';
  }
  if (PRODUCTION_TASK_TYPES.has(taskType)) {
    return 'production';
  }

  // Default classification based on task characteristics
  // Recognition-like tasks default to interpretation
  if (taskType.includes('recognition') || taskType.includes('match')) {
    return 'interpretation';
  }

  // Production-like tasks default to production
  if (
    taskType.includes('production') ||
    taskType.includes('recall') ||
    taskType.includes('response')
  ) {
    return 'production';
  }

  // Timed tasks default to production (require active retrieval)
  if (taskType === 'timed') {
    return 'production';
  }

  // Default to interpretation as the safer assumption
  return 'interpretation';
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Creates a new encounter record.
 *
 * @param objectId - The language object ID
 * @param userId - The user ID
 * @param context - Encounter context
 * @param outcome - Encounter outcome
 * @returns The new encounter record
 */
export function createEncounter(
  objectId: string,
  userId: string,
  context: EncounterContext,
  outcome: EncounterOutcome
): ObjectEncounter {
  return {
    id: generateId(),
    createdAt: new Date(),
    objectId,
    userId,
    context,
    outcome,
  };
}

/**
 * Calculates the interpretation/production ratio from encounters.
 *
 * @param encounters - Array of encounters
 * @returns Ratio from 0 (all production) to 1 (all interpretation)
 */
export function calculateInterpretationProductionRatio(
  encounters: ObjectEncounter[]
): number {
  if (encounters.length === 0) return 0.5;

  const interpretationCount = encounters.filter(
    (e) => e.context.taskCategory === 'interpretation'
  ).length;

  return interpretationCount / encounters.length;
}

/**
 * Calculates how balanced the modality exposure is.
 *
 * Uses normalized entropy to measure balance:
 * - 0 = single modality only
 * - 1 = perfectly balanced across all modalities
 *
 * @param encounters - Array of encounters
 * @returns Balance score from 0 to 1
 */
export function calculateModalityBalance(encounters: ObjectEncounter[]): number {
  if (encounters.length === 0) return 0;

  const counts: Record<string, number> = {
    visual: 0,
    auditory: 0,
    mixed: 0,
  };

  encounters.forEach((e) => {
    const modality = e.context.modality;
    if (modality in counts) {
      counts[modality]++;
    }
  });

  const total = encounters.length;
  const probabilities = Object.values(counts).map((c) => c / total);

  // Calculate Shannon entropy
  let entropy = 0;
  probabilities.forEach((p) => {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  });

  // Normalize by maximum entropy (log2(3) for 3 modalities)
  const maxEntropy = Math.log2(3);
  return entropy / maxEntropy;
}

/**
 * Calculates success rate for a subset of encounters.
 *
 * @param encounters - Array of encounters
 * @param filter - Optional filter function
 * @returns Success rate from 0 to 1
 */
export function calculateSuccessRate(
  encounters: ObjectEncounter[],
  filter?: (e: ObjectEncounter) => boolean
): number {
  const filtered = filter ? encounters.filter(filter) : encounters;

  if (filtered.length === 0) return 0;

  const successCount = filtered.filter((e) => e.outcome.successful).length;
  return successCount / filtered.length;
}

/**
 * Calculates retrieval fluency based on response times.
 *
 * Uses a sigmoid function to map response times to fluency scores:
 * - Fast responses (< 1000ms) → high fluency
 * - Slow responses (> 5000ms) → low fluency
 *
 * @param encounters - Array of encounters
 * @returns Fluency score from 0 to 1
 */
export function calculateRetrievalFluency(
  encounters: ObjectEncounter[]
): number {
  if (encounters.length === 0) return 0;

  // Only consider successful responses for fluency
  const successfulEncounters = encounters.filter((e) => e.outcome.successful);

  if (successfulEncounters.length === 0) return 0;

  // Calculate average response time
  const avgResponseTime =
    successfulEncounters.reduce((sum, e) => sum + e.outcome.responseTimeMs, 0) /
    successfulEncounters.length;

  // Sigmoid mapping: 1000ms → 0.5, faster = higher, slower = lower
  // k controls steepness, x0 is the midpoint
  const k = 0.002;
  const x0 = 2000; // midpoint at 2 seconds

  return 1 / (1 + Math.exp(k * (avgResponseTime - x0)));
}

/**
 * Calculates composite knowledge strength.
 *
 * Combines multiple factors:
 * - Success rate (weight: 0.4)
 * - Retrieval fluency (weight: 0.2)
 * - Modality balance (weight: 0.1)
 * - Interpretation/production balance (weight: 0.1)
 * - Recency decay (weight: 0.2)
 *
 * @param stats - Current relationship stats
 * @returns Knowledge strength from 0 to 1
 */
export function calculateKnowledgeStrength(
  stats: ObjectRelationshipStats
): number {
  const weights = {
    successRate: 0.4,
    fluency: 0.2,
    modalityBalance: 0.1,
    categoryBalance: 0.1,
    recency: 0.2,
  };

  // Success rate contribution
  const successComponent = stats.overallSuccessRate * weights.successRate;

  // Fluency contribution
  const fluencyComponent = stats.retrievalFluency * weights.fluency;

  // Modality balance contribution
  const modalityComponent = stats.modalityBalance * weights.modalityBalance;

  // Category balance (closer to 0.5 = better)
  const categoryImbalance = Math.abs(stats.interpretationRatio - 0.5);
  const categoryComponent = (1 - 2 * categoryImbalance) * weights.categoryBalance;

  // Recency contribution (decay over time)
  let recencyComponent = 0;
  if (stats.lastEncounter) {
    const daysSinceEncounter =
      (Date.now() - stats.lastEncounter.getTime()) / (1000 * 60 * 60 * 24);
    // Half-life of 30 days
    recencyComponent =
      Math.exp(-0.693 * (daysSinceEncounter / 30)) * weights.recency;
  }

  return (
    successComponent +
    fluencyComponent +
    modalityComponent +
    categoryComponent +
    recencyComponent
  );
}

/**
 * Estimates the learning cost for an object based on past performance.
 *
 * Learning cost considers:
 * - Base IRT difficulty
 * - Historical success rate (inverted)
 * - Number of encounters needed to reach proficiency
 * - Current knowledge strength (inverted)
 *
 * @param stats - Current relationship stats
 * @param baseIrtDifficulty - The item's base IRT difficulty
 * @returns Estimated learning cost (higher = more effort needed)
 */
export function estimateLearningCost(
  stats: ObjectRelationshipStats,
  baseIrtDifficulty: number
): number {
  // Base cost from IRT difficulty (normalized to 0-1 from logit scale)
  const difficultyNormalized = 1 / (1 + Math.exp(-baseIrtDifficulty));

  // Success rate penalty (lower success = higher cost)
  const successPenalty = 1 - stats.overallSuccessRate;

  // Exposure factor (more encounters without mastery = higher cost)
  const exposureFactor =
    stats.totalEncounters > 0 ? Math.min(1, stats.totalEncounters / 20) : 0;
  const exposureCost = exposureFactor * (1 - stats.knowledgeStrength);

  // Combine factors
  const baseCost = 0.3 * difficultyNormalized + 0.4 * successPenalty + 0.3 * exposureCost;

  // Apply minimum (even easy items have some cost)
  return Math.max(0.1, Math.min(1.0, baseCost));
}

/**
 * Calculates the derived effect score - how much learning this object
 * benefits related objects through transfer.
 *
 * @param objectId - The object ID
 * @param relatedObjects - IDs of related objects
 * @param transferCoefficients - Transfer strength for each related object
 * @returns Derived effect score
 */
export function calculateDerivedEffect(
  objectId: string,
  relatedObjects: string[],
  transferCoefficients: Record<string, number>
): number {
  if (relatedObjects.length === 0) return 0;

  // Sum of transfer coefficients to related objects
  let totalTransfer = 0;
  relatedObjects.forEach((relatedId) => {
    totalTransfer += transferCoefficients[relatedId] || 0;
  });

  // Normalize by number of relations (network centrality bonus)
  const networkBonus = Math.log(1 + relatedObjects.length) / Math.log(10);

  return Math.min(1.0, totalTransfer + 0.1 * networkBonus);
}

/**
 * Builds aggregated statistics from an array of encounters.
 *
 * @param encounters - All encounters for a user-object pair
 * @param objectId - The object ID
 * @param userId - The user ID
 * @returns Aggregated relationship statistics
 */
export function buildRelationshipStats(
  encounters: ObjectEncounter[],
  objectId: string,
  userId: string
): ObjectRelationshipStats {
  // Count by category
  const interpretationEncounters = encounters.filter(
    (e) => e.context.taskCategory === 'interpretation'
  );
  const productionEncounters = encounters.filter(
    (e) => e.context.taskCategory === 'production'
  );

  // Count by modality
  const visualEncounters = encounters.filter(
    (e) => e.context.modality === 'visual'
  );
  const auditoryEncounters = encounters.filter(
    (e) => e.context.modality === 'auditory'
  );
  const mixedEncounters = encounters.filter(
    (e) => e.context.modality === 'mixed'
  );

  // Build domain exposure map
  const domainExposure: Record<string, number> = {};
  encounters.forEach((e) => {
    domainExposure[e.context.domain] =
      (domainExposure[e.context.domain] || 0) + 1;
  });

  // Calculate temporal metrics
  let lastEncounter: Date | null = null;
  let avgInterEncounterDays = 0;

  if (encounters.length > 0) {
    const sortedEncounters = [...encounters].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    lastEncounter = sortedEncounters[0].createdAt;

    if (encounters.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedEncounters.length; i++) {
        const daysBetween =
          (sortedEncounters[i - 1].createdAt.getTime() -
            sortedEncounters[i].createdAt.getTime()) /
          (1000 * 60 * 60 * 24);
        intervals.push(daysBetween);
      }
      avgInterEncounterDays =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
  }

  const stats: ObjectRelationshipStats = {
    objectId,
    userId,
    updatedAt: new Date(),

    // Counts
    totalEncounters: encounters.length,
    interpretationEncounters: interpretationEncounters.length,
    productionEncounters: productionEncounters.length,
    visualEncounters: visualEncounters.length,
    auditoryEncounters: auditoryEncounters.length,
    mixedEncounters: mixedEncounters.length,

    // Success rates
    overallSuccessRate: calculateSuccessRate(encounters),
    interpretationSuccessRate: calculateSuccessRate(interpretationEncounters),
    productionSuccessRate: calculateSuccessRate(productionEncounters),
    visualSuccessRate: calculateSuccessRate(visualEncounters),
    auditorySuccessRate: calculateSuccessRate(auditoryEncounters),
    mixedSuccessRate: calculateSuccessRate(mixedEncounters),

    // Ratios
    interpretationRatio: calculateInterpretationProductionRatio(encounters),
    modalityBalance: calculateModalityBalance(encounters),

    // Domain exposure
    domainExposure,

    // Learning economics (will be updated with proper values)
    estimatedLearningCost: 1.0,
    derivedEffectScore: 0,

    // Temporal
    lastEncounter,
    avgInterEncounterDays,

    // Strength indicators
    knowledgeStrength: 0,
    retrievalFluency: calculateRetrievalFluency(encounters),
  };

  // Calculate knowledge strength (depends on other stats)
  stats.knowledgeStrength = calculateKnowledgeStrength(stats);

  return stats;
}

/**
 * Builds a complete relationship profile with recommendations.
 *
 * @param stats - Current relationship statistics
 * @returns Complete profile with recommendations
 */
export function buildRelationshipProfile(
  stats: ObjectRelationshipStats
): ObjectRelationshipProfile {
  // Calculate progress trend from recent vs older encounters
  // (Would need encounter history to properly implement)
  const progressTrend = 0; // Placeholder

  // Recommend task category to balance ratio
  const recommendedTaskCategory: TaskCategory =
    stats.interpretationRatio > 0.6 ? 'production' : 'interpretation';

  // Recommend modality to balance exposure
  let recommendedModality: TaskModality = 'visual';
  if (
    stats.auditoryEncounters < stats.visualEncounters &&
    stats.auditoryEncounters < stats.mixedEncounters
  ) {
    recommendedModality = 'auditory';
  } else if (stats.mixedEncounters < stats.visualEncounters) {
    recommendedModality = 'mixed';
  }

  // Identify exposure gaps
  const exposureGaps: ObjectRelationshipProfile['exposureGaps'] = {
    category: null,
    modality: null,
    domain: null,
  };

  // Category gap (significant imbalance)
  if (stats.interpretationRatio < 0.3 || stats.interpretationRatio > 0.7) {
    exposureGaps.category =
      stats.interpretationRatio < 0.5 ? 'interpretation' : 'production';
  }

  // Modality gap (one modality has < 20% of encounters)
  if (stats.totalEncounters > 5) {
    const minModality = Math.min(
      stats.visualEncounters,
      stats.auditoryEncounters,
      stats.mixedEncounters
    );
    if (minModality / stats.totalEncounters < 0.2) {
      if (minModality === stats.visualEncounters) {
        exposureGaps.modality = 'visual';
      } else if (minModality === stats.auditoryEncounters) {
        exposureGaps.modality = 'auditory';
      } else {
        exposureGaps.modality = 'mixed';
      }
    }
  }

  return {
    ...stats,
    progressTrend,
    recommendedTaskCategory,
    recommendedModality,
    exposureGaps,
  };
}

/**
 * Generates visualization data from relationship stats.
 *
 * @param stats - Current relationship statistics
 * @param encounters - Raw encounters for timeline data
 * @returns Data formatted for visualization
 */
export function generateVisualizationData(
  stats: ObjectRelationshipStats,
  encounters: ObjectEncounter[]
): RelationshipVisualizationData {
  // Category distribution
  const categoryDistribution = {
    interpretation: stats.interpretationEncounters,
    production: stats.productionEncounters,
  };

  // Modality distribution
  const modalityDistribution = {
    visual: stats.visualEncounters,
    auditory: stats.auditoryEncounters,
    mixed: stats.mixedEncounters,
  };

  // Success rates
  const successRates = {
    overall: stats.overallSuccessRate,
    interpretation: stats.interpretationSuccessRate,
    production: stats.productionSuccessRate,
    visual: stats.visualSuccessRate,
    auditory: stats.auditorySuccessRate,
    mixed: stats.mixedSuccessRate,
  };

  // Progress timeline (group by day)
  const dailyData = new Map<
    string,
    { successes: number; total: number }
  >();

  encounters.forEach((e) => {
    const dateKey = e.createdAt.toISOString().split('T')[0];
    const existing = dailyData.get(dateKey) || { successes: 0, total: 0 };
    existing.total++;
    if (e.outcome.successful) existing.successes++;
    dailyData.set(dateKey, existing);
  });

  const progressTimeline = Array.from(dailyData.entries())
    .map(([dateStr, data]) => ({
      date: new Date(dateStr),
      successRate: data.total > 0 ? data.successes / data.total : 0,
      encounters: data.total,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Strength radar
  const interpretationStrength =
    stats.interpretationEncounters > 0
      ? stats.interpretationSuccessRate * (1 - 1 / (1 + stats.interpretationEncounters))
      : 0;

  const productionStrength =
    stats.productionEncounters > 0
      ? stats.productionSuccessRate * (1 - 1 / (1 + stats.productionEncounters))
      : 0;

  const visualStrength =
    stats.visualEncounters > 0
      ? stats.visualSuccessRate * (1 - 1 / (1 + stats.visualEncounters))
      : 0;

  const auditoryStrength =
    stats.auditoryEncounters > 0
      ? stats.auditorySuccessRate * (1 - 1 / (1 + stats.auditoryEncounters))
      : 0;

  const strengthRadar = {
    interpretationStrength,
    productionStrength,
    visualStrength,
    auditoryStrength,
    fluency: stats.retrievalFluency,
    retention: stats.knowledgeStrength,
  };

  return {
    categoryDistribution,
    modalityDistribution,
    successRates,
    progressTimeline,
    strengthRadar,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a UUID-like ID.
 * In production, use a proper UUID library.
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Updates relationship stats with a new encounter.
 * Incrementally updates stats without recalculating everything.
 *
 * @param currentStats - Current stats
 * @param encounter - New encounter to incorporate
 * @returns Updated stats
 */
export function updateStatsWithEncounter(
  currentStats: ObjectRelationshipStats,
  encounter: ObjectEncounter
): ObjectRelationshipStats {
  const updated = { ...currentStats };

  // Update counts
  updated.totalEncounters++;

  if (encounter.context.taskCategory === 'interpretation') {
    updated.interpretationEncounters++;
  } else {
    updated.productionEncounters++;
  }

  switch (encounter.context.modality) {
    case 'visual':
      updated.visualEncounters++;
      break;
    case 'auditory':
      updated.auditoryEncounters++;
      break;
    case 'mixed':
      updated.mixedEncounters++;
      break;
  }

  // Update domain exposure
  updated.domainExposure = { ...updated.domainExposure };
  updated.domainExposure[encounter.context.domain] =
    (updated.domainExposure[encounter.context.domain] || 0) + 1;

  // Update success rates using running average
  const n = updated.totalEncounters;
  const oldSuccessRate = currentStats.overallSuccessRate;
  updated.overallSuccessRate =
    oldSuccessRate + (encounter.outcome.successful ? 1 - oldSuccessRate : -oldSuccessRate) / n;

  // Update category-specific success rates
  if (encounter.context.taskCategory === 'interpretation') {
    const categoryN = updated.interpretationEncounters;
    const oldRate = currentStats.interpretationSuccessRate;
    updated.interpretationSuccessRate =
      oldRate +
      (encounter.outcome.successful ? 1 - oldRate : -oldRate) / categoryN;
  } else {
    const categoryN = updated.productionEncounters;
    const oldRate = currentStats.productionSuccessRate;
    updated.productionSuccessRate =
      oldRate +
      (encounter.outcome.successful ? 1 - oldRate : -oldRate) / categoryN;
  }

  // Update modality-specific success rates
  switch (encounter.context.modality) {
    case 'visual': {
      const modalityN = updated.visualEncounters;
      const oldRate = currentStats.visualSuccessRate;
      updated.visualSuccessRate =
        oldRate +
        (encounter.outcome.successful ? 1 - oldRate : -oldRate) / modalityN;
      break;
    }
    case 'auditory': {
      const modalityN = updated.auditoryEncounters;
      const oldRate = currentStats.auditorySuccessRate;
      updated.auditorySuccessRate =
        oldRate +
        (encounter.outcome.successful ? 1 - oldRate : -oldRate) / modalityN;
      break;
    }
    case 'mixed': {
      const modalityN = updated.mixedEncounters;
      const oldRate = currentStats.mixedSuccessRate;
      updated.mixedSuccessRate =
        oldRate +
        (encounter.outcome.successful ? 1 - oldRate : -oldRate) / modalityN;
      break;
    }
  }

  // Update ratios
  updated.interpretationRatio =
    updated.interpretationEncounters / updated.totalEncounters;

  // Simplified modality balance update (proper update would need all encounter data)
  const modalityCounts = [
    updated.visualEncounters,
    updated.auditoryEncounters,
    updated.mixedEncounters,
  ];
  const total = updated.totalEncounters;
  const probs = modalityCounts.map((c) => c / total);
  let entropy = 0;
  probs.forEach((p) => {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  });
  updated.modalityBalance = entropy / Math.log2(3);

  // Update temporal
  updated.lastEncounter = encounter.createdAt;
  updated.updatedAt = new Date();

  // Recalculate derived metrics
  updated.knowledgeStrength = calculateKnowledgeStrength(updated);

  return updated;
}
