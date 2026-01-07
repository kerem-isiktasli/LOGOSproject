/**
 * Multi-Layer Evaluation Service
 *
 * Implements object-specific evaluation with multiple scoring modes:
 * - Binary: Simple correct/incorrect
 * - Partial Credit: Multi-layer scoring with weighted criteria
 * - Range-based: Acceptable answer ranges with fuzzy matching
 * - Rubric-based: Complex holistic/analytic rubrics
 *
 * Academic foundations:
 * - Partial Credit Model (Masters, 1982) - polytomous IRT
 * - Generalized Partial Credit Model (Muraki, 1992)
 * - Many-Facet Rasch Measurement (Linacre, 1989) - for rubric scoring
 *
 * The evaluation results feed into theta updates via the
 * multi-object calibration service.
 */

import type {
  ComponentCode,
  EvaluationMode,
  EvaluationLayer,
  AnswerRange,
  ObjectEvaluationConfig,
  ObjectRubric,
  ComponentEvaluation,
  MultiComponentEvaluation,
  ObjectRole,
} from '../../core/types';
import { ROLE_CONFIGS } from '../../core/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Evaluation input for a single object.
 */
export interface ObjectEvaluationInput {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** User's response (relevant portion) */
  response: string;

  /** Expected answer(s) */
  expected: string[];

  /** Evaluation configuration */
  config: ObjectEvaluationConfig;

  /** Role in the task (affects scoring weight) */
  role: ObjectRole;

  /** Weight in the task */
  weight: number;

  /** Context for evaluation */
  context?: {
    taskType: string;
    domain: string;
    register?: string;
  };
}

/**
 * Evaluation result for a single object.
 */
export interface ObjectEvaluationResult {
  /** Object ID */
  objectId: string;

  /** Component type */
  componentType: ComponentCode;

  /** Overall score (0-1) */
  score: number;

  /** Whether considered "correct" (score >= threshold) */
  correct: boolean;

  /** Per-layer scores (for partial credit) */
  layerScores?: Array<{
    layerId: string;
    name: string;
    score: number;
    weight: number;
    feedback: string;
  }>;

  /** Match type (for range-based) */
  matchType?: 'exact' | 'variant' | 'partial' | 'none';

  /** Rubric scores (for rubric-based) */
  rubricScores?: Array<{
    criterionId: string;
    score: number;
    descriptor: string;
  }>;

  /** Feedback message */
  feedback: string;

  /** Correction suggestion */
  correction?: string;

  /** Error classification */
  errorType?: 'omission' | 'substitution' | 'addition' | 'ordering' | 'form' | 'usage';

  /** Confidence in evaluation (0-1) */
  confidence: number;
}

/**
 * Batch evaluation result.
 */
export interface BatchEvaluationResult {
  /** Per-object results */
  objectResults: ObjectEvaluationResult[];

  /** Aggregated evaluation */
  aggregated: MultiComponentEvaluation;

  /** Evaluation metadata */
  metadata: {
    totalObjects: number;
    evaluatedObjects: number;
    averageScore: number;
    averageConfidence: number;
  };
}

// =============================================================================
// Security Constants & Helpers
// =============================================================================

/** Maximum allowed response length to prevent DoS via long input strings */
const MAX_RESPONSE_LENGTH = 10000;

/** Maximum allowed regex pattern length to prevent ReDoS */
const MAX_PATTERN_LENGTH = 200;

/** Maximum input length for regex testing to prevent catastrophic backtracking */
const MAX_REGEX_INPUT_LENGTH = 1000;

/**
 * Safely test a regex pattern against input with protection against ReDoS.
 *
 * @param pattern - The regex pattern string
 * @param input - The input string to test
 * @returns true if matches, false if not, null if pattern is unsafe/invalid
 */
