/**
 * Component Prerequisite Service
 *
 * Manages the component prerequisite chain - the hierarchical dependencies
 * between language components (PHON → MORPH → LEX → SYNT → PRAG).
 *
 * Lower components must be automated (reach threshold stability) before
 * higher components can be effectively learned. This service:
 *
 * 1. Checks prerequisite satisfaction for component learning
 * 2. Identifies which components are unlocked for a user
 * 3. Recommends next components to focus on
 * 4. Calculates support scores (how much an object supports higher components)
 *
 * Academic basis:
 * - Processability Theory (Pienemann, 1998, 2005)
 * - Skill Acquisition Theory / ACT-R (Anderson, 1982, 1993)
 * - Levelt's Speech Production Model (1999)
 * - Metalinguistic Development Sequence (Deacon & Kirby, 2004)
 */

import { getPrisma } from '../db/prisma';
import type {
  ComponentCode,
  PrerequisiteStatus,
  ObjectLearningStrategy,
  LearningGoal,
  LearningGoalReason,
} from '../../core/types';
import { COMPONENT_PREREQUISITES } from '../../core/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Component automation status for a user/goal combination.
 */
export interface ComponentAutomationStatus {
  /** Component type */
  component: ComponentCode;

  /** Average automation level (FSRS stability) */
  automationLevel: number;

  /** Number of objects in this component */
  objectCount: number;

  /** Objects above automation threshold */
  automatedObjectCount: number;

  /** Automation ratio (automated / total) */
  automationRatio: number;

  /** Whether this component is considered automated */
  isAutomated: boolean;

  /** Required threshold for automation */
  requiredThreshold: number;
}

/**
 * Unlocked component information.
 */
export interface UnlockedComponent {
  /** Component type */
  component: ComponentCode;

  /** Unlock status */
  status: 'fully_unlocked' | 'partially_unlocked' | 'locked';

  /** Blocking prerequisites (if any) */
  blockedBy: ComponentCode[];

  /** Readiness score for learning (0-1) */
  readinessScore: number;

  /** Reason for this status */
  reason: string;
}

/**
 * Component support score - how much an object supports higher components.
 */
export interface ComponentSupportScore {
  /** Object ID */
  objectId: string;

  /** Object's component type */
  componentType: ComponentCode;

  /** Components this object supports */
  supportsComponents: ComponentCode[];

  /** Overall support score (0-1) */
  supportScore: number;

  /** Per-component support details */
  supportDetails: Array<{
    targetComponent: ComponentCode;
    contributionScore: number;
    reason: string;
  }>;
}

/**
 * Component recommendation with priority.
 */
export interface ComponentRecommendation {
  /** Recommended component */
  component: ComponentCode;

  /** Priority score (higher = more urgent) */
  priority: number;

  /** Recommended focus type */
  focusType: 'stabilize' | 'expand' | 'introduce';

  /** Reason for recommendation */
  reason: string;

  /** Specific objects to focus on */
  targetObjectIds: string[];
}

// =============================================================================
// Component Hierarchy Constants
// =============================================================================

/**
 * Ordered list of components from lowest to highest.
 */
export const COMPONENT_ORDER: ComponentCode[] = ['PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG'];

/**
 * Which components each component supports (reverse of prerequisites).
 */
export const COMPONENT_SUPPORTS: Record<ComponentCode, ComponentCode[]> = {
  PHON: ['MORPH', 'LEX'],
  MORPH: ['LEX', 'SYNT'],
  LEX: ['SYNT', 'PRAG'],
  SYNT: ['PRAG'],
  PRAG: [],
};

// =============================================================================
// Prerequisite Checking
// =============================================================================

/**
 * Check if prerequisites are satisfied for a component.
 */
