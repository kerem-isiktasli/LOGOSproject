/**
 * Generalization Estimation Service
 *
 * Estimates how learned skills transfer from trained contexts to untrained contexts.
 * This is crucial for the Usage Space Expansion framework - since the full usage
 * space is combinatorially large, we must estimate coverage from representative samples.
 *
 * Key algorithms:
 * 1. Transfer Distance Calculation - similarity between contexts
 * 2. Transfer Probability Estimation - likelihood of successful transfer
 * 3. Representative Sample Selection - choose samples that maximize generalization
 * 4. Coverage Estimation - estimate total usage space coverage
 *
 * Academic basis:
 * - Transfer of Learning (Thorndike, 1901; Perkins & Salomon, 1992)
 * - Prototype Theory (Rosch, 1975)
 * - Variability of Practice (Schmidt, 1975)
 * - Power Law of Practice (Newell & Rosenbloom, 1981)
 */

import { getPrisma } from '../db/prisma';
import type {
  ComponentCode,
  UsageContext,
  TransferEstimate,
  GeneralizationEstimate,
  RepresentativeSamplingStrategy,
  PhonUsageSpaceDimensions,
  MorphUsageSpaceDimensions,
  LexUsageSpaceDimensions,
  SyntUsageSpaceDimensions,
  PragUsageSpaceDimensions,
  ComponentUsageSpaceDimensions,
} from '../../core/types';
import { COMPONENT_SAMPLING_STRATEGIES } from '../../core/types';
import {
  STANDARD_CONTEXTS,
  getObjectUsageSpace,
} from './usage-space-tracking.service';

// =============================================================================
// Types
// =============================================================================

/**
 * Context feature vector for similarity calculation.
 */
interface ContextFeatureVector {
  domain: string;
  register: string;
  modality: string;
  genre: string;
  [key: string]: string | number;
}

/**
 * Sample score for selection algorithm.
 */
interface SampleScore {
  context: UsageContext;
  goalAlignmentScore: number;
  diversityScore: number;
  transferPotentialScore: number;
  totalScore: number;
}

/**
 * Coverage estimate breakdown.
 */
interface CoverageBreakdown {
  directCoverage: number;
  nearTransferCoverage: number;
  farTransferCoverage: number;
  totalEstimatedCoverage: number;
  confidence: number;
}

// =============================================================================
// Transfer Distance Calculation
// =============================================================================

/**
 * Calculate transfer distance between two contexts.
 *
 * Based on Thorndike's identical elements theory:
 * Transfer is proportional to shared elements between contexts.
 *
 * Distance = 1 - similarity (lower distance = easier transfer)
 */
export function calculateTransferDistance(
  sourceContext: UsageContext,
  targetContext: UsageContext
): { distance: number; sharedFeatures: string[]; differentFeatures: string[] } {
  const sourceFeatures = extractContextFeatures(sourceContext);
  const targetFeatures = extractContextFeatures(targetContext);

  const sharedFeatures: string[] = [];
  const differentFeatures: string[] = [];
  let sharedCount = 0;
  let totalFeatures = 0;

  // Compare all feature dimensions
  const allKeys = new Set([
    ...Object.keys(sourceFeatures),
    ...Object.keys(targetFeatures),
  ]);

  for (const key of allKeys) {
    if (key === 'contextId' || key === 'name') continue;

    totalFeatures++;
    const sourceVal = sourceFeatures[key];
    const targetVal = targetFeatures[key];

    if (sourceVal === targetVal) {
      sharedCount++;
      sharedFeatures.push(`${key}:${sourceVal}`);
    } else {
      differentFeatures.push(`${key}:${sourceVal}→${targetVal}`);
    }
  }

  // Jaccard-like similarity
  const similarity = totalFeatures > 0 ? sharedCount / totalFeatures : 0;
  const distance = 1 - similarity;

  return { distance, sharedFeatures, differentFeatures };
}

/**
 * Extract feature vector from context.
 */