function safeRegexTest(pattern: string, input: string): boolean | null {
  // Validate pattern length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    console.warn(`[multi-layer-evaluation] Regex pattern too long (${pattern.length} > ${MAX_PATTERN_LENGTH}), skipping`);
    return null;
  }

  // Check for potentially dangerous patterns that could cause catastrophic backtracking
  // These patterns have nested quantifiers which can lead to exponential time complexity
  const dangerousPatterns = [
    /\([^)]*[+*][^)]*\)[+*]/,      // Quantifier after quantified group: (a+)+ or (a*)*
    /\([^)]*\|[^)]*\)[+*]/,        // Alternation with quantifier: (a|b)+
    /\.\*\.\*/,                     // Multiple greedy wildcards: .*.*
    /\([^)]*[+*]\){2,}/,           // Multiple quantified groups: (a+)(b+)(c+)
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      console.warn(`[multi-layer-evaluation] Potentially dangerous regex pattern detected, skipping: ${pattern}`);
      return null;
    }
  }

  try {
    const regex = new RegExp(pattern, 'i');

    // Truncate input if too long to prevent slow matching
    const safeInput = input.length > MAX_REGEX_INPUT_LENGTH
      ? input.slice(0, MAX_REGEX_INPUT_LENGTH)
      : input;

    return regex.test(safeInput);
  } catch {
    // Invalid regex syntax
    return null;
  }
}

// =============================================================================
// Main Evaluation Functions
// =============================================================================

/**
 * Evaluate a single object's response.
 *
 * @param input - Evaluation input containing response, expected answers, and config
 * @returns Evaluation result with score, correctness, and feedback
 */
export function evaluateObject(input: ObjectEvaluationInput): ObjectEvaluationResult {
  // Input validation: prevent DoS via excessively long responses
  if (input.response.length > MAX_RESPONSE_LENGTH) {
    return {
      objectId: input.objectId,
      componentType: input.componentType,
      score: 0,
      correct: false,
      feedback: 'Response exceeds maximum allowed length',
      confidence: 1.0,
    };
  }
  switch (input.config.evaluationMode) {
    case 'binary':
      return evaluateBinary(input);

    case 'partial_credit':
      return evaluatePartialCredit(input);

    case 'range_based':
      return evaluateRangeBased(input);

    case 'rubric_based':
      return evaluateRubricBased(input);

    default:
      // Default to binary if mode not specified
      return evaluateBinary(input);
  }
}

/**
 * Evaluate multiple objects in a task.
 */
export function evaluateBatch(
  inputs: ObjectEvaluationInput[],
  config: { strictness: 'lenient' | 'normal' | 'strict' }
): BatchEvaluationResult {
  // Evaluate each object
  const objectResults = inputs.map(input => evaluateObject(input));

  // Calculate weighted composite score
  const totalWeight = inputs.reduce((sum, i) => sum + i.weight, 0);
  const weightedScore = objectResults.reduce((sum, r, i) => {
    return sum + r.score * inputs[i].weight;
  }, 0) / (totalWeight || 1);

  // Determine overall correctness
  const correctThreshold = config.strictness === 'lenient' ? 0.5 :
                           config.strictness === 'strict' ? 0.8 : 0.6;
  const overallCorrect = weightedScore >= correctThreshold;

  // Build component evaluations for multi-component evaluation interface
  const componentEvaluations: ComponentEvaluation[] = objectResults.map((r, i) => ({
    objectId: r.objectId,
    componentType: r.componentType,
    correct: r.correct,
    partialCredit: r.score,
    errorType: r.errorType,
    feedback: r.feedback,
    correction: r.correction,
  }));

  // Generate aggregated feedback
  const feedback = generateAggregatedFeedback(objectResults, overallCorrect);

  return {
    objectResults,
    aggregated: {
      overallCorrect,
      compositeScore: weightedScore,
      componentEvaluations,
      feedback,
    },
    metadata: {
      totalObjects: inputs.length,
      evaluatedObjects: objectResults.length,
      averageScore: weightedScore,
      averageConfidence: objectResults.reduce((s, r) => s + r.confidence, 0) / objectResults.length,
    },
  };
}

// =============================================================================
// Binary Evaluation
// =============================================================================

/**
 * Simple correct/incorrect evaluation.
 */
