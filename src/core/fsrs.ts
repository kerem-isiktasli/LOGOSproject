/**
 * FSRS (Free Spaced Repetition Scheduler) Module
 *
 * Pure TypeScript implementation of spaced repetition algorithm.
 * Compatible with ts-fsrs library but can work standalone.
 *
 * From ALGORITHMIC-FOUNDATIONS.md Part 3
 */

// ============================================================================
// Types
// ============================================================================

export type FSRSRating = 1 | 2 | 3 | 4;  // Again, Hard, Good, Easy
export type FSRSState = 'new' | 'learning' | 'review' | 'relearning';
export type MasteryStage = 0 | 1 | 2 | 3 | 4;

export interface FSRSCard {
  difficulty: number;      // D ∈ [1, 10]
  stability: number;       // S (days until 90% retention)
  lastReview: Date | null;
  reps: number;
  lapses: number;
  state: FSRSState;
}

export interface FSRSParameters {
  requestRetention: number;  // Target retention rate (default: 0.9)
  maximumInterval: number;   // Max days between reviews
  w: number[];               // 17 weight parameters
}

export interface MasteryState {
  stage: MasteryStage;
  fsrsCard: FSRSCard;
  cueFreeAccuracy: number;
  cueAssistedAccuracy: number;
  exposureCount: number;
}

/**
 * Response data for FSRS rating conversion.
 * Renamed to avoid confusion with bottleneck.ts ResponseData.
 *
 * @see MasteryResponse in types.ts for the canonical type
 */
export interface FSRSResponseData {
  correct: boolean;
  cueLevel: 0 | 1 | 2 | 3;  // 0 = cue-free
  responseTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default FSRS weights (v4 algorithm).
 * These are empirically derived from Anki user data.
 */
export const DEFAULT_WEIGHTS: number[] = [
  0.4, 0.6, 2.4, 5.8,        // Initial stability by rating [0-3]
  4.93, 0.94, 0.86, 0.01,    // Difficulty modifiers [4-7]
  1.49, 0.14, 0.94,          // Stability modifiers [8-10]
  2.18, 0.05, 0.34, 1.26,    // Success/fail modifiers [11-14]
  0.29, 2.61                  // Additional [15-16]
];

export const DEFAULT_PARAMETERS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 36500,  // 100 years
  w: DEFAULT_WEIGHTS
};

/**
 * Thresholds for mastery stage determination.
 */
export const STAGE_THRESHOLDS = {
  cueFreeAccuracy: {
    stage2: 0.6,   // Can recall more often than not
    stage3: 0.75,  // Reliable under effort
    stage4: 0.9    // Near-perfect
  },
  stability: {
    stage3: 7,     // Week of retention
    stage4: 30     // Month of retention
  },
  scaffoldingGap: {
    stage4: 0.1    // Minimal gap between cued and cue-free
  }
};

// ============================================================================
// FSRS Class
// ============================================================================

/**
 * Free Spaced Repetition Scheduler.
 *
 * Implements the FSRS-4 algorithm for optimal review scheduling.
 * Key insight: stability represents days until 90% retention probability.
 *
 * @example
 * ```typescript
 * const fsrs = new FSRS();
 * let card = createNewCard();
 * card = fsrs.schedule(card, 3, new Date()); // User pressed "Good"
 * console.log(fsrs.retrievability(card, new Date())); // Current recall probability
 * ```
 */
export class FSRS {
  private params: FSRSParameters;

  constructor(params?: Partial<FSRSParameters>) {
    this.params = {
      ...DEFAULT_PARAMETERS,
      ...params
    };
  }

  /**
   * Calculate current retrievability (probability of recall).
   *
   * R = e^(-t/S) where t = elapsed days, S = stability
   */
  retrievability(card: FSRSCard, now: Date): number {
    if (!card.lastReview) return 0;
    const elapsedDays = this.daysSince(card.lastReview, now);
    return Math.exp(-elapsedDays / Math.max(card.stability, 0.1));
  }

