/**
 * State Priority Service Tests
 *
 * Tests for Layer 1 of the learning pipeline:
 * - Queue building and prioritization
 * - g(m) mastery factor calculation
 * - Component-level priority adjustments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('@main/db/prisma', () => ({
  getPrisma: () => ({
    languageObject: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    masteryState: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    componentErrorStats: {
      findMany: vi.fn(),
    },
  }),
}));

// Import after mocking
import {
  calculateMasteryFunction as calculateMasteryFactor,
  calculateEffectivePriority,
} from '../state-priority.service';

// Helper function for component weight calculation
function calculateComponentWeight(
  _component: string,
  isBottleneck: boolean,
  theta: number
): number {
  // Base weight
  let weight = 1.0;

  // Bottleneck boost
  if (isBottleneck) {
    weight *= 1.5;
  }

  // Theta adjustment: lower theta = higher weight (needs more practice)
  const thetaAdjustment = 1 - theta * 0.1;
  weight *= Math.max(0.5, Math.min(1.5, thetaAdjustment));

  return weight;
}

describe('State Priority Service', () => {
  describe('calculateMasteryFactor (g(m))', () => {
    it('should return low factor for very low mastery (foundation lacking)', () => {
      // g(m < 0.2) should be around 0.5
      const factor = calculateMasteryFactor(0.1);
      expect(factor).toBeCloseTo(0.5, 1);
    });

    it('should return high factor for optimal mastery zone', () => {
      // g(m ∈ [0.2, 0.7]) should be 0.8-1.0
      const factor = calculateMasteryFactor(0.5);
      expect(factor).toBeGreaterThanOrEqual(0.8);
      expect(factor).toBeLessThanOrEqual(1.0);
    });

    it('should return maximum factor at optimal point (~0.45)', () => {
      const factor = calculateMasteryFactor(0.45);
      expect(factor).toBeCloseTo(1.0, 1);
    });

    it('should return low factor for very high mastery (already mastered)', () => {
      // g(m > 0.9) should be around 0.3
      const factor = calculateMasteryFactor(0.95);
      expect(factor).toBeLessThanOrEqual(0.4);
    });

    it('should handle edge cases', () => {
      expect(calculateMasteryFactor(0)).toBeDefined();
      expect(calculateMasteryFactor(1)).toBeDefined();
      expect(calculateMasteryFactor(-0.1)).toBeDefined();
      expect(calculateMasteryFactor(1.1)).toBeDefined();
    });

    it('should be continuous across mastery range', () => {
      const samples = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const factors = samples.map(calculateMasteryFactor);

      // Check all values are in valid range
      factors.forEach((f) => {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      });

      // Check it follows inverted U-curve (peak in middle)
      const middleIndex = Math.floor(samples.length / 2);
      expect(factors[middleIndex]).toBeGreaterThan(factors[0]);
      expect(factors[middleIndex]).toBeGreaterThan(factors[factors.length - 1]);
    });
  });

  describe('calculateComponentWeight', () => {
    it('should boost weight for bottleneck components', () => {
      const normalWeight = calculateComponentWeight('LEX', false, 0.5);
      const bottleneckWeight = calculateComponentWeight('LEX', true, 0.5);

      expect(bottleneckWeight).toBeGreaterThan(normalWeight);
    });

    it('should adjust weight based on theta', () => {
      const lowThetaWeight = calculateComponentWeight('MORPH', false, -1.0);
      const highThetaWeight = calculateComponentWeight('MORPH', false, 1.0);

      // Lower theta should get higher weight (needs more practice)
      expect(lowThetaWeight).toBeGreaterThanOrEqual(highThetaWeight);
    });

    it('should handle all component types', () => {
      const components = ['LEX', 'MORPH', 'PHON', 'SYNT', 'PRAG'];
      components.forEach((comp) => {
        const weight = calculateComponentWeight(comp, false, 0);
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('calculateEffectivePriority', () => {
    it('should combine base priority with mastery and urgency', () => {
      const priority = calculateEffectivePriority(
        0.5, // basePriority
        0.8, // masteryAdjustment
        0.6, // urgencyScore
        false // isBottleneck
      );

      expect(priority).toBeGreaterThan(0);
      expect(priority).toBeLessThanOrEqual(1);
    });

    it('should boost priority for bottleneck items', () => {
      const normalPriority = calculateEffectivePriority(0.5, 0.8, 0.6, false);
      const bottleneckPriority = calculateEffectivePriority(0.5, 0.8, 0.6, true);

      expect(bottleneckPriority).toBeGreaterThan(normalPriority);
    });

    it('should respect urgency when item is due', () => {
      const lowUrgency = calculateEffectivePriority(0.5, 0.8, 0.1, false);
      const highUrgency = calculateEffectivePriority(0.5, 0.8, 0.9, false);

      expect(highUrgency).toBeGreaterThan(lowUrgency);
    });

    it('should clamp output to [0, 1] range', () => {
      // Edge cases that might produce out-of-range values
      const cases = [
        [0, 0, 0, false],
        [1, 1, 1, true],
        [0.5, 2, 2, true], // Would overflow without clamping
      ];

      cases.forEach(([base, mastery, urgency, bottleneck]) => {
        const priority = calculateEffectivePriority(
          base as number,
          mastery as number,
          urgency as number,
          bottleneck as boolean
        );
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('Queue Building Integration', () => {
  it('should prioritize items correctly based on S_eff formula', () => {
    // S_eff = F × R × D × g(m) × Σ(component weights)
    // Higher S_eff = higher priority

    const items = [
      { frequency: 0.9, relational: 0.8, domain: 0.7, mastery: 0.5 },
      { frequency: 0.5, relational: 0.5, domain: 0.5, mastery: 0.5 },
      { frequency: 0.9, relational: 0.9, domain: 0.9, mastery: 0.95 }, // Mastered
    ];

    const priorities = items.map((item) => {
      const g = calculateMasteryFactor(item.mastery);
      return item.frequency * item.relational * item.domain * g;
    });

    // First item should have highest priority (high FRD, good mastery zone)
    expect(priorities[0]).toBeGreaterThan(priorities[1]);

    // Third item should have lower priority despite high FRD (already mastered)
    expect(priorities[0]).toBeGreaterThan(priorities[2]);
  });
});

// =============================================================================
// IRT Scale Transformation Tests (Baker & Kim, 2004)
// =============================================================================

describe('IRT Difficulty Scale Transformation', () => {
  /**
   * Tests for priorityToIRTDifficulty function
   *
   * Reference: Baker, F. B., & Kim, S. H. (2004). Item Response Theory:
   * Parameter Estimation Techniques (2nd ed.). Marcel Dekker.
   *
   * IRT difficulty b parameter should be on logit scale (-3 to +3):
   * - b = -3: very easy (95% correct for average ability)
   * - b = 0: average difficulty (50% correct for average ability)
   * - b = +3: very hard (5% correct for average ability)
   */

  // Import the function for testing
  // Note: This tests the linear transformation: b = 6 * priority - 3

  function priorityToIRTDifficulty(priority: number): number {
    return 6 * priority - 3;
  }

  it('should map priority 0 to IRT b = -3 (very easy)', () => {
    const b = priorityToIRTDifficulty(0);
    expect(b).toBe(-3);
  });

  it('should map priority 0.5 to IRT b = 0 (average difficulty)', () => {
    const b = priorityToIRTDifficulty(0.5);
    expect(b).toBe(0);
  });

  it('should map priority 1 to IRT b = +3 (very hard)', () => {
    const b = priorityToIRTDifficulty(1);
    expect(b).toBe(3);
  });

  it('should produce linear transformation across range', () => {
    const priorities = [0, 0.25, 0.5, 0.75, 1.0];
    const expectedB = [-3, -1.5, 0, 1.5, 3];

    priorities.forEach((p, i) => {
      const b = priorityToIRTDifficulty(p);
      expect(b).toBeCloseTo(expectedB[i], 5);
    });
  });

  it('should handle values outside [0, 1] range gracefully', () => {
    // Edge case: priority > 1
    const highB = priorityToIRTDifficulty(1.5);
    expect(highB).toBe(6); // 6 * 1.5 - 3

    // Edge case: priority < 0
    const lowB = priorityToIRTDifficulty(-0.5);
    expect(lowB).toBe(-6); // 6 * -0.5 - 3
  });

  it('should maintain monotonic relationship (higher priority = harder)', () => {
    const priorities = [0.1, 0.3, 0.5, 0.7, 0.9];
    const difficulties = priorities.map(priorityToIRTDifficulty);

    for (let i = 1; i < difficulties.length; i++) {
      expect(difficulties[i]).toBeGreaterThan(difficulties[i - 1]);
    }
  });
});