function evaluateBinary(input: ObjectEvaluationInput): ObjectEvaluationResult {
  const response = normalizeText(input.response);
  const expectedNormalized = input.expected.map(normalizeText);

  // Check for exact match
  const isCorrect = expectedNormalized.some(exp => response === exp);

  // Check for case-insensitive match if not exact
  const isCaseInsensitiveMatch = !isCorrect &&
    expectedNormalized.some(exp => response.toLowerCase() === exp.toLowerCase());

  const score = isCorrect ? 1.0 : isCaseInsensitiveMatch ? 0.9 : 0;
  const correct = score >= 0.5;

  return {
    objectId: input.objectId,
    componentType: input.componentType,
    score,
    correct,
    feedback: correct
      ? 'Correct!'
      : `Expected: ${input.expected[0]}`,
    correction: correct ? undefined : input.expected[0],
    errorType: correct ? undefined : classifyError(response, input.expected[0]),
    confidence: 1.0,  // Binary evaluation has high confidence
  };
}

// =============================================================================
// Partial Credit Evaluation
// =============================================================================

/**
 * Multi-layer partial credit evaluation.
 * Based on Generalized Partial Credit Model (Muraki, 1992).
 */
function evaluatePartialCredit(input: ObjectEvaluationInput): ObjectEvaluationResult {
  const layers = input.config.layers || getDefaultLayers(input.componentType);
  const response = input.response;
  const expected = input.expected[0];

  const layerScores: ObjectEvaluationResult['layerScores'] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const layer of layers) {
    const layerResult = evaluateLayer(response, expected, layer, input);
    layerScores.push({
      layerId: layer.layerId,
      name: layer.name,
      score: layerResult.score,
      weight: layer.weight,
      feedback: layerResult.feedback,
    });

    totalWeightedScore += layerResult.score * layer.weight;
    totalWeight += layer.weight;
  }

  const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const correct = finalScore >= 0.6;

  // Find weakest layer for feedback focus
  const weakestLayer = layerScores.reduce((min, l) =>
    l.score < min.score ? l : min
  , layerScores[0]);

  return {
    objectId: input.objectId,
    componentType: input.componentType,
    score: finalScore,
    correct,
    layerScores,
    feedback: generateLayerFeedback(layerScores, correct),
    correction: correct ? undefined : expected,
    errorType: correct ? undefined : inferErrorTypeFromLayers(layerScores),
    confidence: 0.85,  // Partial credit has moderate confidence
  };
}

/**
 * Evaluate a single layer.
 */
function evaluateLayer(
  response: string,
  expected: string,
  layer: EvaluationLayer,
  input: ObjectEvaluationInput
): { score: number; feedback: string } {
  // Layer-specific evaluation logic
  switch (layer.layerId) {
    case 'form_accuracy':
      return evaluateFormAccuracy(response, expected);

    case 'spelling':
      return evaluateSpelling(response, expected);

    case 'contextual_appropriateness':
      return evaluateContextualAppropriateness(response, expected, input.context);

    case 'semantic_accuracy':
      return evaluateSemanticAccuracy(response, expected);

    case 'register_match':
      return evaluateRegisterMatch(response, input.context?.register);

    default:
      // Generic layer evaluation using levels
      return evaluateGenericLayer(response, expected, layer);
  }
}

/**
 * Evaluate form accuracy (morphological correctness).
 */
function evaluateFormAccuracy(
  response: string,
  expected: string
): { score: number; feedback: string } {
  const normalized = normalizeText(response);
  const normalizedExp = normalizeText(expected);

  if (normalized === normalizedExp) {
    return { score: 1.0, feedback: 'Form is correct' };
  }

  // Check for common form errors
  const distance = levenshteinDistance(normalized, normalizedExp);
  const maxLen = Math.max(normalized.length, normalizedExp.length);
  const similarity = 1 - (distance / maxLen);

  if (similarity >= 0.8) {
    return { score: 0.7, feedback: 'Minor form error' };
  } else if (similarity >= 0.5) {
    return { score: 0.4, feedback: 'Significant form error' };
  }

  return { score: 0, feedback: 'Incorrect form' };
}

/**
 * Evaluate spelling accuracy.
 */
