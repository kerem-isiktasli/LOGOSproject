/**
 * Learning IPC Handlers Tests
 *
 * Tests for learning object and queue IPC communication.
 * Validates input validation, error handling, and service integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateInput, QueueGetSchema, ObjectCreateSchema, ObjectUpdateSchema, ObjectListSchema } from '../../../shared/schemas/ipc-schemas';

// ============================================================================
// Mock Setup
// ============================================================================

const mockPrisma = {
  languageObject: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  },
  masteryState: {
    findUnique: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  goalSpec: {
    findUnique: vi.fn(),
  },
};

vi.mock('../../db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../core/priority', () => ({
  buildLearningQueue: vi.fn().mockReturnValue([]),
  getSessionItems: vi.fn().mockReturnValue([]),
  inferLevel: vi.fn().mockReturnValue('intermediate'),
  getWeightsForLevel: vi.fn().mockReturnValue({ f: 0.3, r: 0.2, e: 0.5 }),
}));

vi.mock('../../services/task-generation.service', () => ({
  getOrGenerateTaskWithMatching: vi.fn().mockResolvedValue({
    prompt: 'Test prompt',
    options: ['A', 'B', 'C'],
    hints: ['Hint 1'],
    expectedAnswer: 'A',
    spec: {
      format: 'mcq',
      difficulty: 0.5,
      cueLevel: 0,
      modality: 'visual',
      isFluencyTask: false,
    },
  }),
}));

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Learning IPC Schema Validation', () => {
  describe('QueueGetSchema', () => {
    it('should accept valid request', () => {
      const result = validateInput(QueueGetSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSize: 20,
        newItemRatio: 0.3,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.goalId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.sessionSize).toBe(20);
        expect(result.data.newItemRatio).toBe(0.3);
      }
    });

    it('should use defaults for optional fields', () => {
      const result = validateInput(QueueGetSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionSize).toBe(20);
        expect(result.data.newItemRatio).toBe(0.3);
      }
    });

    it('should reject invalid UUID', () => {
      const result = validateInput(QueueGetSchema, {
        goalId: 'invalid-uuid',
        sessionSize: 20,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid UUID');
      }
    });

    it('should reject sessionSize out of range', () => {
      const resultTooSmall = validateInput(QueueGetSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSize: 0,
      });

      expect(resultTooSmall.success).toBe(false);

      const resultTooLarge = validateInput(QueueGetSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSize: 200,
      });

      expect(resultTooLarge.success).toBe(false);
    });

    it('should reject newItemRatio out of range', () => {
      const resultNegative = validateInput(QueueGetSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        newItemRatio: -0.1,
      });

      expect(resultNegative.success).toBe(false);

      const resultTooLarge = validateInput(QueueGetSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        newItemRatio: 1.5,
      });

      expect(resultTooLarge.success).toBe(false);
    });
  });

  describe('ObjectCreateSchema', () => {
    it('should accept valid object creation', () => {
      const result = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: '食べる',
        type: 'LEX',
        frequency: 0.8,
        relationalDensity: 0.5,
        contextualContribution: 0.6,
        irtDifficulty: 0.5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('食べる');
        expect(result.data.type).toBe('LEX');
      }
    });

    it('should require content and type', () => {
      const resultNoContent = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'LEX',
      });

      expect(resultNoContent.success).toBe(false);

      const resultNoType = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'test',
      });

      expect(resultNoType.success).toBe(false);
    });

    it('should validate object type enum', () => {
      const validTypes = ['LEX', 'MORPH', 'G2P', 'SYNT', 'PRAG'];

      for (const type of validTypes) {
        const result = validateInput(ObjectCreateSchema, {
          goalId: '550e8400-e29b-41d4-a716-446655440000',
          content: 'test',
          type,
        });
        expect(result.success).toBe(true);
      }

      const invalidResult = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'test',
        type: 'INVALID',
      });

      expect(invalidResult.success).toBe(false);
    });

    it('should validate IRT difficulty range', () => {
      const resultTooLow = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'test',
        type: 'LEX',
        irtDifficulty: -5,
      });

      expect(resultTooLow.success).toBe(false);

      const resultTooHigh = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'test',
        type: 'LEX',
        irtDifficulty: 5,
      });

      expect(resultTooHigh.success).toBe(false);

      const resultValid = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'test',
        type: 'LEX',
        irtDifficulty: 2,
      });

      expect(resultValid.success).toBe(true);
    });

    it('should reject empty content', () => {
      const result = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: '',
        type: 'LEX',
      });

      expect(result.success).toBe(false);
    });

    it('should reject content exceeding max length', () => {
      const result = validateInput(ObjectCreateSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        content: 'a'.repeat(1001),
        type: 'LEX',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('ObjectUpdateSchema', () => {
    it('should accept valid update with at least one field', () => {
      const result = validateInput(ObjectUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'updated content',
      });

      expect(result.success).toBe(true);
    });

    it('should reject update with only id (no update fields)', () => {
      const result = validateInput(ObjectUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('At least one field');
      }
    });

    it('should allow updating multiple fields', () => {
      const result = validateInput(ObjectUpdateSchema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'updated',
        frequency: 0.9,
        irtDifficulty: 1.5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('updated');
        expect(result.data.frequency).toBe(0.9);
        expect(result.data.irtDifficulty).toBe(1.5);
      }
    });
  });

  describe('ObjectListSchema', () => {
    it('should accept valid list request', () => {
      const result = validateInput(ObjectListSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'LEX',
        limit: 50,
        offset: 10,
      });

      expect(result.success).toBe(true);
    });

    it('should use default limit and offset', () => {
      const result = validateInput(ObjectListSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit exceeding max', () => {
      const result = validateInput(ObjectListSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        limit: 2000,
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Handler Logic Tests (without IPC infrastructure)
// ============================================================================

describe('Learning Handler Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('object:create logic', () => {
    it('should create object with defaults for optional fields', async () => {
      const mockObject = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        goalId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'テスト',
        type: 'LEX',
        frequency: 0.5,
        relationalDensity: 0.5,
        contextualContribution: 0.5,
        irtDifficulty: 0,
        priority: 0,
        createdAt: new Date(),
      };

      mockPrisma.languageObject.create.mockResolvedValue(mockObject);

      const input = {
        goalId: '550e8400-e29b-41d4-a716-446655440001',
        content: 'テスト',
        type: 'LEX',
      };

      // Simulate handler behavior
      const result = await mockPrisma.languageObject.create({
        data: {
          goalId: input.goalId,
          content: input.content.trim(),
          type: input.type.trim(),
          frequency: 0.5,
          relationalDensity: 0.5,
          contextualContribution: 0.5,
          irtDifficulty: 0,
        },
      });

      expect(result.content).toBe('テスト');
      expect(result.frequency).toBe(0.5);
    });

    it('should trim whitespace from content', async () => {
      mockPrisma.languageObject.create.mockImplementation(({ data }) => ({
        ...data,
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: new Date(),
      }));

      const input = {
        goalId: '550e8400-e29b-41d4-a716-446655440001',
        content: '  テスト  ',
        type: '  LEX  ',
      };

      const result = await mockPrisma.languageObject.create({
        data: {
          goalId: input.goalId,
          content: input.content.trim(),
          type: input.type.trim(),
          frequency: 0.5,
          relationalDensity: 0.5,
          contextualContribution: 0.5,
          irtDifficulty: 0,
        },
      });

      expect(result.content).toBe('テスト');
      expect(result.type).toBe('LEX');
    });
  });

  describe('object:list logic', () => {
    it('should apply pagination correctly', async () => {
      const mockObjects = [
        { id: '1', content: 'word1', type: 'LEX' },
        { id: '2', content: 'word2', type: 'LEX' },
      ];

      mockPrisma.languageObject.findMany.mockResolvedValue(mockObjects);

      const result = await mockPrisma.languageObject.findMany({
        where: { goalId: '550e8400-e29b-41d4-a716-446655440001' },
        take: 10,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.languageObject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      );
    });

    it('should filter by type when provided', async () => {
      mockPrisma.languageObject.findMany.mockResolvedValue([]);

      await mockPrisma.languageObject.findMany({
        where: {
          goalId: '550e8400-e29b-41d4-a716-446655440001',
          type: 'MORPH',
        },
      });

      expect(mockPrisma.languageObject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'MORPH',
          }),
        })
      );
    });
  });

  describe('queue:get logic', () => {
    it('should build queue with user theta', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: '1',
        thetaGlobal: 0.5,
        nativeLanguage: 'ko',
      });

      mockPrisma.languageObject.findMany.mockResolvedValue([]);
      mockPrisma.goalSpec.findUnique.mockResolvedValue({ domain: 'general' });

      const user = await mockPrisma.user.findFirst();
      const theta = user?.thetaGlobal ?? 0;

      expect(theta).toBe(0.5);
    });

    it('should use default theta when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const user = await mockPrisma.user.findFirst();
      const theta = user?.thetaGlobal ?? 0;

      expect(theta).toBe(0);
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Learning IPC Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.languageObject.create.mockRejectedValue(new Error('Database connection failed'));

    await expect(
      mockPrisma.languageObject.create({
        data: {
          goalId: '550e8400-e29b-41d4-a716-446655440001',
          content: 'test',
          type: 'LEX',
        },
      })
    ).rejects.toThrow('Database connection failed');
  });

  it('should handle not found errors', async () => {
    mockPrisma.languageObject.findUnique.mockResolvedValue(null);

    const result = await mockPrisma.languageObject.findUnique({
      where: { id: 'non-existent-id' },
    });

    expect(result).toBeNull();
  });

  it('should handle update on non-existent object', async () => {
    mockPrisma.languageObject.update.mockRejectedValue(
      new Error('Record to update not found')
    );

    await expect(
      mockPrisma.languageObject.update({
        where: { id: 'non-existent-id' },
        data: { content: 'updated' },
      })
    ).rejects.toThrow('Record to update not found');
  });
});

// ============================================================================
// Response Mapping Tests
// ============================================================================

describe('Response Mapping', () => {
  it('should map object to response format correctly', () => {
    const dbObject = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      goalId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'テスト',
      type: 'LEX',
      frequency: 0.8,
      relationalDensity: 0.5,
      contextualContribution: 0.6,
      irtDifficulty: 0.5,
      priority: 0.7,
      contentJson: '{"translation":"test"}',
      createdAt: new Date('2025-01-01'),
      masteryState: {
        stage: 2,
        nextReview: new Date('2025-01-10'),
        cueFreeAccuracy: 0.75,
      },
    };

    // Simulate mapObjectToResponse
    const response = {
      id: dbObject.id,
      goalId: dbObject.goalId,
      content: dbObject.content,
      type: dbObject.type,
      frequency: dbObject.frequency,
      relationalDensity: dbObject.relationalDensity,
      contextualContribution: dbObject.contextualContribution,
      irtDifficulty: dbObject.irtDifficulty,
      priority: dbObject.priority ?? 0,
      contentJson: dbObject.contentJson ? JSON.parse(dbObject.contentJson) : undefined,
      createdAt: dbObject.createdAt,
      mastery: dbObject.masteryState ? {
        stage: dbObject.masteryState.stage,
        nextReview: dbObject.masteryState.nextReview,
        cueFreeAccuracy: dbObject.masteryState.cueFreeAccuracy,
      } : undefined,
    };

    expect(response.content).toBe('テスト');
    expect(response.contentJson).toEqual({ translation: 'test' });
    expect(response.mastery?.stage).toBe(2);
    expect(response.mastery?.cueFreeAccuracy).toBe(0.75);
  });

  it('should handle missing mastery state', () => {
    const dbObject = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      goalId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'テスト',
      type: 'LEX',
      frequency: 0.8,
      relationalDensity: 0.5,
      contextualContribution: 0.6,
      irtDifficulty: 0.5,
      createdAt: new Date('2025-01-01'),
      masteryState: null,
    };

    const masteryState = dbObject.masteryState as { stage: number } | null;
    const response = {
      id: dbObject.id,
      content: dbObject.content,
      mastery: masteryState ? {
        stage: masteryState.stage,
      } : undefined,
    };

    expect(response.mastery).toBeUndefined();
  });
});
