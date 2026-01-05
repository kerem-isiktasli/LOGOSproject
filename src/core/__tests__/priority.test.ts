/**
 * Priority Module Unit Tests
 *
 * Tests for FRE-based priority calculation, urgency computation,
 * and learning queue building.
 */

import { describe, it, expect } from 'vitest';
import {
  computeFRE,
  computeCost,
  estimateCostFactors,
  computePriority,
  computeUrgency,
  computeFinalScore,
  sortByPriority,
  getTopPriorityItems,
  buildLearningQueue,
  getSessionItems,
  getWeightsForLevel,
  inferLevel,
  DEFAULT_PRIORITY_WEIGHTS,
  LEVEL_WEIGHT_ADJUSTMENTS,
} from '../priority';
import type { LanguageObject, UserState, MasteryInfo, PriorityWeights } from '../priority';

describe('FRE Computation', () => {
  describe('computeFRE', () => {
    it('computes weighted sum of F, R, E', () => {
      const metrics = {
        frequency: 0.8,
        relationalDensity: 0.6,
        contextualContribution: 0.4,
      };

      const weights: PriorityWeights = { f: 0.4, r: 0.3, e: 0.3 };
      const fre = computeFRE(metrics, weights);

      const expected = 0.4 * 0.8 + 0.3 * 0.6 + 0.3 * 0.4;
      expect(fre).toBeCloseTo(expected, 5);
    });

    it('uses default weights when not provided', () => {
      const metrics = {
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
      };

      const fre = computeFRE(metrics);
      expect(fre).toBeCloseTo(0.5, 5);
    });

    it('returns 0 for zero metrics', () => {
      const metrics = {
        frequency: 0,
        relationalDensity: 0,
        contextualContribution: 0,
      };

      expect(computeFRE(metrics)).toBe(0);
    });

    it('returns 1 for max metrics', () => {
      const metrics = {
        frequency: 1,
        relationalDensity: 1,
        contextualContribution: 1,
      };

      expect(computeFRE(metrics)).toBeCloseTo(1, 5);
    });
  });
});

