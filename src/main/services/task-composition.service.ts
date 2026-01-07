/**
 * Task Composition Service
 *
 * Implements economic optimization for flexible task composition.
 * Given a task template with object slots and a pool of candidate objects,
 * finds the optimal assignment that maximizes learning value while
 * respecting cognitive load constraints.
 *
 * Key concepts:
 * - ObjectSlot: A position in a task that can be filled by qualifying objects
 * - ObjectRole: The learning purpose of an object in the task (assessment → incidental)
 * - Economic Value: Learning benefit vs cognitive cost tradeoff
 * - Synergy: Bonus value from combining related objects
 *
 * Based on:
 * - Knapsack optimization (value/weight tradeoff)
 * - Cognitive Load Theory (Sweller, 1988)
 * - Desirable Difficulties (Bjork, 1994)
 */

import { getPrisma } from '../db/prisma';
import type {
  ComponentCode,
  CognitiveProcess,
  ObjectRole,
  ObjectSlot,
  ObjectSlotConstraints,
  TaskTemplate,
  FilledSlot,
  ComposedTask,
  TaskRubric,
  ObjectEconomicValue,
  CompositionOptimizationConfig,
  CompositionResult,
  MasteryStage,
  TaskType,
  TaskFormat,
  TaskModality,
  LanguageObject,
} from '../../core/types';
import {
  ROLE_CONFIGS,
  COGNITIVE_PROCESS_MULTIPLIERS,
  DEFAULT_COMPOSITION_CONFIG,
} from '../../core/types';
import { calculateEffectivePriority, calculateUrgencyScore } from './state-priority.service';
import {
  buildConstraintGraph,
  propagateConstraints,
  applyConstraintPreferences,
  applyRestrictions,
  validateAssignments,
  type ConstraintGraph,
  type ObjectMetadata,
} from './constraint-propagation.service';
import {
  selectTaskContext,
  getObjectUsageSpace,
  type UsageEvent,
} from './usage-space-tracking.service';

// =============================================================================
// Types
// =============================================================================

/**
 * Candidate object for slot filling.
 * Enriched with computed economic metrics.
 */
export interface ObjectCandidate {
  /** Language object data */
  object: {
    id: string;
    type: string;
    content: string;
    irtDifficulty: number;
    irtDiscrimination: number;
    priority: number;
    frequency: number;
    relationalDensity: number;
    contextualContribution: number;
  };

  /** Mastery state */
  mastery: {
    stage: MasteryStage;
    fsrsStability: number;
    fsrsDifficulty: number;
    exposureCount: number;
    cueFreeAccuracy: number;
    cueAssistedAccuracy: number;
    lastReview: Date | null;
    nextReview: Date | null;
  };

  /** Computed economic value */
  economicValue: ObjectEconomicValue;
}

/**
 * Slot assignment candidate.
 */
interface SlotAssignment {
  slot: ObjectSlot;
  candidate: ObjectCandidate;
  effectiveValue: number;  // Value considering role and slot weight
  effectiveCost: number;   // Cost considering cognitive process
}

/**
 * Composition state during optimization.
 */
interface CompositionState {
  assignments: Map<string, SlotAssignment>;  // slotId -> assignment
  totalValue: number;
  totalCost: number;
  synergyBonus: number;
  usedObjectIds: Set<string>;
}

// =============================================================================
// Economic Value Calculation
// =============================================================================

/**
 * Calculate economic value for a language object.
 * This determines how valuable the object is for learning purposes.
 */
