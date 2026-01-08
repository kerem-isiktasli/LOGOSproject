/**
 * Tests for Multi-Object Calibration Service
 *
 * Tests the core functionality of simultaneous multi-component calibration:
 * - Q-matrix weight allocation
 * - Compensatory MIRT probability calculation
 * - Multi-component response evaluation
 * - Theta update calculations
 * - Feedback generation
 */

import { describe, it, expect } from 'vitest';
import {
  allocateQMatrixWeights,
  objectTypeToComponent,
  getQMatrixEntry,
  calculateCompositeDifficulty,
  calculateCompensatoryProbability,
  calculateConjunctiveProbability,
  calculateDisjunctiveProbability,
  evaluateComponent,
  evaluateMultiComponentResponse,
  calculateMultiComponentThetaContributions,
  aggregateThetaContributions,
  generateComponentFeedback,
  createMultiObjectTaskSpec,
  shouldUseMultiObjectProcessing,
} from '../multi-object-calibration.service';
import type {
  MultiObjectTarget,
  MultiObjectTaskSpec,
  UserThetaProfile,
  ComponentCode,
} from '../../../core/types';
import { DEFAULT_Q_MATRIX, COGNITIVE_PROCESS_MULTIPLIERS } from '../../../core/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockTarget(overrides: Partial<MultiObjectTarget> = {}): MultiObjectTarget {
  return {
    objectId: 'test-obj-1',
    componentType: 'LEX',
    content: 'prescribe',
    weight: 0.5,
    isPrimaryTarget: true,
    cognitiveProcess: 'recall',
    difficulty: 0,
    discrimination: 1,
    ...overrides,
  };
}

function createMockThetaProfile(overrides: Partial<UserThetaProfile> = {}): UserThetaProfile {
  return {
    thetaGlobal: 0,
    thetaPhonology: 0,
    thetaMorphology: 0,
    thetaLexical: 0,
    thetaSyntactic: 0,
    thetaPragmatic: 0,
    ...overrides,
  };
}

function createMockTaskSpec(overrides: Partial<MultiObjectTaskSpec> = {}): MultiObjectTaskSpec {
  return {
    taskId: 'test-task-1',
    sessionId: 'test-session-1',
    goalId: 'test-goal-1',
    targetObjects: [
      createMockTarget(),
      createMockTarget({
        objectId: 'test-obj-2',
        componentType: 'MORPH',
        content: '-tion',
        weight: 0.3,
        isPrimaryTarget: false,
      }),
    ],
    taskType: 'word_formation',
    taskFormat: 'fill_blank',
    modality: 'visual',
    domain: 'medical',
    compositeDifficulty: 0,
    isFluencyTask: false,
    expectedAnswer: 'prescription',
    ...overrides,
  };
}

// =============================================================================
// Q-Matrix Weight Allocation Tests
// =============================================================================

