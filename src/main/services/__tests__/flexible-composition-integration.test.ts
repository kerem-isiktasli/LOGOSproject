/**
 * Integration Tests for Flexible Task Composition Framework
 *
 * Tests the core algorithms and type definitions for:
 * 1. Role Configurations - ObjectRole spectrum with theta multipliers
 * 2. Linguistic Constraint Rules - Cross-component constraints
 * 3. Multi-Layer Evaluation - Object-specific evaluation modes
 * 4. Usage Space Tracking - Context selection
 *
 * Note: Services that require database connections are tested via mocking
 * in their respective unit test files. This file focuses on pure functions
 * and type validations.
 */

import { describe, it, expect } from 'vitest';

// Multi-Layer Evaluation Service
import {
  evaluateObject,
  evaluateBatch,
  type ObjectEvaluationInput,
  type ObjectEvaluationResult,
} from '../multi-layer-evaluation.service';

// Usage Space Tracking Service
import {
  STANDARD_CONTEXTS,
  getContextById,
  getContextsForDomain,
} from '../usage-space-tracking.service';

// Types
import type {
  ComponentCode,
  ObjectRole,
  LinguisticConstraintRule,
} from '../../../core/types';
import { ROLE_CONFIGS, LINGUISTIC_CONSTRAINT_RULES } from '../../../core/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEvaluationInput(overrides: Partial<ObjectEvaluationInput> = {}): ObjectEvaluationInput {
  return {
    objectId: 'obj-lex-1',
    componentType: 'LEX',
    response: 'prescription',
    expected: ['prescription'],
    config: {
      evaluationMode: 'binary',
      threshold: 0.5,
    },
    role: 'assessment',
    weight: 1.0,
    ...overrides,
  };
}

// =============================================================================
// 1. Role Configuration Tests
// =============================================================================

describe('Role Configurations', () => {
  describe('ROLE_CONFIGS', () => {
    it('should have all required roles defined', () => {
      const requiredRoles: ObjectRole[] = ['assessment', 'practice', 'reinforcement', 'incidental'];

      for (const role of requiredRoles) {
        expect(ROLE_CONFIGS[role]).toBeDefined();
        expect(ROLE_CONFIGS[role]).toHaveProperty('thetaMultiplier');
      }
    });

    it('should have decreasing theta multipliers across role spectrum', () => {
      // Assessment > Practice > Reinforcement > Incidental
      expect(ROLE_CONFIGS.assessment.thetaMultiplier).toBeGreaterThan(ROLE_CONFIGS.practice.thetaMultiplier);
      expect(ROLE_CONFIGS.practice.thetaMultiplier).toBeGreaterThan(ROLE_CONFIGS.reinforcement.thetaMultiplier);
      expect(ROLE_CONFIGS.reinforcement.thetaMultiplier).toBeGreaterThan(ROLE_CONFIGS.incidental.thetaMultiplier);
    });

    it('should have assessment role with full theta multiplier', () => {
      expect(ROLE_CONFIGS.assessment.thetaMultiplier).toBe(1.0);
    });

    it('should have incidental role with zero theta multiplier', () => {
      expect(ROLE_CONFIGS.incidental.thetaMultiplier).toBe(0);
    });

    it('should have valid mastery/accuracy tracking flags', () => {
      // Assessment and Practice should track accuracy
      expect(ROLE_CONFIGS.assessment.trackAccuracy).toBe(true);
      expect(ROLE_CONFIGS.practice.trackAccuracy).toBe(true);

      // Reinforcement and Incidental should not
      expect(ROLE_CONFIGS.reinforcement.trackAccuracy).toBe(false);
      expect(ROLE_CONFIGS.incidental.trackAccuracy).toBe(false);
    });

    it('should have valid FSRS update flags', () => {
      // Only assessment and practice update FSRS
      expect(ROLE_CONFIGS.assessment.updateFSRS).toBe(true);
      expect(ROLE_CONFIGS.practice.updateFSRS).toBe(true);
      expect(ROLE_CONFIGS.reinforcement.updateFSRS).toBe(false);
      expect(ROLE_CONFIGS.incidental.updateFSRS).toBe(false);
    });

    it('should have decreasing exposure weights', () => {
      expect(ROLE_CONFIGS.assessment.exposureWeight).toBeGreaterThanOrEqual(ROLE_CONFIGS.practice.exposureWeight);
      expect(ROLE_CONFIGS.practice.exposureWeight).toBeGreaterThan(ROLE_CONFIGS.reinforcement.exposureWeight);
      expect(ROLE_CONFIGS.reinforcement.exposureWeight).toBeGreaterThan(ROLE_CONFIGS.incidental.exposureWeight);
    });
  });
});

