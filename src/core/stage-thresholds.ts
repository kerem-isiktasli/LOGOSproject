/**
 * Configurable Stage Thresholds Module
 *
 * Provides configurable mastery stage transition thresholds with A/B testing support.
 * Enables empirical validation of threshold values through controlled experiments.
 *
 * The module supports:
 * - Multiple named threshold configurations
 * - A/B test group assignment
 * - Runtime threshold switching
 * - Threshold validation and constraint checking
 * - Experimental metrics collection
 *
 * Academic References:
 * - Anderson, J.R. (1982). Acquisition of cognitive skill. Psychological Review.
 * - DeKeyser, R.M. (2007). Skill acquisition theory. In VanPatten & Williams (Eds.),
 *   Theories in Second Language Acquisition.
 * - Segalowitz, N. (2010). Cognitive Bases of Second Language Fluency. Routledge.
 *
 * @module core/stage-thresholds
 */

import type { MasteryStage, StageThresholds, CueLevel } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended threshold configuration with metadata.
 */
export interface ThresholdConfig {
  /** Unique identifier for this configuration */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of the configuration */
  description: string;

  /** The actual threshold values */
  thresholds: StageThresholds;

  /** Whether this is an experimental configuration */
  isExperimental: boolean;

  /** Version for tracking changes */
  version: number;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * A/B test group definition.
 */
export interface ABTestGroup {
  /** Group identifier (e.g., 'control', 'treatment_a') */
  id: string;

  /** Configuration ID to use for this group */
  configId: string;

  /** Proportion of users in this group (0-1) */
  proportion: number;

  /** Description of what's being tested */
  hypothesis: string;
}

/**
 * A/B test definition.
 */
export interface ABTest {
  /** Test identifier */
  id: string;

  /** Test name */
  name: string;

  /** Test description */
  description: string;

  /** Groups in this test */
  groups: ABTestGroup[];

  /** Start date of the test */
  startDate: Date;

  /** End date of the test (optional) */
  endDate?: Date;

  /** Primary metric to evaluate */
  primaryMetric: 'stage_advancement_rate' | 'retention_at_30_days' | 'session_completion_rate';

  /** Whether test is currently active */
  isActive: boolean;
}

/**
 * User's test assignment.
 */
export interface TestAssignment {
  /** User ID */
  userId: string;

  /** Test ID */
  testId: string;

  /** Assigned group ID */
  groupId: string;

  /** Assigned configuration ID */
  configId: string;

