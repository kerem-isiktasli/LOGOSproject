/**
 * Error Analysis Repository
 *
 * Data access layer for error pattern analysis and bottleneck detection.
 * Implements Gap 1.1: Threshold Detection Algorithm support.
 */

import type { ErrorAnalysis, ComponentErrorStats, Prisma } from '@prisma/client';
import { getPrisma } from '../prisma';

// =============================================================================
// Types
// =============================================================================

export type ComponentCode = 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';

export type AnalysisSource = 'claude' | 'rule_based' | 'hybrid';

export interface CreateErrorAnalysisInput {
  responseId: string;
  objectId: string;
  component: ComponentCode;
  errorType: string;
  explanation: string;
  correction: string;
  similarErrors?: string[];
  confidence?: number;
  source?: AnalysisSource;
}

export interface ErrorPattern {
  component: ComponentCode;
  errorType: string;
  count: number;
  recentCount: number;
  examples: Array<{
    objectContent: string;
    explanation: string;
    correction: string;
  }>;
}

export interface BottleneckResult {
  component: ComponentCode;
  errorRate: number;
  trend: number;
  totalErrors: number;
  recentErrors: number;
  recommendation: string | null;
  isBottleneck: boolean;
}

// =============================================================================
// Error Analysis Functions
// =============================================================================

/**
 * Create an error analysis record.
 */
export async function createErrorAnalysis(
  input: CreateErrorAnalysisInput
): Promise<ErrorAnalysis> {
  const db = getPrisma();

  return db.errorAnalysis.create({
    data: {
      responseId: input.responseId,
      objectId: input.objectId,
      component: input.component,
      errorType: input.errorType,
      explanation: input.explanation,
      correction: input.correction,
      similarErrors: input.similarErrors ? JSON.stringify(input.similarErrors) : null,
      confidence: input.confidence ?? 0.8,
      source: input.source ?? 'claude',
    },
  });
}

/**
 * Get error analysis for a response.
 */
export async function getErrorAnalysisForResponse(
  responseId: string
): Promise<ErrorAnalysis | null> {
  const db = getPrisma();

  return db.errorAnalysis.findUnique({
    where: { responseId },
  });
}

/**
 * Get all error analyses for an object.
 */
