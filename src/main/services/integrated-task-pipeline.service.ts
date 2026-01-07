/**
 * Integrated Task Pipeline Service
 *
 * Bridges existing task generation with new flexible composition system.
 * Provides a unified interface that:
 *
 * 1. Uses economic optimization from task-composition.service
 * 2. Applies cascading constraints from constraint-propagation.service
 * 3. Selects contexts based on usage space from usage-space-tracking.service
 * 4. Evaluates with multi-layer scoring from multi-layer-evaluation.service
 * 5. Updates theta via multi-object-calibration.service
 *
 * This service acts as the orchestrator, ensuring all components work together
 * while maintaining backward compatibility with existing code.
 */

import { getPrisma } from '../db/prisma';
import type {
  ComponentCode,
  ObjectRole,
  TaskTemplate,
  ComposedTask,
  CompositionResult,
  CompositionOptimizationConfig,
  ConstraintPropagation,
  ObjectUsageSpace,
  UsageContext,
  MultiObjectTaskSpec,
  MultiComponentEvaluation,
  MultiObjectResponseOutcome,
  TaskType,
  MasteryStage,
} from '../../core/types';
import { DEFAULT_COMPOSITION_CONFIG, ROLE_CONFIGS } from '../../core/types';

// Import existing services
import {
  composeTask,
  buildCandidatePool,
  getTaskTemplate,
  findSuitableTemplates,
  TASK_TEMPLATES,
  type ObjectCandidate,
} from './task-composition.service';

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
  recordUsageEvent,
  getObjectUsageSpace,
  calculateUsageSpaceProgress,
  selectTaskContext,
  getContextById,
  STANDARD_CONTEXTS,
  type UsageEvent,
} from './usage-space-tracking.service';

import {
  evaluateObject,
  evaluateBatch,
  evaluationToThetaInput,
  type ObjectEvaluationInput,
  type ObjectEvaluationResult,
  type BatchEvaluationResult,
} from './multi-layer-evaluation.service';

import {
  processMultiObjectResponse,
  createMultiObjectTaskSpec,
  shouldUseMultiObjectProcessing,
  type MultiObjectUserResponse,
} from './multi-object-calibration.service';

import {
  generateTask,
  generateMultiObjectTask,
  type GeneratedTask,
  type LearningQueueItem,
} from './task-generation.service';

import { getLearningQueue, getNextLearningItem } from './state-priority.service';

// =============================================================================
// Types
// =============================================================================

/**
 * Integrated task generation request.
 */
export interface IntegratedTaskRequest {
  /** Session ID */
  sessionId: string;

  /** Goal ID */
  goalId: string;

  /** User ID */
  userId: string;

  /** Preferred task types (optional filter) */
  preferredTaskTypes?: TaskType[];

  /** Optimization config overrides */
  optimizationConfig?: Partial<CompositionOptimizationConfig>;

  /** Whether to prefer usage space expansion */
  preferExpansion?: boolean;

  /** Target context (optional, auto-selected if not provided) */
  targetContext?: string;

  /** Use legacy task generation as fallback */
  allowLegacyFallback?: boolean;
}

/**
 * Integrated task generation result.
 */
export interface IntegratedTaskResult {
  /** Generated task */
  task: GeneratedTask | ComposedTask;

  /** Multi-object spec if applicable */
  multiObjectSpec?: MultiObjectTaskSpec;

  /** Composition result details */
  compositionDetails?: CompositionResult;

  /** Constraint propagation applied */
  constraintsApplied?: ConstraintPropagation;

  /** Selected usage context */
  usageContext: UsageContext;

  /** Whether legacy fallback was used */
  usedLegacyFallback: boolean;

  /** Metadata */
  metadata: {
    candidatesConsidered: number;
    constraintsEvaluated: number;
    efficiency: number;
    generationTimeMs: number;
  };
}

/**
 * Integrated response processing request.
 */
export interface IntegratedResponseRequest {
  /** Session ID */
  sessionId: string;

  /** Task that was presented */
  task: GeneratedTask | ComposedTask;

  /** Multi-object spec if applicable */
  multiObjectSpec?: MultiObjectTaskSpec;

  /** User's response */
  response: string;

  /** Response time in ms */
  responseTimeMs: number;

  /** Hints used */
  hintsUsed: number;

  /** Cue level */
  cueLevel: number;

  /** Usage context */
  usageContext: UsageContext;
}

/**
 * Integrated response processing result.
 */
export interface IntegratedResponseResult {
  /** Evaluation result */
  evaluation: MultiComponentEvaluation;

  /** Per-object evaluation details */
  objectEvaluations: ObjectEvaluationResult[];

  /** Multi-object response outcome (theta updates, etc.) */
  responseOutcome?: MultiObjectResponseOutcome;