  /** Assignment timestamp */
  assignedAt: Date;
}

/**
 * Stage transition event for metrics collection.
 */
export interface StageTransitionEvent {
  userId: string;
  objectId: string;
  fromStage: MasteryStage;
  toStage: MasteryStage;
  configId: string;
  sessionId: string;
  timestamp: Date;
  metricsSnapshot: {
    cueFreeAccuracy: number;
    cueAssistedAccuracy: number;
    stability: number;
    exposureCount: number;
    scaffoldingGap: number;
  };
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Production default thresholds.
 * Based on skill acquisition theory and initial calibration.
 */
export const DEFAULT_THRESHOLDS: StageThresholds = {
  stage4CueFreeAccuracy: 0.90,
  stage4Stability: 30,
  stage4MaxGap: 0.10,
  stage3CueFreeAccuracy: 0.75,
  stage3Stability: 7,
  stage2CueFreeAccuracy: 0.60,
  stage2CueAssistedAccuracy: 0.80,
  stage1CueAssistedAccuracy: 0.50,
};

/**
 * Conservative thresholds (higher requirements).
 * For users who prefer thorough mastery before advancement.
 */
export const CONSERVATIVE_THRESHOLDS: StageThresholds = {
  stage4CueFreeAccuracy: 0.95,
  stage4Stability: 45,
  stage4MaxGap: 0.05,
  stage3CueFreeAccuracy: 0.85,
  stage3Stability: 14,
  stage2CueFreeAccuracy: 0.70,
  stage2CueAssistedAccuracy: 0.85,
  stage1CueAssistedAccuracy: 0.60,
};

/**
 * Aggressive thresholds (faster advancement).
 * For quick learners or time-pressured contexts.
 */
export const AGGRESSIVE_THRESHOLDS: StageThresholds = {
  stage4CueFreeAccuracy: 0.85,
  stage4Stability: 21,
  stage4MaxGap: 0.15,
  stage3CueFreeAccuracy: 0.65,
  stage3Stability: 5,
  stage2CueFreeAccuracy: 0.50,
  stage2CueAssistedAccuracy: 0.70,
  stage1CueAssistedAccuracy: 0.40,
};

/**
 * Research thresholds (strict criteria for academic studies).
 */
export const RESEARCH_THRESHOLDS: StageThresholds = {
  stage4CueFreeAccuracy: 0.95,
  stage4Stability: 60,
  stage4MaxGap: 0.05,
  stage3CueFreeAccuracy: 0.85,
  stage3Stability: 21,
  stage2CueFreeAccuracy: 0.75,
  stage2CueAssistedAccuracy: 0.90,
  stage1CueAssistedAccuracy: 0.65,
};

/**
 * Pre-defined configurations registry.
 */
const BUILT_IN_CONFIGS: Map<string, ThresholdConfig> = new Map([
  ['default', {
    id: 'default',
    name: 'Default',
    description: 'Production default thresholds based on skill acquisition theory',
    thresholds: DEFAULT_THRESHOLDS,
    isExperimental: false,
    version: 1,
    createdAt: new Date('2024-01-01'),
  }],
  ['conservative', {
    id: 'conservative',
    name: 'Conservative',
    description: 'Higher thresholds for thorough mastery',
    thresholds: CONSERVATIVE_THRESHOLDS,
    isExperimental: false,
    version: 1,
    createdAt: new Date('2024-01-01'),
  }],
  ['aggressive', {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Lower thresholds for faster advancement',
    thresholds: AGGRESSIVE_THRESHOLDS,
    isExperimental: false,
    version: 1,
    createdAt: new Date('2024-01-01'),
  }],
  ['research', {
    id: 'research',
    name: 'Research',
    description: 'Strict criteria for academic studies',
    thresholds: RESEARCH_THRESHOLDS,
    isExperimental: false,
    version: 1,
    createdAt: new Date('2024-01-01'),
  }],
]);

// =============================================================================
// Configuration Registry
// =============================================================================

/**
 * Runtime configuration registry.
 */
class ThresholdRegistry {
  private configs: Map<string, ThresholdConfig> = new Map(BUILT_IN_CONFIGS);
  private abTests: Map<string, ABTest> = new Map();
  private userAssignments: Map<string, TestAssignment> = new Map();
  private transitionLog: StageTransitionEvent[] = [];
  private currentDefaultId: string = 'default';

  /**
   * Register a new threshold configuration.
   */
  registerConfig(config: ThresholdConfig): void {
    this.validateThresholds(config.thresholds);
    this.configs.set(config.id, config);
  }

  /**
   * Get a configuration by ID.
   */
  getConfig(id: string): ThresholdConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get the default configuration.
   */
  getDefaultConfig(): ThresholdConfig {
    return this.configs.get(this.currentDefaultId) ?? this.configs.get('default')!;
  }

  /**
   * Set the default configuration ID.
   */
  setDefaultConfig(id: string): void {
    if (!this.configs.has(id)) {
      throw new Error(`Configuration not found: ${id}`);
    }
    this.currentDefaultId = id;
  }

