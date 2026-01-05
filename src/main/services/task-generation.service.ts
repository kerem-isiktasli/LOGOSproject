/**
 * Task Generation Service (Layer 2)
 *
 * Implements Phase 3.2: Layer 2 of the learning pipeline.
 * Selects target objects, chooses task formats, selects modality,
 * generates content, and applies appropriate cue levels.
 */

import { getPrisma } from '../db/prisma';
import { getMasteryState } from '../db/repositories/mastery.repository';
import { getCollocationsForWord } from '../db/repositories/collocation.repository';
import { getWordDifficulty, type WordDifficultyResult } from './pmi.service';
import type { LearningQueueItem } from './state-priority.service';

// =============================================================================
// Types
// =============================================================================

export type TaskFormat = 'mcq' | 'fill_blank' | 'free_response' | 'matching' | 'ordering';
export type TaskModality = 'visual' | 'auditory' | 'mixed';
export type CueLevel = 0 | 1 | 2 | 3;

export interface TaskSpec {
  objectId: string;
  content: string;
  type: string;
  format: TaskFormat;
  modality: TaskModality;
  cueLevel: CueLevel;
  difficulty: number;
  isFluencyTask: boolean;
}

export interface GeneratedTask {
  spec: TaskSpec;
  prompt: string;
  expectedAnswer: string;
  options?: string[];
  hints?: string[];
  context?: string;
  relatedWords?: string[];
  metadata: {
    generatedAt: Date;
    source: 'cache' | 'template' | 'claude';
    estimatedTimeSeconds: number;
  };
}

export interface TaskGenerationConfig {
  preferredModality?: TaskModality;
  maxCueLevel?: CueLevel;
  fluencyRatio?: number; // 0-1, ratio of fluency to versatility tasks
  difficultyAdjustment?: number; // -1 to 1
}

// Stage to format mapping
const STAGE_FORMAT_MAP: Record<number, TaskFormat[]> = {
  0: ['mcq'],                           // Recognition only
  1: ['mcq', 'fill_blank'],             // Recognition + recall
  2: ['fill_blank', 'matching'],        // Controlled production
  3: ['fill_blank', 'free_response'],   // Free production
  4: ['free_response', 'ordering'],     // Advanced production
};

// Cue level descriptions
const CUE_LEVELS: Record<CueLevel, string> = {
  0: 'none',      // Cue-free
  1: 'minimal',   // First letter or category
  2: 'moderate',  // Partial word or strong hint
  3: 'full',      // Complete scaffolding
};

// =============================================================================
// Task Format Selection
// =============================================================================

/**
 * Select appropriate task format based on mastery stage.
 */
export function selectTaskFormat(
  stage: number,
  preferProduction: boolean = false
): TaskFormat {
  const availableFormats = STAGE_FORMAT_MAP[stage] ?? STAGE_FORMAT_MAP[4];

  if (preferProduction && availableFormats.includes('free_response')) {
    return 'free_response';
  }

  // Default to first available format (most appropriate for stage)
  return availableFormats[0];
}

/**
 * Determine if task should focus on fluency or versatility.
 */
export function shouldBeFluencyTask(
  stage: number,
  cueFreeAccuracy: number,
  fluencyRatio: number = 0.6
): boolean {
  // Early stages: more fluency
  if (stage <= 1) {
    return Math.random() < 0.8;
  }

  // High accuracy: shift to versatility
  if (cueFreeAccuracy > 0.8) {
    return Math.random() < 0.3;
  }

  // Default: use configured ratio
  return Math.random() < fluencyRatio;
}

// =============================================================================
// Cue Level Determination
// =============================================================================

/**
 * Determine appropriate cue level based on scaffolding gap.
 */