// =============================================================================
// 2. Linguistic Constraint Rules Tests
// =============================================================================

describe('Linguistic Constraint Rules', () => {
  it('should have rules defined', () => {
    expect(LINGUISTIC_CONSTRAINT_RULES).toBeDefined();
    expect(LINGUISTIC_CONSTRAINT_RULES.length).toBeGreaterThan(0);
  });

  it('should have rules for SYNT → MORPH interaction', () => {
    const syntMorphRules = LINGUISTIC_CONSTRAINT_RULES.filter(
      r => r.sourceComponent === 'SYNT' && r.targetComponent === 'MORPH'
    );

    expect(syntMorphRules.length).toBeGreaterThan(0);
  });

  it('should have rules for SYNT → LEX interaction', () => {
    const syntLexRules = LINGUISTIC_CONSTRAINT_RULES.filter(
      r => r.sourceComponent === 'SYNT' && r.targetComponent === 'LEX'
    );

    expect(syntLexRules.length).toBeGreaterThan(0);
  });

  it('should have rules for LEX → PHON interaction', () => {
    const lexPhonRules = LINGUISTIC_CONSTRAINT_RULES.filter(
      r => r.sourceComponent === 'LEX' && r.targetComponent === 'PHON'
    );

    expect(lexPhonRules.length).toBeGreaterThan(0);
  });

  it('should have valid constraint types', () => {
    const validTypes = ['restricts_to', 'prefers', 'excludes', 'requires', 'enables'];

    for (const rule of LINGUISTIC_CONSTRAINT_RULES) {
      expect(validTypes).toContain(rule.constraintType);
    }
  });

  it('should have valid predicate types', () => {
    const validPredicates = [
      'syntactic_agreement',
      'collocation',
      'phonological_compatibility',
      'phonological_mapping',
      'morphological_derivation',
      'register_consistency',
      'semantic_coherence',
      'semantic_constraint',
      'pragmatic_constraint',
    ];

    for (const rule of LINGUISTIC_CONSTRAINT_RULES) {
      expect(validPredicates).toContain(rule.predicateType);
    }
  });

  it('should have strength values between 0 and 1', () => {
    for (const rule of LINGUISTIC_CONSTRAINT_RULES) {
      expect(rule.defaultStrength).toBeGreaterThanOrEqual(0);
      expect(rule.defaultStrength).toBeLessThanOrEqual(1);
    }
  });
});

// =============================================================================
// 3. Multi-Layer Evaluation Service Tests
// =============================================================================

