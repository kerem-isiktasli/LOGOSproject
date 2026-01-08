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
import { getClaudeService } from './claude.service';
import type { LearningQueueItem } from './state-priority.service';
import {
  recommendTask,
  extractZVector,
  getOptimalModality,
  type ZVector,
  type WordProfile,
} from '../../core/task-matching';
import { analyzeResponseTime, getTargetResponseTime } from '../../core/response-timing';
import {
  selectContextWithGeneralization,
  getObjectUsageSpace,
} from './usage-space-tracking.service';
import type { UsageContext, TaskType, MasteryStage, LanguageObjectType } from '../../core/types';

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
  /** Usage context selected based on generalization estimation */
  usageContext?: UsageContext;
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

  // Select usage context based on generalization estimation
  // This integrates the Usage Space Expansion framework into task generation
  let usageContext: UsageContext | undefined;
  try {
    const usageSpace = await getObjectUsageSpace(item.objectId);
    // Map task format to TaskType enum
    const taskType = mapFormatToTaskType(format);
    // Select optimal context for generalization
    usageContext = await selectContextWithGeneralization(
      [usageSpace],
      taskType,
      {
        strategy: isFluencyTask ? 'goal_alignment' : 'coverage_maximization',
        preferExpansion: !isFluencyTask, // Versatility tasks expand coverage
      }
    );
  } catch {
    // Graceful degradation: if usage space fails, continue without context
    usageContext = undefined;
  }

  return {
    objectId: item.objectId,
    content: object.content,
    type: object.type,
    format,
    modality,
    cueLevel,
    difficulty,
    isFluencyTask,
    usageContext,
  };
}

/**
 * Map task format to TaskType enum.
 * Maps internal format names to core/types.ts TaskType values.
 */