  /**
   * Schedule next review based on user response.
   *
   * @param card - Current card state
   * @param rating - User response (1=Again, 2=Hard, 3=Good, 4=Easy)
   * @param now - Current timestamp
   * @returns Updated card with new scheduling
   */
  schedule(card: FSRSCard, rating: FSRSRating, now: Date): FSRSCard {
    const newCard = { ...card };

    if (card.state === 'new' || !card.lastReview) {
      // First review - initialize stability and difficulty
      newCard.stability = this.initialStability(rating);
      newCard.difficulty = this.initialDifficulty(rating);
      newCard.state = rating === 1 ? 'learning' : 'review';
    } else {
      // Subsequent review - update based on response
      const retrievability = this.retrievability(card, now);
      newCard.difficulty = this.nextDifficulty(card.difficulty, rating);
      newCard.stability = this.nextStability(
        card.stability,
        card.difficulty,
        retrievability,
        rating
      );

      if (rating === 1) {
        newCard.lapses += 1;
        newCard.state = 'relearning';
      } else {
        newCard.state = 'review';
      }
    }

    newCard.lastReview = now;
    newCard.reps += 1;

    return newCard;
  }

  /**
   * Calculate optimal interval until next review.
   *
   * Interval where retention = requestRetention
   */
  nextInterval(stability: number): number {
    const interval = stability * Math.log(this.params.requestRetention) / Math.log(0.9);
    return Math.min(
      this.params.maximumInterval,
      Math.max(1, Math.round(interval))
    );
  }

  /**
   * Get next review date.
   */
  nextReviewDate(card: FSRSCard): Date {
    if (!card.lastReview) return new Date();
    const interval = this.nextInterval(card.stability);
    const next = new Date(card.lastReview);
    next.setDate(next.getDate() + interval);
    return next;
  }

  // ---- Private Methods ----

  private initialStability(rating: FSRSRating): number {
    return this.params.w[rating - 1];
  }

  private initialDifficulty(rating: FSRSRating): number {
    const d = this.params.w[4] - (rating - 3) * this.params.w[5];
    return Math.min(10, Math.max(1, d));
  }

  private nextDifficulty(d: number, rating: FSRSRating): number {
    const deltaDifficulty = -this.params.w[6] * (rating - 3);
    return Math.min(10, Math.max(1, d + deltaDifficulty));
  }

  private nextStability(
    s: number,
    d: number,
    r: number,
    rating: FSRSRating
  ): number {
    if (rating === 1) {
      // Failed - stability decreases
      const newS = this.params.w[11] *
        Math.pow(d, -this.params.w[12]) *
        (Math.pow(s + 1, this.params.w[13]) - 1);
      return Math.max(0.1, newS);
    }

    // Success - stability increases
    const hardPenalty = rating === 2 ? this.params.w[15] : 1;
    const easyBonus = rating === 4 ? this.params.w[16] : 1;

    return s * (
      1 +
      Math.exp(this.params.w[8]) *
      (11 - d) *
      Math.pow(s, -this.params.w[9]) *
      (Math.exp((1 - r) * this.params.w[10]) - 1) *
      hardPenalty *
      easyBonus
    );
  }

