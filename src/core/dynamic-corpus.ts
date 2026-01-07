/**
 * LOGOS Dynamic Corpus Sourcing Module
 *
 * Enables runtime integration with external corpus APIs for dynamic
 * vocabulary extraction and content sourcing based on user goals.
 *
 * Academic Foundations:
 * - COCA (Corpus of Contemporary American English): Large-scale corpus research
 * - OPUS Parallel Corpus: Multilingual corpus resources
 * - Domain-specific NLP: Specialized vocabulary extraction techniques
 * - Corpus Linguistics (Sinclair, 1991): Principled vocabulary selection
 *
 * This module implements:
 * 1. Abstract corpus source interface for multiple providers
 * 2. Domain-specific vocabulary extraction
 * 3. Frequency and collocation analysis from external data
 * 4. Caching layer for API efficiency
 * 5. Fallback to static data when APIs unavailable
 *
 * @module core/dynamic-corpus
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Corpus source configuration.
 */
export interface CorpusSource {
  /** Unique source identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Source type */
  type: 'api' | 'file' | 'embedded';

  /** Base URL for API sources */
  baseUrl?: string;

  /** Supported domains */
  domains: string[];

  /** Supported languages */
  languages: string[];

  /** Rate limit (requests per minute) */
  rateLimit?: number;

  /** Whether source is currently available */
  isAvailable: boolean;

  /** Authentication required */
  requiresAuth: boolean;

  /** Priority for source selection (higher = preferred) */
  priority: number;
}

/**
 * Query parameters for corpus search.
 */
export interface CorpusQuery {
  /** Target domain */
  domain: string;

  /** Optional genre within domain */
  genre?: string;

  /** Minimum frequency threshold (0-1 normalized) */
  minFrequency?: number;

  /** Maximum difficulty threshold */
  maxDifficulty?: number;

  /** Target number of items */
  targetCount: number;

  /** Target language */
  language: string;

  /** Part of speech filter */
  posFilter?: string[];

  /** Exclude already known items */
  excludeIds?: string[];

  /** Search keywords for filtering */
  keywords?: string[];
}

/**
 * A vocabulary item extracted from corpus.
 */
export interface ExtractedItem {
  /** The word or phrase */
  content: string;

  /** Normalized frequency (0-1) */
  frequency: number;

  /** Domain relevance (0-1) */
  domainRelevance: number;

  /** Source domain */
  domain: string;

  /** Part of speech */
  pos?: string;

  /** Example contexts */
  contexts: string[];

  /** Common collocations */
  collocations: CollocationData[];

  /** Estimated difficulty (0-1) */
  estimatedDifficulty: number;

  /** Source corpus ID */
  sourceId: string;

  /** Raw frequency count (if available) */
  rawFrequency?: number;
}

/**
 * Collocation data for an item.
 */
export interface CollocationData {
  /** Co-occurring word */
  word: string;

  /** Collocation strength (MI, t-score, or similar) */
  strength: number;

  /** Position relative to target (left/right) */
  position: 'left' | 'right' | 'any';

  /** Distance in words */
  distance: number;
}

/**
 * Result of a corpus query.
 */
export interface CorpusResult {
  /** Source that provided results */
  source: CorpusSource;

  /** Extracted items */
  items: ExtractedItem[];

  /** Query metadata */
  metadata: {
    /** Query execution time (ms) */
    queryTime: number;

    /** Total items available (before filtering) */
    totalAvailable: number;

    /** Domain coverage score (0-1) */
    domainCoverage: number;

    /** Whether results are from cache */
    fromCache: boolean;

    /** Cache expiry time if cached */
    cacheExpiry?: Date;
  };
}

/**
 * Domain vocabulary statistics.
 */
export interface DomainVocabularyStats {
  /** Domain identifier */
  domain: string;

  /** Total vocabulary size */
  totalVocabulary: number;

  /** High-frequency vocabulary count */
  highFrequencyCount: number;

  /** Medium-frequency vocabulary count */
  mediumFrequencyCount: number;

  /** Low-frequency vocabulary count */
  lowFrequencyCount: number;

  /** Average word length */
  avgWordLength: number;

  /** Technical term ratio */
  technicalTermRatio: number;

  /** Last updated */
  updatedAt: Date;
}

/**
 * Cache entry for corpus results.
 */
