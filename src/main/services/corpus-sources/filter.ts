/**
 * Source Filter Engine
 *
 * Filters and ranks corpus sources based on goal specifications.
 * Uses goal categorization answers and natural language input to select optimal sources.
 */

import {
  CORPUS_SOURCES,
  getEnabledSources,
  type CorpusSource,
  type SourceType,
} from './registry';

// =============================================================================
// Types
// =============================================================================

export interface SourceFilter {
  domains?: string[];
  modalities?: string[];
  benchmarks?: string[];
  types?: SourceType[];
  minReliability?: number;
  maxSources?: number;
}

export interface RankedSource {
  source: CorpusSource;
  score: number;           // Combined relevance score (0-1)
  matchReasons: string[];  // Why this source was selected
}

export interface GoalSpec {
  domain: string;
  modality: string;        // JSON string of modalities
  genre: string;
  purpose: string;
  benchmark?: string | null;
}

// =============================================================================
// Core Filtering
// =============================================================================

/**
 * Filter sources based on criteria.
 */
export function filterSources(filter: SourceFilter): CorpusSource[] {
  let sources = getEnabledSources();

  // Filter by domains
  if (filter.domains && filter.domains.length > 0) {
    sources = sources.filter((s) =>
      s.domains.includes('*') || filter.domains!.some((d) => s.domains.includes(d))
    );
  }

  // Filter by modalities
  if (filter.modalities && filter.modalities.length > 0) {
    sources = sources.filter((s) =>
      filter.modalities!.some((m) => s.modalities.includes(m))
    );
  }

  // Filter by benchmarks
  if (filter.benchmarks && filter.benchmarks.length > 0) {
    sources = sources.filter((s) =>
      !s.benchmarks || filter.benchmarks!.some((b) => s.benchmarks?.includes(b))
    );
  }

  // Filter by types
  if (filter.types && filter.types.length > 0) {
    sources = sources.filter((s) => filter.types!.includes(s.type));
  }

  // Filter by minimum reliability
  if (filter.minReliability !== undefined) {
    sources = sources.filter((s) => s.reliability >= filter.minReliability!);
  }

  // Sort by priority (highest first)
  sources.sort((a, b) => b.priority - a.priority);

  // Limit results
  if (filter.maxSources !== undefined) {
    sources = sources.slice(0, filter.maxSources);
  }

  return sources;
}

// =============================================================================
// Goal-Based Ranking
// =============================================================================

/**
 * Rank sources for a specific goal specification.
 * Returns sources ordered by relevance with explanations.
 */
export function rankSourcesForGoal(
  goal: GoalSpec,
  nlDescription?: string
): RankedSource[] {
  const rankedSources: RankedSource[] = [];
  const sources = getEnabledSources();

  // Parse modalities from JSON string
  let modalities: string[] = [];
  try {
    modalities = JSON.parse(goal.modality);
  } catch {
    modalities = [goal.modality];
  }

  for (const source of sources) {
    let score = 0;
    const matchReasons: string[] = [];

    // Domain matching (highest weight)
    if (source.domains.includes('*')) {
      score += 0.15;
      matchReasons.push('Universal source');
    } else if (source.domains.includes(goal.domain)) {
      score += 0.30;
      matchReasons.push(`Matches domain: ${goal.domain}`);
    }

    // Benchmark matching (very high weight for exam prep)
    if (goal.benchmark && source.benchmarks?.includes(goal.benchmark)) {
      score += 0.35;
      matchReasons.push(`Aligned with ${goal.benchmark}`);
    }

    // Modality matching
    const modalityMatches = modalities.filter((m) => source.modalities.includes(m));
    if (modalityMatches.length > 0) {
      score += 0.15 * (modalityMatches.length / modalities.length);
      matchReasons.push(`Supports: ${modalityMatches.join(', ')}`);
    }

    // Reliability bonus
    score += source.reliability * 0.10;

    // Priority bonus (normalized)
    score += (source.priority / 100) * 0.10;

    // NL description keyword matching
    if (nlDescription) {
      const nlScore = calculateNLRelevance(source, nlDescription);
      if (nlScore > 0) {
        score += nlScore * 0.15;
        matchReasons.push('Matches description keywords');
      }
    }

    // Only include sources with non-zero relevance
    if (score > 0.1 || source.domains.includes('*')) {
      rankedSources.push({ source, score, matchReasons });
    }
  }

  // Sort by score (highest first)
  rankedSources.sort((a, b) => b.score - a.score);

  return rankedSources;
}

