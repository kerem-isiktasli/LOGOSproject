/**
 * Content Quality Validator
 *
 * Validates generated content against linguistic and pedagogical benchmarks.
 * Ensures content quality before presentation to learners.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.5
 */

import type { GeneratedContent, ContentSpec, ContentQualityTier } from './content-spec';
import type { ComponentType } from '../types';
import { PEDAGOGICAL_INTENTS } from './pedagogical-intent';

// =============================================================================
// Types
// =============================================================================

/**
 * Validation result with detailed feedback.
 */
export interface ValidationResult {
  /** Overall pass/fail */
  valid: boolean;

  /** Quality score (0-100) */
  score: number;

  /** Achieved quality tier */
  tier: ContentQualityTier;

  /** Individual check results */
  checks: ValidationCheck[];

  /** Suggestions for improvement */
  suggestions: string[];

  /** Validation timestamp */
  validatedAt: Date;
}

/**
 * Individual validation check.
 */
export interface ValidationCheck {
  /** Check name */
  name: string;

  /** Check category */
  category: ValidationCategory;

  /** Passed? */
  passed: boolean;

  /** Score for this check (0-100) */
  score: number;

  /** Weight in overall score */
  weight: number;

  /** Details/message */
  message: string;
}

export type ValidationCategory =
  | 'linguistic'
  | 'pedagogical'
  | 'technical'
  | 'safety';

/**
 * Validation configuration.
 */
export interface ValidatorConfig {
  /** Minimum overall score to pass */
  minScore: number;

  /** Minimum score per category */
  minCategoryScores: Partial<Record<ValidationCategory, number>>;

  /** Enable strict mode (all checks must pass) */
  strictMode: boolean;

  /** Language for linguistic checks */
  targetLanguage: string;

  /** Native language for interference checks */
  nativeLanguage?: string;
}

/**
 * Linguistic benchmark data.
 */
export interface LinguisticBenchmark {
  /** Vocabulary level ranges by CEFR */
  vocabularyLevels: Record<string, { min: number; max: number }>;

  /** Sentence complexity benchmarks */
  sentenceComplexity: {
    avgWordsPerSentence: { min: number; max: number };
    maxClausesPerSentence: number;
  };

  /** Readability targets by level */
  readability: Record<string, { min: number; max: number }>;
}

// =============================================================================
// Default Benchmarks
// =============================================================================

const DEFAULT_BENCHMARKS: LinguisticBenchmark = {
  vocabularyLevels: {
    A1: { min: 0, max: 500 },
    A2: { min: 0, max: 1000 },
    B1: { min: 0, max: 2000 },
    B2: { min: 0, max: 4000 },
    C1: { min: 0, max: 8000 },
    C2: { min: 0, max: 16000 },
  },
  sentenceComplexity: {
    avgWordsPerSentence: { min: 5, max: 25 },
    maxClausesPerSentence: 4,
  },
  readability: {
    A1: { min: 80, max: 100 },
    A2: { min: 70, max: 90 },
    B1: { min: 60, max: 80 },
    B2: { min: 50, max: 70 },
    C1: { min: 40, max: 60 },
    C2: { min: 30, max: 50 },
  },
};

// =============================================================================
// Content Validator Class
// =============================================================================

/**
 * Validates content quality and appropriateness.
 */
