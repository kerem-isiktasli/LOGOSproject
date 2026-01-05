/**
 * IRT Module Unit Tests
 *
 * Tests for Item Response Theory algorithms including
 * probability models, theta estimation, and item selection.
 */

import { describe, it, expect } from 'vitest';
import {
  probability1PL,
  probability2PL,
  probability3PL,
  estimateThetaMLE,
  estimateThetaEAP,
  fisherInformation,
  selectNextItem,
  selectItemKL,
  calibrateItems,
} from '../irt';
import type { ItemParameter } from '../types';

describe('IRT Probability Functions', () => {
  describe('probability1PL (Rasch model)', () => {
    it('returns 0.5 when theta equals difficulty', () => {
      expect(probability1PL(0, 0)).toBeCloseTo(0.5, 5);
      expect(probability1PL(1, 1)).toBeCloseTo(0.5, 5);
      expect(probability1PL(-2, -2)).toBeCloseTo(0.5, 5);
    });

    it('returns higher probability when theta > difficulty', () => {
      const p = probability1PL(2, 0);
      expect(p).toBeGreaterThan(0.5);
      expect(p).toBeCloseTo(0.88, 1);
    });

    it('returns lower probability when theta < difficulty', () => {
      const p = probability1PL(0, 2);
      expect(p).toBeLessThan(0.5);
      expect(p).toBeCloseTo(0.12, 1);
    });

    it('is symmetric around 0.5', () => {
      const p1 = probability1PL(1, 0);
      const p2 = probability1PL(-1, 0);
      expect(p1 + p2).toBeCloseTo(1, 5);
    });

    it('approaches 1 for very high ability', () => {
      expect(probability1PL(5, 0)).toBeGreaterThan(0.99);
    });

    it('approaches 0 for very low ability', () => {
      expect(probability1PL(-5, 0)).toBeLessThan(0.01);
    });
  });

  describe('probability2PL', () => {
    it('returns 0.5 when theta equals difficulty regardless of discrimination', () => {
      expect(probability2PL(0, 1.0, 0)).toBeCloseTo(0.5, 5);
      expect(probability2PL(0, 2.0, 0)).toBeCloseTo(0.5, 5);
      expect(probability2PL(1, 0.5, 1)).toBeCloseTo(0.5, 5);
    });

    it('higher discrimination creates steeper slope', () => {
      // At theta = 1 above difficulty
      const pLowDiscrim = probability2PL(1, 0.5, 0);
      const pHighDiscrim = probability2PL(1, 2.0, 0);

      // Higher discrimination should give probability closer to 1
      expect(pHighDiscrim).toBeGreaterThan(pLowDiscrim);
    });

    it('reduces to 1PL when a=1', () => {
      const p1PL = probability1PL(1, 0);
      const p2PL = probability2PL(1, 1.0, 0);
      expect(p1PL).toBeCloseTo(p2PL, 5);
    });
  });

  describe('probability3PL', () => {
    it('never goes below guessing parameter', () => {
      const c = 0.25; // 4-option MCQ
      const p = probability3PL(-10, 1.0, 0, c);
      expect(p).toBeGreaterThanOrEqual(c);
      expect(p).toBeCloseTo(c, 1);
    });

    it('approaches 1 for high ability', () => {
      const p = probability3PL(5, 1.0, 0, 0.25);
      expect(p).toBeGreaterThan(0.99);
    });

    it('midpoint shifts due to guessing', () => {
      // At theta = b, 3PL gives (1+c)/2
      const c = 0.25;
      const p = probability3PL(0, 1.0, 0, c);
      expect(p).toBeCloseTo((1 + c) / 2, 2);
    });

    it('reduces to 2PL when c=0', () => {
      const p2PL = probability2PL(1, 1.5, 0);
      const p3PL = probability3PL(1, 1.5, 0, 0);
      expect(p2PL).toBeCloseTo(p3PL, 5);
    });
  });
});

