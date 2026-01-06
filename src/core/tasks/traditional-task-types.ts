/**
 * Traditional Task Type Library
 *
 * Defines 30 traditional language learning task types organized by category.
 * Each task type includes metadata for cognitive processes, appropriate stages,
 * and generation parameters.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.6
 */

import type { ComponentType, TaskModality, MasteryStage } from '../types';
import type { PedagogicalIntent, LearningPhase } from '../content/pedagogical-intent';
import type { FeatureVector } from '../state/component-object-state';

// =============================================================================
// Types
// =============================================================================

/**
 * Task category classification.
 */
export type TaskCategory =
  | 'receptive'       // Understanding/comprehension
  | 'productive'      // Active production
  | 'transformative'  // Manipulation/conversion
  | 'fill_in'         // Gap completion
  | 'interactive'     // Dialogue/response
  | 'analytical';     // Error detection/analysis

/**
 * All 30 traditional task types.
 */
export type TraditionalTaskType =
  // RECEPTIVE (5)
  | 'reading_comprehension'
  | 'listening_comprehension'
  | 'inference_from_context'
  | 'main_idea_identification'
  | 'detail_extraction'
  // PRODUCTIVE (5)
  | 'essay_writing'
  | 'summary_writing'
  | 'dictation'
  | 'sentence_completion'
  | 'free_response'
  // TRANSFORMATIVE (7)
  | 'translation'
  | 'paraphrasing'
  | 'sentence_combining'
  | 'sentence_splitting'
  | 'register_shift'
  | 'voice_transformation'
  | 'tense_transformation'
  // FILL-IN (4)
  | 'cloze_deletion'
  | 'word_bank_fill'
  | 'constrained_fill'
  | 'multiple_blank'
  // INTERACTIVE (4)
  | 'dialogue_completion'
  | 'role_play_prompt'
  | 'question_answering'
  | 'debate_response'
  // ANALYTICAL (5)
  | 'error_correction'
  | 'grammar_identification'
  | 'word_formation_analysis'
  | 'collocation_judgment'
  | 'register_appropriateness';

/**
 * Cognitive process targeted by task.
 */
export type CognitiveProcess =
  | 'recognition'
  | 'recall'
  | 'comprehension'
  | 'application'
  | 'analysis'
  | 'synthesis'
  | 'evaluation'
  | 'automatization';

/**
 * Response format for tasks.
 */
export type ResponseFormat =
  | 'multiple_choice'
  | 'short_answer'
  | 'long_answer'
  | 'selection'
  | 'ordering'
  | 'matching'
  | 'drag_drop'
  | 'audio_recording'
  | 'typing';

/**
 * Metadata for a traditional task type.
 */
export interface TraditionalTaskTypeMeta {
  /** Task type identifier */
  type: TraditionalTaskType;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** Task category */
  category: TaskCategory;

  /** Cognitive processes engaged */
  cognitiveProcesses: CognitiveProcess[];

  /** Primary pedagogical intents */
  intents: PedagogicalIntent[];

  /** Appropriate mastery stages (min, max) */
  masteryRange: [MasteryStage, MasteryStage];

  /** Components primarily exercised */
  primaryComponents: ComponentType[];

  /** Supported modalities */
  modalities: TaskModality[];

  /** Response format */
  responseFormat: ResponseFormat;

  /** Typical difficulty (1-5) */
  baseDifficulty: number;

  /** Cognitive load (1-5) */
  cognitiveLoad: number;

  /** Time pressure recommended? */
  timePressure: boolean;

  /** Requires production? */
  requiresProduction: boolean;

  /** Scaffolding typically needed (0-3) */
  scaffoldingLevel: 0 | 1 | 2 | 3;

  /** Minimum word count for content */
  minWords?: number;

  /** Maximum word count for content */
  maxWords?: number;

  /** Distractors needed? */
  needsDistractors: boolean;

  /** Number of items typically in task */
  typicalItemCount: number;
}

// =============================================================================
// Task Type Definitions
// =============================================================================

/**
 * Complete library of 30 traditional task types.
 */
