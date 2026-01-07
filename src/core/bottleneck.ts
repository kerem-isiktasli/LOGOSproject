/**
 * Bottleneck Detection Module
 *
 * Pure TypeScript implementation of threshold detection algorithm.
 * Identifies which language component is blocking overall advancement.
 *
 * From ALGORITHMIC-FOUNDATIONS.md Part 7
 *
 * Key insight: Errors cascade through the linguistic hierarchy:
 * Phonology → Morphology → Lexical → Syntactic → Pragmatic
 *
 * A morphology problem (e.g., verb conjugation) will manifest as errors
 * in lexical, syntactic, and pragmatic tasks. We detect the ROOT cause,
 * not just the highest error rate.
 */

import type { ComponentType } from './types';

// ============================================================================
// Types
// ============================================================================

// Re-export ComponentType for consumers of this module
export type { ComponentType };

/**
 * Short-form component type used internally by bottleneck detection.
 * Maps to the canonical ComponentType from types.ts.
 */
type ShortComponentType = 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';

/**
 * Normalize any ComponentType to its short form.
 */
function toShortForm(type: ComponentType): ShortComponentType {
  const mapping: Record<string, ShortComponentType> = {
    'PHON': 'PHON',
    'MORPH': 'MORPH',
    'LEX': 'LEX',
    'SYNT': 'SYNT',
    'PRAG': 'PRAG',
    'phonological': 'PHON',
    'morphological': 'MORPH',
    'lexical': 'LEX',
    'syntactic': 'SYNT',
    'pragmatic': 'PRAG',
  };
  return mapping[type] || 'LEX'; // Default fallback
}

/**
 * Evidence for a bottleneck in a specific component.
 */
export interface BottleneckEvidence {
  componentType: ComponentType;
  errorRate: number;
  errorPatterns: string[];
  cooccurringErrors: ComponentType[];
  improvement: number;  // Positive = improving, negative = getting worse
}

/**
 * Complete bottleneck analysis result.
 */
export interface BottleneckAnalysis {
  primaryBottleneck: ComponentType | null;
  confidence: number;
  evidence: BottleneckEvidence[];
  recommendation: string;
}

/**
 * Cascade analysis for error propagation.
 */
export interface CascadeAnalysis {
  rootCause: ComponentType | null;
  cascadeChain: ComponentType[];
  confidence: number;
}

/**
 * Configuration for bottleneck detection.
 */
export interface BottleneckDetectionConfig {
  minResponses: number;
  minResponsesPerType: number;
  errorRateThreshold: number;
  cascadeConfidenceThreshold: number;
}

/**
 * Response data for analysis (minimal interface).
 */
export interface ResponseData {
  id: string;
  correct: boolean;
  componentType: ComponentType;
  sessionId: string;
  content: string;      // The language object content
  timestamp: Date;
}

/**
 * Component statistics aggregation.
 */