function extractContextFeatures(context: UsageContext): ContextFeatureVector {
  return {
    domain: context.domain,
    register: context.register,
    modality: context.modality,
    genre: context.genre ?? 'general',
  };
}

// =============================================================================
// Transfer Probability Estimation
// =============================================================================

/**
 * Estimate transfer probability between contexts.
 *
 * Based on transfer research (Perkins & Salomon, 1992):
 * - Near transfer (similar contexts): high probability
 * - Far transfer (different contexts): low probability, requires explicit bridging
 */
export function estimateTransferProbability(
  sourceContext: UsageContext,
  targetContext: UsageContext,
  sourceAutomationLevel: number
): TransferEstimate {
  const { distance, sharedFeatures, differentFeatures } = calculateTransferDistance(
    sourceContext,
    targetContext
  );

  // Classify transfer type
  const transferType: 'near' | 'far' = distance <= 0.5 ? 'near' : 'far';

  // Calculate base probability based on distance
  // Using exponential decay: P = e^(-k * distance)
  // k = 2 gives ~13% at distance 1.0, ~60% at distance 0.5
  const decayConstant = 2;
  let baseProbability = Math.exp(-decayConstant * distance);

  // Modulate by source automation level
  // Higher automation = better transfer (skill is proceduralized)
  const automationBoost = sourceAutomationLevel * 0.3;
  const transferProbability = Math.min(1, baseProbability + automationBoost);

  // Confidence based on feature overlap
  const featureCount = sharedFeatures.length + differentFeatures.length;
  const confidence = featureCount > 0 ? Math.min(1, featureCount / 5) : 0.5;

  // Generate transfer basis explanation
  const transferBasis = generateTransferBasis(sharedFeatures, differentFeatures, transferType);

  return {
    sourceContext,
    targetContext,
    transferDistance: distance,
    transferProbability,
    transferType,
    confidence,
    transferBasis,
  };
}

/**
 * Generate explanation for transfer basis.
 */
function generateTransferBasis(
  sharedFeatures: string[],
  differentFeatures: string[],
  transferType: 'near' | 'far'
): string[] {
  const basis: string[] = [];

  if (sharedFeatures.length > 0) {
    basis.push(`Shared: ${sharedFeatures.join(', ')}`);
  }

  if (differentFeatures.length > 0) {
    basis.push(`Differs: ${differentFeatures.join(', ')}`);
  }

  if (transferType === 'near') {
    basis.push('Near transfer: high similarity supports automatic transfer');
  } else {
    basis.push('Far transfer: requires explicit bridging for successful transfer');
  }

  return basis;
}

// =============================================================================
// Representative Sample Selection
// =============================================================================

/**
 * Select representative samples that maximize coverage through transfer.
 *
 * Based on:
 * - Prototype Theory: Select central/typical examples
 * - Variability of Practice: Ensure diversity for generalization
 * - Power Law: Minimum samples needed for learning
 */
export function selectRepresentativeSamples(
  allContexts: UsageContext[],
  goalContexts: UsageContext[],
  coveredContexts: UsageContext[],
  strategy: RepresentativeSamplingStrategy,
  maxSamples: number = 5
): UsageContext[] {
  // Filter out already covered contexts
  const coveredIds = new Set(coveredContexts.map(c => c.contextId));
  const uncoveredContexts = allContexts.filter(c => !coveredIds.has(c.contextId));

  if (uncoveredContexts.length === 0) {
    return [];
  }

  // Score each uncovered context
  const scoredContexts: SampleScore[] = uncoveredContexts.map(context => {
    const goalAlignmentScore = calculateGoalAlignmentScore(context, goalContexts);
    const diversityScore = calculateDiversityScore(context, coveredContexts);
    const transferPotentialScore = calculateTransferPotentialScore(
      context,
      uncoveredContexts,
      coveredContexts
    );

    // Weighted combination based on strategy
    const totalScore =
      goalAlignmentScore * strategy.goalWeight +
      diversityScore * strategy.diversityWeight +
      transferPotentialScore * strategy.transferWeight;

    return {
      context,
      goalAlignmentScore,
      diversityScore,
      transferPotentialScore,
      totalScore,
    };
  });

  // Sort by total score (descending)
  scoredContexts.sort((a, b) => b.totalScore - a.totalScore);

  // Select top samples, ensuring minimum diversity
  const selected: UsageContext[] = [];
  const usedDomains = new Set<string>();
  const usedRegisters = new Set<string>();

  for (const scored of scoredContexts) {
    if (selected.length >= maxSamples) break;

    // Enforce diversity constraints for first few selections
    if (selected.length < 3) {
      const isDiverse =
        !usedDomains.has(scored.context.domain) ||
        !usedRegisters.has(scored.context.register);

      if (!isDiverse && scoredContexts.length > maxSamples) {
        continue; // Skip to enforce diversity
      }
    }

    selected.push(scored.context);
    usedDomains.add(scored.context.domain);
    usedRegisters.add(scored.context.register);
  }

  return selected;
}