describe('Multi-Layer Evaluation Service', () => {
  describe('evaluateObject - Binary Mode', () => {
    it('should correctly evaluate exact matches', () => {
      const input = createMockEvaluationInput({
        response: 'prescription',
        expected: ['prescription'],
        config: { evaluationMode: 'binary', threshold: 0.5 },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it('should correctly evaluate wrong answers', () => {
      const input = createMockEvaluationInput({
        response: 'wrong answer',
        expected: ['prescription'],
        config: { evaluationMode: 'binary', threshold: 0.5 },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const input = createMockEvaluationInput({
        response: 'PRESCRIPTION',
        expected: ['prescription'],
        config: { evaluationMode: 'binary', threshold: 0.5 },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
    });

    it('should handle whitespace normalization', () => {
      const input = createMockEvaluationInput({
        response: '  prescription  ',
        expected: ['prescription'],
        config: { evaluationMode: 'binary', threshold: 0.5 },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
    });

    it('should accept multiple valid expected answers', () => {
      const input = createMockEvaluationInput({
        response: 'color',
        expected: ['color', 'colour'],
        config: { evaluationMode: 'binary', threshold: 0.5 },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
    });
  });

  describe('evaluateObject - Range-Based Mode', () => {
    it('should evaluate exact matches', () => {
      const input = createMockEvaluationInput({
        response: 'prescription',
        expected: ['prescription'],
        config: {
          evaluationMode: 'range_based',
          threshold: 0.5,
          answerRange: {
            exactMatches: ['prescription'],
            acceptableVariants: ['prescriptions'],
            partialCreditPatterns: [],
            semanticThreshold: 0.8,
          },
        },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.score).toBe(1.0);
    });

    it('should evaluate acceptable variants', () => {
      const input = createMockEvaluationInput({
        response: 'prescriptions',
        expected: ['prescription'],
        config: {
          evaluationMode: 'range_based',
          threshold: 0.5,
          answerRange: {
            exactMatches: ['prescription'],
            acceptableVariants: ['prescriptions', 'the prescription'],
            partialCreditPatterns: [],
            semanticThreshold: 0.8,
          },
        },
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
      expect(result.matchType).toBe('variant');
    });

    it('should match safe partial credit patterns', () => {
      const input = createMockEvaluationInput({
        response: 'prescribing',
        expected: ['prescription'],
        config: {
          evaluationMode: 'range_based',
          threshold: 0.5,
          answerRange: {
            exactMatches: ['prescription'],
            acceptableVariants: [],
            partialCreditPatterns: [
              { pattern: 'prescri.*', score: 0.6, feedback: 'Root correct' },
            ],
            semanticThreshold: 0.7,
          },
        },
      });

      const result = evaluateObject(input);

      expect(result.matchType).toBe('partial');
      expect(result.score).toBe(0.6);
    });

    it('should reject dangerous regex patterns (ReDoS protection)', () => {
      const input = createMockEvaluationInput({
        response: 'aaaaaaaaaaaaaaaaaaaaaaaaaab',
        expected: ['test'],
        config: {
          evaluationMode: 'range_based',
          threshold: 0.5,
          answerRange: {
            exactMatches: ['test'],
            acceptableVariants: [],
            partialCreditPatterns: [
              // This pattern could cause catastrophic backtracking
              { pattern: '(a+)+$', score: 0.5, feedback: 'Match' },
            ],
            semanticThreshold: 0.7,
          },
        },
      });

      // Should complete without hanging (ReDoS protection)
      const startTime = Date.now();
      const result = evaluateObject(input);
      const elapsed = Date.now() - startTime;

      // Should complete quickly (< 100ms), not hang
      expect(elapsed).toBeLessThan(100);
      // Pattern should be skipped, so no partial match
      expect(result.matchType).not.toBe('partial');
    });

    it('should skip overly long regex patterns', () => {
      const longPattern = 'a'.repeat(250);
      const input = createMockEvaluationInput({
        response: 'test input',
        expected: ['test'],
        config: {
          evaluationMode: 'range_based',
          threshold: 0.5,
          answerRange: {
            exactMatches: ['test'],
            acceptableVariants: [],
            partialCreditPatterns: [
              { pattern: longPattern, score: 0.5, feedback: 'Match' },
            ],
            semanticThreshold: 0.7,
          },
        },
      });

      const result = evaluateObject(input);

      // Long pattern should be skipped
      expect(result.matchType).not.toBe('partial');
    });
  });

  describe('evaluateBatch', () => {
    it('should evaluate multiple objects and aggregate results', () => {
      const inputs: ObjectEvaluationInput[] = [
        createMockEvaluationInput({
          objectId: 'obj-1',
          response: 'prescription',
          expected: ['prescription'],
          weight: 0.5,
        }),
        createMockEvaluationInput({
          objectId: 'obj-2',
          response: 'wrong',
          expected: ['correct'],
          weight: 0.5,
        }),
      ];

      const result = evaluateBatch(inputs, { strictness: 'normal' });

      expect(result.objectResults).toHaveLength(2);
      expect(result.objectResults[0].correct).toBe(true);
      expect(result.objectResults[1].correct).toBe(false);
      expect(result.metadata.averageScore).toBe(0.5);
    });

    it('should calculate weighted average score', () => {
      const inputs: ObjectEvaluationInput[] = [
        createMockEvaluationInput({
          objectId: 'obj-1',
          response: 'prescription',
          expected: ['prescription'],
          weight: 0.8, // Higher weight
        }),
        createMockEvaluationInput({
          objectId: 'obj-2',
          response: 'wrong',
          expected: ['correct'],
          weight: 0.2, // Lower weight
        }),
      ];

      const result = evaluateBatch(inputs, { strictness: 'normal' });

      // Weighted average: (1.0 * 0.8 + 0 * 0.2) / (0.8 + 0.2) = 0.8
      expect(result.metadata.averageScore).toBe(0.8);
    });

    it('should track total evaluated objects', () => {
      const inputs: ObjectEvaluationInput[] = [
        createMockEvaluationInput({ objectId: 'obj-1' }),
        createMockEvaluationInput({ objectId: 'obj-2' }),
        createMockEvaluationInput({ objectId: 'obj-3' }),
      ];

      const result = evaluateBatch(inputs, { strictness: 'normal' });

      expect(result.metadata.totalObjects).toBe(3);
      expect(result.metadata.evaluatedObjects).toBe(3);
    });
  });

  describe('Input Validation', () => {
    it('should reject excessively long responses', () => {
      const longResponse = 'a'.repeat(15000);
      const input = createMockEvaluationInput({
        response: longResponse,
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(false);
      expect(result.feedback).toContain('maximum allowed length');
    });
  });
});

// =============================================================================
// 4. Usage Space Tracking Service Tests
// =============================================================================

describe('Usage Space Tracking Service', () => {
  describe('STANDARD_CONTEXTS', () => {
    it('should have contexts defined', () => {
      expect(STANDARD_CONTEXTS).toBeDefined();
      expect(STANDARD_CONTEXTS.length).toBeGreaterThan(0);
    });

    it('should have required context fields', () => {
      for (const context of STANDARD_CONTEXTS) {
        expect(context.contextId).toBeDefined();
        expect(context.domain).toBeDefined();
        expect(context.register).toBeDefined();
        expect(context.modality).toBeDefined();
      }
    });

    it('should cover multiple domains', () => {
      const domains = new Set(STANDARD_CONTEXTS.map(c => c.domain));

      expect(domains.size).toBeGreaterThan(2);
    });

    it('should have valid register levels', () => {
      const validRegisters = ['informal', 'consultative', 'formal', 'technical'];

      for (const context of STANDARD_CONTEXTS) {
        expect(validRegisters).toContain(context.register);
      }
    });
  });

  describe('getContextById', () => {
    it('should retrieve context by ID', () => {
      const firstContext = STANDARD_CONTEXTS[0];
      const retrieved = getContextById(firstContext.contextId);

      expect(retrieved).toEqual(firstContext);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = getContextById('non-existent-id-12345');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getContextsForDomain', () => {
    it('should filter contexts by domain', () => {
      const firstDomain = STANDARD_CONTEXTS[0].domain;
      const domainContexts = getContextsForDomain(firstDomain);

      expect(domainContexts.length).toBeGreaterThan(0);
      for (const ctx of domainContexts) {
        expect(ctx.domain).toBe(firstDomain);
      }
    });

    it('should return empty array for non-existent domain', () => {
      const contexts = getContextsForDomain('non-existent-domain-xyz');

      expect(contexts).toHaveLength(0);
    });
  });
});

// =============================================================================
// 5. Integration: Evaluation with Role Weighting
// =============================================================================

describe('Evaluation with Role Weighting', () => {
  it('should produce results for all role types', () => {
    const roles: ObjectRole[] = ['assessment', 'practice', 'reinforcement', 'incidental'];

    for (const role of roles) {
      const input = createMockEvaluationInput({
        role,
        response: 'prescription',
        expected: ['prescription'],
      });

      const result = evaluateObject(input);

      expect(result.correct).toBe(true);
      expect(result.objectId).toBe('obj-lex-1');
    }
  });

  it('should evaluate batch with mixed roles', () => {
    const inputs: ObjectEvaluationInput[] = [
      createMockEvaluationInput({
        objectId: 'assess-1',
        role: 'assessment',
        response: 'correct',
        expected: ['correct'],
        weight: 0.4,
      }),
      createMockEvaluationInput({
        objectId: 'practice-1',
        role: 'practice',
        response: 'correct',
        expected: ['correct'],
        weight: 0.3,
      }),
      createMockEvaluationInput({
        objectId: 'reinforce-1',
        role: 'reinforcement',
        response: 'correct',
        expected: ['correct'],
        weight: 0.2,
      }),
      createMockEvaluationInput({
        objectId: 'incidental-1',
        role: 'incidental',
        response: 'correct',
        expected: ['correct'],
        weight: 0.1,
      }),
    ];

    const result = evaluateBatch(inputs, { strictness: 'normal' });

    expect(result.objectResults).toHaveLength(4);
    expect(result.metadata.averageScore).toBe(1.0); // All correct
  });
});

// =============================================================================
// 6. Edge Cases and Error Handling
// =============================================================================

describe('Edge Cases', () => {
  it('should handle empty response', () => {
    const input = createMockEvaluationInput({
      response: '',
      expected: ['prescription'],
    });

    const result = evaluateObject(input);

    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should handle single expected value', () => {
    const input = createMockEvaluationInput({
      response: 'anything',
      expected: ['anything'],
    });

    const result = evaluateObject(input);

    expect(result.correct).toBe(true);
  });

  it('should handle special characters in response', () => {
    const input = createMockEvaluationInput({
      response: "it's working!",
      expected: ["it's working!"],
    });

    const result = evaluateObject(input);

    expect(result.correct).toBe(true);
  });

  it('should handle unicode characters', () => {
    const input = createMockEvaluationInput({
      response: 'café',
      expected: ['café'],
    });

    const result = evaluateObject(input);

    expect(result.correct).toBe(true);
  });
});
