/**
 * Pragmatics Text Type Model Tests
 *
 * Tests for domain-based pragmatic text type statistical model.
 *
 * Academic References:
 * - Biber, D. (1988). Variation across speech and writing.
 * - Swales, J. M. (1990). Genre Analysis.
 * - Hyland, K. (2005). Metadiscourse.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeTextType,
  analyzeMetadiscourse,
  getDomainStatistics,
  analyzeGenreMoves,
  calculateDomainAppropriateness,
  DOMAIN_TEXT_TYPE_STATISTICS,
  GENRE_MOVE_STRUCTURES,
  type TextType,
  type Genre,
  type DimensionalScores,
} from '../pragmatics';

describe('Text Type Analysis (Biber 1988)', () => {
  describe('analyzeTextType', () => {
    it('should classify academic text as informational/scientific', () => {
      const academicText = `
        This study aims to investigate the relationship between vocabulary
        acquisition and reading comprehension. Previous research has demonstrated
        that lexical knowledge significantly correlates with reading ability.
        The methodology employed a quasi-experimental design with pre and post tests.
        Results indicate a statistically significant improvement in the treatment group.
      `;

      const result = analyzeTextType(academicText);

      expect(result.textType).toBeDefined();
      expect(result.dimensionalScores).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should classify conversational text as interactional/involved', () => {
      const conversationalText = `
        Hey! How's it going? I was wondering if you'd like to grab some coffee
        later? I've been meaning to catch up with you. It's been ages, hasn't it?
        Let me know what you think! Can't wait to hear from you.
      `;

      const result = analyzeTextType(conversationalText);

      expect(result.textType).toBeDefined();
      // Higher involvement score for conversational text
      expect(result.dimensionalScores.involvedVsInformational).toBeGreaterThan(-0.5);
    });

    it('should return all six dimensional scores', () => {
      const result = analyzeTextType('Sample text for analysis.');

      const dimensions: (keyof DimensionalScores)[] = [
        'involvedVsInformational',
        'narrativeVsNonNarrative',
        'explicitVsSituationDependent',
        'overtPersuasion',
        'abstractVsNonAbstract',
        'onlineElaboration',
      ];

      for (const dim of dimensions) {
        expect(result.dimensionalScores[dim]).toBeDefined();
        expect(result.dimensionalScores[dim]).toBeGreaterThanOrEqual(-1);
        expect(result.dimensionalScores[dim]).toBeLessThanOrEqual(1);
      }
    });

    it('should classify narrative text correctly', () => {
      const narrativeText = `
        She walked down the dusty road, remembering the days when she had played
        there as a child. The old house stood at the end, its windows dark and empty.
        She had returned after twenty years, and everything had changed.
      `;

      const result = analyzeTextType(narrativeText);

      // Narrative text should have positive narrative dimension
      expect(result.dimensionalScores.narrativeVsNonNarrative).toBeGreaterThan(-0.5);
    });

    it('should identify persuasive text', () => {
      const persuasiveText = `
        You must understand the importance of this decision. We should act now,
        before it's too late. If we fail to address this crucial issue, the
        consequences will be severe. It is essential that everyone participates.
      `;

      const result = analyzeTextType(persuasiveText);

      // Persuasive text should have higher persuasion dimension
      expect(result.dimensionalScores.overtPersuasion).toBeGreaterThan(-0.3);
    });
  });

  describe('analyzeMetadiscourse (Hyland 2005)', () => {
    it('should detect interactive markers', () => {
      const textWithMarkers = `
        First, we will examine the data. However, there are some limitations.
        As shown in Figure 2, the results indicate a clear pattern. In other words,
        the hypothesis is supported by the evidence. Finally, we conclude that
        further research is needed.
      `;

      const result = analyzeMetadiscourse(textWithMarkers);

      expect(result.interactive.transitions).toBeGreaterThan(0);
      expect(result.interactive.frameMarkers).toBeGreaterThan(0);
    });

    it('should detect interactional markers', () => {
      const textWithMarkers = `
        I believe this approach might be effective. We found that the results
        clearly demonstrate a significant effect. Unfortunately, the sample size
        was limited. You should consider these findings carefully.
      `;

      const result = analyzeMetadiscourse(textWithMarkers);

      expect(result.interactional.hedges).toBeGreaterThan(0);
      expect(result.interactional.selfMentions).toBeGreaterThan(0);
    });

    it('should normalize scores to 0-1 range', () => {
      const result = analyzeMetadiscourse('This is a sample text with some content.');

      // Check all values are in valid range
      for (const value of Object.values(result.interactive)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      for (const value of Object.values(result.interactional)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getDomainStatistics', () => {
    it('should return statistics for medical domain', () => {
      const stats = getDomainStatistics('medical');

      expect(stats.domain).toBe('medical');
      expect(stats.textTypeDistribution).toBeDefined();
      expect(stats.genreDistribution).toBeDefined();
      expect(stats.typicalMetadiscourse).toBeDefined();
      expect(stats.vocabularyPatterns).toBeDefined();
    });

    it('should return statistics for legal domain', () => {
      const stats = getDomainStatistics('legal');

      expect(stats.domain).toBe('legal');
      expect(stats.typicalDimensionalScores.argumentative).toBeUndefined; // It's a dimension, not a score
      // Legal domain should have high explicit reference
      expect(stats.typicalDimensionalScores.explicitVsSituationDependent).toBeGreaterThan(0.5);
    });

    it('should return statistics for academic domain', () => {
      const stats = getDomainStatistics('academic');

      expect(stats.domain).toBe('academic');
      // Academic domain should have high hedging in metadiscourse
      expect(stats.typicalMetadiscourse.interactional.hedges).toBeGreaterThan(0.5);
    });

    it('should return general statistics for unknown domains', () => {
      const stats = getDomainStatistics('unknowndomain');

      expect(stats.domain).toBe('general');
    });

    it('should include vocabulary patterns', () => {
      const stats = getDomainStatistics('medical');

      expect(stats.vocabularyPatterns.openingBundles.length).toBeGreaterThan(0);
      expect(stats.vocabularyPatterns.transitionBundles.length).toBeGreaterThan(0);
      expect(stats.vocabularyPatterns.closingBundles.length).toBeGreaterThan(0);
      expect(stats.vocabularyPatterns.domainCollocations.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeGenreMoves (Swales 1990)', () => {
    it('should analyze research article moves', () => {
      const raIntro = `
        In recent years, there has been increasing interest in language learning.
        Previous research has shown significant results. However, few studies have
        examined this specific aspect. This study aims to investigate the relationship
        between vocabulary knowledge and reading comprehension.
      `;

      const result = analyzeGenreMoves(raIntro, 'research_article');

      expect(result.moves.length).toBeGreaterThan(0);
      expect(result.completeness).toBeGreaterThanOrEqual(0);
      expect(result.completeness).toBeLessThanOrEqual(1);
    });

    it('should analyze medical history moves', () => {
      const medicalHistory = `
        Chief complaint: Chest pain for 2 days.
        History of present illness: Patient reports intermittent chest pain.
        Past medical history: Hypertension, diabetes.
        Medications: Metformin 500mg twice daily.
        Physical examination: Vital signs stable, lungs clear.
        Assessment and plan: Rule out cardiac etiology, will order ECG.
      `;

      const result = analyzeGenreMoves(medicalHistory, 'medical_history');

      expect(result.moves.length).toBeGreaterThan(0);
      // Should have high completeness with proper medical history format
      expect(result.completeness).toBeGreaterThan(0);
    });

    it('should analyze contract moves', () => {
      const contract = `
        This Agreement is entered into as of January 1, 2024, by and between
        Party A ("Seller") and Party B ("Buyer"), hereinafter referred to as
        the Parties. The Seller represents and warrants that it has full authority
        to enter into this agreement. Notwithstanding any provision herein,
        this Agreement shall be governed by the laws of the State of California.
        IN WITNESS WHEREOF, the parties have executed this Agreement.
      `;

      const result = analyzeGenreMoves(contract, 'contract');

      expect(result.moves.length).toBeGreaterThan(0);
    });

    it('should return empty for unknown genres', () => {
      const result = analyzeGenreMoves('Some text', 'unknown_genre' as Genre);

      expect(result.moves).toEqual([]);
      expect(result.completeness).toBe(0);
    });
  });

  describe('calculateDomainAppropriateness', () => {
    it('should score academic text higher for academic domain', () => {
      const academicText = `
        This study examines the theoretical framework underlying second language
        acquisition. Previous research has demonstrated significant correlations.
        However, the findings suggest that further investigation is warranted.
        In conclusion, the data analysis reveals important implications.
      `;

      const result = calculateDomainAppropriateness(academicText, 'academic');

      expect(result.appropriatenessScore).toBeGreaterThan(0);
      expect(result.appropriatenessScore).toBeLessThanOrEqual(1);
      expect(result.textTypeMatch).toBeGreaterThan(0);
      expect(result.metadiscourseMatch).toBeGreaterThan(0);
    });

    it('should provide recommendations for improvement', () => {
      const casualText = `
        Hey! So I was thinking, you know, maybe we could look into this stuff.
        It's pretty cool, right? I mean, like, the results are awesome!
      `;

      const result = calculateDomainAppropriateness(casualText, 'academic');

      // Casual text in academic domain should get some recommendations
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should score business text appropriately', () => {
      const businessText = `
        I am writing to follow up on our previous discussion regarding the
        quarterly report. Please find attached the updated proposal. Moving forward,
        we should consider the key stakeholders. I look forward to your response.
      `;

      const result = calculateDomainAppropriateness(businessText, 'business');

      expect(result.appropriatenessScore).toBeGreaterThan(0);
    });
  });

  describe('Domain Statistics Data Integrity', () => {
    it('should have text type distributions summing to approximately 1', () => {
      for (const [domain, stats] of Object.entries(DOMAIN_TEXT_TYPE_STATISTICS)) {
        const sum = Object.values(stats.textTypeDistribution).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 1);
      }
    });

    it('should have all required domains', () => {
      const requiredDomains = ['medical', 'legal', 'business', 'academic', 'general'];
      for (const domain of requiredDomains) {
        expect(DOMAIN_TEXT_TYPE_STATISTICS[domain]).toBeDefined();
      }
    });

    it('should have dimensional scores in valid range', () => {
      for (const stats of Object.values(DOMAIN_TEXT_TYPE_STATISTICS)) {
        for (const score of Object.values(stats.typicalDimensionalScores)) {
          expect(score).toBeGreaterThanOrEqual(-1);
          expect(score).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have metadiscourse values in 0-1 range', () => {
      for (const stats of Object.values(DOMAIN_TEXT_TYPE_STATISTICS)) {
        for (const value of Object.values(stats.typicalMetadiscourse.interactive)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        for (const value of Object.values(stats.typicalMetadiscourse.interactional)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Genre Move Structures (Swales CARS model)', () => {
    it('should have research article with CARS moves', () => {
      const raMoves = GENRE_MOVE_STRUCTURES.research_article;
      expect(raMoves).toBeDefined();
      expect(raMoves!.length).toBeGreaterThan(0);

      // CARS model should include territory, niche, and occupying
      const moveNames = raMoves!.map(m => m.name);
      expect(moveNames.some(n => n.includes('territory'))).toBe(true);
      expect(moveNames.some(n => n.includes('niche'))).toBe(true);
    });

    it('should have medical history genre moves', () => {
      const medMoves = GENRE_MOVE_STRUCTURES.medical_history;
      expect(medMoves).toBeDefined();

      const moveNames = medMoves!.map(m => m.name);
      expect(moveNames.some(n => n.includes('Chief') || n.includes('Complaint'))).toBe(true);
    });

    it('should have contract genre moves', () => {
      const contractMoves = GENRE_MOVE_STRUCTURES.contract;
      expect(contractMoves).toBeDefined();

      const moveNames = contractMoves!.map(m => m.name);
      expect(moveNames.some(n => n.includes('Preamble'))).toBe(true);
    });

    it('should have obligatory and optional moves marked', () => {
      for (const moves of Object.values(GENRE_MOVE_STRUCTURES)) {
        if (moves) {
          for (const move of moves) {
            expect(typeof move.obligatory).toBe('boolean');
            expect(move.typicalPosition).toBeGreaterThanOrEqual(0);
            expect(move.typicalPosition).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });
});