export class ContentQualityValidator {
  private config: ValidatorConfig;
  private benchmarks: LinguisticBenchmark;

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = {
      minScore: 70,
      minCategoryScores: {
        safety: 100, // Safety must always pass
        linguistic: 60,
        pedagogical: 60,
        technical: 50,
      },
      strictMode: false,
      targetLanguage: 'en',
      ...config,
    };
    this.benchmarks = DEFAULT_BENCHMARKS;
  }

  /**
   * Validate content against spec and benchmarks.
   */
  validate(content: GeneratedContent, spec: ContentSpec): ValidationResult {
    const checks: ValidationCheck[] = [];

    // Run all validation checks
    checks.push(...this.runLinguisticChecks(content, spec));
    checks.push(...this.runPedagogicalChecks(content, spec));
    checks.push(...this.runTechnicalChecks(content, spec));
    checks.push(...this.runSafetyChecks(content));

    // Calculate scores
    const categoryScores = this.calculateCategoryScores(checks);
    const overallScore = this.calculateOverallScore(checks);

    // Determine validity
    const valid = this.determineValidity(checks, categoryScores, overallScore);

    // Determine tier
    const tier = this.determineTier(overallScore, checks);

    // Generate suggestions
    const suggestions = this.generateSuggestions(checks);

    return {
      valid,
      score: overallScore,
      tier,
      checks,
      suggestions,
      validatedAt: new Date(),
    };
  }

  /**
   * Run linguistic validation checks.
   */
  private runLinguisticChecks(content: GeneratedContent, spec: ContentSpec): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    // Word count check
    const wordCount = content.metadata.wordCount;
    const wordCountValid =
      (!spec.constraints.minWords || wordCount >= spec.constraints.minWords) &&
      (!spec.constraints.maxWords || wordCount <= spec.constraints.maxWords);

    checks.push({
      name: 'word_count',
      category: 'linguistic',
      passed: wordCountValid,
      score: wordCountValid ? 100 : 50,
      weight: 0.15,
      message: wordCountValid
        ? `Word count (${wordCount}) within bounds`
        : `Word count (${wordCount}) outside bounds`,
    });

    // Sentence structure check
    const sentences = this.countSentences(content.content);
    const avgWordsPerSentence = wordCount / Math.max(1, sentences);
    const sentenceStructureValid =
      avgWordsPerSentence >= this.benchmarks.sentenceComplexity.avgWordsPerSentence.min &&
      avgWordsPerSentence <= this.benchmarks.sentenceComplexity.avgWordsPerSentence.max;

    checks.push({
      name: 'sentence_structure',
      category: 'linguistic',
      passed: sentenceStructureValid,
      score: sentenceStructureValid ? 100 : 60,
      weight: 0.1,
      message: `Average ${avgWordsPerSentence.toFixed(1)} words/sentence`,
    });

    // Grammar/spelling check (basic)
    const grammarScore = this.checkBasicGrammar(content.content);
    checks.push({
      name: 'grammar_spelling',
      category: 'linguistic',
      passed: grammarScore >= 80,
      score: grammarScore,
      weight: 0.2,
      message: grammarScore >= 80 ? 'Grammar appears correct' : 'Potential grammar issues',
    });

    // Vocabulary level check
    if (spec.constraints.vocabularyLevel) {
      const vocabScore = this.checkVocabularyLevel(
        content.content,
        spec.constraints.vocabularyLevel
      );
      checks.push({
        name: 'vocabulary_level',
        category: 'linguistic',
        passed: vocabScore >= 70,
        score: vocabScore,
        weight: 0.15,
        message: `Vocabulary appropriate for ${spec.constraints.vocabularyLevel}`,
      });
    }

    return checks;
  }

  /**
   * Run pedagogical validation checks.
   */
  private runPedagogicalChecks(content: GeneratedContent, spec: ContentSpec): ValidationCheck[] {
    const checks: ValidationCheck[] = [];
    const intentMeta = PEDAGOGICAL_INTENTS[spec.intent];

    // Intent alignment check
    const intentScore = this.checkIntentAlignment(content, spec);
    checks.push({
      name: 'intent_alignment',
      category: 'pedagogical',
      passed: intentScore >= 70,
      score: intentScore,
      weight: 0.2,
      message: intentScore >= 70 ? 'Content aligns with intent' : 'Content may not match intent',
    });

    // Has expected responses
    const hasResponses = content.expectedResponses && content.expectedResponses.length > 0;
    checks.push({
      name: 'has_expected_responses',
      category: 'pedagogical',
      passed: hasResponses,
      score: hasResponses ? 100 : 0,
      weight: 0.15,
      message: hasResponses ? 'Expected responses provided' : 'Missing expected responses',
    });

    // Has instructions
    const hasInstructions = !!content.instructions && content.instructions.length > 10;
    checks.push({
      name: 'has_instructions',
      category: 'pedagogical',
      passed: hasInstructions,
      score: hasInstructions ? 100 : 50,
      weight: 0.1,
      message: hasInstructions ? 'Instructions provided' : 'Missing or brief instructions',
    });

    // Cognitive load appropriate
    const cogLoadScore = this.checkCognitiveLoad(content, intentMeta.cognitiveLoad);
    checks.push({
      name: 'cognitive_load',
      category: 'pedagogical',
      passed: cogLoadScore >= 60,
      score: cogLoadScore,
      weight: 0.1,
      message: `Cognitive load: ${content.metadata.cognitiveLoad}/5`,
    });

    // Scaffolding appropriate
    if (intentMeta.scaffoldingLevel > 0 && spec.scaffolding.maxHints > 0) {
      const hasHints = !!(content.hints && content.hints.length > 0);
      checks.push({
        name: 'scaffolding_available',
        category: 'pedagogical',
        passed: hasHints,
        score: hasHints ? 100 : 40,
        weight: 0.1,
        message: hasHints ? 'Scaffolding hints available' : 'Missing scaffolding hints',
      });
    }

    return checks;
  }

  /**
   * Run technical validation checks.
   */
  private runTechnicalChecks(content: GeneratedContent, spec: ContentSpec): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    // Content not empty
    const hasContent = !!(content.content && content.content.trim().length > 0);
    checks.push({
      name: 'content_not_empty',
      category: 'technical',
      passed: hasContent,
      score: hasContent ? 100 : 0,
      weight: 0.2,
      message: hasContent ? 'Content provided' : 'Content is empty',
    });

    // Valid JSON structure (if applicable)
    const structureValid = this.validateStructure(content);
    checks.push({
      name: 'structure_valid',
      category: 'technical',
      passed: structureValid,
      score: structureValid ? 100 : 50,
      weight: 0.1,
      message: structureValid ? 'Structure valid' : 'Structure issues detected',
    });

    // Spec ID matches
    const specMatch = content.specId === spec.id;
    checks.push({
      name: 'spec_match',
      category: 'technical',
      passed: specMatch,
      score: specMatch ? 100 : 0,
      weight: 0.05,
      message: specMatch ? 'Spec ID matches' : 'Spec ID mismatch',
    });

    return checks;
  }

  /**
   * Run safety validation checks.
   */
  private runSafetyChecks(content: GeneratedContent): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    // No inappropriate content
    const safetyScore = this.checkContentSafety(content.content);
    checks.push({
      name: 'content_safety',
      category: 'safety',
      passed: safetyScore === 100,
      score: safetyScore,
      weight: 0.3,
      message: safetyScore === 100 ? 'Content is safe' : 'Potential safety concerns',
    });

    // No PII
    const piiCheck = this.checkForPII(content.content);
    checks.push({
      name: 'no_pii',
      category: 'safety',
      passed: piiCheck,
      score: piiCheck ? 100 : 0,
      weight: 0.2,
      message: piiCheck ? 'No PII detected' : 'Potential PII detected',
    });

    return checks;
  }

  /**
   * Calculate scores per category.
   */
  private calculateCategoryScores(checks: ValidationCheck[]): Record<ValidationCategory, number> {
    const categories: ValidationCategory[] = ['linguistic', 'pedagogical', 'technical', 'safety'];
    const scores: Record<ValidationCategory, number> = {} as any;

    for (const category of categories) {
      const categoryChecks = checks.filter(c => c.category === category);
      if (categoryChecks.length === 0) {
        scores[category] = 100;
        continue;
      }

      const totalWeight = categoryChecks.reduce((sum, c) => sum + c.weight, 0);
      const weightedSum = categoryChecks.reduce((sum, c) => sum + c.score * c.weight, 0);
      scores[category] = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    return scores;
  }

  /**
   * Calculate overall score.
   */
  private calculateOverallScore(checks: ValidationCheck[]): number {
    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = checks.reduce((sum, c) => sum + c.score * c.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Determine if content is valid.
   */
  private determineValidity(
    checks: ValidationCheck[],
    categoryScores: Record<ValidationCategory, number>,
    overallScore: number
  ): boolean {
    // Overall score must meet minimum
    if (overallScore < this.config.minScore) return false;

    // Category minimums must be met
    for (const [category, minScore] of Object.entries(this.config.minCategoryScores)) {
      if (categoryScores[category as ValidationCategory] < minScore) {
        return false;
      }
    }

    // In strict mode, all checks must pass
    if (this.config.strictMode) {
      return checks.every(c => c.passed);
    }

    return true;
  }

  /**
   * Determine quality tier from score.
   */
  private determineTier(score: number, checks: ValidationCheck[]): ContentQualityTier {
    // Safety failures always result in fallback tier
    const safetyChecks = checks.filter(c => c.category === 'safety');
    if (safetyChecks.some(c => !c.passed)) {
      return 'fallback';
    }

    if (score >= 90) return 'premium';
    if (score >= 70) return 'standard';
    return 'fallback';
  }

  /**
   * Generate improvement suggestions.
   */
  private generateSuggestions(checks: ValidationCheck[]): string[] {
    const suggestions: string[] = [];

    for (const check of checks) {
      if (!check.passed && check.score < 70) {
        switch (check.name) {
          case 'word_count':
            suggestions.push('Adjust content length to meet word count requirements');
            break;
          case 'sentence_structure':
            suggestions.push('Simplify sentence structure or break into shorter sentences');
            break;
          case 'grammar_spelling':
            suggestions.push('Review content for grammar and spelling errors');
            break;
          case 'vocabulary_level':
            suggestions.push('Adjust vocabulary to match target CEFR level');
            break;
          case 'intent_alignment':
            suggestions.push('Ensure content supports the pedagogical intent');
            break;
          case 'has_expected_responses':
            suggestions.push('Add expected responses for learner evaluation');
            break;
          case 'scaffolding_available':
            suggestions.push('Add hints or scaffolding for learner support');
            break;
          case 'content_safety':
            suggestions.push('Review content for inappropriate material');
            break;
        }
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private countSentences(text: string): number {
    return (text.match(/[.!?]+/g) || []).length || 1;
  }

  private checkBasicGrammar(text: string): number {
    // Simplified grammar check - in production, use a proper NLP library
    let score = 100;

    // Check for double spaces
    if (/\s{2,}/.test(text)) score -= 5;

    // Check for missing capitalization after period
    if (/\.\s+[a-z]/.test(text)) score -= 10;

    // Check for common errors
    if (/\bi\b/.test(text)) score -= 5; // lowercase 'I'

    return Math.max(0, score);
  }

  private checkVocabularyLevel(text: string, level: string): number {
    // Simplified vocabulary check - in production, use word frequency lists
    const words = text.toLowerCase().split(/\s+/);
    const avgLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;

    // Rough heuristic: longer average word length = higher level
    const levelComplexity: Record<string, number> = {
      A1: 4, A2: 5, B1: 6, B2: 7, C1: 8, C2: 9,
    };

    const targetComplexity = levelComplexity[level] || 6;
    const diff = Math.abs(avgLength - targetComplexity);

    if (diff <= 1) return 100;
    if (diff <= 2) return 80;
    if (diff <= 3) return 60;
    return 40;
  }

  private checkIntentAlignment(content: GeneratedContent, spec: ContentSpec): number {
    const intentMeta = PEDAGOGICAL_INTENTS[spec.intent];
    let score = 70; // Base score

    // Production intents should have production-oriented content
    if (intentMeta.requiresProduction) {
      if (content.instructions?.toLowerCase().includes('write') ||
          content.instructions?.toLowerCase().includes('produce') ||
          content.instructions?.toLowerCase().includes('create')) {
        score += 15;
      }
    }

    // Has expected responses
    if (content.expectedResponses.length > 0) {
      score += 10;
    }

    // Has explanation for learning
    if (content.explanation) {
      score += 5;
    }

    return Math.min(100, score);
  }

  private checkCognitiveLoad(content: GeneratedContent, targetLoad: number): number {
    const actualLoad = content.metadata.cognitiveLoad;
    const diff = Math.abs(actualLoad - targetLoad);

    if (diff === 0) return 100;
    if (diff === 1) return 80;
    if (diff === 2) return 60;
    return 40;
  }

  private validateStructure(content: GeneratedContent): boolean {
    // Check required fields exist
    return !!(
      content.id &&
      content.content &&
      content.expectedResponses &&
      content.metadata
    );
  }

  private checkContentSafety(text: string): number {
    // Simplified safety check - in production, use content moderation API
    const lowerText = text.toLowerCase();

    // Check for obvious inappropriate content patterns
    const unsafePatterns = [
      /\b(hate|kill|violence|explicit)\b/i,
      // Add more patterns as needed
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(lowerText)) {
        return 0;
      }
    }

    return 100;
  }

  private checkForPII(text: string): boolean {
    // Check for common PII patterns
    const piiPatterns = [
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // Names (basic)
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, // SSN pattern
    ];

    for (const pattern of piiPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ValidatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update benchmarks.
   */
  updateBenchmarks(benchmarks: Partial<LinguisticBenchmark>): void {
    this.benchmarks = { ...this.benchmarks, ...benchmarks };
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a content validator with default configuration.
 */
export function createContentValidator(config?: Partial<ValidatorConfig>): ContentQualityValidator {
  return new ContentQualityValidator(config);
}

/**
 * Quick validation helper.
 */
export function validateContent(
  content: GeneratedContent,
  spec: ContentSpec,
  config?: Partial<ValidatorConfig>
): ValidationResult {
  const validator = createContentValidator(config);
  return validator.validate(content, spec);
}