export function determineCueLevel(
  cueFreeAccuracy: number,
  cueAssistedAccuracy: number,
  exposureCount: number,
  maxCueLevel: CueLevel = 3
): CueLevel {
  const gap = cueAssistedAccuracy - cueFreeAccuracy;

  // Progressive cue reduction based on Gap 2.4 algorithm
  if (gap < 0.1 && exposureCount > 3) {
    return 0; // No cues needed
  }
  if (gap < 0.2 && exposureCount > 2) {
    return Math.min(1, maxCueLevel) as CueLevel;
  }
  if (gap < 0.3) {
    return Math.min(2, maxCueLevel) as CueLevel;
  }

  return maxCueLevel;
}

/**
 * Generate hints for a given cue level.
 */
export function generateHints(
  content: string,
  cueLevel: CueLevel
): string[] {
  const hints: string[] = [];

  if (cueLevel >= 1) {
    // First letter hint
    hints.push(`Starts with "${content[0].toUpperCase()}"`);
  }

  if (cueLevel >= 2) {
    // Length hint
    hints.push(`${content.length} letters`);
    // Partial reveal
    const revealed = content.slice(0, Math.ceil(content.length / 3));
    hints.push(`Begins with "${revealed}..."`);
  }

  if (cueLevel >= 3) {
    // Strong hint - more letters revealed
    const revealed = content.slice(0, Math.ceil(content.length / 2));
    hints.push(`"${revealed}____"`);
  }

  return hints;
}

// =============================================================================
// Task Difficulty
// =============================================================================

/**
 * Calculate task difficulty based on IRT parameters.
 */
export function calculateTaskDifficulty(
  irtDifficulty: number,
  format: TaskFormat,
  cueLevel: CueLevel
): number {
  // Format modifiers (production harder than recognition)
  const formatModifier: Record<TaskFormat, number> = {
    mcq: -0.5,
    fill_blank: 0,
    matching: -0.2,
    ordering: 0.3,
    free_response: 0.5,
  };

  // Cue level reduces difficulty
  const cueModifier = -cueLevel * 0.3;

  return irtDifficulty + formatModifier[format] + cueModifier;
}

/**
 * Calculate task difficulty enhanced with PMI data.
 * Falls back to IRT-only difficulty if PMI unavailable.
 */
export async function calculateTaskDifficultyWithPMI(
  goalId: string,
  content: string,
  irtDifficulty: number,
  format: TaskFormat,
  cueLevel: CueLevel
): Promise<{ difficulty: number; pmiResult: WordDifficultyResult | null }> {
  // Try to get PMI-based difficulty
  let pmiResult: WordDifficultyResult | null = null;

  try {
    // Map task format to PMI task type
    const taskTypeMap: Record<TaskFormat, 'recognition' | 'recall_cued' | 'recall_free' | 'production'> = {
      mcq: 'recognition',
      fill_blank: 'recall_cued',
      matching: 'recognition',
      ordering: 'recall_free',
      free_response: 'production',
    };

    const mainWord = content.split(/\s+/)[0];
    if (mainWord) {
      pmiResult = await getWordDifficulty(goalId, mainWord, taskTypeMap[format]);
    }
  } catch {
    // PMI unavailable, use fallback
  }

  // Calculate base difficulty
  let baseDifficulty: number;

  if (pmiResult?.pmiBasedDifficulty !== null && pmiResult?.pmiBasedDifficulty !== undefined) {
    // Blend PMI-based and IRT-based difficulty (PMI weighted higher for collocations)
    baseDifficulty = pmiResult.pmiBasedDifficulty * 0.6 + irtDifficulty * 0.4;
  } else {
    baseDifficulty = irtDifficulty;
  }

  // Apply format and cue modifiers
  const difficulty = calculateTaskDifficulty(baseDifficulty, format, cueLevel);

  return { difficulty, pmiResult };
}

// =============================================================================
// Task Generation
// =============================================================================

/**
 * Generate a task specification for a queue item.
 */