export async function checkPrerequisitesSatisfied(
  userId: string,
  goalId: string,
  targetComponent: ComponentCode
): Promise<PrerequisiteStatus> {
  const prerequisiteConfig = COMPONENT_PREREQUISITES[targetComponent];
  const prerequisiteStatuses: PrerequisiteStatus['prerequisites'] = [];
  const blockingComponents: ComponentCode[] = [];

  for (const prereqComponent of prerequisiteConfig.prerequisites) {
    const prereqConfig = COMPONENT_PREREQUISITES[prereqComponent];
    const automationStatus = await getComponentAutomationStatus(
      userId,
      goalId,
      prereqComponent
    );

    const isSatisfied = automationStatus.automationLevel >= prereqConfig.automationThreshold;

    prerequisiteStatuses.push({
      component: prereqComponent,
      requiredThreshold: prereqConfig.automationThreshold,
      currentAutomation: automationStatus.automationLevel,
      isSatisfied,
    });

    if (!isSatisfied) {
      blockingComponents.push(prereqComponent);
    }
  }

  return {
    component: targetComponent,
    allSatisfied: blockingComponents.length === 0,
    prerequisites: prerequisiteStatuses,
    blockingComponents,
  };
}

/**
 * Get automation status for a specific component.
 */
export async function getComponentAutomationStatus(
  _userId: string,
  goalId: string,
  component: ComponentCode
): Promise<ComponentAutomationStatus> {
  const prisma = getPrisma();
  const requiredThreshold = COMPONENT_PREREQUISITES[component].automationThreshold;

  // Get all objects for this component in the goal
  const objects = await prisma.languageObject.findMany({
    where: {
      goalId,
      type: mapComponentToType(component),
    },
    include: {
      masteryState: true,
    },
  });

  if (objects.length === 0) {
    return {
      component,
      automationLevel: 0,
      objectCount: 0,
      automatedObjectCount: 0,
      automationRatio: 0,
      isAutomated: component === 'PHON', // PHON has no prerequisites
      requiredThreshold,
    };
  }

  // Calculate automation levels from FSRS stability
  let totalStability = 0;
  let automatedCount = 0;

  for (const obj of objects) {
    const mastery = obj.masteryState;
    const stability = mastery?.fsrsStability ?? 0;

    totalStability += stability;

    // Consider automated if stability >= threshold (normalized)
    // FSRS stability is in days; normalize to 0-1 scale (30 days = 1.0)
    const normalizedStability = Math.min(stability / 30, 1);
    if (normalizedStability >= requiredThreshold) {
      automatedCount++;
    }
  }

  const avgStability = totalStability / objects.length;
  const normalizedAutomation = Math.min(avgStability / 30, 1);
  const automationRatio = automatedCount / objects.length;

  // Component is automated if at least 70% of objects meet threshold
  const isAutomated = automationRatio >= 0.7 && normalizedAutomation >= requiredThreshold;

  return {
    component,
    automationLevel: normalizedAutomation,
    objectCount: objects.length,
    automatedObjectCount: automatedCount,
    automationRatio,
    isAutomated,
    requiredThreshold,
  };
}

/**
 * Get all component automation statuses for a user/goal.
 */
export async function getAllComponentStatuses(
  userId: string,
  goalId: string
): Promise<Record<ComponentCode, ComponentAutomationStatus>> {
  const statuses: Record<ComponentCode, ComponentAutomationStatus> = {} as Record<
    ComponentCode,
    ComponentAutomationStatus
  >;

  for (const component of COMPONENT_ORDER) {
    statuses[component] = await getComponentAutomationStatus(userId, goalId, component);
  }

  return statuses;
}

// =============================================================================
// Component Unlocking
// =============================================================================

/**
 * Get list of unlocked components for a user.
 */