describe('Cost Computation', () => {
  describe('computeCost', () => {
    it('combines cost factors', () => {
      const factors = {
        baseDifficulty: 0.5,
        transferGain: 0.1,
        exposureNeed: 0.3,
      };

      const cost = computeCost(factors);
      expect(cost).toBeCloseTo(0.7, 5); // 0.5 - 0.1 + 0.3
    });

    it('enforces minimum cost of 0.1', () => {
      const factors = {
        baseDifficulty: 0.1,
        transferGain: 0.5, // High transfer gain
        exposureNeed: 0,
      };

      const cost = computeCost(factors);
      expect(cost).toBeGreaterThanOrEqual(0.1);
    });

    it('transfer gain reduces cost', () => {
      const withTransfer = computeCost({
        baseDifficulty: 0.5,
        transferGain: 0.2,
        exposureNeed: 0.2,
      });

      const withoutTransfer = computeCost({
        baseDifficulty: 0.5,
        transferGain: 0,
        exposureNeed: 0.2,
      });

      expect(withTransfer).toBeLessThan(withoutTransfer);
    });
  });

  describe('estimateCostFactors', () => {
    it('normalizes IRT difficulty to 0-1 range', () => {
      const easyObject: LanguageObject = {
        id: '1',
        content: 'easy',
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: -3, // Very easy
      };

      const hardObject: LanguageObject = {
        id: '2',
        content: 'hard',
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 3, // Very hard
      };

      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const easyFactors = estimateCostFactors(easyObject, userState);
      const hardFactors = estimateCostFactors(hardObject, userState);

      expect(easyFactors.baseDifficulty).toBeLessThan(hardFactors.baseDifficulty);
      expect(easyFactors.baseDifficulty).toBeGreaterThanOrEqual(0);
      expect(hardFactors.baseDifficulty).toBeLessThanOrEqual(1);
    });

    it('includes transfer gain for L1 speakers', () => {
      const object: LanguageObject = {
        id: '1',
        content: 'test',
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 0,
      };

      const withL1: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
        l1Language: 'Spanish',
      };

      const withoutL1: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const factorsWithL1 = estimateCostFactors(object, withL1);
      const factorsWithoutL1 = estimateCostFactors(object, withoutL1);

      expect(factorsWithL1.transferGain).toBeGreaterThan(factorsWithoutL1.transferGain);
    });

    it('estimates exposure need based on ability gap', () => {
      const hardObject: LanguageObject = {
        id: '1',
        content: 'hard',
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 2, // Above average
      };

      const lowAbility: UserState = {
        theta: -1,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const highAbility: UserState = {
        theta: 3,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const lowFactors = estimateCostFactors(hardObject, lowAbility);
      const highFactors = estimateCostFactors(hardObject, highAbility);

      expect(lowFactors.exposureNeed).toBeGreaterThan(highFactors.exposureNeed);
    });
  });
});

describe('Priority Computation', () => {
  describe('computePriority', () => {
    it('returns FRE/Cost ratio', () => {
      const object: LanguageObject = {
        id: '1',
        content: 'test',
        type: 'word',
        frequency: 0.8,
        relationalDensity: 0.6,
        contextualContribution: 0.5,
        irtDifficulty: 0,
      };

      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const priority = computePriority(object, userState);
      expect(priority).toBeGreaterThan(0);
    });

    it('high frequency items have higher priority', () => {
      const highFreq: LanguageObject = {
        id: '1',
        content: 'common',
        type: 'word',
        frequency: 0.9,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 0,
      };

      const lowFreq: LanguageObject = {
        id: '2',
        content: 'rare',
        type: 'word',
        frequency: 0.1,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 0,
      };

      const userState: UserState = {
        theta: 0,
        weights: { f: 0.5, r: 0.25, e: 0.25 }, // Emphasize frequency
      };

      const priorityHigh = computePriority(highFreq, userState);
      const priorityLow = computePriority(lowFreq, userState);

      expect(priorityHigh).toBeGreaterThan(priorityLow);
    });

    it('easy items have higher priority for beginners', () => {
      const easyItem: LanguageObject = {
        id: '1',
        content: 'easy',
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: -2,
      };

      const hardItem: LanguageObject = {
        id: '2',
        content: 'hard',
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 2,
      };

      const beginner: UserState = {
        theta: -2,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const priorityEasy = computePriority(easyItem, beginner);
      const priorityHard = computePriority(hardItem, beginner);

      expect(priorityEasy).toBeGreaterThan(priorityHard);
    });
  });
});

describe('Urgency Computation', () => {
  describe('computeUrgency', () => {
    it('returns 1.5 for new items (no review date)', () => {
      const urgency = computeUrgency(null, new Date());
      expect(urgency).toBe(1.5);
    });

    it('returns 0 for items not yet due', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week ahead

      const urgency = computeUrgency(future, now);
      expect(urgency).toBe(0);
    });

    it('returns 1 for items due today', () => {
      const now = new Date();
      const urgency = computeUrgency(now, now);
      expect(urgency).toBeCloseTo(1, 1);
    });

    it('increases for overdue items', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const urgencyOne = computeUrgency(oneDayAgo, now);
      const urgencyThree = computeUrgency(threeDaysAgo, now);

      expect(urgencyThree).toBeGreaterThan(urgencyOne);
      expect(urgencyOne).toBeGreaterThan(1);
    });

    it('caps at 3', () => {
      const now = new Date();
      const wayOverdue = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

      const urgency = computeUrgency(wayOverdue, now);
      expect(urgency).toBeLessThanOrEqual(3);
    });
  });

  describe('computeFinalScore', () => {
    it('multiplies priority by (1 + urgency)', () => {
      const priority = 0.5;
      const urgency = 1.0;

      const score = computeFinalScore(priority, urgency);
      expect(score).toBeCloseTo(priority * 2, 5);
    });

    it('returns priority when urgency is 0', () => {
      const priority = 0.8;
      const score = computeFinalScore(priority, 0);
      expect(score).toBeCloseTo(priority, 5);
    });
  });
});

