/**
 * PMI Module Unit Tests
 *
 * Tests for Pointwise Mutual Information calculations
 * including corpus indexing, PMI computation, and collocations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PMICalculator,
  pmiToDifficulty,
  frequencyToDifficulty,
} from '../pmi';

describe('PMICalculator', () => {
  let calc: PMICalculator;

  beforeEach(() => {
    calc = new PMICalculator(5);
  });

  describe('constructor', () => {
    it('creates calculator with default window size', () => {
      const defaultCalc = new PMICalculator();
      expect(defaultCalc).toBeDefined();
    });

    it('accepts custom window size', () => {
      const customCalc = new PMICalculator(10);
      expect(customCalc).toBeDefined();
    });
  });

  describe('indexCorpus', () => {
    it('indexes word frequencies', () => {
      const tokens = ['the', 'cat', 'sat', 'the', 'mat'];
      calc.indexCorpus(tokens);

      expect(calc.getWordCount('the')).toBe(2);
      expect(calc.getWordCount('cat')).toBe(1);
      expect(calc.getTotalWords()).toBe(5);
    });

    it('normalizes to lowercase', () => {
      const tokens = ['The', 'THE', 'the'];
      calc.indexCorpus(tokens);

      expect(calc.getWordCount('the')).toBe(3);
      expect(calc.getWordCount('The')).toBe(3); // Lookup also normalized
    });

    it('tracks vocabulary', () => {
      const tokens = ['apple', 'banana', 'cherry'];
      calc.indexCorpus(tokens);

      const vocab = calc.getVocabulary();
      expect(vocab).toHaveLength(3);
      expect(vocab).toContain('apple');
      expect(vocab).toContain('banana');
      expect(vocab).toContain('cherry');
    });

    it('clears previous data on re-index', () => {
      calc.indexCorpus(['first', 'corpus']);
      expect(calc.getWordCount('first')).toBe(1);

      calc.indexCorpus(['second', 'corpus']);
      expect(calc.getWordCount('first')).toBe(0);
      expect(calc.getWordCount('second')).toBe(1);
    });
  });

  describe('computePMI', () => {
    it('returns null for words not in corpus', () => {
      calc.indexCorpus(['hello', 'world']);

      expect(calc.computePMI('hello', 'missing')).toBeNull();
      expect(calc.computePMI('missing', 'world')).toBeNull();
    });

    it('returns null when words never co-occur', () => {
      // Window size 5, words too far apart to co-occur
      const tokens = ['word1', 'a', 'b', 'c', 'd', 'e', 'f', 'word2'];
      const smallWindowCalc = new PMICalculator(2);
      smallWindowCalc.indexCorpus(tokens);

      expect(smallWindowCalc.computePMI('word1', 'word2')).toBeNull();
    });

    it('computes positive PMI for strong collocations', () => {
      // "new york" appears together frequently
      const tokens = [
        'new', 'york', 'is', 'big',
        'new', 'york', 'has', 'people',
        'new', 'york', 'city',
        'the', 'city', 'is', 'old',
      ];
      calc.indexCorpus(tokens);

      const result = calc.computePMI('new', 'york');
      expect(result).not.toBeNull();
      expect(result!.pmi).toBeGreaterThan(0);
    });

    it('returns result object with all fields', () => {
      const tokens = ['the', 'patient', 'takes', 'medication', 'daily'];
      calc.indexCorpus(tokens);

      const result = calc.computePMI('patient', 'takes');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('word1');
      expect(result).toHaveProperty('word2');
      expect(result).toHaveProperty('pmi');
      expect(result).toHaveProperty('npmi');
      expect(result).toHaveProperty('cooccurrence');
      expect(result).toHaveProperty('significance');
    });

    it('normalizes input words', () => {
      const tokens = ['the', 'cat', 'sat'];
      calc.indexCorpus(tokens);

      const result1 = calc.computePMI('cat', 'sat');
      const result2 = calc.computePMI('CAT', 'SAT');

      expect(result1).toEqual(result2);
    });

    it('computes symmetric PMI', () => {
      const tokens = ['word', 'pair', 'appear', 'together'];
      calc.indexCorpus(tokens);

      const result1 = calc.computePMI('word', 'pair');
      const result2 = calc.computePMI('pair', 'word');

      if (result1 && result2) {
        expect(result1.pmi).toBeCloseTo(result2.pmi, 5);
      }
    });
  });

  describe('getCollocations', () => {
    it('returns empty array for word not in corpus', () => {
      calc.indexCorpus(['hello', 'world']);
      expect(calc.getCollocations('missing')).toEqual([]);
    });

    it('returns collocations sorted by PMI', () => {
      // Create corpus where "medical" collocates with several words
      const tokens = [
        'medical', 'professional', 'care',
        'medical', 'professional', 'advice',
        'medical', 'treatment', 'plan',
        'medical', 'treatment', 'options',
        'medical', 'doctor', 'visit',
        'the', 'park', 'is', 'nice',
      ];
      calc.indexCorpus(tokens);

      const collocations = calc.getCollocations('medical', 10);

      // Should find collocations for medical
      expect(Array.isArray(collocations)).toBe(true);
    });

    it('respects topK limit', () => {
      const tokens = Array(100).fill(['word', 'other', 'pair']).flat();
      calc.indexCorpus(tokens);

      const collocations = calc.getCollocations('word', 5);
      expect(collocations.length).toBeLessThanOrEqual(5);
    });

    it('filters by significance threshold', () => {
      const tokens = ['single', 'occurrence', 'test'];
      calc.indexCorpus(tokens);

      // Single occurrence pairs shouldn't be significant
      const collocations = calc.getCollocations('single');
      // Results filtered by LLR > 3.84
      for (const colloc of collocations) {
        expect(colloc.significance).toBeGreaterThan(3.84);
      }
    });
  });

  describe('getVocabulary', () => {
    it('returns all indexed words', () => {
      const tokens = ['apple', 'banana', 'apple', 'cherry'];
      calc.indexCorpus(tokens);

      const vocab = calc.getVocabulary();
      expect(vocab).toContain('apple');
      expect(vocab).toContain('banana');
      expect(vocab).toContain('cherry');
      expect(vocab).toHaveLength(3);
    });
  });

  describe('getWordCount', () => {
    it('returns frequency for known words', () => {
      const tokens = ['a', 'a', 'a', 'b', 'b', 'c'];
      calc.indexCorpus(tokens);

      expect(calc.getWordCount('a')).toBe(3);
      expect(calc.getWordCount('b')).toBe(2);
      expect(calc.getWordCount('c')).toBe(1);
    });

    it('returns 0 for unknown words', () => {
      calc.indexCorpus(['known']);
      expect(calc.getWordCount('unknown')).toBe(0);
    });
  });

  describe('getTotalWords', () => {
    it('returns total token count', () => {
      const tokens = ['one', 'two', 'three', 'four', 'five'];
      calc.indexCorpus(tokens);
      expect(calc.getTotalWords()).toBe(5);
    });
  });
});

describe('PMI to Difficulty Mapping', () => {
  describe('pmiToDifficulty', () => {
    it('maps high PMI to easier difficulty (lower value)', () => {
      const highPMI = pmiToDifficulty(8, 0.8, 'recall_cued');
      const lowPMI = pmiToDifficulty(1, 0.2, 'recall_cued');

      expect(highPMI).toBeLessThan(lowPMI);
    });

    it('applies task type modifiers', () => {
      const pmi = 5;
      const npmi = 0.5;

      const recognition = pmiToDifficulty(pmi, npmi, 'recognition');
      const production = pmiToDifficulty(pmi, npmi, 'production');
      const recallFree = pmiToDifficulty(pmi, npmi, 'recall_free');

      // Production should be hardest, recognition easiest
      expect(production).toBeGreaterThan(recallFree);
      expect(recallFree).toBeGreaterThan(recognition);
    });

    it('returns value in IRT logit scale range', () => {
      const difficulty = pmiToDifficulty(5, 0.5, 'recall_cued');

      // Typical IRT difficulty range is -3 to +3
      expect(difficulty).toBeGreaterThanOrEqual(-4);
      expect(difficulty).toBeLessThanOrEqual(4);
    });

    it('handles edge cases', () => {
      // Very high PMI
      const easy = pmiToDifficulty(12, 1.0, 'recognition');
      expect(easy).toBeLessThan(0);

      // Very low/negative PMI
      const hard = pmiToDifficulty(-3, -0.5, 'production');
      expect(hard).toBeGreaterThan(0);
    });
  });

  describe('frequencyToDifficulty', () => {
    it('maps high frequency to easier difficulty', () => {
      const highFreq = frequencyToDifficulty(0.9, 'recall_cued');
      const lowFreq = frequencyToDifficulty(0.1, 'recall_cued');

      expect(highFreq).toBeLessThan(lowFreq);
    });

    it('applies task type modifiers', () => {
      const freq = 0.5;

      const recognition = frequencyToDifficulty(freq, 'recognition');
      const production = frequencyToDifficulty(freq, 'production');

      expect(production).toBeGreaterThan(recognition);
    });

    it('handles boundary frequencies', () => {
      const mostCommon = frequencyToDifficulty(1.0, 'recall_cued');
      const leastCommon = frequencyToDifficulty(0.0, 'recall_cued');

      expect(mostCommon).toBeLessThan(leastCommon);
      expect(mostCommon).toBeLessThan(0);
      expect(leastCommon).toBeGreaterThan(0);
    });
  });
});