export async function getUnlockedComponents(
  userId: string,
  goalId: string
): Promise<UnlockedComponent[]> {
  const results: UnlockedComponent[] = [];
  const allStatuses = await getAllComponentStatuses(userId, goalId);

  for (const component of COMPONENT_ORDER) {
    const prereqStatus = await checkPrerequisitesSatisfied(userId, goalId, component);
    const componentStatus = allStatuses[component];

    let status: UnlockedComponent['status'];
    let readinessScore: number;
    let reason: string;

    if (prereqStatus.allSatisfied) {
      if (componentStatus.isAutomated) {
        status = 'fully_unlocked';
        readinessScore = 1.0;
        reason = 'All prerequisites automated, component mastered';
      } else {
        status = 'fully_unlocked';
        readinessScore = 0.7 + componentStatus.automationLevel * 0.3;
        reason = 'All prerequisites met, ready to learn';
      }
    } else {
      // Check partial unlock (some prerequisites met)
      const satisfiedCount = prereqStatus.prerequisites.filter(p => p.isSatisfied).length;
      const totalPrereqs = prereqStatus.prerequisites.length;

      if (satisfiedCount > 0 && satisfiedCount < totalPrereqs) {
        status = 'partially_unlocked';
        readinessScore = 0.3 + (satisfiedCount / totalPrereqs) * 0.4;
        reason = `${satisfiedCount}/${totalPrereqs} prerequisites met`;
      } else {
        status = 'locked';
        readinessScore = 0;
        reason = `Blocked by: ${prereqStatus.blockingComponents.join(', ')}`;
      }
    }

    results.push({
      component,
      status,
      blockedBy: prereqStatus.blockingComponents,
      readinessScore,
      reason,
    });
  }

  return results;
}

/**
 * Check if a specific component is unlocked.
 */
export async function isComponentUnlocked(
  userId: string,
  goalId: string,
  component: ComponentCode
): Promise<boolean> {
  const prereqStatus = await checkPrerequisitesSatisfied(userId, goalId, component);
  return prereqStatus.allSatisfied;
}

// =============================================================================
// Component Recommendations
// =============================================================================

/**
 * Recommend next component to focus on.
 */
export async function recommendNextComponent(
  userId: string,
  goalId: string
): Promise<ComponentRecommendation[]> {
  const unlockedComponents = await getUnlockedComponents(userId, goalId);
  const allStatuses = await getAllComponentStatuses(userId, goalId);
  const recommendations: ComponentRecommendation[] = [];

  for (const unlocked of unlockedComponents) {
    const status = allStatuses[unlocked.component];

    // Skip fully automated components
    if (status.isAutomated && unlocked.status === 'fully_unlocked') {
      continue;
    }

    // Calculate priority based on component order and readiness
    const orderIndex = COMPONENT_ORDER.indexOf(unlocked.component);
    const basePriority = (COMPONENT_ORDER.length - orderIndex) * 10;

    let focusType: ComponentRecommendation['focusType'];
    let reason: string;
    let adjustedPriority: number;

    if (unlocked.status === 'locked') {
      // Can't work on locked components directly
      continue;
    } else if (status.objectCount === 0) {
      focusType = 'introduce';
      reason = 'No objects yet; introduce first items';
      adjustedPriority = basePriority - 5;
    } else if (!status.isAutomated) {
      focusType = 'stabilize';
      reason = `Automation at ${(status.automationLevel * 100).toFixed(0)}%, needs stabilization`;
      adjustedPriority = basePriority + (1 - status.automationLevel) * 20;
    } else {
      focusType = 'expand';
      reason = 'Automated; ready for usage space expansion';
      adjustedPriority = basePriority - 10;
    }

    // Boost priority if this component blocks higher components
    const supportsCount = COMPONENT_SUPPORTS[unlocked.component].length;
    adjustedPriority += supportsCount * 5;

    recommendations.push({
      component: unlocked.component,
      priority: adjustedPriority,
      focusType,
      reason,
      targetObjectIds: [], // Would be populated with specific objects
    });
  }

  // Sort by priority (highest first)
  return recommendations.sort((a, b) => b.priority - a.priority);
}

/**
 * Get components that need stabilization to unlock higher components.
 */