  private daysSince(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new FSRS card with default values.
 */
export function createNewCard(): FSRSCard {
  return {
    difficulty: 5,
    stability: 0,
    lastReview: null,
    reps: 0,
    lapses: 0,
    state: 'new'
  };
}

/**
 * Create initial mastery state for a new language object.
 */
export function createInitialMasteryState(): MasteryState {
  return {
    stage: 0,
    fsrsCard: createNewCard(),
    cueFreeAccuracy: 0,
    cueAssistedAccuracy: 0,
    exposureCount: 0
  };
}

/**
 * Convert user response to FSRS rating.
 *
 * Rating logic:
 * - Incorrect → 1 (Again)
 * - Correct with cues → 2 (Hard)
 * - Correct, slow → 3 (Good)
 * - Correct, fast → 4 (Easy)
 */
export function responseToRating(response: FSRSResponseData): FSRSRating {
  if (!response.correct) {
    return 1;  // Again
  }

  if (response.cueLevel > 0) {
    return 2;  // Hard (needed cues)
  }

  if (response.responseTimeMs > 5000) {
    return 3;  // Good (slow but correct)
  }

  return 4;  // Easy (fast and correct)
}

/**
 * Update mastery state after a response.
 *
 * This integrates FSRS scheduling with LOGOS mastery tracking.
 */
export function updateMastery(
  state: MasteryState,
  response: FSRSResponseData,
  fsrs: FSRS,
  now: Date
): MasteryState {
  const newState = { ...state };

  // Convert response to FSRS rating
  const rating = responseToRating(response);

  // Update FSRS card
  newState.fsrsCard = fsrs.schedule(state.fsrsCard, rating, now);
  newState.exposureCount += 1;

  // Update accuracy tracking with recency weighting
  const weight = 1 / (newState.exposureCount * 0.3 + 1);

  if (response.cueLevel === 0) {
    // Cue-free response
    newState.cueFreeAccuracy = (1 - weight) * state.cueFreeAccuracy +
      weight * (response.correct ? 1 : 0);
  } else {
    // Cue-assisted response
    newState.cueAssistedAccuracy = (1 - 0.2) * state.cueAssistedAccuracy +
      0.2 * (response.correct ? 1 : 0);
  }

  // Determine new stage
  newState.stage = determineStage(newState);

  return newState;
}

/**
 * Determine mastery stage based on current state.
 *
 * Stages:
 * 0 - Unknown: Never seen
 * 1 - Recognition: Can recognize with cues
 * 2 - Recall: Can recall > 60% cue-free
 * 3 - Controlled: Can produce reliably (75%+, week stability)
 * 4 - Automatic: Near-perfect, month+ stability, minimal gap
 */
export function determineStage(state: MasteryState): MasteryStage {
  if (state.exposureCount === 0) return 0;

  const gap = state.cueAssistedAccuracy - state.cueFreeAccuracy;
  const stability = state.fsrsCard.stability;
  const { cueFreeAccuracy, stability: stabThresh, scaffoldingGap } = STAGE_THRESHOLDS;

  // Stage 4: Automatic
  if (
    state.cueFreeAccuracy >= cueFreeAccuracy.stage4 &&
    stability > stabThresh.stage4 &&
    gap < scaffoldingGap.stage4
  ) {
    return 4;
  }

  // Stage 3: Controlled Production
  if (
    state.cueFreeAccuracy >= cueFreeAccuracy.stage3 &&
    stability > stabThresh.stage3
  ) {
    return 3;
  }

  // Stage 2: Recall
  if (
    state.cueFreeAccuracy >= cueFreeAccuracy.stage2 ||
    state.cueAssistedAccuracy >= 0.8
  ) {
    return 2;
  }

  // Stage 1: Recognition
  if (state.cueAssistedAccuracy >= 0.5) {
    return 1;
  }

  return 0;
}

/**
 * Calculate scaffolding gap (difference between assisted and free performance).
 * High gap = needs more practice without cues.
 */
export function calculateScaffoldingGap(state: MasteryState): number {
  return Math.max(0, state.cueAssistedAccuracy - state.cueFreeAccuracy);
}

/**
 * Determine appropriate cue level based on scaffolding gap.
 */
export function determineCueLevel(state: MasteryState): 0 | 1 | 2 | 3 {
  const gap = calculateScaffoldingGap(state);
  const attempts = state.exposureCount;

  if (gap < 0.1 && attempts > 3) return 0;  // No cues
  if (gap < 0.2 && attempts > 2) return 1;  // Minimal cues
  if (gap < 0.3) return 2;                   // Moderate cues
  return 3;                                   // Full cues
}
