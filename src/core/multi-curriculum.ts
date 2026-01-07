/**
 * LOGOS Multi-Curriculum Management Module
 *
 * Enables simultaneous management of multiple learning goals with
 * Pareto-optimal resource allocation and shared object benefits.
 *
 * Academic Foundations:
 * - Multi-Objective Optimization (MOO): Pareto optimality for balancing competing goals
 * - Curriculum Learning (Narvekar et al., 2020): Task sequencing for optimal learning
 * - Cross-Course Learning Path Planning: Knowledge graph integration
 * - Syllabus Framework (RLJ 2025): Modular curriculum learning design
 *
 * This module implements:
 * 1. Pareto frontier computation for goal allocation
 * 2. Shared object benefit analysis (synergy detection)
 * 3. Multi-goal session planning
 * 4. Progress balancing across goals
 * 5. Transfer benefit calculation between goals
 *
 * @module core/multi-curriculum
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A learning curriculum goal.
 *
 * Represents a distinct learning objective with its own target,
 * deadline, and priority weight.
 */
export interface CurriculumGoal {
  /** Unique goal identifier */
  id: string;

  /** Goal name for display */
  name: string;

  /** Domain context (medical, legal, business, etc.) */
  domain: string;

  /** Target proficiency level (theta) */
  targetTheta: number;

  /** Current proficiency level */
  currentTheta: number;

  /** Optional deadline */
  deadline?: Date;

  /** User-assigned importance weight (0-1) */
  weight: number;

  /** Whether the goal is currently active */
  isActive: boolean;

  /** Total objects in this goal */
  totalObjects: number;

  /** Mastered objects count */
  masteredObjects: number;

  /** Modalities targeted by this goal */
  modalities: string[];
}

/**
 * A single solution in the Pareto frontier.
 *
 * Represents a non-dominated allocation of time/effort across goals.
 */
export interface ParetoSolution {
  /** Time fraction allocated to each goal (sums to 1) */
  goalAllocations: Record<string, number>;

  /** Expected progress rate for each goal (change per session) */
  expectedProgress: Record<string, number>;

  /** Whether this solution is dominated by another */
  isDominated: boolean;

  /** Overall efficiency score */
  efficiencyScore: number;

  /** Deadline risk score (higher = more at risk) */
  deadlineRiskScore: number;
}

/**
 * An object shared between multiple goals.
 *
 * Learning this object benefits multiple curricula simultaneously.
 */
export interface SharedObject {
  /** Object identifier */
  objectId: string;

  /** Object content */
  content: string;

  /** Goals that include this object */
  benefitingGoals: string[];

  /** Base difficulty (IRT b parameter) */
  baseDifficulty: number;

  /** Benefit to each goal (relevance × priority) */
  goalBenefits: Record<string, number>;

  /** Total benefit across all goals */
  totalBenefit: number;

  /** Extra benefit from multi-goal relevance */
  synergyBonus: number;

  /** Priority boost from being shared */
  priorityBoost: number;
}

/**
 * Session plan for multi-goal learning.
 */
export interface MultiGoalSessionPlan {
  /** Session duration in minutes */
  durationMinutes: number;

  /** Time allocated to each goal */
  goalTimeAllocation: Record<string, number>;

  /** Ordered list of objects to practice */
  objectSequence: Array<{
    objectId: string;
    goalId: string;
    estimatedMinutes: number;
    isShared: boolean;
  }>;

  /** Shared objects prioritized for efficiency */
  prioritizedSharedObjects: SharedObject[];

  /** Expected progress by end of session */
  expectedOutcomes: Record<string, number>;
}

/**
 * Progress snapshot for tracking multi-goal advancement.
 */
export interface MultiGoalProgress {
  /** Progress for each goal (0-1) */
  goalProgress: Record<string, number>;

  /** Distance to target for each goal */
  thetaGaps: Record<string, number>;

  /** Time remaining until deadlines */
  deadlineProximity: Record<string, number | null>;

  /** Overall portfolio balance score */
  balanceScore: number;