function evaluateSpelling(
  response: string,
  expected: string
): { score: number; feedback: string } {
  const distance = levenshteinDistance(
    response.toLowerCase(),
    expected.toLowerCase()
  );

  if (distance === 0) {
    return { score: 1.0, feedback: 'Spelling correct' };
  } else if (distance === 1) {
    return { score: 0.8, feedback: 'One spelling error' };
  } else if (distance === 2) {
    return { score: 0.5, feedback: 'Two spelling errors' };
  }

  return { score: 0.2, feedback: 'Multiple spelling errors' };
}

/**
 * Evaluate contextual appropriateness.
 */
function evaluateContextualAppropriateness(
  response: string,
  expected: string,
  context?: { taskType: string; domain: string; register?: string }
): { score: number; feedback: string } {
  // Without semantic analysis, we use heuristics
  const normalized = normalizeText(response);
  const normalizedExp = normalizeText(expected);

  // Exact match is contextually appropriate
  if (normalized === normalizedExp) {
    return { score: 1.0, feedback: 'Contextually appropriate' };
  }

  // Check if response contains key terms from expected
  const expectedWords = normalizedExp.split(/\s+/);
  const responseWords = normalized.split(/\s+/);
  const overlap = expectedWords.filter(w => responseWords.includes(w)).length;
  const overlapRatio = overlap / expectedWords.length;

  if (overlapRatio >= 0.8) {
    return { score: 0.8, feedback: 'Mostly appropriate' };
  } else if (overlapRatio >= 0.5) {
    return { score: 0.5, feedback: 'Partially appropriate' };
  }

  return { score: 0.2, feedback: 'May not fit context' };
}

/**
 * Evaluate semantic accuracy.
 */
function evaluateSemanticAccuracy(
  response: string,
  expected: string
): { score: number; feedback: string } {
  // Without embeddings, use word overlap as proxy
  const responseWords = new Set(normalizeText(response).split(/\s+/));
  const expectedWords = new Set(normalizeText(expected).split(/\s+/));

  const intersection = [...responseWords].filter(w => expectedWords.has(w));
  const union = new Set([...responseWords, ...expectedWords]);

  const jaccard = intersection.length / union.size;

  if (jaccard >= 0.8) {
    return { score: 1.0, feedback: 'Semantically accurate' };
  } else if (jaccard >= 0.5) {
    return { score: 0.7, feedback: 'Partially captures meaning' };
  } else if (jaccard >= 0.2) {
    return { score: 0.4, feedback: 'Some relevant content' };
  }

  return { score: 0.1, feedback: 'Meaning unclear or incorrect' };
}

/**
 * Evaluate register match.
 */
function evaluateRegisterMatch(
  response: string,
  targetRegister?: string
): { score: number; feedback: string } {
  if (!targetRegister) {
    return { score: 0.8, feedback: 'Register not specified' };
  }

  // Simple heuristics for register detection
  const formalMarkers = ['therefore', 'consequently', 'furthermore', 'however'];
  const informalMarkers = ['gonna', 'wanna', 'kinda', 'yeah', 'ok'];

  const hasFormals = formalMarkers.some(m => response.toLowerCase().includes(m));
  const hasInformals = informalMarkers.some(m => response.toLowerCase().includes(m));

  if (targetRegister === 'formal') {
    if (hasInformals) return { score: 0.3, feedback: 'Too informal' };
    return { score: 0.9, feedback: 'Appropriate register' };
  } else if (targetRegister === 'informal') {
    if (hasFormals && !hasInformals) return { score: 0.5, feedback: 'Too formal' };
    return { score: 0.9, feedback: 'Appropriate register' };
  }

  return { score: 0.7, feedback: 'Register acceptable' };
}

/**
 * Generic layer evaluation using defined levels.
 */
function evaluateGenericLayer(
  response: string,
  expected: string,
  layer: EvaluationLayer
): { score: number; feedback: string } {
  // Simple similarity-based scoring mapped to levels
  const similarity = calculateSimilarity(response, expected);

  // Find matching level
  const sortedLevels = [...layer.levels].sort((a, b) => b.score - a.score);
  for (const level of sortedLevels) {
    if (similarity >= level.score) {
      return { score: level.score, feedback: level.description };
    }
  }

  return { score: 0, feedback: sortedLevels[sortedLevels.length - 1]?.description || 'Incorrect' };
}