export async function getBlockingComponents(
  userId: string,
  goalId: string
): Promise<Array<{ component: ComponentCode; blocks: ComponentCode[]; automationGap: number }>> {
  const allStatuses = await getAllComponentStatuses(userId, goalId);
  const blocking: Array<{
    component: ComponentCode;
    blocks: ComponentCode[];
    automationGap: number;
  }> = [];

  for (const component of COMPONENT_ORDER) {
    const status = allStatuses[component];
    const prereqConfig = COMPONENT_PREREQUISITES[component];

    if (!status.isAutomated && status.objectCount > 0) {
      // This component could be blocking higher ones
      const blocksComponents = COMPONENT_SUPPORTS[component];
      const automationGap = prereqConfig.automationThreshold - status.automationLevel;

      if (blocksComponents.length > 0 && automationGap > 0) {
        blocking.push({
          component,
          blocks: blocksComponents,
          automationGap,
        });
      }
    }
  }

  // Sort by automation gap (largest first = most urgent)
  return blocking.sort((a, b) => b.automationGap - a.automationGap);
}

// =============================================================================
// Support Score Calculation
// =============================================================================

/**
 * Calculate how much an object supports higher components.
 */
export async function calculateSupportScore(
  _userId: string,
  _goalId: string,
  objectId: string
): Promise<ComponentSupportScore> {
  const prisma = getPrisma();

  // Get the object
  const obj = await prisma.languageObject.findUnique({
    where: { id: objectId },
    include: {
      masteryState: true,
    },
  });

  if (!obj) {
    throw new Error(`Object not found: ${objectId}`);
  }

  const componentType = mapTypeToComponent(obj.type);
  const supportsComponents = COMPONENT_SUPPORTS[componentType];

  if (supportsComponents.length === 0) {
    return {
      objectId,
      componentType,
      supportsComponents: [],
      supportScore: 0,
      supportDetails: [],
    };
  }

  // Calculate object's automation level
  const mastery = obj.masteryState;
  const stability = mastery?.fsrsStability ?? 0;
  const normalizedAutomation = Math.min(stability / 30, 1);

  // Calculate support score for each supported component
  const supportDetails: ComponentSupportScore['supportDetails'] = [];
  let totalContribution = 0;

  for (const targetComponent of supportsComponents) {
    const prereqConfig = COMPONENT_PREREQUISITES[targetComponent];

    // Check if this object's component is a prerequisite
    if (prereqConfig.prerequisites.includes(componentType)) {
      // Calculate contribution based on automation level relative to threshold
      const thresholdRatio = normalizedAutomation / prereqConfig.automationThreshold;
      const contributionScore = Math.min(thresholdRatio, 1);

      let reason: string;
      if (contributionScore >= 1) {
        reason = `Fully supports ${targetComponent} (above threshold)`;
      } else if (contributionScore >= 0.7) {
        reason = `Mostly supports ${targetComponent} (near threshold)`;
      } else {
        reason = `Partially supports ${targetComponent} (below threshold)`;
      }

      supportDetails.push({
        targetComponent,
        contributionScore,
        reason,
      });

      totalContribution += contributionScore;
    }
  }

  // Overall support score is average contribution
  const supportScore =
    supportDetails.length > 0 ? totalContribution / supportDetails.length : 0;

  return {
    objectId,
    componentType,
    supportsComponents,
    supportScore,
    supportDetails,
  };
}

// =============================================================================
// Learning Strategy Determination
// =============================================================================

/**
 * Determine learning strategy for an object based on prerequisite chain.
 */