/**
 * Calculate goal alignment score for a context.
 */
function calculateGoalAlignmentScore(
  context: UsageContext,
  goalContexts: UsageContext[]
): number {
  if (goalContexts.length === 0) return 0.5;

  // Check if this context is directly in goal contexts
  const isGoalContext = goalContexts.some(g => g.contextId === context.contextId);
  if (isGoalContext) return 1.0;

  // Calculate average similarity to goal contexts
  let totalSimilarity = 0;
  for (const goalContext of goalContexts) {
    const { distance } = calculateTransferDistance(context, goalContext);
    totalSimilarity += 1 - distance;
  }

  return totalSimilarity / goalContexts.length;
}

/**
 * Calculate diversity score - how different from already covered.
 */
function calculateDiversityScore(
  context: UsageContext,
  coveredContexts: UsageContext[]
): number {
  if (coveredContexts.length === 0) return 1.0;

  // Calculate minimum distance to any covered context
  let minDistance = 1.0;
  for (const covered of coveredContexts) {
    const { distance } = calculateTransferDistance(context, covered);
    minDistance = Math.min(minDistance, distance);
  }

  // Higher distance = more diverse = higher score
  return minDistance;
}

/**
 * Calculate transfer potential - how many other contexts this could cover.
 */
function calculateTransferPotentialScore(
  context: UsageContext,
  allUncovered: UsageContext[],
  _covered: UsageContext[]
): number {
  let transferableCount = 0;

  for (const target of allUncovered) {
    if (target.contextId === context.contextId) continue;

    const { distance } = calculateTransferDistance(context, target);

    // Count as transferable if distance is low (near transfer likely)
    if (distance <= 0.5) {
      transferableCount++;
    }
  }

  // Normalize by total uncovered
  return allUncovered.length > 1
    ? transferableCount / (allUncovered.length - 1)
    : 0;
}

// =============================================================================
// Coverage Estimation
// =============================================================================

/**
 * Estimate generalization coverage for an object.
 *
 * Combines direct coverage (trained contexts) with inferred coverage
 * (contexts reachable via transfer).
 */