interface CacheEntry {
  result: CorpusResult;
  createdAt: Date;
  expiresAt: Date;
  queryHash: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cache TTL (1 hour).
 */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Maximum cache size.
 */
const MAX_CACHE_SIZE = 100;

/**
 * Built-in corpus sources.
 */
export const CORPUS_SOURCES: CorpusSource[] = [
  {
    id: 'coca',
    name: 'Corpus of Contemporary American English',
    type: 'api',
    baseUrl: 'https://api.english-corpora.org/coca',
    domains: ['general', 'academic', 'news', 'fiction', 'spoken', 'magazine'],
    languages: ['en'],
    rateLimit: 100,
    isAvailable: false, // Requires subscription
    requiresAuth: true,
    priority: 10,
  },
  {
    id: 'bnc',
    name: 'British National Corpus',
    type: 'api',
    baseUrl: 'https://api.english-corpora.org/bnc',
    domains: ['general', 'academic', 'spoken', 'fiction'],
    languages: ['en'],
    rateLimit: 100,
    isAvailable: false,
    requiresAuth: true,
    priority: 9,
  },
  {
    id: 'opus',
    name: 'OPUS Parallel Corpus',
    type: 'api',
    baseUrl: 'https://opus.nlpl.eu/opusapi',
    domains: ['general', 'legal', 'medical', 'technical'],
    languages: ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de'],
    rateLimit: 60,
    isAvailable: true,
    requiresAuth: false,
    priority: 7,
  },
  {
    id: 'embedded_medical',
    name: 'LOGOS Medical Vocabulary',
    type: 'embedded',
    domains: ['medical', 'healthcare', 'nursing'],
    languages: ['en'],
    isAvailable: true,
    requiresAuth: false,
    priority: 5,
  },
  {
    id: 'embedded_business',
    name: 'LOGOS Business Vocabulary',
    type: 'embedded',
    domains: ['business', 'finance', 'marketing'],
    languages: ['en'],
    isAvailable: true,
    requiresAuth: false,
    priority: 5,
  },
  {
    id: 'embedded_academic',
    name: 'LOGOS Academic Vocabulary',
    type: 'embedded',
    domains: ['academic', 'research', 'scientific'],
    languages: ['en'],
    isAvailable: true,
    requiresAuth: false,
    priority: 5,
  },
  {
    id: 'embedded_legal',
    name: 'LOGOS Legal Vocabulary',
    type: 'embedded',
    domains: ['legal', 'law', 'contracts'],
    languages: ['en'],
    isAvailable: true,
    requiresAuth: false,
    priority: 5,
  },
];

/**
 * Domain-specific vocabulary samples (embedded fallback data).
 *
 * In production, these would be much larger datasets loaded from files.
 */
const EMBEDDED_VOCABULARY: Record<string, ExtractedItem[]> = {
  medical: [
    { content: 'diagnosis', frequency: 0.85, domainRelevance: 0.95, domain: 'medical', pos: 'noun', contexts: ['The diagnosis was confirmed by tests.'], collocations: [{ word: 'make', strength: 0.8, position: 'left', distance: 1 }], estimatedDifficulty: 0.4, sourceId: 'embedded_medical' },
    { content: 'prognosis', frequency: 0.65, domainRelevance: 0.92, domain: 'medical', pos: 'noun', contexts: ['The prognosis is favorable.'], collocations: [{ word: 'good', strength: 0.7, position: 'left', distance: 1 }], estimatedDifficulty: 0.5, sourceId: 'embedded_medical' },
    { content: 'symptom', frequency: 0.9, domainRelevance: 0.9, domain: 'medical', pos: 'noun', contexts: ['Common symptoms include fever.'], collocations: [{ word: 'present', strength: 0.75, position: 'left', distance: 1 }], estimatedDifficulty: 0.3, sourceId: 'embedded_medical' },
    { content: 'administer', frequency: 0.7, domainRelevance: 0.85, domain: 'medical', pos: 'verb', contexts: ['Administer the medication twice daily.'], collocations: [{ word: 'medication', strength: 0.85, position: 'right', distance: 1 }], estimatedDifficulty: 0.45, sourceId: 'embedded_medical' },
    { content: 'contraindication', frequency: 0.4, domainRelevance: 0.95, domain: 'medical', pos: 'noun', contexts: ['Pregnancy is a contraindication.'], collocations: [{ word: 'absolute', strength: 0.7, position: 'left', distance: 1 }], estimatedDifficulty: 0.7, sourceId: 'embedded_medical' },
    { content: 'complication', frequency: 0.75, domainRelevance: 0.88, domain: 'medical', pos: 'noun', contexts: ['Post-operative complications are rare.'], collocations: [{ word: 'develop', strength: 0.8, position: 'left', distance: 1 }], estimatedDifficulty: 0.4, sourceId: 'embedded_medical' },
    { content: 'chronic', frequency: 0.8, domainRelevance: 0.85, domain: 'medical', pos: 'adjective', contexts: ['Chronic pain management is essential.'], collocations: [{ word: 'condition', strength: 0.9, position: 'right', distance: 1 }], estimatedDifficulty: 0.35, sourceId: 'embedded_medical' },
    { content: 'acute', frequency: 0.78, domainRelevance: 0.87, domain: 'medical', pos: 'adjective', contexts: ['Acute symptoms require immediate attention.'], collocations: [{ word: 'care', strength: 0.85, position: 'right', distance: 1 }], estimatedDifficulty: 0.35, sourceId: 'embedded_medical' },
  ],
  business: [
    { content: 'leverage', frequency: 0.75, domainRelevance: 0.9, domain: 'business', pos: 'verb', contexts: ['Leverage your assets for growth.'], collocations: [{ word: 'financial', strength: 0.8, position: 'left', distance: 1 }], estimatedDifficulty: 0.5, sourceId: 'embedded_business' },
    { content: 'stakeholder', frequency: 0.8, domainRelevance: 0.92, domain: 'business', pos: 'noun', contexts: ['Stakeholders were informed of the changes.'], collocations: [{ word: 'key', strength: 0.85, position: 'left', distance: 1 }], estimatedDifficulty: 0.45, sourceId: 'embedded_business' },
    { content: 'synergy', frequency: 0.6, domainRelevance: 0.88, domain: 'business', pos: 'noun', contexts: ['The merger created significant synergies.'], collocations: [{ word: 'create', strength: 0.8, position: 'left', distance: 1 }], estimatedDifficulty: 0.55, sourceId: 'embedded_business' },
    { content: 'benchmark', frequency: 0.7, domainRelevance: 0.85, domain: 'business', pos: 'noun', contexts: ['Use industry benchmarks for comparison.'], collocations: [{ word: 'industry', strength: 0.9, position: 'left', distance: 1 }], estimatedDifficulty: 0.4, sourceId: 'embedded_business' },
    { content: 'scalable', frequency: 0.65, domainRelevance: 0.87, domain: 'business', pos: 'adjective', contexts: ['We need a scalable solution.'], collocations: [{ word: 'solution', strength: 0.85, position: 'right', distance: 1 }], estimatedDifficulty: 0.45, sourceId: 'embedded_business' },
  ],
  academic: [
    { content: 'hypothesis', frequency: 0.85, domainRelevance: 0.95, domain: 'academic', pos: 'noun', contexts: ['The hypothesis was tested.'], collocations: [{ word: 'test', strength: 0.9, position: 'left', distance: 1 }], estimatedDifficulty: 0.45, sourceId: 'embedded_academic' },
    { content: 'methodology', frequency: 0.8, domainRelevance: 0.93, domain: 'academic', pos: 'noun', contexts: ['The methodology was rigorous.'], collocations: [{ word: 'research', strength: 0.85, position: 'left', distance: 1 }], estimatedDifficulty: 0.5, sourceId: 'embedded_academic' },
    { content: 'empirical', frequency: 0.7, domainRelevance: 0.9, domain: 'academic', pos: 'adjective', contexts: ['Empirical evidence supports this claim.'], collocations: [{ word: 'evidence', strength: 0.9, position: 'right', distance: 1 }], estimatedDifficulty: 0.55, sourceId: 'embedded_academic' },
    { content: 'paradigm', frequency: 0.6, domainRelevance: 0.88, domain: 'academic', pos: 'noun', contexts: ['A new paradigm emerged.'], collocations: [{ word: 'shift', strength: 0.85, position: 'right', distance: 1 }], estimatedDifficulty: 0.6, sourceId: 'embedded_academic' },
    { content: 'discourse', frequency: 0.65, domainRelevance: 0.85, domain: 'academic', pos: 'noun', contexts: ['Academic discourse requires precision.'], collocations: [{ word: 'analysis', strength: 0.8, position: 'right', distance: 1 }], estimatedDifficulty: 0.55, sourceId: 'embedded_academic' },
  ],
  legal: [
    { content: 'jurisdiction', frequency: 0.8, domainRelevance: 0.95, domain: 'legal', pos: 'noun', contexts: ['The court has jurisdiction.'], collocations: [{ word: 'under', strength: 0.8, position: 'left', distance: 1 }], estimatedDifficulty: 0.5, sourceId: 'embedded_legal' },
    { content: 'plaintiff', frequency: 0.75, domainRelevance: 0.92, domain: 'legal', pos: 'noun', contexts: ['The plaintiff filed a motion.'], collocations: [{ word: 'defendant', strength: 0.85, position: 'any', distance: 3 }], estimatedDifficulty: 0.45, sourceId: 'embedded_legal' },
    { content: 'liability', frequency: 0.85, domainRelevance: 0.9, domain: 'legal', pos: 'noun', contexts: ['The company denied liability.'], collocations: [{ word: 'limit', strength: 0.8, position: 'left', distance: 1 }], estimatedDifficulty: 0.4, sourceId: 'embedded_legal' },
    { content: 'stipulate', frequency: 0.6, domainRelevance: 0.88, domain: 'legal', pos: 'verb', contexts: ['The contract stipulates payment terms.'], collocations: [{ word: 'contract', strength: 0.85, position: 'left', distance: 2 }], estimatedDifficulty: 0.55, sourceId: 'embedded_legal' },
  ],
  general: [
    { content: 'significant', frequency: 0.95, domainRelevance: 0.6, domain: 'general', pos: 'adjective', contexts: ['A significant improvement was noted.'], collocations: [{ word: 'difference', strength: 0.8, position: 'right', distance: 1 }], estimatedDifficulty: 0.3, sourceId: 'embedded_general' },
    { content: 'establish', frequency: 0.9, domainRelevance: 0.5, domain: 'general', pos: 'verb', contexts: ['We need to establish guidelines.'], collocations: [{ word: 'relationship', strength: 0.75, position: 'right', distance: 1 }], estimatedDifficulty: 0.35, sourceId: 'embedded_general' },
    { content: 'fundamental', frequency: 0.85, domainRelevance: 0.55, domain: 'general', pos: 'adjective', contexts: ['This is a fundamental concept.'], collocations: [{ word: 'principle', strength: 0.85, position: 'right', distance: 1 }], estimatedDifficulty: 0.4, sourceId: 'embedded_general' },
  ],
};

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Simple in-memory cache for corpus results.
 */
class CorpusCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Generates a hash for a query.
   */
  private hashQuery(query: CorpusQuery): string {
    return JSON.stringify({
      domain: query.domain,
      genre: query.genre,
      minFrequency: query.minFrequency,
      maxDifficulty: query.maxDifficulty,
      targetCount: query.targetCount,
      language: query.language,
      posFilter: query.posFilter,
      keywords: query.keywords,
    });
  }