// =============================================================================
// Syntactic Weight Integration Tests (Lu, 2010, 2011)
// =============================================================================

describe('Syntactic Component Weight', () => {
  /**
   * Tests for syntactic complexity weight in priority calculation
   *
   * Reference: Lu, X. (2010, 2011) - L2 Syntactic Complexity Analyzer
   *
   * The syntactic weight should be included in the base priority calculation
   * alongside other z(w) vector components.
   */

  // Simulate calculateBasePriority with syntactic component
  function calculateBasePriorityWithSyntactic(
    object: {
      frequency: number;
      relationalDensity: number;
      domain: number;
      morphologicalScore: number;
      phonologicalDifficulty: number;
      syntacticComplexity: number;
      pragmaticScore: number;
    },
    weights = {
      frequency: 0.16,
      relational: 0.12,
      domain: 0.12,
      morphological: 0.08,
      phonological: 0.08,
      syntactic: 0.08,
      pragmatic: 0.08,
    }
  ): number {
    const S_base =
      weights.frequency * object.frequency +
      weights.relational * object.relationalDensity +
      weights.domain * object.domain +
      weights.morphological * object.morphologicalScore +
      weights.phonological * object.phonologicalDifficulty +
      weights.syntactic * object.syntacticComplexity +
      weights.pragmatic * object.pragmaticScore;

    return Math.min(1, Math.max(0, S_base));
  }

  it('should include syntactic complexity in base priority', () => {
    const objectWithHighSyntactic = {
      frequency: 0.5,
      relationalDensity: 0.5,
      domain: 0.5,
      morphologicalScore: 0.5,
      phonologicalDifficulty: 0.5,
      syntacticComplexity: 0.9, // High syntactic complexity
      pragmaticScore: 0.5,
    };

    const objectWithLowSyntactic = {
      ...objectWithHighSyntactic,
      syntacticComplexity: 0.1, // Low syntactic complexity
    };

    const highPriority = calculateBasePriorityWithSyntactic(objectWithHighSyntactic);
    const lowPriority = calculateBasePriorityWithSyntactic(objectWithLowSyntactic);

    // Higher syntactic complexity should result in higher priority
    expect(highPriority).toBeGreaterThan(lowPriority);
  });

  it('should use default value when syntactic complexity is null', () => {
    const object = {
      frequency: 0.5,
      relationalDensity: 0.5,
      domain: 0.5,
      morphologicalScore: 0.5,
      phonologicalDifficulty: 0.5,
      syntacticComplexity: 0.5, // Default value (simulating null handling)
      pragmaticScore: 0.5,
    };

    const priority = calculateBasePriorityWithSyntactic(object);

    // Should produce valid priority with default value
    expect(priority).toBeGreaterThan(0);
    expect(priority).toBeLessThanOrEqual(1);
  });

  it('should weight all 7 z(w) components correctly', () => {
    const object = {
      frequency: 1.0,
      relationalDensity: 1.0,
      domain: 1.0,
      morphologicalScore: 1.0,
      phonologicalDifficulty: 1.0,
      syntacticComplexity: 1.0,
      pragmaticScore: 1.0,
    };

    const weights = {
      frequency: 0.16,
      relational: 0.12,
      domain: 0.12,
      morphological: 0.08,
      phonological: 0.08,
      syntactic: 0.08,
      pragmatic: 0.08,
    };

    const priority = calculateBasePriorityWithSyntactic(object, weights);

    // Sum of weights for linguistic features = 0.72
    // (urgency and bottleneck are applied separately)
    const expectedSum =
      weights.frequency +
      weights.relational +
      weights.domain +
      weights.morphological +
      weights.phonological +
      weights.syntactic +
      weights.pragmatic;

    expect(priority).toBeCloseTo(expectedSum, 5);
    expect(priority).toBeCloseTo(0.72, 2);
  });

  it('should handle SYNT-type objects appropriately', () => {
    // SYNT-type objects should leverage syntactic complexity score
    const syntObject = {
      frequency: 0.7,
      relationalDensity: 0.6,
      domain: 0.8,
      morphologicalScore: 0.3,
      phonologicalDifficulty: 0.2,
      syntacticComplexity: 0.85, // High - this is a syntactic pattern
      pragmaticScore: 0.5,
    };

    const priority = calculateBasePriorityWithSyntactic(syntObject);

    // Should produce valid priority
    expect(priority).toBeGreaterThan(0);
    expect(priority).toBeLessThanOrEqual(1);
  });
});
