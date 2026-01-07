/**
 * Response Timing Module
 *
 * Implements empirically-derived response time thresholds for vocabulary learning tasks.
 * Based on lexical decision task research and vocabulary acquisition studies.
 *
 * Academic References:
 * - Yap, M.J. & Balota, D.A. (2015). Visual word recognition. In Pollatsek & Treiman (Eds.),
 *   The Oxford Handbook of Reading.
 * - Harrington, M. (2006). The lexical decision task as a measure of L2 lexical proficiency.
 *   EUROSLA Yearbook, 6, 147-168.
 * - Segalowitz, N. & Hulstijn, J. (2005). Automaticity in bilingualism and second language
 *   learning. In Kroll & De Groot (Eds.), Handbook of Bilingualism.
 *
 * Key findings from literature:
 * - Native speakers: 400-600ms for high-frequency words (lexical decision)
 * - L2 proficient: 600-900ms for known words
 * - L2 intermediate: 900-1500ms for familiar words
 * - Production tasks require 1.5-3x longer than recognition
 * - Automaticity threshold: <1000ms for recognition, <2000ms for production
 *
 * @module core/response-timing
 */

import type { TaskFormat, TaskType, MasteryStage, FSRSRating } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Response time thresholds for a specific task configuration.
 */
export interface ResponseTimeThresholds {
  /** Fast response (indicates automaticity or guessing) */
  fast: number;
  /** Good response (efficient processing) */
  good: number;
  /** Slow response (effortful retrieval) */
  slow: number;
  /** Very slow (retrieval failure risk) */
  verySlow: number;
}

/**
 * Task type categories for threshold selection.
 */
export type TaskCategory =
  | 'recognition'       // MCQ, matching - identify correct answer
  | 'recall'            // Fill-blank, cued recall - retrieve from memory
  | 'production'        // Free response, sentence writing - generate language
  | 'timed';            // Rapid response - fluency/automaticity focus

/**
 * Response time analysis result.
 */
export interface ResponseTimeAnalysis {
  /** Original response time in ms */
  responseTimeMs: number;
  /** Task category used for analysis */
  taskCategory: TaskCategory;
  /** Normalized response time (0-1 scale, lower is better) */
  normalizedTime: number;
  /** Classification of response speed */
  classification: 'too_fast' | 'fast' | 'good' | 'slow' | 'very_slow';
  /** FSRS rating suggestion based on timing */
  suggestedRating: FSRSRating;
  /** Whether response indicates automaticity */
  isAutomatic: boolean;
  /** Whether response time suggests guessing */
  possibleGuessing: boolean;
  /** Confidence in classification (0-1) */
  confidence: number;
}

/**
 * Fluency metrics for automaticity assessment.
 */
export interface FluencyMetrics {
  /** Average response time in ms */
  meanResponseTime: number;
  /** Standard deviation of response times */
  standardDeviation: number;
  /** Coefficient of variation (lower = more consistent = more automatic) */
  coefficientOfVariation: number;
  /** Proportion of responses within automaticity threshold */
  automaticityRatio: number;
  /** Fluency score (0-1, higher = more fluent) */
  fluencyScore: number;
}

// =============================================================================
// Empirically-Derived Thresholds
// =============================================================================

/**
 * Base thresholds by task category (in milliseconds).
 * Derived from lexical decision task literature and adjusted for L2 learners.
 */
const BASE_THRESHOLDS: Record<TaskCategory, ResponseTimeThresholds> = {
  recognition: {
    fast: 500,       // Under 500ms may indicate guessing on MCQ
    good: 1200,      // Efficient lexical access
    slow: 3000,      // Effortful but successful retrieval
    verySlow: 6000,  // Near retrieval failure
  },
  recall: {
    fast: 800,       // Memory retrieval is slower than recognition
    good: 2000,      // Successful cued recall
    slow: 5000,      // Significant effort required
    verySlow: 10000, // Extended search, weak encoding
  },
  production: {
    fast: 1500,      // Very quick production (formulaic?)
    good: 4000,      // Normal production planning + execution
    slow: 8000,      // Careful construction
    verySlow: 15000, // Extended composition
  },
  timed: {
    fast: 300,       // Automaticity goal
    good: 800,       // Fluent response
    slow: 1500,      // Below automaticity threshold
    verySlow: 3000,  // Not automatic
  },
};