export function calculateObjectEconomicValue(
  object: ObjectCandidate['object'],
  mastery: ObjectCandidate['mastery'],
  synergyData: Map<string, number>,  // Related object ID -> synergy score
  userTheta: Record<ComponentCode, number>,
  config: { currentTime: Date; goalDeadline?: Date }
): ObjectEconomicValue {
  const componentType = mapObjectTypeToComponent(object.type);

  // 1. Learning Value
  // Higher for: needs practice, due for review, high priority, low mastery
  const masteryFactor = getMasteryLearningFactor(mastery.stage);
  const reviewUrgency = calculateReviewUrgency(mastery, config.currentTime);
  const priorityFactor = object.priority;
  const frequencyValue = object.frequency * 0.5;  // Common words have more value

  const learningValue =
    masteryFactor * 0.3 +
    reviewUrgency * 0.3 +
    priorityFactor * 0.25 +
    frequencyValue * 0.15;

  // 2. Cognitive Cost
  // Higher for: difficult, unfamiliar, low automaticity
  const difficultyFactor = (object.irtDifficulty + 3) / 6;  // Normalize -3 to 3 → 0 to 1
  const familiarityFactor = 1 - (mastery.exposureCount / (mastery.exposureCount + 10));  // Asymptotic
  const automaticityLevel = calculateAutomaticityLevel(mastery);
  const automaticityCost = 1 - automaticityLevel;

  const cognitiveCost =
    difficultyFactor * 0.4 +
    familiarityFactor * 0.3 +
    automaticityCost * 0.3;

  // 3. Role Affinity
  // Determines which roles this object is suitable for
  const roleAffinity = calculateRoleAffinity(mastery, automaticityLevel);

  // 4. Urgency
  // Time-sensitive factors
  const deadlineUrgency = config.goalDeadline
    ? calculateDeadlineUrgency(config.goalDeadline, config.currentTime)
    : 0;
  const urgency = Math.max(reviewUrgency, deadlineUrgency);

  // 5. Exposure Balance
  // Placeholder - would need modality exposure history
  const exposureBalance = 0.5;  // Neutral for now

  return {
    objectId: object.id,
    componentType,
    learningValue,
    cognitiveCost,
    synergyMap: synergyData,
    roleAffinity,
    urgency,
    exposureBalance,
  };
}

/**
 * Map object type to component code.
 */
function mapObjectTypeToComponent(objectType: string): ComponentCode {
  const mapping: Record<string, ComponentCode> = {
    LEX: 'LEX',
    MORPH: 'MORPH',
    G2P: 'PHON',
    PHON: 'PHON',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };
  return mapping[objectType] || 'LEX';
}

/**
 * Get learning factor based on mastery stage.
 * Lower mastery = higher learning value (needs more practice).
 */
function getMasteryLearningFactor(stage: MasteryStage): number {
  const factors: Record<MasteryStage, number> = {
    0: 1.0,   // Unknown - highest value
    1: 0.9,   // Recognized
    2: 0.7,   // Familiar
    3: 0.5,   // Learned
    4: 0.3,   // Known
    5: 0.15,  // Mastered
    6: 0.05,  // Automatized - lowest value
  };
  return factors[stage] ?? 0.5;
}

/**
 * Calculate review urgency based on FSRS scheduling.
 */
function calculateReviewUrgency(
  mastery: ObjectCandidate['mastery'],
  currentTime: Date
): number {
  if (!mastery.nextReview) return 0.5;  // No scheduled review

  const timeSinceReview = currentTime.getTime() - (mastery.lastReview?.getTime() || 0);
  const timeUntilDue = mastery.nextReview.getTime() - currentTime.getTime();

  if (timeUntilDue < 0) {
    // Overdue - high urgency, increases with overdue time
    const overdueHours = Math.abs(timeUntilDue) / (1000 * 60 * 60);
    return Math.min(1.0, 0.7 + overdueHours * 0.01);
  }

  // Not yet due - lower urgency
  const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);
  if (hoursUntilDue < 24) return 0.5;  // Due within a day
  if (hoursUntilDue < 72) return 0.3;  // Due within 3 days
  return 0.1;  // Not urgent
}

/**
 * Calculate automaticity level from mastery metrics.
 */
function calculateAutomaticityLevel(mastery: ObjectCandidate['mastery']): number {
  // Factors: high accuracy, many exposures, stable memory
  const accuracyFactor = mastery.cueFreeAccuracy;
  const exposureFactor = Math.min(1, mastery.exposureCount / 20);  // Saturates at 20
  const stabilityFactor = Math.min(1, mastery.fsrsStability / 30);  // 30 days = high stability

  return (
    accuracyFactor * 0.5 +
    exposureFactor * 0.25 +
    stabilityFactor * 0.25
  );
}

/**
 * Calculate role affinity based on mastery and automaticity.
 */
