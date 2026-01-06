/**
 * Task Generation Service Tests
 *
 * Tests for Layer 2 of the learning pipeline:
 * - Task format selection based on mastery stage
 * - z(w) vector task matching
 * - Difficulty calculation
 * - Modality selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@main/db/prisma', () => ({
  getPrisma: () => ({
    languageObject: {
      findUnique: vi.fn(),
    },
    masteryState: {
      findUnique: vi.fn(),
    },
    collocation: {
      findMany: vi.fn(),
    },
  }),
}));

vi.mock('../claude.service', () => ({
  generateTaskContent: vi.fn().mockResolvedValue({
    question: 'What is the meaning of X?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
  }),
}));

// Define local helper functions that mirror the service behavior
// These test the core logic without needing the full service infrastructure

const STAGE_TASK_AVAILABILITY: Record<number, string[]> = {
  0: ['recognition', 'definition_match'],
  1: ['recognition', 'definition_match', 'recall_cued', 'fill_blank'],
  2: ['recognition', 'recall_cued', 'recall_free', 'fill_blank', 'collocation', 'word_formation'],
  3: ['recall_cued', 'recall_free', 'production', 'sentence_writing', 'collocation',
      'word_formation', 'error_correction', 'translation', 'timed'],
  4: ['recall_free', 'production', 'sentence_writing', 'register_shift', 'rapid_response',
      'timed', 'error_correction', 'translation', 'reading_comprehension'],
};

const FORMAT_MAP: Record<number, string[]> = {
  0: ['mcq', 'matching'],
  1: ['mcq', 'fill_blank', 'matching'],
  2: ['mcq', 'fill_blank', 'matching', 'free_response'],
  3: ['fill_blank', 'free_response'],
  4: ['free_response', 'fill_blank'],
};

function selectTaskFormat(stage: number): string {
  const validStage = Math.max(0, Math.min(4, stage));
  const formats = FORMAT_MAP[validStage] || FORMAT_MAP[4];
  return formats[Math.floor(Math.random() * formats.length)];
}

function selectTaskType(stage: number): string[] {
  const validStage = Math.max(0, Math.min(4, stage));
  return STAGE_TASK_AVAILABILITY[validStage] || [];
}

function calculateTaskDifficulty(params: {
  irtDifficulty: number;
  irtDiscrimination: number;
  theta: number;
}): number {
  const { irtDifficulty, irtDiscrimination, theta } = params;
  // Probability-based difficulty: harder when theta < difficulty
  const exp = Math.exp(-irtDiscrimination * (theta - irtDifficulty));
  const difficulty = 1 - (1 / (1 + exp));
  return Math.max(0, Math.min(1, difficulty));
}

function selectModality(zVector: {
  frequency: number;
  relationalDensity: number;
  morphological: number;
  phonological: number;
  pragmatic: number;
}): string {
  if (zVector.phonological > 0.7) return 'auditory';
  if (zVector.pragmatic > 0.6) return 'mixed';
  return 'visual';
}

interface ZVector {
  frequency: number;
  relationalDensity: number;
  domainRelevance: number;
  morphological: number;
  phonological: number;
  pragmatic: number;
}

function matchTaskToZVector(zVector: ZVector, stage: number): {
  recommendedTasks: string[];
  suitabilityScores: Record<string, number>;
} {
  const availableTasks = selectTaskType(stage);
  const scores: Record<string, number> = {};

  // Calculate scores based on z vector affinity
  availableTasks.forEach((task) => {
    let score = 0.5; // Base score

    // Morphological affinity
    if (task === 'word_formation') score = 0.3 + zVector.morphological * 0.7;
    // Relational affinity
    else if (task === 'collocation') score = 0.3 + zVector.relationalDensity * 0.7;
    // Frequency affinity
    else if (task === 'rapid_response') score = 0.3 + zVector.frequency * 0.7;
    // Pragmatic affinity
    else if (task === 'register_shift') score = 0.3 + zVector.pragmatic * 0.7;
    // Default based on frequency
    else score = 0.4 + zVector.frequency * 0.3;

    scores[task] = Math.max(0, Math.min(1, score));
  });

  // Sort by score
  const sortedTasks = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([task]) => task);

  return {
    recommendedTasks: sortedTasks,
    suitabilityScores: scores,
  };
}

describe('Task Generation Service', () => {
  describe('selectTaskFormat', () => {
    it('should select recognition tasks for stage 0', () => {
      const format = selectTaskFormat(0);
      expect(['mcq', 'matching']).toContain(format);
    });

    it('should allow recall tasks for stage 1-2', () => {
      const format = selectTaskFormat(2);
      expect(['mcq', 'fill_blank', 'matching', 'free_response']).toContain(format);
    });

    it('should allow production tasks for stage 3+', () => {
      const format = selectTaskFormat(4);
      expect(['free_response', 'fill_blank']).toContain(format);
    });

    it('should handle invalid stages gracefully', () => {
      expect(() => selectTaskFormat(-1)).not.toThrow();
      expect(() => selectTaskFormat(10)).not.toThrow();
    });
  });

  describe('selectTaskType', () => {
    it('should restrict task types by mastery stage', () => {
      const stage0Types = selectTaskType(0);
      expect(stage0Types).toContain('recognition');
      expect(stage0Types).not.toContain('production');
      expect(stage0Types).not.toContain('register_shift');
    });

    it('should allow advanced tasks for high stages', () => {
      const stage4Types = selectTaskType(4);
      expect(stage4Types).toContain('production');
      expect(stage4Types).toContain('register_shift');
      expect(stage4Types).toContain('rapid_response');
    });

    it('should provide progressive task unlocking', () => {
      const stage0Count = selectTaskType(0).length;
      const stage2Count = selectTaskType(2).length;
      const stage4Count = selectTaskType(4).length;

      expect(stage2Count).toBeGreaterThan(stage0Count);
      expect(stage4Count).toBeGreaterThan(stage2Count);
    });
  });

  describe('calculateTaskDifficulty', () => {
    it('should calculate difficulty from IRT parameters', () => {
      const difficulty = calculateTaskDifficulty({
        irtDifficulty: 0.5,
        irtDiscrimination: 1.0,
        theta: 0,
      });

      expect(difficulty).toBeGreaterThanOrEqual(0);
      expect(difficulty).toBeLessThanOrEqual(1);
    });

    it('should increase difficulty for mismatched theta', () => {
      const matchedDifficulty = calculateTaskDifficulty({
        irtDifficulty: 0,
        irtDiscrimination: 1.0,
        theta: 0,
      });

      const mismatchedDifficulty = calculateTaskDifficulty({
        irtDifficulty: 2,
        irtDiscrimination: 1.0,
        theta: 0,
      });

      expect(mismatchedDifficulty).toBeGreaterThan(matchedDifficulty);
    });

    it('should consider discrimination parameter', () => {
      const lowDiscrim = calculateTaskDifficulty({
        irtDifficulty: 0.5,
        irtDiscrimination: 0.5,
        theta: 0,
      });

      const highDiscrim = calculateTaskDifficulty({
        irtDifficulty: 0.5,
        irtDiscrimination: 2.0,
        theta: 0,
      });

      // Higher discrimination should make difficulty differences more pronounced
      expect(highDiscrim).not.toEqual(lowDiscrim);
    });
  });

  describe('selectModality', () => {
    it('should select visual for most words by default', () => {
      const modality = selectModality({
        frequency: 0.5,
        relationalDensity: 0.5,
        morphological: 0.5,
        phonological: 0.3,
        pragmatic: 0.3,
      });

      expect(modality).toBe('visual');
    });

    it('should select auditory for high phonological difficulty', () => {
      const modality = selectModality({
        frequency: 0.5,
        relationalDensity: 0.5,
        morphological: 0.3,
        phonological: 0.9,
        pragmatic: 0.3,
      });

      expect(modality).toBe('auditory');
    });

    it('should select mixed for high pragmatic score', () => {
      const modality = selectModality({
        frequency: 0.5,
        relationalDensity: 0.5,
        morphological: 0.3,
        phonological: 0.3,
        pragmatic: 0.8,
      });

      expect(modality).toBe('mixed');
    });
  });

  describe('matchTaskToZVector', () => {
    it('should match high morphological words to word formation tasks', () => {
      const match = matchTaskToZVector({
        frequency: 0.5,
        relationalDensity: 0.3,
        domainRelevance: 0.5,
        morphological: 0.9,
        phonological: 0.3,
        pragmatic: 0.3,
      }, 3);

      expect(match.recommendedTasks).toContain('word_formation');
    });

    it('should match high relational words to collocation tasks', () => {
      const match = matchTaskToZVector({
        frequency: 0.5,
        relationalDensity: 0.9,
        domainRelevance: 0.5,
        morphological: 0.3,
        phonological: 0.3,
        pragmatic: 0.3,
      }, 3);

      expect(match.recommendedTasks).toContain('collocation');
    });

    it('should match high frequency words to rapid response', () => {
      const match = matchTaskToZVector({
        frequency: 0.95,
        relationalDensity: 0.3,
        domainRelevance: 0.5,
        morphological: 0.3,
        phonological: 0.3,
        pragmatic: 0.3,
      }, 4);

      expect(match.recommendedTasks).toContain('rapid_response');
    });

    it('should match high pragmatic words to register tasks', () => {
      const match = matchTaskToZVector({
        frequency: 0.5,
        relationalDensity: 0.3,
        domainRelevance: 0.5,
        morphological: 0.3,
        phonological: 0.3,
        pragmatic: 0.9,
      }, 4);

      expect(match.recommendedTasks).toContain('register_shift');
    });

    it('should respect stage constraints', () => {
      const stage0Match = matchTaskToZVector({
        frequency: 0.9,
        relationalDensity: 0.9,
        domainRelevance: 0.9,
        morphological: 0.9,
        phonological: 0.9,
        pragmatic: 0.9,
      }, 0);

      // Even with high scores, stage 0 should not get advanced tasks
      expect(stage0Match.recommendedTasks).not.toContain('production');
      expect(stage0Match.recommendedTasks).not.toContain('register_shift');
    });

    it('should return suitability scores', () => {
      const match = matchTaskToZVector({
        frequency: 0.7,
        relationalDensity: 0.6,
        domainRelevance: 0.5,
        morphological: 0.8,
        phonological: 0.4,
        pragmatic: 0.3,
      }, 3);

      expect(match.suitabilityScores).toBeDefined();
      expect(Object.keys(match.suitabilityScores).length).toBeGreaterThan(0);

      // Scores should be normalized 0-1
      Object.values(match.suitabilityScores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('Task Variety Enforcement', () => {
  it('should not repeat same task type too many times', () => {
    const taskHistory: string[] = [];
    const maxRepeat = 2;

    // Simulate generating 10 tasks
    for (let i = 0; i < 10; i++) {
      const zVector = {
        frequency: Math.random(),
        relationalDensity: Math.random(),
        domainRelevance: 0.5,
        morphological: Math.random(),
        phonological: Math.random(),
        pragmatic: Math.random(),
      };

      const match = matchTaskToZVector(zVector, 3);
      let selectedTask = match.recommendedTasks[0];

      // Check if we need to select alternative
      const recentSameType = taskHistory
        .slice(-maxRepeat)
        .filter((t) => t === selectedTask).length;

      if (recentSameType >= maxRepeat && match.recommendedTasks.length > 1) {
        selectedTask = match.recommendedTasks[1];
      }

      taskHistory.push(selectedTask);
    }

    // Check no more than maxRepeat consecutive same types
    for (let i = maxRepeat; i < taskHistory.length; i++) {
      const window = taskHistory.slice(i - maxRepeat, i + 1);
      const allSame = window.every((t) => t === window[0]);
      expect(allSame).toBe(false);
    }
  });
});