export const TRADITIONAL_TASK_TYPES: Record<TraditionalTaskType, TraditionalTaskTypeMeta> = {
  // =========================================================================
  // RECEPTIVE TASKS (5)
  // =========================================================================

  reading_comprehension: {
    type: 'reading_comprehension',
    name: 'Reading Comprehension',
    description: 'Read a passage and answer questions about its content',
    category: 'receptive',
    cognitiveProcesses: ['comprehension', 'analysis'],
    intents: ['test_comprehension', 'contextual_usage'],
    masteryRange: [1, 4],
    primaryComponents: ['lexical', 'syntactic', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'multiple_choice',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 1,
    minWords: 100,
    maxWords: 500,
    needsDistractors: true,
    typicalItemCount: 5,
  },

  listening_comprehension: {
    type: 'listening_comprehension',
    name: 'Listening Comprehension',
    description: 'Listen to audio and answer questions about the content',
    category: 'receptive',
    cognitiveProcesses: ['comprehension', 'recognition'],
    intents: ['test_comprehension'],
    masteryRange: [1, 4],
    primaryComponents: ['phonological', 'lexical', 'pragmatic'],
    modalities: ['audio'],
    responseFormat: 'multiple_choice',
    baseDifficulty: 3,
    cognitiveLoad: 4,
    timePressure: true,
    requiresProduction: false,
    scaffoldingLevel: 2,
    needsDistractors: true,
    typicalItemCount: 5,
  },

  inference_from_context: {
    type: 'inference_from_context',
    name: 'Inference from Context',
    description: 'Deduce word meaning or information from contextual clues',
    category: 'receptive',
    cognitiveProcesses: ['analysis', 'comprehension'],
    intents: ['test_comprehension', 'metalinguistic'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 1,
    minWords: 50,
    maxWords: 200,
    needsDistractors: false,
    typicalItemCount: 3,
  },

  main_idea_identification: {
    type: 'main_idea_identification',
    name: 'Main Idea Identification',
    description: 'Identify the central theme or main idea of a passage',
    category: 'receptive',
    cognitiveProcesses: ['comprehension', 'analysis'],
    intents: ['test_comprehension'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'syntactic', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'multiple_choice',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 1,
    minWords: 100,
    maxWords: 400,
    needsDistractors: true,
    typicalItemCount: 1,
  },

  detail_extraction: {
    type: 'detail_extraction',
    name: 'Detail Extraction',
    description: 'Find specific information within a text',
    category: 'receptive',
    cognitiveProcesses: ['recognition', 'comprehension'],
    intents: ['test_comprehension', 'reinforce_known'],
    masteryRange: [1, 3],
    primaryComponents: ['lexical'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 2,
    minWords: 50,
    maxWords: 300,
    needsDistractors: false,
    typicalItemCount: 4,
  },

  // =========================================================================
  // PRODUCTIVE TASKS (5)
  // =========================================================================

  essay_writing: {
    type: 'essay_writing',
    name: 'Essay Writing',
    description: 'Write an extended response on a given topic',
    category: 'productive',
    cognitiveProcesses: ['synthesis', 'application'],
    intents: ['elicit_production'],
    masteryRange: [3, 4],
    primaryComponents: ['lexical', 'syntactic', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 5,
    cognitiveLoad: 5,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    minWords: 150,
    maxWords: 500,
    needsDistractors: false,
    typicalItemCount: 1,
  },

  summary_writing: {
    type: 'summary_writing',
    name: 'Summary Writing',
    description: 'Condense a longer text into a brief summary',
    category: 'productive',
    cognitiveProcesses: ['comprehension', 'synthesis'],
    intents: ['elicit_production', 'test_comprehension'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    minWords: 50,
    maxWords: 150,
    needsDistractors: false,
    typicalItemCount: 1,
  },

  dictation: {
    type: 'dictation',
    name: 'Dictation',
    description: 'Write what you hear spoken',
    category: 'productive',
    cognitiveProcesses: ['recognition', 'application'],
    intents: ['elicit_production', 'fluency_building'],
    masteryRange: [1, 3],
    primaryComponents: ['phonological', 'morphological'],
    modalities: ['audio'],
    responseFormat: 'typing',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: true,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 5,
  },

  sentence_completion: {
    type: 'sentence_completion',
    name: 'Sentence Completion',
    description: 'Complete a sentence with appropriate words or phrases',
    category: 'productive',
    cognitiveProcesses: ['application', 'recall'],
    intents: ['elicit_production', 'reinforce_known'],
    masteryRange: [1, 3],
    primaryComponents: ['lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 5,
  },

  free_response: {
    type: 'free_response',
    name: 'Free Response',
    description: 'Open-ended question requiring original response',
    category: 'productive',
    cognitiveProcesses: ['synthesis', 'application'],
    intents: ['elicit_production'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'syntactic', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    minWords: 20,
    maxWords: 200,
    needsDistractors: false,
    typicalItemCount: 1,
  },

  // =========================================================================
  // TRANSFORMATIVE TASKS (7)
  // =========================================================================

  translation: {
    type: 'translation',
    name: 'Translation',
    description: 'Convert text from one language to another',
    category: 'transformative',
    cognitiveProcesses: ['comprehension', 'synthesis'],
    intents: ['elicit_production', 'test_comprehension'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'syntactic', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 3,
  },

  paraphrasing: {
    type: 'paraphrasing',
    name: 'Paraphrasing',
    description: 'Restate content using different words',
    category: 'transformative',
    cognitiveProcesses: ['comprehension', 'synthesis'],
    intents: ['elicit_production', 'transfer_testing'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 3,
  },

  sentence_combining: {
    type: 'sentence_combining',
    name: 'Sentence Combining',
    description: 'Merge multiple sentences into one complex sentence',
    category: 'transformative',
    cognitiveProcesses: ['application', 'synthesis'],
    intents: ['elicit_production', 'metalinguistic'],
    masteryRange: [2, 4],
    primaryComponents: ['syntactic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 4,
  },

  sentence_splitting: {
    type: 'sentence_splitting',
    name: 'Sentence Splitting',
    description: 'Break a complex sentence into simpler ones',
    category: 'transformative',
    cognitiveProcesses: ['analysis', 'application'],
    intents: ['metalinguistic', 'elicit_production'],
    masteryRange: [2, 4],
    primaryComponents: ['syntactic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 4,
  },

  register_shift: {
    type: 'register_shift',
    name: 'Register Shift',
    description: 'Rewrite text in a different formality level',
    category: 'transformative',
    cognitiveProcesses: ['analysis', 'synthesis'],
    intents: ['elicit_production', 'transfer_testing'],
    masteryRange: [3, 4],
    primaryComponents: ['pragmatic', 'lexical'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 3,
  },

  voice_transformation: {
    type: 'voice_transformation',
    name: 'Voice Transformation',
    description: 'Convert between active and passive voice',
    category: 'transformative',
    cognitiveProcesses: ['application', 'analysis'],
    intents: ['metalinguistic', 'elicit_production'],
    masteryRange: [2, 4],
    primaryComponents: ['syntactic'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 5,
  },

  tense_transformation: {
    type: 'tense_transformation',
    name: 'Tense Transformation',
    description: 'Change verb tenses in sentences',
    category: 'transformative',
    cognitiveProcesses: ['application'],
    intents: ['metalinguistic', 'reinforce_known'],
    masteryRange: [1, 3],
    primaryComponents: ['morphological', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 6,
  },

  // =========================================================================
  // FILL-IN TASKS (4)
  // =========================================================================

  cloze_deletion: {
    type: 'cloze_deletion',
    name: 'Cloze Deletion',
    description: 'Fill in blanks in a passage (every nth word removed)',
    category: 'fill_in',
    cognitiveProcesses: ['recall', 'comprehension'],
    intents: ['reinforce_known', 'test_comprehension'],
    masteryRange: [1, 3],
    primaryComponents: ['lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'typing',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    minWords: 50,
    maxWords: 200,
    needsDistractors: false,
    typicalItemCount: 10,
  },

  word_bank_fill: {
    type: 'word_bank_fill',
    name: 'Word Bank Fill',
    description: 'Fill blanks using words from a provided bank',
    category: 'fill_in',
    cognitiveProcesses: ['recognition', 'application'],
    intents: ['reinforce_known', 'introduce_new'],
    masteryRange: [0, 2],
    primaryComponents: ['lexical'],
    modalities: ['text'],
    responseFormat: 'drag_drop',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 3,
    needsDistractors: true,
    typicalItemCount: 8,
  },

  constrained_fill: {
    type: 'constrained_fill',
    name: 'Constrained Fill',
    description: 'Fill blank with word matching given constraints (first letter, etc.)',
    category: 'fill_in',
    cognitiveProcesses: ['recall', 'application'],
    intents: ['reinforce_known', 'fluency_building'],
    masteryRange: [1, 3],
    primaryComponents: ['lexical', 'morphological'],
    modalities: ['text'],
    responseFormat: 'typing',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 6,
  },

  multiple_blank: {
    type: 'multiple_blank',
    name: 'Multiple Blank',
    description: 'Fill multiple related blanks in a sentence or paragraph',
    category: 'fill_in',
    cognitiveProcesses: ['recall', 'comprehension'],
    intents: ['reinforce_known', 'test_comprehension'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'typing',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 4,
  },

  // =========================================================================
  // INTERACTIVE TASKS (4)
  // =========================================================================

  dialogue_completion: {
    type: 'dialogue_completion',
    name: 'Dialogue Completion',
    description: 'Complete a conversation with appropriate responses',
    category: 'interactive',
    cognitiveProcesses: ['application', 'synthesis'],
    intents: ['elicit_production', 'contextual_usage'],
    masteryRange: [2, 4],
    primaryComponents: ['pragmatic', 'lexical'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 4,
  },

  role_play_prompt: {
    type: 'role_play_prompt',
    name: 'Role Play Prompt',
    description: 'Respond to a scenario as a specific character/role',
    category: 'interactive',
    cognitiveProcesses: ['synthesis', 'application'],
    intents: ['elicit_production', 'contextual_usage'],
    masteryRange: [2, 4],
    primaryComponents: ['pragmatic', 'lexical', 'syntactic'],
    modalities: ['text', 'audio'],
    responseFormat: 'long_answer',
    baseDifficulty: 4,
    cognitiveLoad: 4,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 1,
  },

  question_answering: {
    type: 'question_answering',
    name: 'Question Answering',
    description: 'Answer questions about a given topic or text',
    category: 'interactive',
    cognitiveProcesses: ['comprehension', 'recall'],
    intents: ['test_comprehension', 'elicit_production'],
    masteryRange: [1, 4],
    primaryComponents: ['lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 5,
  },

  debate_response: {
    type: 'debate_response',
    name: 'Debate Response',
    description: 'Argue for or against a given position',
    category: 'interactive',
    cognitiveProcesses: ['synthesis', 'evaluation'],
    intents: ['elicit_production'],
    masteryRange: [3, 4],
    primaryComponents: ['pragmatic', 'lexical', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'long_answer',
    baseDifficulty: 5,
    cognitiveLoad: 5,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 0,
    minWords: 50,
    maxWords: 200,
    needsDistractors: false,
    typicalItemCount: 1,
  },

  // =========================================================================
  // ANALYTICAL TASKS (5)
  // =========================================================================

  error_correction: {
    type: 'error_correction',
    name: 'Error Correction',
    description: 'Find and correct errors in sentences',
    category: 'analytical',
    cognitiveProcesses: ['analysis', 'evaluation'],
    intents: ['error_detection', 'metalinguistic'],
    masteryRange: [2, 4],
    primaryComponents: ['morphological', 'syntactic'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: true,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 6,
  },

  grammar_identification: {
    type: 'grammar_identification',
    name: 'Grammar Identification',
    description: 'Identify grammatical structures or parts of speech',
    category: 'analytical',
    cognitiveProcesses: ['analysis', 'recognition'],
    intents: ['metalinguistic', 'test_comprehension'],
    masteryRange: [1, 4],
    primaryComponents: ['syntactic', 'morphological'],
    modalities: ['text'],
    responseFormat: 'selection',
    baseDifficulty: 2,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 8,
  },

  word_formation_analysis: {
    type: 'word_formation_analysis',
    name: 'Word Formation Analysis',
    description: 'Analyze morphological structure of words',
    category: 'analytical',
    cognitiveProcesses: ['analysis'],
    intents: ['metalinguistic', 'transfer_testing'],
    masteryRange: [2, 4],
    primaryComponents: ['morphological'],
    modalities: ['text'],
    responseFormat: 'short_answer',
    baseDifficulty: 3,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 2,
    needsDistractors: false,
    typicalItemCount: 5,
  },

  collocation_judgment: {
    type: 'collocation_judgment',
    name: 'Collocation Judgment',
    description: 'Judge whether word combinations are natural',
    category: 'analytical',
    cognitiveProcesses: ['evaluation', 'recognition'],
    intents: ['error_detection', 'reinforce_known'],
    masteryRange: [2, 4],
    primaryComponents: ['lexical', 'pragmatic'],
    modalities: ['text'],
    responseFormat: 'selection',
    baseDifficulty: 3,
    cognitiveLoad: 2,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 8,
  },

  register_appropriateness: {
    type: 'register_appropriateness',
    name: 'Register Appropriateness',
    description: 'Judge if language is appropriate for context',
    category: 'analytical',
    cognitiveProcesses: ['evaluation', 'analysis'],
    intents: ['error_detection', 'metalinguistic'],
    masteryRange: [2, 4],
    primaryComponents: ['pragmatic'],
    modalities: ['text'],
    responseFormat: 'selection',
    baseDifficulty: 4,
    cognitiveLoad: 3,
    timePressure: false,
    requiresProduction: false,
    scaffoldingLevel: 1,
    needsDistractors: false,
    typicalItemCount: 6,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all task types in a category.
 */
export function getTaskTypesByCategory(category: TaskCategory): TraditionalTaskType[] {
  return Object.values(TRADITIONAL_TASK_TYPES)
    .filter(meta => meta.category === category)
    .map(meta => meta.type);
}

/**
 * Get task types appropriate for a mastery stage.
 */
export function getTaskTypesForStage(stage: MasteryStage): TraditionalTaskType[] {
  return Object.values(TRADITIONAL_TASK_TYPES)
    .filter(meta => stage >= meta.masteryRange[0] && stage <= meta.masteryRange[1])
    .map(meta => meta.type);
}

/**
 * Get task types for a pedagogical intent.
 */
export function getTaskTypesForIntent(intent: PedagogicalIntent): TraditionalTaskType[] {
  return Object.values(TRADITIONAL_TASK_TYPES)
    .filter(meta => meta.intents.includes(intent))
    .map(meta => meta.type);
}

/**
 * Get task types that exercise a component.
 */
export function getTaskTypesForComponent(component: ComponentType): TraditionalTaskType[] {
  return Object.values(TRADITIONAL_TASK_TYPES)
    .filter(meta => meta.primaryComponents.includes(component))
    .map(meta => meta.type);
}

/**
 * Get task types requiring production.
 */
export function getProductiveTaskTypes(): TraditionalTaskType[] {
  return Object.values(TRADITIONAL_TASK_TYPES)
    .filter(meta => meta.requiresProduction)
    .map(meta => meta.type);
}

/**
 * Get task types not requiring production (receptive).
 */
export function getReceptiveTaskTypes(): TraditionalTaskType[] {
  return Object.values(TRADITIONAL_TASK_TYPES)
    .filter(meta => !meta.requiresProduction)
    .map(meta => meta.type);
}

/**
 * Calculate task suitability score for learner state.
 */
export function calculateTaskSuitability(
  taskType: TraditionalTaskType,
  masteryStage: MasteryStage,
  targetComponent: ComponentType,
  intent: PedagogicalIntent
): number {
  const meta = TRADITIONAL_TASK_TYPES[taskType];
  let score = 50; // Base score

  // Stage appropriateness (+/- 20)
  if (masteryStage >= meta.masteryRange[0] && masteryStage <= meta.masteryRange[1]) {
    score += 20;
  } else {
    score -= 20;
  }

  // Component match (+15)
  if (meta.primaryComponents.includes(targetComponent)) {
    score += 15;
  }

  // Intent match (+15)
  if (meta.intents.includes(intent)) {
    score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Select optimal task type for learner state.
 */
export function selectOptimalTaskType(
  masteryStage: MasteryStage,
  targetComponent: ComponentType,
  intent: PedagogicalIntent,
  recentTasks: TraditionalTaskType[] = []
): TraditionalTaskType {
  const candidates = getTaskTypesForStage(masteryStage);

  // Score all candidates
  const scored = candidates.map(type => ({
    type,
    score: calculateTaskSuitability(type, masteryStage, targetComponent, intent),
    recent: recentTasks.includes(type),
  }));

  // Sort by score, deprioritize recent
  scored.sort((a, b) => {
    if (a.recent !== b.recent) return a.recent ? 1 : -1;
    return b.score - a.score;
  });

  return scored[0]?.type || 'cloze_deletion'; // Default fallback
}

// =============================================================================
// z(w) Vector Task Selection (Gap 2.2)
// =============================================================================

/**
 * Task type recommendations based on z(w) feature vector.
 * From DEVELOPMENT-PROTOCOL.md:
 * - High M → Word family tasks
 * - High P → Dictation/G2P tasks
 * - High R → Collocation tasks
 * - Domain D → Context judgment tasks
 */
interface ZVectorTaskRecommendation {
  /** Primary recommended task types */
  primaryTasks: TraditionalTaskType[];
  /** Secondary task types */
  secondaryTasks: TraditionalTaskType[];
  /** Feature that drove the recommendation */
  driver: 'M' | 'P' | 'R' | 'D' | 'F' | 'balanced';
  /** Confidence in recommendation (0-1) */
  confidence: number;
}

/** Threshold for "high" feature values */
const HIGH_THRESHOLD = 0.7;
/** Threshold for "moderate" feature values */
const MODERATE_THRESHOLD = 0.4;

/**
 * Get task recommendations based on z(w) feature vector.
 * Implements Gap 2.2: z(w) vector matching.
 */
export function getTasksForFeatureVector(
  featureVector: FeatureVector,
  masteryStage: MasteryStage = 2
): ZVectorTaskRecommendation {
  const { F, R, D, M, P } = featureVector;

  // Determine dominant feature
  const features = [
    { key: 'M' as const, value: M },
    { key: 'P' as const, value: P },
    { key: 'R' as const, value: R },
    { key: 'F' as const, value: F },
  ];

  // Check domain distribution for specialized domains
  const domainKeys = Object.keys(D);
  const maxDomainValue = domainKeys.length > 0
    ? Math.max(...Object.values(D))
    : 0;
  const hasDominantDomain = maxDomainValue > HIGH_THRESHOLD;

  // Sort by value to find dominant feature
  const sorted = features.sort((a, b) => b.value - a.value);
  const dominant = sorted[0];

  // Task recommendations by feature
  const tasksByFeature: Record<'M' | 'P' | 'R' | 'D' | 'F' | 'balanced', TraditionalTaskType[]> = {
    // High M: Morphological tasks
    M: ['word_formation_analysis', 'sentence_completion', 'cloze_deletion'],
    // High P: Phonological tasks (dictation, listening)
    P: ['dictation', 'listening_comprehension', 'error_correction'],
    // High R: Relational tasks (collocations)
    R: ['collocation_judgment', 'sentence_combining', 'word_bank_fill'],
    // High D: Domain-specific context tasks
    D: ['register_appropriateness', 'inference_from_context', 'register_shift'],
    // High F: Fluency/automatization tasks
    F: ['free_response', 'summary_writing', 'dialogue_completion'],
    // Balanced: General tasks
    balanced: ['cloze_deletion', 'multiple_blank', 'question_answering'],
  };

  // Secondary tasks (always useful)
  const secondaryByStage: Record<number, TraditionalTaskType[]> = {
    0: ['detail_extraction', 'word_bank_fill'],
    1: ['multiple_blank', 'cloze_deletion'],
    2: ['sentence_completion', 'error_correction'],
    3: ['paraphrasing', 'translation'],
    4: ['essay_writing', 'debate_response'],
  };

  // Determine driver and confidence
  let driver: 'M' | 'P' | 'R' | 'D' | 'F' | 'balanced';
  let confidence: number;

  if (hasDominantDomain) {
    // Domain is dominant
    driver = 'D';
    confidence = maxDomainValue;
  } else if (dominant.value >= HIGH_THRESHOLD) {
    // Clear dominant feature
    driver = dominant.key;
    confidence = dominant.value;
  } else if (dominant.value >= MODERATE_THRESHOLD) {
    // Moderate dominant feature
    driver = dominant.key;
    confidence = dominant.value * 0.7; // Reduced confidence
  } else {
    // No clear dominant - balanced approach
    driver = 'balanced';
    confidence = 0.5;
  }

  // Filter tasks by mastery stage
  const stageFilter = (type: TraditionalTaskType): boolean => {
    const meta = TRADITIONAL_TASK_TYPES[type];
    return masteryStage >= meta.masteryRange[0] && masteryStage <= meta.masteryRange[1];
  };

  const primaryTasks = tasksByFeature[driver].filter(stageFilter);
  const secondaryTasks = (secondaryByStage[masteryStage] || secondaryByStage[2])
    .filter(stageFilter)
    .filter((t) => !primaryTasks.includes(t));

  return {
    primaryTasks: primaryTasks.length > 0 ? primaryTasks : tasksByFeature.balanced.filter(stageFilter),
    secondaryTasks,
    driver,
    confidence,
  };
}

/**
 * Select optimal task type using both traditional suitability scoring
 * AND z(w) feature vector matching.
 */
export function selectOptimalTaskTypeWithFeatureVector(
  masteryStage: MasteryStage,
  targetComponent: ComponentType,
  intent: PedagogicalIntent,
  featureVector: FeatureVector,
  recentTasks: TraditionalTaskType[] = []
): { taskType: TraditionalTaskType; source: 'feature' | 'suitability' | 'hybrid' } {
  // Get z(w) recommendations
  const featureRecommendation = getTasksForFeatureVector(featureVector, masteryStage);

  // Get traditional suitability candidates
  const suitabilityCandidates = getTaskTypesForStage(masteryStage);

  // If feature vector has high confidence, prioritize its recommendations
  if (featureRecommendation.confidence >= 0.7) {
    // Try primary tasks first
    for (const task of featureRecommendation.primaryTasks) {
      if (!recentTasks.includes(task)) {
        return { taskType: task, source: 'feature' };
      }
    }
    // Fall back to secondary tasks
    for (const task of featureRecommendation.secondaryTasks) {
      if (!recentTasks.includes(task)) {
        return { taskType: task, source: 'feature' };
      }
    }
  }

  // Hybrid approach: boost feature-recommended tasks in suitability scoring
  const scored = suitabilityCandidates.map((type) => {
    let score = calculateTaskSuitability(type, masteryStage, targetComponent, intent);

    // Boost if in feature recommendations
    if (featureRecommendation.primaryTasks.includes(type)) {
      score += 20 * featureRecommendation.confidence;
    } else if (featureRecommendation.secondaryTasks.includes(type)) {
      score += 10 * featureRecommendation.confidence;
    }

    return {
      type,
      score,
      recent: recentTasks.includes(type),
    };
  });

  // Sort by score, deprioritize recent
  scored.sort((a, b) => {
    if (a.recent !== b.recent) return a.recent ? 1 : -1;
    return b.score - a.score;
  });

  const selectedType = scored[0]?.type || 'cloze_deletion';
  const isFromFeature =
    featureRecommendation.primaryTasks.includes(selectedType) ||
    featureRecommendation.secondaryTasks.includes(selectedType);

  return {
    taskType: selectedType,
    source: isFromFeature && featureRecommendation.confidence >= 0.5 ? 'hybrid' : 'suitability',
  };
}
