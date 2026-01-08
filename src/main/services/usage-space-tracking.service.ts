/**
 * Usage Space Tracking Service
 *
 * Tracks and manages the "usage space" of language objects - the contexts
 * in which they have been successfully used. This enables:
 *
 * 1. Coverage tracking: How much of the target usage space is mastered?
 * 2. Expansion detection: When an object is successfully used in a new context
 * 3. Goal progress: Overall readiness based on usage space coverage
 * 4. Curriculum guidance: Which contexts to target next
 *
 * Theoretical basis:
 * - Transfer of Learning (Thorndike, 1901; Singley & Anderson, 1989)
 * - Situated Learning (Lave & Wenger, 1991)
 * - Context-dependent memory (Godden & Baddeley, 1975)
 *
 * Key insight: Knowing a word in one context doesn't guarantee knowing
 * it in all contexts. Usage space coverage measures true productive ability.
 */

import { getPrisma } from '../db/prisma';
import type {
  ComponentCode,
  UsageContext,
  ObjectUsageSpace,
  UsageSpaceExpansion,
  UsageSpaceProgress,
  TaskType,
} from '../../core/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Usage event - recorded when an object is used in a task.
 */
export interface UsageEvent {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Context where used */
  contextId: string;

  /** Session ID */
  sessionId: string;

  /** Task ID */
  taskId: string;

  /** Task type */
  taskType: TaskType;

  /** Whether usage was successful */
  success: boolean;