function mapFormatToTaskType(format: TaskFormat): TaskType {
  const mapping: Record<TaskFormat, TaskType> = {
    mcq: 'recognition',
    fill_blank: 'fill_blank',
    free_response: 'recall_free',
    matching: 'recognition',
    ordering: 'recognition',
  };
  return mapping[format];
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

/**
 * LRU Cache with TTL for definitions.
 * Prevents memory leaks from unbounded growth.
 */
class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; accessCount: number }>();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize: number = 1000, ttlMs: number = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access count for LRU
    entry.accessCount++;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict expired entries first
    this.evictExpired();

    // If still at capacity, evict LRU
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    let minAccess = Infinity;
    let oldestTime = Infinity;
    let evictKey = '';

    for (const [key, entry] of this.cache) {
      // Prefer evicting entries with fewer accesses, break ties by oldest
      if (entry.accessCount < minAccess ||
          (entry.accessCount === minAccess && entry.timestamp < oldestTime)) {
        minAccess = entry.accessCount;
        oldestTime = entry.timestamp;
        evictKey = key;
      }
    }

    if (evictKey) {
      this.cache.delete(evictKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Definition cache to avoid repeated API calls for the same word.
 * Uses LRU eviction with max 1000 entries and 24-hour TTL.
 */
const definitionCache = new LRUCache<string>(1000, 24 * 60 * 60 * 1000);
const DEFINITION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (for backward compat)

/**
 * Get a definition for a word, using Claude API with caching and offline fallback.
 *
 * @param word - The word to define
 * @param targetLanguage - Target language code (default: 'en')
 * @param nativeLanguage - Native language for explanations (default: 'en')
 * @returns Definition string
 */
async function getDefinition(
  word: string,
  targetLanguage: string = 'en',
  nativeLanguage: string = 'en'
): Promise<string> {
  // Check cache first (LRU cache handles TTL internally)
  const cacheKey = `${word}:${targetLanguage}:${nativeLanguage}`;
  const cached = definitionCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  // Try Claude API
  try {
    const claude = getClaudeService();

    const response = await claude.generateContent({
      type: 'explanation',
      content: word,
      targetLanguage,
      nativeLanguage,
      context: 'Provide a concise dictionary-style definition (1-2 sentences max). Focus on the most common meaning.',
    });

    // Extract just the definition from Claude's response
    const definition = extractDefinitionFromResponse(response.content, word);

    // Cache the result (LRU cache handles timestamp internally)
    definitionCache.set(cacheKey, definition);

    return definition;
  } catch {
    // Fallback to basic definition patterns
    return generateOfflineDefinition(word);
  }
}

/**
 * Extract a clean definition from Claude's response.
 */
function extractDefinitionFromResponse(response: string, word: string): string {
  // Claude may include extra text, try to extract just the definition
  const lines = response.split('\n').filter(line => line.trim());

  // Look for lines that start with definition patterns
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip lines that are just the word itself or headers
    if (trimmed.toLowerCase() === word.toLowerCase()) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
    if (trimmed.includes('Definition:')) {
      return trimmed.replace(/^Definition:\s*/i, '').trim();
    }
    // Return first substantive line
    if (trimmed.length > 10 && !trimmed.endsWith(':')) {
      return trimmed;
    }
  }

  // If no good extraction, use first 100 chars of response
  return response.slice(0, 100).trim() + (response.length > 100 ? '...' : '');
}

/**
 * Generate an offline definition based on word patterns.
 * Uses linguistic heuristics when Claude is unavailable.
 */
function generateOfflineDefinition(word: string): string {
  const lowerWord = word.toLowerCase();

  // Common suffix patterns for English
  const suffixPatterns: Array<{ suffix: string; template: string }> = [
    { suffix: 'tion', template: 'A noun referring to the act or process of' },
    { suffix: 'sion', template: 'A noun referring to the state or result of' },
    { suffix: 'ness', template: 'A noun describing the quality or state of being' },
    { suffix: 'ment', template: 'A noun referring to the result or means of' },
    { suffix: 'able', template: 'An adjective meaning capable of being' },
    { suffix: 'ible', template: 'An adjective meaning capable of being' },
    { suffix: 'ful', template: 'An adjective meaning full of or characterized by' },
    { suffix: 'less', template: 'An adjective meaning without or lacking' },
    { suffix: 'ous', template: 'An adjective meaning having the quality of' },
    { suffix: 'ly', template: 'An adverb describing the manner of' },
    { suffix: 'er', template: 'A noun referring to one who performs' },
    { suffix: 'or', template: 'A noun referring to one who performs' },
    { suffix: 'ist', template: 'A noun referring to a person who practices or believes in' },
    { suffix: 'ize', template: 'A verb meaning to make or become' },
    { suffix: 'ise', template: 'A verb meaning to make or become' },
    { suffix: 'ing', template: 'A present participle or gerund form relating to' },
    { suffix: 'ed', template: 'A past tense or adjective form relating to' },
  ];

  for (const { suffix, template } of suffixPatterns) {
    if (lowerWord.endsWith(suffix)) {
      const root = word.slice(0, -suffix.length);
      if (root.length >= 3) {
        return `${template} "${root}".`;
      }
    }
  }

  // Default fallback
  return `A word or expression meaning "${word}".`;
}

/**
 * Synchronous placeholder for contexts where async is not possible.
 * Used in prompt generation where we can't await.
 */
function getDefinitionPlaceholder(word: string): string {
  // Check if we have a cached definition (LRU cache handles TTL internally)
  const cacheKey = `${word}:en:en`;
  const cached = definitionCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  // Return offline-generated definition
  return generateOfflineDefinition(word);
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

// =============================================================================
// Claude-Enhanced Task Generation
// =============================================================================

/**
 * Generate a task using Claude AI for richer content.
 * Falls back to template-based generation if Claude is unavailable.
 */
export async function generateTaskWithClaude(
  item: LearningQueueItem,
  config: TaskGenerationConfig = {}
): Promise<GeneratedTask> {
  const db = getPrisma();

  // Get full object data
  const object = await db.languageObject.findUnique({
    where: { id: item.objectId },
    include: {
      masteryState: true,
      goal: { include: { user: true } },
    },
  });

  if (!object) {
    throw new Error(`Object not found: ${item.objectId}`);
  }

  // Generate spec first (same as template-based)
  const spec = await generateTaskSpec(item, config);
  const hints = generateHints(spec.content, spec.cueLevel);

  // Get collocations for context
  const collocations = await getCollocationsForWord(spec.objectId, 3, 5);
  const relatedWords = collocations.map((c) => c.word);

  // Try Claude-enhanced generation
  try {
    const claude = getClaudeService();

    // Only use Claude for free_response or complex tasks
    if (spec.format === 'free_response' || spec.isFluencyTask === false) {
      const generated = await claude.generateContent({
        type: 'exercise',
        content: object.content,
        targetLanguage: object.goal.user.targetLanguage,
        nativeLanguage: object.goal.user.nativeLanguage,
        context: relatedWords.join(', '),
        difficulty: spec.difficulty,
      });

      // Parse Claude response to extract prompt
      const claudePrompt = generated.content;

      return {
        spec,
        prompt: claudePrompt,
        expectedAnswer: spec.content,
        hints: spec.cueLevel > 0 ? hints : undefined,
        relatedWords: relatedWords.length > 0 ? relatedWords : undefined,
        metadata: {
          generatedAt: new Date(),
          source: 'claude',
          estimatedTimeSeconds: spec.format === 'free_response' ? 45 : 20,
        },
      };
    }
  } catch (err) {
    // Claude unavailable, fall back to template
    console.warn('Claude unavailable for task generation, using template:', err);
  }

  // Fall back to template-based generation
  return generateTask(item, config);
}

/**
 * Get or generate task, preferring Claude for complex tasks.
 */
export async function getOrGenerateTaskWithClaude(
  item: LearningQueueItem,
  config: TaskGenerationConfig = {},
  preferClaude: boolean = false
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
  const task = preferClaude
    ? await generateTaskWithClaude(item, config)
    : await generateTask(item, config);

  // Cache for future use
  await cacheTask(
    item.objectId,
    item.type,
    task.spec.format,
    task
  );

  return task;
}

// =============================================================================
// Task-Matching Enhanced Generation
// =============================================================================

/**
 * Extended task generation configuration with z(w) vector support.
 */
export interface EnhancedTaskGenerationConfig extends TaskGenerationConfig {
  /** Use z(w) vector for task type selection */
  useTaskMatching?: boolean;
  /** User's focus domain for domain-relevant content */
  focusDomain?: string;
  /** Target response time in ms (for timed tasks) */
  targetResponseTimeMs?: number;
}

/**
 * Generate a task using the z(w) vector task-matching algorithm.
 *
 * This uses the word's characteristic vector (frequency, morphological complexity,
 * phonological difficulty, etc.) to select the optimal task type and format.
 *
 * @param item - Learning queue item
 * @param config - Enhanced task generation configuration
 * @returns Generated task optimized for the word's characteristics
 */
export async function generateTaskWithMatching(
  item: LearningQueueItem,
  config: EnhancedTaskGenerationConfig = {}
): Promise<GeneratedTask> {
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

  // Extract z(w) vector from object properties
  const zVector: ZVector = extractZVector(
    {
      frequency: object.frequency,
      relationalDensity: object.relationalDensity,
      domainDistribution: object.domainDistribution,
      morphologicalScore: object.morphologicalScore,
      phonologicalDifficulty: object.phonologicalDifficulty,
      pragmaticScore: object.pragmaticScore,
    },
    config.focusDomain
  );

  // Build word profile for task matching
  const wordProfile: WordProfile = {
    content: object.content,
    type: object.type as LanguageObjectType,
    zVector,
    masteryStage: stage as 0 | 1 | 2 | 3 | 4,
    cueFreeAccuracy,
    exposureCount,
  };

  // Get optimal task recommendation
  const recommendation = recommendTask(wordProfile);

  // Map task-matching task type to our TaskFormat
  // Includes syntactic complexity tasks based on Lu (2010, 2011) L2SCA framework
  const taskTypeToFormat: Record<string, TaskFormat> = {
    recognition: 'mcq',
    definition_match: 'mcq',
    recall_cued: 'fill_blank',
    recall_free: 'fill_blank',
    word_formation: 'fill_blank',
    collocation: 'matching',
    production: 'free_response',
    register_shift: 'free_response',
    rapid_response: 'mcq',
    // Syntactic complexity tasks (Lu, 2010, 2011)
    sentence_combining: 'free_response',    // Combine simple sentences → complex
    clause_selection: 'mcq',                // Select appropriate clause type
    error_correction: 'fill_blank',         // Fix syntactic errors
    sentence_writing: 'free_response',      // Produce target structure
  };

  const format = taskTypeToFormat[recommendation.taskType] ?? selectTaskFormat(stage);

  // Get optimal modality from z(w) vector
  const modality = config.preferredModality ?? (getOptimalModality(zVector) as TaskModality);

  // Determine cue level
  const cueLevel = determineCueLevel(
    cueFreeAccuracy,
    cueAssistedAccuracy,
    exposureCount,
    config.maxCueLevel
  );

  // Determine fluency vs versatility
  const isFluencyTask = recommendation.taskType === 'rapid_response' ||
    shouldBeFluencyTask(stage, cueFreeAccuracy, config.fluencyRatio);

  // Calculate difficulty with PMI enhancement
  const baseDifficulty = object.irtDifficulty + (config.difficultyAdjustment ?? 0);
  const { difficulty } = await calculateTaskDifficultyWithPMI(
    object.goalId,
    object.content,
    baseDifficulty,
    format,
    cueLevel
  );

  const spec: TaskSpec = {
    objectId: item.objectId,
    content: object.content,
    type: object.type,
    format,
    modality,
    cueLevel,
    difficulty,
    isFluencyTask,
  };

  const hints = generateHints(spec.content, spec.cueLevel);

  // Get collocations for context
  const collocations = await getCollocationsForWord(spec.objectId, 3, 5);
  const relatedWords = collocations.map((c) => c.word);

  let prompt: string;
  let expectedAnswer: string = spec.content;
  let options: string[] | undefined;
  let context: string | undefined;

  // Generate format-specific content with task type awareness
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

  // Calculate target response time based on task type
  const targetResponseTime = config.targetResponseTimeMs ??
    getTargetResponseTime(
      recommendation.taskType === 'rapid_response' ? 'timed' : 'recall',
      stage as MasteryStage
    );

  // Estimate completion time
  const timeEstimates: Record<TaskFormat, number> = {
    mcq: isFluencyTask ? 5 : 10,
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
      taskMatchingReason: recommendation.reason,
      targetResponseTimeMs: targetResponseTime,
      recommendedTaskType: recommendation.taskType,
      suitabilityScore: recommendation.suitability,
    } as GeneratedTask['metadata'] & {
      taskMatchingReason: string;
      targetResponseTimeMs: number;
      recommendedTaskType: string;
      suitabilityScore: number;
    },
  };
}

/**
 * Get or generate task using task-matching when available.
 */
export async function getOrGenerateTaskWithMatching(
  item: LearningQueueItem,
  config: EnhancedTaskGenerationConfig = {}
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

  // Generate new task using task-matching if enabled
  const task = config.useTaskMatching
    ? await generateTaskWithMatching(item, config)
    : await generateTask(item, config);

  // Cache for future use
  await cacheTask(
    item.objectId,
    item.type,
    task.spec.format,
    task
  );

  return task;
}

// =============================================================================
// Syntactic Complexity Task Templates (Lu, 2010, 2011)
// =============================================================================

/**
 * Syntactic task types based on Lu's L2SCA framework.
 *
 * Lu, X. (2010). Automatic analysis of syntactic complexity in second
 * language writing. International Journal of Corpus Linguistics, 15(4), 474-496.
 *
 * Lu, X. (2011). A corpus-based evaluation of syntactic complexity measures
 * as indices of college-level ESL writers' language development.
 * TESOL Quarterly, 45(1), 36-62.
 */
export type SyntacticTaskType =
  | 'sentence_combining'  // Combine T-units to increase MLC
  | 'clause_selection'    // Choose correct dependent clause (DC/C)
  | 'nominal_complexity'  // Complex nominal insertion (CN/C)
  | 'subordination'       // Create subordinate structures
  | 'coordination'        // Create coordinate structures
  | 'error_correction';   // Fix syntactic errors

/**
 * Syntactic complexity metrics (Lu L2SCA).
 */
export interface SyntacticMetrics {
  /** Mean Length of Clause (MLC) - clausal elaboration */
  mlc: number;
  /** Complex Nominals per Clause (CN/C) - phrasal complexity */
  cnPerC: number;
  /** Dependent Clauses per Clause (DC/C) - subordination */
  dcPerC: number;
  /** Coordinate Phrases per Clause (CP/C) - coordination */
  cpPerC: number;
  /** Overall complexity score (normalized 0-1) */
  complexity: number;
}

/**
 * Generate a sentence combining task.
 * Targets Mean Length of Clause (MLC) metric.
 *
 * @param simpleSentences - Array of simple sentences to combine
 * @param targetStructure - Target grammatical structure hint
 * @returns Task prompt and expected answer pattern
 */
export function generateSentenceCombiningTask(
  simpleSentences: string[],
  targetStructure?: string
): { prompt: string; context: string; hint?: string } {
  const structureHints: Record<string, string> = {
    relative: 'Use a relative clause (who, which, that)',
    adverbial: 'Use an adverbial clause (because, although, when)',
    participial: 'Use a participial phrase (-ing or -ed)',
    appositive: 'Use an appositive phrase',
    compound: 'Use coordination (and, but, or)',
  };

  return {
    prompt: 'Combine these sentences into one complex sentence:',
    context: simpleSentences.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    hint: targetStructure ? structureHints[targetStructure] : undefined,
  };
}

/**
 * Generate a clause selection task.
 * Targets DC/C (Dependent Clauses per Clause) metric.
 *
 * @param mainClause - The main/independent clause
 * @param options - Array of clause options (one correct, others distractors)
 * @param correctIndex - Index of correct option
 * @returns Task prompt with multiple choice options
 */
export function generateClauseSelectionTask(
  mainClause: string,
  options: string[],
  correctIndex: number
): { prompt: string; context: string; options: string[]; correctAnswer: string } {
  return {
    prompt: 'Select the clause that best completes the sentence:',
    context: `${mainClause} ________________`,
    options: options,
    correctAnswer: options[correctIndex],
  };
}

/**
 * Generate a complex nominal task.
 * Targets CN/C (Complex Nominals per Clause) metric.
 *
 * @param baseNominal - The base noun phrase
 * @param modifiers - Possible modifiers (adjectives, prepositional phrases, relative clauses)
 * @returns Task prompt for noun phrase expansion
 */
export function generateNominalComplexityTask(
  baseNominal: string,
  modifiers: string[]
): { prompt: string; context: string; options: string[] } {
  return {
    prompt: 'Expand this noun phrase using appropriate modifiers:',
    context: `Base phrase: "${baseNominal}"`,
    options: modifiers,
  };
}

/**
 * Generate a syntactic error correction task.
 * Tests understanding of syntactic rules.
 *
 * @param incorrectSentence - Sentence with syntactic error
 * @param errorType - Type of error (agreement, word order, missing element, etc.)
 * @returns Task prompt with error identification and correction
 */
export function generateSyntacticErrorTask(
  incorrectSentence: string,
  errorType: 'agreement' | 'word_order' | 'missing' | 'extra' | 'tense' | 'reference'
): { prompt: string; context: string; hint: string } {
  const errorHints: Record<typeof errorType, string> = {
    agreement: 'Check subject-verb or noun-modifier agreement',
    word_order: 'Check the order of words or phrases',
    missing: 'Something is missing from this sentence',
    extra: 'There is an unnecessary element in this sentence',
    tense: 'Check verb tense consistency',
    reference: 'Check pronoun or article reference',
  };

  return {
    prompt: 'Find and correct the error in this sentence:',
    context: incorrectSentence,
    hint: errorHints[errorType],
  };
}

/**
 * Generate a subordination task.
 * Targets clause embedding and subordination structures.
 *
 * @param independentClause - The main clause
 * @param subordinatingConjunctions - List of conjunctions to choose from
 * @param dependentContent - Content for the dependent clause
 * @returns Task prompt for creating subordinate structure
 */
export function generateSubordinationTask(
  independentClause: string,
  subordinatingConjunctions: string[],
  dependentContent: string
): { prompt: string; context: string; options: string[] } {
  return {
    prompt: 'Create a complex sentence by adding a subordinate clause:',
    context: `Main idea: ${independentClause}\nRelated idea: ${dependentContent}`,
    options: subordinatingConjunctions.map(conj =>
      `Use "${conj}" to connect these ideas`
    ),
  };
}

/**
 * Calculate CEFR-aligned syntactic complexity targets.
 * Based on Lu (2011) proficiency correlations.
 *
 * @param cefrLevel - CEFR level (A1-C2)
 * @returns Target syntactic metrics for that level
 */
export function getSyntacticTargetsForCEFR(
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
): SyntacticMetrics {
  // Based on Lu (2011) corpus data correlations with proficiency
  const targets: Record<typeof cefrLevel, SyntacticMetrics> = {
    A1: { mlc: 5, cnPerC: 0.3, dcPerC: 0.1, cpPerC: 0.1, complexity: 0.1 },
    A2: { mlc: 7, cnPerC: 0.5, dcPerC: 0.2, cpPerC: 0.2, complexity: 0.25 },
    B1: { mlc: 9, cnPerC: 0.8, dcPerC: 0.35, cpPerC: 0.3, complexity: 0.4 },
    B2: { mlc: 11, cnPerC: 1.1, dcPerC: 0.5, cpPerC: 0.4, complexity: 0.55 },
    C1: { mlc: 13, cnPerC: 1.4, dcPerC: 0.65, cpPerC: 0.5, complexity: 0.75 },
    C2: { mlc: 15, cnPerC: 1.7, dcPerC: 0.8, cpPerC: 0.6, complexity: 0.9 },
  };

  return targets[cefrLevel];
}

// =============================================================================
// Phonological Component Task Templates (G2P)
// =============================================================================

/**
 * Phonological task types targeting G2P (Grapheme-to-Phoneme) skills.
 *
 * References:
 * - Treiman, R. (1993). Beginning to Spell. Oxford University Press.
 * - Ziegler, J. & Goswami, U. (2005). Reading acquisition, developmental
 *   dyslexia, and skilled reading across languages. Psychological Bulletin.
 */
export type PhonologicalTaskType =
  | 'minimal_pair'        // Distinguish similar sounds
  | 'phoneme_isolation'   // Identify specific phonemes
  | 'syllable_counting'   // Count syllables in words
  | 'stress_marking'      // Mark word stress patterns
  | 'rhyme_matching'      // Match rhyming words
  | 'dictation'           // Write from audio
  | 'pronunciation';      // Produce correct pronunciation

/**
 * Generate a minimal pair discrimination task.
 * Tests phonemic awareness for similar sounds.
 */
export function generateMinimalPairTask(
  word1: string,
  word2: string,
  targetPhoneme: string,
  audioAvailable: boolean = false
): { prompt: string; options: string[]; hint: string; modality: 'auditory' | 'visual' } {
  return {
    prompt: audioAvailable
      ? 'Listen and identify which word you hear:'
      : `Which word contains the sound /${targetPhoneme}/?`,
    options: [word1, word2],
    hint: `Focus on the difference in the "${targetPhoneme}" sound`,
    modality: audioAvailable ? 'auditory' : 'visual',
  };
}

/**
 * Generate a syllable structure task.
 * Tests syllable awareness and counting.
 */
export function generateSyllableTask(
  word: string,
  syllableCount: number,
  syllableBreakdown: string[]
): { prompt: string; context: string; expectedAnswer: number; hint: string } {
  return {
    prompt: 'How many syllables does this word have?',
    context: word,
    expectedAnswer: syllableCount,
    hint: `Break it down: ${syllableBreakdown.join(' - ')}`,
  };
}

/**
 * Generate a word stress task.
 * Tests prosodic awareness.
 */
export function generateStressTask(
  word: string,
  stressPattern: string, // e.g., "OOo" for stress on first syllable
  stressedSyllable: number
): { prompt: string; context: string; options: string[]; expectedAnswer: number } {
  const syllables = word.split(/(?=[aeiou])/i).filter(s => s.length > 0);
  const options = syllables.map((_, i) => `Syllable ${i + 1}`);

  return {
    prompt: 'Which syllable is stressed?',
    context: `${word} (${stressPattern})`,
    options,
    expectedAnswer: stressedSyllable,
  };
}

// =============================================================================
// Morphological Component Task Templates
// =============================================================================

/**
 * Morphological task types targeting word formation skills.
 *
 * References:
 * - Bauer, L. & Nation, P. (1993). Word families. International Journal of
 *   Lexicography, 6(4), 253-279.
 * - Schmitt, N. & Zimmerman, C. (2002). Derivative word forms: What do
 *   learners know? TESOL Quarterly, 36(2), 145-171.
 */
export type MorphologicalTaskType =
  | 'affix_identification'  // Identify prefix/suffix
  | 'word_family'           // Generate word family members
  | 'derivation'            // Create derived forms
  | 'inflection'            // Apply inflectional morphology
  | 'root_extraction'       // Identify root/base
  | 'compound_analysis';    // Analyze compound words

/**
 * Generate a word family task.
 * Tests morphological productivity knowledge.
 */
export function generateWordFamilyTask(
  baseWord: string,
  familyMembers: Array<{ word: string; partOfSpeech: string }>
): { prompt: string; context: string; expectedAnswers: string[] } {
  return {
    prompt: 'List other forms of this word (noun, verb, adjective, adverb):',
    context: `Base word: "${baseWord}"`,
    expectedAnswers: familyMembers.map(m => m.word),
  };
}

/**
 * Generate an affix task.
 * Tests affix meaning and application.
 */
export function generateAffixTask(
  targetAffix: string,
  affixType: 'prefix' | 'suffix',
  meaning: string,
  examples: string[]
): { prompt: string; context: string; options: string[]; hint: string } {
  return {
    prompt: `Which word uses the ${affixType} "${targetAffix}" correctly?`,
    context: `The ${affixType} "${targetAffix}" means: ${meaning}`,
    options: examples,
    hint: `Think about what "${targetAffix}" adds to the word's meaning`,
  };
}

/**
 * Generate a derivation task.
 * Tests ability to form derivatives.
 */
export function generateDerivationTask(
  baseWord: string,
  targetPartOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb',
  expectedDerivation: string
): { prompt: string; context: string; expectedAnswer: string; hint: string } {
  const posHints: Record<string, string> = {
    noun: 'person, place, thing, or concept',
    verb: 'action or state',
    adjective: 'describes a noun',
    adverb: 'describes how something is done',
  };

  return {
    prompt: `Change "${baseWord}" into a ${targetPartOfSpeech}:`,
    context: `A ${targetPartOfSpeech} is a ${posHints[targetPartOfSpeech]}`,
    expectedAnswer: expectedDerivation,
    hint: `Common ${targetPartOfSpeech} endings: ${getCommonEndings(targetPartOfSpeech)}`,
  };
}

function getCommonEndings(pos: string): string {
  const endings: Record<string, string> = {
    noun: '-tion, -ness, -ment, -er, -ist',
    verb: '-ize, -ify, -en, -ate',
    adjective: '-ful, -less, -able, -ous, -ive',
    adverb: '-ly',
  };
  return endings[pos] || '';
}

// =============================================================================
// Lexical Component Task Templates
// =============================================================================

/**
 * Lexical task types targeting vocabulary depth and breadth.
 *
 * References:
 * - Nation, I.S.P. (2001). Learning Vocabulary in Another Language. Cambridge.
 * - Read, J. (2000). Assessing Vocabulary. Cambridge University Press.
 */
export type LexicalTaskType =
  | 'definition_recall'    // Recall meaning
  | 'synonym_selection'    // Choose synonyms
  | 'antonym_selection'    // Choose antonyms
  | 'collocation_fill'     // Complete collocations
  | 'semantic_field'       // Group by meaning
  | 'context_inference'    // Infer meaning from context
  | 'polysemy_distinction'; // Distinguish multiple meanings

/**
 * Generate a collocation completion task.
 * Tests collocational knowledge.
 */
export function generateCollocationTask(
  collocate: string,
  targetWord: string,
  distractors: string[],
  pmiScore: number
): { prompt: string; context: string; options: string[]; correctAnswer: string; difficulty: number } {
  const allOptions = [targetWord, ...distractors].sort(() => Math.random() - 0.5);

  return {
    prompt: 'Complete the collocation:',
    context: `${collocate} _______`,
    options: allOptions,
    correctAnswer: targetWord,
    // Higher PMI = stronger collocation = easier task
    difficulty: 1 - Math.min(1, pmiScore / 10),
  };
}

/**
 * Generate a semantic field task.
 * Tests semantic organization knowledge.
 */
export function generateSemanticFieldTask(
  fieldName: string,
  members: string[],
  intruders: string[]
): { prompt: string; context: string; options: string[]; correctAnswers: string[] } {
  const allWords = [...members, ...intruders].sort(() => Math.random() - 0.5);

  return {
    prompt: `Select all words related to "${fieldName}":`,
    context: `Semantic field: ${fieldName}`,
    options: allWords,
    correctAnswers: members,
  };
}

/**
 * Generate a polysemy task.
 * Tests understanding of multiple word meanings.
 */
export function generatePolysemyTask(
  word: string,
  meanings: Array<{ sense: string; example: string }>,
  targetSenseIndex: number
): { prompt: string; context: string; options: string[]; correctAnswer: string } {
  return {
    prompt: `Which meaning of "${word}" is used in this context?`,
    context: meanings[targetSenseIndex].example,
    options: meanings.map(m => m.sense),
    correctAnswer: meanings[targetSenseIndex].sense,
  };
}

// =============================================================================
// Pragmatic Component Task Templates
// =============================================================================

/**
 * Pragmatic task types targeting contextual language use.
 *
 * References:
 * - Bardovi-Harlig, K. (2001). Evaluating the empirical evidence: Grounds for
 *   instruction in pragmatics. In K. Rose & G. Kasper (Eds.), Pragmatics in
 *   Language Teaching. Cambridge.
 * - Taguchi, N. (2015). Instructed pragmatics at a glance. Language Teaching, 48(1).
 */
export type PragmaticTaskType =
  | 'register_selection'   // Choose appropriate register
  | 'speech_act'           // Identify/produce speech acts
  | 'politeness_level'     // Select politeness strategy
  | 'context_appropriacy'  // Judge contextual appropriacy
  | 'implicature'          // Understand implied meaning
  | 'discourse_marker';    // Use discourse markers

/**
 * Generate a register shift task.
 * Tests sociolinguistic competence.
 */
export function generateRegisterShiftTask(
  utterance: string,
  sourceRegister: 'formal' | 'neutral' | 'informal',
  targetRegister: 'formal' | 'neutral' | 'informal',
  expectedOutput: string
): { prompt: string; context: string; sourceRegister: string; targetRegister: string; expectedAnswer: string } {
  const registerDescriptions: Record<string, string> = {
    formal: 'academic/professional context',
    neutral: 'everyday conversation',
    informal: 'casual/friendly context',
  };

  return {
    prompt: `Rewrite this sentence for a ${targetRegister} context:`,
    context: `"${utterance}" (currently ${sourceRegister}: ${registerDescriptions[sourceRegister]})`,
    sourceRegister,
    targetRegister,
    expectedAnswer: expectedOutput,
  };
}

/**
 * Generate a speech act task.
 * Tests pragmatic function recognition.
 */
export function generateSpeechActTask(
  utterance: string,
  speechAct: 'request' | 'apology' | 'complaint' | 'refusal' | 'suggestion' | 'invitation',
  context: string
): { prompt: string; context: string; options: string[]; correctAnswer: string } {
  const speechActs = ['request', 'apology', 'complaint', 'refusal', 'suggestion', 'invitation'];

  return {
    prompt: 'What is the speaker doing with this utterance?',
    context: `Context: ${context}\nUtterance: "${utterance}"`,
    options: speechActs.map(act => `Making a ${act}`),
    correctAnswer: `Making a ${speechAct}`,
  };
}

/**
 * Generate a politeness strategy task.
 * Tests sociopragmatic competence.
 */
export function generatePolitenessTask(
  situation: string,
  options: Array<{ utterance: string; politenessLevel: number }>,
  targetPoliteness: 'direct' | 'conventionally_indirect' | 'non_conventional'
): { prompt: string; context: string; options: string[]; hint: string } {
  const levelDescriptions: Record<string, string> = {
    direct: 'clear and straightforward',
    conventionally_indirect: 'polite but clear',
    non_conventional: 'very indirect, hints at the request',
  };

  return {
    prompt: `Choose the most appropriate response (${levelDescriptions[targetPoliteness]}):`,
    context: situation,
    options: options.map(o => o.utterance),
    hint: `Consider the social distance and power relationship in this situation`,
  };
}

/**
 * Generate an implicature task.
 * Tests ability to understand implied meanings.
 */
export function generateImplicatureTask(
  dialogue: string,
  impliedMeaning: string,
  literalMeaning: string,
  distractors: string[]
): { prompt: string; context: string; options: string[]; correctAnswer: string } {
  const allOptions = [impliedMeaning, literalMeaning, ...distractors].sort(() => Math.random() - 0.5);

  return {
    prompt: 'What does the speaker really mean?',
    context: dialogue,
    options: allOptions,
    correctAnswer: impliedMeaning,
  };
}

// =============================================================================
// Multi-Object Task Generation
// =============================================================================

import {
  createMultiObjectTaskSpec,
  allocateQMatrixWeights,
  objectTypeToComponent,
  getQMatrixEntry,
} from './multi-object-calibration.service';
import type {
  MultiObjectTaskSpec,
  MultiObjectTarget,
} from '../../core/types';

/**
 * Configuration for multi-object task generation.
 */
export interface MultiObjectTaskConfig extends TaskGenerationConfig {
  /** Maximum number of target objects per task */
  maxTargetObjects?: number;

  /** Minimum weight for secondary objects */
  minSecondaryWeight?: number;

  /** Include related objects from same morphological family */
  includeMorphFamily?: boolean;

  /** Include syntactic pattern objects */
  includeSyntacticPatterns?: boolean;

  /** Include pragmatic context objects */
  includePragmaticContext?: boolean;
}

const DEFAULT_MULTI_OBJECT_CONFIG: MultiObjectTaskConfig = {
  maxTargetObjects: 4,
  minSecondaryWeight: 0.1,
  includeMorphFamily: true,
  includeSyntacticPatterns: true,
  includePragmaticContext: false,
};

/**
 * Find related objects for multi-component task.
 *
 * Searches for objects that:
 * 1. Share morphological family with primary
 * 2. Participate in same syntactic patterns
 * 3. Share pragmatic domain
 */
export async function findRelatedObjects(
  primaryObjectId: string,
  goalId: string,
  config: MultiObjectTaskConfig = DEFAULT_MULTI_OBJECT_CONFIG
): Promise<Array<{
  id: string;
  type: LanguageObjectType;
  content: string;
  irtDifficulty: number;
  irtDiscrimination: number;
  relationshipType: 'morph_family' | 'syntactic_pattern' | 'pragmatic_domain' | 'collocation';
}>> {
  const db = getPrisma();
  const relatedObjects: Array<{
    id: string;
    type: LanguageObjectType;
    content: string;
    irtDifficulty: number;
    irtDiscrimination: number;
    relationshipType: 'morph_family' | 'syntactic_pattern' | 'pragmatic_domain' | 'collocation';
  }> = [];

  // Get primary object
  const primary = await db.languageObject.findUnique({
    where: { id: primaryObjectId },
  });

  if (!primary) return [];

  // 1. Find morphological family members
  if (config.includeMorphFamily) {
    // Look for objects with same root/stem pattern
    const contentRoot = primary.content.slice(0, Math.floor(primary.content.length * 0.6));
    const morphFamily = await db.languageObject.findMany({
      where: {
        goalId,
        id: { not: primaryObjectId },
        type: { in: ['MORPH', 'LEX'] },
        content: { startsWith: contentRoot },
      },
      take: 2,
    });

    morphFamily.forEach(obj => {
      relatedObjects.push({
        id: obj.id,
        type: obj.type as LanguageObjectType,
        content: obj.content,
        irtDifficulty: obj.irtDifficulty,
        irtDiscrimination: obj.irtDiscrimination,
        relationshipType: 'morph_family',
      });
    });
  }

  // 2. Find syntactic pattern objects
  if (config.includeSyntacticPatterns) {
    const syntacticPatterns = await db.languageObject.findMany({
      where: {
        goalId,
        type: 'SYNT',
      },
      take: 1,
      orderBy: { priority: 'desc' },
    });

    syntacticPatterns.forEach(obj => {
      relatedObjects.push({
        id: obj.id,
        type: obj.type as LanguageObjectType,
        content: obj.content,
        irtDifficulty: obj.irtDifficulty,
        irtDiscrimination: obj.irtDiscrimination,
        relationshipType: 'syntactic_pattern',
      });
    });
  }

  // 3. Find collocations
  const collocations = await getCollocationsForWord(primaryObjectId, 3, 5);
  for (const coll of collocations.slice(0, 2)) {
    const collObj = await db.languageObject.findFirst({
      where: {
        goalId,
        content: coll.word,
        id: { not: primaryObjectId },
      },
    });

    if (collObj) {
      relatedObjects.push({
        id: collObj.id,
        type: collObj.type as LanguageObjectType,
        content: collObj.content,
        irtDifficulty: collObj.irtDifficulty,
        irtDiscrimination: collObj.irtDiscrimination,
        relationshipType: 'collocation',
      });
    }
  }

  // Limit to max target objects minus primary
  const maxSecondary = (config.maxTargetObjects ?? 4) - 1;
  return relatedObjects.slice(0, maxSecondary);
}

/**
 * Generate a multi-object task specification.
 *
 * Creates a task that targets multiple linguistic component objects
 * simultaneously, with Q-matrix weight allocation.
 */
export async function generateMultiObjectTask(
  primaryItem: LearningQueueItem,
  sessionId: string,
  goalId: string,
  config: MultiObjectTaskConfig = DEFAULT_MULTI_OBJECT_CONFIG
): Promise<{ task: GeneratedTask; multiObjectSpec: MultiObjectTaskSpec } | null> {
  const db = getPrisma();

  // Get primary object
  const primaryObject = await db.languageObject.findUnique({
    where: { id: primaryItem.objectId },
  });

  if (!primaryObject) return null;

  // Get mastery state
  const mastery = await getMasteryState(primaryItem.objectId);
  const stage = mastery?.stage ?? 0;
  const cueFreeAccuracy = mastery?.cueFreeAccuracy ?? 0;

  // Find related objects
  const relatedObjects = await findRelatedObjects(primaryItem.objectId, goalId, config);

  // Build z(w) vector for task matching
  const zVector = extractZVector({
    frequency: primaryObject.frequency ?? 0.5,
    relationalDensity: primaryObject.relationalDensity ?? 0.5,
    domainDistribution: typeof primaryObject.domainDistribution === 'string'
      ? JSON.parse(primaryObject.domainDistribution)
      : primaryObject.domainDistribution ?? {},
    morphologicalScore: primaryObject.morphologicalScore ?? 0.5,
    phonologicalDifficulty: primaryObject.phonologicalDifficulty ?? 0.5,
  });

  // Get task recommendation
  const wordProfile: WordProfile = {
    content: primaryObject.content,
    type: primaryObject.type as LanguageObjectType,
    zVector,
    masteryStage: stage as 0 | 1 | 2 | 3 | 4,
    cueFreeAccuracy,
    exposureCount: mastery?.exposureCount ?? 0,
  };
  const recommendation = recommendTask(wordProfile);

  // Map task type to format
  const taskTypeToFormat: Record<string, TaskFormat> = {
    recognition: 'mcq',
    recall_cued: 'fill_blank',
    recall_free: 'fill_blank',
    word_formation: 'fill_blank',
    collocation: 'matching',
    production: 'free_response',
    sentence_combining: 'free_response',
    register_shift: 'free_response',
    rapid_response: 'mcq',
    error_correction: 'fill_blank',
  };

  const format = taskTypeToFormat[recommendation.taskType] ?? selectTaskFormat(stage);
  const modality = config.preferredModality ?? (getOptimalModality(zVector) as TaskModality);

  // Build multi-object target list
  const allObjects = [
    {
      id: primaryObject.id,
      type: primaryObject.type as LanguageObjectType,
      content: primaryObject.content,
      irtDifficulty: primaryObject.irtDifficulty,
      irtDiscrimination: primaryObject.irtDiscrimination,
      isPrimary: true,
    },
    ...relatedObjects.map(obj => ({
      id: obj.id,
      type: obj.type,
      content: obj.content,
      irtDifficulty: obj.irtDifficulty,
      irtDiscrimination: obj.irtDiscrimination,
      isPrimary: false,
    })),
  ];

  // Determine fluency task
  const isFluencyTask = recommendation.taskType === 'rapid_response' ||
    shouldBeFluencyTask(stage, cueFreeAccuracy, config.fluencyRatio);

  // Generate expected answer based on task type
  let expectedAnswer = primaryObject.content;
  if (recommendation.taskType === 'sentence_writing' || recommendation.taskType === 'production') {
    // For production tasks, expected answer is more flexible
    expectedAnswer = `Use "${primaryObject.content}" in a sentence.`;
  }

  // Get goal domain
  const goalSpec = await db.goalSpec.findUnique({ where: { id: goalId } });
  const domain = goalSpec?.domain ?? 'general';

  // Create multi-object task spec
  const multiObjectSpec = createMultiObjectTaskSpec(
    `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    goalId,
    allObjects,
    recommendation.taskType as import('../../core/types').TaskType,
    format as import('../../core/types').TaskFormat,
    modality as import('../../core/types').TaskModality,
    domain,
    expectedAnswer,
    isFluencyTask
  );

  // Generate standard task content
  const cueLevel = determineCueLevel(
    cueFreeAccuracy,
    mastery?.cueAssistedAccuracy ?? 0,
    mastery?.exposureCount ?? 0,
    config.maxCueLevel
  );

  const hints = generateHints(primaryObject.content, cueLevel);
  const collocations = await getCollocationsForWord(primaryItem.objectId, 3, 5);
  const relatedWords = collocations.map(c => c.word);

  let prompt: string;
  let options: string[] | undefined;
  let context: string | undefined;

  const spec: TaskSpec = {
    objectId: primaryItem.objectId,
    content: primaryObject.content,
    type: primaryObject.type,
    format,
    modality,
    cueLevel,
    difficulty: multiObjectSpec.compositeDifficulty,
    isFluencyTask,
  };

  // Generate format-specific content
  switch (format) {
    case 'mcq':
      options = await generateMCQOptions(primaryItem.objectId, primaryObject.content);
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
      prompt = `Practice the word: ${primaryObject.content}`;
  }

  // Add multi-object context to prompt if multiple targets
  if (multiObjectSpec.targetObjects.length > 1) {
    const secondaryContents = multiObjectSpec.targetObjects
      .filter(t => !t.isPrimaryTarget)
      .map(t => t.content)
      .slice(0, 2);

    if (secondaryContents.length > 0) {
      prompt += `\n\nRelated concepts: ${secondaryContents.join(', ')}`;
    }
  }

  const task: GeneratedTask = {
    spec,
    prompt,
    expectedAnswer,
    options,
    hints: cueLevel > 0 ? hints : undefined,
    context,
    relatedWords: relatedWords.length > 0 ? relatedWords : undefined,
    metadata: {
      generatedAt: new Date(),
      source: 'template',
      estimatedTimeSeconds: isFluencyTask ? 10 : 30,
    },
  };

  return { task, multiObjectSpec };
}

/**
 * Determine if multi-object processing should be used for a task.
 *
 * Use multi-object processing when:
 * - Task type involves multiple components (production, sentence writing, etc.)
 * - Mastery stage >= 2 (controlled production)
 * - Related objects are available
 */
export function shouldUseMultiObjectTask(
  taskType: string,
  masteryStage: number,
  hasRelatedObjects: boolean
): boolean {
  // Task types that naturally involve multiple components
  const multiComponentTaskTypes = [
    'production',
    'sentence_writing',
    'sentence_combining',
    'register_shift',
    'error_correction',
    'translation',
  ];

  // Multi-object for advanced task types
  if (multiComponentTaskTypes.includes(taskType)) {
    return true;
  }

  // Multi-object for higher mastery stages with related objects
  if (masteryStage >= 2 && hasRelatedObjects) {
    return true;
  }

  return false;
}

/**
 * Enhanced task generation that automatically uses multi-object
 * processing when appropriate.
 */
export async function generateTaskWithAutoMultiObject(
  item: LearningQueueItem,
  sessionId: string,
  goalId: string,
  config: TaskGenerationConfig & MultiObjectTaskConfig = {}
): Promise<{
  task: GeneratedTask;
  multiObjectSpec?: MultiObjectTaskSpec;
  usedMultiObject: boolean;
}> {
  const db = getPrisma();

  // Get object and mastery
  const object = await db.languageObject.findUnique({
    where: { id: item.objectId },
  });

  if (!object) {
    throw new Error(`Language object not found: ${item.objectId}`);
  }

  const mastery = await getMasteryState(item.objectId);
  const stage = mastery?.stage ?? 0;

  // Find related objects to check availability
  const relatedObjects = await findRelatedObjects(item.objectId, goalId, config);

  // Get task recommendation for type check
  const zVector = extractZVector({
    frequency: object.frequency ?? 0.5,
    relationalDensity: object.relationalDensity ?? 0.5,
    domainDistribution: typeof object.domainDistribution === 'string'
      ? JSON.parse(object.domainDistribution)
      : object.domainDistribution ?? {},
    morphologicalScore: object.morphologicalScore ?? 0.5,
    phonologicalDifficulty: object.phonologicalDifficulty ?? 0.5,
  });

  const wordProfile: WordProfile = {
    content: object.content,
    type: object.type as LanguageObjectType,
    zVector,
    masteryStage: stage as 0 | 1 | 2 | 3 | 4,
    cueFreeAccuracy: mastery?.cueFreeAccuracy ?? 0,
    exposureCount: mastery?.exposureCount ?? 0,
  };
  const recommendation = recommendTask(wordProfile);

  // Check if we should use multi-object processing
  const useMultiObject = shouldUseMultiObjectTask(
    recommendation.taskType,
    stage,
    relatedObjects.length > 0
  );

  if (useMultiObject) {
    const result = await generateMultiObjectTask(item, sessionId, goalId, config);
    if (result) {
      return {
        task: result.task,
        multiObjectSpec: result.multiObjectSpec,
        usedMultiObject: true,
      };
    }
  }

  // Fall back to single-object task generation
  const task = await generateTaskWithMatching(item, config);

  return {
    task,
    usedMultiObject: false,
  };
}