/**
 * Calculate relevance based on natural language description.
 */
function calculateNLRelevance(source: CorpusSource, description: string): number {
  const descLower = description.toLowerCase();
  let matches = 0;
  let totalKeywords = 0;

  // Domain keywords
  const domainKeywords: Record<string, string[]> = {
    medical: ['medical', 'health', 'nursing', 'patient', 'hospital', 'clinical', 'doctor', 'nurse'],
    legal: ['legal', 'law', 'court', 'lawyer', 'attorney', 'contract', 'regulation'],
    business: ['business', 'corporate', 'management', 'marketing', 'finance', 'office'],
    academic: ['academic', 'research', 'university', 'study', 'thesis', 'paper'],
    technology: ['technology', 'software', 'programming', 'computer', 'IT', 'tech'],
    general: ['everyday', 'daily', 'conversation', 'casual', 'common'],
  };

  // Check if source domains match NL keywords
  for (const domain of source.domains) {
    const keywords = domainKeywords[domain] || [];
    for (const keyword of keywords) {
      totalKeywords++;
      if (descLower.includes(keyword)) {
        matches++;
      }
    }
  }

  // Benchmark keywords
  const benchmarkKeywords: Record<string, string[]> = {
    CELBAN: ['celban', 'nursing', 'canadian nurse'],
    IELTS: ['ielts', 'immigration', 'study abroad'],
    TOEFL: ['toefl', 'university', 'american english'],
    CELPIP: ['celpip', 'canadian', 'pr', 'permanent resident'],
  };

  if (source.benchmarks) {
    for (const benchmark of source.benchmarks) {
      const keywords = benchmarkKeywords[benchmark] || [];
      for (const keyword of keywords) {
        totalKeywords++;
        if (descLower.includes(keyword.toLowerCase())) {
          matches += 2; // Higher weight for benchmark matches
        }
      }
    }
  }

  // Modality keywords
  const modalityKeywords: Record<string, string[]> = {
    reading: ['read', 'reading', 'text', 'article', 'document'],
    listening: ['listen', 'listening', 'audio', 'hear', 'podcast', 'video'],
    writing: ['write', 'writing', 'essay', 'compose'],
    speaking: ['speak', 'speaking', 'conversation', 'talk', 'oral'],
  };

  for (const modality of source.modalities) {
    const keywords = modalityKeywords[modality] || [];
    for (const keyword of keywords) {
      totalKeywords++;
      if (descLower.includes(keyword)) {
        matches++;
      }
    }
  }

  return totalKeywords > 0 ? matches / totalKeywords : 0;
}

// =============================================================================
// Specialized Filters
// =============================================================================

/**
 * Get sources optimized for a specific benchmark exam.
 */
export function getSourcesForBenchmark(benchmark: string): RankedSource[] {
  const sources = getEnabledSources();
  const rankedSources: RankedSource[] = [];

  for (const source of sources) {
    let score = 0;
    const matchReasons: string[] = [];

    // Direct benchmark match - highest priority
    if (source.benchmarks?.includes(benchmark)) {
      score = 1.0;
      matchReasons.push(`Official ${benchmark} material`);
    }
    // Exam-type sources for the same test category
    else if (source.type === 'exam') {
      score = 0.5;
      matchReasons.push('Exam preparation material');
    }
    // Academic sources for academic benchmarks
    else if (['TOEFL', 'IELTS'].includes(benchmark) && source.type === 'academic') {
      score = 0.4;
      matchReasons.push('Academic source for standardized test prep');
    }
    // Encyclopedia as general reference
    else if (source.type === 'encyclopedia') {
      score = 0.2;
      matchReasons.push('General reference material');
    }

    if (score > 0) {
      rankedSources.push({ source, score, matchReasons });
    }
  }

  rankedSources.sort((a, b) => b.score - a.score);
  return rankedSources;
}