  /** Goals that need attention */
  attentionNeeded: string[];
}

/**
 * Transfer relationship between goals.
 */
export interface GoalTransfer {
  /** Source goal ID */
  fromGoalId: string;

  /** Target goal ID */
  toGoalId: string;

  /** Transfer coefficient (0-1) */
  transferCoefficient: number;

  /** Shared concepts/objects count */
  sharedCount: number;

  /** Domain similarity score */
  domainSimilarity: number;
}

/**
 * User preference for allocation strategy.
 */
export type AllocationPreference =
  | 'balanced'        // Equal progress across all goals
  | 'deadline_focused' // Prioritize goals with approaching deadlines
  | 'progress_focused' // Maximize total progress
  | 'synergy_focused'  // Maximize shared object benefits
  | 'custom';          // User-defined weights

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum allocation fraction for any active goal.
 * Prevents complete neglect of any goal.
 */
const MIN_ALLOCATION = 0.05;

/**
 * Maximum allocation fraction for any single goal.
 * Ensures diversification.
 */
const MAX_ALLOCATION = 0.8;

/**
 * Number of solutions to generate for Pareto frontier.
 */
const PARETO_SAMPLES = 20;

/**
 * Synergy bonus multiplier for shared objects.
 */
const SYNERGY_MULTIPLIER = 1.5;

/**
 * Domain similarity weights.
 */
const DOMAIN_SIMILARITY: Record<string, Record<string, number>> = {
  medical: { medical: 1.0, healthcare: 0.8, science: 0.5, general: 0.3 },
  legal: { legal: 1.0, business: 0.5, academic: 0.4, general: 0.3 },
  business: { business: 1.0, finance: 0.7, legal: 0.5, general: 0.4 },
  academic: { academic: 1.0, science: 0.6, general: 0.4 },
  general: { general: 1.0, academic: 0.4, business: 0.3 },
};

// ============================================================================
// Pareto Optimization
// ============================================================================

/**
 * Computes the Pareto frontier for goal allocations.
 *
 * The Pareto frontier contains all non-dominated solutions where
 * no goal can be improved without hurting another.
 *
 * @param goals - Active curriculum goals
 * @param availableMinutes - Total time available
 * @returns Array of non-dominated solutions
 */
export function computeParetoFrontier(
  goals: CurriculumGoal[],
  availableMinutes: number
): ParetoSolution[] {
  if (goals.length === 0) return [];
  if (goals.length === 1) {
    // Single goal: trivial allocation
    return [
      {
        goalAllocations: { [goals[0].id]: 1.0 },
        expectedProgress: { [goals[0].id]: estimateProgressRate(goals[0], availableMinutes) },
        isDominated: false,
        efficiencyScore: 1.0,
        deadlineRiskScore: calculateDeadlineRisk(goals[0]),
      },
    ];
  }

  const solutions: ParetoSolution[] = [];

  // Generate sample allocations
  for (let i = 0; i < PARETO_SAMPLES; i++) {
    const allocation = generateRandomAllocation(goals);
    const solution = evaluateAllocation(goals, allocation, availableMinutes);
    solutions.push(solution);
  }

  // Add strategic allocations
  solutions.push(evaluateAllocation(goals, generateEqualAllocation(goals), availableMinutes));
  solutions.push(evaluateAllocation(goals, generateDeadlineWeightedAllocation(goals), availableMinutes));
  solutions.push(evaluateAllocation(goals, generateProgressWeightedAllocation(goals), availableMinutes));

  // Mark dominated solutions
  return markDominatedSolutions(solutions);
}

/**
 * Generates a random allocation across goals.
 */
