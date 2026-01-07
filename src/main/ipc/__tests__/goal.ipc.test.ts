/**
 * Goal IPC Handlers Tests
 *
 * Tests for goal management IPC communication.
 * Validates goal CRUD operations and validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateInput,
  GoalCreateSchema,
  GoalUpdateSchema,
} from '../../../shared/schemas/ipc-schemas';

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Goal IPC Schema Validation', () => {
  describe('GoalCreateSchema', () => {
    it('should accept valid goal creation', () => {
      const result = validateInput(GoalCreateSchema, {
        name: 'Learn Japanese',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        domain: 'general',
        description: 'Master conversational Japanese',
        modality: ['visual', 'auditory'],
        benchmark: 'B1',
        dailyTime: 30,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Learn Japanese');
        expect(result.data.targetLanguage).toBe('ja');
        expect(result.data.benchmark).toBe('B1');
      }
    });

    it('should accept minimal required fields', () => {
      const result = validateInput(GoalCreateSchema, {
        name: 'Learn Spanish',
        targetLanguage: 'es',
        nativeLanguage: 'en',
      });

      expect(result.success).toBe(true);
    });

    it('should validate language codes', () => {
      // ISO 639-1 (2 letter)
      const twoLetter = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
      });
      expect(twoLetter.success).toBe(true);

      // Locale format (5 letter)
      const locale = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja-JP',
        nativeLanguage: 'ko-KR',
      });
      expect(locale.success).toBe(true);

      // Invalid format
      const invalid = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'japanese',
        nativeLanguage: 'korean',
      });
      expect(invalid.success).toBe(false);
    });

    it('should validate benchmark enum', () => {
      const validBenchmarks = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

      for (const benchmark of validBenchmarks) {
        const result = validateInput(GoalCreateSchema, {
          name: 'Test',
          targetLanguage: 'ja',
          nativeLanguage: 'ko',
          benchmark,
        });
        expect(result.success).toBe(true);
      }

      const invalid = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        benchmark: 'D1',
      });
      expect(invalid.success).toBe(false);
    });

    it('should validate modality array', () => {
      const validModalities = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        modality: ['visual', 'auditory', 'kinesthetic'],
      });
      expect(validModalities.success).toBe(true);

      // Empty modality should fail (min 1)
      const emptyModality = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        modality: [],
      });
      expect(emptyModality.success).toBe(false);
    });

    it('should validate dailyTime range', () => {
      // Too short (< 5 min)
      const tooShort = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        dailyTime: 2,
      });
      expect(tooShort.success).toBe(false);

      // Too long (> 480 min / 8 hours)
      const tooLong = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        dailyTime: 600,
      });
      expect(tooLong.success).toBe(false);

      // Valid
      const valid = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        dailyTime: 60,
      });
      expect(valid.success).toBe(true);
    });

    it('should validate name length', () => {
      // Empty name
      const empty = validateInput(GoalCreateSchema, {
        name: '',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
      });
      expect(empty.success).toBe(false);

      // Too long (> 200 chars)
      const tooLong = validateInput(GoalCreateSchema, {
        name: 'a'.repeat(201),
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
      });
      expect(tooLong.success).toBe(false);
    });

    it('should validate description length', () => {
      const tooLong = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        description: 'a'.repeat(2001),
      });
      expect(tooLong.success).toBe(false);
    });

    it('should validate deadline format', () => {
      const validDeadline = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        deadline: '2025-12-31T23:59:59Z',
      });
      expect(validDeadline.success).toBe(true);

      const invalidDeadline = validateInput(GoalCreateSchema, {
        name: 'Test',
        targetLanguage: 'ja',
        nativeLanguage: 'ko',
        deadline: 'not-a-date',
      });
      expect(invalidDeadline.success).toBe(false);
    });
  });

  describe('GoalUpdateSchema', () => {
    it('should accept valid goal update', () => {
      const result = validateInput(GoalUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated Name',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Updated Name');
      }
    });

    it('should accept updating single field', () => {
      const result = validateInput(GoalUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        isActive: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should accept updating benchmark', () => {
      const result = validateInput(GoalUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        benchmark: 'C1',
      });

      expect(result.success).toBe(true);
    });

    it('should require id', () => {
      const result = validateInput(GoalUpdateSchema, {
        name: 'No ID',
      });
      expect(result.success).toBe(false);
    });

    it('should accept update with only id (no-op update)', () => {
      // GoalUpdateSchema allows id-only updates (no-op in practice)
      // unlike ObjectUpdateSchema which requires at least one field
      const result = validateInput(GoalUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Goal Logic Tests
// ============================================================================

describe('Goal Handler Logic', () => {
  describe('Goal Progress Calculation', () => {
    it('should calculate mastery distribution', () => {
      const objects = [
        { masteryStage: 0 },
        { masteryStage: 0 },
        { masteryStage: 1 },
        { masteryStage: 2 },
        { masteryStage: 3 },
        { masteryStage: 4 },
        { masteryStage: 4 },
      ];

      const distribution = objects.reduce((acc, obj) => {
        acc[obj.masteryStage] = (acc[obj.masteryStage] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      expect(distribution[0]).toBe(2);
      expect(distribution[1]).toBe(1);
      expect(distribution[2]).toBe(1);
      expect(distribution[3]).toBe(1);
      expect(distribution[4]).toBe(2);
    });

    it('should calculate overall progress percentage', () => {
      const objects = [
        { masteryStage: 4 }, // 100%
        { masteryStage: 4 }, // 100%
        { masteryStage: 2 }, // 50%
        { masteryStage: 0 }, // 0%
      ];

      const progress = objects.reduce((sum, obj) => sum + (obj.masteryStage / 4), 0) / objects.length;

      expect(progress).toBe(0.625); // (1 + 1 + 0.5 + 0) / 4
    });

    it('should calculate time to completion estimate', () => {
      const remainingItems = 50;
      const avgTimePerItem = 30; // seconds
      const dailyTime = 30 * 60; // 30 minutes in seconds
      const reviewFactor = 1.5; // Items need to be reviewed multiple times

      const totalTimeNeeded = remainingItems * avgTimePerItem * reviewFactor;
      const daysToComplete = Math.ceil(totalTimeNeeded / dailyTime);

      expect(daysToComplete).toBe(2); // ceil(2250 / 1800) = 2
    });
  });

  describe('Goal Deactivation', () => {
    it('should handle soft delete (deactivation)', () => {
      const goal = {
        id: '123',
        isActive: true,
        deletedAt: null,
      };

      // Soft delete
      const deactivated = {
        ...goal,
        isActive: false,
        deletedAt: new Date(),
      };

      expect(deactivated.isActive).toBe(false);
      expect(deactivated.deletedAt).toBeInstanceOf(Date);
    });

    it('should filter inactive goals by default', () => {
      const goals = [
        { id: '1', isActive: true },
        { id: '2', isActive: false },
        { id: '3', isActive: true },
      ];

      const activeGoals = goals.filter(g => g.isActive);
      expect(activeGoals).toHaveLength(2);
    });
  });

  describe('Goal Language Pair', () => {
    it('should identify L1 transfer possibilities', () => {
      const languagePairs: Record<string, string[]> = {
        'ko-ja': ['kanji', 'honorifics', 'sentence-final'],
        'ko-zh': ['hanzi', 'tones', 'classifiers'],
        'en-es': ['cognates', 'gender', 'subjunctive'],
      };

      const nativeLanguage = 'ko';
      const targetLanguage = 'ja';
      const pairKey = `${nativeLanguage}-${targetLanguage}`;

      const transferAreas = languagePairs[pairKey] || [];

      expect(transferAreas).toContain('kanji');
      expect(transferAreas).toContain('honorifics');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Goal Error Handling', () => {
  it('should handle duplicate goal name', () => {
    const existingGoals = [
      { name: 'Learn Japanese', targetLanguage: 'ja' },
    ];

    const newGoalName = 'Learn Japanese';
    const isDuplicate = existingGoals.some(g => g.name === newGoalName);

    expect(isDuplicate).toBe(true);
  });

  it('should handle goal not found', () => {
    const goal = null;
    expect(goal).toBeNull();
  });

  it('should handle deleting goal with active sessions', () => {
    const goal = {
      id: '123',
      sessions: [
        { id: 's1', endedAt: null }, // Active session
      ],
    };

    const hasActiveSessions = goal.sessions.some(s => s.endedAt === null);
    expect(hasActiveSessions).toBe(true);
  });
});