/**
 * Get sources optimized for a specific domain.
 */
export function getSourcesForDomain(domain: string): RankedSource[] {
  const sources = getEnabledSources();
  const rankedSources: RankedSource[] = [];

  for (const source of sources) {
    let score = 0;
    const matchReasons: string[] = [];

    // Direct domain match
    if (source.domains.includes(domain)) {
      score = 0.8 + source.reliability * 0.2;
      matchReasons.push(`Specialized in ${domain}`);
    }
    // Universal sources
    else if (source.domains.includes('*')) {
      score = 0.3 + source.reliability * 0.1;
      matchReasons.push('General purpose source');
    }

    if (score > 0) {
      rankedSources.push({ source, score, matchReasons });
    }
  }

  rankedSources.sort((a, b) => b.score - a.score);
  return rankedSources;
}

/**
 * Get sources that support all specified modalities.
 */
export function getSourcesForModalities(modalities: string[]): RankedSource[] {
  const sources = getEnabledSources();
  const rankedSources: RankedSource[] = [];

  for (const source of sources) {
    const supported = modalities.filter((m) => source.modalities.includes(m));

    if (supported.length > 0) {
      const coverage = supported.length / modalities.length;
      const score = coverage * 0.7 + source.reliability * 0.3;

      rankedSources.push({
        source,
        score,
        matchReasons: [`Covers ${supported.length}/${modalities.length} modalities: ${supported.join(', ')}`],
      });
    }
  }

  rankedSources.sort((a, b) => b.score - a.score);
  return rankedSources;
}

// =============================================================================
// Source Selection Helpers
// =============================================================================

/**
 * Get recommended sources for a goal, limited to top N.
 */
export function getRecommendedSources(
  goal: GoalSpec,
  nlDescription?: string,
  maxSources: number = 5
): RankedSource[] {
  const ranked = rankSourcesForGoal(goal, nlDescription);
  return ranked.slice(0, maxSources);
}

/**
 * Get source IDs that should be enabled by default for a goal.
 */
export function getDefaultSourceIds(goal: GoalSpec): string[] {
  const recommended = getRecommendedSources(goal, undefined, 10);

  // Always include user uploads and Claude fallback
  const defaultIds = new Set<string>(['user-upload', 'claude-generated']);

  // Add top recommended sources
  for (const ranked of recommended) {
    if (ranked.score > 0.3) {
      defaultIds.add(ranked.source.id);
    }
  }

  return Array.from(defaultIds);
}

/**
 * Validate that selected sources are appropriate for a goal.
 * Returns warnings for potentially mismatched sources.
 */
export function validateSourceSelection(
  goal: GoalSpec,
  selectedSourceIds: string[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const ranked = rankSourcesForGoal(goal);
  const rankedMap = new Map(ranked.map((r) => [r.source.id, r]));

  for (const sourceId of selectedSourceIds) {
    const rankedSource = rankedMap.get(sourceId);

    if (!rankedSource) {
      // Source not found in ranked results - might be disabled or invalid
      const source = CORPUS_SOURCES.find((s) => s.id === sourceId);
      if (!source) {
        warnings.push(`Unknown source: ${sourceId}`);
      } else if (!source.enabled) {
        warnings.push(`Source "${source.name}" is disabled`);
      }
    } else if (rankedSource.score < 0.2) {
      warnings.push(
        `Source "${rankedSource.source.name}" has low relevance (${Math.round(rankedSource.score * 100)}%) for your goal`
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