// =============================================================================
// Range-Based Evaluation
// =============================================================================

/**
 * Evaluate against acceptable answer range.
 */
function evaluateRangeBased(input: ObjectEvaluationInput): ObjectEvaluationResult {
  const range = input.config.answerRange;
  if (!range) {
    // Fallback to binary if no range defined
    return evaluateBinary(input);
  }

  const response = normalizeText(input.response);

  // 1. Check exact matches
  if (range.exactMatches.some(m => normalizeText(m) === response)) {
    return {
      objectId: input.objectId,
      componentType: input.componentType,
      score: 1.0,
      correct: true,
      matchType: 'exact',
      feedback: 'Exact match!',
      confidence: 1.0,
    };
  }

  // 2. Check acceptable variants
  if (range.acceptableVariants.some(v => normalizeText(v) === response)) {
    return {
      objectId: input.objectId,
      componentType: input.componentType,
      score: 1.0,
      correct: true,
      matchType: 'variant',
      feedback: 'Acceptable answer',
      confidence: 0.95,
    };
  }

  // 3. Check partial credit patterns (with ReDoS protection)
  for (const pattern of range.partialCreditPatterns) {
    const matches = safeRegexTest(pattern.pattern, response);
    if (matches === true) {
      return {
        objectId: input.objectId,
        componentType: input.componentType,
        score: pattern.score,
        correct: pattern.score >= 0.5,
        matchType: 'partial',
        feedback: pattern.feedback,
        confidence: 0.8,
      };
    }
    // null (unsafe/invalid pattern) or false continues to next pattern
  }

  // 4. Semantic similarity check (if threshold defined)
  if (range.semanticThreshold) {
    const maxSimilarity = range.exactMatches.reduce((max, expected) => {
      const sim = calculateSimilarity(response, normalizeText(expected));
      return Math.max(max, sim);
    }, 0);

    if (maxSimilarity >= range.semanticThreshold) {
      return {
        objectId: input.objectId,
        componentType: input.componentType,
        score: maxSimilarity,
        correct: maxSimilarity >= 0.6,
        matchType: 'partial',
        feedback: `Similar to expected (${(maxSimilarity * 100).toFixed(0)}% match)`,
        confidence: 0.7,
      };
    }
  }

  // No match
  return {
    objectId: input.objectId,
    componentType: input.componentType,
    score: 0,
    correct: false,
    matchType: 'none',
    feedback: `Expected one of: ${range.exactMatches.slice(0, 2).join(', ')}...`,
    correction: range.exactMatches[0],
    errorType: classifyError(response, range.exactMatches[0]),
    confidence: 0.9,
  };
}

// =============================================================================
// Rubric-Based Evaluation
// =============================================================================

/**
 * Evaluate using complex rubric.
 * Based on Many-Facet Rasch Measurement (Linacre, 1989).
 */
function evaluateRubricBased(input: ObjectEvaluationInput): ObjectEvaluationResult {
  const rubric = input.config.rubric;
  if (!rubric) {
    return evaluateBinary(input);
  }

  const rubricScores: ObjectEvaluationResult['rubricScores'] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const criterion of rubric.criteria) {
    const criterionScore = evaluateCriterion(
      input.response,
      input.expected[0],
      criterion
    );

    rubricScores.push({
      criterionId: criterion.criterionId,
      score: criterionScore.score,
      descriptor: criterionScore.descriptor,
    });

    totalWeightedScore += criterionScore.score * criterion.weight;
    totalWeight += criterion.weight;
  }

  const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // Holistic adjustment if enabled
  let adjustedScore = finalScore;
  if (rubric.holisticOption?.enabled) {
    const holisticScore = evaluateHolistic(input.response, rubric.holisticOption.levels);
    // Blend analytic and holistic (70/30)
    adjustedScore = finalScore * 0.7 + holisticScore * 0.3;
  }

  const correct = adjustedScore >= 0.6;

  return {
    objectId: input.objectId,
    componentType: input.componentType,
    score: adjustedScore,
    correct,
    rubricScores,
    feedback: generateRubricFeedback(rubricScores, rubric.criteria),
    confidence: 0.75,  // Rubric evaluation has moderate confidence
  };
}

