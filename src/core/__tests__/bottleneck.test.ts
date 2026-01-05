/**
 * Bottleneck Module Unit Tests
 *
 * Tests for error pattern analysis, cascade detection,
 * and learning bottleneck identification.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeBottleneck,
  analyzeErrorPatterns,
  findCooccurringErrors,
  analyzeCascadingErrors,
  calculateImprovementTrend,
  isComponentType,
  getCascadePosition,
  canCauseErrors,
  getDownstreamComponents,
  getUpstreamComponents,
  summarizeBottleneck,
  DEFAULT_BOTTLENECK_CONFIG,
  CASCADE_ORDER,
} from '../bottleneck';
import type { ResponseData, ComponentType, BottleneckEvidence } from '../bottleneck';

const createResponses = (
  count: number,
  componentType: ComponentType,
  correctRatio: number,
  sessionId: string = 'session1'
): ResponseData[] => {
  const responses: ResponseData[] = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    responses.push({
      id: `${sessionId}-${componentType}-${i}`,
      correct: Math.random() < correctRatio,
      componentType,
      sessionId,
      content: `test-${componentType}-${i}`,
      timestamp: new Date(baseTime + i * 60000),
    });
  }

  return responses;
};

describe('Bottleneck Analysis', () => {
  describe('analyzeBottleneck', () => {
    it('returns null bottleneck for insufficient data', () => {
      const responses = createResponses(10, 'LEX', 0.5); // Less than minResponses (20)
      const result = analyzeBottleneck(responses);

      expect(result.primaryBottleneck).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.recommendation).toContain('Need more data');
    });

    it('identifies component with highest error rate', () => {
      const responses = [
        ...createResponses(15, 'LEX', 0.9), // 10% errors
        ...createResponses(15, 'MORPH', 0.3), // 70% errors - should be bottleneck
        ...createResponses(15, 'SYNT', 0.8), // 20% errors
      ];

      const result = analyzeBottleneck(responses);

      expect(result.primaryBottleneck).toBe('MORPH');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects cascading errors', () => {
      // Errors in PHON should cascade to downstream components
      const responses = [
        ...createResponses(15, 'PHON', 0.4), // 60% errors
        ...createResponses(15, 'MORPH', 0.5), // 50% errors
        ...createResponses(15, 'LEX', 0.6), // 40% errors
        ...createResponses(15, 'SYNT', 0.7), // 30% errors
      ];

      const result = analyzeBottleneck(responses);

      // Should identify PHON as root cause
      expect(result.primaryBottleneck).toBe('PHON');
    });

    it('provides recommendation based on bottleneck', () => {
      const responses = createResponses(30, 'SYNT', 0.3); // 70% errors

      const result = analyzeBottleneck(responses);

      expect(result.recommendation).toContain('Syntax');
      expect(result.recommendation.length).toBeGreaterThan(0);
    });

    it('includes evidence for all analyzed components', () => {
      const responses = [
        ...createResponses(10, 'LEX', 0.5),
        ...createResponses(10, 'MORPH', 0.6),
        ...createResponses(10, 'SYNT', 0.7),
      ];

      const result = analyzeBottleneck(responses);

      expect(result.evidence.length).toBeGreaterThan(0);
      for (const ev of result.evidence) {
        expect(ev.componentType).toBeDefined();
        expect(ev.errorRate).toBeGreaterThanOrEqual(0);
        expect(ev.errorRate).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('Error Pattern Analysis', () => {
  describe('analyzeErrorPatterns', () => {
    it('returns empty for no errors', () => {
      const patterns = analyzeErrorPatterns([]);
      expect(patterns).toEqual([]);
    });

    it('identifies morphological patterns', () => {
      const errors: ResponseData[] = [
        { id: '1', correct: false, componentType: 'MORPH', sessionId: 's1', content: 'running', timestamp: new Date() },
        { id: '2', correct: false, componentType: 'MORPH', sessionId: 's1', content: 'jumping', timestamp: new Date() },
        { id: '3', correct: false, componentType: 'MORPH', sessionId: 's1', content: 'walking', timestamp: new Date() },
      ];

      const patterns = analyzeErrorPatterns(errors);

      // Should identify -ing ending pattern
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.includes('ing'))).toBe(true);
    });

    it('identifies phonological patterns', () => {
      const errors: ResponseData[] = [
        { id: '1', correct: false, componentType: 'PHON', sessionId: 's1', content: 'three', timestamp: new Date() },
        { id: '2', correct: false, componentType: 'PHON', sessionId: 's1', content: 'through', timestamp: new Date() },
        { id: '3', correct: false, componentType: 'PHON', sessionId: 's1', content: 'throw', timestamp: new Date() },
      ];

      const patterns = analyzeErrorPatterns(errors);

      expect(patterns.some(p => p.includes('th'))).toBe(true);
    });

    it('filters patterns occurring fewer than 2 times', () => {
      const errors: ResponseData[] = [
        { id: '1', correct: false, componentType: 'LEX', sessionId: 's1', content: 'unique', timestamp: new Date() },
      ];

      const patterns = analyzeErrorPatterns(errors);
      expect(patterns).toEqual([]);
    });
  });

  describe('findCooccurringErrors', () => {
    it('finds components with co-occurring errors', () => {
      const responses: ResponseData[] = [
        { id: '1', correct: false, componentType: 'LEX', sessionId: 's1', content: 'a', timestamp: new Date() },
        { id: '2', correct: false, componentType: 'MORPH', sessionId: 's1', content: 'b', timestamp: new Date() },
        { id: '3', correct: true, componentType: 'SYNT', sessionId: 's1', content: 'c', timestamp: new Date() },
        { id: '4', correct: false, componentType: 'LEX', sessionId: 's2', content: 'd', timestamp: new Date() },
        { id: '5', correct: false, componentType: 'MORPH', sessionId: 's2', content: 'e', timestamp: new Date() },
      ];

      const cooccurring = findCooccurringErrors('LEX', responses);

      expect(cooccurring).toContain('MORPH');
      expect(cooccurring).not.toContain('SYNT'); // SYNT was correct
    });

    it('returns empty for no co-occurrences', () => {
      const responses: ResponseData[] = [
        { id: '1', correct: false, componentType: 'LEX', sessionId: 's1', content: 'a', timestamp: new Date() },
        { id: '2', correct: false, componentType: 'MORPH', sessionId: 's2', content: 'b', timestamp: new Date() },
      ];

      const cooccurring = findCooccurringErrors('LEX', responses);
      expect(cooccurring).toEqual([]);
    });
  });
});

describe('Cascade Analysis', () => {
  describe('analyzeCascadingErrors', () => {
    it('detects cascade from foundational to advanced', () => {
      const evidence: BottleneckEvidence[] = [
        { componentType: 'PHON', errorRate: 0.5, errorPatterns: [], cooccurringErrors: ['MORPH', 'LEX'], improvement: 0 },
        { componentType: 'MORPH', errorRate: 0.4, errorPatterns: [], cooccurringErrors: ['LEX'], improvement: 0 },
        { componentType: 'LEX', errorRate: 0.35, errorPatterns: [], cooccurringErrors: [], improvement: 0 },
      ];

      const cascade = analyzeCascadingErrors(evidence);

      expect(cascade.rootCause).toBe('PHON');
      expect(cascade.cascadeChain.length).toBeGreaterThan(1);
    });

    it('returns null cascade when no pattern found', () => {
      const evidence: BottleneckEvidence[] = [
        { componentType: 'SYNT', errorRate: 0.5, errorPatterns: [], cooccurringErrors: [], improvement: 0 },
        // No downstream components with errors
      ];

      const cascade = analyzeCascadingErrors(evidence);

      expect(cascade.rootCause).toBeNull();
      expect(cascade.cascadeChain).toEqual([]);
    });

    it('respects error rate threshold', () => {
      const evidence: BottleneckEvidence[] = [
        { componentType: 'PHON', errorRate: 0.1, errorPatterns: [], cooccurringErrors: [], improvement: 0 }, // Below threshold
        { componentType: 'MORPH', errorRate: 0.5, errorPatterns: [], cooccurringErrors: [], improvement: 0 },
      ];

      const cascade = analyzeCascadingErrors(evidence);

      // Should not identify PHON as root cause (error rate too low)
      expect(cascade.rootCause).not.toBe('PHON');
    });
  });

  describe('calculateImprovementTrend', () => {
    it('returns positive value when improving', () => {
      const baseTime = Date.now();
      const responses: ResponseData[] = [
        // First half: more errors
        ...Array(5).fill(null).map((_, i) => ({
          id: `early-${i}`,
          correct: i % 3 === 0, // ~33% correct
          componentType: 'LEX' as ComponentType,
          sessionId: 's1',
          content: 'test',
          timestamp: new Date(baseTime + i * 1000),
        })),
        // Second half: fewer errors
        ...Array(5).fill(null).map((_, i) => ({
          id: `late-${i}`,
          correct: i % 3 !== 0, // ~67% correct
          componentType: 'LEX' as ComponentType,
          sessionId: 's1',
          content: 'test',
          timestamp: new Date(baseTime + (5 + i) * 1000),
        })),
      ];

      const improvement = calculateImprovementTrend('LEX', responses);
      expect(improvement).toBeGreaterThan(0);
    });

    it('returns negative value when declining', () => {
      const baseTime = Date.now();
      const responses: ResponseData[] = [
        // First half: fewer errors
        ...Array(5).fill(null).map((_, i) => ({
          id: `early-${i}`,
          correct: true,
          componentType: 'LEX' as ComponentType,
          sessionId: 's1',
          content: 'test',
          timestamp: new Date(baseTime + i * 1000),
        })),
        // Second half: more errors
        ...Array(5).fill(null).map((_, i) => ({
          id: `late-${i}`,
          correct: false,
          componentType: 'LEX' as ComponentType,
          sessionId: 's1',
          content: 'test',
          timestamp: new Date(baseTime + (5 + i) * 1000),
        })),
      ];

      const improvement = calculateImprovementTrend('LEX', responses);
      expect(improvement).toBeLessThan(0);
    });

    it('returns 0 for insufficient data', () => {
      const responses: ResponseData[] = [
        { id: '1', correct: true, componentType: 'LEX', sessionId: 's1', content: 'a', timestamp: new Date() },
      ];

      const improvement = calculateImprovementTrend('LEX', responses);
      expect(improvement).toBe(0);
    });
  });
});

describe('Utility Functions', () => {
  describe('isComponentType', () => {
    it('returns true for valid component types', () => {
      expect(isComponentType('PHON')).toBe(true);
      expect(isComponentType('MORPH')).toBe(true);
      expect(isComponentType('LEX')).toBe(true);
      expect(isComponentType('SYNT')).toBe(true);
      expect(isComponentType('PRAG')).toBe(true);
    });

    it('returns false for invalid types', () => {
      expect(isComponentType('INVALID')).toBe(false);
      expect(isComponentType('phon')).toBe(false);
      expect(isComponentType('')).toBe(false);
    });
  });

  describe('getCascadePosition', () => {
    it('returns correct positions in cascade order', () => {
      expect(getCascadePosition('PHON')).toBe(0);
      expect(getCascadePosition('MORPH')).toBe(1);
      expect(getCascadePosition('LEX')).toBe(2);
      expect(getCascadePosition('SYNT')).toBe(3);
      expect(getCascadePosition('PRAG')).toBe(4);
    });
  });

  describe('canCauseErrors', () => {
    it('returns true when upstream can affect downstream', () => {
      expect(canCauseErrors('PHON', 'MORPH')).toBe(true);
      expect(canCauseErrors('PHON', 'PRAG')).toBe(true);
      expect(canCauseErrors('LEX', 'SYNT')).toBe(true);
    });

    it('returns false when downstream cannot affect upstream', () => {
      expect(canCauseErrors('PRAG', 'PHON')).toBe(false);
      expect(canCauseErrors('SYNT', 'LEX')).toBe(false);
    });

    it('returns false for same component', () => {
      expect(canCauseErrors('LEX', 'LEX')).toBe(false);
    });
  });

  describe('getDownstreamComponents', () => {
    it('returns all components after given type', () => {
      expect(getDownstreamComponents('PHON')).toEqual(['MORPH', 'LEX', 'SYNT', 'PRAG']);
      expect(getDownstreamComponents('LEX')).toEqual(['SYNT', 'PRAG']);
      expect(getDownstreamComponents('PRAG')).toEqual([]);
    });
  });

  describe('getUpstreamComponents', () => {
    it('returns all components before given type', () => {
      expect(getUpstreamComponents('PRAG')).toEqual(['PHON', 'MORPH', 'LEX', 'SYNT']);
      expect(getUpstreamComponents('LEX')).toEqual(['PHON', 'MORPH']);
      expect(getUpstreamComponents('PHON')).toEqual([]);
    });
  });

  describe('summarizeBottleneck', () => {
    it('returns message for no bottleneck', () => {
      const analysis = {
        primaryBottleneck: null,
        confidence: 0,
        evidence: [],
        recommendation: '',
      };

      expect(summarizeBottleneck(analysis)).toBe('No bottleneck detected');
    });

    it('includes component and error rate', () => {
      const analysis = {
        primaryBottleneck: 'MORPH' as ComponentType,
        confidence: 0.7,
        evidence: [{
          componentType: 'MORPH' as ComponentType,
          errorRate: 0.45,
          errorPatterns: [],
          cooccurringErrors: [],
          improvement: 0,
        }],
        recommendation: 'Focus on morphology',
      };

      const summary = summarizeBottleneck(analysis);
      expect(summary).toContain('word forms'); // MORPH short name
      expect(summary).toContain('45%');
    });
  });
});

describe('Constants', () => {
  describe('CASCADE_ORDER', () => {
    it('defines correct order from foundational to advanced', () => {
      expect(CASCADE_ORDER).toEqual(['PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG']);
    });
  });

  describe('DEFAULT_BOTTLENECK_CONFIG', () => {
    it('has reasonable default values', () => {
      expect(DEFAULT_BOTTLENECK_CONFIG.minResponses).toBeGreaterThan(0);
      expect(DEFAULT_BOTTLENECK_CONFIG.errorRateThreshold).toBeGreaterThan(0);
      expect(DEFAULT_BOTTLENECK_CONFIG.errorRateThreshold).toBeLessThan(1);
    });
  });
});
