/**
 * Diagnostic Assessment Service
 *
 * Provides initial theta estimation during onboarding based on:
 * 1. User profile data (purpose, daily time, prior experience)
 * 2. Optional placement test results
 * 3. Domain-specific difficulty calibration
 *
 * Reference: IRT (Item Response Theory) - 2PL model for theta estimation
 * Reference: CEFR framework for level mapping
 */

import { getPrisma } from '../db/prisma';

// =============================================================================
// Types
// =============================================================================

export interface DiagnosticInput {
  /** User's stated purpose (certification, professional, academic, personal) */
  purpose: string;
  /** Daily study time in minutes */
  dailyTime: number;
  /** Target domain (medical, legal, business, academic, general) */
  domain: string;
  /** Target modalities (reading, writing, listening, speaking) */
  modality: string[];
  /** Optional self-assessment level */
  selfAssessedLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** Optional placement test responses */
  placementResponses?: PlacementResponse[];
}

export interface PlacementResponse {
  /** Item difficulty (IRT b parameter) */
  difficulty: number;
  /** Whether response was correct */
  correct: boolean;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Component being tested */
  component: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';
}

export interface ThetaEstimate {
  /** Global theta estimate */
  thetaGlobal: number;
  /** Component-specific theta estimates */
  thetaPhonology: number;
  thetaMorphology: number;
  thetaLexical: number;
  thetaSyntactic: number;
  thetaPragmatic: number;
  /** Confidence interval (standard error) */
  standardError: number;
  /** CEFR level estimate */
  estimatedCEFR: CEFRLevel;
  /** Recommended starting difficulty */
  recommendedDifficulty: number;
}

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Estimate initial theta values for a new user.
 * Uses a combination of profile-based estimation and optional placement test.
 *
 * @param input - Diagnostic input data from onboarding
 * @returns Estimated theta values for all components
 */
export function estimateInitialTheta(input: DiagnosticInput): ThetaEstimate {
  // Start with prior based on purpose and domain
  const priorTheta = getPriorTheta(input.purpose, input.domain);

  // Adjust based on daily time commitment (more time = higher motivation/prior)
  const timeAdjustment = getTimeAdjustment(input.dailyTime);

  // Adjust based on self-assessment if provided
  const selfAssessAdjustment = getSelfAssessmentAdjustment(input.selfAssessedLevel);

  // Calculate base theta
  let baseTheta = priorTheta + timeAdjustment + selfAssessAdjustment;

  // Clamp to reasonable range [-3, 3]
  baseTheta = Math.max(-3, Math.min(3, baseTheta));

  // If placement test responses provided, use MLE estimation
  let componentThetas = getDefaultComponentThetas(baseTheta, input.modality);
  let standardError = 1.0; // High uncertainty without placement test

  if (input.placementResponses && input.placementResponses.length > 0) {
    const mleResult = estimateThetaFromResponses(input.placementResponses);
    baseTheta = mleResult.theta;
    standardError = mleResult.standardError;
    componentThetas = mleResult.componentThetas;
  }

  // Map to CEFR level
  const estimatedCEFR = thetaToCEFR(baseTheta);

  return {
    thetaGlobal: roundToDecimal(baseTheta, 2),
    thetaPhonology: roundToDecimal(componentThetas.PHON, 2),
    thetaMorphology: roundToDecimal(componentThetas.MORPH, 2),
    thetaLexical: roundToDecimal(componentThetas.LEX, 2),
    thetaSyntactic: roundToDecimal(componentThetas.SYNT, 2),
    thetaPragmatic: roundToDecimal(componentThetas.PRAG, 2),
    standardError: roundToDecimal(standardError, 2),
    estimatedCEFR,
    recommendedDifficulty: thetaToRecommendedDifficulty(baseTheta),
  };
}

/**
 * Generate placement test items for diagnostic assessment.
 * Returns a set of calibrated items across all components.
 *
 * @param targetLevel - Optional target level to center items around
 * @param itemCount - Number of items per component (default: 3)
 */