  /**
   * Gets a cached result if available and not expired.
   */
  get(query: CorpusQuery): CorpusResult | null {
    const hash = this.hashQuery(query);
    const entry = this.cache.get(hash);

    if (!entry) return null;

    if (new Date() > entry.expiresAt) {
      this.cache.delete(hash);
      return null;
    }

    return {
      ...entry.result,
      metadata: {
        ...entry.result.metadata,
        fromCache: true,
        cacheExpiry: entry.expiresAt,
      },
    };
  }

  /**
   * Stores a result in the cache.
   */
  set(query: CorpusQuery, result: CorpusResult, ttlMs: number = DEFAULT_CACHE_TTL_MS): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const hash = this.hashQuery(query);
    const now = new Date();

    this.cache.set(hash, {
      result,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      queryHash: hash,
    });
  }

  /**
   * Clears all cached results.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics.
   */
  getStats(): { size: number; oldestEntry: Date | null } {
    let oldestEntry: Date | null = null;

    this.cache.forEach((entry) => {
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
    });

    return { size: this.cache.size, oldestEntry };
  }
}

// Global cache instance
const corpusCache = new CorpusCache();

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Queries corpus sources for vocabulary matching criteria.
 *
 * @param query - Query parameters
 * @param preferredSources - Optional list of preferred source IDs
 * @returns Corpus results from available sources
 */