export async function estimateGeneralization(
  objectId: string,
  componentType: ComponentCode,
  goalContexts: UsageContext[]
): Promise<GeneralizationEstimate> {
  const usageSpace = await getObjectUsageSpace(objectId);

  // Get directly covered contexts
  const directlyCovered: UsageContext[] = usageSpace.successfulContexts
    .map(sc => STANDARD_CONTEXTS.find(c => c.contextId === sc.contextId))
    .filter((c): c is UsageContext => c !== undefined);

  // Calculate direct coverage ratio
  const directCoverage = goalContexts.length > 0
    ? directlyCovered.filter(dc =>
        goalContexts.some(gc => gc.contextId === dc.contextId)
      ).length / goalContexts.length
    : 0;

  // Get automation level from successful context exposure
  const avgSuccessRate = usageSpace.successfulContexts.length > 0
    ? usageSpace.successfulContexts.reduce((sum, c) => sum + c.successRate, 0) /
      usageSpace.successfulContexts.length
    : 0;
  const automationLevel = avgSuccessRate; // Simplified - would integrate with FSRS

  // Estimate transfer to uncovered goal contexts
  const uncoveredGoals = goalContexts.filter(
    gc => !directlyCovered.some(dc => dc.contextId === gc.contextId)
  );

  const inferredCoverage: TransferEstimate[] = [];

  for (const targetContext of uncoveredGoals) {
    // Find best source context for transfer
    let bestTransfer: TransferEstimate | null = null;
    let bestProbability = 0;

    for (const sourceContext of directlyCovered) {
      const transfer = estimateTransferProbability(
        sourceContext,
        targetContext,
        automationLevel
      );

      if (transfer.transferProbability > bestProbability) {
        bestProbability = transfer.transferProbability;
        bestTransfer = transfer;
      }
    }

    if (bestTransfer && bestProbability >= 0.3) {
      inferredCoverage.push(bestTransfer);
    }
  }

  // Calculate total estimated coverage
  const inferredCoverageRatio = goalContexts.length > 0
    ? inferredCoverage.reduce((sum, t) => sum + t.transferProbability, 0) /
      goalContexts.length
    : 0;

  const estimatedTotalCoverage = Math.min(1, directCoverage + inferredCoverageRatio);

  // Goal-aligned coverage weights by transfer probability
  const goalAlignedCoverage = calculateGoalAlignedCoverage(
    directlyCovered,
    inferredCoverage,
    goalContexts
  );

  // Recommend next contexts based on coverage gaps
  const strategy = COMPONENT_SAMPLING_STRATEGIES[componentType];
  const recommendedNextContexts = selectRepresentativeSamples(
    goalContexts,
    goalContexts,
    directlyCovered,
    strategy,
    3
  );

  return {
    objectId,
    componentType,
    directlyCovered,
    directCoverage,
    inferredCoverage,
    estimatedTotalCoverage,
    goalAlignedCoverage,
    automationLevel,
    recommendedNextContexts,
  };
}

/**
 * Calculate goal-aligned coverage with transfer probability weighting.
 */
function calculateGoalAlignedCoverage(
  directlyCovered: UsageContext[],
  inferredCoverage: TransferEstimate[],
  goalContexts: UsageContext[]
): number {
  if (goalContexts.length === 0) return 1.0;

  let totalCoverage = 0;

  for (const goalContext of goalContexts) {
    // Check direct coverage
    if (directlyCovered.some(dc => dc.contextId === goalContext.contextId)) {
      totalCoverage += 1.0;
      continue;
    }

    // Check inferred coverage
    const inference = inferredCoverage.find(
      ic => ic.targetContext.contextId === goalContext.contextId
    );
    if (inference) {
      totalCoverage += inference.transferProbability * inference.confidence;
    }
  }

  return totalCoverage / goalContexts.length;
}

// =============================================================================
// Component-Specific Generalization
// =============================================================================

/**
 * Estimate generalization for component-specific usage space dimensions.
 *
 * Different components have different generalization patterns:
 * - PHON: High transfer across positions (rules are abstract)
 * - MORPH: High transfer to novel combinations (productive rules)
 * - LEX: Lower transfer, more context-specific
 * - SYNT: Medium transfer, genre-dependent
 * - PRAG: Lowest transfer, highly context-specific
 */