/**
 * Mastery stage modifiers for thresholds.
 * Lower stages get more lenient thresholds.
 */
const MASTERY_MODIFIERS: Record<MasteryStage, number> = {
  0: 2.0,   // New items - double the threshold
  1: 1.5,   // Recognition stage - 50% more lenient
  2: 1.2,   // Recall stage - 20% more lenient
  3: 1.0,   // Controlled production - standard
  4: 0.8,   // Automatic - stricter (expect faster)
};

/**
 * Word length adjustment factors.
 * Longer words naturally take more time.
 */
const WORD_LENGTH_FACTORS: Record<string, number> = {
  short: 1.0,     // 1-5 characters
  medium: 1.2,    // 6-10 characters
  long: 1.5,      // 11-15 characters
  veryLong: 2.0,  // 16+ characters
};

/**
 * Task format to category mapping.
 */
const FORMAT_TO_CATEGORY: Record<TaskFormat, TaskCategory> = {
  mcq: 'recognition',
  fill_blank: 'recall',
  free_response: 'production',
  matching: 'recognition',
  ordering: 'recall',
  dictation: 'production',
  typing: 'production',  // Character-by-character typing with validation
};

/**
 * Task type to category mapping (more specific than format).
 */
const TYPE_TO_CATEGORY: Record<TaskType, TaskCategory> = {
  recognition: 'recognition',
  recall_cued: 'recall',
  recall_free: 'recall',
  production: 'production',
  timed: 'timed',
  fill_blank: 'recall',
  definition_match: 'recognition',
  translation: 'production',
  sentence_writing: 'production',
  reading_comprehension: 'recall',
  rapid_response: 'timed',
  error_correction: 'recall',
  collocation: 'recall',
  word_formation: 'production',
  register_shift: 'production',
  sentence_combining: 'production',
  clause_selection: 'recall',
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get word length category.
 */
function getWordLengthCategory(wordLength: number): keyof typeof WORD_LENGTH_FACTORS {
  if (wordLength <= 5) return 'short';
  if (wordLength <= 10) return 'medium';
  if (wordLength <= 15) return 'long';
  return 'veryLong';
}

/**
 * Get task category from format or type.
 */
export function getTaskCategory(
  taskFormat?: TaskFormat,
  taskType?: TaskType
): TaskCategory {
  if (taskType && TYPE_TO_CATEGORY[taskType]) {
    return TYPE_TO_CATEGORY[taskType];
  }
  if (taskFormat && FORMAT_TO_CATEGORY[taskFormat]) {
    return FORMAT_TO_CATEGORY[taskFormat];
  }
  return 'recall'; // Default
}

/**
 * Calculate adjusted thresholds for a specific task configuration.
 *
 * @param category - Task category (recognition, recall, production, timed)
 * @param masteryStage - Current mastery stage (0-4)
 * @param wordLength - Length of target word in characters
 * @returns Adjusted response time thresholds
 */
export function getAdjustedThresholds(
  category: TaskCategory,
  masteryStage: MasteryStage = 2,
  wordLength: number = 6
): ResponseTimeThresholds {
  const base = BASE_THRESHOLDS[category];
  const masteryMod = MASTERY_MODIFIERS[masteryStage];
  const lengthMod = WORD_LENGTH_FACTORS[getWordLengthCategory(wordLength)];

  const combinedMod = masteryMod * lengthMod;

  return {
    fast: Math.round(base.fast * combinedMod),
    good: Math.round(base.good * combinedMod),
    slow: Math.round(base.slow * combinedMod),
    verySlow: Math.round(base.verySlow * combinedMod),
  };
}

/**
 * Analyze a single response time and classify it.
 *
 * @param responseTimeMs - Response time in milliseconds
 * @param category - Task category
 * @param masteryStage - Current mastery stage
 * @param wordLength - Target word length
 * @param isCorrect - Whether the response was correct
 * @returns Complete response time analysis
 */
export function analyzeResponseTime(
  responseTimeMs: number,
  category: TaskCategory,
  masteryStage: MasteryStage = 2,
  wordLength: number = 6,
  isCorrect: boolean = true
): ResponseTimeAnalysis {
  const thresholds = getAdjustedThresholds(category, masteryStage, wordLength);

  // Classification
  let classification: ResponseTimeAnalysis['classification'];
  let normalizedTime: number;
  let suggestedRating: FSRSRating;

  if (responseTimeMs < thresholds.fast) {
    classification = 'too_fast';
    normalizedTime = 0.1;
    // Too fast on incorrect = definite guess; too fast on correct = might be automatic
    suggestedRating = isCorrect && masteryStage >= 3 ? 4 : 2;
  } else if (responseTimeMs < thresholds.good) {
    classification = 'fast';
    normalizedTime = responseTimeMs / thresholds.good * 0.5;
    suggestedRating = isCorrect ? 4 : 2;
  } else if (responseTimeMs < thresholds.slow) {
    classification = 'good';
    normalizedTime = 0.5 + (responseTimeMs - thresholds.good) / (thresholds.slow - thresholds.good) * 0.25;
    suggestedRating = isCorrect ? 3 : 2;
  } else if (responseTimeMs < thresholds.verySlow) {
    classification = 'slow';
    normalizedTime = 0.75 + (responseTimeMs - thresholds.slow) / (thresholds.verySlow - thresholds.slow) * 0.2;
    suggestedRating = isCorrect ? 2 : 1;
  } else {
    classification = 'very_slow';
    normalizedTime = Math.min(1, 0.95 + (responseTimeMs - thresholds.verySlow) / thresholds.verySlow * 0.05);
    suggestedRating = 1;
  }

  // Automaticity check (sub-second for recognition, sub-2s for recall)
  const automaticityThreshold = category === 'recognition' ? 1000 :
    category === 'timed' ? 800 :
      category === 'recall' ? 2000 : 4000;

  const isAutomatic = responseTimeMs < automaticityThreshold && isCorrect;

  // Guessing detection (too fast + wrong, or suspiciously fast on MCQ)
  const possibleGuessing = classification === 'too_fast' &&
    (category === 'recognition' || !isCorrect);

  // Confidence in classification
  // Higher confidence when response time is clearly within a category
  const distanceFromBoundary = Math.min(
    Math.abs(responseTimeMs - thresholds.fast),
    Math.abs(responseTimeMs - thresholds.good),
    Math.abs(responseTimeMs - thresholds.slow),
    Math.abs(responseTimeMs - thresholds.verySlow)
  );
  const confidence = Math.min(1, 0.5 + distanceFromBoundary / 1000 * 0.5);

  return {
    responseTimeMs,
    taskCategory: category,
    normalizedTime,
    classification,
    suggestedRating,
    isAutomatic,
    possibleGuessing,
    confidence,
  };
}

/**
 * Calculate FSRS rating incorporating response time.
 * Combines correctness with response time analysis.
 *
 * @param isCorrect - Whether the response was correct
 * @param responseTimeMs - Response time in milliseconds
 * @param taskFormat - Task format (mcq, fill_blank, etc.)
 * @param masteryStage - Current mastery stage
 * @param wordLength - Target word length
 * @returns FSRS rating (1-4)
 */
export function calculateFSRSRatingWithTiming(
  isCorrect: boolean,
  responseTimeMs: number,
  taskFormat: TaskFormat,
  masteryStage: MasteryStage = 2,
  wordLength: number = 6
): FSRSRating {
  const category = getTaskCategory(taskFormat);
  const analysis = analyzeResponseTime(
    responseTimeMs,
    category,
    masteryStage,
    wordLength,
    isCorrect
  );

  // If incorrect, rating is 1 (Again) or 2 (Hard)
  if (!isCorrect) {
    return analysis.classification === 'very_slow' ? 1 : 2;
  }

  // If correct, use timing-based suggestion
  // But cap at 3 for slow responses (even if correct)
  if (analysis.classification === 'slow') {
    return 2;
  }
  if (analysis.classification === 'very_slow') {
    return 2;
  }

  // Possible guessing detection
  if (analysis.possibleGuessing) {
    return 2; // Don't reward potential guessing
  }

  return analysis.suggestedRating;
}

/**
 * Calculate fluency metrics from a series of response times.
 * Used for overall automaticity assessment.
 *
 * @param responseTimes - Array of response times in ms
 * @param category - Task category for threshold comparison
 * @returns Fluency metrics
 */
export function calculateFluencyMetrics(
  responseTimes: number[],
  category: TaskCategory = 'recall'
): FluencyMetrics {
  if (responseTimes.length === 0) {
    return {
      meanResponseTime: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
      automaticityRatio: 0,
      fluencyScore: 0,
    };
  }

  // Calculate mean
  const mean = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  // Calculate standard deviation
  const squaredDiffs = responseTimes.map((t) => Math.pow(t - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / responseTimes.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (normalized measure of variability)
  const cv = mean > 0 ? stdDev / mean : 0;

  // Automaticity threshold for this category
  const thresholds = BASE_THRESHOLDS[category];
  const automaticThreshold = thresholds.good;

  // Count responses under automaticity threshold
  const automaticCount = responseTimes.filter((t) => t < automaticThreshold).length;
  const automaticityRatio = automaticCount / responseTimes.length;

  // Calculate fluency score (0-1)
  // Components: fast mean, low variability, high automaticity ratio
  const meanScore = Math.max(0, 1 - mean / thresholds.verySlow);
  const variabilityScore = Math.max(0, 1 - cv);
  const fluencyScore = (meanScore * 0.4 + variabilityScore * 0.2 + automaticityRatio * 0.4);

  return {
    meanResponseTime: mean,
    standardDeviation: stdDev,
    coefficientOfVariation: cv,
    automaticityRatio,
    fluencyScore: Math.min(1, Math.max(0, fluencyScore)),
  };
}

/**
 * Detect potential cheating or gaming based on response patterns.
 *
 * @param responses - Array of {correct, timeMs} objects
 * @returns Analysis of suspicious patterns
 */
export function detectSuspiciousPatterns(
  responses: Array<{ correct: boolean; timeMs: number }>
): {
  suspiciousPattern: boolean;
  patternType: string | null;
  confidence: number;
} {
  if (responses.length < 5) {
    return { suspiciousPattern: false, patternType: null, confidence: 0 };
  }

  // Pattern 1: All responses extremely fast with high accuracy
  const allFast = responses.every((r) => r.timeMs < 500);
  const highAccuracy = responses.filter((r) => r.correct).length / responses.length > 0.9;

  if (allFast && highAccuracy) {
    return {
      suspiciousPattern: true,
      patternType: 'bot_pattern',
      confidence: 0.8,
    };
  }

  // Pattern 2: Consistent exact timing (robotic)
  const times = responses.map((r) => r.timeMs);
  const uniqueTimes = new Set(times.map((t) => Math.round(t / 100) * 100));
  if (uniqueTimes.size <= 2 && responses.length >= 10) {
    return {
      suspiciousPattern: true,
      patternType: 'robotic_timing',
      confidence: 0.7,
    };
  }

  // Pattern 3: Random clicking (all fast, low accuracy)
  const allVeryFast = responses.every((r) => r.timeMs < 300);
  const lowAccuracy = responses.filter((r) => r.correct).length / responses.length < 0.3;

  if (allVeryFast && lowAccuracy) {
    return {
      suspiciousPattern: true,
      patternType: 'random_clicking',
      confidence: 0.9,
    };
  }

  return { suspiciousPattern: false, patternType: null, confidence: 0 };
}

/**
 * Get target response time for a mastery stage.
 * Used for progress tracking and goal setting.
 */
export function getTargetResponseTime(
  category: TaskCategory,
  masteryStage: MasteryStage
): number {
  const thresholds = getAdjustedThresholds(category, masteryStage);

  // Target is midpoint between fast and good
  return Math.round((thresholds.fast + thresholds.good) / 2);
}

// =============================================================================
// Exports
// =============================================================================

export default {
  getTaskCategory,
  getAdjustedThresholds,
  analyzeResponseTime,
  calculateFSRSRatingWithTiming,
  calculateFluencyMetrics,
  detectSuspiciousPatterns,
  getTargetResponseTime,
  BASE_THRESHOLDS,
  MASTERY_MODIFIERS,
};