export function generatePlacementItems(
  targetLevel: CEFRLevel = 'B1',
  itemCount: number = 3
): PlacementItem[] {
  const targetTheta = cefrToTheta(targetLevel);
  const items: PlacementItem[] = [];

  const components: Array<'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG'> = [
    'PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG'
  ];

  for (const component of components) {
    // Generate items at varying difficulties around target
    const difficulties = generateItemDifficulties(targetTheta, itemCount);

    for (let i = 0; i < itemCount; i++) {
      items.push({
        id: `placement-${component}-${i}`,
        component,
        difficulty: difficulties[i],
        ...getPlacementItemContent(component, difficulties[i]),
      });
    }
  }

  // Shuffle items for mixed presentation
  return shuffleArray(items);
}

/**
 * Update user's theta estimates after placement test or initial sessions.
 */
export async function updateUserTheta(
  userId: string,
  thetaEstimate: ThetaEstimate
): Promise<void> {
  const db = getPrisma();

  await db.user.update({
    where: { id: userId },
    data: {
      thetaGlobal: thetaEstimate.thetaGlobal,
      thetaPhonology: thetaEstimate.thetaPhonology,
      thetaMorphology: thetaEstimate.thetaMorphology,
      thetaLexical: thetaEstimate.thetaLexical,
      thetaSyntactic: thetaEstimate.thetaSyntactic,
      thetaPragmatic: thetaEstimate.thetaPragmatic,
    },
  });
}

// =============================================================================
// Prior Estimation
// =============================================================================

/**
 * Get prior theta based on purpose and domain.
 * Reference: Bayesian prior for IRT estimation
 */
function getPriorTheta(purpose: string, domain: string): number {
  // Purpose-based priors
  const purposePriors: Record<string, number> = {
    certification: 0.5,  // Aiming for specific level, likely has some background
    professional: 0.3,   // Working professionals, moderate starting point
    academic: 0.4,       // Academic use, some foundation expected
    immigration: 0.2,    // Variable, conservative estimate
    personal: 0.0,       // Hobby/travel, no strong prior
  };

  // Domain-based adjustments
  const domainAdjustments: Record<string, number> = {
    medical: 0.3,    // Specialized domain, higher if chosen
    legal: 0.3,
    business: 0.2,
    academic: 0.2,
    technology: 0.2,
    general: 0.0,
    travel: -0.2,    // Basic communication needs
  };

  const purposePrior = purposePriors[purpose] ?? 0.0;
  const domainAdj = domainAdjustments[domain] ?? 0.0;

  return purposePrior + domainAdj;
}

/**
 * Adjust theta based on daily time commitment.
 */
function getTimeAdjustment(dailyTimeMinutes: number): number {
  // Higher time commitment suggests either:
  // 1. More serious learner (slightly higher prior)
  // 2. Recognition of need for more practice (no change)
  // We use a modest adjustment
  if (dailyTimeMinutes >= 60) return 0.2;
  if (dailyTimeMinutes >= 30) return 0.1;
  if (dailyTimeMinutes >= 15) return 0.0;
  return -0.1;
}

/**
 * Adjust theta based on self-assessment.
 */
function getSelfAssessmentAdjustment(level?: string): number {
  if (!level) return 0.0;

  const adjustments: Record<string, number> = {
    beginner: -0.5,
    intermediate: 0.0,
    advanced: 0.5,
  };

  return adjustments[level] ?? 0.0;
}

/**
 * Get default component thetas based on global theta and modality focus.
 */
function getDefaultComponentThetas(
  baseTheta: number,
  modalities: string[]
): Record<string, number> {
  // Start all components at base theta
  const thetas: Record<string, number> = {
    PHON: baseTheta,
    MORPH: baseTheta,
    LEX: baseTheta,
    SYNT: baseTheta,
    PRAG: baseTheta,
  };

  // Adjust based on modality focus
  // Reading/writing tend to develop LEX and SYNT first
  // Listening/speaking develop PHON first
  // All develop PRAG later

  const hasListening = modalities.includes('listening');
  const hasSpeaking = modalities.includes('speaking');
  const hasReading = modalities.includes('reading');
  const hasWriting = modalities.includes('writing');

  if (hasListening || hasSpeaking) {
    thetas.PHON += 0.1;
  } else {
    thetas.PHON -= 0.2;
  }

  if (hasReading || hasWriting) {
    thetas.LEX += 0.1;
    thetas.SYNT += 0.1;
  }

  // Pragmatics typically develops slower
  thetas.PRAG -= 0.2;

  return thetas;
}

// =============================================================================
// MLE Estimation from Placement Test
// =============================================================================

interface MLEResult {
  theta: number;
  standardError: number;
  componentThetas: Record<string, number>;
}

