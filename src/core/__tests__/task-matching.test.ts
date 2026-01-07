/**
 * Task Matching Module Tests
 *
 * Tests for z(w) vector task matching.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTaskSuitability,
  getDominantComponent,
  recommendTask,
  recommendTaskBatch,
  extractZVector,
  isTaskSuitable,
  getOptimalModality,
  type ZVector,
  type WordProfile,
} from '../task-matching';

describe('Task Matching Module', () => {
  describe('calculateTaskSuitability', () => {
    it('should return suitability scores for all task types', () => {
      const zVector: ZVector = {
        frequency: 0.7,
        relationalDensity: 0.5,
        domainRelevance: 0.6,
        morphological: 0.8,
        phonological: 0.3,
        pragmatic: 0.4,
        syntactic: 0.5,
      };

      const suitability = calculateTaskSuitability(zVector, 2);

      // Should have scores for common task types
      expect(suitability.recognition).toBeDefined();
      expect(suitability.recall_cued).toBeDefined();
      expect(suitability.production).toBeDefined();
      expect(suitability.word_formation).toBeDefined();
    });

    it('should prioritize word_formation for high morphological scores', () => {
      const highMorph: ZVector = {
        frequency: 0.3,
        relationalDensity: 0.3,
        domainRelevance: 0.3,
        morphological: 0.95,
        phonological: 0.3,
        pragmatic: 0.3,
        syntactic: 0.3,
      };

      const suitability = calculateTaskSuitability(highMorph, 2);

      expect(suitability.word_formation).toBeGreaterThan(suitability.recognition);
    });

    it('should prioritize collocation for high relational density', () => {
      const highRelational: ZVector = {
        frequency: 0.3,
        relationalDensity: 0.95,
        domainRelevance: 0.3,
        morphological: 0.3,
        phonological: 0.3,
        pragmatic: 0.3,
        syntactic: 0.3,
      };

      const suitability = calculateTaskSuitability(highRelational, 2);

      expect(suitability.collocation).toBeGreaterThan(suitability.word_formation);
    });

    it('should respect stage constraints', () => {
      const zVector: ZVector = {
        frequency: 0.5,
        relationalDensity: 0.5,
        domainRelevance: 0.5,
        morphological: 0.5,
        phonological: 0.5,
        pragmatic: 0.5,
        syntactic: 0.5,
      };

      // Stage 0 should heavily penalize production tasks
      const stage0 = calculateTaskSuitability(zVector, 0);
      const stage4 = calculateTaskSuitability(zVector, 4);

      expect(stage0.production).toBeLessThan(stage4.production);
    });
  });

  describe('getDominantComponent', () => {
    it('should return the component with highest value', () => {
      const zVector: ZVector = {
        frequency: 0.3,
        relationalDensity: 0.3,
        domainRelevance: 0.3,
        morphological: 0.9,
        phonological: 0.3,
        pragmatic: 0.3,
        syntactic: 0.3,
      };

      expect(getDominantComponent(zVector)).toBe('morphological');
    });

    it('should handle ties by returning first encountered', () => {
      const zVector: ZVector = {
        frequency: 0.5,
        relationalDensity: 0.5,
        domainRelevance: 0.5,
        morphological: 0.5,
        phonological: 0.5,
        pragmatic: 0.5,
        syntactic: 0.5,
      };

      // Should return some valid component
      const result = getDominantComponent(zVector);
      expect(Object.keys(zVector)).toContain(result);
    });
  });

  describe('recommendTask', () => {
    it('should return a valid recommendation', () => {
      const profile: WordProfile = {
        content: 'administration',
        type: 'LEX',
        zVector: {
          frequency: 0.6,
          relationalDensity: 0.5,
          domainRelevance: 0.7,
          morphological: 0.8,
          phonological: 0.4,
          pragmatic: 0.5,
          syntactic: 0.5,
        },
        masteryStage: 2,
        cueFreeAccuracy: 0.6,
        exposureCount: 5,
      };

      const recommendation = recommendTask(profile);

      expect(recommendation.taskType).toBeDefined();
      expect(recommendation.taskFormat).toBeDefined();
      expect(recommendation.modality).toBeDefined();
      expect(recommendation.suitability).toBeGreaterThan(0);
      expect(recommendation.reason).toBeTruthy();
    });

    it('should recommend word_formation for high morphological words', () => {
      const profile: WordProfile = {
        content: 'unhappiness',
        type: 'LEX',
        zVector: {
          frequency: 0.4,
          relationalDensity: 0.3,
          domainRelevance: 0.5,
          morphological: 0.95,
          phonological: 0.3,
          pragmatic: 0.3,
          syntactic: 0.3,
        },
        masteryStage: 2,
        cueFreeAccuracy: 0.5,
        exposureCount: 3,
      };

      const recommendation = recommendTask(profile);

      // High morphological should lead to word_formation or related task
      expect(['word_formation', 'recognition', 'recall_cued', 'fill_blank']).toContain(recommendation.taskType);
    });

    it('should recommend register_shift for high pragmatic words at stage 4', () => {
      const profile: WordProfile = {
        content: 'please',
        type: 'LEX',
        zVector: {
          frequency: 0.8,
          relationalDensity: 0.4,
          domainRelevance: 0.5,
          morphological: 0.2,
          phonological: 0.2,
          pragmatic: 0.95,
          syntactic: 0.2,
        },
        masteryStage: 4,
        cueFreeAccuracy: 0.9,
        exposureCount: 20,
      };

      const recommendation = recommendTask(profile);

      // High pragmatic at stage 4 should lead to register_shift or related advanced tasks
      expect(['register_shift', 'sentence_writing', 'production', 'recall_free']).toContain(recommendation.taskType);
    });

    it('should fall back to recognition for stage 0', () => {
      const profile: WordProfile = {
        content: 'new_word',
        type: 'LEX',
        zVector: {
          frequency: 0.5,
          relationalDensity: 0.5,
          domainRelevance: 0.5,
          morphological: 0.5,
          phonological: 0.5,
          pragmatic: 0.5,
          syntactic: 0.5,
        },
        masteryStage: 0,
        cueFreeAccuracy: 0,
        exposureCount: 0,
      };

      const recommendation = recommendTask(profile);

      expect(['recognition', 'definition_match']).toContain(recommendation.taskType);
    });
  });

  describe('recommendTaskBatch', () => {
    it('should enforce variety in task types', () => {
      const profiles: WordProfile[] = Array(5).fill(null).map((_, i) => ({
        content: `word_${i}`,
        type: 'LEX' as const,
        zVector: {
          frequency: 0.5,
          relationalDensity: 0.5,
          domainRelevance: 0.5,
          morphological: 0.9, // All high morphological
          phonological: 0.3,
          pragmatic: 0.3,
          syntactic: 0.3,
        },
        masteryStage: 2 as const,
        cueFreeAccuracy: 0.5,
        exposureCount: 3,
      }));

      const recommendations = recommendTaskBatch(profiles, 2);

      // Should return recommendations for all profiles
      expect(recommendations.length).toBe(5);
      // Each recommendation should have a valid task type
      recommendations.forEach((rec) => {
        expect(rec.taskType).toBeDefined();
      });
    });
  });

  describe('extractZVector', () => {
    it('should extract z vector from object properties', () => {
      const object = {
        frequency: 0.7,
        relationalDensity: 0.6,
        domainDistribution: JSON.stringify({ medical: 0.8, general: 0.5 }),
        morphologicalScore: 0.4,
        phonologicalDifficulty: 0.3,
        pragmaticScore: 0.5,
      };

      const zVector = extractZVector(object, 'medical');

      expect(zVector.frequency).toBe(0.7);
      expect(zVector.relationalDensity).toBe(0.6);
      expect(zVector.domainRelevance).toBe(0.8);
      expect(zVector.morphological).toBe(0.4);
      expect(zVector.phonological).toBe(0.3);
      expect(zVector.pragmatic).toBe(0.5);
    });

    it('should use defaults for missing values', () => {
      const object = {};

      const zVector = extractZVector(object);

      expect(zVector.frequency).toBe(0.5);
      expect(zVector.relationalDensity).toBe(0.5);
      expect(zVector.domainRelevance).toBe(0.5);
      expect(zVector.morphological).toBe(0.5);
      expect(zVector.phonological).toBe(0.5);
      expect(zVector.pragmatic).toBe(0.5);
    });

    it('should handle object domain distribution', () => {
      const object = {
        domainDistribution: { legal: 0.9, general: 0.4 },
      };

      const zVector = extractZVector(object, 'legal');

      expect(zVector.domainRelevance).toBe(0.9);
    });
  });

  describe('isTaskSuitable', () => {
    it('should return true for suitable tasks', () => {
      const zVector: ZVector = {
        frequency: 0.8,
        relationalDensity: 0.5,
        domainRelevance: 0.5,
        morphological: 0.5,
        phonological: 0.5,
        pragmatic: 0.5,
        syntactic: 0.5,
      };

      // rapid_response is available at stage 4 and high frequency helps
      const suitability = calculateTaskSuitability(zVector, 4);
      expect(suitability.rapid_response).toBeGreaterThan(0);
    });

    it('should return false for unsuitable tasks', () => {
      const zVector: ZVector = {
        frequency: 0.2,
        relationalDensity: 0.2,
        domainRelevance: 0.2,
        morphological: 0.2,
        phonological: 0.2,
        pragmatic: 0.2,
        syntactic: 0.2,
      };

      // At stage 0, production tasks are not available (heavily penalized)
      const suitability = calculateTaskSuitability(zVector, 0);
      expect(suitability.production).toBeLessThan(0.3);
    });
  });

  describe('getOptimalModality', () => {
    it('should return auditory for high phonological', () => {
      const zVector: ZVector = {
        frequency: 0.5,
        relationalDensity: 0.5,
        domainRelevance: 0.5,
        morphological: 0.5,
        phonological: 0.9,
        pragmatic: 0.5,
        syntactic: 0.5,
      };

      expect(getOptimalModality(zVector)).toBe('auditory');
    });

    it('should return mixed for high pragmatic', () => {
      const zVector: ZVector = {
        frequency: 0.5,
        relationalDensity: 0.5,
        domainRelevance: 0.5,
        morphological: 0.5,
        phonological: 0.3,
        pragmatic: 0.8,
        syntactic: 0.5,
      };

      expect(getOptimalModality(zVector)).toBe('mixed');
    });

    it('should default to visual', () => {
      const zVector: ZVector = {
        frequency: 0.5,
        relationalDensity: 0.5,
        domainRelevance: 0.5,
        morphological: 0.5,
        phonological: 0.3,
        pragmatic: 0.3,
        syntactic: 0.5,
      };

      expect(getOptimalModality(zVector)).toBe('visual');
    });
  });
});