describe('Queue Building', () => {
  const createTestObjects = (): LanguageObject[] => [
    {
      id: '1',
      content: 'high-freq',
      type: 'word',
      frequency: 0.9,
      relationalDensity: 0.5,
      contextualContribution: 0.5,
      irtDifficulty: 0,
    },
    {
      id: '2',
      content: 'low-freq',
      type: 'word',
      frequency: 0.2,
      relationalDensity: 0.5,
      contextualContribution: 0.5,
      irtDifficulty: 0,
    },
    {
      id: '3',
      content: 'easy',
      type: 'word',
      frequency: 0.5,
      relationalDensity: 0.5,
      contextualContribution: 0.5,
      irtDifficulty: -2,
    },
  ];

  describe('sortByPriority', () => {
    it('sorts objects by priority descending', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const sorted = sortByPriority(objects, userState);

      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = computePriority(sorted[i], userState);
        const p2 = computePriority(sorted[i + 1], userState);
        expect(p1).toBeGreaterThanOrEqual(p2);
      }
    });

    it('does not mutate original array', () => {
      const objects = createTestObjects();
      const originalIds = objects.map(o => o.id);
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      sortByPriority(objects, userState);

      expect(objects.map(o => o.id)).toEqual(originalIds);
    });
  });

  describe('getTopPriorityItems', () => {
    it('returns top N items by priority', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const top2 = getTopPriorityItems(objects, userState, 2);
      expect(top2).toHaveLength(2);

      // Verify they are the highest priority ones
      const sorted = sortByPriority(objects, userState);
      expect(top2[0].id).toBe(sorted[0].id);
      expect(top2[1].id).toBe(sorted[1].id);
    });

    it('returns all items if count exceeds array length', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const all = getTopPriorityItems(objects, userState, 100);
      expect(all).toHaveLength(objects.length);
    });
  });

  describe('buildLearningQueue', () => {
    it('creates queue items with all required fields', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };
      const masteryMap = new Map<string, MasteryInfo>();
      const now = new Date();

      const queue = buildLearningQueue(objects, userState, masteryMap, now);

      expect(queue).toHaveLength(objects.length);
      for (const item of queue) {
        expect(item.object).toBeDefined();
        expect(item.priority).toBeDefined();
        expect(item.urgency).toBeDefined();
        expect(item.finalScore).toBeDefined();
      }
    });

    it('sorts by finalScore descending', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };
      const masteryMap = new Map<string, MasteryInfo>();
      const now = new Date();

      const queue = buildLearningQueue(objects, userState, masteryMap, now);

      for (let i = 0; i < queue.length - 1; i++) {
        expect(queue[i].finalScore).toBeGreaterThanOrEqual(queue[i + 1].finalScore);
      }
    });

    it('incorporates mastery urgency', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      // Make low-freq item overdue
      const masteryMap = new Map<string, MasteryInfo>([
        ['2', { stage: 2, nextReview: overdueDate, cueFreeAccuracy: 0.7 }],
      ]);

      const queue = buildLearningQueue(objects, userState, masteryMap, now);

      // Overdue item should have high urgency and be boosted
      const item2 = queue.find(q => q.object.id === '2');
      expect(item2?.urgency).toBeGreaterThan(1);
    });
  });

  describe('getSessionItems', () => {
    it('balances due items and new items', () => {
      const objects = createTestObjects();
      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      const masteryMap = new Map<string, MasteryInfo>([
        ['1', { stage: 2, nextReview: overdueDate, cueFreeAccuracy: 0.6 }], // Due
        // Others have no mastery (new)
      ]);

      const queue = buildLearningQueue(objects, userState, masteryMap, now);
      const session = getSessionItems(queue, 10, 0.3);

      expect(session.length).toBeLessThanOrEqual(10);
    });

    it('respects session size limit', () => {
      const objects = Array(20).fill(null).map((_, i) => ({
        id: String(i),
        content: `word${i}`,
        type: 'word',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 0,
      }));

      const userState: UserState = {
        theta: 0,
        weights: DEFAULT_PRIORITY_WEIGHTS,
      };

      const queue = buildLearningQueue(objects, userState, new Map(), new Date());
      const session = getSessionItems(queue, 10, 0.3);

      expect(session.length).toBeLessThanOrEqual(10);
    });
  });
});

describe('Weight Adjustment', () => {
  describe('getWeightsForLevel', () => {
    it('returns beginner weights for beginner level', () => {
      const weights = getWeightsForLevel('beginner');
      expect(weights).toEqual(LEVEL_WEIGHT_ADJUSTMENTS.beginner);
      expect(weights.f).toBeGreaterThan(weights.r);
    });

    it('returns balanced weights for intermediate', () => {
      const weights = getWeightsForLevel('intermediate');
      expect(weights).toEqual(LEVEL_WEIGHT_ADJUSTMENTS.intermediate);
    });

    it('returns advanced weights emphasizing context', () => {
      const weights = getWeightsForLevel('advanced');
      expect(weights).toEqual(LEVEL_WEIGHT_ADJUSTMENTS.advanced);
      expect(weights.e).toBeGreaterThanOrEqual(weights.f);
    });
  });

  describe('inferLevel', () => {
    it('returns beginner for theta < -1', () => {
      expect(inferLevel(-2)).toBe('beginner');
      expect(inferLevel(-1.5)).toBe('beginner');
    });

    it('returns intermediate for -1 <= theta < 1', () => {
      expect(inferLevel(-1)).toBe('intermediate');
      expect(inferLevel(0)).toBe('intermediate');
      expect(inferLevel(0.9)).toBe('intermediate');
    });

    it('returns advanced for theta >= 1', () => {
      expect(inferLevel(1)).toBe('advanced');
      expect(inferLevel(2)).toBe('advanced');
    });
  });
});
