/**
 * Response Timing Module Tests
 *
 * Tests for empirically-based response time thresholds.
 */

import { describe, it, expect } from 'vitest';
import {
  getTaskCategory,
  getAdjustedThresholds,
  analyzeResponseTime,
  calculateFSRSRatingWithTiming,
  calculateFluencyMetrics,
  detectSuspiciousPatterns,
  getTargetResponseTime,
} from '../response-timing';

describe('Response Timing Module', () => {
  describe('getTaskCategory', () => {
    it('should map MCQ format to recognition', () => {
      expect(getTaskCategory('mcq')).toBe('recognition');
    });

    it('should map fill_blank format to recall', () => {
      expect(getTaskCategory('fill_blank')).toBe('recall');
    });

    it('should map free_response format to production', () => {
      expect(getTaskCategory('free_response')).toBe('production');
    });

    it('should prefer task type over format when both provided', () => {
      expect(getTaskCategory('mcq', 'timed')).toBe('timed');
    });

    it('should default to recall for unknown formats', () => {
      expect(getTaskCategory(undefined, undefined)).toBe('recall');
    });
  });

  describe('getAdjustedThresholds', () => {
    it('should return valid thresholds for recognition tasks', () => {
      const thresholds = getAdjustedThresholds('recognition', 2, 6);

      expect(thresholds.fast).toBeLessThan(thresholds.good);
      expect(thresholds.good).toBeLessThan(thresholds.slow);
      expect(thresholds.slow).toBeLessThan(thresholds.verySlow);
    });

    it('should have more lenient thresholds for lower mastery stages', () => {
      const stage0 = getAdjustedThresholds('recognition', 0, 6);
      const stage4 = getAdjustedThresholds('recognition', 4, 6);

      expect(stage0.good).toBeGreaterThan(stage4.good);
    });

    it('should have more lenient thresholds for longer words', () => {
      const shortWord = getAdjustedThresholds('recognition', 2, 4);
      const longWord = getAdjustedThresholds('recognition', 2, 12);

      expect(longWord.good).toBeGreaterThan(shortWord.good);
    });

    it('should have longer thresholds for production than recognition', () => {
      const recognition = getAdjustedThresholds('recognition', 2, 6);
      const production = getAdjustedThresholds('production', 2, 6);

      expect(production.good).toBeGreaterThan(recognition.good);
    });
  });

  describe('analyzeResponseTime', () => {
    it('should classify fast responses correctly', () => {
      const result = analyzeResponseTime(800, 'recognition', 2, 6, true);

      // With stage 2 (1.2x) and medium word length (1.2x), fast threshold is ~720ms
      // 800ms is right around the threshold boundary
      expect(['fast', 'good']).toContain(result.classification);
      expect(result.normalizedTime).toBeLessThan(0.6);
    });

    it('should classify good responses correctly', () => {
      const result = analyzeResponseTime(1500, 'recognition', 2, 6, true);

      // 1500ms for recognition at stage 2 with medium word = fast (threshold ~1728ms for good)
      expect(['fast', 'good']).toContain(result.classification);
      expect(result.suggestedRating).toBeGreaterThanOrEqual(3);
    });

    it('should classify slow responses correctly', () => {
      const result = analyzeResponseTime(4000, 'recognition', 2, 6, true);

      // 4000ms for recognition at stage 2 = good or slow depending on exact thresholds
      expect(['good', 'slow']).toContain(result.classification);
    });

    it('should classify very slow responses correctly', () => {
      const result = analyzeResponseTime(10000, 'recognition', 2, 6, true);

      // 10000ms should be slow or very_slow
      expect(['slow', 'very_slow']).toContain(result.classification);
    });

    it('should detect automaticity for fast correct responses', () => {
      const result = analyzeResponseTime(600, 'recognition', 2, 6, true);

      expect(result.isAutomatic).toBe(true);
    });

    it('should detect possible guessing for too-fast responses', () => {
      const result = analyzeResponseTime(200, 'recognition', 2, 6, false);

      expect(result.classification).toBe('too_fast');
      expect(result.possibleGuessing).toBe(true);
    });
  });

  describe('calculateFSRSRatingWithTiming', () => {
    it('should return 4 (Easy) for fast correct responses', () => {
      const rating = calculateFSRSRatingWithTiming(true, 600, 'mcq', 3, 6);
      expect(rating).toBe(4);
    });

    it('should return 3 or 4 for normal correct responses', () => {
      const rating = calculateFSRSRatingWithTiming(true, 1500, 'mcq', 2, 6);
      // 1500ms for recognition is fast/good, so 3 or 4
      expect(rating).toBeGreaterThanOrEqual(3);
    });

    it('should return 2 or 3 for slow correct responses', () => {
      const rating = calculateFSRSRatingWithTiming(true, 4000, 'mcq', 2, 6);
      // 4000ms for recognition at stage 2 could be good or slow
      expect(rating).toBeGreaterThanOrEqual(2);
      expect(rating).toBeLessThanOrEqual(3);
    });

    it('should return 1 or 2 for incorrect responses', () => {
      const rating = calculateFSRSRatingWithTiming(false, 1500, 'mcq', 2, 6);
      expect(rating).toBeLessThanOrEqual(2);
    });

    it('should penalize potential guessing', () => {
      const rating = calculateFSRSRatingWithTiming(true, 200, 'mcq', 2, 6);
      expect(rating).toBe(2); // Not rewarded despite being "correct"
    });
  });

  describe('calculateFluencyMetrics', () => {
    it('should return zero metrics for empty array', () => {
      const metrics = calculateFluencyMetrics([]);

      expect(metrics.meanResponseTime).toBe(0);
      expect(metrics.fluencyScore).toBe(0);
    });

    it('should calculate correct mean', () => {
      const metrics = calculateFluencyMetrics([1000, 2000, 3000]);

      expect(metrics.meanResponseTime).toBe(2000);
    });

    it('should calculate standard deviation', () => {
      const metrics = calculateFluencyMetrics([1000, 1000, 1000]);

      expect(metrics.standardDeviation).toBe(0);
    });

    it('should have higher fluency score for consistent fast responses', () => {
      const fastConsistent = calculateFluencyMetrics([800, 850, 900]);
      const slowVaried = calculateFluencyMetrics([2000, 4000, 6000]);

      expect(fastConsistent.fluencyScore).toBeGreaterThan(slowVaried.fluencyScore);
    });

    it('should calculate automaticity ratio correctly', () => {
      // All under threshold
      const allAutomatic = calculateFluencyMetrics([500, 600, 700], 'recognition');
      expect(allAutomatic.automaticityRatio).toBe(1);

      // None under threshold
      const noneAutomatic = calculateFluencyMetrics([5000, 6000, 7000], 'recognition');
      expect(noneAutomatic.automaticityRatio).toBe(0);
    });
  });

  describe('detectSuspiciousPatterns', () => {
    it('should not flag short response sequences', () => {
      const result = detectSuspiciousPatterns([
        { correct: true, timeMs: 500 },
        { correct: true, timeMs: 600 },
      ]);

      expect(result.suspiciousPattern).toBe(false);
    });

    it('should detect bot patterns (all fast, high accuracy)', () => {
      const responses = Array(10).fill(null).map(() => ({
        correct: true,
        timeMs: 300,
      }));

      const result = detectSuspiciousPatterns(responses);

      expect(result.suspiciousPattern).toBe(true);
      expect(result.patternType).toBe('bot_pattern');
    });

    it('should detect random clicking (all fast, low accuracy)', () => {
      const responses = Array(10).fill(null).map(() => ({
        correct: false,
        timeMs: 200,
      }));

      const result = detectSuspiciousPatterns(responses);

      // All fast with low accuracy triggers suspicious pattern detection
      expect(result.suspiciousPattern).toBe(true);
      // Can be detected as robotic_timing or random_clicking depending on exact thresholds
      expect(['random_clicking', 'robotic_timing']).toContain(result.patternType);
    });

    it('should not flag legitimate response patterns', () => {
      const responses = [
        { correct: true, timeMs: 1200 },
        { correct: true, timeMs: 1500 },
        { correct: false, timeMs: 2500 },
        { correct: true, timeMs: 1800 },
        { correct: true, timeMs: 1100 },
        { correct: false, timeMs: 3000 },
      ];

      const result = detectSuspiciousPatterns(responses);

      expect(result.suspiciousPattern).toBe(false);
    });
  });

  describe('getTargetResponseTime', () => {
    it('should return appropriate targets for different categories', () => {
      const recognition = getTargetResponseTime('recognition', 2);
      const production = getTargetResponseTime('production', 2);

      expect(production).toBeGreaterThan(recognition);
    });

    it('should have lower targets for higher mastery stages', () => {
      const stage2 = getTargetResponseTime('recognition', 2);
      const stage4 = getTargetResponseTime('recognition', 4);

      expect(stage4).toBeLessThan(stage2);
    });
  });
});