export async function determineObjectLearningStrategy(
  userId: string,
  goalId: string,
  objectId: string
): Promise<ObjectLearningStrategy> {
  const prisma = getPrisma();

  // Get the object
  const obj = await prisma.languageObject.findUnique({
    where: { id: objectId },
    include: {
      masteryState: true,
    },
  });

  if (!obj) {
    throw new Error(`Object not found: ${objectId}`);
  }

  const componentType = mapTypeToComponent(obj.type);
  const prereqConfig = COMPONENT_PREREQUISITES[componentType];

  // Get prerequisite status
  const prerequisiteStatus = await checkPrerequisitesSatisfied(
    userId,
    goalId,
    componentType
  );

  // Calculate automation level
  const mastery = obj.masteryState;
  const stability = mastery?.fsrsStability ?? 0;
  const automationLevel = Math.min(stability / 30, 1);
  const automationThreshold = prereqConfig.automationThreshold;

  // Get supported components
  const supportsComponents = COMPONENT_SUPPORTS[componentType];

  // Determine learning goal and reason
  let currentGoal: LearningGoal;
  let goalReason: LearningGoalReason;
  let priority: number;

  if (!prerequisiteStatus.allSatisfied) {
    // Prerequisites not met - focus on stabilization to support this component
    currentGoal = 'stabilization';
    goalReason = 'prerequisite_not_met';
    priority = 30; // Lower priority - need to work on prerequisites first
  } else if (automationLevel < automationThreshold) {
    // Not automated yet
    currentGoal = 'stabilization';
    goalReason = 'not_automated_yet';
    priority = 70 + (1 - automationLevel) * 30; // Higher priority the less automated
  } else if (supportsComponents.length > 0) {
    // Automated but supports higher components - maintain/boost automation
    currentGoal = 'stabilization';
    goalReason = 'supporting_higher_component';
    priority = 50;
  } else {
    // Automated, no higher components to support - expand usage space
    currentGoal = 'expansion';
    goalReason = 'automated_low_coverage';
    priority = 40;
  }

  // Usage space coverage would come from usage-space-tracking service
  const usageSpaceCoverage = 0; // Placeholder - would integrate with usage-space-tracking

  return {
    objectId,
    componentType,
    currentGoal,
    goalReason,
    prerequisiteStatus,
    automationLevel,
    automationThreshold,
    usageSpaceCoverage,
    supportsComponents,
    priority,
  };
}

/**
 * Get learning strategies for all objects in a goal.
 */
export async function getAllObjectStrategies(
  userId: string,
  goalId: string
): Promise<ObjectLearningStrategy[]> {
  const prisma = getPrisma();

  const objects = await prisma.languageObject.findMany({
    where: { goalId },
    select: { id: true },
  });

  const strategies: ObjectLearningStrategy[] = [];

  for (const obj of objects) {
    const strategy = await determineObjectLearningStrategy(userId, goalId, obj.id);
    strategies.push(strategy);
  }

  // Sort by priority (highest first)
  return strategies.sort((a, b) => b.priority - a.priority);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map component code to object type.
 */
function mapComponentToType(component: ComponentCode): string {
  const mapping: Record<ComponentCode, string> = {
    PHON: 'G2P',
    MORPH: 'MORPH',
    LEX: 'LEX',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };
  return mapping[component];
}

/**
 * Map object type to component code.
 */
function mapTypeToComponent(type: string): ComponentCode {
  const mapping: Record<string, ComponentCode> = {
    LEX: 'LEX',
    MORPH: 'MORPH',
    G2P: 'PHON',
    PHON: 'PHON',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };
  return mapping[type] || 'LEX';
}

/**
 * Get the hierarchy depth of a component (0 = PHON, 4 = PRAG).
 */
export function getComponentDepth(component: ComponentCode): number {
  return COMPONENT_ORDER.indexOf(component);
}

/**
 * Check if one component is a prerequisite of another.
 */
export function isPrerequisiteOf(
  potentialPrereq: ComponentCode,
  targetComponent: ComponentCode
): boolean {
  return COMPONENT_PREREQUISITES[targetComponent].prerequisites.includes(potentialPrereq);
}

/**
 * Get all components that depend on a given component (directly or indirectly).
 */
export function getDependentComponents(component: ComponentCode): ComponentCode[] {
  const dependents: ComponentCode[] = [];

  for (const comp of COMPONENT_ORDER) {
    if (isPrerequisiteOf(component, comp)) {
      dependents.push(comp);
    }
  }

  return dependents;
}