export async function generateTaskSpec(
  item: LearningQueueItem,
  config: TaskGenerationConfig = {}
): Promise<TaskSpec> {
  const db = getPrisma();

  // Get full object data
  const object = await db.languageObject.findUnique({
    where: { id: item.objectId },
    include: { masteryState: true },
  });

  if (!object) {
    throw new Error(`Object not found: ${item.objectId}`);
  }

  const mastery = object.masteryState;
  const stage = mastery?.stage ?? 0;
  const cueFreeAccuracy = mastery?.cueFreeAccuracy ?? 0;
  const cueAssistedAccuracy = mastery?.cueAssistedAccuracy ?? 0;
  const exposureCount = mastery?.exposureCount ?? 0;

  // Determine if fluency or versatility task
  const isFluencyTask = shouldBeFluencyTask(
    stage,
    cueFreeAccuracy,
    config.fluencyRatio
  );

  // Select task format
  const format = selectTaskFormat(stage, !isFluencyTask);

  // Determine modality
  const modality = config.preferredModality ?? 'visual';

  // Determine cue level
  const cueLevel = determineCueLevel(
    cueFreeAccuracy,
    cueAssistedAccuracy,
    exposureCount,
    config.maxCueLevel
  );

  // Calculate difficulty with PMI enhancement
  const baseDifficulty = object.irtDifficulty + (config.difficultyAdjustment ?? 0);
  const { difficulty } = await calculateTaskDifficultyWithPMI(
    object.goalId,
    object.content,
    baseDifficulty,
    format,
    cueLevel
  );

  return {
    objectId: item.objectId,
    content: object.content,
    type: object.type,
    format,
    modality,
    cueLevel,
    difficulty,
    isFluencyTask,
  };
}

/**
 * Generate MCQ options (distractors).
 */
async function generateMCQOptions(
  objectId: string,
  correctAnswer: string,
  count: number = 3
): Promise<string[]> {
  const db = getPrisma();

  // Get object to find similar items
  const object = await db.languageObject.findUnique({
    where: { id: objectId },
  });

  if (!object) return [correctAnswer];

  // Find similar objects by type
  const similar = await db.languageObject.findMany({
    where: {
      goalId: object.goalId,
      type: object.type,
      id: { not: objectId },
    },
    take: count * 2,
    orderBy: { frequency: 'desc' },
  });

  // Shuffle and select
  const distractors = similar
    .map((s) => s.content)
    .filter((c) => c !== correctAnswer)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  // Combine with correct answer and shuffle
  const options = [correctAnswer, ...distractors];
  return options.sort(() => Math.random() - 0.5);
}

/**
 * Generate a complete task with content.
 */
export async function generateTask(
  item: LearningQueueItem,
  config: TaskGenerationConfig = {}
): Promise<GeneratedTask> {
  const spec = await generateTaskSpec(item, config);
  const hints = generateHints(spec.content, spec.cueLevel);

  // Get collocations for context
  const collocations = await getCollocationsForWord(spec.objectId, 3, 5);
  const relatedWords = collocations.map((c) => c.word);

  let prompt: string;
  let expectedAnswer: string = spec.content;
  let options: string[] | undefined;
  let context: string | undefined;

  // Generate format-specific content
  switch (spec.format) {
    case 'mcq':
      options = await generateMCQOptions(spec.objectId, spec.content);
      prompt = generateMCQPrompt(spec, relatedWords);
      break;

    case 'fill_blank':
      const result = generateFillBlankPrompt(spec, relatedWords);
      prompt = result.prompt;
      context = result.context;
      break;

    case 'matching':
      prompt = `Match the word with its definition or usage.`;
      break;

    case 'ordering':
      prompt = `Arrange the words in the correct order.`;
      break;

    case 'free_response':
      prompt = generateFreeResponsePrompt(spec, relatedWords);
      break;

    default:
      prompt = `Practice the word: ${spec.content}`;
  }

  // Estimate completion time
  const timeEstimates: Record<TaskFormat, number> = {
    mcq: 10,
    fill_blank: 15,
    matching: 20,
    ordering: 25,
    free_response: 45,
  };

  return {
    spec,
    prompt,
    expectedAnswer,
    options,
    hints: spec.cueLevel > 0 ? hints : undefined,
    context,
    relatedWords: relatedWords.length > 0 ? relatedWords : undefined,
    metadata: {
      generatedAt: new Date(),
      source: 'template',
      estimatedTimeSeconds: timeEstimates[spec.format],
    },
  };
}