function generateRandomAllocation(goals: CurriculumGoal[]): Record<string, number> {
  const allocation: Record<string, number> = {};
  let remaining = 1.0;

  // Assign random fractions respecting min/max constraints
  goals.forEach((goal, index) => {
    if (index === goals.length - 1) {
      allocation[goal.id] = Math.max(MIN_ALLOCATION, Math.min(MAX_ALLOCATION, remaining));
    } else {
      const maxPossible = Math.min(MAX_ALLOCATION, remaining - (goals.length - index - 1) * MIN_ALLOCATION);
      const minPossible = Math.max(MIN_ALLOCATION, remaining - (goals.length - index - 1) * MAX_ALLOCATION);
      const fraction = minPossible + Math.random() * (maxPossible - minPossible);
      allocation[goal.id] = fraction;
      remaining -= fraction;
    }
  });

  return allocation;
}

/**
 * Generates equal allocation across all goals.
 */
function generateEqualAllocation(goals: CurriculumGoal[]): Record<string, number> {
  const fraction = 1.0 / goals.length;
  const allocation: Record<string, number> = {};
  goals.forEach((goal) => {
    allocation[goal.id] = fraction;
  });
  return allocation;
}

/**
 * Generates allocation weighted by deadline proximity.
 */
function generateDeadlineWeightedAllocation(goals: CurriculumGoal[]): Record<string, number> {
  const allocation: Record<string, number> = {};
  const weights: Record<string, number> = {};
  let totalWeight = 0;

  goals.forEach((goal) => {
    const risk = calculateDeadlineRisk(goal);
    weights[goal.id] = 1 + risk * 2; // Higher risk = more weight
    totalWeight += weights[goal.id];
  });

  goals.forEach((goal) => {
    allocation[goal.id] = Math.max(
      MIN_ALLOCATION,
      Math.min(MAX_ALLOCATION, weights[goal.id] / totalWeight)
    );
  });

  return normalizeAllocation(allocation);
}

/**
 * Generates allocation weighted by progress gap.
 */
function generateProgressWeightedAllocation(goals: CurriculumGoal[]): Record<string, number> {
  const allocation: Record<string, number> = {};
  const weights: Record<string, number> = {};
  let totalWeight = 0;

  goals.forEach((goal) => {
    const gap = goal.targetTheta - goal.currentTheta;
    weights[goal.id] = Math.max(0.1, gap) * goal.weight;
    totalWeight += weights[goal.id];
  });

  goals.forEach((goal) => {
    allocation[goal.id] = Math.max(
      MIN_ALLOCATION,
      Math.min(MAX_ALLOCATION, weights[goal.id] / totalWeight)
    );
  });

  return normalizeAllocation(allocation);
}

/**
 * Normalizes allocation to sum to 1.
 */
function normalizeAllocation(allocation: Record<string, number>): Record<string, number> {
  const total = Object.values(allocation).reduce((sum, v) => sum + v, 0);
  const normalized: Record<string, number> = {};
  Object.entries(allocation).forEach(([key, value]) => {
    normalized[key] = value / total;
  });
  return normalized;
}

/**
 * Evaluates an allocation and creates a ParetoSolution.
 */
function evaluateAllocation(
  goals: CurriculumGoal[],
  allocation: Record<string, number>,
  availableMinutes: number
): ParetoSolution {
  const expectedProgress: Record<string, number> = {};
  let totalEfficiency = 0;
  let totalDeadlineRisk = 0;

  goals.forEach((goal) => {
    const allocatedMinutes = availableMinutes * allocation[goal.id];
    const progress = estimateProgressRate(goal, allocatedMinutes);
    expectedProgress[goal.id] = progress;

    // Efficiency: progress per minute
    const efficiency = allocatedMinutes > 0 ? progress / allocatedMinutes : 0;
    totalEfficiency += efficiency * goal.weight;

    // Deadline risk
    totalDeadlineRisk += calculateDeadlineRisk(goal) * allocation[goal.id];
  });

  return {
    goalAllocations: allocation,
    expectedProgress,
    isDominated: false,
    efficiencyScore: totalEfficiency / goals.length,
    deadlineRiskScore: totalDeadlineRisk,
  };
}

/**
 * Estimates progress rate for a goal given allocated time.
 *
 * Based on learning curve models where progress follows
 * a power law: progress = k * t^α
 *
 * @param goal - The goal
 * @param minutes - Allocated minutes
 * @returns Expected theta improvement
 */