export async function queryCorpus(
  query: CorpusQuery,
  preferredSources?: string[]
): Promise<CorpusResult[]> {
  // Check cache first
  const cachedResult = corpusCache.get(query);
  if (cachedResult) {
    return [cachedResult];
  }

  const startTime = Date.now();
  const results: CorpusResult[] = [];

  // Get available sources for this domain
  const availableSources = getAvailableSources(query.domain, preferredSources);

  for (const source of availableSources) {
    try {
      const result = await querySource(source, query);
      if (result.items.length > 0) {
        results.push(result);

        // Cache successful results
        corpusCache.set(query, result);

        // If we have enough items, stop querying
        const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
        if (totalItems >= query.targetCount) {
          break;
        }
      }
    } catch (error) {
      console.warn(`Failed to query source ${source.id}:`, error);
      // Continue to next source
    }
  }

  // If no external results, fall back to embedded data
  if (results.length === 0) {
    const embeddedResult = queryEmbeddedCorpus(query, startTime);
    if (embeddedResult.items.length > 0) {
      results.push(embeddedResult);
      corpusCache.set(query, embeddedResult);
    }
  }

  return results;
}

/**
 * Gets available sources for a domain.
 */
function getAvailableSources(domain: string, preferredSources?: string[]): CorpusSource[] {
  let sources = CORPUS_SOURCES.filter(
    (s) => s.isAvailable && s.domains.some((d) => d === domain || d === 'general')
  );

  // Sort by priority and preference
  sources.sort((a, b) => {
    const aPreferred = preferredSources?.includes(a.id) ? 1 : 0;
    const bPreferred = preferredSources?.includes(b.id) ? 1 : 0;

    if (aPreferred !== bPreferred) {
      return bPreferred - aPreferred;
    }

    return b.priority - a.priority;
  });

  return sources;
}

