/**
 * Claude API Service
 *
 * Handles all Claude API interactions for the LOGOS application.
 * Provides content generation, error analysis, and adaptive hints.
 *
 * Uses the Anthropic SDK for type-safe API access.
 *
 * Features:
 * - Online mode: Full Claude API integration
 * - Offline fallback: Template-based content generation when API unavailable
 * - Response caching: Reduces API calls for repeated requests
 * - Graceful degradation: Automatic fallback on API errors
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number; // TTL in milliseconds
}

export interface ContentRequest {
  type: 'exercise' | 'explanation' | 'example';
  content: string;
  targetLanguage: string;
  nativeLanguage: string;
  context?: string;
  difficulty?: number;
}

export interface ErrorAnalysisRequest {
  content: string;
  userResponse: string;
  expectedResponse: string;
  targetLanguage: string;
  nativeLanguage: string;
}

export interface HintRequest {
  content: string;
  translation?: string;
  targetLanguage: string;
  nativeLanguage: string;
  hintLevel: 1 | 2 | 3;
  previousHints?: string[];
}

export interface GeneratedContent {
  content: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorAnalysis {
  errorType: string;
  component: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';
  explanation: string;
  correction: string;
  similarErrors?: string[];
}

export interface Hint {
  hint: string;
  level: number;
  remainingLevels: number;
}

export interface ServiceStatus {
  online: boolean;
  lastChecked: Date;
  latencyMs?: number;
  errorMessage?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// ============================================================================
// Cache Implementation
// ============================================================================

class ContentCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 30 * 60 * 1000) {
    // Default 30 minutes
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate a cache key from request parameters.
   */
  generateKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Get a cached value if it exists and hasn't expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in the cache with optional custom TTL.
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl ?? this.defaultTTL),
    });
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from the cache.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Get the current cache size.
   */
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Offline Fallback Generator
// ============================================================================

class OfflineFallbackGenerator {
  /**
   * Generate a template-based exercise when API is unavailable.
   */
  generateExercise(request: ContentRequest): GeneratedContent {
    const { content, targetLanguage, difficulty } = request;
    const difficultyLevel = this.getDifficultyLabel(difficulty);

    // Generate MCQ from similar words pattern
    const mcqExercise = this.generateMCQExercise(content, targetLanguage);

    // Generate fill-in-the-blank exercise
    const fillBlankExercise = this.generateFillBlankExercise(content);

    const exerciseContent = `
Exercise Type: Multiple Choice & Fill-in-the-Blank
Difficulty: ${difficultyLevel}
Target: ${content}

--- Multiple Choice ---
${mcqExercise.question}
${mcqExercise.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}

Expected Answer: ${mcqExercise.answer}

--- Fill in the Blank ---
${fillBlankExercise.question}

Expected Answer: ${fillBlankExercise.answer}

Note: This is an offline-generated exercise. For more personalized content, please reconnect to the internet.
    `.trim();

    return {
      content: exerciseContent,
      type: 'exercise',
      metadata: {
        offline: true,
        generator: 'template',
      },
    };
  }

  /**
   * Generate a basic explanation when API is unavailable.
   */
  generateExplanation(request: ContentRequest): GeneratedContent {
    const { content, targetLanguage, nativeLanguage } = request;

    const explanationContent = `
Word/Phrase: ${content}
Target Language: ${targetLanguage}
Your Language: ${nativeLanguage}

Basic Information:
- Length: ${content.length} characters
- Words: ${content.split(/\s+/).length}

Study Tips:
1. Break down the word/phrase into smaller parts
2. Look for familiar roots or patterns
3. Practice pronunciation by saying it aloud
4. Create a sentence using this word/phrase
5. Review this item again in your next study session

Note: Detailed explanations are available when connected to the internet.
    `.trim();

    return {
      content: explanationContent,
      type: 'explanation',
      metadata: {
        offline: true,
        generator: 'template',
      },
    };
  }