function calculateRoleAffinity(
  mastery: ObjectCandidate['mastery'],
  automaticityLevel: number
): Record<ObjectRole, number> {
  // Assessment: Best for items that need formal evaluation (moderate mastery)
  // Practice: Best for items being actively learned
  // Reinforcement: Best for items approaching automaticity
  // Incidental: Best for already automatized items

  const stage = mastery.stage;

  return {
    assessment: stage <= 3 ? 0.8 : stage <= 4 ? 0.5 : 0.2,
    practice: stage <= 4 ? 0.9 : 0.4,
    reinforcement: stage >= 3 && stage <= 5 ? 0.8 : 0.3,
    incidental: automaticityLevel > 0.7 ? 0.9 : automaticityLevel > 0.4 ? 0.5 : 0.2,
  };
}

/**
 * Calculate deadline urgency.
 */
function calculateDeadlineUrgency(deadline: Date, currentTime: Date): number {
  const daysUntilDeadline = (deadline.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDeadline < 7) return 1.0;
  if (daysUntilDeadline < 30) return 0.7;
  if (daysUntilDeadline < 90) return 0.4;
  return 0.2;
}

// =============================================================================
// Slot Constraint Checking
// =============================================================================

/**
 * Check if a candidate satisfies slot constraints.
 */
export function satisfiesSlotConstraints(
  candidate: ObjectCandidate,
  slot: ObjectSlot,
  currentAssignments: Map<string, SlotAssignment>
): boolean {
  const constraints = slot.constraints;
  if (!constraints) return true;

  const componentType = mapObjectTypeToComponent(candidate.object.type);

  // Component type check
  if (!slot.acceptedComponents.includes(componentType)) {
    return false;
  }

  // Mastery stage constraints
  if (constraints.minMasteryStage !== undefined &&
      candidate.mastery.stage < constraints.minMasteryStage) {
    return false;
  }

  if (constraints.maxMasteryStage !== undefined &&
      candidate.mastery.stage > constraints.maxMasteryStage) {
    return false;
  }

  // Automaticity constraint
  if (constraints.minAutomaticity !== undefined) {
    const automaticity = calculateAutomaticityLevel(candidate.mastery);
    if (automaticity < constraints.minAutomaticity) {
      return false;
    }
  }

  // Priority constraint
  if (constraints.minPriority !== undefined &&
      candidate.object.priority < constraints.minPriority) {
    return false;
  }

  // Related slot constraint
  if (constraints.relatedToSlot) {
    const relatedAssignment = currentAssignments.get(constraints.relatedToSlot.slotId);
    if (relatedAssignment) {
      const synergy = candidate.economicValue.synergyMap.get(
        relatedAssignment.candidate.object.id
      );
      // Must have positive synergy with the related slot's object
      if (!synergy || synergy <= 0) {
        return false;
      }
    }
  }

  // Domain constraint
  if (constraints.domains && constraints.domains.length > 0) {
    // Would need domain info on object - placeholder
    // return constraints.domains.includes(candidate.object.domain);
  }

  return true;
}

// =============================================================================
// Synergy Calculation
// =============================================================================

/**
 * Calculate synergy bonus for a set of assignments.
 */
export function calculateSynergyBonus(
  assignments: Map<string, SlotAssignment>
): number {
  let totalSynergy = 0;
  const assignmentList = Array.from(assignments.values());

  for (let i = 0; i < assignmentList.length; i++) {
    for (let j = i + 1; j < assignmentList.length; j++) {
      const synergy1 = assignmentList[i].candidate.economicValue.synergyMap.get(
        assignmentList[j].candidate.object.id
      );
      const synergy2 = assignmentList[j].candidate.economicValue.synergyMap.get(
        assignmentList[i].candidate.object.id
      );

      // Take average of bidirectional synergy
      const synergy = ((synergy1 || 0) + (synergy2 || 0)) / 2;
      totalSynergy += synergy;
    }
  }

  return totalSynergy;
}

// =============================================================================
// Task Composition Optimizer
// =============================================================================

