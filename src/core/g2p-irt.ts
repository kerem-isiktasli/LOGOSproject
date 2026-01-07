/**
 * LOGOS G2P-IRT Integration Module
 *
 * Connects Grapheme-to-Phoneme analysis with Item Response Theory
 * for context-aware difficulty estimation and adaptive item selection.
 *
 * Academic Foundations:
 * - Format-aware IRT (EDM 2022): Task format affects item difficulty
 * - Multidimensional IRT (MIRT): Multiple ability dimensions
 * - Ma, B. et al. (2025): Personalized Language Learning Using Spaced Repetition
 *
 * This module implements:
 * 1. Context-dependent difficulty parameters
 * 2. Layer-specific theta estimation (alphabetic, syllable, word)
 * 3. Modality-specific ability tracking
 * 4. G2P difficulty to IRT parameter conversion
 *
 * @module core/g2p-irt
 */

import { probability2PL, estimateThetaEAP, fisherInformation } from './irt';
import type { G2PDifficulty } from './g2p';
import type { TaskType, TaskModality, ThetaEstimate, ItemParameter } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * G2P hierarchical layer.
 * Based on reading development research showing progression from
 * letter → syllable → word level processing.
 */
export type G2PLayer = 'alphabetic' | 'syllable' | 'word';

/**
 * Modality context for G2P tasks.
 */
export type G2PModality = 'reading' | 'listening' | 'speaking' | 'writing';

/**
 * Context-dependent difficulty adjustments.
 *
 * Different task contexts affect perceived difficulty.
 * For example, the same word might be easier to recognize
 * in reading than to produce in speaking.
 */
export interface ContextualDifficultyAdjustments {
  /** Modality-specific adjustments */
  byModality: {
    reading: number;    // Visual recognition
    listening: number;  // Auditory recognition
    speaking: number;   // Production
    writing: number;    // Spelling production
  };

  /** Task type adjustments */
  byTaskType: {
    recognition: number;  // Receptive tasks
    production: number;   // Productive tasks
  };

  /** Speed requirement adjustments */
  byTiming: {
    untimed: number;  // Accuracy focus
    timed: number;    // Fluency focus (adds difficulty)
  };

  /** Layer-specific adjustments */
  byLayer: {
    alphabetic: number;  // Grapheme-phoneme mapping
    syllable: number;    // Syllable pattern recognition
    word: number;        // Whole word recognition
  };
}

/**
 * Complete G2P-IRT parameters for an item.
 */
export interface G2PIRTParameters {
  /** Item identifier */
  id: string;

  /** Word or pattern */
  content: string;

  /** Base IRT difficulty (b parameter, logit scale) */
  baseDifficulty: number;

  /** Discrimination parameter (a parameter) */
  discrimination: number;

  /** Guessing parameter (c parameter, for MCQ) */
  guessing: number;

  /** Contextual difficulty adjustments */
  contextAdjustments: ContextualDifficultyAdjustments;

  /** Minimum theta required for each layer */
  layerThresholds: {
    alphabetic: number;
    syllable: number;
    word: number;
  };

  /** L1-specific difficulty adjustments */
  l1Adjustments: Record<string, number>;

  /** Original G2P analysis */
  g2pAnalysis: G2PDifficulty;
}

/**
 * User's G2P ability profile with layer and modality-specific thetas.
 *
 * Implements multidimensional IRT by tracking separate ability
 * estimates for different skill dimensions.
 */
export interface G2PThetaProfile {
  userId: string;
  updatedAt: Date;

  /** Overall phonological ability */
  thetaPhonological: number;

  /** Layer-specific abilities */
  thetaAlphabetic: number;
  thetaSyllable: number;
  thetaWord: number;

  /** Modality-specific abilities */
  thetaReading: number;
  thetaListening: number;
  thetaSpeaking: number;
  thetaWriting: number;

  /** Standard errors for each estimate */
  standardErrors: {
    phonological: number;
    alphabetic: number;
    syllable: number;
    word: number;
    reading: number;
    listening: number;
    speaking: number;
    writing: number;
  };

  /** Response counts for reliability estimation */
  responseCounts: {
    alphabetic: number;
    syllable: number;
    word: number;
    reading: number;
    listening: number;
    speaking: number;
    writing: number;
  };
}

/**
 * Task context for G2P item selection.
 */
export interface G2PTaskContext {
  /** Target modality */
  modality: G2PModality;

  /** Task type */
  taskType: 'recognition' | 'production';