export function estimateProgressRate(goal: CurriculumGoal, minutes: number): number {
  // Base progress rate (theta units per minute of effective practice)
  const baseRate = 0.01;

  // Adjust for current level (diminishing returns at higher levels)
  const levelFactor = 1 / (1 + 0.1 * goal.currentTheta);

  // Adjust for goal difficulty (gap to target)
  const gap = goal.targetTheta - goal.currentTheta;
  const gapFactor = gap > 0 ? Math.min(1, gap / 2) : 0;

  // Weight by goal importance
  const weightFactor = goal.weight;

  // Learning curve: progress = k * sqrt(t)
  const progress = baseRate * Math.sqrt(minutes) * levelFactor * gapFactor * weightFactor;

  return Math.max(0, progress);
}

/**
 * Calculates deadline risk for a goal.
 *
 * @param goal - The goal
 * @returns Risk score (0 = no risk, 1 = high risk)
 */
export function calculateDeadlineRisk(goal: CurriculumGoal): number {
  if (!goal.deadline) return 0;

  const now = new Date();
  const daysRemaining = (goal.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysRemaining <= 0) return 1.0; // Past deadline

  // Calculate required progress rate
  const gap = goal.targetTheta - goal.currentTheta;
  const requiredRatePerDay = gap / daysRemaining;

  // Historical average rate (assume 0.05 theta/day as baseline)
  const baselineRate = 0.05;

  // Risk increases as required rate exceeds baseline
  const riskRatio = requiredRatePerDay / baselineRate;

  // Sigmoid mapping for smooth risk curve
  return 1 / (1 + Math.exp(-2 * (riskRatio - 1)));
}

/**
 * Marks dominated solutions in the Pareto set.
 *
 * A solution is dominated if another solution is better in
 * at least one objective and not worse in any other.
 */
function markDominatedSolutions(solutions: ParetoSolution[]): ParetoSolution[] {
  return solutions.map((solution, i) => {
    let dominated = false;

    for (let j = 0; j < solutions.length; j++) {
      if (i === j) continue;

      const other = solutions[j];
      const dominates = isDominatedBy(solution, other);

      if (dominates) {
        dominated = true;
        break;
      }
    }

    return { ...solution, isDominated: dominated };
  });
}

/**
 * Checks if solution A is dominated by solution B.
 */
function isDominatedBy(a: ParetoSolution, b: ParetoSolution): boolean {
  // B must be at least as good in all objectives
  const aProgress = Object.values(a.expectedProgress);
  const bProgress = Object.values(b.expectedProgress);

  let bBetterInSome = false;
  let aBetterInSome = false;

  for (let i = 0; i < aProgress.length; i++) {
    if (bProgress[i] > aProgress[i]) {
      bBetterInSome = true;
    } else if (aProgress[i] > bProgress[i]) {
      aBetterInSome = true;
    }
  }

  // A is dominated if B is better in some and A is not better in any
  return bBetterInSome && !aBetterInSome;
}

/**
 * Selects the best allocation from the Pareto frontier.
 *
 * @param frontier - Pareto frontier solutions
 * @param preference - User's allocation preference
 * @param customWeights - Custom weights for 'custom' preference
 * @returns Selected solution
 */
export function selectParetoOptimalAllocation(
  frontier: ParetoSolution[],
  preference: AllocationPreference,
  customWeights?: Record<string, number>
): ParetoSolution | null {
  const nonDominated = frontier.filter((s) => !s.isDominated);
  if (nonDominated.length === 0) return frontier[0] || null;

  switch (preference) {
    case 'balanced':
      // Select solution with most balanced progress
      return selectMostBalanced(nonDominated);

    case 'deadline_focused':
      // Select solution with lowest deadline risk
      return selectLowestRisk(nonDominated);

    case 'progress_focused':
      // Select solution with highest total progress
      return selectMaxProgress(nonDominated);

    case 'synergy_focused':
      // Select solution with best efficiency (synergy utilization)
      return selectMaxEfficiency(nonDominated);

    case 'custom':
      // Select based on custom weights
      return selectByCustomWeights(nonDominated, customWeights || {});

    default:
      return nonDominated[0];
  }
}