  /**
   * List all registered configurations.
   */
  listConfigs(): ThresholdConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Validate threshold values for logical consistency.
   */
  validateThresholds(thresholds: StageThresholds): void {
    const errors: string[] = [];

    // Accuracy values must be 0-1
    if (thresholds.stage4CueFreeAccuracy < 0 || thresholds.stage4CueFreeAccuracy > 1) {
      errors.push('stage4CueFreeAccuracy must be between 0 and 1');
    }
    if (thresholds.stage3CueFreeAccuracy < 0 || thresholds.stage3CueFreeAccuracy > 1) {
      errors.push('stage3CueFreeAccuracy must be between 0 and 1');
    }
    if (thresholds.stage2CueFreeAccuracy < 0 || thresholds.stage2CueFreeAccuracy > 1) {
      errors.push('stage2CueFreeAccuracy must be between 0 and 1');
    }
    if (thresholds.stage2CueAssistedAccuracy < 0 || thresholds.stage2CueAssistedAccuracy > 1) {
      errors.push('stage2CueAssistedAccuracy must be between 0 and 1');
    }
    if (thresholds.stage1CueAssistedAccuracy < 0 || thresholds.stage1CueAssistedAccuracy > 1) {
      errors.push('stage1CueAssistedAccuracy must be between 0 and 1');
    }

    // Gap must be 0-1
    if (thresholds.stage4MaxGap < 0 || thresholds.stage4MaxGap > 1) {
      errors.push('stage4MaxGap must be between 0 and 1');
    }

    // Stability must be positive
    if (thresholds.stage4Stability <= 0 || thresholds.stage3Stability <= 0) {
      errors.push('Stability values must be positive');
    }

    // Hierarchy: stage4 > stage3 > stage2
    if (thresholds.stage4CueFreeAccuracy < thresholds.stage3CueFreeAccuracy) {
      errors.push('stage4CueFreeAccuracy must be >= stage3CueFreeAccuracy');
    }
    if (thresholds.stage3CueFreeAccuracy < thresholds.stage2CueFreeAccuracy) {
      errors.push('stage3CueFreeAccuracy must be >= stage2CueFreeAccuracy');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid thresholds: ${errors.join('; ')}`);
    }
  }

  // =============================================================================
  // A/B Testing
  // =============================================================================

  /**
   * Register an A/B test.
   */
  registerABTest(test: ABTest): void {
    // Validate proportions sum to 1
    const totalProportion = test.groups.reduce((sum, g) => sum + g.proportion, 0);
    if (Math.abs(totalProportion - 1) > 0.001) {
      throw new Error('A/B test group proportions must sum to 1');
    }

    // Validate all config IDs exist
    for (const group of test.groups) {
      if (!this.configs.has(group.configId)) {
        throw new Error(`Configuration not found: ${group.configId}`);
      }
    }

    this.abTests.set(test.id, test);
  }

  /**
   * Assign a user to an A/B test group.
   * Uses deterministic hashing for consistent assignment.
   */
  assignUserToTest(userId: string, testId: string): TestAssignment | null {
    const test = this.abTests.get(testId);
    if (!test || !test.isActive) {
      return null;
    }

    // Check for existing assignment
    const existingKey = `${userId}:${testId}`;
    const existing = this.userAssignments.get(existingKey);
    if (existing) {
      return existing;
    }

    // Deterministic group assignment based on user ID hash
    const hash = this.hashUserId(userId, testId);
    const normalizedHash = hash / 0xFFFFFFFF; // Normalize to 0-1

    let cumulativeProportion = 0;
    let assignedGroup: ABTestGroup | null = null;

    for (const group of test.groups) {
      cumulativeProportion += group.proportion;
      if (normalizedHash < cumulativeProportion) {
        assignedGroup = group;
        break;
      }
    }

    // Fallback to last group
    if (!assignedGroup) {
      assignedGroup = test.groups[test.groups.length - 1];
    }

    const assignment: TestAssignment = {
      userId,
      testId,
      groupId: assignedGroup.id,
      configId: assignedGroup.configId,
      assignedAt: new Date(),
    };

    this.userAssignments.set(existingKey, assignment);
    return assignment;
  }

  /**
   * Get a user's threshold configuration, considering A/B tests.
   */
  getConfigForUser(userId: string): ThresholdConfig {
    // Check for active A/B test assignments
    for (const [testId, test] of this.abTests) {
      if (test.isActive) {
        const assignment = this.assignUserToTest(userId, testId);
        if (assignment) {
          return this.configs.get(assignment.configId)!;
        }
      }
    }

    // Return default
    return this.getDefaultConfig();
  }

  /**
   * Simple hash function for user ID + test ID.
   */
  private hashUserId(userId: string, testId: string): number {
    const str = `${userId}:${testId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get test assignment for a user.
   */
  getTestAssignment(userId: string, testId: string): TestAssignment | null {
    return this.userAssignments.get(`${userId}:${testId}`) ?? null;
  }

  /**
   * List active A/B tests.
   */
  listActiveTests(): ABTest[] {
    return Array.from(this.abTests.values()).filter((t) => t.isActive);
  }

  // =============================================================================
  // Metrics Collection
  // =============================================================================

  /**
   * Log a stage transition event.
   */
  logTransition(event: StageTransitionEvent): void {
    this.transitionLog.push(event);

    // Keep only last 10000 events in memory
    if (this.transitionLog.length > 10000) {
      this.transitionLog = this.transitionLog.slice(-10000);
    }
  }

  /**
   * Get transition metrics for a configuration.
   */
  getTransitionMetrics(configId: string): {
    totalTransitions: number;
    advancementRate: number;
    avgTimeToStage4: number;
    stageDistribution: Record<MasteryStage, number>;
  } {
    const events = this.transitionLog.filter((e) => e.configId === configId);

    if (events.length === 0) {
      return {
        totalTransitions: 0,
        advancementRate: 0,
        avgTimeToStage4: 0,
        stageDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      };
    }

    const advancements = events.filter((e) => e.toStage > e.fromStage).length;
    const advancementRate = advancements / events.length;

    // Stage distribution
    const stageDistribution: Record<MasteryStage, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const event of events) {
      stageDistribution[event.toStage]++;
    }

    return {
      totalTransitions: events.length,
      advancementRate,
      avgTimeToStage4: 0, // Would need more data to calculate
      stageDistribution,
    };
  }

  /**
   * Export transition log for analysis.
   */
  exportTransitionLog(): StageTransitionEvent[] {
    return [...this.transitionLog];
  }

  /**
   * Clear transition log.
   */
  clearTransitionLog(): void {
    this.transitionLog = [];
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Global threshold registry instance.
 */
export const thresholdRegistry = new ThresholdRegistry();

// =============================================================================
// Stage Transition Logic
// =============================================================================

/**
 * Check if a learner should advance to the next stage.
 *
 * @param currentStage - Current mastery stage
 * @param metrics - Current performance metrics
 * @param config - Threshold configuration to use
 * @returns New stage and whether a transition occurred
 */
export function checkStageTransition(
  currentStage: MasteryStage,
  metrics: {
    cueFreeAccuracy: number;
    cueAssistedAccuracy: number;
    stability: number;
    exposureCount: number;
  },
  config: ThresholdConfig = thresholdRegistry.getDefaultConfig()
): { newStage: MasteryStage; transitioned: boolean; reason: string } {
  const t = config.thresholds;
  const gap = metrics.cueAssistedAccuracy - metrics.cueFreeAccuracy;

  // Stage 0 → 1: Recognition
  if (currentStage === 0) {
    if (metrics.cueAssistedAccuracy >= t.stage1CueAssistedAccuracy && metrics.exposureCount >= 1) {
      return {
        newStage: 1,
        transitioned: true,
        reason: `Cue-assisted accuracy ${(metrics.cueAssistedAccuracy * 100).toFixed(0)}% >= ${(t.stage1CueAssistedAccuracy * 100).toFixed(0)}%`,
      };
    }
  }

  // Stage 1 → 2: Recall
  if (currentStage === 1) {
    const meetsAccuracy =
      metrics.cueFreeAccuracy >= t.stage2CueFreeAccuracy ||
      metrics.cueAssistedAccuracy >= t.stage2CueAssistedAccuracy;

    if (meetsAccuracy && metrics.exposureCount >= 3) {
      return {
        newStage: 2,
        transitioned: true,
        reason: `Accuracy thresholds met (cue-free: ${(metrics.cueFreeAccuracy * 100).toFixed(0)}%, cue-assisted: ${(metrics.cueAssistedAccuracy * 100).toFixed(0)}%)`,
      };
    }
  }

  // Stage 2 → 3: Controlled Production
  if (currentStage === 2) {
    if (
      metrics.cueFreeAccuracy >= t.stage3CueFreeAccuracy &&
      metrics.stability >= t.stage3Stability
    ) {
      return {
        newStage: 3,
        transitioned: true,
        reason: `Cue-free accuracy ${(metrics.cueFreeAccuracy * 100).toFixed(0)}% >= ${(t.stage3CueFreeAccuracy * 100).toFixed(0)}% with ${metrics.stability} days stability`,
      };
    }
  }

  // Stage 3 → 4: Automatic
  if (currentStage === 3) {
    if (
      metrics.cueFreeAccuracy >= t.stage4CueFreeAccuracy &&
      metrics.stability >= t.stage4Stability &&
      gap <= t.stage4MaxGap
    ) {
      return {
        newStage: 4,
        transitioned: true,
        reason: `Mastery achieved: ${(metrics.cueFreeAccuracy * 100).toFixed(0)}% accuracy, ${metrics.stability} days stability, ${(gap * 100).toFixed(0)}% gap`,
      };
    }
  }

  return {
    newStage: currentStage,
    transitioned: false,
    reason: 'Thresholds not met',
  };
}

/**
 * Get recommended cue level based on performance metrics.
 */
export function getRecommendedCueLevel(
  cueFreeAccuracy: number,
  cueAssistedAccuracy: number,
  exposureCount: number
): CueLevel {
  const gap = cueAssistedAccuracy - cueFreeAccuracy;

  // Progressive cue reduction
  if (gap < 0.1 && exposureCount > 5) return 0;
  if (gap < 0.2 && exposureCount > 3) return 1;
  if (gap < 0.3) return 2;
  return 3;
}

/**
 * Calculate progress towards next stage.
 */
export function calculateStageProgress(
  currentStage: MasteryStage,
  metrics: {
    cueFreeAccuracy: number;
    cueAssistedAccuracy: number;
    stability: number;
    exposureCount: number;
  },
  config: ThresholdConfig = thresholdRegistry.getDefaultConfig()
): { progress: number; blockers: string[] } {
  const t = config.thresholds;
  const blockers: string[] = [];

  if (currentStage === 4) {
    return { progress: 1, blockers: [] };
  }

  let requirements: Array<{ met: boolean; label: string; current: number; target: number }> = [];

  switch (currentStage) {
    case 0:
      requirements = [
        {
          met: metrics.cueAssistedAccuracy >= t.stage1CueAssistedAccuracy,
          label: 'Cue-assisted accuracy',
          current: metrics.cueAssistedAccuracy,
          target: t.stage1CueAssistedAccuracy,
        },
        {
          met: metrics.exposureCount >= 1,
          label: 'Exposure count',
          current: metrics.exposureCount,
          target: 1,
        },
      ];
      break;

    case 1:
      requirements = [
        {
          met: metrics.cueFreeAccuracy >= t.stage2CueFreeAccuracy,
          label: 'Cue-free accuracy',
          current: metrics.cueFreeAccuracy,
          target: t.stage2CueFreeAccuracy,
        },
        {
          met: metrics.exposureCount >= 3,
          label: 'Exposure count',
          current: metrics.exposureCount,
          target: 3,
        },
      ];
      break;

    case 2:
      requirements = [
        {
          met: metrics.cueFreeAccuracy >= t.stage3CueFreeAccuracy,
          label: 'Cue-free accuracy',
          current: metrics.cueFreeAccuracy,
          target: t.stage3CueFreeAccuracy,
        },
        {
          met: metrics.stability >= t.stage3Stability,
          label: 'Stability (days)',
          current: metrics.stability,
          target: t.stage3Stability,
        },
      ];
      break;

    case 3:
      const gap = metrics.cueAssistedAccuracy - metrics.cueFreeAccuracy;
      requirements = [
        {
          met: metrics.cueFreeAccuracy >= t.stage4CueFreeAccuracy,
          label: 'Cue-free accuracy',
          current: metrics.cueFreeAccuracy,
          target: t.stage4CueFreeAccuracy,
        },
        {
          met: metrics.stability >= t.stage4Stability,
          label: 'Stability (days)',
          current: metrics.stability,
          target: t.stage4Stability,
        },
        {
          met: gap <= t.stage4MaxGap,
          label: 'Scaffolding gap',
          current: gap,
          target: t.stage4MaxGap,
        },
      ];
      break;
  }

  // Calculate progress as proportion of requirements met
  const metCount = requirements.filter((r) => r.met).length;
  const progress = metCount / requirements.length;

  // Collect blockers
  for (const req of requirements) {
    if (!req.met) {
      if (req.label === 'Scaffolding gap') {
        blockers.push(`${req.label}: ${(req.current * 100).toFixed(0)}% (need ≤${(req.target * 100).toFixed(0)}%)`);
      } else if (req.label.includes('accuracy')) {
        blockers.push(`${req.label}: ${(req.current * 100).toFixed(0)}% (need ${(req.target * 100).toFixed(0)}%)`);
      } else {
        blockers.push(`${req.label}: ${req.current} (need ${req.target})`);
      }
    }
  }

  return { progress, blockers };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  thresholdRegistry,
  checkStageTransition,
  getRecommendedCueLevel,
  calculateStageProgress,
  DEFAULT_THRESHOLDS,
  CONSERVATIVE_THRESHOLDS,
  AGGRESSIVE_THRESHOLDS,
  RESEARCH_THRESHOLDS,
};
