/**
 * z(w) Vector Task Matching Module
 *
 * Implements optimal task-to-word characteristic matching based on the
 * word's z(w) vector (F, R, D, M, P, PRAG scores) for personalized task selection.
 *
 * The principle: Different words benefit from different practice types.
 * - High M (morphological) words → Word family exercises, affix drills
 * - High P (phonological difficulty) words → Dictation, pronunciation tasks
 * - High R (relational density) words → Collocation exercises, context tasks
 * - High F (frequency) words → Rapid response, automaticity drills
 * - High PRAG (pragmatic) words → Register shift, context-appropriate use
 * - High SYNT (syntactic) words → Sentence combining, clause manipulation tasks
 *
 * Academic References:
 * - Nation, I.S.P. (2001). Learning Vocabulary in Another Language. Cambridge.
 * - Laufer, B. & Nation, P. (2012). Vocabulary. In Gass & Mackey (Eds.),
 *   The Routledge Handbook of Second Language Acquisition.
 * - Schmitt, N. (2010). Researching Vocabulary: A Vocabulary Research Manual.
 * - Lu, X. (2010). Automatic analysis of syntactic complexity in second language writing.
 * - Lu, X. (2011). A corpus-based evaluation of syntactic complexity measures as indices
 *   of college-level ESL writers' language development. TESOL Quarterly, 45, 36-62.
 *
 * @module core/task-matching
 */