interface ComponentStats {
  total: number;
  errors: number;
  errorResponses: ResponseData[];
  recentErrors: number;  // Last 25% of responses
  recentTotal: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default bottleneck detection configuration.
 */
export const DEFAULT_BOTTLENECK_CONFIG: BottleneckDetectionConfig = {
  minResponses: 20,
  minResponsesPerType: 5,
  errorRateThreshold: 0.3,
  cascadeConfidenceThreshold: 0.7
};

/**
 * Component cascade order (foundational → advanced).
 * Errors in earlier components propagate to later ones.
 */
export const CASCADE_ORDER: ComponentType[] = ['PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG'];

/**
 * Human-readable component names for recommendations.
 */
const COMPONENT_NAMES: Record<ShortComponentType, string> = {
  'PHON': 'Phonology (sounds and pronunciation)',
  'MORPH': 'Morphology (word forms and structure)',
  'LEX': 'Vocabulary (word meanings)',
  'SYNT': 'Syntax (sentence structure)',
  'PRAG': 'Pragmatics (context and usage)'
};

/**
 * Short component descriptions for patterns.
 */
const COMPONENT_SHORT: Record<ShortComponentType, string> = {
  'PHON': 'pronunciation',
  'MORPH': 'word forms',
  'LEX': 'vocabulary',
  'SYNT': 'grammar',
  'PRAG': 'usage'
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Analyze responses to detect learning bottlenecks.
 *
 * This is the main entry point for bottleneck detection.
 *
 * @param responses - Recent response data to analyze
 * @param config - Detection configuration
 * @returns Complete bottleneck analysis
 */
export function analyzeBottleneck(
  responses: ResponseData[],
  config: BottleneckDetectionConfig = DEFAULT_BOTTLENECK_CONFIG
): BottleneckAnalysis {
  // Check minimum data requirement
  if (responses.length < config.minResponses) {
    return {
      primaryBottleneck: null,
      confidence: 0,
      evidence: [],
      recommendation: `Need more data for analysis (${responses.length}/${config.minResponses} responses)`
    };
  }

  // Calculate statistics by component type
  const stats = calculateComponentStats(responses);

  // Build evidence array
  const evidence = buildEvidence(stats, responses, config);

  // Analyze for cascading errors (find root cause)
  const cascade = analyzeCascadingErrors(evidence, config);

  // Determine primary bottleneck
  let primaryBottleneck: ComponentType | null = cascade.rootCause;

  // If no cascade detected, use highest error rate
  if (!primaryBottleneck) {
    primaryBottleneck = findHighestErrorRate(evidence, config);
  }

  // Calculate overall confidence
  const confidence = calculateConfidence(evidence, responses.length, cascade);

  // Generate actionable recommendation
  const recommendation = generateRecommendation(primaryBottleneck, evidence, cascade);

  return {
    primaryBottleneck,
    confidence,
    evidence: evidence.sort((a, b) => b.errorRate - a.errorRate),
    recommendation
  };
}

/**
 * Calculate statistics for each component type.
 */
function calculateComponentStats(
  responses: ResponseData[]
): Map<ComponentType, ComponentStats> {
  const stats = new Map<ComponentType, ComponentStats>();

  // Initialize stats for all component types
  for (const type of CASCADE_ORDER) {
    stats.set(type, {
      total: 0,
      errors: 0,
      errorResponses: [],
      recentErrors: 0,
      recentTotal: 0
    });
  }

  // Sort by timestamp for recency calculation
  const sorted = [...responses].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const recentThreshold = Math.floor(sorted.length * 0.75);

  // Aggregate statistics
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const stat = stats.get(r.componentType);

    if (stat) {
      stat.total++;
      if (!r.correct) {
        stat.errors++;
        stat.errorResponses.push(r);
      }

      // Track recent performance (last 25%)
      if (i >= recentThreshold) {
        stat.recentTotal++;
        if (!r.correct) stat.recentErrors++;
      }
    }
  }

  return stats;
}

/**
 * Build evidence array from component statistics.
 */
function buildEvidence(
  stats: Map<ComponentType, ComponentStats>,
  responses: ResponseData[],
  config: BottleneckDetectionConfig
): BottleneckEvidence[] {
  const evidence: BottleneckEvidence[] = [];

  for (const [type, stat] of stats) {
    if (stat.total < config.minResponsesPerType) {
      // Not enough data for this component
      continue;
    }

    const errorRate = stat.total > 0 ? stat.errors / stat.total : 0;
    const recentErrorRate = stat.recentTotal > 0 ? stat.recentErrors / stat.recentTotal : 0;
    const improvement = errorRate - recentErrorRate;  // Positive = improving

    evidence.push({
      componentType: type,
      errorRate,
      errorPatterns: analyzeErrorPatterns(stat.errorResponses),
      cooccurringErrors: findCooccurringErrors(type, responses),
      improvement
    });
  }

  return evidence;
}

/**
 * Analyze error patterns within a component type.
 * Clusters errors by similarity to identify recurring issues.
 *
 * @param errors - Error responses for this component
 * @returns Array of pattern descriptions with counts
 */
export function analyzeErrorPatterns(errors: ResponseData[]): string[] {
  const patterns = new Map<string, number>();

  for (const error of errors) {
    const pattern = extractErrorPattern(error);
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
  }

  // Return patterns that occur at least twice
  return Array.from(patterns.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)  // Top 5 patterns
    .map(([pattern, count]) => `${pattern} (${count}×)`);
}

/**
 * Extract a pattern from an error response.
 * Groups similar content into pattern categories.
 */
function extractErrorPattern(response: ResponseData): string {
  const content = response.content.toLowerCase();

  // Pattern detection by component type
  switch (response.componentType) {
    case 'PHON':
      // Group by similar sounds
      if (content.includes('th')) return 'th-sounds';
      if (content.includes('r') || content.includes('l')) return 'r/l distinction';
      if (content.match(/[aeiou]{2}/)) return 'vowel combinations';
      return 'other pronunciation';

    case 'MORPH':
      // Group by morphological type
      if (content.match(/ing$/)) return '-ing endings';
      if (content.match(/ed$/)) return '-ed endings';
      if (content.match(/s$/)) return 'plurals/3rd person';
      if (content.match(/tion$/)) return '-tion nominalizations';
      return 'other word forms';

    case 'LEX':
      // Group by length/complexity
      if (content.length > 10) return 'complex vocabulary';
      if (content.length <= 4) return 'basic vocabulary';
      return 'intermediate vocabulary';

    case 'SYNT':
      // Group by structure complexity
      if (content.includes('if') || content.includes('when')) return 'conditional clauses';
      if (content.includes('who') || content.includes('which')) return 'relative clauses';
      if (content.includes(',')) return 'compound sentences';
      return 'simple sentence patterns';

    case 'PRAG':
      // Group by register/context
      if (content.includes('please') || content.includes('could')) return 'politeness markers';
      if (content.includes('sorry') || content.includes('excuse')) return 'apology patterns';
      return 'discourse markers';

    default:
      return 'unclassified';
  }
}

/**
 * Find components that have errors co-occurring with target component.
 * High co-occurrence suggests related problems.
 *
 * @param targetType - Component to analyze
 * @param responses - All responses
 * @returns Components with co-occurring errors
 */
export function findCooccurringErrors(
  targetType: ComponentType,
  responses: ResponseData[]
): ComponentType[] {
  // Group errors by session
  const sessionErrors = new Map<string, Set<ComponentType>>();

  for (const r of responses) {
    if (!r.correct) {
      const errors = sessionErrors.get(r.sessionId) || new Set();
      errors.add(r.componentType);
      sessionErrors.set(r.sessionId, errors);
    }
  }

  // Count co-occurrences
  const cooccurrence = new Map<ComponentType, number>();

  for (const errors of sessionErrors.values()) {
    if (errors.has(targetType)) {
      for (const type of errors) {
        if (type !== targetType) {
          cooccurrence.set(type, (cooccurrence.get(type) || 0) + 1);
        }
      }
    }
  }

  // Return components with significant co-occurrence (≥2)
  return Array.from(cooccurrence.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([type, _]) => type);
}

/**
 * Analyze for cascading errors.
 *
 * Errors in foundational components (e.g., morphology) can cause
 * downstream errors (e.g., lexical, syntactic). This finds the root cause.
 *
 * @param evidence - Evidence array
 * @param config - Detection config
 * @returns Cascade analysis result
 */
export function analyzeCascadingErrors(
  evidence: BottleneckEvidence[],
  config: BottleneckDetectionConfig = DEFAULT_BOTTLENECK_CONFIG
): CascadeAnalysis {
  // Find earliest component in cascade with high error rate
  for (const type of CASCADE_ORDER) {
    const ev = evidence.find(e => e.componentType === type);

    if (ev && ev.errorRate >= config.errorRateThreshold) {
      // Check if downstream components also have errors
      const typeIndex = CASCADE_ORDER.indexOf(type);
      const downstreamErrors = CASCADE_ORDER
        .slice(typeIndex + 1)
        .filter(t => {
          const downstream = evidence.find(e => e.componentType === t);
          return downstream && downstream.errorRate >= config.errorRateThreshold * 0.67;
        });

      if (downstreamErrors.length > 0) {
        // Found a cascade pattern
        return {
          rootCause: type,
          cascadeChain: [type, ...downstreamErrors],
          confidence: config.cascadeConfidenceThreshold
        };
      }
    }
  }

  // No cascade detected
  return {
    rootCause: null,
    cascadeChain: [],
    confidence: 0
  };
}

/**
 * Find component with highest error rate.
 */
function findHighestErrorRate(
  evidence: BottleneckEvidence[],
  config: BottleneckDetectionConfig
): ComponentType | null {
  let maxErrorRate = 0;
  let bottleneck: ComponentType | null = null;

  for (const ev of evidence) {
    if (ev.errorRate > maxErrorRate && ev.errorRate >= config.errorRateThreshold) {
      maxErrorRate = ev.errorRate;
      bottleneck = ev.componentType;
    }
  }

  return bottleneck;
}

/**
 * Calculate overall confidence in the analysis.
 */
function calculateConfidence(
  evidence: BottleneckEvidence[],
  totalResponses: number,
  cascade: CascadeAnalysis
): number {
  if (evidence.length === 0) return 0;

  // Base confidence from data quantity
  const dataConfidence = Math.min(1, totalResponses / 50);

  // Boost if cascade detected
  const cascadeBoost = cascade.rootCause ? 0.2 : 0;

  // Boost if error rates are clearly differentiated
  const rates = evidence.map(e => e.errorRate).sort((a, b) => b - a);
  const differentiation = rates.length >= 2 ? (rates[0] - rates[1]) : 0;
  const differentiationBoost = Math.min(0.2, differentiation);

  return Math.min(1, dataConfidence + cascadeBoost + differentiationBoost);
}

/**
 * Generate actionable recommendation for addressing the bottleneck.
 */
function generateRecommendation(
  bottleneck: ComponentType | null,
  evidence: BottleneckEvidence[],
  cascade: CascadeAnalysis
): string {
  if (!bottleneck) {
    return 'No significant bottleneck detected. Continue balanced practice across all areas.';
  }

  const ev = evidence.find(e => e.componentType === bottleneck);
  const errorRate = ev ? Math.round(ev.errorRate * 100) : 0;
  const componentName = COMPONENT_NAMES[toShortForm(bottleneck)];

  let recommendation = `Focus on ${componentName} (${errorRate}% error rate). `;

  // Add cascade information
  if (cascade.rootCause === bottleneck && cascade.cascadeChain.length > 1) {
    const downstream = cascade.cascadeChain.slice(1)
      .map(t => COMPONENT_SHORT[toShortForm(t)])
      .join(', ');
    recommendation += `Improving this will also help with ${downstream}. `;
  }

  // Add pattern-specific advice
  if (ev && ev.errorPatterns.length > 0) {
    const topPattern = ev.errorPatterns[0].split(' (')[0];
    recommendation += `Specifically practice: ${topPattern}.`;
  }

  // Add improvement note
  if (ev && ev.improvement > 0.05) {
    recommendation += ' (Already improving - keep it up!)';
  } else if (ev && ev.improvement < -0.05) {
    recommendation += ' (Needs extra attention - performance declining.)';
  }

  return recommendation;
}

// ============================================================================
// Improvement Trend Analysis
// ============================================================================

/**
 * Calculate improvement trend for a component.
 *
 * Compares error rate in first half vs second half of data.
 *
 * @param componentType - Component to analyze
 * @param responses - All responses (sorted by time)
 * @returns Improvement value (positive = improving)
 */
export function calculateImprovementTrend(
  componentType: ComponentType,
  responses: ResponseData[]
): number {
  const componentResponses = responses.filter(r => r.componentType === componentType);

  if (componentResponses.length < 4) return 0;

  const midpoint = Math.floor(componentResponses.length / 2);

  const firstHalf = componentResponses.slice(0, midpoint);
  const secondHalf = componentResponses.slice(midpoint);

  const firstErrorRate = firstHalf.filter(r => !r.correct).length / firstHalf.length;
  const secondErrorRate = secondHalf.filter(r => !r.correct).length / secondHalf.length;

  // Positive = improving (lower recent errors)
  return firstErrorRate - secondErrorRate;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get component type from string (type guard).
 */
export function isComponentType(value: string): value is ComponentType {
  return CASCADE_ORDER.includes(value as ComponentType);
}

/**
 * Get cascade position (lower = more foundational).
 */
export function getCascadePosition(type: ComponentType): number {
  return CASCADE_ORDER.indexOf(type);
}

/**
 * Check if one component can cause errors in another.
 */
export function canCauseErrors(
  upstream: ComponentType,
  downstream: ComponentType
): boolean {
  return getCascadePosition(upstream) < getCascadePosition(downstream);
}

/**
 * Get all downstream components that could be affected.
 */
export function getDownstreamComponents(type: ComponentType): ComponentType[] {
  const position = getCascadePosition(type);
  return CASCADE_ORDER.slice(position + 1);
}

/**
 * Get all upstream components that could be root causes.
 */
export function getUpstreamComponents(type: ComponentType): ComponentType[] {
  const position = getCascadePosition(type);
  return CASCADE_ORDER.slice(0, position);
}

/**
 * Create a summary of bottleneck status for display.
 */
export function summarizeBottleneck(analysis: BottleneckAnalysis): string {
  if (!analysis.primaryBottleneck) {
    return 'No bottleneck detected';
  }

  const ev = analysis.evidence.find(
    e => e.componentType === analysis.primaryBottleneck
  );

  if (!ev) {
    return `Bottleneck: ${COMPONENT_SHORT[toShortForm(analysis.primaryBottleneck)]}`;
  }

  const percent = Math.round(ev.errorRate * 100);
  return `${COMPONENT_SHORT[toShortForm(analysis.primaryBottleneck)]} (${percent}% errors)`;
}