// =============================================================================
// Prompt Generation Helpers
// =============================================================================

function generateMCQPrompt(spec: TaskSpec, relatedWords: string[]): string {
  const prompts = [
    `Which word means "${getDefinitionPlaceholder(spec.content)}"?`,
    `Select the correct word to complete: "${relatedWords[0] ?? 'The'} ____"`,
    `Identify the correct spelling:`,
  ];

  return prompts[Math.floor(Math.random() * prompts.length)];
}

function generateFillBlankPrompt(
  spec: TaskSpec,
  relatedWords: string[]
): { prompt: string; context: string } {
  const collocation = relatedWords[0];

  if (collocation) {
    return {
      prompt: `Fill in the blank:`,
      context: `${collocation} ________`,
    };
  }

  return {
    prompt: `Type the word that matches this definition:`,
    context: getDefinitionPlaceholder(spec.content),
  };
}

function generateFreeResponsePrompt(spec: TaskSpec, relatedWords: string[]): string {
  const prompts = [
    `Use "${spec.content}" in a sentence.`,
    `Explain the meaning of "${spec.content}" in your own words.`,
    `Write a short paragraph using: ${[spec.content, ...relatedWords.slice(0, 2)].join(', ')}`,
  ];

  return prompts[Math.floor(Math.random() * prompts.length)];
}

function getDefinitionPlaceholder(word: string): string {
  // In production, this would fetch real definitions
  // For now, return a placeholder
  return `[Definition of "${word}"]`;
}

// =============================================================================
// Cached Task Retrieval
// =============================================================================

/**
 * Get cached task if available.
 */
export async function getCachedTask(
  objectId: string,
  taskType: string,
  taskFormat: string
): Promise<GeneratedTask | null> {
  const db = getPrisma();

  const cached = await db.cachedTask.findUnique({
    where: {
      objectId_taskType_taskFormat: {
        objectId,
        taskType,
        taskFormat,
      },
    },
  });

  if (!cached || cached.expiresAt < new Date()) {
    return null;
  }

  try {
    return JSON.parse(cached.taskContent);
  } catch {
    return null;
  }
}

/**
 * Cache a generated task.
 */
export async function cacheTask(
  objectId: string,
  taskType: string,
  taskFormat: string,
  task: GeneratedTask,
  expiresInHours: number = 24
): Promise<void> {
  const db = getPrisma();

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await db.cachedTask.upsert({
    where: {
      objectId_taskType_taskFormat: {
        objectId,
        taskType,
        taskFormat,
      },
    },
    create: {
      objectId,
      taskType,
      taskFormat,
      taskContent: JSON.stringify(task),
      expiresAt,
    },
    update: {
      taskContent: JSON.stringify(task),
      expiresAt,
    },
  });
}

/**
 * Generate or retrieve cached task.
 */
export async function getOrGenerateTask(
  item: LearningQueueItem,
  config: TaskGenerationConfig = {}
): Promise<GeneratedTask> {
  // Try cache first
  const cached = await getCachedTask(
    item.objectId,
    item.type,
    selectTaskFormat(item.stage).toString()
  );

  if (cached) {
    return cached;
  }

  // Generate new task
  const task = await generateTask(item, config);

  // Cache for future use
  await cacheTask(
    item.objectId,
    item.type,
    task.spec.format,
    task
  );

  return task;
}