/**
 * Queries a single corpus source.
 */
async function querySource(source: CorpusSource, query: CorpusQuery): Promise<CorpusResult> {
  const startTime = Date.now();

  switch (source.type) {
    case 'api':
      return queryAPISource(source, query, startTime);

    case 'embedded':
      return queryEmbeddedCorpus(query, startTime, source);

    case 'file':
      // File-based sources would load from disk
      return queryEmbeddedCorpus(query, startTime, source);

    default:
      return queryEmbeddedCorpus(query, startTime, source);
  }
}

/**
 * Queries an API-based corpus source.
 *
 * This is a placeholder for actual API integration.
 * In production, this would make HTTP requests to external corpus APIs.
 */
async function queryAPISource(
  source: CorpusSource,
  query: CorpusQuery,
  startTime: number
): Promise<CorpusResult> {
  // Placeholder: In production, this would make actual API calls
  // For now, simulate with embedded data with a slight delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Fall back to embedded data for demo
  return queryEmbeddedCorpus(query, startTime, source);
}

/**
 * Queries embedded vocabulary data.
 */
function queryEmbeddedCorpus(
  query: CorpusQuery,
  startTime: number,
  source?: CorpusSource
): CorpusResult {
  // Get vocabulary for the domain
  let vocabulary = EMBEDDED_VOCABULARY[query.domain] || EMBEDDED_VOCABULARY['general'] || [];

  // Apply filters
  let filtered = vocabulary.filter((item) => {
    // Frequency filter
    if (query.minFrequency !== undefined && item.frequency < query.minFrequency) {
      return false;
    }

    // Difficulty filter
    if (query.maxDifficulty !== undefined && item.estimatedDifficulty > query.maxDifficulty) {
      return false;
    }

    // POS filter
    if (query.posFilter && query.posFilter.length > 0 && item.pos) {
      if (!query.posFilter.includes(item.pos)) {
        return false;
      }
    }

    // Exclusion filter
    if (query.excludeIds && query.excludeIds.includes(item.content)) {
      return false;
    }

    // Keyword filter
    if (query.keywords && query.keywords.length > 0) {
      const matchesKeyword = query.keywords.some(
        (kw) =>
          item.content.toLowerCase().includes(kw.toLowerCase()) ||
          item.contexts.some((ctx) => ctx.toLowerCase().includes(kw.toLowerCase()))
      );
      if (!matchesKeyword) {
        return false;
      }
    }

    return true;
  });

  // Sort by relevance (domain relevance × frequency)
  filtered.sort((a, b) => b.domainRelevance * b.frequency - a.domainRelevance * a.frequency);

  // Limit to target count
  filtered = filtered.slice(0, query.targetCount);

  const usedSource = source || {
    id: `embedded_${query.domain}`,
    name: `LOGOS ${query.domain} Vocabulary`,
    type: 'embedded' as const,
    domains: [query.domain],
    languages: ['en'],
    isAvailable: true,
    requiresAuth: false,
    priority: 5,
  };

  return {
    source: usedSource,
    items: filtered,
    metadata: {
      queryTime: Date.now() - startTime,
      totalAvailable: vocabulary.length,
      domainCoverage: filtered.length > 0 ? filtered.length / query.targetCount : 0,
      fromCache: false,
    },
  };
}