export async function getErrorAnalysesForObject(
  objectId: string,
  limit?: number
): Promise<ErrorAnalysis[]> {
  const db = getPrisma();

  return db.errorAnalysis.findMany({
    where: { objectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get error analyses by component type.
 */
export async function getErrorsByComponent(
  component: ComponentCode,
  goalId?: string,
  limit: number = 50
): Promise<ErrorAnalysis[]> {
  const db = getPrisma();

  return db.errorAnalysis.findMany({
    where: {
      component,
      ...(goalId ? { object: { goalId } } : {}),
    },
    include: { object: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Identify error patterns across objects.
 */
export async function identifyErrorPatterns(
  goalId: string,
  windowDays: number = 14
): Promise<ErrorPattern[]> {
  const db = getPrisma();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const errors = await db.errorAnalysis.findMany({
    where: {
      object: { goalId },
      createdAt: { gte: since },
    },
    include: { object: true },
    orderBy: { createdAt: 'desc' },
  });

  // Group by component and error type
  const patterns = new Map<string, ErrorPattern>();

  for (const error of errors) {
    const key = `${error.component}:${error.errorType}`;

    if (!patterns.has(key)) {
      patterns.set(key, {
        component: error.component as ComponentCode,
        errorType: error.errorType,
        count: 0,
        recentCount: 0,
        examples: [],
      });
    }

    const pattern = patterns.get(key)!;
    pattern.count++;

    if (error.createdAt >= recentSince) {
      pattern.recentCount++;
    }

    // Keep up to 3 examples
    if (pattern.examples.length < 3) {
      pattern.examples.push({
        objectContent: error.object.content,
        explanation: error.explanation,
        correction: error.correction,
      });
    }
  }

  // Sort by count descending
  return Array.from(patterns.values()).sort((a, b) => b.count - a.count);
}

/**
 * Find co-occurring errors (errors that appear together).
 */
export async function findCooccurringErrors(
  goalId: string,
  windowDays: number = 14
): Promise<Array<{ components: ComponentCode[]; count: number }>> {
  const db = getPrisma();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Get all responses with errors in the window
  const responses = await db.response.findMany({
    where: {
      object: { goalId },
      correct: false,
      createdAt: { gte: since },
    },
    include: {
      object: {
        include: {
          errorAnalyses: true,
        },
      },
    },
  });

  // Count co-occurrences by session
  const cooccurrences = new Map<string, number>();

  // Group responses by session
  const bySession = new Map<string, Set<ComponentCode>>();

  for (const response of responses) {
    if (!bySession.has(response.sessionId)) {
      bySession.set(response.sessionId, new Set());
    }

    for (const analysis of response.object.errorAnalyses) {
      bySession.get(response.sessionId)!.add(analysis.component as ComponentCode);
    }
  }

  // Count pairs
  for (const components of bySession.values()) {
    const arr = Array.from(components).sort();
    if (arr.length >= 2) {
      const key = arr.join(',');
      cooccurrences.set(key, (cooccurrences.get(key) || 0) + 1);
    }
  }

  return Array.from(cooccurrences.entries())
    .map(([key, count]) => ({
      components: key.split(',') as ComponentCode[],
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// =============================================================================
// Component Error Stats Functions
// =============================================================================

/**
 * Get or create component error stats.
 */
export async function getOrCreateComponentStats(
  userId: string,
  component: ComponentCode,
  goalId?: string
): Promise<ComponentErrorStats> {
  const db = getPrisma();

  const existing = await db.componentErrorStats.findUnique({
    where: {
      userId_component_goalId: {
        userId,
        component,
        goalId: goalId ?? '',
      },
    },
  });

  if (existing) return existing;

  return db.componentErrorStats.create({
    data: {
      userId,
      component,
      goalId: goalId ?? null,
    },
  });
}

/**
 * Update component error statistics.
 */
export async function updateComponentStats(
  userId: string,
  component: ComponentCode,
  goalId: string | null,
  stats: {
    totalErrors?: number;
    recentErrors?: number;
    errorRate?: number;
    trend?: number;
    recommendation?: string | null;
  }
): Promise<ComponentErrorStats> {
  const db = getPrisma();

  return db.componentErrorStats.upsert({
    where: {
      userId_component_goalId: {
        userId,
        component,
        goalId: goalId ?? '',
      },
    },
    create: {
      userId,
      component,
      goalId,
      totalErrors: stats.totalErrors ?? 0,
      recentErrors: stats.recentErrors ?? 0,
      errorRate: stats.errorRate ?? 0,
      trend: stats.trend ?? 0,
      recommendation: stats.recommendation,
    },
    update: stats,
  });
}

/**
 * Get all component stats for a user.
 */
export async function getUserComponentStats(
  userId: string,
  goalId?: string
): Promise<ComponentErrorStats[]> {
  const db = getPrisma();

  return db.componentErrorStats.findMany({
    where: {
      userId,
      ...(goalId ? { goalId } : {}),
    },
    orderBy: { errorRate: 'desc' },
  });
}

/**
 * Recalculate component statistics from error analyses.
 */
export async function recalculateComponentStats(
  userId: string,
  goalId?: string
): Promise<ComponentErrorStats[]> {
  const db = getPrisma();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get all responses for the user/goal
  const responses = await db.response.findMany({
    where: {
      session: {
        userId,
        ...(goalId ? { goalId } : {}),
      },
      createdAt: { gte: twoWeeksAgo },
    },
    include: {
      object: {
        include: { errorAnalyses: true },
      },
    },
  });

  // Calculate stats per component
  const components: ComponentCode[] = ['PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG'];
  const results: ComponentErrorStats[] = [];

  for (const component of components) {
    const componentResponses = responses.filter((r) =>
      r.object.errorAnalyses.some((e) => e.component === component)
    );

    const totalErrors = componentResponses.length;
    const recentErrors = componentResponses.filter(
      (r) => r.createdAt >= weekAgo
    ).length;
    const olderErrors = totalErrors - recentErrors;

    // Calculate error rate
    // Map component codes to object types (PHON -> phoneme, MORPH -> morpheme, etc.)
    const componentToType: Record<string, string> = {
      PHON: 'phoneme',
      MORPH: 'morpheme',
      LEX: 'lexeme',
      SYN: 'syntax',
      PRAG: 'pragmatic',
      COLL: 'collocation',
    };
    const targetType = componentToType[component] || component.toLowerCase();
    const totalForComponent = responses.filter(
      (r) => r.object.type === targetType
    ).length;
    const errorRate = totalForComponent > 0 ? totalErrors / totalForComponent : 0;

    // Calculate trend (positive = getting worse)
    const trend = olderErrors > 0
      ? (recentErrors - olderErrors / 2) / (olderErrors / 2)
      : recentErrors > 0 ? 1 : 0;

    // Generate recommendation
    let recommendation: string | null = null;
    if (errorRate > 0.4) {
      recommendation = `Focus on ${component} exercises. Error rate is ${(errorRate * 100).toFixed(0)}%.`;
    } else if (trend > 0.3) {
      recommendation = `${component} errors increasing. Consider review sessions.`;
    }

    const stats = await updateComponentStats(userId, component, goalId ?? null, {
      totalErrors,
      recentErrors,
      errorRate,
      trend,
      recommendation,
    });

    results.push(stats);
  }

  return results;
}

/**
 * Detect bottleneck components.
 */
export async function detectBottlenecks(
  userId: string,
  goalId?: string,
  threshold: number = 0.3
): Promise<BottleneckResult[]> {
  const stats = await getUserComponentStats(userId, goalId);

  return stats.map((stat) => ({
    component: stat.component as ComponentCode,
    errorRate: stat.errorRate,
    trend: stat.trend,
    totalErrors: stat.totalErrors,
    recentErrors: stat.recentErrors,
    recommendation: stat.recommendation,
    isBottleneck: stat.errorRate >= threshold || stat.trend > 0.5,
  }));
}

/**
 * Get the primary bottleneck blocking progress.
 */
export async function getPrimaryBottleneck(
  userId: string,
  goalId?: string
): Promise<BottleneckResult | null> {
  const bottlenecks = await detectBottlenecks(userId, goalId);
  const primary = bottlenecks
    .filter((b) => b.isBottleneck)
    .sort((a, b) => b.errorRate - a.errorRate)[0];

  return primary ?? null;
}

/**
 * Generate remediation recommendations.
 */
export async function generateRemediationPlan(
  userId: string,
  goalId?: string
): Promise<Array<{
  component: ComponentCode;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  suggestedTaskTypes: string[];
}>> {
  const bottlenecks = await detectBottlenecks(userId, goalId);
  const patterns = goalId ? await identifyErrorPatterns(goalId) : [];

  const plan: Array<{
    component: ComponentCode;
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    suggestedTaskTypes: string[];
  }> = [];

  for (const bottleneck of bottlenecks) {
    if (!bottleneck.isBottleneck && bottleneck.errorRate < 0.15) continue;

    const componentPatterns = patterns.filter(
      (p) => p.component === bottleneck.component
    );

    let priority: 'high' | 'medium' | 'low';
    if (bottleneck.errorRate >= 0.4 || bottleneck.trend > 0.5) {
      priority = 'high';
    } else if (bottleneck.errorRate >= 0.25 || bottleneck.trend > 0.2) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    const suggestedTaskTypes = getTaskTypesForComponent(bottleneck.component);

    let recommendation = bottleneck.recommendation || '';
    if (componentPatterns.length > 0) {
      const topPattern = componentPatterns[0];
      recommendation += ` Most common error: ${topPattern.errorType} (${topPattern.count} occurrences).`;
    }

    plan.push({
      component: bottleneck.component,
      priority,
      recommendation: recommendation.trim(),
      suggestedTaskTypes,
    });
  }

  return plan.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Get suggested task types for a component.
 */
function getTaskTypesForComponent(component: ComponentCode): string[] {
  const taskMap: Record<ComponentCode, string[]> = {
    PHON: ['dictation', 'listening_comprehension', 'word_formation_analysis'],
    MORPH: ['word_formation_analysis', 'constrained_fill', 'sentence_completion'],
    LEX: ['cloze_deletion', 'word_bank_fill', 'matching', 'collocation_judgment'],
    SYNT: ['sentence_combining', 'sentence_splitting', 'grammar_identification', 'error_correction'],
    PRAG: ['register_shift', 'register_appropriateness', 'dialogue_completion'],
  };

  return taskMap[component] || [];
}
