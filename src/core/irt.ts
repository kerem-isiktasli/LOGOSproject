/**
 * LOGOS Item Response Theory (IRT) Module
 *
 * A pure TypeScript implementation of IRT algorithms for adaptive testing
 * and ability estimation. This module has NO external dependencies.
 *
 * Implements:
 * - 1PL (Rasch), 2PL, and 3PL probability models
 * - Maximum Likelihood Estimation (MLE) with Newton-Raphson
 * - Expected A Posteriori (EAP) estimation with Gaussian quadrature
 * - Fisher Information-based item selection
 * - Kullback-Leibler divergence item selection
 * - EM algorithm for item calibration
 *
 * @module core/irt
 */

import type { ItemParameter, ThetaEstimate, ItemCalibrationResult } from './types';

// ============================================================================
// PROBABILITY FUNCTIONS
// ============================================================================

/**
 * Calculates the probability of a correct response using the 1PL (Rasch) model.
 *
 * The Rasch model assumes equal discrimination across all items:
 * P(X = 1 | theta, b) = 1 / (1 + e^(-(theta - b)))
 *
 * @param theta - Person ability parameter (logit scale, typically -3 to +3)
 * @param b - Item difficulty parameter (logit scale)
 * @returns Probability of correct response (0 to 1)
 *
 * @example
 * ```typescript
 * // Person with average ability (0) on average difficulty item (0)
 * probability1PL(0, 0); // Returns 0.5
 *
 * // High ability person on easy item
 * probability1PL(2, -1); // Returns ~0.95
 * ```
 */
export function probability1PL(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

/**
 * Calculates the probability of a correct response using the 2PL model.
 *
 * The 2PL model adds a discrimination parameter:
 * P(X = 1 | theta, a, b) = 1 / (1 + e^(-a(theta - b)))
 *
 * @param theta - Person ability parameter (logit scale, typically -3 to +3)
 * @param a - Item discrimination parameter (slope, typically 0.5 to 2.5)
 * @param b - Item difficulty parameter (logit scale)
 * @returns Probability of correct response (0 to 1)
 *
 * @example
 * ```typescript
 * // High discrimination item (steep slope)
 * probability2PL(0, 2.0, 0); // Returns 0.5
 *
 * // Low discrimination item (gentle slope)
 * probability2PL(1, 0.5, 0); // Returns ~0.62
 * ```
 */
export function probability2PL(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}

/**
 * Calculates the probability of a correct response using the 3PL model.
 *
 * The 3PL model adds a guessing parameter (lower asymptote):
 * P(X = 1 | theta, a, b, c) = c + (1 - c) / (1 + e^(-a(theta - b)))
 *
 * @param theta - Person ability parameter (logit scale, typically -3 to +3)
 * @param a - Item discrimination parameter (slope, typically 0.5 to 2.5)
 * @param b - Item difficulty parameter (logit scale)
 * @param c - Guessing parameter (lower asymptote, typically 0 to 0.35)
 * @returns Probability of correct response (c to 1)
 *
 * @example
 * ```typescript
 * // 4-option MCQ (25% guessing chance)
 * probability3PL(-3, 1.0, 0, 0.25); // Returns ~0.25 (near guessing level)
 *
 * // High ability on easy item with guessing
 * probability3PL(2, 1.5, -1, 0.25); // Returns ~0.99
 * ```
 */
export function probability3PL(
  theta: number,
  a: number,
  b: number,
  c: number
): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

// ============================================================================
// THETA ESTIMATION
// ============================================================================

/**
 * Estimates theta (ability) using Maximum Likelihood Estimation with Newton-Raphson.
 *
 * MLE finds the theta value that maximizes the likelihood of the observed
 * response pattern. Uses iterative Newton-Raphson optimization.
 *
 * Note: MLE can be unstable with extreme response patterns (all correct or
 * all incorrect). Consider using EAP estimation for such cases.
 *
 * @param responses - Array of response outcomes (true = correct, false = incorrect)
 * @param items - Array of item parameters corresponding to each response
 * @returns Object containing estimated theta and standard error
 *
 * @example
 * ```typescript
 * const responses = [true, true, false, true, false];
 * const items = [
 *   { id: '1', a: 1.0, b: -1.0 },
 *   { id: '2', a: 1.2, b: 0.0 },
 *   { id: '3', a: 0.8, b: 0.5 },
 *   { id: '4', a: 1.5, b: 1.0 },
 *   { id: '5', a: 1.0, b: 1.5 },
 * ];
 * const result = estimateThetaMLE(responses, items);
 * // result.theta: estimated ability
 * // result.se: standard error of estimate
 * ```
 */
export function estimateThetaMLE(
  responses: boolean[],
  items: ItemParameter[]
): ThetaEstimate {
  // Newton-Raphson iteration
  let theta = 0; // Initial estimate
  const MAX_ITER = 50;
  const TOLERANCE = 0.001;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // First derivative (score function)
    let L1 = 0;
    // Second derivative (Fisher information)
    let L2 = 0;

    for (let i = 0; i < responses.length; i++) {
      const { a, b } = items[i];
      const p = probability2PL(theta, a, b);
      const q = 1 - p;
      const u = responses[i] ? 1 : 0;

      L1 += a * (u - p);
      L2 -= a * a * p * q;
    }

    // Avoid division by zero
    if (L2 === 0) break;

    const delta = L1 / L2;
    theta -= delta;

    if (Math.abs(delta) < TOLERANCE) break;
  }

  // Standard error = 1 / sqrt(Fisher Information)
  const fisherInfo = items.reduce((sum, item) => {
    const p = probability2PL(theta, item.a, item.b);
    return sum + item.a * item.a * p * (1 - p);
  }, 0);

  return {
    theta,
    se: fisherInfo > 0 ? 1 / Math.sqrt(fisherInfo) : Infinity
  };
}