/**
 * Extracts domain-specific vocabulary for a learning goal.
 *
 * @param domain - Target domain
 * @param targetCount - Number of items to extract
 * @param userLevel - User's current level (theta)
 * @param options - Additional options
 * @returns Extracted vocabulary items
 */
export async function extractDomainVocabulary(
  domain: string,
  targetCount: number,
  userLevel: number,
  options?: {
    excludeKnown?: string[];
    preferredGenre?: string;
    focusOnCollocations?: boolean;
  }
): Promise<ExtractedItem[]> {
  // Convert user level to difficulty range
  // Lower theta = easier items needed
  const maxDifficulty = Math.min(1, 0.3 + userLevel * 0.2);

  const query: CorpusQuery = {
    domain,
    genre: options?.preferredGenre,
    maxDifficulty,
    targetCount: targetCount * 2, // Get more to allow for filtering
    language: 'en',
    excludeIds: options?.excludeKnown,
  };

  const results = await queryCorpus(query);

  // Merge results from all sources
  let allItems: ExtractedItem[] = [];
  results.forEach((result) => {
    allItems = allItems.concat(result.items);
  });

  // Deduplicate by content
  const seen = new Set<string>();
  allItems = allItems.filter((item) => {
    if (seen.has(item.content)) return false;
    seen.add(item.content);
    return true;
  });

  // Sort by learning value (domain relevance × appropriate difficulty)
  allItems.sort((a, b) => {
    const aDifficultyMatch = 1 - Math.abs(a.estimatedDifficulty - maxDifficulty / 2);
    const bDifficultyMatch = 1 - Math.abs(b.estimatedDifficulty - maxDifficulty / 2);

    const aScore = a.domainRelevance * aDifficultyMatch;
    const bScore = b.domainRelevance * bDifficultyMatch;

    return bScore - aScore;
  });

  // If focusing on collocations, boost items with strong collocations
  if (options?.focusOnCollocations) {
    allItems.sort((a, b) => {
      const aCollocStrength =
        a.collocations.length > 0
          ? a.collocations.reduce((sum, c) => sum + c.strength, 0) / a.collocations.length
          : 0;
      const bCollocStrength =
        b.collocations.length > 0
          ? b.collocations.reduce((sum, c) => sum + c.strength, 0) / b.collocations.length
          : 0;

      return bCollocStrength - aCollocStrength;
    });
  }

  return allItems.slice(0, targetCount);
}

/**
 * Gets domain vocabulary statistics.
 *
 * @param domain - Target domain
 * @returns Vocabulary statistics
 */
export async function getDomainVocabularyStats(domain: string): Promise<DomainVocabularyStats> {
  const vocabulary = EMBEDDED_VOCABULARY[domain] || EMBEDDED_VOCABULARY['general'] || [];

  const highFreq = vocabulary.filter((v) => v.frequency >= 0.7).length;
  const medFreq = vocabulary.filter((v) => v.frequency >= 0.4 && v.frequency < 0.7).length;
  const lowFreq = vocabulary.filter((v) => v.frequency < 0.4).length;

  const avgLength =
    vocabulary.length > 0
      ? vocabulary.reduce((sum, v) => sum + v.content.length, 0) / vocabulary.length
      : 0;

  const technicalRatio =
    vocabulary.length > 0
      ? vocabulary.filter((v) => v.domainRelevance > 0.8).length / vocabulary.length
      : 0;

  return {
    domain,
    totalVocabulary: vocabulary.length,
    highFrequencyCount: highFreq,
    mediumFrequencyCount: medFreq,
    lowFrequencyCount: lowFreq,
    avgWordLength: avgLength,
    technicalTermRatio: technicalRatio,
    updatedAt: new Date(),
  };
}

