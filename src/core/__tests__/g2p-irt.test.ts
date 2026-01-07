/**
 * G2P-IRT Integration Module Unit Tests
 *
 * Tests for context-dependent difficulty estimation,
 * theta profile management, and item selection.
 *
 * Based on:
 * - Format-aware IRT (EDM 2022)
 * - Multidimensional IRT (MIRT)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  g2pToIRTParameters,
  getContextualDifficulty,
  probabilityG2P,
  selectThetaForContext,
  updateG2PThetaProfile,
  selectOptimalG2PItem,
  recommendG2PLayer,
  createInitialG2PThetaProfile,
  hasReliableEstimate,
  assessG2PReadiness,
  batchUpdateG2PThetaProfile,
  expectedInformationGain,
  getL1PatternAdjustment,
  DEFAULT_CONTEXT_ADJUSTMENTS,
  L1_DIFFICULTY_ADJUSTMENTS,
  type G2PIRTParameters,
  type G2PThetaProfile,
  type G2PTaskContext,
  type G2PResponse,
} from '../g2p-irt';
import type { G2PDifficulty } from '../g2p';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestG2PDifficulty(
  overrides: Partial<G2PDifficulty> = {}
): G2PDifficulty {
  return {
    word: 'test',
    irregularPatterns: [],
    difficultyScore: 0.5,
    potentialMispronunciations: [],
    syllableCount: 1,
    hasSilentLetters: false,
    hasIrregularStress: false,
    ...overrides,
  };
}

function createTestG2PIRTParameters(
  overrides: Partial<G2PIRTParameters> = {}
): G2PIRTParameters {
  const g2pAnalysis = createTestG2PDifficulty();
  return {
    id: 'test-item',
    content: 'test',
    baseDifficulty: 0,
    discrimination: 1.0,
    guessing: 0,
    contextAdjustments: { ...DEFAULT_CONTEXT_ADJUSTMENTS },
    layerThresholds: {
      alphabetic: -1.0,
      syllable: -0.5,
      word: 0.0,
    },
    l1Adjustments: {},
    g2pAnalysis,
    ...overrides,
  };
}

function createTestThetaProfile(
  overrides: Partial<G2PThetaProfile> = {}
): G2PThetaProfile {
  return {
    userId: 'user-1',
    updatedAt: new Date(),
    thetaPhonological: 0,
    thetaAlphabetic: 0,
    thetaSyllable: 0,
    thetaWord: 0,
    thetaReading: 0,
    thetaListening: 0,
    thetaSpeaking: 0,
    thetaWriting: 0,
    standardErrors: {
      phonological: 1.5,
      alphabetic: 1.5,
      syllable: 1.5,
      word: 1.5,
      reading: 1.5,
      listening: 1.5,
      speaking: 1.5,
      writing: 1.5,
    },
    responseCounts: {
      alphabetic: 0,
      syllable: 0,
      word: 0,
      reading: 0,
      listening: 0,
      speaking: 0,
      writing: 0,
    },
    ...overrides,
  };
}

function createTestTaskContext(
  overrides: Partial<G2PTaskContext> = {}
): G2PTaskContext {
  return {
    modality: 'reading',
    taskType: 'recognition',
    isTimed: false,
    targetLayer: 'word',
    userL1: 'korean',
    ...overrides,
  };
}

// ============================================================================
// G2P to IRT Conversion Tests
// ============================================================================

describe('g2pToIRTParameters', () => {
  it('converts G2P difficulty to IRT parameters', () => {
    const g2p = createTestG2PDifficulty({ difficultyScore: 0.5 });
    const irt = g2pToIRTParameters(g2p);

    expect(irt.id).toContain('g2p_');
    expect(irt.content).toBe('test');
    expect(irt.discrimination).toBe(1.0);
    expect(irt.guessing).toBe(0);
  });

  it('maps 0.5 difficulty to ~0 logit', () => {
    const g2p = createTestG2PDifficulty({ difficultyScore: 0.5 });
    const irt = g2pToIRTParameters(g2p);

    expect(irt.baseDifficulty).toBeCloseTo(0, 1);
  });

  it('maps high difficulty to positive logit', () => {
    const g2p = createTestG2PDifficulty({ difficultyScore: 0.9 });
    const irt = g2pToIRTParameters(g2p);

    expect(irt.baseDifficulty).toBeGreaterThan(1);
  });

  it('maps low difficulty to negative logit', () => {
    const g2p = createTestG2PDifficulty({ difficultyScore: 0.1 });
    const irt = g2pToIRTParameters(g2p);

    expect(irt.baseDifficulty).toBeLessThan(-1);
  });

  it('clamps extreme difficulties', () => {
    const g2p1 = createTestG2PDifficulty({ difficultyScore: 0 });
    const g2p2 = createTestG2PDifficulty({ difficultyScore: 1 });

    const irt1 = g2pToIRTParameters(g2p1);
    const irt2 = g2pToIRTParameters(g2p2);

    expect(isFinite(irt1.baseDifficulty)).toBe(true);
    expect(isFinite(irt2.baseDifficulty)).toBe(true);
  });

  it('sets higher word threshold for irregular patterns', () => {
    const regular = createTestG2PDifficulty({ irregularPatterns: [] });
    const irregular = createTestG2PDifficulty({
      irregularPatterns: [
        { pattern: 'ough', reason: 'multiple pronunciations', position: 0, difficulty: 0.5 },
      ],
    });

    const irtRegular = g2pToIRTParameters(regular);
    const irtIrregular = g2pToIRTParameters(irregular);

    expect(irtIrregular.layerThresholds.word).toBeGreaterThan(
      irtRegular.layerThresholds.word
    );
  });

  it('extracts L1 adjustments from mispronunciations', () => {
    const g2p = createTestG2PDifficulty({
      potentialMispronunciations: [
        { l1: 'korean', mispronunciation: 'teh-st', reason: 'no final clusters', probability: 0.5 },
      ],
    });

    const irt = g2pToIRTParameters(g2p);

    expect(irt.l1Adjustments.korean).toBeGreaterThan(0);
  });
});

// ============================================================================
// Contextual Difficulty Tests
// ============================================================================

describe('getContextualDifficulty', () => {
  it('returns base difficulty for reading recognition', () => {
    const params = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const context = createTestTaskContext({
      modality: 'reading',
      taskType: 'recognition',
      isTimed: false,
    });

    const difficulty = getContextualDifficulty(params, context);

    // Reading recognition untimed should add minimal adjustment
    expect(difficulty).toBeCloseTo(
      params.baseDifficulty +
        DEFAULT_CONTEXT_ADJUSTMENTS.byModality.reading +
        DEFAULT_CONTEXT_ADJUSTMENTS.byTaskType.recognition +
        DEFAULT_CONTEXT_ADJUSTMENTS.byTiming.untimed +
        DEFAULT_CONTEXT_ADJUSTMENTS.byLayer.word,
      5
    );
  });

  it('adds difficulty for speaking modality', () => {
    const params = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const readingContext = createTestTaskContext({ modality: 'reading' });
    const speakingContext = createTestTaskContext({ modality: 'speaking' });

    const readingDiff = getContextualDifficulty(params, readingContext);
    const speakingDiff = getContextualDifficulty(params, speakingContext);

    expect(speakingDiff).toBeGreaterThan(readingDiff);
  });

  it('adds difficulty for production tasks', () => {
    const params = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const recognitionContext = createTestTaskContext({ taskType: 'recognition' });
    const productionContext = createTestTaskContext({ taskType: 'production' });

    const recognitionDiff = getContextualDifficulty(params, recognitionContext);
    const productionDiff = getContextualDifficulty(params, productionContext);

    expect(productionDiff).toBeGreaterThan(recognitionDiff);
  });

  it('adds difficulty for timed tasks', () => {
    const params = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const untimedContext = createTestTaskContext({ isTimed: false });
    const timedContext = createTestTaskContext({ isTimed: true });

    const untimedDiff = getContextualDifficulty(params, untimedContext);
    const timedDiff = getContextualDifficulty(params, timedContext);

    expect(timedDiff).toBeGreaterThan(untimedDiff);
  });

  it('adds L1-specific adjustment', () => {
    const params = createTestG2PIRTParameters({
      baseDifficulty: 0,
      l1Adjustments: { korean: 0.5 },
    });
    const koreanContext = createTestTaskContext({ userL1: 'korean' });
    const englishContext = createTestTaskContext({ userL1: 'english' });

    const koreanDiff = getContextualDifficulty(params, koreanContext);
    const englishDiff = getContextualDifficulty(params, englishContext);

    expect(koreanDiff).toBeGreaterThan(englishDiff);
  });
});

// ============================================================================
// Probability Calculation Tests
// ============================================================================

describe('probabilityG2P', () => {
  it('returns ~0.5 when theta equals difficulty', () => {
    const profile = createTestThetaProfile({ thetaPhonological: 0 });
    const params = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const context = createTestTaskContext();

    const prob = probabilityG2P(profile, params, context);

    // With context adjustments, won't be exactly 0.5 but should be reasonable
    expect(prob).toBeGreaterThan(0.2);
    expect(prob).toBeLessThan(0.8);
  });

  it('returns higher probability for high ability', () => {
    const lowAbility = createTestThetaProfile({ thetaPhonological: -2 });
    const highAbility = createTestThetaProfile({ thetaPhonological: 2 });
    const params = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const context = createTestTaskContext();

    const lowProb = probabilityG2P(lowAbility, params, context);
    const highProb = probabilityG2P(highAbility, params, context);

    expect(highProb).toBeGreaterThan(lowProb);
  });

  it('returns lower probability for difficult items', () => {
    const profile = createTestThetaProfile({ thetaPhonological: 0 });
    const easyParams = createTestG2PIRTParameters({ baseDifficulty: -2 });
    const hardParams = createTestG2PIRTParameters({ baseDifficulty: 2 });
    const context = createTestTaskContext();

    const easyProb = probabilityG2P(profile, easyParams, context);
    const hardProb = probabilityG2P(profile, hardParams, context);

    expect(easyProb).toBeGreaterThan(hardProb);
  });
});

// ============================================================================
// Theta Selection Tests
// ============================================================================

describe('selectThetaForContext', () => {
  it('blends phonological and modality thetas', () => {
    const profile = createTestThetaProfile({
      thetaPhonological: 1.0,
      thetaReading: 2.0,
      thetaWord: 2.0, // Set word theta to avoid layer blending reducing the value
    });
    const context = createTestTaskContext({ modality: 'reading', targetLayer: 'auto' });

    const theta = selectThetaForContext(profile, context);

    // With auto layer, should blend phonological (1.0) and reading (2.0)
    // theta = 0.6 * 1.0 + 0.4 * 2.0 = 1.4
    expect(theta).toBeGreaterThan(1.0);
    expect(theta).toBeLessThan(2.0);
  });

  it('incorporates layer theta when specified', () => {
    const profile = createTestThetaProfile({
      thetaPhonological: 0,
      thetaReading: 0,
      thetaWord: 2.0,
    });
    const context = createTestTaskContext({ targetLayer: 'word' });

    const theta = selectThetaForContext(profile, context);

    expect(theta).toBeGreaterThan(0);
  });

  it('ignores layer theta when auto', () => {
    const profile = createTestThetaProfile({
      thetaPhonological: 0,
      thetaReading: 0,
      thetaWord: 2.0,
    });
    const context = createTestTaskContext({ targetLayer: 'auto' });

    const theta = selectThetaForContext(profile, context);

    // Should be closer to phonological/reading blend
    expect(theta).toBeCloseTo(0, 0.5);
  });
});

// ============================================================================
// Profile Update Tests
// ============================================================================

describe('updateG2PThetaProfile', () => {
  it('increases theta after correct response', () => {
    const profile = createTestThetaProfile({ thetaReading: 0 });
    const response: G2PResponse = {
      itemId: 'item-1',
      correct: true,
      responseTimeMs: 1500,
      context: createTestTaskContext({ modality: 'reading' }),
      itemParams: createTestG2PIRTParameters({ baseDifficulty: 0 }),
    };

    const updated = updateG2PThetaProfile(profile, response);

    expect(updated.thetaReading).toBeGreaterThan(profile.thetaReading);
  });

  it('decreases theta after incorrect response', () => {
    const profile = createTestThetaProfile({ thetaReading: 0 });
    const response: G2PResponse = {
      itemId: 'item-1',
      correct: false,
      responseTimeMs: 1500,
      context: createTestTaskContext({ modality: 'reading' }),
      itemParams: createTestG2PIRTParameters({ baseDifficulty: 0 }),
    };

    const updated = updateG2PThetaProfile(profile, response);

    expect(updated.thetaReading).toBeLessThan(profile.thetaReading);
  });

  it('increments response count', () => {
    const profile = createTestThetaProfile();
    const response: G2PResponse = {
      itemId: 'item-1',
      correct: true,
      responseTimeMs: 1500,
      context: createTestTaskContext({ modality: 'reading' }),
      itemParams: createTestG2PIRTParameters(),
    };

    const updated = updateG2PThetaProfile(profile, response);

    expect(updated.responseCounts.reading).toBe(1);
  });

  it('decreases standard error with more responses', () => {
    let profile = createTestThetaProfile();
    const context = createTestTaskContext({ modality: 'reading' });

    for (let i = 0; i < 5; i++) {
      const response: G2PResponse = {
        itemId: `item-${i}`,
        correct: true,
        responseTimeMs: 1500,
        context,
        itemParams: createTestG2PIRTParameters(),
      };
      profile = updateG2PThetaProfile(profile, response);
    }

    expect(profile.standardErrors.reading).toBeLessThan(1.5);
  });

  it('updates layer theta when specified', () => {
    const profile = createTestThetaProfile({ thetaWord: 0 });
    const response: G2PResponse = {
      itemId: 'item-1',
      correct: true,
      responseTimeMs: 1500,
      context: createTestTaskContext({ targetLayer: 'word' }),
      itemParams: createTestG2PIRTParameters(),
    };

    const updated = updateG2PThetaProfile(profile, response);

    expect(updated.thetaWord).toBeGreaterThan(profile.thetaWord);
  });
});

// ============================================================================
// Item Selection Tests
// ============================================================================

describe('selectOptimalG2PItem', () => {
  it('returns null for empty candidates', () => {
    const profile = createTestThetaProfile();
    const context = createTestTaskContext();

    const result = selectOptimalG2PItem([], profile, context);

    expect(result).toBeNull();
  });

  it('selects item with highest information', () => {
    const profile = createTestThetaProfile({ thetaPhonological: 0 });
    const candidates = [
      createTestG2PIRTParameters({ id: 'easy', baseDifficulty: -3 }),
      createTestG2PIRTParameters({ id: 'matched', baseDifficulty: 0 }),
      createTestG2PIRTParameters({ id: 'hard', baseDifficulty: 3 }),
    ];
    const context = createTestTaskContext();

    const result = selectOptimalG2PItem(candidates, profile, context);

    // Should select item closest to theta for max information
    expect(result?.item.id).toBe('matched');
    expect(result?.information).toBeGreaterThan(0);
  });

  it('returns information gain with selection', () => {
    const profile = createTestThetaProfile();
    const candidates = [createTestG2PIRTParameters()];
    const context = createTestTaskContext();

    const result = selectOptimalG2PItem(candidates, profile, context);

    expect(result?.information).toBeDefined();
    expect(result?.information).toBeGreaterThan(0);
  });
});

// ============================================================================
// Layer Recommendation Tests
// ============================================================================

describe('recommendG2PLayer', () => {
  it('recommends alphabetic when below threshold', () => {
    const profile = createTestThetaProfile({ thetaAlphabetic: -2 });
    const params = createTestG2PIRTParameters({
      layerThresholds: {
        alphabetic: -1,
        syllable: 0,
        word: 1,
      },
    });

    expect(recommendG2PLayer(profile, params)).toBe('alphabetic');
  });

  it('recommends syllable when alphabetic ready but not syllable', () => {
    const profile = createTestThetaProfile({
      thetaAlphabetic: 0,
      thetaSyllable: -1,
    });
    const params = createTestG2PIRTParameters({
      layerThresholds: {
        alphabetic: -1,
        syllable: 0,
        word: 1,
      },
    });

    expect(recommendG2PLayer(profile, params)).toBe('syllable');
  });

  it('recommends word when all thresholds met', () => {
    const profile = createTestThetaProfile({
      thetaAlphabetic: 2,
      thetaSyllable: 2,
      thetaWord: 2,
    });
    const params = createTestG2PIRTParameters({
      layerThresholds: {
        alphabetic: -1,
        syllable: 0,
        word: 1,
      },
    });

    expect(recommendG2PLayer(profile, params)).toBe('word');
  });
});

// ============================================================================
// Profile Creation Tests
// ============================================================================

describe('createInitialG2PThetaProfile', () => {
  it('creates profile with user ID', () => {
    const profile = createInitialG2PThetaProfile('user-123');

    expect(profile.userId).toBe('user-123');
  });

  it('initializes all thetas to 0', () => {
    const profile = createInitialG2PThetaProfile('user-1');

    expect(profile.thetaPhonological).toBe(0);
    expect(profile.thetaAlphabetic).toBe(0);
    expect(profile.thetaSyllable).toBe(0);
    expect(profile.thetaWord).toBe(0);
    expect(profile.thetaReading).toBe(0);
    expect(profile.thetaListening).toBe(0);
    expect(profile.thetaSpeaking).toBe(0);
    expect(profile.thetaWriting).toBe(0);
  });

  it('initializes standard errors to 1.5', () => {
    const profile = createInitialG2PThetaProfile('user-1');

    expect(profile.standardErrors.phonological).toBe(1.5);
    expect(profile.standardErrors.reading).toBe(1.5);
  });

  it('initializes all response counts to 0', () => {
    const profile = createInitialG2PThetaProfile('user-1');

    expect(profile.responseCounts.alphabetic).toBe(0);
    expect(profile.responseCounts.reading).toBe(0);
  });
});

// ============================================================================
// Reliability Check Tests
// ============================================================================

describe('hasReliableEstimate', () => {
  it('returns false for 0 responses', () => {
    const profile = createTestThetaProfile({ responseCounts: { ...createTestThetaProfile().responseCounts, reading: 0 } });

    expect(hasReliableEstimate(profile, 'reading')).toBe(false);
  });

  it('returns false for fewer than 5 responses', () => {
    const profile = createTestThetaProfile();
    profile.responseCounts.reading = 4;

    expect(hasReliableEstimate(profile, 'reading')).toBe(false);
  });

  it('returns true for 5 or more responses', () => {
    const profile = createTestThetaProfile();
    profile.responseCounts.reading = 5;

    expect(hasReliableEstimate(profile, 'reading')).toBe(true);
  });

  it('returns true for many responses', () => {
    const profile = createTestThetaProfile();
    profile.responseCounts.reading = 100;

    expect(hasReliableEstimate(profile, 'reading')).toBe(true);
  });
});

// ============================================================================
// Readiness Assessment Tests
// ============================================================================

describe('assessG2PReadiness', () => {
  it('assesses all layers as not ready for low ability', () => {
    const profile = createTestThetaProfile({
      thetaAlphabetic: -3,
      thetaSyllable: -3,
      thetaWord: -3,
    });
    const params = createTestG2PIRTParameters({
      layerThresholds: {
        alphabetic: 0,
        syllable: 0.5,
        word: 1.0,
      },
    });

    const assessment = assessG2PReadiness(profile, params);

    expect(assessment.ready).toBe(false);
    expect(assessment.alphabeticReady).toBe(false);
    expect(assessment.syllableReady).toBe(false);
    expect(assessment.wordReady).toBe(false);
    expect(assessment.recommendedLayer).toBe('alphabetic');
  });

  it('assesses partial readiness', () => {
    const profile = createTestThetaProfile({
      thetaAlphabetic: 1,
      thetaSyllable: 0,
      thetaWord: -1,
    });
    const params = createTestG2PIRTParameters({
      layerThresholds: {
        alphabetic: 0,
        syllable: 0.5,
        word: 1.0,
      },
    });

    const assessment = assessG2PReadiness(profile, params);

    expect(assessment.ready).toBe(false);
    expect(assessment.alphabeticReady).toBe(true);
    expect(assessment.syllableReady).toBe(false);
    expect(assessment.wordReady).toBe(false);
    expect(assessment.recommendedLayer).toBe('syllable');
  });

  it('assesses full readiness', () => {
    const profile = createTestThetaProfile({
      thetaAlphabetic: 2,
      thetaSyllable: 2,
      thetaWord: 2,
    });
    const params = createTestG2PIRTParameters({
      layerThresholds: {
        alphabetic: 0,
        syllable: 0.5,
        word: 1.0,
      },
    });

    const assessment = assessG2PReadiness(profile, params);

    expect(assessment.ready).toBe(true);
    expect(assessment.alphabeticReady).toBe(true);
    expect(assessment.syllableReady).toBe(true);
    expect(assessment.wordReady).toBe(true);
    expect(assessment.recommendedLayer).toBe('word');
  });

  it('returns low confidence for few responses', () => {
    const profile = createTestThetaProfile();
    const params = createTestG2PIRTParameters();

    const assessment = assessG2PReadiness(profile, params);

    expect(assessment.confidenceLevel).toBe('low');
  });

  it('returns medium confidence for moderate responses', () => {
    const profile = createTestThetaProfile();
    profile.responseCounts.alphabetic = 5;
    profile.responseCounts.syllable = 3;
    profile.responseCounts.word = 2;
    const params = createTestG2PIRTParameters();

    const assessment = assessG2PReadiness(profile, params);

    expect(assessment.confidenceLevel).toBe('medium');
  });

  it('returns high confidence for many responses', () => {
    const profile = createTestThetaProfile();
    profile.responseCounts.alphabetic = 10;
    profile.responseCounts.syllable = 5;
    profile.responseCounts.word = 5;
    const params = createTestG2PIRTParameters();

    const assessment = assessG2PReadiness(profile, params);

    expect(assessment.confidenceLevel).toBe('high');
  });
});

// ============================================================================
// Batch Update Tests
// ============================================================================

describe('batchUpdateG2PThetaProfile', () => {
  it('applies multiple updates sequentially', () => {
    const profile = createInitialG2PThetaProfile('user-1');
    const responses: G2PResponse[] = [
      {
        itemId: 'item-1',
        correct: true,
        responseTimeMs: 1500,
        context: createTestTaskContext({ modality: 'reading' }),
        itemParams: createTestG2PIRTParameters(),
      },
      {
        itemId: 'item-2',
        correct: true,
        responseTimeMs: 1500,
        context: createTestTaskContext({ modality: 'reading' }),
        itemParams: createTestG2PIRTParameters(),
      },
    ];

    const updated = batchUpdateG2PThetaProfile(profile, responses);

    expect(updated.responseCounts.reading).toBe(2);
    expect(updated.thetaReading).toBeGreaterThan(profile.thetaReading);
  });
});

// ============================================================================
// Information Gain Tests
// ============================================================================

describe('expectedInformationGain', () => {
  it('returns higher information for matched difficulty', () => {
    const profile = createTestThetaProfile({ thetaPhonological: 0 });
    const matchedItem = createTestG2PIRTParameters({ baseDifficulty: 0 });
    const mismatchedItem = createTestG2PIRTParameters({ baseDifficulty: 3 });
    const context = createTestTaskContext();

    const matchedInfo = expectedInformationGain(profile, matchedItem, context);
    const mismatchedInfo = expectedInformationGain(profile, mismatchedItem, context);

    expect(matchedInfo).toBeGreaterThan(mismatchedInfo);
  });

  it('returns higher information for higher discrimination', () => {
    const profile = createTestThetaProfile({ thetaPhonological: 0 });
    const lowDiscrim = createTestG2PIRTParameters({ discrimination: 0.5 });
    const highDiscrim = createTestG2PIRTParameters({ discrimination: 2.0 });
    const context = createTestTaskContext();

    const lowInfo = expectedInformationGain(profile, lowDiscrim, context);
    const highInfo = expectedInformationGain(profile, highDiscrim, context);

    expect(highInfo).toBeGreaterThan(lowInfo);
  });
});

// ============================================================================
// L1 Pattern Adjustment Tests
// ============================================================================

describe('getL1PatternAdjustment', () => {
  it('returns 0 for unknown L1', () => {
    expect(getL1PatternAdjustment('unknown', 'th_sound')).toBe(0);
  });

  it('returns 0 for unknown pattern', () => {
    expect(getL1PatternAdjustment('korean', 'unknown_pattern')).toBe(0);
  });

  it('returns adjustment for known L1 and pattern', () => {
    expect(getL1PatternAdjustment('korean', 'th_sound')).toBeGreaterThan(0);
    expect(getL1PatternAdjustment('korean', 'r_l_distinction')).toBeGreaterThan(0);
  });

  it('handles case insensitively', () => {
    expect(getL1PatternAdjustment('Korean', 'th_sound')).toBeGreaterThan(0);
    expect(getL1PatternAdjustment('KOREAN', 'th_sound')).toBeGreaterThan(0);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('DEFAULT_CONTEXT_ADJUSTMENTS', () => {
  it('has all modality adjustments', () => {
    expect(DEFAULT_CONTEXT_ADJUSTMENTS.byModality.reading).toBeDefined();
    expect(DEFAULT_CONTEXT_ADJUSTMENTS.byModality.listening).toBeDefined();
    expect(DEFAULT_CONTEXT_ADJUSTMENTS.byModality.speaking).toBeDefined();
    expect(DEFAULT_CONTEXT_ADJUSTMENTS.byModality.writing).toBeDefined();
  });

  it('has speaking as hardest modality', () => {
    const { byModality } = DEFAULT_CONTEXT_ADJUSTMENTS;
    expect(byModality.speaking).toBeGreaterThanOrEqual(byModality.reading);
    expect(byModality.speaking).toBeGreaterThanOrEqual(byModality.listening);
    expect(byModality.speaking).toBeGreaterThanOrEqual(byModality.writing);
  });

  it('has production harder than recognition', () => {
    const { byTaskType } = DEFAULT_CONTEXT_ADJUSTMENTS;
    expect(byTaskType.production).toBeGreaterThan(byTaskType.recognition);
  });

  it('has timed harder than untimed', () => {
    const { byTiming } = DEFAULT_CONTEXT_ADJUSTMENTS;
    expect(byTiming.timed).toBeGreaterThan(byTiming.untimed);
  });
});

describe('L1_DIFFICULTY_ADJUSTMENTS', () => {
  it('includes Korean adjustments', () => {
    expect(L1_DIFFICULTY_ADJUSTMENTS.korean).toBeDefined();
    expect(L1_DIFFICULTY_ADJUSTMENTS.korean.th_sound).toBeGreaterThan(0);
  });

  it('includes Japanese adjustments', () => {
    expect(L1_DIFFICULTY_ADJUSTMENTS.japanese).toBeDefined();
    expect(L1_DIFFICULTY_ADJUSTMENTS.japanese.r_l_distinction).toBeGreaterThan(0);
  });

  it('includes Chinese adjustments', () => {
    expect(L1_DIFFICULTY_ADJUSTMENTS.chinese).toBeDefined();
  });

  it('includes Spanish adjustments', () => {
    expect(L1_DIFFICULTY_ADJUSTMENTS.spanish).toBeDefined();
  });
});