  /** Usage space expansions triggered */
  usageExpansions: Array<{
    objectId: string;
    newContextId: string;
    previousCoverage: number;
    newCoverage: number;
  }>;

  /** Updated coverage ratios */
  updatedCoverage: Map<string, number>;

  /** Feedback for user */
  feedback: string;
}

// =============================================================================
// Main Pipeline Functions
// =============================================================================

/**
 * Generate an integrated task using the full pipeline.
 *
 * Pipeline:
 * 1. Get learning queue from state-priority.service
 * 2. Build candidate pool with economic values
 * 3. Build constraint graph
 * 4. Find suitable templates
 * 5. Select optimal context based on usage space
 * 6. Compose task with constraint-aware slot filling
 * 7. Fall back to legacy if composition fails
 */
export async function generateIntegratedTask(
  request: IntegratedTaskRequest
): Promise<IntegratedTaskResult> {
  const startTime = Date.now();
  const prisma = getPrisma();

  // 1. Get user theta state
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
  });

  const userTheta: Record<ComponentCode, number> = {
    PHON: user?.thetaPhonology ?? 0,
    MORPH: user?.thetaMorphology ?? 0,
    LEX: user?.thetaLexical ?? 0,
    SYNT: user?.thetaSyntactic ?? 0,
    PRAG: user?.thetaPragmatic ?? 0,
  };

  // 2. Build candidate pool
  const candidates = await buildCandidatePool(
    request.goalId,
    userTheta,
    {
      currentTime: new Date(),
      goalDeadline: undefined,  // Would get from goal
      limit: 100,
    }
  );

  if (candidates.length === 0) {
    // No candidates - fall back to legacy
    return await generateLegacyFallback(request, startTime, 'no_candidates');
  }

  // 3. Build constraint graph
  const constraintGraph = await buildConstraintGraph(request.goalId);

  // 4. Get usage spaces for context selection
  const usageSpaces: ObjectUsageSpace[] = [];
  for (const candidate of candidates.slice(0, 20)) {  // Top 20 for efficiency
    const usageSpace = await getObjectUsageSpace(candidate.object.id);
    usageSpaces.push(usageSpace);
  }

  // 5. Find suitable templates
  const componentTypes = [...new Set(candidates.map(c =>
    mapTypeToComponent(c.object.type)
  ))];
  const templates = findSuitableTemplates(componentTypes, request.preferredTaskTypes);

  if (templates.length === 0) {
    return await generateLegacyFallback(request, startTime, 'no_templates');
  }

  // 6. Select best template based on candidates and constraints
  const selectedTemplate = selectBestTemplate(templates, candidates, constraintGraph);

  // 7. Select usage context
  const usageContext = request.targetContext
    ? (getContextById(request.targetContext) || STANDARD_CONTEXTS[0])
    : selectTaskContext(usageSpaces, selectedTemplate.taskType, request.preferExpansion ?? true);

  // 8. Compose task with constraints
  const compositionResult = await composeTaskWithConstraints(
    selectedTemplate,
    candidates,
    constraintGraph,
    request.sessionId,
    request.goalId,
    request.optimizationConfig || {}
  );

  if (!compositionResult || compositionResult.task.filledSlots.length === 0) {
    return await generateLegacyFallback(request, startTime, 'composition_failed');
  }

  // 9. Build multi-object spec for calibration
  const multiObjectSpec = buildMultiObjectSpec(compositionResult.task, request.sessionId);

  // 10. Create generated task format for compatibility
  const generatedTask = composedTaskToGeneratedTask(compositionResult.task, usageContext);

  return {
    task: generatedTask,
    multiObjectSpec,
    compositionDetails: compositionResult,
    constraintsApplied: undefined,  // Would include if propagation was significant
    usageContext,
    usedLegacyFallback: false,
    metadata: {
      candidatesConsidered: candidates.length,
      constraintsEvaluated: constraintGraph.edges.length,
      efficiency: compositionResult.efficiency,
      generationTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Process a response through the integrated pipeline.
 *
 * Pipeline:
 * 1. Evaluate response with multi-layer evaluation
 * 2. Process through multi-object calibration
 * 3. Record usage events and check for expansions
 * 4. Generate feedback
 */
export async function processIntegratedResponse(
  request: IntegratedResponseRequest
): Promise<IntegratedResponseResult> {
  // 1. Build evaluation inputs from task
  const evaluationInputs = buildEvaluationInputs(request);

  // 2. Evaluate response
  const batchResult = evaluateBatch(evaluationInputs, { strictness: 'normal' });

  // 3. Process through multi-object calibration if spec available
  let responseOutcome: MultiObjectResponseOutcome | undefined;

  if (request.multiObjectSpec) {
    const multiObjectResponse: MultiObjectUserResponse = {
      sessionId: request.sessionId,
      taskSpec: request.multiObjectSpec,
      response: request.response,
      responseTimeMs: request.responseTimeMs,
      hintsUsed: request.hintsUsed,
      cueLevel: request.cueLevel,
    };

    try {
      responseOutcome = await processMultiObjectResponse(multiObjectResponse, {
        strictness: 'normal',
        partialCreditEnabled: true,
        learningRate: 0.1,
      });
    } catch (error) {
      console.error('Multi-object processing failed:', error);
    }
  }

  // 4. Record usage events and check for expansions
  const usageExpansions: IntegratedResponseResult['usageExpansions'] = [];
  const updatedCoverage = new Map<string, number>();

  for (const objResult of batchResult.objectResults) {
    const usageEvent: UsageEvent = {
      objectId: objResult.objectId,
      componentType: objResult.componentType,
      contextId: request.usageContext.contextId,
      sessionId: request.sessionId,
      taskId: isComposedTask(request.task) ? request.task.taskId : request.task.taskId,
      taskType: isComposedTask(request.task) ? request.task.taskType : request.task.taskType,
      success: objResult.correct,
      score: objResult.score,
      timestamp: new Date(),
    };

    const usageResult = await recordUsageEvent(usageEvent);

    if (usageResult.expansion) {
      usageExpansions.push({
        objectId: usageResult.expansion.objectId,
        newContextId: usageResult.expansion.newContextId,
        previousCoverage: usageResult.expansion.previousCoverage,
        newCoverage: usageResult.expansion.newCoverage,
      });
    }

    updatedCoverage.set(objResult.objectId, usageResult.newCoverage);
  }

  // 5. Generate enhanced feedback
  const feedback = generateEnhancedFeedback(
    batchResult,
    usageExpansions,
    request.usageContext
  );

  return {
    evaluation: batchResult.aggregated,
    objectEvaluations: batchResult.objectResults,
    responseOutcome,
    usageExpansions,
    updatedCoverage,
    feedback,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate legacy fallback task.
 */
async function generateLegacyFallback(
  request: IntegratedTaskRequest,
  startTime: number,
  reason: string
): Promise<IntegratedTaskResult> {
  if (!request.allowLegacyFallback) {
    throw new Error(`Task composition failed: ${reason}`);
  }

  // Get next item from learning queue
  const nextItem = await getNextLearningItem(request.goalId, request.sessionId);

  if (!nextItem) {
    throw new Error('No learning items available');
  }

  // Try multi-object task first
  const multiResult = await generateMultiObjectTask(
    nextItem,
    request.sessionId,
    request.goalId
  );

  if (multiResult) {
    return {
      task: multiResult.task,
      multiObjectSpec: multiResult.multiObjectSpec,
      usageContext: STANDARD_CONTEXTS[0],
      usedLegacyFallback: true,
      metadata: {
        candidatesConsidered: 1,
        constraintsEvaluated: 0,
        efficiency: 0,
        generationTimeMs: Date.now() - startTime,
      },
    };
  }

  // Fall back to single-object task
  const task = await generateTask(nextItem, request.sessionId, request.goalId);

  return {
    task,
    usageContext: STANDARD_CONTEXTS[0],
    usedLegacyFallback: true,
    metadata: {
      candidatesConsidered: 1,
      constraintsEvaluated: 0,
      efficiency: 0,
      generationTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Select best template based on candidates and constraints.
 */
function selectBestTemplate(
  templates: TaskTemplate[],
  candidates: ObjectCandidate[],
  _constraintGraph: ConstraintGraph
): TaskTemplate {
  // Score templates by how well they match available candidates
  const scoredTemplates = templates.map(template => {
    let score = 0;

    for (const slot of template.slots) {
      // Count candidates that could fill this slot
      const matchingCandidates = candidates.filter(c =>
        slot.acceptedComponents.includes(mapTypeToComponent(c.object.type))
      );

      // More matching candidates = higher score
      score += Math.min(matchingCandidates.length, 5);

      // Bonus for assessment slots (more important)
      if (slot.role === 'assessment') {
        score += 2;
      }
    }

    return { template, score };
  });

  // Sort by score and return best
  scoredTemplates.sort((a, b) => b.score - a.score);

  return scoredTemplates[0]?.template || templates[0];
}

/**
 * Compose task with constraint propagation.
 */
async function composeTaskWithConstraints(
  template: TaskTemplate,
  candidates: ObjectCandidate[],
  constraintGraph: ConstraintGraph,
  sessionId: string,
  goalId: string,
  config: Partial<CompositionOptimizationConfig>
): Promise<CompositionResult | null> {
  // For now, use basic composition
  // Full constraint propagation would be applied here
  try {
    return await composeTask(template, candidates, sessionId, goalId, config);
  } catch (error) {
    console.error('Task composition failed:', error);
    return null;
  }
}

/**
 * Build multi-object spec from composed task.
 */
function buildMultiObjectSpec(
  task: ComposedTask,
  sessionId: string
): MultiObjectTaskSpec {
  return createMultiObjectTaskSpec(
    task.filledSlots.map(slot => ({
      id: slot.objectId,
      type: mapComponentToObjectType(slot.acceptedComponents[0]),
      content: slot.content,
      irtDifficulty: slot.objectDifficulty,
      irtDiscrimination: slot.objectDiscrimination,
      isPrimary: slot.role === 'assessment',
    })),
    task.taskType,
    task.taskFormat,
    'text',
    sessionId,
    task.goalId
  );
}

/**
 * Convert composed task to generated task format.
 */
function composedTaskToGeneratedTask(
  task: ComposedTask,
  context: UsageContext
): GeneratedTask {
  return {
    taskId: task.taskId,
    objectId: task.filledSlots[0]?.objectId || '',
    taskType: task.taskType,
    taskFormat: task.taskFormat,
    modality: task.modality,
    prompt: task.content,
    expectedAnswer: task.expectedAnswers[0] || '',
    alternatives: task.expectedAnswers.slice(1),
    hints: [],
    difficulty: task.compositeDifficulty,
    cueLevel: 0,
    isFluencyTask: false,
    metadata: {
      context: context.contextId,
      domain: context.domain,
      register: context.register,
      slotsUsed: task.filledSlots.length,
    },
  };
}

/**
 * Build evaluation inputs from response request.
 */
function buildEvaluationInputs(
  request: IntegratedResponseRequest
): ObjectEvaluationInput[] {
  if (isComposedTask(request.task)) {
    return request.task.filledSlots
      .filter(slot => slot.role === 'assessment' || slot.role === 'practice')
      .map(slot => ({
        objectId: slot.objectId,
        componentType: slot.acceptedComponents[0],
        response: request.response,
        expected: [slot.content],
        config: {
          objectId: slot.objectId,
          componentType: slot.acceptedComponents[0],
          evaluationMode: 'partial_credit' as const,
        },
        role: slot.role,
        weight: slot.weight,
        context: {
          taskType: request.task.taskType as string,
          domain: request.usageContext.domain,
          register: request.usageContext.register,
        },
      }));
  }

  // Legacy task format
  return [{
    objectId: request.task.objectId,
    componentType: 'LEX',
    response: request.response,
    expected: [request.task.expectedAnswer],
    config: {
      objectId: request.task.objectId,
      componentType: 'LEX',
      evaluationMode: 'binary' as const,
    },
    role: 'assessment' as ObjectRole,
    weight: 1.0,
    context: {
      taskType: request.task.taskType,
      domain: request.usageContext.domain,
      register: request.usageContext.register,
    },
  }];
}

/**
 * Generate enhanced feedback including usage space info.
 */
function generateEnhancedFeedback(
  batchResult: BatchEvaluationResult,
  expansions: IntegratedResponseResult['usageExpansions'],
  context: UsageContext
): string {
  let feedback = batchResult.aggregated.feedback;

  // Add expansion celebration
  if (expansions.length > 0) {
    const expansionMsg = expansions.length === 1
      ? `Great! You've successfully used this in ${context.name}!`
      : `Excellent! You've expanded your usage in ${expansions.length} areas!`;
    feedback = `${feedback}\n\n🎉 ${expansionMsg}`;
  }

  return feedback;
}

/**
 * Type guard for ComposedTask.
 */
function isComposedTask(task: GeneratedTask | ComposedTask): task is ComposedTask {
  return 'filledSlots' in task;
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
 * Map component code to object type.
 */
function mapComponentToObjectType(component: ComponentCode): string {
  const mapping: Record<ComponentCode, string> = {
    LEX: 'LEX',
    MORPH: 'MORPH',
    PHON: 'G2P',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
  };
  return mapping[component];
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick task generation with defaults.
 */
export async function quickGenerateTask(
  userId: string,
  goalId: string,
  sessionId: string
): Promise<IntegratedTaskResult> {
  return generateIntegratedTask({
    userId,
    goalId,
    sessionId,
    allowLegacyFallback: true,
    preferExpansion: true,
  });
}

/**
 * Get pipeline status for debugging.
 */
export async function getPipelineStatus(goalId: string): Promise<{
  candidateCount: number;
  templateCount: number;
  constraintCount: number;
  usageSpaceProgress: number;
}> {
  const constraintGraph = await buildConstraintGraph(goalId);
  const progress = await calculateUsageSpaceProgress(goalId);

  return {
    candidateCount: 0,  // Would query
    templateCount: TASK_TEMPLATES.length,
    constraintCount: constraintGraph.edges.length,
    usageSpaceProgress: progress.overallReadiness,
  };
}