/**
 * Checks if a corpus source is available.
 *
 * @param sourceId - Source ID to check
 * @returns Availability status
 */
export function isSourceAvailable(sourceId: string): boolean {
  const source = CORPUS_SOURCES.find((s) => s.id === sourceId);
  return source?.isAvailable ?? false;
}

/**
 * Gets all available sources for a domain.
 *
 * @param domain - Target domain
 * @returns Available corpus sources
 */
export function getSourcesForDomain(domain: string): CorpusSource[] {
  return CORPUS_SOURCES.filter(
    (s) => s.isAvailable && s.domains.some((d) => d === domain || d === 'general')
  );
}

/**
 * Clears the corpus cache.
 */
export function clearCorpusCache(): void {
  corpusCache.clear();
}

/**
 * Gets corpus cache statistics.
 */
export function getCorpusCacheStats(): { size: number; oldestEntry: Date | null } {
  return corpusCache.getStats();
}

/**
 * Estimates the vocabulary coverage for a user goal.
 *
 * @param domain - Target domain
 * @param userVocabularySize - User's current vocabulary size
 * @returns Coverage estimate
 */
export async function estimateVocabularyCoverage(
  domain: string,
  userVocabularySize: number
): Promise<{
  coveragePercent: number;
  recommendedAdditions: number;
  gapAnalysis: {
    highFrequencyGap: number;
    mediumFrequencyGap: number;
    lowFrequencyGap: number;
  };
}> {
  const stats = await getDomainVocabularyStats(domain);

  const coveragePercent =
    stats.totalVocabulary > 0 ? Math.min(100, (userVocabularySize / stats.totalVocabulary) * 100) : 0;

  // Recommend enough to reach 80% coverage of high-frequency vocabulary
  const targetHighFreq = Math.ceil(stats.highFrequencyCount * 0.8);
  const estimatedUserHighFreq = Math.floor(userVocabularySize * 0.6); // Assume 60% are high-freq
  const recommendedAdditions = Math.max(0, targetHighFreq - estimatedUserHighFreq);

  return {
    coveragePercent,
    recommendedAdditions,
    gapAnalysis: {
      highFrequencyGap: Math.max(0, stats.highFrequencyCount - estimatedUserHighFreq),
      mediumFrequencyGap: Math.max(0, stats.mediumFrequencyCount - Math.floor(userVocabularySize * 0.3)),
      lowFrequencyGap: Math.max(0, stats.lowFrequencyCount - Math.floor(userVocabularySize * 0.1)),
    },
  };
}

/**
 * Converts corpus item to language object format.
 *
 * @param item - Extracted corpus item
 * @returns Language object compatible format
 */
export function corpusItemToLanguageObject(item: ExtractedItem): {
  type: string;
  content: string;
  frequency: number;
  relationalDensity: number;
  contextualContribution: number;
  domainDistribution: Record<string, number>;
  priority: number;
  irtDifficulty: number;
} {
  // Calculate relational density from collocations
  const relationalDensity =
    item.collocations.length > 0
      ? Math.min(1, item.collocations.reduce((sum, c) => sum + c.strength, 0) / 5)
      : 0.3;

  // Domain distribution (simplified)
  const domainDistribution: Record<string, number> = {
    [item.domain]: item.domainRelevance,
    general: 1 - item.domainRelevance,
  };

  // Convert difficulty to IRT scale (-3 to +3)
  const irtDifficulty = (item.estimatedDifficulty - 0.5) * 6;

  // Calculate priority
  const priority = item.frequency * 0.4 + item.domainRelevance * 0.4 + (1 - item.estimatedDifficulty) * 0.2;

  return {
    type: 'LEX',
    content: item.content,
    frequency: item.frequency,
    relationalDensity,
    contextualContribution: item.domainRelevance,
    domainDistribution,
    priority,
    irtDifficulty,
  };
}