  /** Score achieved (0-1) */
  score: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Context similarity for expansion readiness calculation.
 */
interface ContextSimilarity {
  contextId: string;
  similarity: number;
  sharedFeatures: string[];
}

// =============================================================================
// Pre-defined Usage Contexts
// =============================================================================

/**
 * Standard usage contexts for language learning.
 * Based on Common European Framework of Reference (CEFR) domains.
 */
export const STANDARD_CONTEXTS: UsageContext[] = [
  // Personal domain
  {
    contextId: 'personal-spoken-informal',
    name: 'Casual Conversation',
    domain: 'personal',
    register: 'informal',
    modality: 'spoken',
    genre: 'conversation',
    applicableTaskTypes: ['production', 'recall_free'],
  },
  {
    contextId: 'personal-written-informal',
    name: 'Personal Messages',
    domain: 'personal',
    register: 'informal',
    modality: 'written',
    genre: 'messaging',
    applicableTaskTypes: ['sentence_writing', 'production'],
  },

  // Professional domain
  {
    contextId: 'professional-spoken-formal',
    name: 'Professional Meetings',
    domain: 'professional',
    register: 'formal',
    modality: 'spoken',
    genre: 'meeting',
    applicableTaskTypes: ['production', 'register_shift'],
  },
  {
    contextId: 'professional-written-formal',
    name: 'Business Correspondence',
    domain: 'professional',
    register: 'formal',
    modality: 'written',
    genre: 'email',
    applicableTaskTypes: ['sentence_writing', 'production'],
  },
  {
    contextId: 'professional-written-technical',
    name: 'Technical Documentation',
    domain: 'professional',
    register: 'technical',
    modality: 'written',
    genre: 'documentation',
    applicableTaskTypes: ['sentence_writing', 'translation'],
  },

  // Medical domain (for CELBAN)
  {
    contextId: 'medical-spoken-consultative',
    name: 'Patient Interaction',
    domain: 'medical',
    register: 'consultative',
    modality: 'spoken',
    genre: 'consultation',
    applicableTaskTypes: ['production', 'recall_free'],
  },
  {
    contextId: 'medical-written-technical',
    name: 'Medical Documentation',
    domain: 'medical',
    register: 'technical',
    modality: 'written',
    genre: 'chart',
    applicableTaskTypes: ['sentence_writing', 'production'],
  },
  {
    contextId: 'medical-spoken-collegial',
    name: 'Colleague Communication',
    domain: 'medical',
    register: 'consultative',
    modality: 'spoken',
    genre: 'handoff',
    applicableTaskTypes: ['production', 'register_shift'],
  },

  // Academic domain
  {
    contextId: 'academic-written-formal',
    name: 'Academic Writing',
    domain: 'academic',
    register: 'formal',
    modality: 'written',
    genre: 'essay',
    applicableTaskTypes: ['sentence_writing', 'sentence_combining'],
  },
  {
    contextId: 'academic-spoken-formal',
    name: 'Academic Presentation',
    domain: 'academic',
    register: 'formal',
    modality: 'spoken',
    genre: 'presentation',
    applicableTaskTypes: ['production'],
  },
];

/**
 * Context feature vectors for similarity calculation.
 */
const CONTEXT_FEATURES: Record<string, Record<string, number>> = {
  // Domain features
  'domain:personal': { 'personal-spoken-informal': 1, 'personal-written-informal': 1 },
  'domain:professional': {
    'professional-spoken-formal': 1,
    'professional-written-formal': 1,
    'professional-written-technical': 1,
  },
  'domain:medical': {
    'medical-spoken-consultative': 1,
    'medical-written-technical': 1,
    'medical-spoken-collegial': 1,
  },
  'domain:academic': { 'academic-written-formal': 1, 'academic-spoken-formal': 1 },

  // Register features
  'register:informal': { 'personal-spoken-informal': 1, 'personal-written-informal': 1 },
  'register:formal': {
    'professional-spoken-formal': 1,
    'professional-written-formal': 1,
    'academic-written-formal': 1,
    'academic-spoken-formal': 1,
  },
  'register:technical': {
    'professional-written-technical': 1,
    'medical-written-technical': 1,
  },
  'register:consultative': {
    'medical-spoken-consultative': 1,
    'medical-spoken-collegial': 1,
  },

  // Modality features
  'modality:spoken': {
    'personal-spoken-informal': 1,
    'professional-spoken-formal': 1,
    'medical-spoken-consultative': 1,
    'medical-spoken-collegial': 1,
    'academic-spoken-formal': 1,
  },
  'modality:written': {
    'personal-written-informal': 1,
    'professional-written-formal': 1,
    'professional-written-technical': 1,
    'medical-written-technical': 1,
    'academic-written-formal': 1,
  },
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Record a usage event and check for usage space expansion.
 */
export async function recordUsageEvent(
  event: UsageEvent
): Promise<{
  recorded: boolean;
  expansion: UsageSpaceExpansion | null;
  newCoverage: number;
}> {
  const prisma = getPrisma();

  // Get or create usage space record
  let usageSpace = await getObjectUsageSpace(event.objectId);

  // Check if this is a new context for this object
  const isNewContext = !usageSpace.successfulContexts.some(
    c => c.contextId === event.contextId
  ) && !usageSpace.attemptedContexts.some(
    c => c.contextId === event.contextId
  );

  const isSuccessful = event.success && event.score >= 0.6;

  // Update usage space
  if (isSuccessful) {
    // Add to successful contexts or update existing
    const existingIdx = usageSpace.successfulContexts.findIndex(
      c => c.contextId === event.contextId
    );

    if (existingIdx >= 0) {
      // Update existing
      const existing = usageSpace.successfulContexts[existingIdx];
      existing.exposureCount++;
      existing.successRate = (
        existing.successRate * (existing.exposureCount - 1) + event.score
      ) / existing.exposureCount;
      existing.lastExposure = event.timestamp;
    } else {
      // Add new successful context
      usageSpace.successfulContexts.push({
        contextId: event.contextId,
        exposureCount: 1,
        successRate: event.score,
        lastExposure: event.timestamp,
      });

      // Remove from attempted if present
      usageSpace.attemptedContexts = usageSpace.attemptedContexts.filter(
        c => c.contextId !== event.contextId
      );
    }
  } else {
    // Add to attempted contexts or update existing
    const existingIdx = usageSpace.attemptedContexts.findIndex(
      c => c.contextId === event.contextId
    );

    if (existingIdx >= 0) {
      // Update existing
      const existing = usageSpace.attemptedContexts[existingIdx];
      existing.exposureCount++;
      existing.successRate = (
        existing.successRate * (existing.exposureCount - 1) + event.score
      ) / existing.exposureCount;
      existing.lastExposure = event.timestamp;
    } else if (!usageSpace.successfulContexts.some(c => c.contextId === event.contextId)) {
      // Add new attempted context (if not already successful)
      usageSpace.attemptedContexts.push({
        contextId: event.contextId,
        exposureCount: 1,
        successRate: event.score,
        lastExposure: event.timestamp,
      });
    }
  }

  // Recalculate coverage
  const previousCoverage = usageSpace.coverageRatio;
  usageSpace.coverageRatio = calculateCoverageRatio(
    usageSpace.successfulContexts.map(c => c.contextId),
    usageSpace.targetContexts
  );

  // Recalculate expansion candidates
  usageSpace.expansionCandidates = calculateExpansionCandidates(usageSpace);

  // Save updated usage space
  await saveObjectUsageSpace(usageSpace);

  // Check for expansion event
  let expansion: UsageSpaceExpansion | null = null;
  if (isNewContext && isSuccessful) {
    expansion = {
      objectId: event.objectId,
      newContextId: event.contextId,
      sessionId: event.sessionId,
      taskId: event.taskId,
      timestamp: event.timestamp,
      previousCoverage,
      newCoverage: usageSpace.coverageRatio,
    };

    // Record expansion event
    await recordExpansionEvent(expansion);
  }

  return {
    recorded: true,
    expansion,
    newCoverage: usageSpace.coverageRatio,
  };
}

/**
 * Get usage space for an object.
 */
export async function getObjectUsageSpace(objectId: string): Promise<ObjectUsageSpace> {
  const prisma = getPrisma();

  // Try to get from database (would need UsageSpace table)
  // For now, return a default structure
  const object = await prisma.languageObject.findUnique({
    where: { id: objectId },
    include: { goal: true },
  });

  if (!object) {
    return createEmptyUsageSpace(objectId, 'LEX');
  }

  // Determine target contexts from goal
  const targetContexts = getTargetContextsForGoal(object.goal?.domain || 'general');

  return {
    objectId,
    componentType: object.type as ComponentCode,
    successfulContexts: [],
    attemptedContexts: [],
    targetContexts,
    coverageRatio: 0,
    expansionCandidates: calculateExpansionCandidates({
      objectId,
      componentType: object.type as ComponentCode,
      successfulContexts: [],
      attemptedContexts: [],
      targetContexts,
      coverageRatio: 0,
      expansionCandidates: [],
    }),
  };
}

/**
 * Get target contexts for a goal domain.
 */
function getTargetContextsForGoal(domain: string): string[] {
  switch (domain) {
    case 'medical':
      return [
        'medical-spoken-consultative',
        'medical-written-technical',
        'medical-spoken-collegial',
        'professional-spoken-formal',
      ];
    case 'academic':
      return [
        'academic-written-formal',
        'academic-spoken-formal',
        'professional-written-formal',
      ];
    case 'professional':
      return [
        'professional-spoken-formal',
        'professional-written-formal',
        'professional-written-technical',
      ];
    default:
      return [
        'personal-spoken-informal',
        'personal-written-informal',
        'professional-spoken-formal',
      ];
  }
}

/**
 * Create empty usage space.
 */
function createEmptyUsageSpace(
  objectId: string,
  componentType: ComponentCode
): ObjectUsageSpace {
  return {
    objectId,
    componentType,
    successfulContexts: [],
    attemptedContexts: [],
    targetContexts: [],
    coverageRatio: 0,
    expansionCandidates: [],
  };
}

/**
 * Calculate coverage ratio.
 */
function calculateCoverageRatio(
  successfulContexts: string[],
  targetContexts: string[]
): number {
  if (targetContexts.length === 0) return 1.0;

  const covered = successfulContexts.filter(c => targetContexts.includes(c)).length;
  return covered / targetContexts.length;
}

/**
 * Calculate expansion candidates based on context similarity.
 */
function calculateExpansionCandidates(
  usageSpace: ObjectUsageSpace
): ObjectUsageSpace['expansionCandidates'] {
  const successfulIds = new Set(usageSpace.successfulContexts.map(c => c.contextId));
  const attemptedIds = new Set(usageSpace.attemptedContexts.map(c => c.contextId));

  const candidates: ObjectUsageSpace['expansionCandidates'] = [];

  // Find unvisited target contexts
  for (const targetId of usageSpace.targetContexts) {
    if (successfulIds.has(targetId)) continue;

    // Calculate readiness based on similarity to successful contexts
    const similarities = calculateContextSimilarities(targetId, [...successfulIds]);
    const maxSimilarity = similarities.length > 0
      ? Math.max(...similarities.map(s => s.similarity))
      : 0;

    // Prerequisites: most similar successful contexts
    const prerequisites = similarities
      .filter(s => s.similarity >= 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2)
      .map(s => s.contextId);

    // Adjust readiness if already attempted
    let readinessScore = maxSimilarity;
    if (attemptedIds.has(targetId)) {
      const attempted = usageSpace.attemptedContexts.find(a => a.contextId === targetId);
      if (attempted && attempted.successRate >= 0.4) {
        // Close to success - boost readiness
        readinessScore = Math.min(1, readinessScore + 0.2);
      }
    }

    candidates.push({
      contextId: targetId,
      readinessScore,
      prerequisites,
    });
  }

  // Sort by readiness (highest first)
  return candidates.sort((a, b) => b.readinessScore - a.readinessScore);
}

/**
 * Calculate similarity between a target context and successful contexts.
 */
function calculateContextSimilarities(
  targetId: string,
  successfulIds: string[]
): ContextSimilarity[] {
  const results: ContextSimilarity[] = [];

  for (const successId of successfulIds) {
    const sharedFeatures: string[] = [];
    let sharedCount = 0;
    let totalFeatures = 0;

    for (const [feature, contextMap] of Object.entries(CONTEXT_FEATURES)) {
      const targetHas = contextMap[targetId] === 1;
      const successHas = contextMap[successId] === 1;

      if (targetHas || successHas) {
        totalFeatures++;
        if (targetHas && successHas) {
          sharedCount++;
          sharedFeatures.push(feature);
        }
      }
    }

    const similarity = totalFeatures > 0 ? sharedCount / totalFeatures : 0;

    results.push({
      contextId: successId,
      similarity,
      sharedFeatures,
    });
  }

  return results;
}

/**
 * Save usage space (placeholder - would persist to DB).
 */
async function saveObjectUsageSpace(_usageSpace: ObjectUsageSpace): Promise<void> {
  // Would persist to database
  // For now, this is a no-op placeholder
}

/**
 * Record expansion event (placeholder - would persist to DB).
 */
async function recordExpansionEvent(_expansion: UsageSpaceExpansion): Promise<void> {
  // Would persist to database
  // For now, this is a no-op placeholder
}

// =============================================================================
// Goal Progress Calculation
// =============================================================================

/**
 * Calculate usage space progress for a goal.
 */
export async function calculateUsageSpaceProgress(
  goalId: string
): Promise<UsageSpaceProgress> {
  const prisma = getPrisma();

  // Get all objects for the goal
  const objects = await prisma.languageObject.findMany({
    where: { goalId },
  });

  // Group by component
  const byComponent: Record<ComponentCode, Array<{ id: string; type: string }>> = {
    PHON: [],
    MORPH: [],
    LEX: [],
    SYNT: [],
    PRAG: [],
  };

  for (const obj of objects) {
    const component = mapTypeToComponent(obj.type);
    byComponent[component].push({ id: obj.id, type: obj.type });
  }

  // Calculate coverage per component
  const componentCoverage: UsageSpaceProgress['componentCoverage'] = {
    PHON: { totalObjects: 0, objectsWithFullCoverage: 0, averageCoverage: 0, criticalGaps: [] },
    MORPH: { totalObjects: 0, objectsWithFullCoverage: 0, averageCoverage: 0, criticalGaps: [] },
    LEX: { totalObjects: 0, objectsWithFullCoverage: 0, averageCoverage: 0, criticalGaps: [] },
    SYNT: { totalObjects: 0, objectsWithFullCoverage: 0, averageCoverage: 0, criticalGaps: [] },
    PRAG: { totalObjects: 0, objectsWithFullCoverage: 0, averageCoverage: 0, criticalGaps: [] },
  };

  for (const [component, componentObjects] of Object.entries(byComponent)) {
    const comp = component as ComponentCode;
    componentCoverage[comp].totalObjects = componentObjects.length;

    let totalCoverage = 0;
    const gaps: typeof componentCoverage[ComponentCode]['criticalGaps'] = [];

    for (const obj of componentObjects) {
      const usageSpace = await getObjectUsageSpace(obj.id);
      totalCoverage += usageSpace.coverageRatio;

      if (usageSpace.coverageRatio >= 1.0) {
        componentCoverage[comp].objectsWithFullCoverage++;
      } else if (usageSpace.coverageRatio < 0.5) {
        // Critical gap
        const missingContexts = usageSpace.targetContexts.filter(
          t => !usageSpace.successfulContexts.some(s => s.contextId === t)
        );
        gaps.push({
          objectId: obj.id,
          missingContexts,
        });
      }
    }

    componentCoverage[comp].averageCoverage =
      componentObjects.length > 0 ? totalCoverage / componentObjects.length : 0;
    componentCoverage[comp].criticalGaps = gaps.slice(0, 5);  // Top 5 gaps
  }

  // Calculate overall readiness
  const componentWeights: Record<ComponentCode, number> = {
    LEX: 0.35,
    SYNT: 0.25,
    PRAG: 0.20,
    MORPH: 0.12,
    PHON: 0.08,
  };

  let overallReadiness = 0;
  for (const [comp, weight] of Object.entries(componentWeights)) {
    overallReadiness += componentCoverage[comp as ComponentCode].averageCoverage * weight;
  }

  // Generate recommendations
  const recommendations = generateProgressRecommendations(componentCoverage);

  return {
    goalId,
    componentCoverage,
    overallReadiness,
    recommendations,
  };
}

/**
 * Generate recommendations based on coverage analysis.
 */
function generateProgressRecommendations(
  coverage: UsageSpaceProgress['componentCoverage']
): UsageSpaceProgress['recommendations'] {
  const recommendations: UsageSpaceProgress['recommendations'] = [];
  let priority = 1;

  // Sort components by coverage (lowest first)
  const sortedComponents = (Object.entries(coverage) as Array<[ComponentCode, typeof coverage[ComponentCode]]>)
    .sort((a, b) => a[1].averageCoverage - b[1].averageCoverage);

  for (const [componentType, data] of sortedComponents) {
    if (data.criticalGaps.length > 0) {
      // Collect all missing contexts
      const allMissingContexts = new Set<string>();
      for (const gap of data.criticalGaps) {
        gap.missingContexts.forEach(c => allMissingContexts.add(c));
      }

      recommendations.push({
        priority: priority++,
        componentType,
        objectIds: data.criticalGaps.map(g => g.objectId),
        targetContexts: [...allMissingContexts].slice(0, 3),
        reason: `Low coverage (${(data.averageCoverage * 100).toFixed(0)}%) in ${componentType}`,
      });
    }
  }

  return recommendations.slice(0, 5);  // Top 5 recommendations
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
// Context Selection for Tasks
// =============================================================================

/**
 * Select optimal context for a task based on usage space needs.
 */
export function selectTaskContext(
  usageSpaces: ObjectUsageSpace[],
  taskType: TaskType,
  preferExpansion: boolean = true
): UsageContext {
  // Find contexts that apply to this task type
  const applicableContexts = STANDARD_CONTEXTS.filter(
    c => c.applicableTaskTypes.includes(taskType)
  );

  if (applicableContexts.length === 0) {
    return STANDARD_CONTEXTS[0];  // Fallback
  }

  // Score each context
  const scoredContexts = applicableContexts.map(context => {
    let score = 0;

    for (const usageSpace of usageSpaces) {
      // Check if this context is a target
      const isTarget = usageSpace.targetContexts.includes(context.contextId);
      if (!isTarget) continue;

      // Check if already successful
      const isSuccessful = usageSpace.successfulContexts.some(
        s => s.contextId === context.contextId
      );

      if (isSuccessful) {
        // Already mastered - lower priority
        score += 0.2;
      } else {
        // Not yet mastered
        const candidate = usageSpace.expansionCandidates.find(
          e => e.contextId === context.contextId
        );

        if (candidate) {
          if (preferExpansion && candidate.readinessScore >= 0.6) {
            // Ready for expansion - high priority
            score += 1.0 + candidate.readinessScore;
          } else {
            // Not quite ready - medium priority
            score += 0.5 + candidate.readinessScore * 0.5;
          }
        } else {
          // Target but not ready - lower priority
          score += 0.3;
        }
      }
    }

    return { context, score };
  });

  // Sort by score (highest first) and return best
  scoredContexts.sort((a, b) => b.score - a.score);

  return scoredContexts[0]?.context || applicableContexts[0];
}

/**
 * Get context by ID.
 */
export function getContextById(contextId: string): UsageContext | undefined {
  return STANDARD_CONTEXTS.find(c => c.contextId === contextId);
}

/**
 * Get all contexts for a domain.
 */
export function getContextsForDomain(domain: string): UsageContext[] {
  return STANDARD_CONTEXTS.filter(c => c.domain === domain);
}

// =============================================================================
// Generalization-Enhanced Context Selection
// =============================================================================

/**
 * Strategy for context selection.
 */
export type ContextSelectionStrategy =
  | 'coverage_maximization'  // Select contexts that maximize new coverage
  | 'transfer_chain'         // Select contexts that enable transfer to others
  | 'goal_alignment'         // Prioritize contexts aligned with user goal
  | 'balanced';              // Balance all factors

/**
 * Enhanced configuration for context selection with generalization.
 */
export interface EnhancedContextSelectionConfig {
  /** Selection strategy */
  strategy: ContextSelectionStrategy;

  /** Target contexts from user goal */
  goalContexts: UsageContext[];

  /** Whether to prefer expansion (new contexts) or reinforcement (known contexts) */
  preferExpansion: boolean;

  /** Minimum transfer probability for inferred coverage */
  minTransferProbability: number;

  /** Weight for goal alignment (0-1) */
  goalAlignmentWeight: number;

  /** Weight for diversity (0-1) */
  diversityWeight: number;

  /** Weight for transfer potential (0-1) */
  transferWeight: number;
}

/**
 * Default configuration for enhanced context selection.
 */
export const DEFAULT_CONTEXT_SELECTION_CONFIG: EnhancedContextSelectionConfig = {
  strategy: 'balanced',
  goalContexts: [],
  preferExpansion: true,
  minTransferProbability: 0.3,
  goalAlignmentWeight: 0.4,
  diversityWeight: 0.3,
  transferWeight: 0.3,
};

/**
 * Select optimal context with generalization awareness.
 *
 * This enhanced selection considers:
 * 1. Direct coverage needs (uncovered goal contexts)
 * 2. Transfer potential (contexts that enable generalization)
 * 3. Diversity (avoiding redundant contexts)
 * 4. Goal alignment (prioritizing goal-relevant contexts)
 *
 * Based on:
 * - Transfer of Learning (Thorndike, Perkins & Salomon)
 * - Prototype Theory (Rosch, 1975)
 * - Variability of Practice (Schmidt, 1975)
 */
export async function selectContextWithGeneralization(
  usageSpaces: ObjectUsageSpace[],
  taskType: TaskType,
  config: Partial<EnhancedContextSelectionConfig> = {}
): Promise<UsageContext> {
  const fullConfig = { ...DEFAULT_CONTEXT_SELECTION_CONFIG, ...config };

  // Get applicable contexts for task type
  const applicableContexts = STANDARD_CONTEXTS.filter(
    c => c.applicableTaskTypes.includes(taskType)
  );

  if (applicableContexts.length === 0) {
    return STANDARD_CONTEXTS[0]; // Fallback
  }

  // Score each context based on strategy
  const scoredContexts = applicableContexts.map(context => {
    let score = 0;

    // 1. Goal alignment score
    const goalScore = calculateContextGoalAlignment(context, fullConfig.goalContexts);

    // 2. Coverage need score (prioritize uncovered contexts)
    const coverageScore = calculateCoverageNeedScore(context, usageSpaces);

    // 3. Transfer potential score (how much this context enables generalization)
    const transferScore = calculateTransferPotentialScore(
      context,
      usageSpaces,
      applicableContexts
    );

    // 4. Diversity score (different from already covered)
    const diversityScore = calculateDiversityFromCovered(context, usageSpaces);

    // Apply strategy-specific weighting
    switch (fullConfig.strategy) {
      case 'coverage_maximization':
        score = coverageScore * 0.6 + transferScore * 0.3 + diversityScore * 0.1;
        break;
      case 'transfer_chain':
        score = transferScore * 0.6 + coverageScore * 0.2 + diversityScore * 0.2;
        break;
      case 'goal_alignment':
        score = goalScore * 0.6 + coverageScore * 0.3 + transferScore * 0.1;
        break;
      case 'balanced':
      default:
        score =
          goalScore * fullConfig.goalAlignmentWeight +
          coverageScore * 0.3 +
          diversityScore * fullConfig.diversityWeight +
          transferScore * fullConfig.transferWeight;
    }

    // Apply expansion/reinforcement preference
    if (fullConfig.preferExpansion) {
      // Boost uncovered contexts
      const isCovered = usageSpaces.some(us =>
        us.successfulContexts.some(sc => sc.contextId === context.contextId)
      );
      if (!isCovered) {
        score *= 1.3;
      }
    } else {
      // Boost covered contexts for reinforcement
      const isCovered = usageSpaces.some(us =>
        us.successfulContexts.some(sc => sc.contextId === context.contextId)
      );
      if (isCovered) {
        score *= 1.2;
      }
    }

    return { context, score };
  });

  // Sort by score and return best
  scoredContexts.sort((a, b) => b.score - a.score);
  return scoredContexts[0]?.context || applicableContexts[0];
}

/**
 * Calculate goal alignment score for a context.
 */
function calculateContextGoalAlignment(
  context: UsageContext,
  goalContexts: UsageContext[]
): number {
  if (goalContexts.length === 0) return 0.5;

  // Direct match
  if (goalContexts.some(gc => gc.contextId === context.contextId)) {
    return 1.0;
  }

  // Similarity to goal contexts
  let maxSimilarity = 0;
  for (const goalContext of goalContexts) {
    const similarity = calculateContextSimilarity(context, goalContext);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

/**
 * Calculate similarity between two contexts.
 */
function calculateContextSimilarity(context1: UsageContext, context2: UsageContext): number {
  let matches = 0;
  let total = 0;

  // Domain
  total++;
  if (context1.domain === context2.domain) matches++;

  // Register
  total++;
  if (context1.register === context2.register) matches++;

  // Modality
  total++;
  if (context1.modality === context2.modality) matches++;

  // Genre
  total++;
  if (context1.genre === context2.genre) matches++;

  return matches / total;
}

/**
 * Calculate coverage need score (higher for uncovered target contexts).
 */
function calculateCoverageNeedScore(
  context: UsageContext,
  usageSpaces: ObjectUsageSpace[]
): number {
  let needScore = 0;

  for (const usageSpace of usageSpaces) {
    // Check if this is a target context
    const isTarget = usageSpace.targetContexts.includes(context.contextId);
    if (!isTarget) continue;

    // Check if already covered
    const isCovered = usageSpace.successfulContexts.some(
      sc => sc.contextId === context.contextId
    );

    if (!isCovered) {
      // Uncovered target - high need
      needScore += 1.0;
    } else {
      // Covered but might need reinforcement
      const coverage = usageSpace.successfulContexts.find(
        sc => sc.contextId === context.contextId
      );
      if (coverage && coverage.successRate < 0.8) {
        needScore += 0.3; // Needs improvement
      }
    }
  }

  // Normalize by number of usage spaces
  return usageSpaces.length > 0 ? needScore / usageSpaces.length : 0;
}

/**
 * Calculate transfer potential score.
 * Higher score for contexts that can transfer to many other uncovered contexts.
 */
function calculateTransferPotentialScore(
  context: UsageContext,
  usageSpaces: ObjectUsageSpace[],
  allContexts: UsageContext[]
): number {
  // Find uncovered contexts
  const coveredIds = new Set<string>();
  for (const usageSpace of usageSpaces) {
    for (const sc of usageSpace.successfulContexts) {
      coveredIds.add(sc.contextId);
    }
  }

  const uncoveredContexts = allContexts.filter(c => !coveredIds.has(c.contextId));

  if (uncoveredContexts.length === 0) return 0;

  // Count how many uncovered contexts this one could transfer to
  let transferableCount = 0;
  for (const uncovered of uncoveredContexts) {
    const similarity = calculateContextSimilarity(context, uncovered);
    // Near transfer threshold: similarity >= 0.5
    if (similarity >= 0.5) {
      transferableCount++;
    }
  }

  return transferableCount / uncoveredContexts.length;
}

/**
 * Calculate diversity from already covered contexts.
 */
function calculateDiversityFromCovered(
  context: UsageContext,
  usageSpaces: ObjectUsageSpace[]
): number {
  // Get all covered contexts
  const coveredContextIds = new Set<string>();
  for (const usageSpace of usageSpaces) {
    for (const sc of usageSpace.successfulContexts) {
      coveredContextIds.add(sc.contextId);
    }
  }

  if (coveredContextIds.size === 0) return 1.0; // No coverage = maximum diversity

  // Calculate minimum similarity to any covered context
  let minSimilarity = 1.0;
  for (const coveredId of coveredContextIds) {
    const coveredContext = STANDARD_CONTEXTS.find(c => c.contextId === coveredId);
    if (coveredContext) {
      const similarity = calculateContextSimilarity(context, coveredContext);
      minSimilarity = Math.min(minSimilarity, similarity);
    }
  }

  // Higher diversity = lower similarity to covered
  return 1 - minSimilarity;
}

/**
 * Get recommended next contexts for maximum coverage gain.
 *
 * Returns contexts ordered by expected coverage gain,
 * considering both direct coverage and transfer potential.
 */
export function getRecommendedNextContexts(
  usageSpace: ObjectUsageSpace,
  maxRecommendations: number = 3
): Array<{
  context: UsageContext;
  expectedCoverageGain: number;
  transferPotential: number;
  reason: string;
}> {
  const recommendations: Array<{
    context: UsageContext;
    expectedCoverageGain: number;
    transferPotential: number;
    reason: string;
  }> = [];

  const coveredIds = new Set(usageSpace.successfulContexts.map(sc => sc.contextId));

  for (const targetId of usageSpace.targetContexts) {
    if (coveredIds.has(targetId)) continue;

    const context = STANDARD_CONTEXTS.find(c => c.contextId === targetId);
    if (!context) continue;

    // Calculate expected coverage gain
    const directGain = 1 / usageSpace.targetContexts.length;

    // Calculate transfer potential to other uncovered targets
    const uncoveredTargets = usageSpace.targetContexts.filter(
      t => t !== targetId && !coveredIds.has(t)
    );

    let transferPotential = 0;
    for (const otherId of uncoveredTargets) {
      const otherContext = STANDARD_CONTEXTS.find(c => c.contextId === otherId);
      if (otherContext) {
        const similarity = calculateContextSimilarity(context, otherContext);
        if (similarity >= 0.5) {
          transferPotential += similarity * 0.5; // Discount for being inferred
        }
      }
    }

    const expectedCoverageGain = directGain + transferPotential;

    // Generate reason
    let reason = `Direct coverage of ${context.name}`;
    if (transferPotential > 0) {
      reason += ` + potential transfer to ${Math.round(transferPotential / 0.5)} contexts`;
    }

    recommendations.push({
      context,
      expectedCoverageGain,
      transferPotential,
      reason,
    });
  }

  // Sort by expected coverage gain
  recommendations.sort((a, b) => b.expectedCoverageGain - a.expectedCoverageGain);

  return recommendations.slice(0, maxRecommendations);
}