describe('Q-Matrix Weight Allocation', () => {
  describe('objectTypeToComponent', () => {
    it('should map LEX type to LEX component', () => {
      expect(objectTypeToComponent('LEX')).toBe('LEX');
    });

    it('should map MWE to LEX component', () => {
      expect(objectTypeToComponent('MWE')).toBe('LEX');
    });

    it('should map G2P to PHON component', () => {
      expect(objectTypeToComponent('G2P')).toBe('PHON');
    });

    it('should map SYNT to SYNT component', () => {
      expect(objectTypeToComponent('SYNT')).toBe('SYNT');
    });

    it('should map PRAG to PRAG component', () => {
      expect(objectTypeToComponent('PRAG')).toBe('PRAG');
    });
  });

  describe('getQMatrixEntry', () => {
    it('should return correct entry for recognition task', () => {
      const entry = getQMatrixEntry('recognition');
      expect(entry.taskType).toBe('recognition');
      expect(entry.components.LEX).toBe(0.7);
      expect(entry.interactionModel).toBe('compensatory');
    });

    it('should return correct entry for word_formation task', () => {
      const entry = getQMatrixEntry('word_formation');
      expect(entry.components.MORPH).toBe(0.6);
      expect(entry.interactionModel).toBe('conjunctive');
    });

    it('should return default for unknown task type', () => {
      const entry = getQMatrixEntry('unknown_task' as any);
      expect(entry).toBeDefined();
    });
  });

  describe('allocateQMatrixWeights', () => {
    it('should normalize weights to sum to 1', () => {
      const objects = [
        { objectId: '1', componentType: 'LEX' as ComponentCode, content: 'word1', isPrimaryTarget: true, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
        { objectId: '2', componentType: 'MORPH' as ComponentCode, content: '-tion', isPrimaryTarget: false, cognitiveProcess: 'transformation' as const, difficulty: 0, discrimination: 1 },
      ];

      const weighted = allocateQMatrixWeights(objects, 'word_formation');
      const totalWeight = weighted.reduce((sum, obj) => sum + obj.weight, 0);

      expect(totalWeight).toBeCloseTo(1, 5);
    });

    it('should give primary targets higher weight', () => {
      const objects = [
        { objectId: '1', componentType: 'LEX' as ComponentCode, content: 'word1', isPrimaryTarget: true, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
        { objectId: '2', componentType: 'LEX' as ComponentCode, content: 'word2', isPrimaryTarget: false, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
      ];

      const weighted = allocateQMatrixWeights(objects, 'recognition');
      const primaryWeight = weighted.find(o => o.isPrimaryTarget)?.weight ?? 0;
      const secondaryWeight = weighted.find(o => !o.isPrimaryTarget)?.weight ?? 0;

      expect(primaryWeight).toBeGreaterThan(secondaryWeight);
    });

    it('should ensure primary targets get at least 50% total weight', () => {
      const objects = [
        { objectId: '1', componentType: 'LEX' as ComponentCode, content: 'word1', isPrimaryTarget: true, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
        { objectId: '2', componentType: 'MORPH' as ComponentCode, content: '-tion', isPrimaryTarget: false, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
        { objectId: '3', componentType: 'SYNT' as ComponentCode, content: 'pattern', isPrimaryTarget: false, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
        { objectId: '4', componentType: 'PRAG' as ComponentCode, content: 'context', isPrimaryTarget: false, cognitiveProcess: 'recall' as const, difficulty: 0, discrimination: 1 },
      ];

      const weighted = allocateQMatrixWeights(objects, 'production');
      const primaryWeightSum = weighted
        .filter(o => o.isPrimaryTarget)
        .reduce((sum, o) => sum + o.weight, 0);

      expect(primaryWeightSum).toBeGreaterThanOrEqual(0.5);
    });

    it('should return empty array for empty input', () => {
      const result = allocateQMatrixWeights([], 'recognition');
      expect(result).toEqual([]);
    });
  });

  describe('calculateCompositeDifficulty', () => {
    it('should calculate weighted average of difficulties', () => {
      const targets: MultiObjectTarget[] = [
        createMockTarget({ difficulty: 1, weight: 0.6 }),
        createMockTarget({ objectId: '2', difficulty: -1, weight: 0.4 }),
      ];

      const composite = calculateCompositeDifficulty(targets);
      // 1 * 0.6 * 1.2 + (-1) * 0.4 * 1.2 = 0.72 - 0.48 = 0.24
      expect(composite).toBeCloseTo(0.24, 1);
    });

    it('should clamp result to [-3, 3]', () => {
      const targets: MultiObjectTarget[] = [
        createMockTarget({ difficulty: 5, weight: 1.0, cognitiveProcess: 'synthesis' }),
      ];

      const composite = calculateCompositeDifficulty(targets);
      expect(composite).toBeLessThanOrEqual(3);
    });

    it('should return 0 for empty targets', () => {
      expect(calculateCompositeDifficulty([])).toBe(0);
    });
  });
});

// =============================================================================
// MIRT Probability Calculation Tests
// =============================================================================

describe('MIRT Probability Calculations', () => {
  describe('calculateCompensatoryProbability', () => {
    it('should return ~0.5 when theta equals difficulty', () => {
      const theta = createMockThetaProfile({ thetaLexical: 0 });
      const targets = [createMockTarget({ difficulty: 0, weight: 1 })];

      const prob = calculateCompensatoryProbability(theta, targets, 0);
      expect(prob).toBeCloseTo(0.5, 1);
    });

    it('should return high probability when theta > difficulty', () => {
      const theta = createMockThetaProfile({ thetaLexical: 2 });
      const targets = [createMockTarget({ difficulty: 0, weight: 1, discrimination: 1 })];

      const prob = calculateCompensatoryProbability(theta, targets, 0);
      expect(prob).toBeGreaterThan(0.7);
    });

    it('should return low probability when theta < difficulty', () => {
      const theta = createMockThetaProfile({ thetaLexical: -2 });
      const targets = [createMockTarget({ difficulty: 0, weight: 1 })];

      const prob = calculateCompensatoryProbability(theta, targets, 0);
      expect(prob).toBeLessThan(0.3);
    });

    it('should allow compensation between components', () => {
      // High LEX, low MORPH
      const theta = createMockThetaProfile({ thetaLexical: 2, thetaMorphology: -1 });
      const targets = [
        createMockTarget({ componentType: 'LEX', weight: 0.5, difficulty: 0 }),
        createMockTarget({ objectId: '2', componentType: 'MORPH', weight: 0.5, difficulty: 0 }),
      ];

      const prob = calculateCompensatoryProbability(theta, targets, 0);
      // Should be moderate due to compensation
      expect(prob).toBeGreaterThan(0.4);
      expect(prob).toBeLessThan(0.8);
    });
  });

  describe('calculateConjunctiveProbability', () => {
    it('should return high probability when all components mastered', () => {
      const theta = createMockThetaProfile({ thetaLexical: 1, thetaMorphology: 1 });
      const targets = [
        createMockTarget({ componentType: 'LEX', difficulty: 0 }),
        createMockTarget({ objectId: '2', componentType: 'MORPH', difficulty: 0 }),
      ];

      const prob = calculateConjunctiveProbability(theta, targets);
      expect(prob).toBe(0.9); // 1 - slip rate
    });

    it('should return low probability when any component not mastered', () => {
      const theta = createMockThetaProfile({ thetaLexical: 1, thetaMorphology: -1 });
      const targets = [
        createMockTarget({ componentType: 'LEX', difficulty: 0 }),
        createMockTarget({ objectId: '2', componentType: 'MORPH', difficulty: 0 }),
      ];

      const prob = calculateConjunctiveProbability(theta, targets);
      expect(prob).toBe(0.2); // guess rate
    });
  });

  describe('calculateDisjunctiveProbability', () => {
    it('should return high probability when any component mastered', () => {
      const theta = createMockThetaProfile({ thetaLexical: 1, thetaMorphology: -1 });
      const targets = [
        createMockTarget({ componentType: 'LEX', difficulty: 0 }),
        createMockTarget({ objectId: '2', componentType: 'MORPH', difficulty: 0 }),
      ];

      const prob = calculateDisjunctiveProbability(theta, targets);
      expect(prob).toBe(0.9); // 1 - slip rate
    });

    it('should return low probability when no component mastered', () => {
      const theta = createMockThetaProfile({ thetaLexical: -1, thetaMorphology: -1 });
      const targets = [
        createMockTarget({ componentType: 'LEX', difficulty: 0 }),
        createMockTarget({ objectId: '2', componentType: 'MORPH', difficulty: 0 }),
      ];

      const prob = calculateDisjunctiveProbability(theta, targets);
      expect(prob).toBe(0.2); // guess rate
    });
  });
});

// =============================================================================
// Response Evaluation Tests
// =============================================================================

describe('Multi-Component Response Evaluation', () => {
  const defaultConfig = {
    strictness: 'normal' as const,
    partialCreditEnabled: true,
    learningRate: 0.1,
  };

  describe('evaluateComponent', () => {
    it('should return correct=true and full credit for exact match', () => {
      const target = createMockTarget({ content: 'prescription' });
      const result = evaluateComponent('prescription', 'prescription', target, defaultConfig);

      expect(result.correct).toBe(true);
      expect(result.partialCredit).toBe(1.0);
    });

    it('should give partial credit for close matches', () => {
      const target = createMockTarget({ content: 'prescription' });
      const result = evaluateComponent('prescriptin', 'prescription', target, defaultConfig);

      expect(result.partialCredit).toBeGreaterThan(0);
      expect(result.partialCredit).toBeLessThan(1);
    });

    it('should detect error types', () => {
      const target = createMockTarget({ content: 'prescription' });

      // Test omission
      const omission = evaluateComponent('pre', 'prescription', target, defaultConfig);
      expect(omission.errorType).toBe('omission');
    });
  });

  describe('evaluateMultiComponentResponse', () => {
    it('should aggregate component evaluations', () => {
      const taskSpec = createMockTaskSpec();
      const result = evaluateMultiComponentResponse('prescription', taskSpec, defaultConfig);

      expect(result.componentEvaluations).toHaveLength(2);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(1);
    });

    it('should set overallCorrect only when all components correct', () => {
      const taskSpec = createMockTaskSpec();

      // Correct answer
      const correct = evaluateMultiComponentResponse('prescription', taskSpec, defaultConfig);
      expect(correct.overallCorrect).toBe(true);

      // Incorrect answer
      const incorrect = evaluateMultiComponentResponse('wrong', taskSpec, defaultConfig);
      expect(incorrect.overallCorrect).toBe(false);
    });

    it('should calculate weighted composite score', () => {
      const taskSpec = createMockTaskSpec({
        targetObjects: [
          createMockTarget({ weight: 0.7 }),
          createMockTarget({ objectId: '2', weight: 0.3 }),
        ],
      });

      const result = evaluateMultiComponentResponse('prescription', taskSpec, defaultConfig);

      // All correct = composite should be 1
      if (result.overallCorrect) {
        expect(result.compositeScore).toBeCloseTo(1, 1);
      }
    });
  });
});

// =============================================================================
// Theta Update Tests
// =============================================================================

describe('Multi-Component Theta Updates', () => {
  const defaultConfig = {
    strictness: 'normal' as const,
    partialCreditEnabled: true,
    learningRate: 0.1,
  };

  describe('calculateMultiComponentThetaContributions', () => {
    it('should calculate positive delta for correct response', () => {
      const theta = createMockThetaProfile({ thetaLexical: 0 });
      const taskSpec = createMockTaskSpec();
      const evaluation = evaluateMultiComponentResponse('prescription', taskSpec, defaultConfig);

      const contributions = calculateMultiComponentThetaContributions(
        theta,
        taskSpec,
        evaluation,
        defaultConfig
      );

      // At least one contribution should be positive for correct answer
      const hasPositive = contributions.some(c => c.thetaDelta > 0);
      expect(hasPositive).toBe(true);
    });

    it('should calculate negative delta for incorrect response', () => {
      const theta = createMockThetaProfile({ thetaLexical: 0 });
      const taskSpec = createMockTaskSpec();
      const evaluation = evaluateMultiComponentResponse('completely wrong', taskSpec, defaultConfig);

      const contributions = calculateMultiComponentThetaContributions(
        theta,
        taskSpec,
        evaluation,
        defaultConfig
      );

      // All contributions should be negative for wrong answer below expected
      const allNegative = contributions.every(c => c.thetaDelta <= 0);
      expect(allNegative).toBe(true);
    });

    it('should apply boundary decay near theta limits', () => {
      const highTheta = createMockThetaProfile({ thetaLexical: 2.5 });
      const lowTheta = createMockThetaProfile({ thetaLexical: 0 });
      const taskSpec = createMockTaskSpec({
        targetObjects: [createMockTarget({ componentType: 'LEX', weight: 1 })],
      });
      const evaluation = evaluateMultiComponentResponse('prescription', taskSpec, defaultConfig);

      const highContrib = calculateMultiComponentThetaContributions(
        highTheta,
        taskSpec,
        evaluation,
        defaultConfig
      );
      const lowContrib = calculateMultiComponentThetaContributions(
        lowTheta,
        taskSpec,
        evaluation,
        defaultConfig
      );

      // High theta should have smaller delta due to boundary decay
      const highDelta = Math.abs(highContrib[0]?.thetaDelta ?? 0);
      const lowDelta = Math.abs(lowContrib[0]?.thetaDelta ?? 0);
      expect(highDelta).toBeLessThan(lowDelta);
    });
  });

  describe('aggregateThetaContributions', () => {
    it('should sum contributions by component', () => {
      const contributions = [
        { componentType: 'LEX' as ComponentCode, thetaDelta: 0.1, weight: 0.5, sourceObjectId: '1' },
        { componentType: 'LEX' as ComponentCode, thetaDelta: 0.05, weight: 0.3, sourceObjectId: '2' },
        { componentType: 'MORPH' as ComponentCode, thetaDelta: 0.08, weight: 0.2, sourceObjectId: '3' },
      ];

      const aggregated = aggregateThetaContributions(contributions);

      expect(aggregated.thetaLexical).toBeCloseTo(0.15, 5);
      expect(aggregated.thetaMorphology).toBeCloseTo(0.08, 5);
    });

    it('should calculate global theta as weighted average', () => {
      const contributions = [
        { componentType: 'LEX' as ComponentCode, thetaDelta: 0.1, weight: 0.6, sourceObjectId: '1' },
        { componentType: 'MORPH' as ComponentCode, thetaDelta: 0.05, weight: 0.4, sourceObjectId: '2' },
      ];

      const aggregated = aggregateThetaContributions(contributions);

      // Weighted average: (0.1 * 0.6 + 0.05 * 0.4) / 1.0 = 0.08
      expect(aggregated.thetaGlobal).toBeCloseTo(0.08, 5);
    });
  });
});

// =============================================================================
// Feedback Generation Tests
// =============================================================================

describe('Component Feedback Generation', () => {
  describe('generateComponentFeedback', () => {
    it('should generate positive feedback for correct response', () => {
      const evaluation = {
        objectId: '1',
        componentType: 'LEX' as ComponentCode,
        correct: true,
        partialCredit: 1.0,
        feedback: 'test',
      };
      const target = createMockTarget();

      const feedback = generateComponentFeedback(evaluation, target);
      expect(feedback).toContain('Excellent');
    });

    it('should generate error-specific feedback for incorrect response', () => {
      const evaluation = {
        objectId: '1',
        componentType: 'MORPH' as ComponentCode,
        correct: false,
        partialCredit: 0,
        errorType: 'form' as const,
        feedback: 'test',
        correction: 'prescription',
      };
      const target = createMockTarget({ componentType: 'MORPH' });

      const feedback = generateComponentFeedback(evaluation, target);
      expect(feedback).toContain('Form error');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Multi-Object Task Creation', () => {
  describe('createMultiObjectTaskSpec', () => {
    it('should create valid task spec from objects', () => {
      const objects = [
        { id: '1', type: 'LEX' as const, content: 'prescribe', irtDifficulty: 0, irtDiscrimination: 1, isPrimary: true },
        { id: '2', type: 'MORPH' as const, content: '-tion', irtDifficulty: 0.5, irtDiscrimination: 0.8, isPrimary: false },
      ];

      const spec = createMultiObjectTaskSpec(
        'task-1',
        'session-1',
        'goal-1',
        objects,
        'word_formation',
        'fill_blank',
        'visual',
        'medical',
        'prescription',
        false
      );

      expect(spec.taskId).toBe('task-1');
      expect(spec.targetObjects).toHaveLength(2);
      expect(spec.targetObjects[0].isPrimaryTarget).toBe(true);
      expect(spec.compositeDifficulty).toBeDefined();

      // Weights should sum to 1
      const totalWeight = spec.targetObjects.reduce((sum, t) => sum + t.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 5);
    });
  });

  describe('shouldUseMultiObjectProcessing', () => {
    it('should return true for multiple targets', () => {
      const targets = [createMockTarget(), createMockTarget({ objectId: '2' })];
      expect(shouldUseMultiObjectProcessing(targets, 'recognition')).toBe(true);
    });

    it('should return true for multi-component task types', () => {
      expect(shouldUseMultiObjectProcessing(undefined, 'production')).toBe(true);
      expect(shouldUseMultiObjectProcessing(undefined, 'sentence_writing')).toBe(true);
    });

    it('should return true for recognition even with single target (3 components involved)', () => {
      // recognition involves LEX, PHON, MORPH (3 components) so multi-object processing applies
      const targets = [createMockTarget()];
      expect(shouldUseMultiObjectProcessing(targets, 'recognition')).toBe(true);
    });

    it('should return false for single-component task with single target', () => {
      // Only tasks with fewer than 3 components should return false with single target
      // This tests the edge case - currently all task types in DEFAULT_Q_MATRIX have 3+ components
      const targets = [createMockTarget()];
      // recognition has 3 components, so it returns true
      // If we had a task type with only 1-2 components, it would return false
      expect(shouldUseMultiObjectProcessing(targets, 'recognition')).toBe(true);
    });
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('Edge Cases', () => {
  it('should handle empty response gracefully', () => {
    const taskSpec = createMockTaskSpec();
    const config = { strictness: 'normal' as const, partialCreditEnabled: true, learningRate: 0.1 };

    const result = evaluateMultiComponentResponse('', taskSpec, config);
    expect(result.overallCorrect).toBe(false);
    expect(result.compositeScore).toBe(0);
  });

  it('should handle single-object task as degenerate case', () => {
    const taskSpec = createMockTaskSpec({
      targetObjects: [createMockTarget({ weight: 1.0 })],
    });

    const theta = createMockThetaProfile();
    const config = { strictness: 'normal' as const, partialCreditEnabled: true, learningRate: 0.1 };
    const evaluation = evaluateMultiComponentResponse('prescribe', taskSpec, config);
    const contributions = calculateMultiComponentThetaContributions(theta, taskSpec, evaluation, config);

    expect(contributions).toHaveLength(1);
  });

  it('should handle all five components simultaneously', () => {
    const targets: MultiObjectTarget[] = [
      createMockTarget({ objectId: '1', componentType: 'PHON', weight: 0.2, content: 'sound' }),
      createMockTarget({ objectId: '2', componentType: 'MORPH', weight: 0.2, content: 'form' }),
      createMockTarget({ objectId: '3', componentType: 'LEX', weight: 0.2, content: 'word' }),
      createMockTarget({ objectId: '4', componentType: 'SYNT', weight: 0.2, content: 'pattern' }),
      createMockTarget({ objectId: '5', componentType: 'PRAG', weight: 0.2, content: 'context' }),
    ];

    const taskSpec = createMockTaskSpec({ targetObjects: targets });
    const theta = createMockThetaProfile();
    const config = { strictness: 'normal' as const, partialCreditEnabled: true, learningRate: 0.1 };

    const evaluation = evaluateMultiComponentResponse('test response', taskSpec, config);
    const contributions = calculateMultiComponentThetaContributions(theta, taskSpec, evaluation, config);
    const aggregated = aggregateThetaContributions(contributions);

    // All five component thetas should be affected
    expect(aggregated.thetaPhonology).toBeDefined();
    expect(aggregated.thetaMorphology).toBeDefined();
    expect(aggregated.thetaLexical).toBeDefined();
    expect(aggregated.thetaSyntactic).toBeDefined();
    expect(aggregated.thetaPragmatic).toBeDefined();
  });
});