describe('Theta Estimation', () => {
  const createTestItems = (): ItemParameter[] => [
    { id: '1', a: 1.0, b: -2.0 },
    { id: '2', a: 1.0, b: -1.0 },
    { id: '3', a: 1.0, b: 0.0 },
    { id: '4', a: 1.0, b: 1.0 },
    { id: '5', a: 1.0, b: 2.0 },
  ];

  describe('estimateThetaMLE', () => {
    it('estimates positive theta for mostly correct responses', () => {
      const items = createTestItems();
      const responses = [true, true, true, true, false];
      const result = estimateThetaMLE(responses, items);

      expect(result.theta).toBeGreaterThan(0);
      expect(result.se).toBeGreaterThan(0);
      expect(result.se).toBeLessThan(2);
    });

    it('estimates negative theta for mostly incorrect responses', () => {
      const items = createTestItems();
      const responses = [false, false, true, false, false];
      const result = estimateThetaMLE(responses, items);

      expect(result.theta).toBeLessThan(0);
    });

    it('estimates theta near 0 for mixed responses on calibrated items', () => {
      const items = createTestItems();
      const responses = [true, true, true, false, false];
      const result = estimateThetaMLE(responses, items);

      // Should be near 0 since these are balanced difficulty items
      expect(Math.abs(result.theta)).toBeLessThan(1);
    });

    it('provides standard error', () => {
      const items = createTestItems();
      const responses = [true, true, false, false, false];
      const result = estimateThetaMLE(responses, items);

      expect(result.se).toBeDefined();
      expect(result.se).toBeGreaterThan(0);
    });
  });

  describe('estimateThetaEAP', () => {
    it('provides stable estimate for all-correct patterns', () => {
      const items = createTestItems();
      const responses = [true, true, true, true, true];
      const result = estimateThetaEAP(responses, items);

      // EAP should not diverge like MLE might
      expect(result.theta).toBeDefined();
      expect(result.theta).toBeLessThan(5);
      expect(result.se).toBeGreaterThan(0);
    });

    it('provides stable estimate for all-incorrect patterns', () => {
      const items = createTestItems();
      const responses = [false, false, false, false, false];
      const result = estimateThetaEAP(responses, items);

      expect(result.theta).toBeDefined();
      expect(result.theta).toBeGreaterThan(-5);
    });

    it('incorporates prior distribution', () => {
      const items = createTestItems();
      const responses = [true, true, true, true, true];

      // Strong negative prior should pull estimate down
      const resultNegPrior = estimateThetaEAP(responses, items, -2, 0.5);
      const resultPosPrior = estimateThetaEAP(responses, items, 2, 0.5);

      expect(resultNegPrior.theta).toBeLessThan(resultPosPrior.theta);
    });

    it('narrows uncertainty with more response data', () => {
      const items: ItemParameter[] = [
        { id: '1', a: 1.0, b: 0.0 },
        { id: '2', a: 1.0, b: 0.5 },
      ];
      const fewResponses = [true, false];

      const manyItems: ItemParameter[] = Array(10)
        .fill(null)
        .map((_, i) => ({ id: String(i), a: 1.0, b: i * 0.5 - 2 }));
      const manyResponses = [true, true, true, true, true, false, false, false, false, false];

      const resultFew = estimateThetaEAP(fewResponses, items);
      const resultMany = estimateThetaEAP(manyResponses, manyItems);

      expect(resultMany.se).toBeLessThan(resultFew.se);
    });
  });
});