/**
 * Estimates theta using Expected A Posteriori (EAP) with Gaussian quadrature.
 *
 * EAP is a Bayesian approach that incorporates a prior distribution on theta.
 * It is more stable than MLE for extreme response patterns and short tests.
 *
 * The estimate is the mean of the posterior distribution, computed via
 * numerical integration using Gaussian quadrature.
 *
 * @param responses - Array of response outcomes (true = correct, false = incorrect)
 * @param items - Array of item parameters corresponding to each response
 * @param priorMean - Mean of the prior normal distribution (default: 0)
 * @param priorSD - Standard deviation of the prior distribution (default: 1)
 * @param quadPoints - Number of quadrature points for integration (default: 41)
 * @returns Object containing estimated theta and posterior standard error
 *
 * @example
 * ```typescript
 * const responses = [true, true, true]; // All correct - MLE would diverge
 * const items = [
 *   { id: '1', a: 1.0, b: -1.0 },
 *   { id: '2', a: 1.0, b: 0.0 },
 *   { id: '3', a: 1.0, b: 1.0 },
 * ];
 *
 * // EAP provides stable estimate even with extreme patterns
 * const result = estimateThetaEAP(responses, items, 0, 1);
 * ```
 */
export function estimateThetaEAP(
  responses: boolean[],
  items: ItemParameter[],
  priorMean: number = 0,
  priorSD: number = 1,
  quadPoints: number = 41
): ThetaEstimate {
  // Gaussian quadrature points
  const points: number[] = [];
  const weights: number[] = [];

  for (let i = 0; i < quadPoints; i++) {
    const x = priorMean + priorSD * 4 * (i / (quadPoints - 1) - 0.5);
    points.push(x);
    // Normal distribution weight
    weights.push(Math.exp(-0.5 * Math.pow((x - priorMean) / priorSD, 2)));
  }

  // Compute likelihood at each quadrature point
  const likelihoods = points.map((theta, idx) => {
    const likelihood = responses.reduce((prod, correct, i) => {
      const p = probability2PL(theta, items[i].a, items[i].b);
      return prod * (correct ? p : 1 - p);
    }, 1);
    return likelihood * weights[idx];
  });

  const sumLikelihoods = likelihoods.reduce((a, b) => a + b, 0);

  // Handle edge case of zero likelihood sum
  if (sumLikelihoods === 0) {
    return { theta: priorMean, se: priorSD };
  }

  // EAP = weighted mean
  const eap =
    points.reduce((sum, theta, i) => sum + theta * likelihoods[i], 0) /
    sumLikelihoods;

  // Posterior variance
  const variance =
    points.reduce(
      (sum, theta, i) => sum + Math.pow(theta - eap, 2) * likelihoods[i],
      0
    ) / sumLikelihoods;

  return {
    theta: eap,
    se: Math.sqrt(variance)
  };
}

// ============================================================================
// ITEM SELECTION
// ============================================================================

