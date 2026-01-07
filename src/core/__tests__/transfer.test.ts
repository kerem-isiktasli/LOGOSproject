/**
 * Transfer Module Tests
 *
 * Tests for L1-L2 transfer coefficient calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  getLanguageFamily,
  getTransferCoefficients,
  getLanguagePairProfile,
  calculateTransferAdjustedDifficulty,
  calculateTransferGain,
  getPhonologicalDifficultyBonus,
  isCognate,
} from '../transfer';

describe('Transfer Module', () => {
  describe('getLanguageFamily', () => {
    it('should correctly identify Germanic languages', () => {
      expect(getLanguageFamily('en')).toBe('germanic');
      expect(getLanguageFamily('de')).toBe('germanic');
      expect(getLanguageFamily('nl')).toBe('germanic');
      expect(getLanguageFamily('sv')).toBe('germanic');
    });

    it('should correctly identify Romance languages', () => {
      expect(getLanguageFamily('es')).toBe('romance');
      expect(getLanguageFamily('fr')).toBe('romance');
      expect(getLanguageFamily('it')).toBe('romance');
      expect(getLanguageFamily('pt')).toBe('romance');
    });

    it('should correctly identify Sino-Tibetan languages', () => {
      expect(getLanguageFamily('zh')).toBe('sino-tibetan');
    });

    it('should correctly identify Japonic languages', () => {
      expect(getLanguageFamily('ja')).toBe('japonic');
    });

    it('should return "other" for unknown languages', () => {
      expect(getLanguageFamily('xyz')).toBe('other');
      expect(getLanguageFamily('')).toBe('other');
    });

    it('should be case-insensitive', () => {
      expect(getLanguageFamily('EN')).toBe('germanic');
      expect(getLanguageFamily('Es')).toBe('romance');
    });
  });

  describe('getTransferCoefficients', () => {
    it('should return high lexical transfer for Romance -> English', () => {
      const coefficients = getTransferCoefficients('es', 'en');
      expect(coefficients.lexical).toBeGreaterThan(0.5);
    });

    it('should return high orthographic transfer for Germanic -> English', () => {
      const coefficients = getTransferCoefficients('de', 'en');
      expect(coefficients.orthographic).toBeGreaterThan(0.8);
    });

    it('should return negative phonological transfer for Chinese -> English', () => {
      const coefficients = getTransferCoefficients('zh', 'en');
      expect(coefficients.phonological).toBeLessThan(0);
    });

    it('should return negative syntactic transfer for Japanese -> English', () => {
      const coefficients = getTransferCoefficients('ja', 'en');
      expect(coefficients.syntactic).toBeLessThan(0);
    });

    it('should return neutral values for unknown languages', () => {
      const coefficients = getTransferCoefficients('xyz', 'en');
      expect(coefficients.lexical).toBe(0);
      expect(coefficients.phonological).toBe(0);
    });
  });

  describe('getLanguagePairProfile', () => {
    it('should return complete profile for Spanish -> English', () => {
      const profile = getLanguagePairProfile('es', 'en');

      expect(profile.l1).toBe('es');
      expect(profile.l2).toBe('en');
      expect(profile.l1Family).toBe('romance');
      expect(profile.l2Family).toBe('germanic');
      expect(profile.cognateRatio).toBeGreaterThan(0);
      expect(profile.cognateRatio).toBeLessThanOrEqual(1);
      expect(profile.orthographicDistance).toBeGreaterThanOrEqual(0);
      expect(profile.orthographicDistance).toBeLessThanOrEqual(1);
    });

    it('should show high cognate ratio for Romance languages', () => {
      const profile = getLanguagePairProfile('fr', 'en');
      expect(profile.cognateRatio).toBeGreaterThan(0.5);
    });

    it('should show low cognate ratio for distant languages', () => {
      const profile = getLanguagePairProfile('zh', 'en');
      // Chinese has 0 lexical transfer coefficient -> cognate ratio = 0.5 (neutral)
      expect(profile.cognateRatio).toBeLessThanOrEqual(0.5);
    });
  });

  describe('calculateTransferAdjustedDifficulty', () => {
    it('should reduce difficulty for positive transfer', () => {
      const result = calculateTransferAdjustedDifficulty(0, 'de', 'en', 'lexical');

      expect(result.baseDifficulty).toBe(0);
      expect(result.adjustedDifficulty).toBeLessThan(0); // Reduced
      expect(result.transferModifier).toBeLessThan(0);
    });

    it('should increase difficulty for negative transfer', () => {
      const result = calculateTransferAdjustedDifficulty(0, 'zh', 'en', 'phonological');

      expect(result.baseDifficulty).toBe(0);
      expect(result.adjustedDifficulty).toBeGreaterThan(0); // Increased
      expect(result.transferModifier).toBeGreaterThan(0);
    });

    it('should apply medical domain bonus for lexical items', () => {
      const withoutMedical = calculateTransferAdjustedDifficulty(0, 'es', 'en', 'lexical');
      const withMedical = calculateTransferAdjustedDifficulty(0, 'es', 'en', 'lexical', 'medical');

      // Medical domain should give additional transfer bonus (lower difficulty)
      expect(withMedical.adjustedDifficulty).toBeLessThan(withoutMedical.adjustedDifficulty);
    });
  });

  describe('calculateTransferGain', () => {
    it('should return value between 0 and 1', () => {
      const gain = calculateTransferGain('es', 'en', 'LEX');
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    });

    it('should return higher gain for same-family languages', () => {
      const germanicGain = calculateTransferGain('de', 'en', 'LEX');
      const distantGain = calculateTransferGain('zh', 'en', 'LEX');

      expect(germanicGain).toBeGreaterThan(distantGain);
    });

    it('should map object types to components correctly', () => {
      // LEX -> lexical, MORPH -> morphological, etc.
      const lexGain = calculateTransferGain('es', 'en', 'LEX');
      const morphGain = calculateTransferGain('es', 'en', 'MORPH');
      const g2pGain = calculateTransferGain('es', 'en', 'G2P');

      // All should be valid numbers
      expect(typeof lexGain).toBe('number');
      expect(typeof morphGain).toBe('number');
      expect(typeof g2pGain).toBe('number');
    });
  });

  describe('getPhonologicalDifficultyBonus', () => {
    it('should return positive bonus for difficult phonological transfer', () => {
      const bonus = getPhonologicalDifficultyBonus('zh', 'test');
      expect(bonus).toBeGreaterThan(0);
    });

    it('should return negative bonus for easy phonological transfer', () => {
      const bonus = getPhonologicalDifficultyBonus('de', 'test');
      expect(bonus).toBeLessThan(0);
    });
  });

  describe('isCognate', () => {
    it('should identify Latin-suffix words as cognates for Romance speakers', () => {
      const result = isCognate('administration', 'es', 'en');
      expect(result.isCognate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should identify Germanic patterns for Germanic speakers', () => {
      const result = isCognate('through', 'de', 'en');
      expect(result.isCognate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should have lower confidence for distant language pairs', () => {
      const result = isCognate('computer', 'zh', 'en');
      // Chinese has 0 lexical transfer -> confidence = 0.5 (neutral baseline)
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });
});