/**
 * Selects the most balanced solution.
 */
function selectMostBalanced(solutions: ParetoSolution[]): ParetoSolution {
  let bestSolution = solutions[0];
  let bestBalance = Infinity;

  solutions.forEach((solution) => {
    const progressValues = Object.values(solution.expectedProgress);
    const mean = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
    const variance = progressValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / progressValues.length;

    if (variance < bestBalance) {
      bestBalance = variance;
      bestSolution = solution;
    }
  });

  return bestSolution;
}

/**
 * Selects solution with lowest deadline risk.
 */
function selectLowestRisk(solutions: ParetoSolution[]): ParetoSolution {
  return solutions.reduce((best, current) =>
    current.deadlineRiskScore < best.deadlineRiskScore ? current : best
  );
}

/**
 * Selects solution with maximum total progress.
 */
function selectMaxProgress(solutions: ParetoSolution[]): ParetoSolution {
  return solutions.reduce((best, current) => {
    const currentTotal = Object.values(current.expectedProgress).reduce((a, b) => a + b, 0);
    const bestTotal = Object.values(best.expectedProgress).reduce((a, b) => a + b, 0);
    return currentTotal > bestTotal ? current : best;
  });
}

/**
 * Selects solution with maximum efficiency.
 */
function selectMaxEfficiency(solutions: ParetoSolution[]): ParetoSolution {
  return solutions.reduce((best, current) =>
    current.efficiencyScore > best.efficiencyScore ? current : best
  );
}

/**
 * Selects solution based on custom weights.
 */
function selectByCustomWeights(
  solutions: ParetoSolution[],
  weights: Record<string, number>
): ParetoSolution {
  let bestSolution = solutions[0];
  let bestScore = -Infinity;

  solutions.forEach((solution) => {
    let score = 0;
    Object.entries(solution.expectedProgress).forEach(([goalId, progress]) => {
      score += progress * (weights[goalId] || 1);
    });

    if (score > bestScore) {
      bestScore = score;
      bestSolution = solution;
    }
  });

  return bestSolution;
}

// ============================================================================
// Shared Object Management
// ============================================================================

/**
 * Identifies objects shared between multiple goals.
 *
 * @param objectGoalMap - Map of object ID to goal IDs
 * @param objectDifficulties - Map of object ID to base difficulty
 * @param goalRelevance - Map of goalId -> objectId -> relevance score
 * @returns Array of shared objects with benefits
 */
export function findSharedObjects(
  objectGoalMap: Record<string, string[]>,
  objectDifficulties: Record<string, number>,
  goalRelevance: Record<string, Record<string, number>>
): SharedObject[] {
  const sharedObjects: SharedObject[] = [];

  Object.entries(objectGoalMap).forEach(([objectId, goalIds]) => {
    if (goalIds.length < 2) return; // Not shared

    // Calculate benefits for each goal
    const goalBenefits: Record<string, number> = {};
    let totalBenefit = 0;

    goalIds.forEach((goalId) => {
      const relevance = goalRelevance[goalId]?.[objectId] || 1.0;
      goalBenefits[goalId] = relevance;
      totalBenefit += relevance;
    });

    // Synergy bonus: learning once benefits multiple goals
    const synergyBonus = (goalIds.length - 1) * SYNERGY_MULTIPLIER * (totalBenefit / goalIds.length);

    // Priority boost based on number of goals benefiting
    const priorityBoost = Math.log(1 + goalIds.length) / Math.log(5); // Normalized to ~1 at 4 goals

    sharedObjects.push({
      objectId,
      content: '', // To be filled by caller
      benefitingGoals: goalIds,
      baseDifficulty: objectDifficulties[objectId] || 0,
      goalBenefits,
      totalBenefit: totalBenefit + synergyBonus,
      synergyBonus,
      priorityBoost,
    });
  });

  // Sort by total benefit
  return sharedObjects.sort((a, b) => b.totalBenefit - a.totalBenefit);
}

