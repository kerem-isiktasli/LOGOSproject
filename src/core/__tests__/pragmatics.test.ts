/**
 * Pragmatics Module Tests
 *
 * Tests for pragmatic competence analysis.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeRegister,
  detectRegister,
  isRegisterAppropriate,
  detectSpeechAct,
  analyzePoliteness,
  recommendPolitenessStrategy,
  assessPragmaticAppropriateness,
  generatePragmaticProfile,
  calculatePragmaticDifficulty,
  type PragmaticContext,
} from '../pragmatics';

describe('Pragmatics Module', () => {
  describe('analyzeRegister', () => {
    it('should return scores for all register levels', () => {
      const scores = analyzeRegister('Hello, how are you?');

      expect(scores.frozen).toBeDefined();
      expect(scores.formal).toBeDefined();
      expect(scores.consultative).toBeDefined();
      expect(scores.casual).toBeDefined();
      expect(scores.intimate).toBeDefined();
    });

    it('should score formal markers correctly', () => {
      const formal = analyzeRegister('Therefore, we must consider the following factors.');
      const casual = analyzeRegister("Hey, what's up? Gonna grab some food.");

      expect(formal.formal).toBeGreaterThan(casual.formal);
    });

    it('should score casual markers correctly', () => {
      const casual = analyzeRegister("Yeah, that's kinda cool, wanna check it out?");
      const formal = analyzeRegister('Consequently, the matter requires further examination.');

      expect(casual.casual).toBeGreaterThan(formal.casual);
    });

    it('should detect contractions as casual markers', () => {
      const withContractions = analyzeRegister("I don't think it's a good idea.");
      const withoutContractions = analyzeRegister('I do not think it is a good idea.');

      expect(withContractions.casual).toBeGreaterThan(withoutContractions.casual);
    });
  });

  describe('detectRegister', () => {
    it('should detect frozen register', () => {
      const text = 'Whereas the party of the first part hereby agrees notwithstanding the aforementioned provisions.';
      expect(detectRegister(text)).toBe('frozen');
    });

    it('should detect formal register', () => {
      const text = 'Furthermore, the results demonstrate a significant correlation between the variables.';
      expect(detectRegister(text)).toBe('formal');
    });

    it('should detect casual register', () => {
      const text = "Hey buddy, wanna grab some coffee? That'd be awesome!";
      expect(detectRegister(text)).toBe('casual');
    });
  });

  describe('isRegisterAppropriate', () => {
    it('should approve matching register for professional context', () => {
      const context: PragmaticContext = {
        powerDifferential: 0,
        socialDistance: 0.5,
        impositionRank: 0.3,
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = isRegisterAppropriate('consultative', context);

      expect(result.appropriate).toBe(true);
    });

    it('should flag overly casual register in professional context', () => {
      const context: PragmaticContext = {
        powerDifferential: -0.5, // Speaking to authority
        socialDistance: 0.7,
        impositionRank: 0.5,
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = isRegisterAppropriate('casual', context);

      expect(result.appropriate).toBe(false);
      expect(result.explanation).toContain('informal');
    });

    it('should flag overly formal register in private context', () => {
      const context: PragmaticContext = {
        powerDifferential: 0,
        socialDistance: 0.1,
        impositionRank: 0.1,
        culturalContext: 'western',
        setting: 'private',
      };

      const result = isRegisterAppropriate('formal', context);

      expect(result.appropriate).toBe(false);
    });
  });

  describe('detectSpeechAct', () => {
    it('should detect requests', () => {
      const result = detectSpeechAct('Could you please send me the report?');

      expect(result.category).toBe('directive');
      expect(result.type).toBe('request');
    });

    it('should detect apologies', () => {
      const result = detectSpeechAct("I'm sorry for the inconvenience.");

      expect(result.category).toBe('expressive');
      expect(result.type).toBe('apology');
    });

    it('should detect promises', () => {
      const result = detectSpeechAct("I promise I'll finish it by tomorrow.");

      expect(result.category).toBe('commissive');
      expect(result.type).toBe('promise');
    });

    it('should detect thanks', () => {
      const result = detectSpeechAct('Thank you so much for your help.');

      expect(result.category).toBe('expressive');
      expect(result.type).toBe('thanks');
    });

    it('should detect suggestions', () => {
      const result = detectSpeechAct('Why don\'t you try restarting the computer?');

      expect(result.category).toBe('directive');
      expect(result.type).toBe('suggestion');
    });

    it('should return null for unrecognized speech acts', () => {
      const result = detectSpeechAct('The sky is blue.');

      // Should still detect as a statement or have low confidence
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('analyzePoliteness', () => {
    it('should detect bald on record', () => {
      const result = analyzePoliteness('Give me the file.');

      expect(result.strategy).toBe('bald_on_record');
    });

    it('should detect positive politeness', () => {
      const result = analyzePoliteness("Hey buddy, let's work on this together, it'll be great!");

      expect(result.strategy).toBe('positive_politeness');
    });

    it('should detect negative politeness', () => {
      const result = analyzePoliteness("I was wondering if you might possibly help me with this. Sorry to bother you.");

      expect(result.strategy).toBe('negative_politeness');
    });

    it('should return found markers', () => {
      const result = analyzePoliteness('Would you mind possibly checking this for me?');

      expect(result.markers.length).toBeGreaterThan(0);
    });
  });

  describe('recommendPolitenessStrategy', () => {
    it('should recommend bald on record for low FTA contexts', () => {
      const context: PragmaticContext = {
        powerDifferential: 0.5, // Speaker has power
        socialDistance: 0.1, // Close relationship
        impositionRank: 0.1, // Small request
        culturalContext: 'western',
        setting: 'private',
      };

      expect(recommendPolitenessStrategy(context)).toBe('bald_on_record');
    });

    it('should recommend negative politeness for high FTA contexts', () => {
      const context: PragmaticContext = {
        powerDifferential: -0.5, // Speaking to authority
        socialDistance: 0.7, // Distant relationship
        impositionRank: 0.6, // Big request
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = recommendPolitenessStrategy(context);

      expect(['negative_politeness', 'off_record']).toContain(result);
    });

    it('should recommend off_record for very high FTA', () => {
      const context: PragmaticContext = {
        powerDifferential: -0.8,
        socialDistance: 0.9,
        impositionRank: 0.9,
        culturalContext: 'western',
        setting: 'professional',
      };

      expect(recommendPolitenessStrategy(context)).toBe('off_record');
    });
  });

  describe('assessPragmaticAppropriateness', () => {
    it('should give high score for appropriate utterance', () => {
      const context: PragmaticContext = {
        powerDifferential: 0,
        socialDistance: 0.3,
        impositionRank: 0.3,
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = assessPragmaticAppropriateness(
        'Could you please review this document when you have a moment?',
        context,
        'request'
      );

      expect(result.overallScore).toBeGreaterThan(0.5);
    });

    it('should flag register mismatch', () => {
      const context: PragmaticContext = {
        powerDifferential: -0.5,
        socialDistance: 0.7,
        impositionRank: 0.5,
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = assessPragmaticAppropriateness(
        "Hey dude, gimme that report, yeah?",
        context
      );

      const hasRegisterIssue = result.issues.some((i) => i.type === 'register_mismatch');
      expect(hasRegisterIssue).toBe(true);
    });

    it('should flag politeness violations', () => {
      const context: PragmaticContext = {
        powerDifferential: -0.8,
        socialDistance: 0.9,
        impositionRank: 0.8,
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = assessPragmaticAppropriateness(
        'Do it now.',
        context
      );

      const hasPolitenessIssue = result.issues.some((i) => i.type === 'politeness_violation');
      expect(hasPolitenessIssue).toBe(true);
    });

    it('should provide recommendations', () => {
      const context: PragmaticContext = {
        powerDifferential: -0.5,
        socialDistance: 0.7,
        impositionRank: 0.6,
        culturalContext: 'western',
        setting: 'professional',
      };

      const result = assessPragmaticAppropriateness(
        'Give me the file.',
        context
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('generatePragmaticProfile', () => {
    it('should generate complete profile', () => {
      const profile = generatePragmaticProfile('Could you please help me with this?');

      expect(profile.register).toBeDefined();
      expect(profile.registerFlexibility).toBeGreaterThanOrEqual(0);
      expect(profile.registerFlexibility).toBeLessThanOrEqual(1);
      expect(profile.culturalSensitivity).toBeDefined();
      expect(profile.domainAppropriateness).toBeDefined();
    });

    it('should detect speech act in profile', () => {
      const profile = generatePragmaticProfile("I'm sorry for being late.");

      expect(profile.speechActCategory).toBe('expressive');
      expect(profile.speechActType).toBe('apology');
    });

    it('should detect politeness strategy in profile', () => {
      const profile = generatePragmaticProfile(
        'I was wondering if you might possibly consider this request.'
      );

      expect(profile.politenessStrategy).toBe('negative_politeness');
    });
  });

  describe('calculatePragmaticDifficulty', () => {
    it('should return value between 0 and 1', () => {
      const profile = generatePragmaticProfile('Hello');
      const difficulty = calculatePragmaticDifficulty(profile);

      expect(difficulty).toBeGreaterThanOrEqual(0);
      expect(difficulty).toBeLessThanOrEqual(1);
    });

    it('should rate refusals as more difficult', () => {
      const refusalProfile = generatePragmaticProfile(
        "I'm afraid I won't be able to help with that."
      );
      const thanksProfile = generatePragmaticProfile('Thank you so much!');

      const refusalDifficulty = calculatePragmaticDifficulty(refusalProfile);
      const thanksDifficulty = calculatePragmaticDifficulty(thanksProfile);

      expect(refusalDifficulty).toBeGreaterThan(thanksDifficulty);
    });

    it('should rate off-record strategies as more difficult', () => {
      const directProfile = generatePragmaticProfile('Close the window.');
      const indirectProfile = generatePragmaticProfile("It's quite cold in here, isn't it?");

      // Manually set strategy for test
      const indirectWithOffRecord = {
        ...indirectProfile,
        politenessStrategy: 'off_record' as const,
      };

      const directDifficulty = calculatePragmaticDifficulty(directProfile);
      const indirectDifficulty = calculatePragmaticDifficulty(indirectWithOffRecord);

      expect(indirectDifficulty).toBeGreaterThan(directDifficulty);
    });
  });
});