export function estimateComponentGeneralization(
  componentType: ComponentCode,
  trainedDimensions: ComponentUsageSpaceDimensions,
  totalDimensions: ComponentUsageSpaceDimensions
): CoverageBreakdown {
  switch (componentType) {
    case 'PHON':
      return estimatePhonGeneralization(
        trainedDimensions as { type: 'PHON'; dimensions: PhonUsageSpaceDimensions },
        totalDimensions as { type: 'PHON'; dimensions: PhonUsageSpaceDimensions }
      );
    case 'MORPH':
      return estimateMorphGeneralization(
        trainedDimensions as { type: 'MORPH'; dimensions: MorphUsageSpaceDimensions },
        totalDimensions as { type: 'MORPH'; dimensions: MorphUsageSpaceDimensions }
      );
    case 'LEX':
      return estimateLexGeneralization(
        trainedDimensions as { type: 'LEX'; dimensions: LexUsageSpaceDimensions },
        totalDimensions as { type: 'LEX'; dimensions: LexUsageSpaceDimensions }
      );
    case 'SYNT':
      return estimateSyntGeneralization(
        trainedDimensions as { type: 'SYNT'; dimensions: SyntUsageSpaceDimensions },
        totalDimensions as { type: 'SYNT'; dimensions: SyntUsageSpaceDimensions }
      );
    case 'PRAG':
      return estimatePragGeneralization(
        trainedDimensions as { type: 'PRAG'; dimensions: PragUsageSpaceDimensions },
        totalDimensions as { type: 'PRAG'; dimensions: PragUsageSpaceDimensions }
      );
    default:
      return {
        directCoverage: 0,
        nearTransferCoverage: 0,
        farTransferCoverage: 0,
        totalEstimatedCoverage: 0,
        confidence: 0,
      };
  }
}

/**
 * Estimate PHON (phonology) generalization.
 * High transfer rate - phonological rules are abstract and position-general.
 */
function estimatePhonGeneralization(
  trained: { type: 'PHON'; dimensions: PhonUsageSpaceDimensions },
  total: { type: 'PHON'; dimensions: PhonUsageSpaceDimensions }
): CoverageBreakdown {
  const t = trained.dimensions;
  const a = total.dimensions;

  // Position transfer: 1 position → ~70% transfer to others
  const positionTransferRate = 0.7;
  const trainedPositions = t.positions.length;
  const totalPositions = a.positions.length;
  const positionCoverage = trainedPositions > 0
    ? Math.min(1, trainedPositions / totalPositions +
        (1 - trainedPositions / totalPositions) * positionTransferRate)
    : 0;

  // Word coverage
  const wordCoverage = a.applicableWords.length > 0
    ? t.applicableWords.length / a.applicableWords.length
    : 0;

  // Modality coverage
  const modalityCoverage = a.modality.length > 0
    ? t.modality.length / a.modality.length
    : 0;

  const directCoverage = (positionCoverage + wordCoverage + modalityCoverage) / 3;
  const nearTransferCoverage = (1 - directCoverage) * 0.5;
  const farTransferCoverage = 0.1;

  return {
    directCoverage,
    nearTransferCoverage,
    farTransferCoverage,
    totalEstimatedCoverage: Math.min(1, directCoverage + nearTransferCoverage + farTransferCoverage),
    confidence: 0.8, // High confidence for PHON generalization
  };
}

/**
 * Estimate MORPH (morphology) generalization.
 * High transfer for productive morphemes (affixes generalize to new roots).
 */
function estimateMorphGeneralization(
  trained: { type: 'MORPH'; dimensions: MorphUsageSpaceDimensions },
  total: { type: 'MORPH'; dimensions: MorphUsageSpaceDimensions }
): CoverageBreakdown {
  const t = trained.dimensions;
  const a = total.dimensions;

  // Root combination transfer: morphemes generalize to novel roots
  const productivityRate = 0.6; // Based on Carlisle (2000)
  const trainedRoots = t.combinableRoots.length;
  const totalRoots = a.combinableRoots.length;
  const rootCoverage = trainedRoots > 0
    ? Math.min(1, trainedRoots / totalRoots +
        (1 - trainedRoots / totalRoots) * productivityRate)
    : 0;

  // Transformation coverage
  const transformCoverage = a.posTransformations.length > 0
    ? t.posTransformations.length / a.posTransformations.length
    : 0;

  const directCoverage = (rootCoverage * 0.6 + transformCoverage * 0.4);
  const nearTransferCoverage = (1 - directCoverage) * 0.4;
  const farTransferCoverage = 0.15;

  return {
    directCoverage,
    nearTransferCoverage,
    farTransferCoverage,
    totalEstimatedCoverage: Math.min(1, directCoverage + nearTransferCoverage + farTransferCoverage),
    confidence: 0.75,
  };
}