/**
 * Prioritizes objects considering multi-goal benefits.
 *
 * @param objects - Array of shared objects
 * @param activeGoals - Currently active goals
 * @param userTheta - User's current theta
 * @returns Prioritized objects
 */
export function prioritizeWithMultiGoalBenefit(
  objects: SharedObject[],
  activeGoals: CurriculumGoal[],
  userTheta: number
): SharedObject[] {
  return objects
    .map((obj) => {
      // Calculate weighted benefit based on active goal weights
      let weightedBenefit = 0;
      activeGoals.forEach((goal) => {
        if (obj.benefitingGoals.includes(goal.id)) {
          weightedBenefit += (obj.goalBenefits[goal.id] || 1) * goal.weight;
        }
      });

      // IRT-based appropriateness (closer to theta = better)
      const difficultyMatch = 1 / (1 + Math.abs(obj.baseDifficulty - userTheta));

      // Combined score
      const score = weightedBenefit * difficultyMatch * (1 + obj.priorityBoost);

      return { ...obj, totalBenefit: score };
    })
    .sort((a, b) => b.totalBenefit - a.totalBenefit);
}

// ============================================================================
// Session Planning
// ============================================================================

/**
 * Plans a multi-goal learning session.
 *
 * @param goals - Active curriculum goals
 * @param sessionDurationMinutes - Total session duration
 * @param sharedObjects - Available shared objects
 * @param preference - Allocation preference
 * @returns Session plan
 */
export function planMultiGoalSession(
  goals: CurriculumGoal[],
  sessionDurationMinutes: number,
  sharedObjects: SharedObject[],
  preference: AllocationPreference = 'balanced'
): MultiGoalSessionPlan {
  // Compute Pareto frontier and select allocation
  const frontier = computeParetoFrontier(goals, sessionDurationMinutes);
  const selectedSolution = selectParetoOptimalAllocation(frontier, preference);

  if (!selectedSolution) {
    return createEmptySessionPlan(sessionDurationMinutes);
  }

  // Calculate time per goal
  const goalTimeAllocation: Record<string, number> = {};
  goals.forEach((goal) => {
    goalTimeAllocation[goal.id] = sessionDurationMinutes * selectedSolution.goalAllocations[goal.id];
  });

  // Prioritize shared objects (get synergy benefit first)
  const prioritizedShared = sharedObjects
    .filter((obj) => obj.benefitingGoals.some((gId) => goals.some((g) => g.id === gId)))
    .slice(0, Math.ceil(sessionDurationMinutes / 5)); // ~5 min per object

  // Build object sequence
  const objectSequence: MultiGoalSessionPlan['objectSequence'] = [];
  const usedTime: Record<string, number> = {};
  goals.forEach((g) => (usedTime[g.id] = 0));

  // First: shared objects (count time towards all benefiting goals)
  prioritizedShared.forEach((obj) => {
    const estimatedMinutes = 3 + obj.baseDifficulty; // Base time + difficulty adjustment
    const primaryGoal = obj.benefitingGoals[0];

    objectSequence.push({
      objectId: obj.objectId,
      goalId: primaryGoal,
      estimatedMinutes,
      isShared: true,
    });

    // Distribute time across benefiting goals
    const perGoalTime = estimatedMinutes / obj.benefitingGoals.length;
    obj.benefitingGoals.forEach((gId) => {
      usedTime[gId] = (usedTime[gId] || 0) + perGoalTime;
    });
  });

  // Then: goal-specific objects to fill remaining time
  goals.forEach((goal) => {
    const remainingTime = goalTimeAllocation[goal.id] - (usedTime[goal.id] || 0);
    const objectCount = Math.floor(remainingTime / 4); // ~4 min per object

    for (let i = 0; i < objectCount; i++) {
      objectSequence.push({
        objectId: `goal_${goal.id}_obj_${i}`, // Placeholder
        goalId: goal.id,
        estimatedMinutes: 4,
        isShared: false,
      });
    }
  });

  return {
    durationMinutes: sessionDurationMinutes,
    goalTimeAllocation,
    objectSequence,
    prioritizedSharedObjects: prioritizedShared,
    expectedOutcomes: selectedSolution.expectedProgress,
  };
}

