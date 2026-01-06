/**
 * Content Generator
 *
 * Generates learning content based on ContentSpec.
 * Implements fallback chain: cached → template → AI-generated.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.5
 */

import type {
  ContentSpec,
  GeneratedContent,
  ContentSourceType,
  ContentQualityTier,
  ContentMetadata,
} from './content-spec';
import type { LanguageObject, TaskType } from '../types';
import { PEDAGOGICAL_INTENTS } from './pedagogical-intent';

// =============================================================================
// Types
// =============================================================================

/**
 * Generator configuration.
 */
export interface GeneratorConfig {
  /** Claude API key */
  claudeApiKey?: string;

  /** Enable AI generation */
  enableAI: boolean;

  /** Cache TTL (hours) */
  cacheTTL: number;

  /** Max retries for AI */
  maxRetries: number;

  /** Default timeout (ms) */
  defaultTimeout: number;
}

/**
 * Cache interface for content storage.
 */
export interface ContentCache {
  get(key: string): Promise<GeneratedContent | null>;
  set(key: string, content: GeneratedContent, ttlHours?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Template for content generation.
 */
export interface ContentTemplate {
  /** Template ID */
  id: string;

  /** Task type this template supports */
  taskType: TaskType;

  /** Template pattern with placeholders */
  pattern: string;

  /** Instructions template */
  instructionsPattern: string;

  /** Placeholder definitions */
  placeholders: Record<string, PlaceholderDef>;

  /** Quality tier this produces */
  qualityTier: ContentQualityTier;
}

interface PlaceholderDef {
  type: 'object_content' | 'object_translation' | 'context' | 'distractor' | 'blank';
  transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'mask';
}

/**
 * Generation result with metadata.
 */
export interface GenerationResult {
  success: boolean;
  content?: GeneratedContent;
  error?: string;
  source: ContentSourceType;
  durationMs: number;
}

// =============================================================================
// Content Generator Class
// =============================================================================

/**
 * Main content generator with fallback chain.
 */
export class ContentGenerator {
  private config: GeneratorConfig;
  private cache: ContentCache | null;
  private templates: Map<TaskType, ContentTemplate[]>;

  constructor(config: Partial<GeneratorConfig> = {}, cache?: ContentCache) {
    this.config = {
      enableAI: true,
      cacheTTL: 24,
      maxRetries: 2,
      defaultTimeout: 5000,
      ...config,
    };
    this.cache = cache || null;
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Generate content for a specification.
   * Follows fallback chain: cached → template → AI.
   */
  async generate(spec: ContentSpec): Promise<GenerationResult> {
    const startTime = Date.now();

    // Try cache first
    if (this.cache) {
      const cached = await this.tryCache(spec);
      if (cached) {
        return {
          success: true,
          content: cached,
          source: 'cached',
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Try template generation
    const templateResult = await this.tryTemplate(spec);
    if (templateResult.success && templateResult.content) {
      // Cache the result
      if (this.cache) {
        await this.cacheContent(spec, templateResult.content);
      }
      return {
        ...templateResult,
        durationMs: Date.now() - startTime,
      };
    }

    // Try AI generation
    if (this.config.enableAI && spec.constraints.allowAI !== false) {
      const aiResult = await this.tryAI(spec);
      if (aiResult.success && aiResult.content) {
        // Cache the result
        if (this.cache) {
          await this.cacheContent(spec, aiResult.content);
        }
        return {
          ...aiResult,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // All sources failed - return fallback content
    const fallback = this.generateFallback(spec);
    return {
      success: true,
      content: fallback,
      source: 'template',
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Try to get content from cache.
   */
  private async tryCache(spec: ContentSpec): Promise<GeneratedContent | null> {
    if (!this.cache) return null;

    const cacheKey = this.generateCacheKey(spec);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      // Check age if maxCacheAge specified
      if (spec.quality.maxCacheAge) {
        const age = (Date.now() - cached.generatedAt.getTime()) / (1000 * 60 * 60);
        if (age > spec.quality.maxCacheAge) {
          return null;
        }
      }
      return { ...cached, metadata: { ...cached.metadata, cacheHit: true } };
    }

    return null;
  }

  /**
   * Try template-based generation.
   */
  private async tryTemplate(spec: ContentSpec): Promise<GenerationResult> {
    const templates = this.templates.get(spec.taskType);
    if (!templates || templates.length === 0) {
      return { success: false, error: 'No template available', source: 'template', durationMs: 0 };
    }

    // Select best template
    const template = this.selectTemplate(templates, spec);
    if (!template) {
      return { success: false, error: 'No suitable template', source: 'template', durationMs: 0 };
    }

    try {
      const content = this.applyTemplate(template, spec);
      return { success: true, content, source: 'template', durationMs: 0 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Template error',
        source: 'template',
        durationMs: 0,
      };
    }
  }

  /**
   * Try AI-based generation (Claude API).
   */
  private async tryAI(spec: ContentSpec): Promise<GenerationResult> {
    if (!this.config.claudeApiKey) {
      return { success: false, error: 'No API key configured', source: 'ai_generated', durationMs: 0 };
    }

    const prompt = this.buildAIPrompt(spec);
    const timeout = spec.constraints.timeoutMs || this.config.defaultTimeout;

    // This would call the Claude API - simplified for now
    // In production, this would use the ClaudeService
    try {
      const response = await this.callClaudeAPI(prompt, timeout);
      const content = this.parseAIResponse(response, spec);
      return { success: true, content, source: 'ai_generated', durationMs: 0 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI generation failed',
        source: 'ai_generated',
        durationMs: 0,
      };
    }
  }

  /**
   * Build prompt for Claude API.
   */
  private buildAIPrompt(spec: ContentSpec): string {
    const objects = spec.targetObjects;
    const intentMeta = PEDAGOGICAL_INTENTS[spec.intent];

    const prompt = `Generate a ${spec.taskType} task for language learning.

TARGET VOCABULARY:
${objects.map(o => `- "${o.content}" (${o.translation || 'no translation'})`).join('\n')}

PEDAGOGICAL INTENT: ${spec.intent}
- ${intentMeta.description}
- Learning phase: ${spec.phase}
- Requires production: ${intentMeta.requiresProduction}

CONTEXT:
- Domain: ${spec.context.domains.join(', ')}
- Register: ${spec.context.register}
- Genre: ${spec.context.genre}

CONSTRAINTS:
- Max words: ${spec.constraints.maxWords || 'no limit'}
- Min words: ${spec.constraints.minWords || 'no minimum'}
- Vocabulary level: ${spec.constraints.vocabularyLevel || 'B1'}
${spec.constraints.mustInclude ? `- Must include: ${spec.constraints.mustInclude.join(', ')}` : ''}
${spec.constraints.excludeWords ? `- Exclude: ${spec.constraints.excludeWords.join(', ')}` : ''}

Return JSON with:
{
  "content": "the main content/question",
  "instructions": "instructions for the learner",
  "expectedResponses": ["acceptable answer(s)"],
  "distractors": ["wrong options if MCQ"],
  "hints": ["progressive hints"],
  "explanation": "why the answer is correct"
}`;

    return prompt;
  }

  /**
   * Call Claude API via IPC to main process.
   * Uses the ClaudeService exposed through window.logos.
   */
  private async callClaudeAPI(prompt: string, timeout: number): Promise<string> {
    // Check if we're in renderer context with logos API available
    if (typeof window !== 'undefined' && (window as any).logos?.claude) {
      try {
        const result = await Promise.race([
          (window as any).logos.claude.generateContent('exercise', prompt, prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI generation timeout')), timeout)
          ),
        ]);

        // Extract the content from the response
        if (result && typeof result === 'object' && 'content' in result) {
          return result.content;
        }
        return JSON.stringify(result);
      } catch (err) {
        throw new Error(
          `AI generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    // If not in renderer or API not available, throw to trigger template fallback
    throw new Error('Claude API not available - use template fallback');
  }

  /**
   * Parse AI response into GeneratedContent.
   */
  private parseAIResponse(response: string, spec: ContentSpec): GeneratedContent {
    const parsed = JSON.parse(response);

    return {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      specId: spec.id,
      source: 'ai_generated',
      qualityTier: 'premium',
      content: parsed.content,
      instructions: parsed.instructions,
      expectedResponses: parsed.expectedResponses || [],
      distractors: parsed.distractors,
      hints: parsed.hints,
      explanation: parsed.explanation,
      metadata: this.calculateMetadata(parsed.content, spec, 'ai_generated'),
      generatedAt: new Date(),
      validated: false,
    };
  }

  /**
   * Generate fallback content when all else fails.
   */
  private generateFallback(spec: ContentSpec): GeneratedContent {
    const object = spec.targetObjects[0];

    // Simple fallback based on task type
    let content: string;
    let expectedResponses: string[];
    let instructions: string;

    switch (spec.taskType) {
      case 'fill_blank':
        content = `Complete the blank: The ___ is important.`;
        expectedResponses = [object.content];
        instructions = `Fill in the blank with the correct word.`;
        break;
      case 'definition_match':
        content = object.translation || object.content;
        expectedResponses = [object.content];
        instructions = `What word matches this definition?`;
        break;
      case 'translation':
        content = object.content;
        expectedResponses = [object.translation || object.content];
        instructions = `Translate this word.`;
        break;
      default:
        content = `Practice: ${object.content}`;
        expectedResponses = [object.content];
        instructions = `Review this item.`;
    }

    return {
      id: `fallback_${Date.now()}`,
      specId: spec.id,
      source: 'template',
      qualityTier: 'fallback',
      content,
      instructions,
      expectedResponses,
      hints: [object.translation || '', object.content.charAt(0) + '...'],
      metadata: this.calculateMetadata(content, spec, 'template'),
      generatedAt: new Date(),
      validated: false,
    };
  }

  /**
   * Calculate content metadata.
   */
  private calculateMetadata(
    content: string,
    spec: ContentSpec,
    source: ContentSourceType
  ): ContentMetadata {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const intentMeta = PEDAGOGICAL_INTENTS[spec.intent];

    return {
      wordCount: words.length,
      estimatedDifficulty: (spec.difficulty.minDifficulty + spec.difficulty.maxDifficulty) / 2,
      cognitiveLoad: intentMeta.cognitiveLoad,
      estimatedTime: Math.max(10, words.length * 2),
      components: spec.constraints.componentFocus ? [spec.constraints.componentFocus] : [],
      generationTimeMs: 0,
      cacheHit: false,
    };
  }

  /**
   * Generate cache key from spec.
   */
  private generateCacheKey(spec: ContentSpec): string {
    const objectIds = spec.targetObjects.map(o => o.id).sort().join('_');
    return `content_${spec.taskType}_${spec.intent}_${objectIds}`;
  }

  /**
   * Cache generated content.
   */
  private async cacheContent(spec: ContentSpec, content: GeneratedContent): Promise<void> {
    if (!this.cache) return;
    const key = this.generateCacheKey(spec);
    await this.cache.set(key, content, this.config.cacheTTL);
  }

  /**
   * Select best template for spec.
   */
  private selectTemplate(templates: ContentTemplate[], spec: ContentSpec): ContentTemplate | null {
    // Sort by quality tier preference
    const tierOrder: ContentQualityTier[] = ['premium', 'standard', 'fallback'];
    const minTierIndex = tierOrder.indexOf(spec.quality.minimumTier);

    const eligible = templates.filter(t => {
      const tierIndex = tierOrder.indexOf(t.qualityTier);
      return tierIndex <= minTierIndex;
    });

    if (eligible.length === 0) {
      return templates[0]; // Return any template if none meet quality requirement
    }

    // Return highest quality eligible template
    return eligible.sort((a, b) =>
      tierOrder.indexOf(a.qualityTier) - tierOrder.indexOf(b.qualityTier)
    )[0];
  }

  /**
   * Apply template to generate content.
   */
  private applyTemplate(template: ContentTemplate, spec: ContentSpec): GeneratedContent {
    const object = spec.targetObjects[0];
    let content = template.pattern;
    let instructions = template.instructionsPattern;

    // Replace placeholders
    for (const [key, def] of Object.entries(template.placeholders)) {
      let value: string;

      switch (def.type) {
        case 'object_content':
          value = object.content;
          break;
        case 'object_translation':
          value = object.translation || object.content;
          break;
        case 'blank':
          value = '_____';
          break;
        case 'context':
          value = spec.context.domains[0] || 'general';
          break;
        default:
          value = '';
      }

      // Apply transform
      if (def.transform) {
        switch (def.transform) {
          case 'uppercase':
            value = value.toUpperCase();
            break;
          case 'lowercase':
            value = value.toLowerCase();
            break;
          case 'capitalize':
            value = value.charAt(0).toUpperCase() + value.slice(1);
            break;
          case 'mask':
            value = value.charAt(0) + '_'.repeat(value.length - 1);
            break;
        }
      }

      content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      instructions = instructions.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      specId: spec.id,
      source: 'template',
      qualityTier: template.qualityTier,
      content,
      instructions,
      expectedResponses: [object.content],
      hints: this.generateHints(object, spec),
      metadata: this.calculateMetadata(content, spec, 'template'),
      generatedAt: new Date(),
      validated: false,
    };
  }

  /**
   * Generate progressive hints.
   */
  private generateHints(object: LanguageObject, spec: ContentSpec): string[] {
    const hints: string[] = [];

    if (spec.scaffolding.availableCues.includes('translation') && object.translation) {
      hints.push(`Meaning: ${object.translation}`);
    }

    if (spec.scaffolding.availableCues.includes('first_letter')) {
      hints.push(`Starts with: ${object.content.charAt(0).toUpperCase()}`);
    }

    if (spec.scaffolding.availableCues.includes('word_length')) {
      hints.push(`${object.content.length} letters`);
    }

    return hints.slice(0, spec.scaffolding.maxHints);
  }

  /**
   * Initialize built-in templates.
   */
  private initializeTemplates(): void {
    // Recognition templates (MCQ)
    this.templates.set('recognition', [
      {
        id: 'recognition_meaning',
        taskType: 'recognition',
        pattern: 'What is the meaning of "{content}"?',
        instructionsPattern: 'Select the correct definition.',
        placeholders: {
          content: { type: 'object_content' },
        },
        qualityTier: 'standard',
      },
      {
        id: 'recognition_word',
        taskType: 'recognition',
        pattern: 'Which word means "{translation}"?',
        instructionsPattern: 'Choose the correct word.',
        placeholders: {
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
    ]);

    // Recall with cues templates
    this.templates.set('recall_cued', [
      {
        id: 'recall_cued_first_letter',
        taskType: 'recall_cued',
        pattern: 'What word starting with "{first_letter}" means "{translation}"?',
        instructionsPattern: 'Type the word that matches the definition.',
        placeholders: {
          first_letter: { type: 'object_content', transform: 'mask' },
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
      {
        id: 'recall_cued_context',
        taskType: 'recall_cued',
        pattern: 'In {context}, what word means "{translation}"?',
        instructionsPattern: 'Type the appropriate term.',
        placeholders: {
          context: { type: 'context' },
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
    ]);

    // Free recall templates
    this.templates.set('recall_free', [
      {
        id: 'recall_free_meaning',
        taskType: 'recall_free',
        pattern: 'What does "{content}" mean?',
        instructionsPattern: 'Provide the meaning in your own words.',
        placeholders: {
          content: { type: 'object_content' },
        },
        qualityTier: 'standard',
      },
      {
        id: 'recall_free_word',
        taskType: 'recall_free',
        pattern: 'What is the word for: {translation}',
        instructionsPattern: 'Type the target word.',
        placeholders: {
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
    ]);

    // Production templates
    this.templates.set('production', [
      {
        id: 'production_sentence',
        taskType: 'production',
        pattern: 'Use "{content}" in a sentence.',
        instructionsPattern: 'Write a complete sentence using this word.',
        placeholders: {
          content: { type: 'object_content' },
        },
        qualityTier: 'premium',
      },
      {
        id: 'production_context',
        taskType: 'production',
        pattern: 'Write a sentence about {context} using "{content}".',
        instructionsPattern: 'Create a contextually appropriate sentence.',
        placeholders: {
          content: { type: 'object_content' },
          context: { type: 'context' },
        },
        qualityTier: 'premium',
      },
    ]);

    // Timed (rapid response) templates
    this.templates.set('timed', [
      {
        id: 'timed_translation',
        taskType: 'timed',
        pattern: '{content}',
        instructionsPattern: 'Quick! What does this mean?',
        placeholders: {
          content: { type: 'object_content' },
        },
        qualityTier: 'standard',
      },
      {
        id: 'timed_reverse',
        taskType: 'timed',
        pattern: '{translation}',
        instructionsPattern: 'Quick! What word is this?',
        placeholders: {
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
    ]);

    // Fill-in-blank templates (legacy support)
    this.templates.set('fill_blank' as TaskType, [
      {
        id: 'fill_blank_simple',
        taskType: 'fill_blank' as TaskType,
        pattern: 'Complete: {blank} means "{translation}"',
        instructionsPattern: 'Fill in the blank with the correct word.',
        placeholders: {
          blank: { type: 'blank' },
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
      {
        id: 'fill_blank_sentence',
        taskType: 'fill_blank' as TaskType,
        pattern: 'The {blank} is essential in {context} contexts.',
        instructionsPattern: 'Complete the sentence with the appropriate word.',
        placeholders: {
          blank: { type: 'blank' },
          context: { type: 'context' },
        },
        qualityTier: 'standard',
      },
    ]);

    // Definition match templates (legacy support)
    this.templates.set('definition_match' as TaskType, [
      {
        id: 'definition_simple',
        taskType: 'definition_match' as TaskType,
        pattern: '{translation}',
        instructionsPattern: 'Which word matches this definition?',
        placeholders: {
          translation: { type: 'object_translation' },
        },
        qualityTier: 'standard',
      },
    ]);

    // Translation templates (legacy support)
    this.templates.set('translation' as TaskType, [
      {
        id: 'translation_simple',
        taskType: 'translation' as TaskType,
        pattern: 'Translate: {content}',
        instructionsPattern: 'Provide the translation.',
        placeholders: {
          content: { type: 'object_content' },
        },
        qualityTier: 'standard',
      },
    ]);
  }

  /**
   * Add a custom template.
   */
  addTemplate(template: ContentTemplate): void {
    const existing = this.templates.get(template.taskType) || [];
    existing.push(template);
    this.templates.set(template.taskType, existing);
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<GeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a content generator with default configuration.
 */
export function createContentGenerator(
  config?: Partial<GeneratorConfig>,
  cache?: ContentCache
): ContentGenerator {
  return new ContentGenerator(config, cache);
}