/**
 * Estimate LEX (vocabulary) generalization.
 * Lower transfer - vocabulary is more context-specific.
 */
function estimateLexGeneralization(
  trained: { type: 'LEX'; dimensions: LexUsageSpaceDimensions },
  total: { type: 'LEX'; dimensions: LexUsageSpaceDimensions }
): CoverageBreakdown {
  const t = trained.dimensions;
  const a = total.dimensions;

  // Collocation coverage (low transfer)
  const collocationCoverage = a.collocations.length > 0
    ? t.collocations.length / a.collocations.length
    : 0;

  // Register coverage (medium transfer within register)
  const registerCoverage = a.registers.length > 0
    ? t.registers.length / a.registers.length
    : 0;

  // Domain coverage (medium transfer within domain)
  const domainCoverage = a.domains.length > 0
    ? t.domains.length / a.domains.length
    : 0;

  const directCoverage = (collocationCoverage * 0.5 + registerCoverage * 0.25 + domainCoverage * 0.25);
  const nearTransferCoverage = (1 - directCoverage) * 0.25; // Lower transfer for LEX
  const farTransferCoverage = 0.05;

  return {
    directCoverage,
    nearTransferCoverage,
    farTransferCoverage,
    totalEstimatedCoverage: Math.min(1, directCoverage + nearTransferCoverage + farTransferCoverage),
    confidence: 0.7,
  };
}

/**
 * Estimate SYNT (syntax) generalization.
 * Medium transfer - grammatical patterns are somewhat abstract.
 */
function estimateSyntGeneralization(
  trained: { type: 'SYNT'; dimensions: SyntUsageSpaceDimensions },
  total: { type: 'SYNT'; dimensions: SyntUsageSpaceDimensions }
): CoverageBreakdown {
  const t = trained.dimensions;
  const a = total.dimensions;

  // Verb type coverage
  const verbTypeCoverage = a.verbTypes.length > 0
    ? t.verbTypes.length / a.verbTypes.length
    : 0;

  // Text type coverage
  const textTypeCoverage = a.textTypes.length > 0
    ? t.textTypes.length / a.textTypes.length
    : 0;

  // Complexity coverage
  const complexityCoverage = a.complexityLevels.length > 0
    ? t.complexityLevels.length / a.complexityLevels.length
    : 0;

  const directCoverage = (verbTypeCoverage * 0.4 + textTypeCoverage * 0.3 + complexityCoverage * 0.3);
  const nearTransferCoverage = (1 - directCoverage) * 0.35;
  const farTransferCoverage = 0.1;

  return {
    directCoverage,
    nearTransferCoverage,
    farTransferCoverage,
    totalEstimatedCoverage: Math.min(1, directCoverage + nearTransferCoverage + farTransferCoverage),
    confidence: 0.7,
  };
}

/**
 * Estimate PRAG (pragmatics) generalization.
 * Lowest transfer - pragmatics is highly context-specific.
 */