/**
 * Creates an empty session plan.
 */
function createEmptySessionPlan(duration: number): MultiGoalSessionPlan {
  return {
    durationMinutes: duration,
    goalTimeAllocation: {},
    objectSequence: [],
    prioritizedSharedObjects: [],
    expectedOutcomes: {},
  };
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Calculates current progress across all goals.
 *
 * @param goals - Active curriculum goals
 * @returns Multi-goal progress snapshot
 */
export function calculateMultiGoalProgress(goals: CurriculumGoal[]): MultiGoalProgress {
  const goalProgress: Record<string, number> = {};
  const thetaGaps: Record<string, number> = {};
  const deadlineProximity: Record<string, number | null> = {};
  const attentionNeeded: string[] = [];

  let totalProgress = 0;
  let progressVariance = 0;

  goals.forEach((goal) => {
    // Progress as fraction of target
    const progress = goal.targetTheta > 0 ? goal.currentTheta / goal.targetTheta : 1;
    goalProgress[goal.id] = Math.min(1, progress);
    totalProgress += goalProgress[goal.id];

    // Gap to target
    thetaGaps[goal.id] = Math.max(0, goal.targetTheta - goal.currentTheta);

    // Deadline proximity
    if (goal.deadline) {
      const daysRemaining = (goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      deadlineProximity[goal.id] = Math.max(0, daysRemaining);

      // Flag if deadline is approaching with significant gap
      if (daysRemaining < 30 && progress < 0.7) {
        attentionNeeded.push(goal.id);
      }
    } else {
      deadlineProximity[goal.id] = null;
    }
  });

  // Calculate balance score (lower variance = more balanced)
  // Return 0 for empty goals list
  if (goals.length === 0) {
    return {
      goalProgress,
      thetaGaps,
      deadlineProximity,
      balanceScore: 0,
      attentionNeeded,
    };
  }

  const meanProgress = totalProgress / goals.length;
  goals.forEach((goal) => {
    progressVariance += Math.pow(goalProgress[goal.id] - meanProgress, 2);
  });
  const stdDev = Math.sqrt(progressVariance / goals.length);
  const balanceScore = 1 - Math.min(1, stdDev * 2); // Normalize to 0-1

  return {
    goalProgress,
    thetaGaps,
    deadlineProximity,
    balanceScore,
    attentionNeeded,
  };
}

/**
 * Recommends time allocation to balance progress.
 *
 * @param currentProgress - Current multi-goal progress
 * @param goals - Active curriculum goals
 * @returns Recommended allocation fractions
 */
export function balanceGoalProgress(
  currentProgress: MultiGoalProgress,
  goals: CurriculumGoal[]
): Record<string, number> {
  const allocation: Record<string, number> = {};
  let totalWeight = 0;

  goals.forEach((goal) => {
    // Weight by inverse progress (behind goals get more time)
    const progressWeight = 1 - currentProgress.goalProgress[goal.id];

    // Weight by deadline urgency
    const deadlineWeight = currentProgress.deadlineProximity[goal.id] !== null
      ? 1 / (1 + currentProgress.deadlineProximity[goal.id]! / 30)
      : 0.5;

    // Weight by user preference
    const userWeight = goal.weight;

    // Combined weight
    const weight = progressWeight * 0.4 + deadlineWeight * 0.3 + userWeight * 0.3;
    allocation[goal.id] = weight;
    totalWeight += weight;
  });

  // Normalize
  goals.forEach((goal) => {
    allocation[goal.id] = totalWeight > 0 ? allocation[goal.id] / totalWeight : 1 / goals.length;
  });

  return allocation;
}

// ============================================================================
// Transfer Analysis
// ============================================================================

/**
 * Calculates transfer relationships between goals.
 *
 * Transfer occurs when learning in one domain benefits another
 * due to shared concepts, vocabulary, or skills.
 *
 * @param goals - Curriculum goals
 * @param sharedObjects - Objects shared between goals
 * @returns Transfer relationships
 */
export function calculateGoalTransfers(
  goals: CurriculumGoal[],
  sharedObjects: SharedObject[]
): GoalTransfer[] {
  const transfers: GoalTransfer[] = [];

  for (let i = 0; i < goals.length; i++) {
    for (let j = i + 1; j < goals.length; j++) {
      const goal1 = goals[i];
      const goal2 = goals[j];

      // Count shared objects
      const shared = sharedObjects.filter(
        (obj) => obj.benefitingGoals.includes(goal1.id) && obj.benefitingGoals.includes(goal2.id)
      );

      // Domain similarity
      const domain1 = goal1.domain.toLowerCase();
      const domain2 = goal2.domain.toLowerCase();
      const domainSimilarity =
        DOMAIN_SIMILARITY[domain1]?.[domain2] ||
        DOMAIN_SIMILARITY[domain2]?.[domain1] ||
        0.2;

      // Transfer coefficient
      const sharedFraction = shared.length / Math.max(1, sharedObjects.length);
      const transferCoefficient = 0.5 * sharedFraction + 0.5 * domainSimilarity;

      // Bidirectional transfer
      transfers.push({
        fromGoalId: goal1.id,
        toGoalId: goal2.id,
        transferCoefficient,
        sharedCount: shared.length,
        domainSimilarity,
      });

      transfers.push({
        fromGoalId: goal2.id,
        toGoalId: goal1.id,
        transferCoefficient,
        sharedCount: shared.length,
        domainSimilarity,
      });
    }
  }

  return transfers;
}

/**
 * Estimates transfer benefit for a goal from progress in other goals.
 *
 * @param goalId - Target goal
 * @param transfers - Transfer relationships
 * @param progressDeltas - Recent progress in each goal
 * @returns Estimated transfer benefit (theta improvement)
 */
export function estimateTransferBenefit(
  goalId: string,
  transfers: GoalTransfer[],
  progressDeltas: Record<string, number>
): number {
  const incomingTransfers = transfers.filter((t) => t.toGoalId === goalId);

  let totalBenefit = 0;
  incomingTransfers.forEach((transfer) => {
    const sourceProgress = progressDeltas[transfer.fromGoalId] || 0;
    totalBenefit += sourceProgress * transfer.transferCoefficient;
  });

  return totalBenefit;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates initial goal from parameters.
 */
export function createCurriculumGoal(params: {
  id: string;
  name: string;
  domain: string;
  targetTheta: number;
  weight?: number;
  deadline?: Date;
  modalities?: string[];
}): CurriculumGoal {
  return {
    id: params.id,
    name: params.name,
    domain: params.domain,
    targetTheta: params.targetTheta,
    currentTheta: 0,
    deadline: params.deadline,
    weight: params.weight ?? 1.0,
    isActive: true,
    totalObjects: 0,
    masteredObjects: 0,
    modalities: params.modalities ?? ['reading', 'listening', 'speaking', 'writing'],
  };
}

/**
 * Updates goal progress from session results.
 */
export function updateGoalFromSession(
  goal: CurriculumGoal,
  thetaDelta: number,
  newMastered: number
): CurriculumGoal {
  return {
    ...goal,
    currentTheta: goal.currentTheta + thetaDelta,
    masteredObjects: goal.masteredObjects + newMastered,
  };
}

/**
 * Checks if a goal is completed.
 */
export function isGoalCompleted(goal: CurriculumGoal): boolean {
  return goal.currentTheta >= goal.targetTheta;
}

/**
 * Calculates overall portfolio completion.
 */
export function calculatePortfolioCompletion(goals: CurriculumGoal[]): number {
  if (goals.length === 0) return 0;

  const weightedSum = goals.reduce((sum, goal) => {
    const progress = Math.min(1, goal.currentTheta / goal.targetTheta);
    return sum + progress * goal.weight;
  }, 0);

  const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