/**
 * Calculates Fisher Information for a 2PL item at a given ability level.
 *
 * Fisher Information quantifies how much information an item provides
 * about ability at a specific theta value. Higher information means
 * more precise measurement at that ability level.
 *
 * For 2PL: I(theta) = a^2 * P(theta) * Q(theta)
 *
 * @param theta - Ability level at which to calculate information
 * @param a - Item discrimination parameter
 * @param b - Item difficulty parameter
 * @returns Fisher Information value (always non-negative)
 *
 * @example
 * ```typescript
 * // Information is maximized when theta equals difficulty
 * fisherInformation(0, 1.0, 0); // Maximum for this item
 *
 * // Higher discrimination = more information
 * fisherInformation(0, 2.0, 0); // 4x the information of a=1.0
 * ```
 */
export function fisherInformation(theta: number, a: number, b: number): number {
  const p = probability2PL(theta, a, b);
  const q = 1 - p;
  return a * a * p * q;
}

/**
 * Selects the next item using Fisher Information maximization.
 *
 * This is the classic CAT item selection method. It chooses the item
 * from the available pool that provides maximum information at the
 * current theta estimate.
 *
 * @param currentTheta - Current estimate of examinee ability
 * @param availableItems - Pool of items to select from
 * @param usedItemIds - Set of item IDs that have already been administered
 * @returns The item with maximum information at currentTheta, or null if no items available
 *
 * @example
 * ```typescript
 * const theta = 0.5;
 * const items = [
 *   { id: '1', a: 1.0, b: -1.0 },
 *   { id: '2', a: 1.5, b: 0.5 },  // Best match for theta=0.5
 *   { id: '3', a: 1.2, b: 2.0 },
 * ];
 * const used = new Set(['1']);
 *
 * const next = selectNextItem(theta, items, used);
 * // Returns item '2' (highest info at theta=0.5 among unused)
 * ```
 */
export function selectNextItem(
  currentTheta: number,
  availableItems: ItemParameter[],
  usedItemIds: Set<string>
): ItemParameter | null {
  let bestItem: ItemParameter | null = null;
  let maxInfo = -Infinity;

  for (const item of availableItems) {
    if (usedItemIds.has(item.id)) continue;

    // Fisher Information for 2PL model
    const p = probability2PL(currentTheta, item.a, item.b);
    const q = 1 - p;
    const info = item.a * item.a * p * q;

    if (info > maxInfo) {
      maxInfo = info;
      bestItem = item;
    }
  }

  return bestItem;
}

/**
 * Selects the next item using Kullback-Leibler divergence criterion.
 *
 * KL-based selection accounts for uncertainty in the theta estimate by
 * integrating over the posterior distribution. This can provide better
 * item selection when theta estimates have high standard error.
 *
 * @param thetaEstimate - Current theta estimate
 * @param thetaSE - Standard error of the theta estimate
 * @param availableItems - Pool of items to select from
 * @returns The item with maximum expected KL divergence, or null if no items available
 *
 * @example
 * ```typescript
 * const theta = 0.5;
 * const se = 0.8; // High uncertainty
 * const items = [
 *   { id: '1', a: 1.0, b: -1.0 },
 *   { id: '2', a: 1.5, b: 0.5 },
 *   { id: '3', a: 2.0, b: 1.0 },
 * ];
 *
 * // KL selection accounts for uncertainty in theta
 * const next = selectItemKL(theta, se, items);
 * ```
 */
export function selectItemKL(
  thetaEstimate: number,
  thetaSE: number,
  availableItems: ItemParameter[]
): ItemParameter | null {
  // Integrate KL divergence over posterior distribution
  const quadPoints = 21;
  let bestItem: ItemParameter | null = null;
  let maxKL = -Infinity;

  for (const item of availableItems) {
    let klSum = 0;

    for (let i = 0; i < quadPoints; i++) {
      const theta =
        thetaEstimate + thetaSE * 3 * (i / (quadPoints - 1) - 0.5);
      const weight = Math.exp(
        -0.5 * Math.pow((theta - thetaEstimate) / thetaSE, 2)
      );

      const p = probability2PL(theta, item.a, item.b);
      const pEst = probability2PL(thetaEstimate, item.a, item.b);

      // KL divergence with numerical stability
      const epsilon = 1e-10;
      const pSafe = Math.max(epsilon, Math.min(1 - epsilon, p));
      const pEstSafe = Math.max(epsilon, Math.min(1 - epsilon, pEst));

      const kl =
        pSafe * Math.log(pSafe / pEstSafe) +
        (1 - pSafe) * Math.log((1 - pSafe) / (1 - pEstSafe));
      klSum += kl * weight;
    }

    if (klSum > maxKL) {
      maxKL = klSum;
      bestItem = item;
    }
  }

  return bestItem;
}

