/**
 * FSRS Module Unit Tests
 *
 * Tests for Free Spaced Repetition Scheduler including
 * scheduling, retrievability, and mastery state management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FSRS,
  createNewCard,
  createInitialMasteryState,
  responseToRating,
  updateMastery,
  determineStage,
  calculateScaffoldingGap,
  determineCueLevel,
  DEFAULT_PARAMETERS,
  STAGE_THRESHOLDS,
} from '../fsrs';
import type { FSRSCard, FSRSRating, ResponseData, MasteryState } from '../fsrs';

describe('FSRS Class', () => {
  let fsrs: FSRS;

  beforeEach(() => {
    fsrs = new FSRS();
  });

  describe('constructor', () => {
    it('uses default parameters when none provided', () => {
      const fsrs = new FSRS();
      expect(fsrs).toBeDefined();
    });

    it('accepts custom parameters', () => {
      const custom = new FSRS({ requestRetention: 0.85 });
      expect(custom).toBeDefined();
    });
  });

  describe('retrievability', () => {
    it('returns 0 for new cards with no review', () => {
      const card = createNewCard();
      const r = fsrs.retrievability(card, new Date());
      expect(r).toBe(0);
    });

    it('returns 1 immediately after review', () => {
      const now = new Date();
      const card: FSRSCard = {
        ...createNewCard(),
        lastReview: now,
        stability: 1,
      };
      const r = fsrs.retrievability(card, now);
      expect(r).toBeCloseTo(1, 5);
    });

    it('decays over time according to stability', () => {
      const now = new Date();
      const oneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const card: FSRSCard = {
        ...createNewCard(),
        lastReview: now,
        stability: 1, // 1 day stability means R = 0.9 after 1 day (by definition)
      };

      const rNow = fsrs.retrievability(card, now);
      const rOneDay = fsrs.retrievability(card, oneDay);

      expect(rNow).toBeGreaterThan(rOneDay);
      expect(rOneDay).toBeLessThan(1);
    });

    it('higher stability means slower decay', () => {
      const now = new Date();
      const tenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      const lowStability: FSRSCard = {
        ...createNewCard(),
        lastReview: now,
        stability: 5,
      };

      const highStability: FSRSCard = {
        ...createNewCard(),
        lastReview: now,
        stability: 30,
      };

      const rLow = fsrs.retrievability(lowStability, tenDays);
      const rHigh = fsrs.retrievability(highStability, tenDays);

      expect(rHigh).toBeGreaterThan(rLow);
    });
  });

  describe('schedule', () => {
    it('initializes stability and difficulty on first review', () => {
      const card = createNewCard();
      const now = new Date();

      const updated = fsrs.schedule(card, 3, now);

      expect(updated.stability).toBeGreaterThan(0);
      expect(updated.difficulty).toBeGreaterThan(0);
      expect(updated.lastReview).toEqual(now);
      expect(updated.reps).toBe(1);
    });

    it('transitions to learning state on Again rating', () => {
      const card = createNewCard();
      const now = new Date();

      const updated = fsrs.schedule(card, 1, now);

      expect(updated.state).toBe('learning');
    });

    it('transitions to review state on Good/Easy rating', () => {
      const card = createNewCard();
      const now = new Date();

      const updated = fsrs.schedule(card, 3, now);
      expect(updated.state).toBe('review');

      const updated2 = fsrs.schedule(card, 4, now);
      expect(updated2.state).toBe('review');
    });

    it('increases stability on correct responses', () => {
      const card = createNewCard();
      const now = new Date();

      let current = fsrs.schedule(card, 3, now);
      const initialStability = current.stability;

      const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      current = fsrs.schedule(current, 3, later);

      expect(current.stability).toBeGreaterThan(initialStability);
    });

    it('decreases stability on lapse (Again)', () => {
      const card: FSRSCard = {
        ...createNewCard(),
        lastReview: new Date(),
        stability: 10,
        difficulty: 5,
        state: 'review',
        reps: 5,
      };

      const now = new Date(card.lastReview!.getTime() + 24 * 60 * 60 * 1000);
      const lapsed = fsrs.schedule(card, 1, now);

      expect(lapsed.stability).toBeLessThan(card.stability);
      expect(lapsed.lapses).toBe(1);
      expect(lapsed.state).toBe('relearning');
    });

    it('increments rep count on each review', () => {
      const card = createNewCard();
      const now = new Date();

      let current = fsrs.schedule(card, 3, now);
      expect(current.reps).toBe(1);

      const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      current = fsrs.schedule(current, 3, later);
      expect(current.reps).toBe(2);
    });
  });

  describe('nextInterval', () => {
    it('returns at least 1 day', () => {
      const interval = fsrs.nextInterval(0.5);
      expect(interval).toBeGreaterThanOrEqual(1);
    });

    it('increases with stability', () => {
      const interval1 = fsrs.nextInterval(5);
      const interval2 = fsrs.nextInterval(30);

      expect(interval2).toBeGreaterThan(interval1);
    });

    it('respects maximum interval', () => {
      const interval = fsrs.nextInterval(100000);
      expect(interval).toBeLessThanOrEqual(DEFAULT_PARAMETERS.maximumInterval);
    });
  });

  describe('nextReviewDate', () => {
    it('returns current date for new cards', () => {
      const card = createNewCard();
      const reviewDate = fsrs.nextReviewDate(card);

      const now = new Date();
      expect(Math.abs(reviewDate.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it('returns future date based on stability', () => {
      const now = new Date();
      const card: FSRSCard = {
        ...createNewCard(),
        lastReview: now,
        stability: 5,
      };

      const reviewDate = fsrs.nextReviewDate(card);
      expect(reviewDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});

describe('Helper Functions', () => {
  describe('createNewCard', () => {
    it('creates card with default values', () => {
      const card = createNewCard();

      expect(card.difficulty).toBe(5);
      expect(card.stability).toBe(0);
      expect(card.lastReview).toBeNull();
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.state).toBe('new');
    });
  });

  describe('createInitialMasteryState', () => {
    it('creates mastery state with stage 0', () => {
      const state = createInitialMasteryState();

      expect(state.stage).toBe(0);
      expect(state.cueFreeAccuracy).toBe(0);
      expect(state.cueAssistedAccuracy).toBe(0);
      expect(state.exposureCount).toBe(0);
      expect(state.fsrsCard).toBeDefined();
    });
  });

  describe('responseToRating', () => {
    it('returns 1 (Again) for incorrect responses', () => {
      const response: ResponseData = {
        correct: false,
        cueLevel: 0,
        responseTimeMs: 2000,
      };

      expect(responseToRating(response)).toBe(1);
    });

    it('returns 2 (Hard) for correct with cues', () => {
      const response: ResponseData = {
        correct: true,
        cueLevel: 1,
        responseTimeMs: 3000,
      };

      expect(responseToRating(response)).toBe(2);
    });

    it('returns 3 (Good) for slow correct without cues', () => {
      const response: ResponseData = {
        correct: true,
        cueLevel: 0,
        responseTimeMs: 6000, // > 5000ms
      };

      expect(responseToRating(response)).toBe(3);
    });

    it('returns 4 (Easy) for fast correct without cues', () => {
      const response: ResponseData = {
        correct: true,
        cueLevel: 0,
        responseTimeMs: 2000, // <= 5000ms
      };

      expect(responseToRating(response)).toBe(4);
    });
  });

  describe('updateMastery', () => {
    it('updates FSRS card state', () => {
      const fsrs = new FSRS();
      const state = createInitialMasteryState();
      const now = new Date();

      const response: ResponseData = {
        correct: true,
        cueLevel: 0,
        responseTimeMs: 2000,
      };

      const updated = updateMastery(state, response, fsrs, now);

      expect(updated.fsrsCard.reps).toBe(1);
      expect(updated.fsrsCard.lastReview).toEqual(now);
      expect(updated.exposureCount).toBe(1);
    });

    it('tracks cue-free accuracy separately', () => {
      const fsrs = new FSRS();
      const state = createInitialMasteryState();
      const now = new Date();

      const cueFree: ResponseData = {
        correct: true,
        cueLevel: 0,
        responseTimeMs: 2000,
      };

      const updated = updateMastery(state, cueFree, fsrs, now);
      expect(updated.cueFreeAccuracy).toBeGreaterThan(0);
    });

    it('tracks cue-assisted accuracy separately', () => {
      const fsrs = new FSRS();
      const state = createInitialMasteryState();
      const now = new Date();

      const cueAssisted: ResponseData = {
        correct: true,
        cueLevel: 2,
        responseTimeMs: 3000,
      };

      const updated = updateMastery(state, cueAssisted, fsrs, now);
      expect(updated.cueAssistedAccuracy).toBeGreaterThan(0);
    });

    it('updates mastery stage', () => {
      const fsrs = new FSRS();
      let state = createInitialMasteryState();
      const now = new Date();

      // Simulate multiple correct responses to advance stage
      for (let i = 0; i < 10; i++) {
        const response: ResponseData = {
          correct: true,
          cueLevel: 0,
          responseTimeMs: 2000,
        };
        state = updateMastery(state, response, fsrs, new Date(now.getTime() + i * 60000));
      }

      // Stage should have advanced from 0
      expect(state.stage).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Mastery Stage Determination', () => {
  describe('determineStage', () => {
    it('returns 0 for no exposures', () => {
      const state: MasteryState = {
        stage: 0,
        fsrsCard: createNewCard(),
        cueFreeAccuracy: 0,
        cueAssistedAccuracy: 0,
        exposureCount: 0,
      };

      expect(determineStage(state)).toBe(0);
    });

    it('returns stage 1 for cue-assisted accuracy >= 0.5', () => {
      const state: MasteryState = {
        stage: 0,
        fsrsCard: { ...createNewCard(), stability: 1 },
        cueFreeAccuracy: 0.3,
        cueAssistedAccuracy: 0.5,
        exposureCount: 5,
      };

      expect(determineStage(state)).toBe(1);
    });

    it('returns stage 2 for cue-free accuracy >= 0.6', () => {
      const state: MasteryState = {
        stage: 0,
        fsrsCard: { ...createNewCard(), stability: 3 },
        cueFreeAccuracy: 0.65,
        cueAssistedAccuracy: 0.7,
        exposureCount: 10,
      };

      expect(determineStage(state)).toBe(2);
    });

    it('returns stage 3 for cue-free >= 0.75 and stability > 7', () => {
      const state: MasteryState = {
        stage: 0,
        fsrsCard: { ...createNewCard(), stability: 10 },
        cueFreeAccuracy: 0.8,
        cueAssistedAccuracy: 0.85,
        exposureCount: 20,
      };

      expect(determineStage(state)).toBe(3);
    });

    it('returns stage 4 for cue-free >= 0.9, stability > 30, minimal gap', () => {
      const state: MasteryState = {
        stage: 0,
        fsrsCard: { ...createNewCard(), stability: 35 },
        cueFreeAccuracy: 0.95,
        cueAssistedAccuracy: 0.97, // Gap < 0.1
        exposureCount: 50,
      };

      expect(determineStage(state)).toBe(4);
    });
  });

  describe('calculateScaffoldingGap', () => {
    it('returns difference between assisted and free accuracy', () => {
      const state: MasteryState = {
        stage: 1,
        fsrsCard: createNewCard(),
        cueFreeAccuracy: 0.5,
        cueAssistedAccuracy: 0.8,
        exposureCount: 10,
      };

      expect(calculateScaffoldingGap(state)).toBeCloseTo(0.3, 5);
    });

    it('returns 0 when free accuracy exceeds assisted', () => {
      const state: MasteryState = {
        stage: 2,
        fsrsCard: createNewCard(),
        cueFreeAccuracy: 0.9,
        cueAssistedAccuracy: 0.85,
        exposureCount: 10,
      };

      expect(calculateScaffoldingGap(state)).toBe(0);
    });
  });

  describe('determineCueLevel', () => {
    it('returns 0 (no cues) for minimal gap and enough attempts', () => {
      const state: MasteryState = {
        stage: 3,
        fsrsCard: createNewCard(),
        cueFreeAccuracy: 0.9,
        cueAssistedAccuracy: 0.92,
        exposureCount: 10,
      };

      expect(determineCueLevel(state)).toBe(0);
    });

    it('returns 3 (full cues) for large gap', () => {
      const state: MasteryState = {
        stage: 1,
        fsrsCard: createNewCard(),
        cueFreeAccuracy: 0.2,
        cueAssistedAccuracy: 0.6,
        exposureCount: 5,
      };

      expect(determineCueLevel(state)).toBe(3);
    });

    it('returns intermediate levels for moderate gaps', () => {
      const state: MasteryState = {
        stage: 2,
        fsrsCard: createNewCard(),
        cueFreeAccuracy: 0.6,
        cueAssistedAccuracy: 0.75,
        exposureCount: 10,
      };

      const level = determineCueLevel(state);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(2);
    });
  });
});