describe('Fisher Information', () => {
  describe('fisherInformation', () => {
    it('is maximized when theta equals difficulty', () => {
      const a = 1.0;
      const b = 0.0;

      // Information at theta = b
      const infoAtB = fisherInformation(0, a, b);

      // Information away from b
      const infoAway1 = fisherInformation(2, a, b);
      const infoAway2 = fisherInformation(-2, a, b);

      expect(infoAtB).toBeGreaterThan(infoAway1);
      expect(infoAtB).toBeGreaterThan(infoAway2);
    });

    it('increases with discrimination squared', () => {
      const info1 = fisherInformation(0, 1.0, 0);
      const info2 = fisherInformation(0, 2.0, 0);

      // With a doubled, info should quadruple (since info = a^2 * p * q)
      expect(info2).toBeCloseTo(info1 * 4, 5);
    });

    it('is symmetric around difficulty', () => {
      const b = 1.0;
      const a = 1.0;

      const infoAbove = fisherInformation(b + 1, a, b);
      const infoBelow = fisherInformation(b - 1, a, b);

      expect(infoAbove).toBeCloseTo(infoBelow, 5);
    });

    it('is always non-negative', () => {
      for (let theta = -3; theta <= 3; theta += 0.5) {
        expect(fisherInformation(theta, 1.0, 0)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('Item Selection', () => {
  describe('selectNextItem', () => {
    it('selects item with difficulty closest to theta', () => {
      const items: ItemParameter[] = [
        { id: 'easy', a: 1.0, b: -2.0 },
        { id: 'medium', a: 1.0, b: 0.0 },
        { id: 'hard', a: 1.0, b: 2.0 },
      ];

      // At theta = 0, medium item has highest info
      const selected = selectNextItem(0, items, new Set());
      expect(selected?.id).toBe('medium');

      // At theta = -2, easy item has highest info
      const selectedLow = selectNextItem(-2, items, new Set());
      expect(selectedLow?.id).toBe('easy');
    });

    it('excludes already used items', () => {
      const items: ItemParameter[] = [
        { id: '1', a: 1.0, b: 0.0 },
        { id: '2', a: 1.0, b: 0.5 },
      ];

      const selected = selectNextItem(0, items, new Set(['1']));
      expect(selected?.id).toBe('2');
    });

    it('returns null when all items used', () => {
      const items: ItemParameter[] = [{ id: '1', a: 1.0, b: 0.0 }];

      const selected = selectNextItem(0, items, new Set(['1']));
      expect(selected).toBeNull();
    });

    it('prefers high discrimination items when equally matched', () => {
      const items: ItemParameter[] = [
        { id: 'low', a: 0.5, b: 0.0 },
        { id: 'high', a: 2.0, b: 0.0 },
      ];

      const selected = selectNextItem(0, items, new Set());
      expect(selected?.id).toBe('high');
    });
  });

  describe('selectItemKL', () => {
    it('selects an item from available pool', () => {
      const items: ItemParameter[] = [
        { id: '1', a: 1.0, b: -1.0 },
        { id: '2', a: 1.0, b: 0.0 },
        { id: '3', a: 1.0, b: 1.0 },
      ];

      const selected = selectItemKL(0, 0.5, items);
      expect(selected).not.toBeNull();
      expect(items.map(i => i.id)).toContain(selected?.id);
    });

    it('accounts for uncertainty in theta estimate', () => {
      const items: ItemParameter[] = [
        { id: 'precise', a: 2.0, b: 0.0 },
        { id: 'broad', a: 0.5, b: 0.0 },
      ];

      // With high uncertainty, might prefer less discriminating item
      // This tests that the function runs and returns valid item
      const selected = selectItemKL(0, 2.0, items);
      expect(selected).not.toBeNull();
    });
  });
});

describe('Item Calibration', () => {
  describe('calibrateItems', () => {
    it('returns empty array for empty input', () => {
      const result = calibrateItems([]);
      expect(result).toEqual([]);
    });

    it('calibrates items from response matrix', () => {
      // 5 people, 3 items with different difficulties
      const responses = [
        [true, true, false], // High ability
        [true, false, false], // Medium-high
        [true, false, false], // Medium
        [false, false, false], // Low
        [true, true, true], // Very high
      ];

      const result = calibrateItems(responses, 20);

      expect(result).toHaveLength(3);

      // Each calibrated item should have required properties
      for (const item of result) {
        expect(item.a).toBeGreaterThan(0);
        expect(item.a).toBeLessThanOrEqual(3);
        expect(item.b).toBeGreaterThanOrEqual(-4);
        expect(item.b).toBeLessThanOrEqual(4);
        expect(item.se_a).toBeDefined();
        expect(item.se_b).toBeDefined();
      }
    });

    it('estimates easier items as having lower difficulty', () => {
      // Item 1: everyone gets right (easy)
      // Item 2: half get right (medium)
      // Item 3: few get right (hard)
      const responses = [
        [true, true, false],
        [true, true, false],
        [true, false, false],
        [true, false, false],
        [true, false, false],
      ];

      const result = calibrateItems(responses, 30);

      // First item should have lowest difficulty
      expect(result[0].b).toBeLessThan(result[2].b);
    });
  });
});