function estimatePragGeneralization(
  trained: { type: 'PRAG'; dimensions: PragUsageSpaceDimensions },
  total: { type: 'PRAG'; dimensions: PragUsageSpaceDimensions }
): CoverageBreakdown {
  const t = trained.dimensions;
  const a = total.dimensions;

  // Communicative purpose coverage
  const purposeCoverage = a.communicativePurposes.length > 0
    ? t.communicativePurposes.length / a.communicativePurposes.length
    : 0;

  // Formality coverage
  const formalityCoverage = a.formalityLevels.length > 0
    ? t.formalityLevels.length / a.formalityLevels.length
    : 0;

  // Interlocutor relation coverage
  const relationCoverage = a.interlocutorRelations.length > 0
    ? t.interlocutorRelations.length / a.interlocutorRelations.length
    : 0;

  // Politeness strategy coverage
  const politenessCoverage = a.politenessStrategies.length > 0
    ? t.politenessStrategies.length / a.politenessStrategies.length
    : 0;

  const directCoverage = (purposeCoverage * 0.3 + formalityCoverage * 0.25 +
    relationCoverage * 0.25 + politenessCoverage * 0.2);
  const nearTransferCoverage = (1 - directCoverage) * 0.2; // Lowest transfer for PRAG
  const farTransferCoverage = 0.02;

  return {
    directCoverage,
    nearTransferCoverage,
    farTransferCoverage,
    totalEstimatedCoverage: Math.min(1, directCoverage + nearTransferCoverage + farTransferCoverage),
    confidence: 0.6, // Lower confidence for PRAG estimates
  };
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Estimate generalization for all objects in a goal.
 */
export async function estimateGoalGeneralization(
  goalId: string
): Promise<Map<string, GeneralizationEstimate>> {
  const prisma = getPrisma();

  // Get goal and target contexts
  const goal = await prisma.goalSpec.findUnique({
    where: { id: goalId },
    include: { languageObjects: true },
  });

  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  // Determine goal contexts based on domain
  const goalContexts = getGoalContexts(goal.domain || 'general');

  // Estimate for each object
  const estimates = new Map<string, GeneralizationEstimate>();

  for (const obj of goal.languageObjects) {
    const componentType = mapTypeToComponent(obj.type);
    const estimate = await estimateGeneralization(obj.id, componentType, goalContexts);
    estimates.set(obj.id, estimate);
  }

  return estimates;
}

/**
 * Get target contexts for a goal domain.
 */
function getGoalContexts(domain: string): UsageContext[] {
  const domainMap: Record<string, string[]> = {
    medical: [
      'medical-spoken-consultative',
      'medical-written-technical',
      'medical-spoken-collegial',
      'professional-spoken-formal',
    ],
    academic: [
      'academic-written-formal',
      'academic-spoken-formal',
      'professional-written-formal',
    ],
    professional: [
      'professional-spoken-formal',
      'professional-written-formal',
      'professional-written-technical',
    ],
    general: [
      'personal-spoken-informal',
      'personal-written-informal',
      'professional-spoken-formal',
    ],
  };

  const contextIds = domainMap[domain] || domainMap.general;
  return STANDARD_CONTEXTS.filter(c => contextIds.includes(c.contextId));
}

/**
 * Map object type to component code.
 */
function mapTypeToComponent(type: string): ComponentCode {
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

// =============================================================================
// Minimum Sample Calculation (Power Law)
// =============================================================================

/**
 * Calculate minimum samples needed for generalization.
 *
 * Based on Power Law of Practice (Newell & Rosenbloom, 1981):
 * Performance improves as power function of practice.
 *
 * Returns the number of samples needed to reach target coverage with
 * given confidence.
 */
export function calculateMinimumSamples(
  componentType: ComponentCode,
  currentCoverage: number,
  targetCoverage: number,
  _confidence: number = 0.8
): number {
  const strategy = COMPONENT_SAMPLING_STRATEGIES[componentType];
  const baseMinimum = strategy.minSamplesForGeneralization;

  if (currentCoverage >= targetCoverage) {
    return 0;
  }

  // Calculate coverage gap
  const coverageGap = targetCoverage - currentCoverage;

  // Estimate additional samples needed
  // More samples needed for larger gaps and lower-transfer components
  const transferMultiplier = {
    PHON: 0.7,  // High transfer = fewer samples needed
    MORPH: 0.8,
    LEX: 1.2,   // Low transfer = more samples needed
    SYNT: 1.0,
    PRAG: 1.4,  // Lowest transfer = most samples needed
  };

  const additionalSamples = Math.ceil(
    coverageGap * baseMinimum * 2 * transferMultiplier[componentType]
  );

  return Math.max(baseMinimum, additionalSamples);
}
