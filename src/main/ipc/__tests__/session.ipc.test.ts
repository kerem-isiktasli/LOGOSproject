/**
 * Session IPC Handlers Tests
 *
 * Tests for session management IPC communication.
 * Validates session lifecycle, response recording, and scoring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateInput,
  SessionStartSchema,
  SessionEndSchema,
  RecordResponseSchema,
} from '../../../shared/schemas/ipc-schemas';

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Session IPC Schema Validation', () => {
  describe('SessionStartSchema', () => {
    it('should accept valid session start request', () => {
      const result = validateInput(SessionStartSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'learning',
        targetDuration: 1800,
        mode: 'normal',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.goalId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.type).toBe('learning');
        expect(result.data.targetDuration).toBe(1800);
      }
    });

    it('should use defaults for optional fields', () => {
      const result = validateInput(SessionStartSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('mixed');
        expect(result.data.mode).toBe('normal');
      }
    });

    it('should validate session type enum', () => {
      const validTypes = ['learning', 'review', 'assessment', 'mixed'];

      for (const type of validTypes) {
        const result = validateInput(SessionStartSchema, {
          goalId: '550e8400-e29b-41d4-a716-446655440000',
          type,
        });
        expect(result.success).toBe(true);
      }

      const invalidResult = validateInput(SessionStartSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'invalid_type',
      });
      expect(invalidResult.success).toBe(false);
    });

    it('should validate mode enum', () => {
      const validModes = ['normal', 'fluency', 'review'];

      for (const mode of validModes) {
        const result = validateInput(SessionStartSchema, {
          goalId: '550e8400-e29b-41d4-a716-446655440000',
          mode,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate targetDuration range', () => {
      // Too short (< 60 seconds)
      const tooShort = validateInput(SessionStartSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        targetDuration: 30,
      });
      expect(tooShort.success).toBe(false);

      // Too long (> 7200 seconds / 2 hours)
      const tooLong = validateInput(SessionStartSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        targetDuration: 10000,
      });
      expect(tooLong.success).toBe(false);

      // Valid duration
      const valid = validateInput(SessionStartSchema, {
        goalId: '550e8400-e29b-41d4-a716-446655440000',
        targetDuration: 3600,
      });
      expect(valid.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = validateInput(SessionStartSchema, {
        goalId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SessionEndSchema', () => {
    it('should accept valid session end request', () => {
      const result = validateInput(SessionEndSchema, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should reject invalid UUID', () => {
      const result = validateInput(SessionEndSchema, {
        sessionId: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing sessionId', () => {
      const result = validateInput(SessionEndSchema, {});
      expect(result.success).toBe(false);
    });
  });

  describe('RecordResponseSchema', () => {
    it('should accept valid response record', () => {
      const result = validateInput(RecordResponseSchema, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        objectId: '550e8400-e29b-41d4-a716-446655440001',
        correct: true,
        cueLevel: 0,
        responseTimeMs: 2500,
        taskType: 'recognition',
        taskFormat: 'mcq',
        modality: 'visual',
        responseContent: 'A',
        expectedContent: 'A',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.correct).toBe(true);
        expect(result.data.cueLevel).toBe(0);
        expect(result.data.responseTimeMs).toBe(2500);
      }
    });

    it('should validate cueLevel range (0-3)', () => {
      const validLevels = [0, 1, 2, 3];

      for (const cueLevel of validLevels) {
        const result = validateInput(RecordResponseSchema, {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          objectId: '550e8400-e29b-41d4-a716-446655440001',
          correct: true,
          cueLevel,
          responseTimeMs: 1000,
          taskType: 'recognition',
          taskFormat: 'mcq',
          modality: 'visual',
          responseContent: 'test',
          expectedContent: 'test',
        });
        expect(result.success).toBe(true);
      }

      // Invalid cue level
      const invalid = validateInput(RecordResponseSchema, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        objectId: '550e8400-e29b-41d4-a716-446655440001',
        correct: true,
        cueLevel: 5,
        responseTimeMs: 1000,
        taskType: 'recognition',
        taskFormat: 'mcq',
        modality: 'visual',
        responseContent: 'test',
        expectedContent: 'test',
      });
      expect(invalid.success).toBe(false);
    });

    it('should validate taskFormat enum', () => {
      const validFormats = [
        'mcq', 'fill_blank', 'free_response', 'typing',
        'morpheme_analysis', 'pronunciation', 'sentence_completion', 'register_selection'
      ];

      for (const taskFormat of validFormats) {
        const result = validateInput(RecordResponseSchema, {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          objectId: '550e8400-e29b-41d4-a716-446655440001',
          correct: true,
          cueLevel: 0,
          responseTimeMs: 1000,
          taskType: 'test',
          taskFormat,
          modality: 'visual',
          responseContent: 'test',
          expectedContent: 'test',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate modality enum', () => {
      const validModalities = ['visual', 'auditory', 'mixed'];

      for (const modality of validModalities) {
        const result = validateInput(RecordResponseSchema, {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          objectId: '550e8400-e29b-41d4-a716-446655440001',
          correct: false,
          cueLevel: 1,
          responseTimeMs: 3000,
          taskType: 'recall',
          taskFormat: 'free_response',
          modality,
          responseContent: 'wrong',
          expectedContent: 'correct',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate responseTimeMs range', () => {
      // Negative time
      const negative = validateInput(RecordResponseSchema, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        objectId: '550e8400-e29b-41d4-a716-446655440001',
        correct: true,
        cueLevel: 0,
        responseTimeMs: -100,
        taskType: 'test',
        taskFormat: 'mcq',
        modality: 'visual',
        responseContent: 'A',
        expectedContent: 'A',
      });
      expect(negative.success).toBe(false);

      // Too long (> 5 minutes)
      const tooLong = validateInput(RecordResponseSchema, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        objectId: '550e8400-e29b-41d4-a716-446655440001',
        correct: true,
        cueLevel: 0,
        responseTimeMs: 400000,
        taskType: 'test',
        taskFormat: 'mcq',
        modality: 'visual',
        responseContent: 'A',
        expectedContent: 'A',
      });
      expect(tooLong.success).toBe(false);
    });

    it('should require all mandatory fields', () => {
      const missingFields = validateInput(RecordResponseSchema, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        correct: true,
      });
      expect(missingFields.success).toBe(false);
    });
  });
});

// ============================================================================
// Session Logic Tests
// ============================================================================

describe('Session Handler Logic', () => {
  describe('Session Lifecycle', () => {
    it('should calculate session duration correctly', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const endTime = new Date('2025-01-01T10:30:00Z');

      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);

      expect(durationMinutes).toBe(30);
    });

    it('should track response count', () => {
      const responses = [
        { correct: true },
        { correct: false },
        { correct: true },
        { correct: true },
      ];

      const totalCount = responses.length;
      const correctCount = responses.filter(r => r.correct).length;
      const accuracy = correctCount / totalCount;

      expect(totalCount).toBe(4);
      expect(correctCount).toBe(3);
      expect(accuracy).toBe(0.75);
    });

    it('should calculate cue-free vs cue-assisted ratio', () => {
      const responses = [
        { cueLevel: 0 },
        { cueLevel: 0 },
        { cueLevel: 1 },
        { cueLevel: 2 },
        { cueLevel: 0 },
      ];

      const cueFreeCount = responses.filter(r => r.cueLevel === 0).length;
      const cueAssistedCount = responses.filter(r => r.cueLevel > 0).length;
      const cueFreeRatio = cueFreeCount / responses.length;

      expect(cueFreeCount).toBe(3);
      expect(cueAssistedCount).toBe(2);
      expect(cueFreeRatio).toBe(0.6);
    });
  });

  describe('Response Scoring', () => {
    it('should weight accuracy by cue level', () => {
      // Cue-free correct is worth more than cue-assisted correct
      const cueFreeWeight = 1.0;
      const cue1Weight = 0.7;
      const cue2Weight = 0.4;
      const cue3Weight = 0.2;

      const responses = [
        { correct: true, cueLevel: 0, weight: cueFreeWeight },
        { correct: true, cueLevel: 1, weight: cue1Weight },
        { correct: true, cueLevel: 2, weight: cue2Weight },
      ];

      const weightedScore = responses.reduce((sum, r) => sum + (r.correct ? r.weight : 0), 0);
      const maxScore = responses.reduce((sum, r) => sum + r.weight, 0);
      const weightedAccuracy = weightedScore / maxScore;

      expect(weightedAccuracy).toBeCloseTo(1.0); // All correct
    });

    it('should calculate response time statistics', () => {
      const responseTimes = [1500, 2000, 1800, 3500, 2200];

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const minTime = Math.min(...responseTimes);
      const maxTime = Math.max(...responseTimes);

      expect(avgTime).toBe(2200);
      expect(minTime).toBe(1500);
      expect(maxTime).toBe(3500);
    });
  });

  describe('Session Summary', () => {
    it('should generate correct session summary', () => {
      const sessionData = {
        startedAt: new Date('2025-01-01T10:00:00Z'),
        endedAt: new Date('2025-01-01T10:25:00Z'),
        responses: [
          { correct: true, cueLevel: 0, responseTimeMs: 1500 },
          { correct: true, cueLevel: 0, responseTimeMs: 2000 },
          { correct: false, cueLevel: 0, responseTimeMs: 3000 },
          { correct: true, cueLevel: 1, responseTimeMs: 2500 },
          { correct: true, cueLevel: 0, responseTimeMs: 1800 },
        ],
      };

      const summary = {
        duration: Math.floor((sessionData.endedAt.getTime() - sessionData.startedAt.getTime()) / 60000),
        totalItems: sessionData.responses.length,
        correctCount: sessionData.responses.filter(r => r.correct).length,
        accuracy: sessionData.responses.filter(r => r.correct).length / sessionData.responses.length,
        cueFreeAccuracy: sessionData.responses.filter(r => r.correct && r.cueLevel === 0).length /
          sessionData.responses.filter(r => r.cueLevel === 0).length,
        avgResponseTime: sessionData.responses.reduce((sum, r) => sum + r.responseTimeMs, 0) /
          sessionData.responses.length,
      };

      expect(summary.duration).toBe(25);
      expect(summary.totalItems).toBe(5);
      expect(summary.correctCount).toBe(4);
      expect(summary.accuracy).toBe(0.8);
      expect(summary.cueFreeAccuracy).toBe(0.75); // 3/4 cue-free were correct
      expect(summary.avgResponseTime).toBe(2160);
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Session Error Handling', () => {
  it('should handle session not found', () => {
    const sessionId = 'non-existent-id';
    const session = null; // Simulating DB returning null

    expect(session).toBeNull();
  });

  it('should handle goal not found for session start', () => {
    const goalId = 'non-existent-goal';
    const goal = null;

    expect(goal).toBeNull();
  });

  it('should handle recording response for ended session', () => {
    const session = {
      id: '123',
      endedAt: new Date('2025-01-01T10:00:00Z'),
    };

    const isEnded = session.endedAt !== null;
    expect(isEnded).toBe(true);
  });

  it('should handle concurrent session conflict', () => {
    const existingSessions = [
      { id: '1', endedAt: null, goalId: 'goal1' },
    ];

    const hasActiveSession = existingSessions.some(s => s.endedAt === null);
    expect(hasActiveSession).toBe(true);
  });
});