/**
 * Compose a task by optimally filling template slots with candidate objects.
 *
 * Uses greedy optimization with synergy-aware selection:
 * 1. Score all slot-candidate pairs
 * 2. Fill required slots first with best candidates
 * 3. Fill optional slots if cognitive budget allows
 * 4. Maximize synergy by considering pair bonuses
 */
export async function composeTask(
  template: TaskTemplate,
  candidates: ObjectCandidate[],
  sessionId: string,
  goalId: string,
  config: Partial<CompositionOptimizationConfig> = {}
): Promise<CompositionResult> {
  const fullConfig = { ...DEFAULT_COMPOSITION_CONFIG, ...config };

  // Initial state
  const state: CompositionState = {
    assignments: new Map(),
    totalValue: 0,
    totalCost: 0,
    synergyBonus: 0,
    usedObjectIds: new Set(),
  };

  const excludedObjects: CompositionResult['excludedObjects'] = [];
  let alternativesConsidered = 0;

  // Separate required and optional slots
  const requiredSlots = template.slots.filter(s => s.required);
  const optionalSlots = template.slots.filter(s => !s.required);

  // Phase 1: Fill required slots
  for (const slot of requiredSlots) {
    const bestAssignment = findBestAssignment(
      slot,
      candidates,
      state,
      fullConfig
    );

    if (!bestAssignment) {
      // Cannot fill required slot - return partial result
      return createCompositionResult(
        template,
        state,
        sessionId,
        goalId,
        excludedObjects,
        alternativesConsidered,
        false
      );
    }

    applyAssignment(state, bestAssignment);
    alternativesConsidered++;
  }

  // Phase 2: Fill optional slots while respecting cognitive budget
  for (const slot of optionalSlots) {
    if (state.totalCost >= fullConfig.maxCognitiveLoad) {
      break;  // Cognitive budget exhausted
    }

    const bestAssignment = findBestAssignment(
      slot,
      candidates,
      state,
      fullConfig
    );

    if (bestAssignment) {
      const newCost = state.totalCost + bestAssignment.effectiveCost;
      if (newCost <= fullConfig.maxCognitiveLoad) {
        applyAssignment(state, bestAssignment);
        alternativesConsidered++;
      } else {
        excludedObjects.push({
          objectId: bestAssignment.candidate.object.id,
          reason: 'cognitive_overload',
        });
      }
    }
  }

  // Phase 3: Update synergy bonus with final assignments
  state.synergyBonus = calculateSynergyBonus(state.assignments) * fullConfig.synergyWeight;
  state.totalValue += state.synergyBonus;

  return createCompositionResult(
    template,
    state,
    sessionId,
    goalId,
    excludedObjects,
    alternativesConsidered,
    true
  );
}

/**
 * Find the best candidate for a slot given current state.
 */
function findBestAssignment(
  slot: ObjectSlot,
  candidates: ObjectCandidate[],
  state: CompositionState,
  config: CompositionOptimizationConfig
): SlotAssignment | null {
  let bestAssignment: SlotAssignment | null = null;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    // Skip already used objects
    if (state.usedObjectIds.has(candidate.object.id)) {
      continue;
    }

    // Check constraints
    if (!satisfiesSlotConstraints(candidate, slot, state.assignments)) {
      continue;
    }

    // Calculate effective value and cost for this slot
    const roleConfig = ROLE_CONFIGS[slot.role];
    const processMultiplier = COGNITIVE_PROCESS_MULTIPLIERS[slot.requiredProcess];

    const effectiveValue =
      candidate.economicValue.learningValue *
      slot.weight *
      roleConfig.thetaMultiplier *
      candidate.economicValue.roleAffinity[slot.role];

    const effectiveCost =
      candidate.economicValue.cognitiveCost *
      processMultiplier *
      slot.weight;

    // Skip low-value candidates
    if (effectiveValue < config.minLearningValue) {
      continue;
    }

    // Calculate potential synergy with existing assignments
    let synergyPotential = 0;
    for (const existingAssignment of state.assignments.values()) {
      const synergy = candidate.economicValue.synergyMap.get(
        existingAssignment.candidate.object.id
      );
      synergyPotential += (synergy || 0) * config.synergyWeight;
    }

    // Combined score
    const score =
      effectiveValue +
      synergyPotential +
      candidate.economicValue.urgency * config.urgencyWeight +
      candidate.economicValue.exposureBalance * config.exposureBalanceWeight -
      effectiveCost * 0.5;  // Cost penalty

    if (score > bestScore) {
      bestScore = score;
      bestAssignment = {
        slot,
        candidate,
        effectiveValue,
        effectiveCost,
      };
    }
  }

  return bestAssignment;
}