/**
 * Evaluate a single rubric criterion.
 */
function evaluateCriterion(
  response: string,
  expected: string,
  criterion: ObjectRubric['criteria'][0]
): { score: number; descriptor: string } {
  // Use similarity as proxy for criterion score
  const similarity = calculateSimilarity(response, expected);

  // Map to scoring guide
  const sortedGuide = [...criterion.scoringGuide].sort((a, b) => b.score - a.score);

  for (const level of sortedGuide) {
    if (similarity >= level.score) {
      return { score: level.score, descriptor: level.descriptor };
    }
  }

  const lowest = sortedGuide[sortedGuide.length - 1];
  return { score: lowest?.score || 0, descriptor: lowest?.descriptor || 'Below expectations' };
}

/**
 * Evaluate holistically.
 */
function evaluateHolistic(
  response: string,
  levels: Array<{ score: number; descriptor: string }>
): number {
  // Simple length and complexity heuristics
  const words = response.split(/\s+/).length;
  const sentences = response.split(/[.!?]+/).filter(s => s.trim()).length;

  // Assume longer, more complex responses score higher (simplified)
  const complexityScore = Math.min(1, (words / 20) * 0.5 + (sentences / 3) * 0.5);

  const sortedLevels = [...levels].sort((a, b) => b.score - a.score);
  for (const level of sortedLevels) {
    if (complexityScore >= level.score) {
      return level.score;
    }
  }

  return sortedLevels[sortedLevels.length - 1]?.score || 0;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize text for comparison.
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1).
 */
function calculateSimilarity(a: string, b: string): number {
  const normalA = normalizeText(a).toLowerCase();
  const normalB = normalizeText(b).toLowerCase();

  if (normalA === normalB) return 1.0;

  const distance = levenshteinDistance(normalA, normalB);
  const maxLen = Math.max(normalA.length, normalB.length);

  return maxLen > 0 ? 1 - (distance / maxLen) : 0;
}

/**
 * Classify error type.
 */
function classifyError(
  response: string,
  expected: string
): 'omission' | 'substitution' | 'addition' | 'ordering' | 'form' | 'usage' {
  const normalResponse = normalizeText(response).toLowerCase();
  const normalExpected = normalizeText(expected).toLowerCase();

  if (normalResponse.length === 0) return 'omission';
  if (normalResponse.length < normalExpected.length * 0.5) return 'omission';
  if (normalResponse.length > normalExpected.length * 1.5) return 'addition';

  // Check for ordering (anagram-like)
  const sortedResponse = normalResponse.split('').sort().join('');
  const sortedExpected = normalExpected.split('').sort().join('');
  if (sortedResponse === sortedExpected) return 'ordering';

  // Check for form error (similar but wrong inflection)
  const similarity = calculateSimilarity(normalResponse, normalExpected);
  if (similarity >= 0.7) return 'form';

  return 'substitution';
}

/**
 * Get default evaluation layers for a component type.
 */