/**
 * Estimate theta using Maximum Likelihood Estimation from placement test responses.
 * Uses Newton-Raphson iteration for 2PL IRT model.
 */
function estimateThetaFromResponses(responses: PlacementResponse[]): MLEResult {
  // Group responses by component
  const byComponent: Record<string, PlacementResponse[]> = {
    PHON: [],
    MORPH: [],
    LEX: [],
    SYNT: [],
    PRAG: [],
  };

  for (const response of responses) {
    byComponent[response.component].push(response);
  }

  // Estimate theta for each component
  const componentThetas: Record<string, number> = {};
  let totalTheta = 0;
  let componentCount = 0;

  for (const [component, componentResponses] of Object.entries(byComponent)) {
    if (componentResponses.length > 0) {
      const theta = mleEstimate(componentResponses);
      componentThetas[component] = theta;
      totalTheta += theta;
      componentCount++;
    } else {
      componentThetas[component] = 0; // Default for missing components
    }
  }

  // Global theta is average of component thetas
  const globalTheta = componentCount > 0 ? totalTheta / componentCount : 0;

  // Calculate standard error (simplified)
  const se = calculateStandardError(responses, globalTheta);

  return {
    theta: globalTheta,
    standardError: se,
    componentThetas,
  };
}

/**
 * MLE estimation using Newton-Raphson iteration.
 * Reference: IRT 2PL model
 */
function mleEstimate(responses: PlacementResponse[]): number {
  const discrimination = 1.0; // Assume a = 1 for simplicity (Rasch model)
  let theta = 0; // Start at mean
  const maxIterations = 20;
  const tolerance = 0.001;

  for (let i = 0; i < maxIterations; i++) {
    let firstDerivative = 0;
    let secondDerivative = 0;

    for (const response of responses) {
      const prob = probability2PL(theta, response.difficulty, discrimination);
      const u = response.correct ? 1 : 0;

      // First derivative of log-likelihood
      firstDerivative += discrimination * (u - prob);

      // Second derivative (Fisher information)
      secondDerivative -= discrimination * discrimination * prob * (1 - prob);
    }

    // Newton-Raphson update
    if (Math.abs(secondDerivative) < 0.0001) break;
    const delta = firstDerivative / Math.abs(secondDerivative);
    theta += delta;

    // Clamp theta to reasonable range
    theta = Math.max(-4, Math.min(4, theta));

    if (Math.abs(delta) < tolerance) break;
  }

  return theta;
}

/**
 * 2PL probability function.
 * P(correct | theta, b, a) = 1 / (1 + exp(-a(theta - b)))
 */
function probability2PL(theta: number, difficulty: number, discrimination: number): number {
  const exponent = -discrimination * (theta - difficulty);
  return 1 / (1 + Math.exp(Math.max(-500, Math.min(500, exponent))));
}

/**
 * Calculate standard error of theta estimate.
 */
function calculateStandardError(responses: PlacementResponse[], theta: number): number {
  const discrimination = 1.0;
  let information = 0;

  for (const response of responses) {
    const prob = probability2PL(theta, response.difficulty, discrimination);
    information += discrimination * discrimination * prob * (1 - prob);
  }

  return information > 0 ? 1 / Math.sqrt(information) : 2.0;
}

// =============================================================================
// CEFR Mapping
// =============================================================================

/**
 * Map theta to CEFR level.
 * Reference: Empirical mapping from language testing research
 */
function thetaToCEFR(theta: number): CEFRLevel {
  if (theta < -1.5) return 'A1';
  if (theta < -0.5) return 'A2';
  if (theta < 0.5) return 'B1';
  if (theta < 1.5) return 'B2';
  if (theta < 2.5) return 'C1';
  return 'C2';
}

/**
 * Map CEFR to approximate theta.
 */
function cefrToTheta(cefr: CEFRLevel): number {
  const map: Record<CEFRLevel, number> = {
    A1: -2.0,
    A2: -1.0,
    B1: 0.0,
    B2: 1.0,
    C1: 2.0,
    C2: 3.0,
  };
  return map[cefr];
}

/**
 * Map theta to recommended initial difficulty.
 */
function thetaToRecommendedDifficulty(theta: number): number {
  // Recommend slightly below theta for initial success
  return Math.max(0.1, Math.min(0.9, (theta + 3) / 6 - 0.1));
}