/**
 * Apply an assignment to the composition state.
 */
function applyAssignment(state: CompositionState, assignment: SlotAssignment): void {
  state.assignments.set(assignment.slot.slotId, assignment);
  state.totalValue += assignment.effectiveValue;
  state.totalCost += assignment.effectiveCost;
  state.usedObjectIds.add(assignment.candidate.object.id);
}

/**
 * Create the final composition result.
 */
function createCompositionResult(
  template: TaskTemplate,
  state: CompositionState,
  sessionId: string,
  goalId: string,
  excludedObjects: CompositionResult['excludedObjects'],
  alternativesConsidered: number,
  success: boolean
): CompositionResult {
  // Convert assignments to filled slots
  const filledSlots: FilledSlot[] = Array.from(state.assignments.values()).map(
    assignment => ({
      ...assignment.slot,
      objectId: assignment.candidate.object.id,
      content: assignment.candidate.object.content,
      objectDifficulty: assignment.candidate.object.irtDifficulty,
      objectDiscrimination: assignment.candidate.object.irtDiscrimination,
      currentMasteryStage: assignment.candidate.mastery.stage,
      automaticityLevel: calculateAutomaticityLevel(assignment.candidate.mastery),
    })
  );

  // Calculate composite difficulty
  const compositeDifficulty = filledSlots.length > 0
    ? filledSlots.reduce(
        (sum, slot) => sum + slot.objectDifficulty * slot.weight,
        0
      ) / filledSlots.reduce((sum, slot) => sum + slot.weight, 0)
    : template.baseDifficulty;

  // Generate rubric
  const rubric = generateTaskRubric(filledSlots, template);

  // Create composed task
  const task: ComposedTask = {
    taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    templateId: template.templateId,
    sessionId,
    goalId,
    filledSlots,
    taskType: template.taskType,
    taskFormat: template.taskFormat,
    modality: template.modalities[0],  // Default to first modality
    domain: 'general',  // Would come from goal
    compositeDifficulty,
    content: generateTaskContent(template, filledSlots),
    expectedAnswers: generateExpectedAnswers(filledSlots, template),
    rubric,
  };

  return {
    task,
    totalLearningValue: state.totalValue,
    totalCognitiveCost: state.totalCost,
    efficiency: state.totalCost > 0 ? state.totalValue / state.totalCost : 0,
    synergyBonus: state.synergyBonus,
    excludedObjects,
    alternativesConsidered,
  };
}

/**
 * Generate task rubric from filled slots.
 */
function generateTaskRubric(
  filledSlots: FilledSlot[],
  template: TaskTemplate
): TaskRubric {
  const slotCriteria = filledSlots
    .filter(slot => slot.role === 'assessment' || slot.role === 'practice')
    .map(slot => ({
      slotId: slot.slotId,
      criteria: `Evaluate ${slot.content} (${slot.role})`,
      partialCreditLevels: [
        { score: 1.0, description: 'Correct and appropriate usage' },
        { score: 0.7, description: 'Minor error but meaning preserved' },
        { score: 0.4, description: 'Significant error but attempt made' },
        { score: 0, description: 'Incorrect or omitted' },
      ],
    }));

  return {
    slotCriteria,
    overallCriteria: `Complete the ${template.name} task correctly`,
  };
}

/**
 * Generate task content from template and filled slots.
 * Placeholder - would use LLM or template interpolation in production.
 */
function generateTaskContent(
  template: TaskTemplate,
  filledSlots: FilledSlot[]
): string {
  // Simple interpolation placeholder
  let content = template.contentTemplate;

  for (const slot of filledSlots) {
    content = content.replace(`{{${slot.slotId}}}`, slot.content);
  }

  return content;
}

/**
 * Generate expected answers from filled slots.
 */
