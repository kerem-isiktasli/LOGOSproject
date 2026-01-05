/**
 * Morphology Module Unit Tests
 *
 * Tests for morphological analysis including word segmentation,
 * affix extraction, family building, and transfer effects.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeMorphology,
  segmentWord,
  buildMorphologicalFamily,
  computeMorphologicalScore,
  buildWordIndexes,
  buildMultiLayerWordCard,
  findTransferCandidates,
  measureTransferEffect,
  toMorphologicalVector,
  getAffixesForDomain,
  hasAffix,
  extractLemma,
  getMorphologicalComplexity,
  ENGLISH_PREFIXES,
  ENGLISH_SUFFIXES,
} from '../morphology';
import type { DerivationType, InflectionType } from '../morphology';

describe('Morphological Analysis', () => {
  describe('analyzeMorphology', () => {
    it('identifies simple words correctly', () => {
      const analysis = analyzeMorphology('cat');

      expect(analysis.root).toBe('cat');
      expect(analysis.prefixes).toHaveLength(0);
      expect(analysis.suffixes).toHaveLength(0);
      expect(analysis.derivationType).toBe('simple');
    });

    it('identifies prefixes', () => {
      const analysis = analyzeMorphology('unhappy');

      expect(analysis.prefixes.length).toBeGreaterThan(0);
      expect(analysis.prefixes[0].form).toBe('un-');
      expect(analysis.root).toBe('happy');
    });

    it('identifies suffixes', () => {
      const analysis = analyzeMorphology('happiness');

      expect(analysis.suffixes.length).toBeGreaterThan(0);
      expect(analysis.suffixes.some(s => s.form === '-ness')).toBe(true);
    });

    it('identifies complex derivations', () => {
      const analysis = analyzeMorphology('unhappiness');

      expect(analysis.prefixes.length).toBeGreaterThan(0);
      expect(analysis.suffixes.length).toBeGreaterThan(0);
      expect(analysis.derivationType).toBe('complex');
    });

    it('counts morphemes correctly', () => {
      const simple = analyzeMorphology('cat');
      const complex = analyzeMorphology('unhappiness');

      expect(simple.morphemeCount).toBe(1);
      expect(complex.morphemeCount).toBeGreaterThan(2);
    });

    it('calculates difficulty score', () => {
      const simple = analyzeMorphology('run');
      const complex = analyzeMorphology('internationalization');

      expect(simple.difficultyScore).toBeLessThan(complex.difficultyScore);
      expect(simple.difficultyScore).toBeLessThanOrEqual(1);
      expect(complex.difficultyScore).toBeLessThanOrEqual(1);
    });

    it('respects domain context', () => {
      const medical = analyzeMorphology('cardiovascular', 'medical');

      // Should identify cardio- prefix for medical domain
      expect(medical.prefixes.some(p => p.form.includes('cardio'))).toBe(true);
    });

    it('detects inflection types', () => {
      expect(analyzeMorphology('walked').inflection).toBe('past');
      expect(analyzeMorphology('walking').inflection).toBe('progressive');
      expect(analyzeMorphology('cats').inflection).toBe('plural');
      expect(analyzeMorphology('cat').inflection).toBe('base');
    });
  });
});

describe('Word Segmentation', () => {
  describe('segmentWord', () => {
    it('segments into morpheme units', () => {
      const seg = segmentWord('unhappiness');

      expect(seg.morphemeSegments.length).toBeGreaterThan(1);
      expect(seg.morphemeCount).toBeGreaterThan(1);
    });

    it('segments into syllable units', () => {
      const seg = segmentWord('information');

      expect(seg.syllableSegments.length).toBeGreaterThan(1);
      expect(seg.syllableCount).toBe(4);
    });

    it('identifies morpheme types', () => {
      const seg = segmentWord('unhappiness');

      const types = seg.morphemeSegments.map(m => m.type);
      expect(types).toContain('prefix');
      expect(types).toContain('root');
      expect(types).toContain('suffix');
    });

    it('records positions correctly', () => {
      const seg = segmentWord('test');

      for (const unit of seg.morphemeSegments) {
        expect(unit.position).toBeGreaterThanOrEqual(0);
      }
    });

    it('includes meaning for affixes', () => {
      const seg = segmentWord('unhappy');

      const prefix = seg.morphemeSegments.find(m => m.type === 'prefix');
      expect(prefix?.meaning).toBeDefined();
      expect(prefix?.meaning).toContain('not');
    });
  });
});

describe('Morphological Family', () => {
  describe('buildMorphologicalFamily', () => {
    it('finds derivatives for common roots', () => {
      const family = buildMorphologicalFamily('act');

      expect(family.derivatives.length).toBeGreaterThan(0);
      expect(family.derivatives).toContain('action');
      expect(family.derivatives).toContain('active');
    });

    it('calculates family size', () => {
      const family = buildMorphologicalFamily('form');

      expect(family.familySize).toBeGreaterThan(0);
    });

    it('tracks affixes used', () => {
      const family = buildMorphologicalFamily('act');

      expect(family.affixesUsed.length).toBeGreaterThan(0);
    });

    it('calculates productivity', () => {
      const family = buildMorphologicalFamily('form');

      expect(family.productivity).toBeGreaterThan(0);
      expect(family.productivity).toBeLessThanOrEqual(1);
    });

    it('uses provided known words', () => {
      const knownWords = ['testing', 'tested', 'tester', 'testable'];
      const family = buildMorphologicalFamily('test', knownWords);

      expect(family.derivatives.length).toBeGreaterThan(0);
    });
  });
});

describe('Morphological Score', () => {
  describe('computeMorphologicalScore', () => {
    it('returns higher score for derived words', () => {
      const simpleScore = computeMorphologicalScore('cat');
      const derivedScore = computeMorphologicalScore('unhappiness');

      expect(derivedScore).toBeGreaterThan(simpleScore);
    });

    it('returns value in 0-1 range', () => {
      const words = ['cat', 'unhappiness', 'internationalization'];

      for (const word of words) {
        const score = computeMorphologicalScore(word);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('considers domain context', () => {
      const medicalScore = computeMorphologicalScore('cardiovascular', 'medical');
      const generalScore = computeMorphologicalScore('cardiovascular');

      // Medical domain should boost score for medical terms
      expect(medicalScore).toBeGreaterThanOrEqual(generalScore);
    });
  });
});

describe('Word Indexes', () => {
  describe('buildWordIndexes', () => {
    it('indexes by root', () => {
      const words = ['unhappy', 'happiness', 'happily'];
      const indexes = buildWordIndexes(words);

      // All should share 'happy' root (approximately)
      expect(indexes.byRoot.size).toBeGreaterThan(0);
    });

    it('indexes by prefix', () => {
      const words = ['unhappy', 'unlikely', 'undo'];
      const indexes = buildWordIndexes(words);

      const unWords = indexes.byPrefix.get('un');
      expect(unWords?.length).toBeGreaterThanOrEqual(2);
    });

    it('indexes by suffix', () => {
      const words = ['happiness', 'sadness', 'kindness'];
      const indexes = buildWordIndexes(words);

      const nessWords = indexes.bySuffix.get('ness');
      expect(nessWords?.length).toBe(3);
    });

    it('indexes by morpheme count', () => {
      const words = ['cat', 'unhappy', 'unhappiness'];
      const indexes = buildWordIndexes(words);

      expect(indexes.byFamilySize.size).toBeGreaterThan(0);
    });
  });
});

describe('Multi-Layer Word Card', () => {
  describe('buildMultiLayerWordCard', () => {
    it('includes orthographic layer', () => {
      const card = buildMultiLayerWordCard('unhappiness');

      expect(card.orthographic.written).toBe('unhappiness');
      expect(card.orthographic.graphemes.length).toBeGreaterThan(0);
      expect(card.orthographic.highlightedMorphemes.length).toBeGreaterThan(0);
    });

    it('includes morphological layer', () => {
      const card = buildMultiLayerWordCard('unhappiness');

      expect(card.morphological.root).toBeDefined();
      expect(card.morphological.affixes.length).toBeGreaterThan(0);
      expect(card.morphological.familySize).toBeGreaterThan(0);
    });

    it('includes semantic layer', () => {
      const card = buildMultiLayerWordCard('test', 'medical');

      expect(card.semantic.domainTags).toContain('medical');
    });
  });
});

describe('Transfer Effects', () => {
  describe('findTransferCandidates', () => {
    it('finds words with shared affixes', () => {
      const trained = ['unhappy', 'unlikely'];
      const candidates = ['unaware', 'happy', 'careful'];

      const results = findTransferCandidates(trained, candidates);

      // 'unaware' shares 'un-' prefix
      expect(results.some(r => r.word === 'unaware')).toBe(true);
    });

    it('calculates transfer potential', () => {
      const trained = ['happiness', 'sadness'];
      const candidates = ['kindness', 'beauty'];

      const results = findTransferCandidates(trained, candidates);

      for (const result of results) {
        expect(result.transferPotential).toBeGreaterThan(0);
        expect(result.transferPotential).toBeLessThanOrEqual(1);
      }
    });

    it('sorts by transfer potential', () => {
      const trained = ['unhappy', 'happiness'];
      const candidates = ['unhappiness', 'unaware', 'cat'];

      const results = findTransferCandidates(trained, candidates);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].transferPotential).toBeGreaterThanOrEqual(results[i + 1].transferPotential);
      }
    });
  });

  describe('measureTransferEffect', () => {
    it('calculates transfer gain', () => {
      const trainedAffixes = ['un-', '-ness'];
      const testResults = [
        { word: 'unaware', correctBefore: false, correctAfter: true },
        { word: 'kindness', correctBefore: false, correctAfter: true },
        { word: 'unlikely', correctBefore: true, correctAfter: true },
      ];

      const transfer = measureTransferEffect(trainedAffixes, testResults);

      expect(transfer.transferGain).toBeGreaterThan(0);
      expect(transfer.accuracyAfter).toBeGreaterThan(transfer.accuracyBefore);
    });

    it('includes trained affixes', () => {
      const trainedAffixes = ['re-', '-tion'];
      const testResults = [
        { word: 'reaction', correctBefore: false, correctAfter: true },
      ];

      const transfer = measureTransferEffect(trainedAffixes, testResults);

      expect(transfer.trainedAffixes).toEqual(trainedAffixes);
    });
  });
});

describe('Morphological Vector', () => {
  describe('toMorphologicalVector', () => {
    it('extracts root', () => {
      const vector = toMorphologicalVector('unhappiness');

      expect(vector.root).toBeDefined();
      expect(vector.root.length).toBeGreaterThan(0);
    });

    it('lists prefixes and suffixes', () => {
      const vector = toMorphologicalVector('unhappiness');

      expect(vector.prefixes.length).toBeGreaterThan(0);
      expect(vector.suffixes.length).toBeGreaterThan(0);
    });

    it('includes morpheme count', () => {
      const vector = toMorphologicalVector('cat');

      expect(vector.morphemeCount).toBe(1);
    });

    it('calculates transparency', () => {
      const simpleVector = toMorphologicalVector('cat');
      const complexVector = toMorphologicalVector('unhappiness');

      expect(simpleVector.transparency).toBe(1); // Simple words fully transparent
      expect(complexVector.transparency).toBeLessThan(1);
    });

    it('builds inflection paradigm', () => {
      const vector = toMorphologicalVector('walked');

      expect(vector.inflectionParadigm).toContain('inflection:');
    });
  });
});

describe('Utility Functions', () => {
  describe('getAffixesForDomain', () => {
    it('returns medical affixes for medical domain', () => {
      const affixes = getAffixesForDomain('medical');

      expect(affixes.prefixes.length).toBeGreaterThan(0);
      expect(affixes.suffixes.length).toBeGreaterThan(0);

      // Should include medical-specific like -itis
      expect(affixes.suffixes.some(s => s.form === '-itis')).toBe(true);
    });

    it('includes general affixes for all domains', () => {
      const affixes = getAffixesForDomain('business');

      expect(affixes.prefixes.length).toBeGreaterThan(0);
      expect(affixes.suffixes.length).toBeGreaterThan(0);
    });
  });

  describe('hasAffix', () => {
    it('detects prefixes', () => {
      expect(hasAffix('unhappy', 'un', 'prefix')).toBe(true);
      expect(hasAffix('happy', 'un', 'prefix')).toBe(false);
    });

    it('detects suffixes', () => {
      expect(hasAffix('happiness', 'ness', 'suffix')).toBe(true);
      expect(hasAffix('happy', 'ness', 'suffix')).toBe(false);
    });

    it('normalizes affix forms', () => {
      expect(hasAffix('unhappy', 'un-', 'prefix')).toBe(true);
      expect(hasAffix('happiness', '-ness', 'suffix')).toBe(true);
    });
  });

  describe('extractLemma', () => {
    it('extracts base form from plural', () => {
      expect(extractLemma('cats')).toBe('cat');
      expect(extractLemma('boxes')).toBe('box');
    });

    it('extracts base form from past tense', () => {
      const walkedLemma = extractLemma('walked'); expect(walkedLemma.length).toBeLessThan(6);
      expect(extractLemma('stopped')).toBe('stop');
    });

    it('handles irregular forms', () => {
      expect(extractLemma('went')).toBe('go');
      expect(extractLemma('children')).toBe('child');
    });

    it('extracts base form from -ing', () => {
      expect(extractLemma('running')).toBe('run');
      const makingLemma = extractLemma('making'); expect(makingLemma.length).toBeLessThan(6);
    });

    it('extracts base form from -ies', () => {
      expect(extractLemma('cities')).toBe('city');
    });
  });

  describe('getMorphologicalComplexity', () => {
    it('returns simple for single morpheme words', () => {
      expect(getMorphologicalComplexity('cat')).toBe('simple');
      expect(getMorphologicalComplexity('run')).toBe('simple');
    });

    it('returns moderate for derived words', () => {
      expect(getMorphologicalComplexity('unhappy')).toBe('moderate');
      expect(getMorphologicalComplexity('happiness')).toBe('moderate');
    });

    it('returns complex for multi-affix words', () => {
      expect(getMorphologicalComplexity('unhappiness')).toBe('complex');
    });
  });
});

describe('Constants', () => {
  describe('ENGLISH_PREFIXES', () => {
    it('contains common prefixes', () => {
      expect(ENGLISH_PREFIXES['un']).toBeDefined();
      expect(ENGLISH_PREFIXES['re']).toBeDefined();
      expect(ENGLISH_PREFIXES['pre']).toBeDefined();
    });

    it('prefixes have required properties', () => {
      for (const [key, affix] of Object.entries(ENGLISH_PREFIXES)) {
        expect(affix.form).toBeDefined();
        expect(affix.type).toBe('prefix');
        expect(affix.meaning).toBeDefined();
        expect(affix.productivity).toBeGreaterThan(0);
        expect(affix.productivity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('ENGLISH_SUFFIXES', () => {
    it('contains common suffixes', () => {
      expect(ENGLISH_SUFFIXES['ness']).toBeDefined();
      expect(ENGLISH_SUFFIXES['tion']).toBeDefined();
      expect(ENGLISH_SUFFIXES['able']).toBeDefined();
    });

    it('suffixes have required properties', () => {
      for (const [key, affix] of Object.entries(ENGLISH_SUFFIXES)) {
        expect(affix.form).toBeDefined();
        expect(affix.type).toBe('suffix');
        expect(affix.meaning).toBeDefined();
        expect(affix.productivity).toBeGreaterThan(0);
      }
    });
  });
});
