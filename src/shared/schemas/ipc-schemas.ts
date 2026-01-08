/**
 * IPC Request/Response Schemas
 *
 * Zod schemas for validating all IPC communication.
 * Ensures type safety at runtime between renderer and main process.
 */

import { z } from 'zod';

// =============================================================================
// Common Validators
// =============================================================================

/** UUID v4 format validator */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/** Positive integer validator */
export const positiveInt = z.number().int().positive();

/** Non-negative integer validator */
export const nonNegativeInt = z.number().int().min(0);

/** Percentage (0-100) validator */
export const percentageSchema = z.number().min(0).max(100);

/** Ratio (0-1) validator */
export const ratioSchema = z.number().min(0).max(1);

/** Non-empty string validator */
export const nonEmptyString = z.string().min(1, 'String cannot be empty');

// =============================================================================
// Learning IPC Schemas
// =============================================================================

/** queue:get request schema */
export const QueueGetSchema = z.object({
  goalId: uuidSchema,
  sessionSize: z.number().int().min(1).max(100).default(20),
  newItemRatio: ratioSchema.default(0.3),
});

/** object:create request schema */
export const ObjectCreateSchema = z.object({
  goalId: uuidSchema,
  content: nonEmptyString.max(1000),
  type: z.enum(['LEX', 'MORPH', 'G2P', 'SYNT', 'PRAG']),
  frequency: ratioSchema.optional(),
  relationalDensity: ratioSchema.optional(),
  contextualContribution: ratioSchema.optional(),
  irtDifficulty: z.number().min(-4).max(4).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** object:update request schema */
export const ObjectUpdateSchema = z.object({
  id: uuidSchema,
  content: nonEmptyString.max(1000).optional(),
  translation: z.string().max(1000).optional(),
  frequency: ratioSchema.optional(),
  relationalDensity: ratioSchema.optional(),
  contextualContribution: ratioSchema.optional(),
  irtDifficulty: z.number().min(-4).max(4).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  data => Object.keys(data).length > 1, // At least id + one field
  'At least one field must be provided for update'
);

/** object:list request schema */
export const ObjectListSchema = z.object({
  goalId: uuidSchema,
  type: z.enum(['LEX', 'MORPH', 'G2P', 'SYNT', 'PRAG']).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: nonNegativeInt.default(0),
});

/** object:import request schema */
export const ObjectImportSchema = z.object({
  goalId: uuidSchema,
  objects: z.array(z.object({
    content: nonEmptyString.max(1000),
    type: z.enum(['LEX', 'MORPH', 'G2P', 'SYNT', 'PRAG']),
    translation: z.string().max(1000).optional(),
    frequency: ratioSchema.optional(),
    relationalDensity: ratioSchema.optional(),
    contextualContribution: ratioSchema.optional(),
    irtDifficulty: z.number().min(-4).max(4).optional(),
  })).min(1).max(10000),
});

/** object:search request schema */
export const ObjectSearchSchema = z.object({
  goalId: uuidSchema,
  query: z.string().max(200).optional(),
  type: z.enum(['LEX', 'MORPH', 'G2P', 'SYNT', 'PRAG']).optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

// =============================================================================
// Session IPC Schemas
// =============================================================================

/** session:start request schema */
export const SessionStartSchema = z.object({
  goalId: uuidSchema,
  type: z.enum(['learning', 'review', 'assessment', 'mixed']).default('mixed'),
  targetDuration: z.number().int().min(60).max(7200).optional(), // 1 min to 2 hours
  mode: z.enum(['normal', 'fluency', 'review']).default('normal'),
});

/** session:end request schema */
export const SessionEndSchema = z.object({
  sessionId: uuidSchema,
});

/** session:recordResponse request schema */
export const RecordResponseSchema = z.object({
  sessionId: uuidSchema,
  objectId: uuidSchema,
  correct: z.boolean(),
  cueLevel: z.number().int().min(0).max(3),
  responseTimeMs: z.number().int().min(0).max(300000), // Max 5 minutes per response
  taskType: z.string().max(50),
  taskFormat: z.enum(['mcq', 'fill_blank', 'free_response', 'typing', 'morpheme_analysis', 'pronunciation', 'sentence_completion', 'register_selection']),
  modality: z.enum(['visual', 'auditory', 'mixed']),
  responseContent: z.string().max(5000),
  expectedContent: z.string().max(5000),
});

/** session:getSummary request schema */
export const SessionSummarySchema = z.object({
  sessionId: uuidSchema,
});

// =============================================================================
// Goal IPC Schemas
// =============================================================================

/** goal:create request schema */
export const GoalCreateSchema = z.object({
  name: nonEmptyString.max(200),
  targetLanguage: z.string().length(2).or(z.string().length(5)), // ISO 639-1 or locale
  nativeLanguage: z.string().length(2).or(z.string().length(5)),
  domain: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  modality: z.array(z.enum(['visual', 'auditory', 'kinesthetic'])).min(1).optional(),
  benchmark: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  deadline: z.string().datetime().optional(),
  dailyTime: z.number().int().min(5).max(480).optional(), // 5 min to 8 hours
});

/** goal:update request schema */
export const GoalUpdateSchema = z.object({
  id: uuidSchema,
  name: nonEmptyString.max(200).optional(),
  domain: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  benchmark: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  deadline: z.string().datetime().optional(),
  dailyTime: z.number().int().min(5).max(480).optional(),
  isActive: z.boolean().optional(),
});

// =============================================================================
// Onboarding IPC Schemas
// =============================================================================

/** onboarding:complete request schema */
export const OnboardingCompleteSchema = z.object({
  nativeLanguage: z.string().length(2).or(z.string().length(5)),
  targetLanguage: z.string().length(2).or(z.string().length(5)),
  domain: z.string().max(200),
  modality: z.array(z.enum(['visual', 'auditory', 'kinesthetic'])).min(1),
  purpose: z.string().max(500),
  benchmark: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  deadline: z.string().datetime().optional(),
  dailyTime: z.number().int().min(5).max(480),
});

// =============================================================================
// Claude IPC Schemas
// =============================================================================

/** claude:generateTask request schema */
export const ClaudeGenerateTaskSchema = z.object({
  objectId: uuidSchema,
  format: z.enum(['mcq', 'fill_blank', 'free_response', 'production']),
  difficulty: ratioSchema,
  context: z.string().max(2000).optional(),
});

/** claude:analyzeError request schema */
export const ClaudeAnalyzeErrorSchema = z.object({
  objectId: uuidSchema,
  userResponse: z.string().max(1000),
  expectedResponse: z.string().max(1000),
});

/** claude:getHint request schema */
export const ClaudeGetHintSchema = z.object({
  objectId: uuidSchema,
  level: z.number().int().min(1).max(3),
  previousHints: z.array(z.string().max(500)).max(3).optional(),
});

// =============================================================================
// Validation Helper
// =============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Validate input against a Zod schema.
 * Returns a normalized result object.
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error message - Zod uses 'issues' array
  const issues = result.error.issues || [];
  const errorMessages = issues.map(e => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });

  return {
    success: false,
    error: `Validation failed: ${errorMessages.join('; ')}`,
  };
}

// =============================================================================
// Type Exports
// =============================================================================

export type QueueGetRequest = z.infer<typeof QueueGetSchema>;
export type ObjectCreateRequest = z.infer<typeof ObjectCreateSchema>;
export type ObjectUpdateRequest = z.infer<typeof ObjectUpdateSchema>;
export type ObjectListRequest = z.infer<typeof ObjectListSchema>;
export type ObjectImportRequest = z.infer<typeof ObjectImportSchema>;
export type ObjectSearchRequest = z.infer<typeof ObjectSearchSchema>;
export type SessionStartRequest = z.infer<typeof SessionStartSchema>;
export type SessionEndRequest = z.infer<typeof SessionEndSchema>;
export type RecordResponseRequest = z.infer<typeof RecordResponseSchema>;
export type GoalCreateRequest = z.infer<typeof GoalCreateSchema>;
export type GoalUpdateRequest = z.infer<typeof GoalUpdateSchema>;
export type OnboardingCompleteRequest = z.infer<typeof OnboardingCompleteSchema>;
export type ClaudeGenerateTaskRequest = z.infer<typeof ClaudeGenerateTaskSchema>;
export type ClaudeAnalyzeErrorRequest = z.infer<typeof ClaudeAnalyzeErrorSchema>;
export type ClaudeGetHintRequest = z.infer<typeof ClaudeGetHintSchema>;