import type {
  TaskType,
  TaskFormat,
  TaskModality,
  MasteryStage,
  LanguageObjectType,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * The z(w) vector - linguistic characteristics of a word/phrase.
 * Extended to include syntactic complexity based on Lu (2010, 2011).
 */
export interface ZVector {
  /** Frequency score (0-1) - corpus occurrence rate */
  frequency: number;

  /** Relational density (0-1) - collocational hub score */
  relationalDensity: number;

  /** Domain relevance (0-1) - target domain fit */
  domainRelevance: number;

  /** Morphological score (0-1) - word family richness */
  morphological: number;

  /** Phonological difficulty (0-1) - pronunciation challenge */
  phonological: number;

  /** Pragmatic score (0-1) - register/context sensitivity */
  pragmatic: number;

  /**
   * Syntactic complexity (0-1) - structural elaboration
   * Based on Lu's L2 Syntactic Complexity Analyzer metrics:
   * - MLC (Mean Length of Clause)
   * - CN/C (Complex Nominals per Clause)
   * - DC/C (Dependent Clauses per Clause)
   * Reference: Lu, X. (2010). Automatic analysis of syntactic complexity.
   */
  syntactic: number;
}

/**
 * Task suitability scores for each task type.
 */
export type TaskSuitabilityMap = Record<TaskType, number>;

/**
 * Recommended task configuration.
 */
export interface TaskRecommendation {
  /** Primary recommended task type */
  taskType: TaskType;

  /** Recommended format */
  taskFormat: TaskFormat;

  /** Recommended modality */
  modality: TaskModality;

  /** Suitability score (0-1) */
  suitability: number;

  /** Reason for recommendation */
  reason: string;

  /** Alternative task types */
  alternatives: Array<{ taskType: TaskType; suitability: number }>;
}

/**
 * Word profile for task matching.
 */
export interface WordProfile {
  content: string;
  type: LanguageObjectType;
  zVector: ZVector;
  masteryStage: MasteryStage;
  cueFreeAccuracy: number;
  exposureCount: number;
}

// =============================================================================
// Task Affinity Matrices
// =============================================================================

/**
 * Affinity of each z(w) component for each task type.
 * Higher values indicate the task benefits from high scores in that component.
 *
 * Matrix logic:
 * - Word family tasks benefit from high M (morphological)
 * - Collocation tasks benefit from high R (relational)
 * - Rapid response benefits from high F (frequency, for automaticity)
 * - Dictation/pronunciation benefits from high P (targets difficult sounds)
 * - Register tasks benefit from high PRAG (pragmatic sensitivity)
 */
const TASK_AFFINITY_MATRIX: Record<keyof ZVector, Partial<Record<TaskType, number>>> = {
  frequency: {
    rapid_response: 0.9,      // High-frequency words need automaticity
    recognition: 0.6,         // Common words = easier recognition
    timed: 0.8,               // Speed practice for frequent words
    recall_free: 0.5,         // Should be quickly accessible
  },

  relationalDensity: {
    collocation: 0.95,        // Hub words = rich collocation practice
    sentence_writing: 0.7,    // Many connections = more context options
    reading_comprehension: 0.6, // Contextual understanding
    fill_blank: 0.6,          // Context-based completion
  },

  domainRelevance: {
    reading_comprehension: 0.8, // Domain texts
    translation: 0.7,          // Domain-specific translation
    sentence_writing: 0.6,     // Domain context sentences
    definition_match: 0.5,     // Domain definitions
  },

  morphological: {
    word_formation: 0.95,     // Direct morphology practice
    fill_blank: 0.6,          // Inflected forms
    error_correction: 0.7,    // Morphological errors
    recall_cued: 0.5,         // Root cues
  },

  phonological: {
    // Note: 'dictation' is a TaskFormat not TaskType - map to appropriate types
    timed: 0.7,               // Phonological fluency under time pressure
    recall_free: 0.6,         // Phonological retrieval
    production: 0.8,          // Pronunciation in production
    recognition: 0.5,         // Distinguish similar sounds
  },

  pragmatic: {
    register_shift: 0.95,     // Direct pragmatic practice
    sentence_writing: 0.7,    // Context-appropriate production
    error_correction: 0.6,    // Pragmatic appropriateness
    production: 0.5,          // Appropriate usage
  },

  // Syntactic complexity - based on Lu (2010, 2011) L2SCA metrics
  syntactic: {
    sentence_combining: 0.95, // Combine clauses into complex sentences
    clause_selection: 0.9,    // Choose appropriate subordinate/coordinate
    error_correction: 0.8,    // Fix syntactic errors
    sentence_writing: 0.75,   // Produce syntactically complex output
    fill_blank: 0.6,          // Complete with correct structure
    translation: 0.7,         // Preserve syntactic structure
    reading_comprehension: 0.5, // Parse complex structures
  },
};

/**
 * Stage constraints on task types.
 * Some tasks are only appropriate at certain mastery levels.
 */
const STAGE_TASK_AVAILABILITY: Record<MasteryStage, TaskType[]> = {
  0: ['recognition', 'definition_match'],
  1: ['recognition', 'definition_match', 'recall_cued', 'fill_blank'],
  2: ['recognition', 'recall_cued', 'recall_free', 'fill_blank', 'collocation', 'word_formation',
      'clause_selection'],  // Basic syntactic choice at stage 2
  3: ['recall_cued', 'recall_free', 'production', 'sentence_writing', 'collocation',
      'word_formation', 'error_correction', 'translation', 'timed',
      'sentence_combining', 'clause_selection'],  // Syntactic production at stage 3
  4: ['recall_free', 'production', 'sentence_writing', 'register_shift', 'rapid_response',
      'timed', 'error_correction', 'translation', 'reading_comprehension',
      'sentence_combining', 'clause_selection'],  // Full syntactic mastery at stage 4
};

/**
 * Format mapping for each task type.
 */
const TASK_FORMAT_MAP: Record<TaskType, TaskFormat> = {
  recognition: 'mcq',
  recall_cued: 'fill_blank',
  recall_free: 'free_response',
  production: 'free_response',
  timed: 'free_response',
  fill_blank: 'fill_blank',
  definition_match: 'matching',
  translation: 'free_response',
  sentence_writing: 'free_response',
  reading_comprehension: 'mcq',
  rapid_response: 'free_response',
  error_correction: 'free_response',
  collocation: 'fill_blank',
  word_formation: 'fill_blank',
  register_shift: 'free_response',
  // Syntactic complexity tasks
  sentence_combining: 'free_response',  // Produce combined sentence
  clause_selection: 'mcq',              // Choose correct clause structure
};

/**
 * Modality preferences based on z(w) components.
 */
const MODALITY_PREFERENCES: Record<keyof ZVector, TaskModality> = {
  frequency: 'visual',           // Standard visual practice
  relationalDensity: 'visual',   // See collocations in context
  domainRelevance: 'visual',     // Domain text reading
  morphological: 'visual',       // See word structure
  syntactic: 'visual',           // See sentence structure clearly
  phonological: 'auditory',      // Hear pronunciation
  pragmatic: 'mixed',            // Both channels for pragmatics
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate task suitability scores based on z(w) vector.
 *
 * @param zVector - Word's characteristic vector
 * @param masteryStage - Current mastery stage
 * @returns Map of task types to suitability scores
 */
export function calculateTaskSuitability(
  zVector: ZVector,
  masteryStage: MasteryStage
): TaskSuitabilityMap {
  const availableTasks = STAGE_TASK_AVAILABILITY[masteryStage];
  const allTaskTypes: TaskType[] = [
    'recognition', 'recall_cued', 'recall_free', 'production', 'timed',
    'fill_blank', 'definition_match', 'translation', 'sentence_writing',
    'reading_comprehension', 'rapid_response', 'error_correction',
    'collocation', 'word_formation', 'register_shift',
    'sentence_combining', 'clause_selection',  // Syntactic tasks
  ];

  const suitability: TaskSuitabilityMap = {} as TaskSuitabilityMap;

  for (const taskType of allTaskTypes) {
    // Base suitability from z(w) affinity
    let score = 0;
    let weightSum = 0;

    for (const [component, affinities] of Object.entries(TASK_AFFINITY_MATRIX)) {
      const componentKey = component as keyof ZVector;
      const affinity = affinities[taskType] ?? 0;
      const componentValue = zVector[componentKey];

      // Weighted contribution: high affinity + high component value = high suitability
      score += affinity * componentValue;
      weightSum += affinity;
    }

    // Normalize by weight sum
    const normalizedScore = weightSum > 0 ? score / weightSum : 0;

    // Apply stage availability penalty
    const isAvailable = availableTasks.includes(taskType);
    suitability[taskType] = isAvailable ? normalizedScore : normalizedScore * 0.1;
  }

  return suitability;
}

/**
 * Get the dominant z(w) component for a word.
 */
export function getDominantComponent(zVector: ZVector): keyof ZVector {
  let maxValue = -1;
  let dominant: keyof ZVector = 'frequency';

  for (const [key, value] of Object.entries(zVector)) {
    if (value > maxValue) {
      maxValue = value;
      dominant = key as keyof ZVector;
    }
  }

  return dominant;
}

/**
 * Generate task recommendation based on word profile.
 *
 * @param profile - Complete word profile
 * @returns Optimal task recommendation
 */
export function recommendTask(profile: WordProfile): TaskRecommendation {
  const suitability = calculateTaskSuitability(profile.zVector, profile.masteryStage);
  const dominantComponent = getDominantComponent(profile.zVector);

  // Sort task types by suitability
  const sortedTasks = Object.entries(suitability)
    .filter(([_, score]) => score > 0.1) // Filter out unavailable tasks
    .sort((a, b) => b[1] - a[1]) as [TaskType, number][];

  if (sortedTasks.length === 0) {
    // Fallback to recognition
    return {
      taskType: 'recognition',
      taskFormat: 'mcq',
      modality: 'visual',
      suitability: 0.5,
      reason: 'Default recognition task for new word',
      alternatives: [],
    };
  }

  const [topTask, topScore] = sortedTasks[0];
  const alternatives = sortedTasks.slice(1, 4).map(([t, s]) => ({ taskType: t, suitability: s }));

  // Determine modality based on dominant component
  const modality = MODALITY_PREFERENCES[dominantComponent];

  // Generate reason
  const reason = generateRecommendationReason(
    topTask,
    profile.zVector,
    dominantComponent,
    profile.masteryStage
  );

  return {
    taskType: topTask,
    taskFormat: TASK_FORMAT_MAP[topTask],
    modality,
    suitability: topScore,
    reason,
    alternatives,
  };
}

/**
 * Generate human-readable reason for task recommendation.
 */
function generateRecommendationReason(
  taskType: TaskType,
  zVector: ZVector,
  dominant: keyof ZVector,
  stage: MasteryStage
): string {
  const componentLabels: Record<keyof ZVector, string> = {
    frequency: 'high frequency',
    relationalDensity: 'rich collocations',
    domainRelevance: 'domain-specific',
    morphological: 'complex word family',
    phonological: 'challenging pronunciation',
    pragmatic: 'context-sensitive',
  };

  const taskLabels: Partial<Record<TaskType, string>> = {
    word_formation: 'word family practice',
    collocation: 'collocation practice',
    rapid_response: 'automaticity drill',
    register_shift: 'pragmatic awareness',
    sentence_writing: 'contextual production',
    timed: 'fluency building',
  };

  const componentLabel = componentLabels[dominant];
  const taskLabel = taskLabels[taskType] ?? taskType.replace('_', ' ');

  return `${taskLabel} recommended for ${componentLabel} word at stage ${stage}`;
}

/**
 * Batch recommend tasks for multiple words with variety.
 * Ensures task variety in a session while respecting z(w) matching.
 *
 * @param profiles - Array of word profiles
 * @param maxPerType - Maximum tasks of same type in a row
 * @returns Array of recommendations with enforced variety
 */
export function recommendTaskBatch(
  profiles: WordProfile[],
  maxPerType: number = 2
): TaskRecommendation[] {
  const recommendations: TaskRecommendation[] = [];
  const typeCount: Map<TaskType, number> = new Map();

  for (const profile of profiles) {
    const recommendation = recommendTask(profile);

    // Check if we've hit the limit for this task type
    const currentCount = typeCount.get(recommendation.taskType) ?? 0;

    if (currentCount >= maxPerType && recommendation.alternatives.length > 0) {
      // Find best alternative that isn't over-used
      const availableAlt = recommendation.alternatives.find((alt) => {
        const altCount = typeCount.get(alt.taskType) ?? 0;
        return altCount < maxPerType;
      });

      if (availableAlt) {
        recommendation.taskType = availableAlt.taskType;
        recommendation.taskFormat = TASK_FORMAT_MAP[availableAlt.taskType];
        recommendation.suitability = availableAlt.suitability;
        recommendation.reason = `Alternative: ${recommendation.reason}`;
      }
    }

    // Update counts
    typeCount.set(
      recommendation.taskType,
      (typeCount.get(recommendation.taskType) ?? 0) + 1
    );

    recommendations.push(recommendation);
  }

  return recommendations;
}

/**
 * Calculate z(w) vector from language object properties.
 * Normalizes raw metrics to 0-1 scale.
 *
 * @param object - Language object with raw metrics
 * @returns Normalized z(w) vector
 */
export function extractZVector(object: {
  frequency?: number | null;
  relationalDensity?: number | null;
  domainDistribution?: string | Record<string, number> | null;
  morphologicalScore?: number | null;
  phonologicalDifficulty?: number | null;
  pragmaticScore?: number | null;
  syntacticComplexity?: number | null;
}, targetDomain?: string): ZVector {
  // Frequency: already 0-1 (log-normalized)
  const frequency = object.frequency ?? 0.5;

  // Relational density: already 0-1
  const relationalDensity = object.relationalDensity ?? 0.5;

  // Domain relevance: extract from distribution
  let domainRelevance = 0.5;
  if (object.domainDistribution) {
    try {
      const domains = typeof object.domainDistribution === 'string'
        ? JSON.parse(object.domainDistribution)
        : object.domainDistribution;
      domainRelevance = domains[targetDomain ?? 'general'] ?? 0.5;
    } catch {
      domainRelevance = 0.5;
    }
  }

  // Morphological score: already 0-1
  const morphological = object.morphologicalScore ?? 0.5;

  // Phonological difficulty: already 0-1
  const phonological = object.phonologicalDifficulty ?? 0.5;

  // Pragmatic score: already 0-1
  const pragmatic = object.pragmaticScore ?? 0.5;

  // Syntactic complexity: already 0-1 (Lu's L2SCA metrics normalized)
  const syntactic = object.syntacticComplexity ?? 0.5;

  return {
    frequency,
    relationalDensity,
    domainRelevance,
    morphological,
    phonological,
    pragmatic,
    syntactic,
  };
}

/**
 * Check if a specific task type is suitable for a word.
 *
 * @param taskType - Task type to check
 * @param zVector - Word's z(w) vector
 * @param masteryStage - Current mastery stage
 * @param threshold - Minimum suitability score (default 0.3)
 * @returns Whether the task is suitable
 */
export function isTaskSuitable(
  taskType: TaskType,
  zVector: ZVector,
  masteryStage: MasteryStage,
  threshold: number = 0.3
): boolean {
  const suitability = calculateTaskSuitability(zVector, masteryStage);
  return suitability[taskType] >= threshold;
}

/**
 * Get optimal modality for a word based on its z(w) vector.
 */
export function getOptimalModality(zVector: ZVector): TaskModality {
  // If phonological is dominant, use auditory
  if (zVector.phonological > 0.7) {
    return 'auditory';
  }

  // If pragmatic is high, use mixed
  if (zVector.pragmatic > 0.6) {
    return 'mixed';
  }

  // Default to visual
  return 'visual';
}

// =============================================================================
// Exports
// =============================================================================

export default {
  calculateTaskSuitability,
  getDominantComponent,
  recommendTask,
  recommendTaskBatch,
  extractZVector,
  isTaskSuitable,
  getOptimalModality,
  TASK_AFFINITY_MATRIX,
  STAGE_TASK_AVAILABILITY,
};