function getDefaultLayers(componentType: ComponentCode): EvaluationLayer[] {
  switch (componentType) {
    case 'LEX':
      return [
        {
          layerId: 'spelling',
          name: 'Spelling',
          weight: 0.3,
          fullCreditCriteria: 'Correct spelling',
          levels: [
            { score: 1.0, description: 'Correct' },
            { score: 0.8, description: 'One error' },
            { score: 0.5, description: 'Two errors' },
            { score: 0, description: 'Multiple errors' },
          ],
        },
        {
          layerId: 'semantic_accuracy',
          name: 'Meaning',
          weight: 0.5,
          fullCreditCriteria: 'Correct meaning',
          levels: [
            { score: 1.0, description: 'Accurate' },
            { score: 0.7, description: 'Partially correct' },
            { score: 0.3, description: 'Related but incorrect' },
            { score: 0, description: 'Incorrect' },
          ],
        },
        {
          layerId: 'contextual_appropriateness',
          name: 'Context',
          weight: 0.2,
          fullCreditCriteria: 'Appropriate for context',
          levels: [
            { score: 1.0, description: 'Appropriate' },
            { score: 0.5, description: 'Acceptable' },
            { score: 0, description: 'Inappropriate' },
          ],
        },
      ];

    case 'MORPH':
      return [
        {
          layerId: 'form_accuracy',
          name: 'Form',
          weight: 0.6,
          fullCreditCriteria: 'Correct morphological form',
          levels: [
            { score: 1.0, description: 'Correct form' },
            { score: 0.7, description: 'Minor error' },
            { score: 0.3, description: 'Wrong form' },
            { score: 0, description: 'Unrecognizable' },
          ],
        },
        {
          layerId: 'spelling',
          name: 'Spelling',
          weight: 0.4,
          fullCreditCriteria: 'Correct spelling',
          levels: [
            { score: 1.0, description: 'Correct' },
            { score: 0.5, description: 'Spelling error' },
            { score: 0, description: 'Multiple errors' },
          ],
        },
      ];

    case 'SYNT':
      return [
        {
          layerId: 'structure',
          name: 'Structure',
          weight: 0.5,
          fullCreditCriteria: 'Correct syntactic structure',
          levels: [
            { score: 1.0, description: 'Correct structure' },
            { score: 0.6, description: 'Minor structure error' },
            { score: 0.3, description: 'Major structure error' },
            { score: 0, description: 'Incorrect structure' },
          ],
        },
        {
          layerId: 'agreement',
          name: 'Agreement',
          weight: 0.3,
          fullCreditCriteria: 'Correct agreement',
          levels: [
            { score: 1.0, description: 'Full agreement' },
            { score: 0.5, description: 'Some agreement errors' },
            { score: 0, description: 'No agreement' },
          ],
        },
        {
          layerId: 'word_order',
          name: 'Word Order',
          weight: 0.2,
          fullCreditCriteria: 'Correct word order',
          levels: [
            { score: 1.0, description: 'Correct order' },
            { score: 0.5, description: 'Minor order issue' },
            { score: 0, description: 'Incorrect order' },
          ],
        },
      ];

    case 'PRAG':
      return [
        {
          layerId: 'appropriateness',
          name: 'Appropriateness',
          weight: 0.4,
          fullCreditCriteria: 'Pragmatically appropriate',
          levels: [
            { score: 1.0, description: 'Fully appropriate' },
            { score: 0.7, description: 'Mostly appropriate' },
            { score: 0.4, description: 'Somewhat appropriate' },
            { score: 0, description: 'Inappropriate' },
          ],
        },
        {
          layerId: 'register_match',
          name: 'Register',
          weight: 0.3,
          fullCreditCriteria: 'Correct register',
          levels: [
            { score: 1.0, description: 'Correct register' },
            { score: 0.5, description: 'Acceptable register' },
            { score: 0, description: 'Wrong register' },
          ],
        },
        {
          layerId: 'politeness',
          name: 'Politeness',
          weight: 0.3,
          fullCreditCriteria: 'Appropriate politeness',
          levels: [
            { score: 1.0, description: 'Appropriate' },
            { score: 0.5, description: 'Acceptable' },
            { score: 0, description: 'Too direct/indirect' },
          ],
        },
      ];

    case 'PHON':
      return [
        {
          layerId: 'accuracy',
          name: 'Accuracy',
          weight: 0.7,
          fullCreditCriteria: 'Correct pronunciation pattern',
          levels: [
            { score: 1.0, description: 'Correct' },
            { score: 0.7, description: 'Minor deviation' },
            { score: 0.4, description: 'Noticeable error' },
            { score: 0, description: 'Incorrect' },
          ],
        },
        {
          layerId: 'intelligibility',
          name: 'Intelligibility',
          weight: 0.3,
          fullCreditCriteria: 'Intelligible',
          levels: [
            { score: 1.0, description: 'Clear' },
            { score: 0.5, description: 'Understandable' },
            { score: 0, description: 'Unclear' },
          ],
        },
      ];

    default:
      return [
        {
          layerId: 'accuracy',
          name: 'Accuracy',
          weight: 1.0,
          fullCreditCriteria: 'Correct',
          levels: [
            { score: 1.0, description: 'Correct' },
            { score: 0.5, description: 'Partial' },
            { score: 0, description: 'Incorrect' },
          ],
        },
      ];
  }
}