  /** Whether task is timed */
  isTimed: boolean;

  /** Target G2P layer */
  targetLayer: G2PLayer | 'auto';

  /** User's L1 language */
  userL1: string;
}

/**
 * Response data for G2P tasks.
 */
export interface G2PResponse {
  itemId: string;
  correct: boolean;
  responseTimeMs: number;
  context: G2PTaskContext;
  itemParams: G2PIRTParameters;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default contextual difficulty adjustments.
 *
 * Based on empirical research on task difficulty factors.
 * Positive values increase difficulty, negative decrease.
 */
export const DEFAULT_CONTEXT_ADJUSTMENTS: ContextualDifficultyAdjustments = {
  byModality: {
    reading: 0.0,      // Baseline
    listening: 0.3,    // Auditory processing adds difficulty
    speaking: 0.6,     // Production is harder
    writing: 0.4,      // Spelling production is moderately harder
  },
  byTaskType: {
    recognition: 0.0,  // Baseline
    production: 0.5,   // Production tasks are harder
  },
  byTiming: {
    untimed: 0.0,      // Baseline
    timed: 0.3,        // Time pressure adds difficulty
  },
  byLayer: {
    alphabetic: 0.0,   // Baseline (simplest level)
    syllable: 0.2,     // Syllable patterns are more complex
    word: 0.4,         // Whole word is most complex
  },
};

/**
 * L1-specific difficulty adjustments for common transfer issues.
 *
 * Based on contrastive analysis research showing systematic
 * difficulties based on L1 phonological inventory.
 */
export const L1_DIFFICULTY_ADJUSTMENTS: Record<string, Record<string, number>> = {
  korean: {
    'th_sound': 0.5,        // θ/ð not in Korean
    'r_l_distinction': 0.4, // /r/-/l/ distinction difficult
    'final_consonant_clusters': 0.3,
    'vowel_length': 0.2,
  },
  japanese: {
    'r_l_distinction': 0.5,
    'th_sound': 0.4,
    'v_b_distinction': 0.3,
    'final_consonants': 0.3,
  },
  chinese: {
    'final_consonants': 0.4,
    'consonant_clusters': 0.4,
    'th_sound': 0.3,
  },
  spanish: {
    'short_long_vowels': 0.3,
    'initial_s_clusters': 0.3,
    'b_v_distinction': 0.2,
  },
};

/**
 * Minimum responses needed for reliable theta estimates.
 */
const MIN_RESPONSES_FOR_RELIABILITY = 5;

/**
 * Initial theta value for new dimensions.
 */
const INITIAL_THETA = 0;

/**
 * Initial standard error (high uncertainty).
 */
const INITIAL_SE = 1.5;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Converts G2P difficulty analysis to IRT parameters.
 *
 * Maps the 0-1 G2P difficulty score to the logit scale
 * used by IRT (-3 to +3 typically).
 *
 * @param g2pDifficulty - G2P analysis result
 * @param discrimination - Discrimination parameter (default 1.0)
 * @returns G2P-IRT parameters
 */
export function g2pToIRTParameters(
  g2pDifficulty: G2PDifficulty,
  discrimination: number = 1.0
): G2PIRTParameters {
  // Convert 0-1 difficulty to logit scale
  // Using logit transformation: b = ln(p / (1-p)) where p is difficulty
  const clampedDifficulty = Math.max(0.01, Math.min(0.99, g2pDifficulty.difficultyScore));
  const baseDifficulty = Math.log(clampedDifficulty / (1 - clampedDifficulty));

  // Determine layer thresholds based on complexity patterns
  const hasIrregularPatterns = g2pDifficulty.irregularPatterns.length > 0;
  const syllableCount = g2pDifficulty.syllableCount;

  const layerThresholds = {
    // Alphabetic level: basic decoding
    alphabetic: baseDifficulty - 1.0,
    // Syllable level: needs understanding of syllable patterns
    syllable: baseDifficulty - 0.5 + (syllableCount > 2 ? 0.3 : 0),
    // Word level: full word recognition including irregularities
    word: baseDifficulty + (hasIrregularPatterns ? 0.3 : 0),
  };

  // Build L1-specific adjustments from mispronunciation predictions
  const l1Adjustments: Record<string, number> = {};
  g2pDifficulty.potentialMispronunciations.forEach((mp) => {
    l1Adjustments[mp.l1] = (l1Adjustments[mp.l1] || 0) + mp.probability * 0.5;
  });

  return {
    id: `g2p_${g2pDifficulty.word}`,
    content: g2pDifficulty.word,
    baseDifficulty,
    discrimination,
    guessing: 0,
    contextAdjustments: { ...DEFAULT_CONTEXT_ADJUSTMENTS },
    layerThresholds,
    l1Adjustments,
    g2pAnalysis: g2pDifficulty,
  };
}

/**
 * Gets the effective difficulty for a specific task context.
 *
 * Combines base difficulty with context-specific adjustments.
 *
 * @param params - G2P-IRT parameters
 * @param context - Task context
 * @returns Effective difficulty (b parameter)
 */
export function getContextualDifficulty(
  params: G2PIRTParameters,
  context: G2PTaskContext
): number {
  let difficulty = params.baseDifficulty;

  // Add modality adjustment
  difficulty += params.contextAdjustments.byModality[context.modality];

  // Add task type adjustment
  difficulty += params.contextAdjustments.byTaskType[context.taskType];

  // Add timing adjustment
  difficulty += params.contextAdjustments.byTiming[context.isTimed ? 'timed' : 'untimed'];

  // Add layer adjustment if specified
  if (context.targetLayer !== 'auto') {
    difficulty += params.contextAdjustments.byLayer[context.targetLayer];
  }

  // Add L1-specific adjustment
  if (params.l1Adjustments[context.userL1]) {
    difficulty += params.l1Adjustments[context.userL1];
  }

  return difficulty;
}

/**
 * Calculates probability of correct response with context.
 *
 * Uses 2PL IRT model with context-adjusted difficulty.
 *
 * @param profile - User's G2P theta profile
 * @param params - Item parameters
 * @param context - Task context
 * @returns Probability of correct response (0 to 1)
 */
export function probabilityG2P(
  profile: G2PThetaProfile,
  params: G2PIRTParameters,
  context: G2PTaskContext
): number {
  // Get context-adjusted difficulty
  const difficulty = getContextualDifficulty(params, context);

  // Select appropriate theta based on context
  const theta = selectThetaForContext(profile, context);

  // Use 2PL model
  return probability2PL(theta, params.discrimination, difficulty);
}

/**
 * Selects the most appropriate theta for a given context.
 *
 * Combines layer-specific and modality-specific thetas
 * with overall phonological theta.
 *
 * @param profile - User's theta profile
 * @param context - Task context
 * @returns Selected theta value
 */
export function selectThetaForContext(
  profile: G2PThetaProfile,
  context: G2PTaskContext
): number {
  // Base: overall phonological theta
  let theta = profile.thetaPhonological;

  // Weight towards modality-specific theta (40%)
  const modalityTheta = getModalityTheta(profile, context.modality);
  theta = 0.6 * theta + 0.4 * modalityTheta;

  // Weight towards layer-specific theta (30%) if not auto
  if (context.targetLayer !== 'auto') {
    const layerTheta = getLayerTheta(profile, context.targetLayer);
    theta = 0.7 * theta + 0.3 * layerTheta;
  }

  return theta;
}

/**
 * Gets the theta for a specific modality.
 */
function getModalityTheta(profile: G2PThetaProfile, modality: G2PModality): number {
  switch (modality) {
    case 'reading':
      return profile.thetaReading;
    case 'listening':
      return profile.thetaListening;
    case 'speaking':
      return profile.thetaSpeaking;
    case 'writing':
      return profile.thetaWriting;
    default:
      return profile.thetaPhonological;
  }
}

/**
 * Gets the theta for a specific G2P layer.
 */
function getLayerTheta(profile: G2PThetaProfile, layer: G2PLayer): number {
  switch (layer) {
    case 'alphabetic':
      return profile.thetaAlphabetic;
    case 'syllable':
      return profile.thetaSyllable;
    case 'word':
      return profile.thetaWord;
    default:
      return profile.thetaPhonological;
  }
}

/**
 * Updates a G2P theta profile with a new response.
 *
 * Uses EAP estimation for the relevant dimensions.
 *
 * @param profile - Current profile
 * @param response - New response
 * @returns Updated profile
 */
export function updateG2PThetaProfile(
  profile: G2PThetaProfile,
  response: G2PResponse
): G2PThetaProfile {
  const updated = { ...profile, updatedAt: new Date() };

  // Get context-adjusted difficulty
  const difficulty = getContextualDifficulty(response.itemParams, response.context);

  // Create item parameter for IRT estimation
  const itemParam: ItemParameter = {
    id: response.itemId,
    a: response.itemParams.discrimination,
    b: difficulty,
  };

  // Update modality-specific theta
  const modalityKey = `theta${capitalize(response.context.modality)}` as keyof G2PThetaProfile;
  const currentModalityTheta = profile[modalityKey] as number;
  const modalityCountKey = response.context.modality as keyof G2PThetaProfile['responseCounts'];

  updated.responseCounts = {
    ...profile.responseCounts,
    [modalityCountKey]: profile.responseCounts[modalityCountKey] + 1,
  };

  // Simple EAP-like update (weighted update towards response)
  const updateWeight = 0.1; // Learning rate
  const expectedCorrect = probability2PL(currentModalityTheta, itemParam.a, itemParam.b);
  const error = (response.correct ? 1 : 0) - expectedCorrect;
  (updated as unknown as Record<string, number | Date | object>)[modalityKey] = currentModalityTheta + updateWeight * error * itemParam.a;

  // Update layer-specific theta if specified
  if (response.context.targetLayer !== 'auto') {
    const layerKey = `theta${capitalize(response.context.targetLayer)}` as keyof G2PThetaProfile;
    const currentLayerTheta = profile[layerKey] as number;
    const layerCountKey = response.context.targetLayer as keyof G2PThetaProfile['responseCounts'];

    updated.responseCounts = {
      ...updated.responseCounts,
      [layerCountKey]: profile.responseCounts[layerCountKey] + 1,
    };

    const layerExpectedCorrect = probability2PL(currentLayerTheta, itemParam.a, itemParam.b);
    const layerError = (response.correct ? 1 : 0) - layerExpectedCorrect;
    (updated as unknown as Record<string, number | Date | object>)[layerKey] = currentLayerTheta + updateWeight * layerError * itemParam.a;
  }

  // Update overall phonological theta (weighted average of all updates)
  updated.thetaPhonological =
    0.4 * updated.thetaPhonological +
    0.15 * updated.thetaAlphabetic +
    0.15 * updated.thetaSyllable +
    0.15 * updated.thetaWord +
    0.05 * updated.thetaReading +
    0.05 * updated.thetaListening +
    0.025 * updated.thetaSpeaking +
    0.025 * updated.thetaWriting;

  // Update standard errors (decrease with more responses)
  updated.standardErrors = { ...profile.standardErrors };
  Object.keys(updated.responseCounts).forEach((key) => {
    const count = updated.responseCounts[key as keyof typeof updated.responseCounts];
    const seKey = key as keyof typeof updated.standardErrors;
    // SE decreases with sqrt(n)
    updated.standardErrors[seKey] = INITIAL_SE / Math.sqrt(1 + count);
  });

  return updated;
}

/**
 * Selects the optimal G2P item based on user profile.
 *
 * Uses Fisher Information to select items that maximize
 * information gain for the target ability dimension.
 *
 * @param candidates - Candidate items
 * @param profile - User's theta profile
 * @param context - Task context
 * @returns Selected item and expected information gain
 */
export function selectOptimalG2PItem(
  candidates: G2PIRTParameters[],
  profile: G2PThetaProfile,
  context: G2PTaskContext
): { item: G2PIRTParameters; information: number } | null {
  if (candidates.length === 0) return null;

  const theta = selectThetaForContext(profile, context);

  let bestItem: G2PIRTParameters | null = null;
  let bestInfo = -Infinity;

  candidates.forEach((item) => {
    const difficulty = getContextualDifficulty(item, context);

    // Calculate Fisher Information at current theta
    const info = fisherInformation(theta, item.discrimination, difficulty);

    if (info > bestInfo) {
      bestInfo = info;
      bestItem = item;
    }
  });

  return bestItem ? { item: bestItem, information: bestInfo } : null;
}

/**
 * Determines the recommended G2P layer based on user profile.
 *
 * Uses threshold-based logic to suggest the appropriate level.
 *
 * @param profile - User's theta profile
 * @param itemParams - Item parameters
 * @returns Recommended layer
 */
export function recommendG2PLayer(
  profile: G2PThetaProfile,
  itemParams: G2PIRTParameters
): G2PLayer {
  // Check alphabetic readiness
  if (profile.thetaAlphabetic < itemParams.layerThresholds.alphabetic) {
    return 'alphabetic';
  }

  // Check syllable readiness
  if (profile.thetaSyllable < itemParams.layerThresholds.syllable) {
    return 'syllable';
  }

  // Default to word level
  return 'word';
}

/**
 * Creates a new G2P theta profile with initial values.
 *
 * @param userId - User ID
 * @returns New profile with default values
 */
export function createInitialG2PThetaProfile(userId: string): G2PThetaProfile {
  return {
    userId,
    updatedAt: new Date(),

    thetaPhonological: INITIAL_THETA,
    thetaAlphabetic: INITIAL_THETA,
    thetaSyllable: INITIAL_THETA,
    thetaWord: INITIAL_THETA,

    thetaReading: INITIAL_THETA,
    thetaListening: INITIAL_THETA,
    thetaSpeaking: INITIAL_THETA,
    thetaWriting: INITIAL_THETA,

    standardErrors: {
      phonological: INITIAL_SE,
      alphabetic: INITIAL_SE,
      syllable: INITIAL_SE,
      word: INITIAL_SE,
      reading: INITIAL_SE,
      listening: INITIAL_SE,
      speaking: INITIAL_SE,
      writing: INITIAL_SE,
    },

    responseCounts: {
      alphabetic: 0,
      syllable: 0,
      word: 0,
      reading: 0,
      listening: 0,
      speaking: 0,
      writing: 0,
    },
  };
}

/**
 * Checks if a dimension has enough responses for reliable estimation.
 *
 * @param profile - User's profile
 * @param dimension - Dimension to check
 * @returns Whether the dimension has reliable estimates
 */
export function hasReliableEstimate(
  profile: G2PThetaProfile,
  dimension: keyof G2PThetaProfile['responseCounts']
): boolean {
  return profile.responseCounts[dimension] >= MIN_RESPONSES_FOR_RELIABILITY;
}

/**
 * Calculates overall G2P readiness for a target word.
 *
 * @param profile - User's profile
 * @param itemParams - Item parameters
 * @returns Readiness assessment
 */
export function assessG2PReadiness(
  profile: G2PThetaProfile,
  itemParams: G2PIRTParameters
): {
  ready: boolean;
  alphabeticReady: boolean;
  syllableReady: boolean;
  wordReady: boolean;
  recommendedLayer: G2PLayer;
  confidenceLevel: 'low' | 'medium' | 'high';
} {
  const alphabeticReady = profile.thetaAlphabetic >= itemParams.layerThresholds.alphabetic;
  const syllableReady = profile.thetaSyllable >= itemParams.layerThresholds.syllable;
  const wordReady = profile.thetaWord >= itemParams.layerThresholds.word;

  const recommendedLayer = recommendG2PLayer(profile, itemParams);

  // Calculate confidence based on response counts
  const totalResponses =
    profile.responseCounts.alphabetic +
    profile.responseCounts.syllable +
    profile.responseCounts.word;

  let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
  if (totalResponses >= 20) {
    confidenceLevel = 'high';
  } else if (totalResponses >= 10) {
    confidenceLevel = 'medium';
  }

  return {
    ready: alphabeticReady && syllableReady && wordReady,
    alphabeticReady,
    syllableReady,
    wordReady,
    recommendedLayer,
    confidenceLevel,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Batch updates profile with multiple responses.
 *
 * @param profile - Current profile
 * @param responses - Array of responses
 * @returns Updated profile
 */
export function batchUpdateG2PThetaProfile(
  profile: G2PThetaProfile,
  responses: G2PResponse[]
): G2PThetaProfile {
  return responses.reduce(
    (currentProfile, response) => updateG2PThetaProfile(currentProfile, response),
    profile
  );
}

/**
 * Calculates expected information gain from testing an item.
 *
 * @param profile - User's profile
 * @param item - Item to evaluate
 * @param context - Task context
 * @returns Expected information gain
 */
export function expectedInformationGain(
  profile: G2PThetaProfile,
  item: G2PIRTParameters,
  context: G2PTaskContext
): number {
  const theta = selectThetaForContext(profile, context);
  const difficulty = getContextualDifficulty(item, context);

  return fisherInformation(theta, item.discrimination, difficulty);
}

/**
 * Gets difficulty adjustment for a specific L1-target pattern.
 *
 * @param l1 - L1 language
 * @param pattern - Problematic pattern
 * @returns Difficulty adjustment or 0 if not found
 */
export function getL1PatternAdjustment(l1: string, pattern: string): number {
  const l1Lower = l1.toLowerCase();
  if (L1_DIFFICULTY_ADJUSTMENTS[l1Lower]) {
    return L1_DIFFICULTY_ADJUSTMENTS[l1Lower][pattern] || 0;
  }
  return 0;
}