  /**
   * Generate example sentences when API is unavailable.
   */
  generateExample(request: ContentRequest): GeneratedContent {
    const { content, targetLanguage } = request;

    const exampleContent = `
Target: ${content}
Language: ${targetLanguage}

Example Patterns:
1. Use "${content}" at the beginning of a sentence
2. Use "${content}" in a question
3. Use "${content}" with common verbs

Practice Template:
"_____ ${content} _____."

Fill in the blanks to create your own sentences using "${content}".

Note: Contextual examples are available when connected to the internet.
    `.trim();

    return {
      content: exampleContent,
      type: 'example',
      metadata: {
        offline: true,
        generator: 'template',
      },
    };
  }

  /**
   * Generate a basic hint from word properties.
   */
  generateHint(request: HintRequest): Hint {
    const { content, translation, hintLevel } = request;

    let hint: string;

    switch (hintLevel) {
      case 1:
        // Minimal hint: first letter and length
        hint = `The answer starts with "${content.charAt(0).toUpperCase()}" and has ${content.length} letters.`;
        break;

      case 2:
        // Moderate hint: more letters revealed
        hint = this.generatePartialReveal(content);
        if (translation) {
          hint += ` It means something like "${translation}".`;
        }
        break;

      case 3:
        // Full hint: most of the answer
        hint = this.generateFullHint(content, translation);
        break;

      default:
        hint = `Think about the word carefully. It has ${content.length} characters.`;
    }

    return {
      hint,
      level: hintLevel,
      remainingLevels: 3 - hintLevel,
    };
  }