/**
 * Generate feedback from layer scores.
 */
function generateLayerFeedback(
  layerScores: NonNullable<ObjectEvaluationResult['layerScores']>,
  correct: boolean
): string {
  if (correct) {
    const perfectLayers = layerScores.filter(l => l.score === 1.0);
    if (perfectLayers.length === layerScores.length) {
      return 'Perfect!';
    }
    return `Good! ${perfectLayers.map(l => l.name).join(', ')} correct.`;
  }

  // Find areas needing improvement
  const weakLayers = layerScores
    .filter(l => l.score < 0.6)
    .sort((a, b) => a.score - b.score);

  if (weakLayers.length > 0) {
    return `Focus on: ${weakLayers.map(l => l.name).join(', ')}`;
  }

  return 'Almost there! Review your response.';
}

/**
 * Infer error type from layer scores.
 */
function inferErrorTypeFromLayers(
  layerScores: NonNullable<ObjectEvaluationResult['layerScores']>
): 'omission' | 'substitution' | 'addition' | 'ordering' | 'form' | 'usage' {
  const weakest = layerScores.reduce((min, l) =>
    l.score < min.score ? l : min
  , layerScores[0]);

  switch (weakest?.layerId) {
    case 'form_accuracy':
    case 'spelling':
      return 'form';
    case 'contextual_appropriateness':
    case 'register_match':
    case 'appropriateness':
      return 'usage';
    case 'word_order':
    case 'structure':
      return 'ordering';
    default:
      return 'substitution';
  }
}

/**
 * Generate rubric feedback.
 */
function generateRubricFeedback(
  scores: NonNullable<ObjectEvaluationResult['rubricScores']>,
  criteria: ObjectRubric['criteria']
): string {
  const avgScore = scores.reduce((s, r) => s + r.score, 0) / scores.length;

  if (avgScore >= 0.9) return 'Excellent work!';
  if (avgScore >= 0.7) return 'Good work with minor areas for improvement.';
  if (avgScore >= 0.5) return 'Acceptable but needs improvement.';

  // Find lowest scoring criterion
  const lowest = scores.reduce((min, s) => s.score < min.score ? s : min, scores[0]);
  const criterion = criteria.find(c => c.criterionId === lowest.criterionId);

  return `Focus on improving: ${criterion?.name || 'identified areas'}`;
}

/**
 * Generate aggregated feedback for batch evaluation.
 */
function generateAggregatedFeedback(
  results: ObjectEvaluationResult[],
  overallCorrect: boolean
): string {
  if (overallCorrect) {
    const perfectCount = results.filter(r => r.score === 1.0).length;
    if (perfectCount === results.length) {
      return 'All correct! Excellent work!';
    }
    return `Good job! ${perfectCount}/${results.length} perfect.`;
  }

  const incorrectItems = results.filter(r => !r.correct);
  if (incorrectItems.length === 1) {
    return `Almost! Check: ${incorrectItems[0].feedback}`;
  }

  return `Review ${incorrectItems.length} items that need attention.`;
}

// =============================================================================
// Integration with Theta Updates
// =============================================================================

/**
 * Convert evaluation result to theta contribution input.
 * This bridges evaluation to the multi-object calibration service.
 */
export function evaluationToThetaInput(
  result: ObjectEvaluationResult,
  role: ObjectRole,
  weight: number
): {
  objectId: string;
  componentType: ComponentCode;
  score: number;
  roleAdjustedScore: number;
  effectiveWeight: number;
} {
  const roleConfig = ROLE_CONFIGS[role];

  return {
    objectId: result.objectId,
    componentType: result.componentType,
    score: result.score,
    roleAdjustedScore: result.score * roleConfig.thetaMultiplier,
    effectiveWeight: weight * roleConfig.thetaMultiplier,
  };
}