function generateExpectedAnswers(
  filledSlots: FilledSlot[],
  _template: TaskTemplate
): string[] {
  // Assessment and practice slots determine expected answer
  const evaluatedSlots = filledSlots.filter(
    s => s.role === 'assessment' || s.role === 'practice'
  );

  if (evaluatedSlots.length === 0) return [];

  // For single-word tasks, the content is the answer
  // For complex tasks, this would need more sophisticated generation
  return evaluatedSlots.map(s => s.content);
}

// =============================================================================
// Candidate Pool Building
// =============================================================================

/**
 * Build candidate pool from database for a goal.
 */
export async function buildCandidatePool(
  goalId: string,
  userTheta: Record<ComponentCode, number>,
  config: { currentTime: Date; goalDeadline?: Date; limit?: number }
): Promise<ObjectCandidate[]> {
  const prisma = getPrisma();

  // Fetch objects with mastery states
  const objects = await prisma.languageObject.findMany({
    where: { goalId },
    include: {
      masteryState: true,
    },
    take: config.limit || 100,
  });

  // Fetch collocations for synergy data
  const objectIds = objects.map(o => o.id);
  const collocations = await prisma.collocation.findMany({
    where: {
      OR: [
        { word1Id: { in: objectIds } },
        { word2Id: { in: objectIds } },
      ],
    },
  });

  // Build synergy maps
  const synergyMaps = new Map<string, Map<string, number>>();
  for (const obj of objects) {
    synergyMaps.set(obj.id, new Map());
  }

  for (const coll of collocations) {
    const map1 = synergyMaps.get(coll.word1Id);
    const map2 = synergyMaps.get(coll.word2Id);
    const synergyScore = coll.npmi || coll.pmi * 0.3;

    if (map1) map1.set(coll.word2Id, synergyScore);
    if (map2) map2.set(coll.word1Id, synergyScore);
  }

  // Build candidates
  const candidates: ObjectCandidate[] = objects.map(obj => {
    const mastery = obj.masteryState || {
      stage: 0 as MasteryStage,
      fsrsStability: 0,
      fsrsDifficulty: 5,
      exposureCount: 0,
      cueFreeAccuracy: 0,
      cueAssistedAccuracy: 0,
      lastReview: null,
      nextReview: null,
    };

    const synergyData = synergyMaps.get(obj.id) || new Map();

    const economicValue = calculateObjectEconomicValue(
      {
        id: obj.id,
        type: obj.type,
        content: obj.content,
        irtDifficulty: obj.irtDifficulty,
        irtDiscrimination: obj.irtDiscrimination,
        priority: obj.priority,
        frequency: obj.frequency,
        relationalDensity: obj.relationalDensity,
        contextualContribution: obj.contextualContribution,
      },
      {
        stage: mastery.stage as MasteryStage,
        fsrsStability: mastery.fsrsStability,
        fsrsDifficulty: mastery.fsrsDifficulty,
        exposureCount: mastery.exposureCount,
        cueFreeAccuracy: mastery.cueFreeAccuracy,
        cueAssistedAccuracy: mastery.cueAssistedAccuracy,
        lastReview: mastery.lastReview,
        nextReview: mastery.nextReview,
      },
      synergyData,
      userTheta,
      config
    );

    return {
      object: {
        id: obj.id,
        type: obj.type,
        content: obj.content,
        irtDifficulty: obj.irtDifficulty,
        irtDiscrimination: obj.irtDiscrimination,
        priority: obj.priority,
        frequency: obj.frequency,
        relationalDensity: obj.relationalDensity,
        contextualContribution: obj.contextualContribution,
      },
      mastery: {
        stage: mastery.stage as MasteryStage,
        fsrsStability: mastery.fsrsStability,
        fsrsDifficulty: mastery.fsrsDifficulty,
        exposureCount: mastery.exposureCount,
        cueFreeAccuracy: mastery.cueFreeAccuracy,
        cueAssistedAccuracy: mastery.cueAssistedAccuracy,
        lastReview: mastery.lastReview,
        nextReview: mastery.nextReview,
      },
      economicValue,
    };
  });

  return candidates;
}

// =============================================================================
// Template Library
// =============================================================================