// ============================================================================
// ITEM CALIBRATION
// ============================================================================

/**
 * Calibrates item parameters from response data using the EM algorithm.
 *
 * This function estimates 2PL item parameters (discrimination and difficulty)
 * from a matrix of response data using Marginal Maximum Likelihood via
 * the Expectation-Maximization algorithm.
 *
 * The algorithm alternates between:
 * - E-step: Estimate person abilities given current item parameters
 * - M-step: Update item parameters given ability estimates
 *
 * @param responseMatrix - 2D array of responses [person][item], true = correct
 * @param maxIter - Maximum number of EM iterations (default: 100)
 * @returns Array of calibration results with a, b, and standard errors for each item
 *
 * @example
 * ```typescript
 * // Response matrix: 5 people, 3 items
 * const responses = [
 *   [true, true, false],   // Person 1
 *   [true, false, false],  // Person 2
 *   [false, false, false], // Person 3
 *   [true, true, true],    // Person 4
 *   [true, true, false],   // Person 5
 * ];
 *
 * const calibrated = calibrateItems(responses);
 * // calibrated[0]: { a: 1.2, b: -0.5, se_a: 0.15, se_b: 0.12 }
 * // calibrated[1]: { a: 1.0, b: 0.3, se_a: 0.14, se_b: 0.11 }
 * // calibrated[2]: { a: 0.9, b: 1.5, se_a: 0.18, se_b: 0.16 }
 * ```
 */
export function calibrateItems(
  responseMatrix: boolean[][],
  maxIter: number = 100
): ItemCalibrationResult[] {
  const nPersons = responseMatrix.length;
  const nItems = responseMatrix[0]?.length ?? 0;

  if (nPersons === 0 || nItems === 0) {
    return [];
  }

  // Initial estimates
  const params: ItemCalibrationResult[] = Array(nItems)
    .fill(null)
    .map(() => ({
      a: 1.0,
      b: 0.0,
      se_a: 0,
      se_b: 0
    }));

  // E-step: Estimate theta for each person given current item params
  // M-step: Estimate item params given theta distribution

  for (let iter = 0; iter < maxIter; iter++) {
    // E-step: EAP for each person
    const thetas = responseMatrix.map((responses) =>
      estimateThetaEAP(
        responses,
        params.map((p, i) => ({ id: String(i), ...p }))
      ).theta
    );

    // M-step: Update item parameters via gradient descent
    for (let j = 0; j < nItems; j++) {
      let sumGradA = 0;
      let sumGradB = 0;
      let sumHessAA = 0;
      let sumHessBB = 0;

      for (let i = 0; i < nPersons; i++) {
        const theta = thetas[i];
        const { a, b } = params[j];
        const p = probability2PL(theta, a, b);
        const u = responseMatrix[i][j] ? 1 : 0;

        // Gradients
        sumGradA += (u - p) * (theta - b);
        sumGradB += (u - p) * -a;

        // Hessian (diagonal approximation)
        sumHessAA -= p * (1 - p) * Math.pow(theta - b, 2);
        sumHessBB -= p * (1 - p) * a * a;
      }

      // Newton-Raphson update with regularization
      if (sumHessAA !== 0) {
        params[j].a -= sumGradA / (sumHessAA - 0.01);
      }
      if (sumHessBB !== 0) {
        params[j].b -= sumGradB / (sumHessBB - 0.01);
      }

      // Constrain parameters to reasonable ranges
      params[j].a = Math.max(0.2, Math.min(3.0, params[j].a));
      params[j].b = Math.max(-4.0, Math.min(4.0, params[j].b));
    }
  }

  // Compute standard errors from final Fisher Information
  for (let j = 0; j < nItems; j++) {
    const { a, b } = params[j];

    // Approximate standard errors from observed information
    let infoA = 0;
    let infoB = 0;

    for (let i = 0; i < nPersons; i++) {
      const theta = estimateThetaEAP(
        responseMatrix[i],
        params.map((p, idx) => ({ id: String(idx), ...p }))
      ).theta;
      const p = probability2PL(theta, a, b);
      const q = 1 - p;

      infoA += p * q * Math.pow(theta - b, 2);
      infoB += p * q * a * a;
    }

    params[j].se_a = infoA > 0 ? 1 / Math.sqrt(infoA) : Infinity;
    params[j].se_b = infoB > 0 ? 1 / Math.sqrt(infoB) : Infinity;
  }

  return params;
}