  /**
   * Generate a generic error analysis.
   */
  generateErrorAnalysis(request: ErrorAnalysisRequest): ErrorAnalysis {
    const { userResponse, expectedResponse } = request;

    // Basic comparison to determine error type
    const userLower = userResponse.toLowerCase().trim();
    const expectedLower = expectedResponse.toLowerCase().trim();

    let errorType = 'Lexical Error';
    let component: ErrorAnalysis['component'] = 'LEX';
    let explanation =
      'The response differs from the expected answer. Please review the vocabulary.';

    // Simple heuristics for error classification
    if (this.calculateLevenshteinDistance(userLower, expectedLower) <= 2) {
      errorType = 'Spelling Error';
      component = 'MORPH';
      explanation =
        'The answer is close but has minor spelling differences. Check each letter carefully.';
    } else if (userLower.split(/\s+/).length !== expectedLower.split(/\s+/).length) {
      errorType = 'Structural Error';
      component = 'SYNT';
      explanation = 'The number of words differs from the expected answer. Check the sentence structure.';
    }

    return {
      errorType,
      component,
      explanation,
      correction: expectedResponse,
      similarErrors: [
        'Common spelling mistakes',
        'Word order issues',
        'Missing or extra words',
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helper Methods
  // ---------------------------------------------------------------------------

  private getDifficultyLabel(difficulty?: number): string {
    if (difficulty === undefined) return 'Intermediate';
    const levels = ['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced'];
    return levels[Math.min(Math.max(0, Math.floor(difficulty)), 4)];
  }

  private generateMCQExercise(
    content: string,
    _language: string
  ): { question: string; options: string[]; answer: string } {
    // Generate distractors by modifying the content
    const distractors = this.generateDistractors(content);

    const options = [content, ...distractors].sort(() => Math.random() - 0.5);

    return {
      question: `Which of the following is the correct form?`,
      options,
      answer: content,
    };
  }

  private generateDistractors(word: string): string[] {
    const distractors: string[] = [];

    // Swap two adjacent letters
    if (word.length > 1) {
      const swapPos = Math.floor(Math.random() * (word.length - 1));
      const swapped =
        word.slice(0, swapPos) +
        word[swapPos + 1] +
        word[swapPos] +
        word.slice(swapPos + 2);
      if (swapped !== word) {
        distractors.push(swapped);
      }
    }

    // Remove a letter
    if (word.length > 2) {
      const removePos = Math.floor(Math.random() * word.length);
      const removed = word.slice(0, removePos) + word.slice(removePos + 1);
      if (!distractors.includes(removed)) {
        distractors.push(removed);
      }
    }

    // Double a letter
    const doublePos = Math.floor(Math.random() * word.length);
    const doubled =
      word.slice(0, doublePos + 1) + word[doublePos] + word.slice(doublePos + 1);
    if (!distractors.includes(doubled)) {
      distractors.push(doubled);
    }

    // Ensure we have at least 3 distractors
    while (distractors.length < 3) {
      distractors.push(word + String.fromCharCode(97 + distractors.length));
    }

    return distractors.slice(0, 3);
  }

  private generateFillBlankExercise(content: string): { question: string; answer: string } {
    const words = content.split(/\s+/);

    if (words.length > 1) {
      // For phrases, blank out a random word
      const blankIndex = Math.floor(Math.random() * words.length);
      const blankedWord = words[blankIndex];
      const question = words
        .map((w, i) => (i === blankIndex ? '_____' : w))
        .join(' ');
      return { question: `Complete: ${question}`, answer: blankedWord };
    } else {
      // For single words, blank out middle letters
      const start = Math.ceil(content.length / 4);
      const end = Math.floor((content.length * 3) / 4);
      const blanked =
        content.slice(0, start) + '_'.repeat(end - start) + content.slice(end);
      return {
        question: `Complete: ${blanked}`,
        answer: content,
      };
    }
  }

  private generatePartialReveal(content: string): string {
    const chars = content.split('');
    const revealCount = Math.ceil(chars.length / 3);
    const revealed = chars.map((c, i) => {
      if (i === 0 || i === chars.length - 1) return c;
      if (c === ' ') return ' ';
      return i < revealCount ? c : '_';
    });
    return `Partial reveal: "${revealed.join('')}"`;
  }

  private generateFullHint(content: string, translation?: string): string {
    const chars = content.split('');
    const revealed = chars.map((c, i) => {
      if (c === ' ') return ' ';
      // Hide only one or two characters
      if (i === Math.floor(chars.length / 2)) return '_';
      return c;
    });

    let hint = `Almost there! The answer is: "${revealed.join('')}"`;
    if (translation) {
      hint += `\nMeaning: "${translation}"`;
    }
    return hint;
  }

  private calculateLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

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
}

// ============================================================================
// Claude Service Class
// ============================================================================

/**
 * Claude API service for language learning assistance.
 *
 * Provides:
 * - Content generation (exercises, explanations, examples)
 * - Error analysis with component classification
 * - Adaptive hint generation with scaffolding levels
 * - Offline fallback for when API is unavailable
 * - Response caching to reduce API calls
 */
export class ClaudeService {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private cache: ContentCache;
  private cacheEnabled: boolean;
  private offlineGenerator: OfflineFallbackGenerator;
  private isOnline: boolean = true;
  private lastStatusCheck: Date | null = null;
  private lastLatencyMs: number | undefined;
  private lastError: string | undefined;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 1024;
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.cache = new ContentCache(config.cacheTTL);
    this.offlineGenerator = new OfflineFallbackGenerator();
  }

  // ============================================================================
  // Status & Health Check Methods
  // ============================================================================

  /**
   * Check if the Claude API is available and responsive.
   *
   * Makes a lightweight API call to verify connectivity.
   * Updates internal online/offline state.
   */
  async checkStatus(): Promise<ServiceStatus> {
    const startTime = Date.now();

    try {
      // Make a minimal API call to check connectivity
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });

      this.isOnline = true;
      this.lastStatusCheck = new Date();
      this.lastLatencyMs = Date.now() - startTime;
      this.lastError = undefined;

      return {
        online: true,
        lastChecked: this.lastStatusCheck,
        latencyMs: this.lastLatencyMs,
      };
    } catch (error) {
      this.isOnline = false;
      this.lastStatusCheck = new Date();
      this.lastLatencyMs = Date.now() - startTime;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';

      return {
        online: false,
        lastChecked: this.lastStatusCheck,
        latencyMs: this.lastLatencyMs,
        errorMessage: this.lastError,
      };
    }
  }

  /**
   * Get the current online/offline status without making an API call.
   */
  getStatus(): ServiceStatus {
    return {
      online: this.isOnline,
      lastChecked: this.lastStatusCheck ?? new Date(),
      latencyMs: this.lastLatencyMs,
      errorMessage: this.lastError,
    };
  }

  /**
   * Check if the service is currently online.
   */
  isServiceOnline(): boolean {
    return this.isOnline;
  }

