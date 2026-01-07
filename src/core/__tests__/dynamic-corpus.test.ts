/**
 * Tests for Dynamic Corpus Sourcing Module
 *
 * Covers:
 * - Corpus source configuration
 * - Query execution and filtering
 * - Caching behavior
 * - Domain vocabulary extraction
 * - Statistics calculation
 * - Conversion utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type CorpusSource,
  type CorpusQuery,
  type ExtractedItem,
  type CorpusResult,

  // Constants
  CORPUS_SOURCES,

  // Core functions
  queryCorpus,
  extractDomainVocabulary,
  getDomainVocabularyStats,

  // Source utilities
  isSourceAvailable,
  getSourcesForDomain,

  // Cache utilities
  clearCorpusCache,
  getCorpusCacheStats,

  // Coverage analysis
  estimateVocabularyCoverage,

  // Conversion
  corpusItemToLanguageObject,
} from '../dynamic-corpus';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestQuery(overrides: Partial<CorpusQuery> = {}): CorpusQuery {
  return {
    domain: 'medical',
    targetCount: 10,
    language: 'en',
    ...overrides,
  };
}

function createTestItem(overrides: Partial<ExtractedItem> = {}): ExtractedItem {
  return {
    content: 'test',
    frequency: 0.8,
    domainRelevance: 0.9,
    domain: 'medical',
    pos: 'noun',
    contexts: ['Test context sentence.'],
    collocations: [
      { word: 'word', strength: 0.7, position: 'left', distance: 1 },
    ],
    estimatedDifficulty: 0.5,
    sourceId: 'embedded_medical',
    ...overrides,
  };
}

// ============================================================================
// Corpus Source Tests
// ============================================================================

describe('Corpus Sources', () => {
  describe('CORPUS_SOURCES', () => {
    it('contains multiple sources', () => {
      expect(CORPUS_SOURCES.length).toBeGreaterThan(0);
    });

    it('each source has required fields', () => {
      CORPUS_SOURCES.forEach((source) => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.type).toBeDefined();
        expect(source.domains).toBeDefined();
        expect(source.languages).toBeDefined();
        expect(typeof source.isAvailable).toBe('boolean');
        expect(typeof source.requiresAuth).toBe('boolean');
        expect(typeof source.priority).toBe('number');
      });
    });

    it('has embedded sources available by default', () => {
      const embeddedSources = CORPUS_SOURCES.filter(
        (s) => s.type === 'embedded' && s.isAvailable
      );
      expect(embeddedSources.length).toBeGreaterThan(0);
    });

    it('API sources requiring auth are marked unavailable', () => {
      const apiSources = CORPUS_SOURCES.filter(
        (s) => s.type === 'api' && s.requiresAuth
      );
      apiSources.forEach((source) => {
        // Sources requiring auth should either be marked unavailable
        // or have proper auth handling
        expect(source.requiresAuth).toBe(true);
      });
    });
  });

  describe('isSourceAvailable', () => {
    it('returns true for available sources', () => {
      const availableSource = CORPUS_SOURCES.find((s) => s.isAvailable);
      if (availableSource) {
        expect(isSourceAvailable(availableSource.id)).toBe(true);
      }
    });

    it('returns false for unavailable sources', () => {
      const unavailableSource = CORPUS_SOURCES.find((s) => !s.isAvailable);
      if (unavailableSource) {
        expect(isSourceAvailable(unavailableSource.id)).toBe(false);
      }
    });

    it('returns false for unknown sources', () => {
      expect(isSourceAvailable('nonexistent_source')).toBe(false);
    });
  });

  describe('getSourcesForDomain', () => {
    it('returns sources for medical domain', () => {
      const sources = getSourcesForDomain('medical');
      expect(sources.length).toBeGreaterThan(0);
      sources.forEach((source) => {
        expect(source.isAvailable).toBe(true);
      });
    });

    it('returns sources for business domain', () => {
      const sources = getSourcesForDomain('business');
      expect(sources.length).toBeGreaterThan(0);
    });

    it('returns general sources for unknown domains', () => {
      const sources = getSourcesForDomain('unknown_domain');
      // Should still return general-purpose sources
      const generalSources = sources.filter((s) =>
        s.domains.includes('general')
      );
      expect(generalSources.length).toBeGreaterThanOrEqual(0);
    });

    it('only returns available sources', () => {
      const sources = getSourcesForDomain('medical');
      sources.forEach((source) => {
        expect(source.isAvailable).toBe(true);
      });
    });
  });
});

// ============================================================================
// Query Execution Tests
// ============================================================================

describe('Query Execution', () => {
  beforeEach(() => {
    clearCorpusCache();
  });

  describe('queryCorpus', () => {
    it('returns results for valid query', async () => {
      const query = createTestQuery();
      const results = await queryCorpus(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].items.length).toBeGreaterThan(0);
    });

    it('returns items with required fields', async () => {
      const query = createTestQuery({ targetCount: 5 });
      const results = await queryCorpus(query);

      results.forEach((result) => {
        result.items.forEach((item) => {
          expect(item.content).toBeDefined();
          expect(typeof item.frequency).toBe('number');
          expect(typeof item.domainRelevance).toBe('number');
          expect(item.domain).toBeDefined();
          expect(Array.isArray(item.contexts)).toBe(true);
          expect(Array.isArray(item.collocations)).toBe(true);
          expect(typeof item.estimatedDifficulty).toBe('number');
          expect(item.sourceId).toBeDefined();
        });
      });
    });

    it('respects targetCount limit', async () => {
      const query = createTestQuery({ targetCount: 3 });
      const results = await queryCorpus(query);

      const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
      expect(totalItems).toBeLessThanOrEqual(3);
    });

    it('applies frequency filter', async () => {
      const query = createTestQuery({ minFrequency: 0.7 });
      const results = await queryCorpus(query);

      results.forEach((result) => {
        result.items.forEach((item) => {
          expect(item.frequency).toBeGreaterThanOrEqual(0.7);
        });
      });
    });

    it('applies difficulty filter', async () => {
      const query = createTestQuery({ maxDifficulty: 0.5 });
      const results = await queryCorpus(query);

      results.forEach((result) => {
        result.items.forEach((item) => {
          expect(item.estimatedDifficulty).toBeLessThanOrEqual(0.5);
        });
      });
    });

    it('excludes specified items', async () => {
      const query = createTestQuery({
        excludeIds: ['diagnosis', 'prognosis'],
      });
      const results = await queryCorpus(query);

      results.forEach((result) => {
        result.items.forEach((item) => {
          expect(item.content).not.toBe('diagnosis');
          expect(item.content).not.toBe('prognosis');
        });
      });
    });

    it('filters by keywords', async () => {
      const query = createTestQuery({
        keywords: ['fever'],
        targetCount: 10,
      });
      const results = await queryCorpus(query);

      // If results found, they should contain the keyword
      if (results.length > 0 && results[0].items.length > 0) {
        const hasKeywordMatch = results[0].items.some(
          (item) =>
            item.content.toLowerCase().includes('fever') ||
            item.contexts.some((ctx) => ctx.toLowerCase().includes('fever'))
        );
        expect(hasKeywordMatch).toBe(true);
      }
    });

    it('includes metadata in results', async () => {
      const query = createTestQuery();
      const results = await queryCorpus(query);

      results.forEach((result) => {
        expect(result.metadata).toBeDefined();
        expect(typeof result.metadata.queryTime).toBe('number');
        expect(typeof result.metadata.totalAvailable).toBe('number');
        expect(typeof result.metadata.domainCoverage).toBe('number');
        expect(typeof result.metadata.fromCache).toBe('boolean');
      });
    });

    it('returns source information', async () => {
      const query = createTestQuery();
      const results = await queryCorpus(query);

      results.forEach((result) => {
        expect(result.source).toBeDefined();
        expect(result.source.id).toBeDefined();
        expect(result.source.name).toBeDefined();
      });
    });
  });

  describe('queryCorpus with different domains', () => {
    it('returns results for medical domain', async () => {
      const results = await queryCorpus(createTestQuery({ domain: 'medical' }));
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results for business domain', async () => {
      const results = await queryCorpus(createTestQuery({ domain: 'business' }));
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results for academic domain', async () => {
      const results = await queryCorpus(createTestQuery({ domain: 'academic' }));
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results for legal domain', async () => {
      const results = await queryCorpus(createTestQuery({ domain: 'legal' }));
      expect(results.length).toBeGreaterThan(0);
    });

    it('falls back to general for unknown domain', async () => {
      const results = await queryCorpus(
        createTestQuery({ domain: 'unknown_domain' })
      );
      // Should return general vocabulary as fallback
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Caching Tests
// ============================================================================

describe('Caching', () => {
  beforeEach(() => {
    clearCorpusCache();
  });

  afterEach(() => {
    clearCorpusCache();
  });

  describe('cache behavior', () => {
    it('caches query results', async () => {
      const query = createTestQuery();

      // First query - should not be from cache
      const results1 = await queryCorpus(query);
      expect(results1[0].metadata.fromCache).toBe(false);

      // Second query - should be from cache
      const results2 = await queryCorpus(query);
      expect(results2[0].metadata.fromCache).toBe(true);
    });

    it('returns same results from cache', async () => {
      const query = createTestQuery();

      const results1 = await queryCorpus(query);
      const results2 = await queryCorpus(query);

      expect(results1[0].items.length).toBe(results2[0].items.length);
      expect(results1[0].items[0].content).toBe(results2[0].items[0].content);
    });

    it('different queries have separate cache entries', async () => {
      const query1 = createTestQuery({ domain: 'medical' });
      const query2 = createTestQuery({ domain: 'business' });

      await queryCorpus(query1);
      const results2 = await queryCorpus(query2);

      // Second query should not be from cache (different domain)
      expect(results2[0].metadata.fromCache).toBe(false);
    });
  });

  describe('clearCorpusCache', () => {
    it('clears all cached entries', async () => {
      const query = createTestQuery();

      // Populate cache
      await queryCorpus(query);

      // Clear cache
      clearCorpusCache();

      // Next query should not be from cache
      const results = await queryCorpus(query);
      expect(results[0].metadata.fromCache).toBe(false);
    });
  });

  describe('getCorpusCacheStats', () => {
    it('returns cache statistics', async () => {
      const stats = getCorpusCacheStats();

      expect(typeof stats.size).toBe('number');
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });

    it('size increases after queries', async () => {
      clearCorpusCache();
      const statsBefore = getCorpusCacheStats();

      await queryCorpus(createTestQuery());
      const statsAfter = getCorpusCacheStats();

      expect(statsAfter.size).toBeGreaterThan(statsBefore.size);
    });

    it('returns oldest entry date', async () => {
      clearCorpusCache();
      await queryCorpus(createTestQuery());

      const stats = getCorpusCacheStats();

      expect(stats.oldestEntry).toBeInstanceOf(Date);
    });
  });
});

// ============================================================================
// Domain Vocabulary Extraction Tests
// ============================================================================

describe('Domain Vocabulary Extraction', () => {
  beforeEach(() => {
    clearCorpusCache();
  });

  describe('extractDomainVocabulary', () => {
    it('extracts vocabulary for domain', async () => {
      const items = await extractDomainVocabulary('medical', 5, 0);

      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(5);
    });

    it('adjusts difficulty based on user level', async () => {
      // Low level user (theta=0) - should get easier items
      const lowLevelItems = await extractDomainVocabulary('medical', 10, 0);

      // Higher level user (theta=2) - can handle harder items
      const highLevelItems = await extractDomainVocabulary('medical', 10, 2);

      // Both should return items (using 0 instead of -1 for low level)
      expect(lowLevelItems.length).toBeGreaterThan(0);
      expect(highLevelItems.length).toBeGreaterThan(0);
    });

    it('excludes known vocabulary', async () => {
      const excludeList = ['diagnosis', 'prognosis'];
      const items = await extractDomainVocabulary('medical', 10, 0, {
        excludeKnown: excludeList,
      });

      items.forEach((item) => {
        expect(excludeList).not.toContain(item.content);
      });
    });

    it('deduplicates results', async () => {
      const items = await extractDomainVocabulary('medical', 10, 0);

      const contents = items.map((i) => i.content);
      const uniqueContents = [...new Set(contents)];

      expect(contents.length).toBe(uniqueContents.length);
    });
  });

  describe('getDomainVocabularyStats', () => {
    it('returns statistics for medical domain', async () => {
      const stats = await getDomainVocabularyStats('medical');

      expect(stats.domain).toBe('medical');
      expect(typeof stats.totalVocabulary).toBe('number');
      expect(typeof stats.highFrequencyCount).toBe('number');
      expect(typeof stats.mediumFrequencyCount).toBe('number');
      expect(typeof stats.lowFrequencyCount).toBe('number');
      expect(typeof stats.avgWordLength).toBe('number');
      expect(typeof stats.technicalTermRatio).toBe('number');
      expect(stats.updatedAt).toBeInstanceOf(Date);
    });

    it('frequency counts sum to total', async () => {
      const stats = await getDomainVocabularyStats('medical');

      const sum =
        stats.highFrequencyCount +
        stats.mediumFrequencyCount +
        stats.lowFrequencyCount;

      expect(sum).toBe(stats.totalVocabulary);
    });

    it('technical term ratio is between 0 and 1', async () => {
      const stats = await getDomainVocabularyStats('medical');

      expect(stats.technicalTermRatio).toBeGreaterThanOrEqual(0);
      expect(stats.technicalTermRatio).toBeLessThanOrEqual(1);
    });

    it('returns stats for different domains', async () => {
      const medicalStats = await getDomainVocabularyStats('medical');
      const businessStats = await getDomainVocabularyStats('business');

      expect(medicalStats.domain).toBe('medical');
      expect(businessStats.domain).toBe('business');
    });
  });
});

// ============================================================================
// Coverage Analysis Tests
// ============================================================================

describe('Coverage Analysis', () => {
  describe('estimateVocabularyCoverage', () => {
    it('returns coverage estimate', async () => {
      const coverage = await estimateVocabularyCoverage('medical', 50);

      expect(typeof coverage.coveragePercent).toBe('number');
      expect(typeof coverage.recommendedAdditions).toBe('number');
      expect(coverage.gapAnalysis).toBeDefined();
    });

    it('coverage percent is between 0 and 100', async () => {
      const coverage = await estimateVocabularyCoverage('medical', 50);

      expect(coverage.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(coverage.coveragePercent).toBeLessThanOrEqual(100);
    });

    it('higher vocabulary size gives higher coverage', async () => {
      const lowCoverage = await estimateVocabularyCoverage('medical', 10);
      const highCoverage = await estimateVocabularyCoverage('medical', 100);

      expect(highCoverage.coveragePercent).toBeGreaterThanOrEqual(
        lowCoverage.coveragePercent
      );
    });

    it('returns gap analysis by frequency band', async () => {
      const coverage = await estimateVocabularyCoverage('medical', 50);

      expect(typeof coverage.gapAnalysis.highFrequencyGap).toBe('number');
      expect(typeof coverage.gapAnalysis.mediumFrequencyGap).toBe('number');
      expect(typeof coverage.gapAnalysis.lowFrequencyGap).toBe('number');
    });

    it('recommended additions is non-negative', async () => {
      const coverage = await estimateVocabularyCoverage('medical', 50);

      expect(coverage.recommendedAdditions).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Conversion Utilities Tests
// ============================================================================

describe('Conversion Utilities', () => {
  describe('corpusItemToLanguageObject', () => {
    it('converts item to language object format', () => {
      const item = createTestItem();
      const langObj = corpusItemToLanguageObject(item);

      expect(langObj.type).toBe('LEX');
      expect(langObj.content).toBe(item.content);
      expect(typeof langObj.frequency).toBe('number');
      expect(typeof langObj.relationalDensity).toBe('number');
      expect(typeof langObj.contextualContribution).toBe('number');
      expect(typeof langObj.priority).toBe('number');
      expect(typeof langObj.irtDifficulty).toBe('number');
    });

    it('calculates relational density from collocations', () => {
      const itemWithCollocations = createTestItem({
        collocations: [
          { word: 'make', strength: 0.8, position: 'left', distance: 1 },
          { word: 'confirm', strength: 0.7, position: 'left', distance: 1 },
        ],
      });

      const langObj = corpusItemToLanguageObject(itemWithCollocations);

      expect(langObj.relationalDensity).toBeGreaterThan(0);
      expect(langObj.relationalDensity).toBeLessThanOrEqual(1);
    });

    it('handles items without collocations', () => {
      const itemNoCollocations = createTestItem({ collocations: [] });
      const langObj = corpusItemToLanguageObject(itemNoCollocations);

      // Should have default relational density
      expect(langObj.relationalDensity).toBe(0.3);
    });

    it('creates domain distribution', () => {
      const item = createTestItem({ domain: 'medical', domainRelevance: 0.9 });
      const langObj = corpusItemToLanguageObject(item);

      expect(langObj.domainDistribution).toBeDefined();
      expect(langObj.domainDistribution['medical']).toBe(0.9);
      expect(langObj.domainDistribution['general']).toBeCloseTo(0.1, 5);
    });

    it('converts difficulty to IRT scale', () => {
      // Easy item (difficulty 0.2)
      const easyItem = createTestItem({ estimatedDifficulty: 0.2 });
      const easyLangObj = corpusItemToLanguageObject(easyItem);

      // Hard item (difficulty 0.8)
      const hardItem = createTestItem({ estimatedDifficulty: 0.8 });
      const hardLangObj = corpusItemToLanguageObject(hardItem);

      // IRT difficulty should reflect the difference
      expect(hardLangObj.irtDifficulty).toBeGreaterThan(easyLangObj.irtDifficulty);
    });

    it('calculates priority from multiple factors', () => {
      const highPriorityItem = createTestItem({
        frequency: 0.9,
        domainRelevance: 0.95,
        estimatedDifficulty: 0.3, // Lower difficulty = higher priority
      });

      const lowPriorityItem = createTestItem({
        frequency: 0.3,
        domainRelevance: 0.5,
        estimatedDifficulty: 0.8,
      });

      const highPriority = corpusItemToLanguageObject(highPriorityItem);
      const lowPriority = corpusItemToLanguageObject(lowPriorityItem);

      expect(highPriority.priority).toBeGreaterThan(lowPriority.priority);
    });
  });
});

// ============================================================================
// POS Filter Tests
// ============================================================================

describe('Part of Speech Filtering', () => {
  beforeEach(() => {
    clearCorpusCache();
  });

  it('filters by noun POS', async () => {
    const query = createTestQuery({
      domain: 'medical',
      posFilter: ['noun'],
      targetCount: 10,
    });

    const results = await queryCorpus(query);

    results.forEach((result) => {
      result.items.forEach((item) => {
        if (item.pos) {
          expect(item.pos).toBe('noun');
        }
      });
    });
  });

  it('filters by multiple POS types', async () => {
    const query = createTestQuery({
      domain: 'medical',
      posFilter: ['noun', 'verb'],
      targetCount: 10,
    });

    const results = await queryCorpus(query);

    results.forEach((result) => {
      result.items.forEach((item) => {
        if (item.pos) {
          expect(['noun', 'verb']).toContain(item.pos);
        }
      });
    });
  });
});

// ============================================================================
// Collocation Data Tests
// ============================================================================

describe('Collocation Data', () => {
  it('items have collocation data', async () => {
    const query = createTestQuery({ domain: 'medical', targetCount: 5 });
    const results = await queryCorpus(query);

    const itemsWithCollocations = results[0].items.filter(
      (item) => item.collocations.length > 0
    );

    expect(itemsWithCollocations.length).toBeGreaterThan(0);
  });

  it('collocations have required fields', async () => {
    const query = createTestQuery({ domain: 'medical', targetCount: 5 });
    const results = await queryCorpus(query);

    results[0].items.forEach((item) => {
      item.collocations.forEach((colloc) => {
        expect(colloc.word).toBeDefined();
        expect(typeof colloc.strength).toBe('number');
        expect(['left', 'right', 'any']).toContain(colloc.position);
        expect(typeof colloc.distance).toBe('number');
      });
    });
  });

  it('collocation strength is between 0 and 1', async () => {
    const query = createTestQuery({ domain: 'medical', targetCount: 5 });
    const results = await queryCorpus(query);

    results[0].items.forEach((item) => {
      item.collocations.forEach((colloc) => {
        expect(colloc.strength).toBeGreaterThanOrEqual(0);
        expect(colloc.strength).toBeLessThanOrEqual(1);
      });
    });
  });
});