/**
 * Example task templates demonstrating the flexible slot system.
 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  // Simple vocabulary recognition
  {
    templateId: 'vocab-recognition-basic',
    name: 'Vocabulary Recognition',
    taskType: 'recognition',
    taskFormat: 'mcq',
    modalities: ['text'],
    slots: [
      {
        slotId: 'target-word',
        acceptedComponents: ['LEX'],
        role: 'assessment',
        weight: 1.0,
        requiredProcess: 'recognition',
        required: true,
      },
    ],
    interactionModel: 'compensatory',
    baseDifficulty: 0,
    contentTemplate: 'Select the correct meaning of "{{target-word}}"',
    minEvaluatedWeight: 0.5,
  },

  // Sentence writing with vocabulary + grammar
  {
    templateId: 'sentence-writing-multi',
    name: 'Sentence Writing (Multi-object)',
    taskType: 'sentence_writing',
    taskFormat: 'freeform',
    modalities: ['text'],
    slots: [
      {
        slotId: 'target-vocab',
        acceptedComponents: ['LEX'],
        role: 'assessment',
        weight: 0.4,
        requiredProcess: 'production',
        required: true,
      },
      {
        slotId: 'required-grammar',
        acceptedComponents: ['SYNT'],
        role: 'practice',
        weight: 0.3,
        requiredProcess: 'transformation',
        required: true,
        constraints: {
          minMasteryStage: 2,  // Must be at least familiar
        },
      },
      {
        slotId: 'collocation-word',
        acceptedComponents: ['LEX'],
        role: 'reinforcement',
        weight: 0.2,
        requiredProcess: 'recall',
        required: false,
        constraints: {
          relatedToSlot: {
            slotId: 'target-vocab',
            relationshipType: 'collocation',
          },
        },
      },
      {
        slotId: 'context-vocab',
        acceptedComponents: ['LEX'],
        role: 'incidental',
        weight: 0.1,
        requiredProcess: 'recognition',
        required: false,
        constraints: {
          minAutomaticity: 0.6,  // Must be relatively automatic
        },
      },
    ],
    interactionModel: 'compensatory',
    baseDifficulty: 0.5,
    contentTemplate: 'Write a sentence using "{{target-vocab}}" with the {{required-grammar}} structure.',
    minEvaluatedWeight: 0.5,
  },

  // Discourse completion (pragmatics)
  {
    templateId: 'discourse-completion',
    name: 'Discourse Completion',
    taskType: 'production',
    taskFormat: 'freeform',
    modalities: ['text'],
    slots: [
      {
        slotId: 'pragmatic-function',
        acceptedComponents: ['PRAG'],
        role: 'assessment',
        weight: 0.5,
        requiredProcess: 'production',
        required: true,
      },
      {
        slotId: 'register-marker',
        acceptedComponents: ['LEX', 'PRAG'],
        role: 'practice',
        weight: 0.3,
        requiredProcess: 'transformation',
        required: true,
      },
      {
        slotId: 'domain-vocab',
        acceptedComponents: ['LEX'],
        role: 'reinforcement',
        weight: 0.2,
        requiredProcess: 'recall',
        required: false,
      },
    ],
    interactionModel: 'conjunctive',  // Must get pragmatics right
    baseDifficulty: 0.7,
    contentTemplate: 'Complete the following dialogue appropriately for {{pragmatic-function}}:',
    minEvaluatedWeight: 0.6,
  },
];

/**
 * Get a template by ID.
 */
export function getTaskTemplate(templateId: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find(t => t.templateId === templateId);
}

/**
 * Find suitable templates for given object types.
 */
export function findSuitableTemplates(
  componentTypes: ComponentCode[],
  taskTypes?: TaskType[]
): TaskTemplate[] {
  return TASK_TEMPLATES.filter(template => {
    // Check if template has slots for these component types
    const templateComponents = new Set(
      template.slots.flatMap(s => s.acceptedComponents)
    );

    const hasMatchingComponent = componentTypes.some(c => templateComponents.has(c));

    // Check task type filter
    const taskTypeMatch = !taskTypes || taskTypes.includes(template.taskType);

    return hasMatchingComponent && taskTypeMatch;
  });
}