  // ============================================================================
  // Content Generation Methods
  // ============================================================================

  /**
   * Generate learning content based on request type.
   *
   * Uses caching to avoid repeated API calls for identical requests.
   * Falls back to offline generation if API is unavailable.
   */
  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.cache.generateKey('content', request as unknown as Record<string, unknown>);
      const cached = this.cache.get<GeneratedContent>(cacheKey);
      if (cached) {
        return { ...cached, metadata: { ...cached.metadata, cached: true } };
      }
    }

    // Try online generation
    try {
      const result = await this.generateContentOnline(request);

      // Cache the result
      if (this.cacheEnabled) {
        const cacheKey = this.cache.generateKey('content', request as unknown as Record<string, unknown>);
        this.cache.set(cacheKey, result);
      }

      this.isOnline = true;
      return result;
    } catch (error) {
      // Fall back to offline generation
      this.isOnline = false;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return this.generateContentOffline(request);
    }
  }

  /**
   * Analyze a learner's error and classify by component.
   *
   * Falls back to generic analysis if API is unavailable.
   */
  async analyzeError(request: ErrorAnalysisRequest): Promise<ErrorAnalysis> {
    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.cache.generateKey('error', request as unknown as Record<string, unknown>);
      const cached = this.cache.get<ErrorAnalysis>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Try online analysis
    try {
      const result = await this.analyzeErrorOnline(request);

      // Cache the result
      if (this.cacheEnabled) {
        const cacheKey = this.cache.generateKey('error', request as unknown as Record<string, unknown>);
        this.cache.set(cacheKey, result);
      }

      this.isOnline = true;
      return result;
    } catch (error) {
      // Fall back to offline analysis
      this.isOnline = false;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return this.offlineGenerator.generateErrorAnalysis(request);
    }
  }

  /**
   * Generate an adaptive hint based on scaffolding level.
   *
   * Hint levels:
   * 1 - Minimal: Just a nudge in the right direction
   * 2 - Moderate: More specific guidance
   * 3 - Full: Nearly complete answer with explanation
   *
   * Falls back to template-based hints if API is unavailable.
   */
  async getHint(request: HintRequest): Promise<Hint> {
    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.cache.generateKey('hint', request as unknown as Record<string, unknown>);
      const cached = this.cache.get<Hint>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Try online hint generation
    try {
      const result = await this.getHintOnline(request);

      // Cache the result
      if (this.cacheEnabled) {
        const cacheKey = this.cache.generateKey('hint', request as unknown as Record<string, unknown>);
        this.cache.set(cacheKey, result);
      }

      this.isOnline = true;
      return result;
    } catch (error) {
      // Fall back to offline hint generation
      this.isOnline = false;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return this.offlineGenerator.generateHint(request);
    }
  }

  // ============================================================================
  // Cache Management Methods
  // ============================================================================

  /**
   * Clear all cached responses.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from the cache.
   */
  pruneCache(): number {
    return this.cache.prune();
  }

  /**
   * Get the current cache size.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Enable or disable caching.
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }

  // ============================================================================
  // Private Online Methods
  // ============================================================================

  private async generateContentOnline(request: ContentRequest): Promise<GeneratedContent> {
    const systemPrompt = this.buildContentSystemPrompt(request);
    const userPrompt = this.buildContentUserPrompt(request);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    return {
      content: textContent.text,
      type: request.type,
      metadata: {
        model: this.model,
        tokens: response.usage.output_tokens,
        offline: false,
      },
    };
  }

  private async analyzeErrorOnline(request: ErrorAnalysisRequest): Promise<ErrorAnalysis> {
    const systemPrompt = `You are a language learning error analyst. Analyze errors in ${request.targetLanguage} learning for a ${request.nativeLanguage} speaker.

Classify errors into one of these linguistic components:
- PHON: Phonological errors (pronunciation, sound patterns)
- MORPH: Morphological errors (word formation, conjugation, declension)
- LEX: Lexical errors (vocabulary, word choice, collocations)
- SYNT: Syntactic errors (word order, sentence structure, agreement)
- PRAG: Pragmatic errors (register, politeness, cultural appropriateness)

Respond in JSON format:
{
  "errorType": "brief error category",
  "component": "PHON|MORPH|LEX|SYNT|PRAG",
  "explanation": "clear explanation of what went wrong",
  "correction": "the correct form",
  "similarErrors": ["other common similar mistakes"]
}`;

    const userPrompt = `Analyze this error:
Target: "${request.content}"
User wrote: "${request.userResponse}"
Expected: "${request.expectedResponse}"`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    try {
      // Extract JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as ErrorAnalysis;
    } catch {
      // Fallback if JSON parsing fails
      return {
        errorType: 'Unknown',
        component: 'LEX',
        explanation: textContent.text,
        correction: request.expectedResponse,
      };
    }
  }

  private async getHintOnline(request: HintRequest): Promise<Hint> {
    const levelDescriptions = {
      1: 'Give a minimal hint - just nudge them in the right direction without giving away the answer. Be very brief.',
      2: 'Give a moderate hint - provide more specific guidance. You can mention the general category or pattern.',
      3: 'Give a full hint - provide substantial help. Explain the concept and give most of the answer.',
    };

    const previousHintsContext = request.previousHints?.length
      ? `\nPrevious hints given:\n${request.previousHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\nProvide a NEW hint that builds on these.`
      : '';

    const systemPrompt = `You are a language tutor helping someone learn ${request.targetLanguage}. Their native language is ${request.nativeLanguage}.

${levelDescriptions[request.hintLevel]}
${previousHintsContext}

Respond with just the hint text, no preamble.`;

    const userPrompt = `The learner needs help with: "${request.content}"${request.translation ? `\nMeaning: "${request.translation}"` : ''}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    return {
      hint: textContent.text.trim(),
      level: request.hintLevel,
      remainingLevels: 3 - request.hintLevel,
    };
  }

  // ============================================================================
  // Private Offline Methods
  // ============================================================================

  private generateContentOffline(request: ContentRequest): GeneratedContent {
    switch (request.type) {
      case 'exercise':
        return this.offlineGenerator.generateExercise(request);
      case 'explanation':
        return this.offlineGenerator.generateExplanation(request);
      case 'example':
        return this.offlineGenerator.generateExample(request);
      default:
        return this.offlineGenerator.generateExplanation(request);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private buildContentSystemPrompt(request: ContentRequest): string {
    const basePrompt = `You are a language learning content generator for ${request.targetLanguage} learners whose native language is ${request.nativeLanguage}.`;

    switch (request.type) {
      case 'exercise':
        return `${basePrompt}

Generate a learning exercise. Consider the difficulty level (${request.difficulty ?? 'intermediate'}).
Format your response as:
1. The exercise prompt/question
2. The expected answer
3. Any notes for the learner`;

      case 'explanation':
        return `${basePrompt}

Provide a clear, concise explanation. Use examples from both ${request.targetLanguage} and ${request.nativeLanguage} to illustrate the concept.
Focus on practical usage, not linguistic jargon.`;

      case 'example':
        return `${basePrompt}

Generate example sentences or usage patterns. Provide:
1. The ${request.targetLanguage} example
2. A natural ${request.nativeLanguage} translation
3. A brief note on usage context`;

      default:
        return basePrompt;
    }
  }

  private buildContentUserPrompt(request: ContentRequest): string {
    let prompt = `Generate ${request.type} content for: "${request.content}"`;

    if (request.context) {
      prompt += `\n\nContext: ${request.context}`;
    }

    if (request.difficulty !== undefined) {
      const levels = ['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced'];
      const level = levels[Math.min(Math.max(0, Math.floor(request.difficulty)), 4)];
      prompt += `\n\nDifficulty level: ${level}`;
    }

    return prompt;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: ClaudeService | null = null;

/**
 * Get or create the Claude service instance.
 */
export function getClaudeService(apiKey?: string): ClaudeService {
  if (!serviceInstance) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    serviceInstance = new ClaudeService({ apiKey: key });
  }
  return serviceInstance;
}

/**
 * Reset the service instance (for testing).
 */
export function resetClaudeService(): void {
  serviceInstance = null;
}