// =============================================================================
// Placement Item Generation
// =============================================================================

interface PlacementItem {
  id: string;
  component: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';
  difficulty: number;
  content: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
}

/**
 * Generate item difficulties for adaptive testing.
 * Centers around target with spread.
 */
function generateItemDifficulties(targetTheta: number, count: number): number[] {
  const difficulties: number[] = [];
  const spread = 1.5; // ±1.5 theta units

  for (let i = 0; i < count; i++) {
    // Distribute evenly around target
    const offset = count > 1
      ? -spread + (2 * spread * i) / (count - 1)
      : 0;
    difficulties.push(targetTheta + offset);
  }

  return difficulties;
}

/**
 * Get placement item content based on component and difficulty.
 */
function getPlacementItemContent(
  component: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG',
  difficulty: number
): { content: string; prompt: string; options: string[]; correctAnswer: string } {
  // Item banks by component and difficulty level
  const itemBanks: Record<string, Array<{
    minDiff: number;
    maxDiff: number;
    content: string;
    prompt: string;
    options: string[];
    correctAnswer: string;
  }>> = {
    PHON: [
      {
        minDiff: -2, maxDiff: 0,
        content: 'knight',
        prompt: 'Which letter is silent in this word?',
        options: ['k', 'n', 'i', 'g'],
        correctAnswer: 'k',
      },
      {
        minDiff: 0, maxDiff: 2,
        content: 'through',
        prompt: 'How many sounds (phonemes) are in this word?',
        options: ['3', '4', '5', '7'],
        correctAnswer: '3',
      },
    ],
    MORPH: [
      {
        minDiff: -2, maxDiff: 0,
        content: 'unhappy',
        prompt: 'What is the root word?',
        options: ['un', 'happy', 'hap', 'unhap'],
        correctAnswer: 'happy',
      },
      {
        minDiff: 0, maxDiff: 2,
        content: 'internationalization',
        prompt: 'How many morphemes are in this word?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '5',
      },
    ],
    LEX: [
      {
        minDiff: -2, maxDiff: 0,
        content: 'important',
        prompt: 'Select the synonym:',
        options: ['trivial', 'significant', 'minor', 'weak'],
        correctAnswer: 'significant',
      },
      {
        minDiff: 0, maxDiff: 2,
        content: 'ubiquitous',
        prompt: 'This word means:',
        options: ['rare', 'everywhere', 'unique', 'dangerous'],
        correctAnswer: 'everywhere',
      },
    ],
    SYNT: [
      {
        minDiff: -2, maxDiff: 0,
        content: 'She ___ to the store yesterday.',
        prompt: 'Complete with the correct verb form:',
        options: ['go', 'goes', 'went', 'going'],
        correctAnswer: 'went',
      },
      {
        minDiff: 0, maxDiff: 2,
        content: 'The report, which was submitted late, ___ rejected.',
        prompt: 'Complete with the correct verb form:',
        options: ['was', 'were', 'being', 'been'],
        correctAnswer: 'was',
      },
    ],
    PRAG: [
      {
        minDiff: -2, maxDiff: 0,
        content: 'Asking a stranger for directions',
        prompt: 'The most appropriate phrase is:',
        options: ['Tell me the way!', 'Excuse me, could you help me?', 'Hey, where is it?', 'You must tell me.'],
        correctAnswer: 'Excuse me, could you help me?',
      },
      {
        minDiff: 0, maxDiff: 2,
        content: 'Declining a formal invitation',
        prompt: 'The most appropriate response is:',
        options: ['No way!', 'I can\'t come.', 'I regret that I am unable to attend.', 'Whatever.'],
        correctAnswer: 'I regret that I am unable to attend.',
      },
    ],
  };

  const items = itemBanks[component] || itemBanks.LEX;

  // Find item closest to difficulty
  let bestItem = items[0];
  let bestDistance = Infinity;

  for (const item of items) {
    const midpoint = (item.minDiff + item.maxDiff) / 2;
    const distance = Math.abs(midpoint - difficulty);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestItem = item;
    }
  }

  return {
    content: bestItem.content,
    prompt: bestItem.prompt,
    options: bestItem.options,
    correctAnswer: bestItem.correctAnswer,
  };
}

// =============================================================================
// Utilities
// =============================================================================

function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =============================================================================
// Exports (types only - functions already exported inline)
// =============================================================================

export type { PlacementItem, CEFRLevel };
