/**
 * Distractor Generator
 *
 * Generates plausible but incorrect options for multiple choice questions.
 * Creates distractors based on linguistic similarity, common errors,
 * and semantic relationships.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.6
 */

import type { LanguageObject, ComponentType } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Distractor generation strategy.
 */
export type DistractorStrategy =
  | 'phonological_similar'   // Similar sounding words
  | 'orthographic_similar'   // Similar spelling
  | 'semantic_related'       // Same semantic field
  | 'morphological_variant'  // Different form of same root
  | 'common_confusion'       // Known L1 interference
  | 'random_same_pos'        // Random word, same part of speech
  | 'translation_false_friend'; // False cognate

/**
 * Generated distractor with metadata.
 */
export interface Distractor {
  /** Distractor content */
  content: string;

  /** Strategy used to generate */
  strategy: DistractorStrategy;

  /** Plausibility score (0-1) */
  plausibility: number;

  /** Why this is wrong (for feedback) */
  explanation: string;

  /** Source object ID if derived from corpus */
  sourceId?: string;
}

/**
 * Configuration for distractor generation.
 */
export interface DistractorConfig {
  /** Number of distractors to generate */
  count: number;

  /** Minimum plausibility threshold */
  minPlausibility: number;

  /** Preferred strategies (in order) */
  preferredStrategies: DistractorStrategy[];

  /** Component focus for error types */
  componentFocus?: ComponentType;

  /** Target difficulty (affects plausibility) */
  targetDifficulty: number;

  /** L1 for interference-based distractors */
  nativeLanguage?: string;

  /** Avoid these as distractors */
  excludeWords?: string[];
}

/**
 * Distractor set result.
 */
export interface DistractorSet {
  /** Target (correct answer) */
  target: LanguageObject;

  /** Generated distractors */
  distractors: Distractor[];

  /** Strategies used */
  strategiesUsed: DistractorStrategy[];

  /** Generation quality score */
  qualityScore: number;
}

// =============================================================================
// Distractor Generator Class
// =============================================================================

/**
 * Generates high-quality distractors for MCQ tasks.
 */
export class DistractorGenerator {
  private vocabulary: Map<string, LanguageObject>;
  private semanticGroups: Map<string, string[]>;
  private morphologicalFamilies: Map<string, string[]>;
  private confusionPairs: Map<string, Map<string, string[]>>;

  constructor() {
    this.vocabulary = new Map();
    this.semanticGroups = new Map();
    this.morphologicalFamilies = new Map();
    this.confusionPairs = new Map();
    this.initializeConfusionPairs();
  }

  /**
   * Generate distractors for a target object.
   */
  generate(
    target: LanguageObject,
    config: Partial<DistractorConfig> = {}
  ): DistractorSet {
    const fullConfig: DistractorConfig = {
      count: 3,
      minPlausibility: 0.3,
      preferredStrategies: [
        'semantic_related',
        'morphological_variant',
        'phonological_similar',
        'orthographic_similar',
      ],
      targetDifficulty: 0.5,
      ...config,
    };

    const distractors: Distractor[] = [];
    const usedStrategies: DistractorStrategy[] = [];
    const usedContent = new Set<string>([target.content.toLowerCase()]);

    // Add excluded words to used set
    if (fullConfig.excludeWords) {
      for (const word of fullConfig.excludeWords) {
        usedContent.add(word.toLowerCase());
      }
    }

    // Try each strategy until we have enough distractors
    for (const strategy of fullConfig.preferredStrategies) {
      if (distractors.length >= fullConfig.count) break;

      const candidates = this.generateByStrategy(target, strategy, fullConfig);

      for (const candidate of candidates) {
        if (distractors.length >= fullConfig.count) break;

        // Check uniqueness and plausibility
        if (
          !usedContent.has(candidate.content.toLowerCase()) &&
          candidate.plausibility >= fullConfig.minPlausibility
        ) {
          distractors.push(candidate);
          usedContent.add(candidate.content.toLowerCase());

          if (!usedStrategies.includes(strategy)) {
            usedStrategies.push(strategy);
          }
        }
      }
    }

    // If still not enough, use random fallback
    if (distractors.length < fullConfig.count) {
      const fallback = this.generateFallbackDistractors(
        target,
        fullConfig.count - distractors.length,
        usedContent
      );
      distractors.push(...fallback);
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(distractors, fullConfig);

    return {
      target,
      distractors,
      strategiesUsed: usedStrategies,
      qualityScore,
    };
  }

  /**
   * Generate distractors using a specific strategy.
   */
  private generateByStrategy(
    target: LanguageObject,
    strategy: DistractorStrategy,
    config: DistractorConfig
  ): Distractor[] {
    switch (strategy) {
      case 'phonological_similar':
        return this.generatePhonologicalSimilar(target, config);
      case 'orthographic_similar':
        return this.generateOrthographicSimilar(target, config);
      case 'semantic_related':
        return this.generateSemanticRelated(target, config);
      case 'morphological_variant':
        return this.generateMorphologicalVariant(target, config);
      case 'common_confusion':
        return this.generateCommonConfusion(target, config);
      case 'random_same_pos':
        return this.generateRandomSamePOS(target, config);
      case 'translation_false_friend':
        return this.generateFalseFriend(target, config);
      default:
        return [];
    }
  }

  /**
   * Generate phonologically similar distractors.
   */
  private generatePhonologicalSimilar(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];
    const targetWord = target.content.toLowerCase();

    // Find words with similar sounds (simplified)
    // In production, would use phonetic transcription
    const similarPatterns = [
      // Same initial sound
      new RegExp(`^${targetWord.charAt(0)}`, 'i'),
      // Same ending
      new RegExp(`${targetWord.slice(-2)}$`, 'i'),
      // Same syllable count (approximate)
    ];

    for (const [word, obj] of this.vocabulary) {
      if (word === targetWord) continue;

      const matchCount = similarPatterns.filter(p => p.test(word)).length;
      if (matchCount >= 1) {
        const plausibility = 0.3 + (matchCount * 0.2);
        results.push({
          content: obj.content,
          strategy: 'phonological_similar',
          plausibility: Math.min(0.8, plausibility),
          explanation: `"${obj.content}" sounds similar but has a different meaning`,
          sourceId: obj.id,
        });
      }
    }

    return results.slice(0, 5);
  }

  /**
   * Generate orthographically similar distractors.
   */
  private generateOrthographicSimilar(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];
    const targetWord = target.content.toLowerCase();

    for (const [word, obj] of this.vocabulary) {
      if (word === targetWord) continue;

      const distance = this.levenshteinDistance(targetWord, word);
      const maxLen = Math.max(targetWord.length, word.length);
      const similarity = 1 - (distance / maxLen);

      if (similarity >= 0.6 && similarity < 1) {
        results.push({
          content: obj.content,
          strategy: 'orthographic_similar',
          plausibility: similarity * 0.9,
          explanation: `"${obj.content}" is spelled similarly but means something different`,
          sourceId: obj.id,
        });
      }
    }

    return results.sort((a, b) => b.plausibility - a.plausibility).slice(0, 5);
  }

  /**
   * Generate semantically related distractors.
   */
  private generateSemanticRelated(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];

    // Check if target is in a semantic group
    for (const [group, members] of this.semanticGroups) {
      if (members.includes(target.id)) {
        // Add other members as distractors
        for (const memberId of members) {
          if (memberId === target.id) continue;

          const member = this.vocabulary.get(memberId);
          if (member) {
            results.push({
              content: member.content,
              strategy: 'semantic_related',
              plausibility: 0.7,
              explanation: `"${member.content}" is related but not the correct answer`,
              sourceId: memberId,
            });
          }
        }
      }
    }

    // Also check domain overlap
    if (target.domainDistribution) {
      const targetDomains = Object.keys(target.domainDistribution);

      for (const [, obj] of this.vocabulary) {
        if (obj.id === target.id) continue;
        if (!obj.domainDistribution) continue;

        const objDomains = Object.keys(obj.domainDistribution);
        const overlap = targetDomains.filter(d => objDomains.includes(d)).length;

        if (overlap > 0) {
          results.push({
            content: obj.content,
            strategy: 'semantic_related',
            plausibility: 0.5 + (overlap * 0.1),
            explanation: `"${obj.content}" is from the same domain but not the answer`,
            sourceId: obj.id,
          });
        }
      }
    }

    return results.slice(0, 5);
  }

  /**
   * Generate morphological variants as distractors.
   */
  private generateMorphologicalVariant(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];
    const targetWord = target.content.toLowerCase();

    // Check morphological families
    for (const [root, family] of this.morphologicalFamilies) {
      if (family.includes(target.id)) {
        for (const memberId of family) {
          if (memberId === target.id) continue;

          const member = this.vocabulary.get(memberId);
          if (member) {
            results.push({
              content: member.content,
              strategy: 'morphological_variant',
              plausibility: 0.75,
              explanation: `"${member.content}" is a different form of the same word family`,
              sourceId: memberId,
            });
          }
        }
      }
    }

    // Generate common morphological variations
    const variations = this.generateMorphVariations(targetWord);
    for (const variant of variations) {
      if (this.vocabulary.has(variant)) {
        const obj = this.vocabulary.get(variant)!;
        results.push({
          content: obj.content,
          strategy: 'morphological_variant',
          plausibility: 0.7,
          explanation: `"${obj.content}" is a different form but not correct in this context`,
          sourceId: obj.id,
        });
      }
    }

    return results.slice(0, 5);
  }

  /**
   * Generate common morphological variations.
   */
  private generateMorphVariations(word: string): string[] {
    const variations: string[] = [];

    // Verb forms
    if (!word.endsWith('ing')) variations.push(word + 'ing');
    if (!word.endsWith('ed')) variations.push(word + 'ed');
    if (!word.endsWith('s')) variations.push(word + 's');

    // Remove common suffixes
    if (word.endsWith('ing')) variations.push(word.slice(0, -3));
    if (word.endsWith('ed')) variations.push(word.slice(0, -2));
    if (word.endsWith('s') && !word.endsWith('ss')) variations.push(word.slice(0, -1));

    // Noun forms
    if (!word.endsWith('tion')) variations.push(word + 'tion');
    if (!word.endsWith('ness')) variations.push(word + 'ness');

    // Adjective forms
    if (!word.endsWith('ly')) variations.push(word + 'ly');
    if (!word.endsWith('ful')) variations.push(word + 'ful');

    return variations;
  }

  /**
   * Generate distractors based on common L1 confusion.
   */
  private generateCommonConfusion(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];

    if (!config.nativeLanguage) return results;

    const confusions = this.confusionPairs.get(config.nativeLanguage);
    if (!confusions) return results;

    const targetWord = target.content.toLowerCase();
    const confused = confusions.get(targetWord);

    if (confused) {
      for (const confusedWord of confused) {
        results.push({
          content: confusedWord,
          strategy: 'common_confusion',
          plausibility: 0.85,
          explanation: `"${confusedWord}" is commonly confused with "${target.content}" by ${config.nativeLanguage} speakers`,
        });
      }
    }

    return results;
  }

  /**
   * Generate random distractors of same part of speech.
   */
  private generateRandomSamePOS(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];

    // Filter by similar type (simplified POS)
    const candidates = Array.from(this.vocabulary.values())
      .filter(obj => obj.id !== target.id && obj.type === target.type);

    // Random selection
    const shuffled = candidates.sort(() => Math.random() - 0.5);

    for (const obj of shuffled.slice(0, 5)) {
      results.push({
        content: obj.content,
        strategy: 'random_same_pos',
        plausibility: 0.4,
        explanation: `"${obj.content}" is a different word`,
        sourceId: obj.id,
      });
    }

    return results;
  }

  /**
   * Generate false friend distractors.
   * Uses a database of cognates that have different meanings in different languages.
   */
  private generateFalseFriend(
    target: LanguageObject,
    config: DistractorConfig
  ): Distractor[] {
    const results: Distractor[] = [];

    if (!config.nativeLanguage) return results;

    // Get false friends database for the L1
    const falseFriends = this.getFalseFriendsForLanguage(config.nativeLanguage);
    if (!falseFriends) return results;

    const targetWord = target.content.toLowerCase();

    // Check if target has false friend cognates
    for (const [english, entries] of falseFriends) {
      // Check if target word is related to any false friend entry
      if (english === targetWord || this.levenshteinDistance(english, targetWord) <= 2) {
        for (const entry of entries) {
          results.push({
            content: entry.falseCognate,
            strategy: 'translation_false_friend',
            plausibility: 0.9, // False friends are highly plausible distractors
            explanation: `"${entry.falseCognate}" looks like "${english}" but actually means "${entry.actualMeaning}" in ${config.nativeLanguage}`,
          });
        }
      }
    }

    return results.slice(0, 3);
  }

  /**
   * Get false friends database for a specific L1.
   */
  private getFalseFriendsForLanguage(
    language: string
  ): Map<string, Array<{ falseCognate: string; actualMeaning: string }>> | null {
    const databases: Record<string, Map<string, Array<{ falseCognate: string; actualMeaning: string }>>> = {
      Spanish: new Map([
        ['actual', [{ falseCognate: 'actualmente', actualMeaning: 'currently' }]],
        ['assist', [{ falseCognate: 'asistir', actualMeaning: 'to attend' }]],
        ['carpet', [{ falseCognate: 'carpeta', actualMeaning: 'folder' }]],
        ['constipated', [{ falseCognate: 'constipado', actualMeaning: 'having a cold' }]],
        ['embarrassed', [{ falseCognate: 'embarazada', actualMeaning: 'pregnant' }]],
        ['exit', [{ falseCognate: 'éxito', actualMeaning: 'success' }]],
        ['fabric', [{ falseCognate: 'fábrica', actualMeaning: 'factory' }]],
        ['introduce', [{ falseCognate: 'introducir', actualMeaning: 'to insert' }]],
        ['library', [{ falseCognate: 'librería', actualMeaning: 'bookstore' }]],
        ['realize', [{ falseCognate: 'realizar', actualMeaning: 'to carry out' }]],
        ['record', [{ falseCognate: 'recordar', actualMeaning: 'to remember' }]],
        ['remove', [{ falseCognate: 'remover', actualMeaning: 'to stir' }]],
        ['sensible', [{ falseCognate: 'sensible', actualMeaning: 'sensitive' }]],
        ['soap', [{ falseCognate: 'sopa', actualMeaning: 'soup' }]],
        ['success', [{ falseCognate: 'suceso', actualMeaning: 'event' }]],
      ]),

      Portuguese: new Map([
        ['actually', [{ falseCognate: 'atualmente', actualMeaning: 'currently' }]],
        ['attend', [{ falseCognate: 'atender', actualMeaning: 'to answer/serve' }]],
        ['balcony', [{ falseCognate: 'balcão', actualMeaning: 'counter' }]],
        ['beef', [{ falseCognate: 'bife', actualMeaning: 'steak' }]],
        ['college', [{ falseCognate: 'colégio', actualMeaning: 'school' }]],
        ['comprehensive', [{ falseCognate: 'compreensivo', actualMeaning: 'understanding' }]],
        ['costume', [{ falseCognate: 'costume', actualMeaning: 'habit/custom' }]],
        ['eventually', [{ falseCognate: 'eventualmente', actualMeaning: 'occasionally' }]],
        ['exquisite', [{ falseCognate: 'esquisito', actualMeaning: 'weird' }]],
        ['intend', [{ falseCognate: 'entender', actualMeaning: 'to understand' }]],
        ['legend', [{ falseCognate: 'legenda', actualMeaning: 'subtitle/caption' }]],
        ['pretend', [{ falseCognate: 'pretender', actualMeaning: 'to intend' }]],
        ['push', [{ falseCognate: 'puxar', actualMeaning: 'to pull' }]],
        ['resume', [{ falseCognate: 'resumir', actualMeaning: 'to summarize' }]],
      ]),

      French: new Map([
        ['actually', [{ falseCognate: 'actuellement', actualMeaning: 'currently' }]],
        ['assist', [{ falseCognate: 'assister', actualMeaning: 'to attend' }]],
        ['attend', [{ falseCognate: 'attendre', actualMeaning: 'to wait' }]],
        ['bless', [{ falseCognate: 'blesser', actualMeaning: 'to wound' }]],
        ['chair', [{ falseCognate: 'chair', actualMeaning: 'flesh/meat' }]],
        ['coin', [{ falseCognate: 'coin', actualMeaning: 'corner/wedge' }]],
        ['demand', [{ falseCognate: 'demander', actualMeaning: 'to ask' }]],
        ['entrée', [{ falseCognate: 'entrée', actualMeaning: 'starter/appetizer' }]],
        ['eventual', [{ falseCognate: 'éventuel', actualMeaning: 'possible' }]],
        ['library', [{ falseCognate: 'librairie', actualMeaning: 'bookstore' }]],
        ['location', [{ falseCognate: 'location', actualMeaning: 'rental' }]],
        ['magazine', [{ falseCognate: 'magasin', actualMeaning: 'store' }]],
        ['pass', [{ falseCognate: 'passer', actualMeaning: 'to spend (time)' }]],
        ['prune', [{ falseCognate: 'prune', actualMeaning: 'plum' }]],
        ['raisin', [{ falseCognate: 'raisin', actualMeaning: 'grape' }]],
      ]),

      German: new Map([
        ['become', [{ falseCognate: 'bekommen', actualMeaning: 'to get/receive' }]],
        ['brave', [{ falseCognate: 'brav', actualMeaning: 'well-behaved' }]],
        ['chef', [{ falseCognate: 'Chef', actualMeaning: 'boss' }]],
        ['gift', [{ falseCognate: 'Gift', actualMeaning: 'poison' }]],
        ['gymnasium', [{ falseCognate: 'Gymnasium', actualMeaning: 'high school' }]],
        ['hell', [{ falseCognate: 'hell', actualMeaning: 'bright/light' }]],
        ['kind', [{ falseCognate: 'Kind', actualMeaning: 'child' }]],
        ['mile', [{ falseCognate: 'Meile', actualMeaning: 'nautical mile (different length)' }]],
        ['rat', [{ falseCognate: 'Rat', actualMeaning: 'advice/council' }]],
        ['rock', [{ falseCognate: 'Rock', actualMeaning: 'skirt' }]],
        ['see', [{ falseCognate: 'See', actualMeaning: 'lake' }]],
        ['wink', [{ falseCognate: 'Winkel', actualMeaning: 'angle/corner' }]],
      ]),

      Italian: new Map([
        ['accident', [{ falseCognate: 'accidente', actualMeaning: 'damn! (exclamation)' }]],
        ['camera', [{ falseCognate: 'camera', actualMeaning: 'room' }]],
        ['cold', [{ falseCognate: 'caldo', actualMeaning: 'hot/warm' }]],
        ['factory', [{ falseCognate: 'fattoria', actualMeaning: 'farm' }]],
        ['firm', [{ falseCognate: 'firma', actualMeaning: 'signature' }]],
        ['magazine', [{ falseCognate: 'magazzino', actualMeaning: 'warehouse' }]],
        ['parent', [{ falseCognate: 'parente', actualMeaning: 'relative' }]],
        ['sensible', [{ falseCognate: 'sensibile', actualMeaning: 'sensitive' }]],
        ['stamp', [{ falseCognate: 'stampa', actualMeaning: 'printing/press' }]],
      ]),

      Japanese: new Map([
        ['mansion', [{ falseCognate: 'マンション (manshon)', actualMeaning: 'apartment' }]],
        ['smart', [{ falseCognate: 'スマート (sumaato)', actualMeaning: 'slim/stylish' }]],
        ['claim', [{ falseCognate: 'クレーム (kurēmu)', actualMeaning: 'complaint' }]],
        ['naive', [{ falseCognate: 'ナイーブ (naiibu)', actualMeaning: 'sensitive' }]],
        ['consent', [{ falseCognate: 'コンセント (konsento)', actualMeaning: 'electrical outlet' }]],
        ['cunning', [{ falseCognate: 'カンニング (kanningu)', actualMeaning: 'cheating on exam' }]],
      ]),

      Mandarin: new Map([
        ['actually', [{ falseCognate: '其实 (qíshí)', actualMeaning: 'in fact/really' }]],
        ['embarrassed', [{ falseCognate: '尴尬 (gāngà)', actualMeaning: 'awkward situation' }]],
      ]),
    };

    return databases[language] || null;
  }

  /**
   * Generate fallback distractors when strategies fail.
   */
  private generateFallbackDistractors(
    target: LanguageObject,
    count: number,
    usedContent: Set<string>
  ): Distractor[] {
    const results: Distractor[] = [];

    // Common wrong answers based on length
    const lengthSimilar = Array.from(this.vocabulary.values())
      .filter(obj =>
        obj.id !== target.id &&
        !usedContent.has(obj.content.toLowerCase()) &&
        Math.abs(obj.content.length - target.content.length) <= 2
      )
      .sort(() => Math.random() - 0.5);

    for (const obj of lengthSimilar.slice(0, count)) {
      results.push({
        content: obj.content,
        strategy: 'random_same_pos',
        plausibility: 0.3,
        explanation: `"${obj.content}" is not the correct answer`,
        sourceId: obj.id,
      });
    }

    // If still not enough, generate synthetic distractors
    while (results.length < count) {
      const synthetic = this.generateSyntheticDistractor(target, results.length);
      results.push(synthetic);
    }

    return results;
  }

  /**
   * Generate a synthetic distractor.
   */
  private generateSyntheticDistractor(target: LanguageObject, index: number): Distractor {
    // Simple letter substitution
    const word = target.content;
    const pos = Math.floor(word.length / 2);
    const newChar = String.fromCharCode(97 + ((word.charCodeAt(pos) - 97 + index + 1) % 26));
    const synthetic = word.substring(0, pos) + newChar + word.substring(pos + 1);

    return {
      content: synthetic,
      strategy: 'orthographic_similar',
      plausibility: 0.25,
      explanation: 'This is not a valid word',
    };
  }

  /**
   * Calculate quality score for distractor set.
   */
  private calculateQualityScore(
    distractors: Distractor[],
    config: DistractorConfig
  ): number {
    if (distractors.length === 0) return 0;

    // Average plausibility
    const avgPlausibility = distractors.reduce((sum, d) => sum + d.plausibility, 0) / distractors.length;

    // Strategy diversity
    const uniqueStrategies = new Set(distractors.map(d => d.strategy)).size;
    const diversityBonus = uniqueStrategies / distractors.length * 0.2;

    // Count bonus (meeting target)
    const countBonus = distractors.length >= config.count ? 0.1 : 0;

    return Math.min(1, avgPlausibility + diversityBonus + countBonus);
  }

  /**
   * Calculate Levenshtein distance between two strings.
   */
  private levenshteinDistance(a: string, b: string): number {
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
   * Initialize common confusion pairs by L1.
   */
  private initializeConfusionPairs(): void {
    // Spanish speakers
    const spanish = new Map<string, string[]>([
      ['make', ['do']],
      ['do', ['make']],
      ['say', ['tell']],
      ['tell', ['say']],
      ['hear', ['listen']],
      ['listen', ['hear']],
      ['look', ['see', 'watch']],
      ['see', ['look', 'watch']],
      ['borrow', ['lend']],
      ['lend', ['borrow']],
    ]);
    this.confusionPairs.set('Spanish', spanish);

    // Portuguese speakers
    const portuguese = new Map<string, string[]>([
      ['actually', ['currently']],
      ['pretend', ['intend']],
      ['push', ['pull']],
      ['pull', ['push']],
    ]);
    this.confusionPairs.set('Portuguese', portuguese);

    // Mandarin speakers
    const mandarin = new Map<string, string[]>([
      ['he', ['she']],
      ['she', ['he']],
      ['a', ['the']],
      ['the', ['a']],
    ]);
    this.confusionPairs.set('Mandarin', mandarin);
  }

  /**
   * Load vocabulary for distractor generation.
   */
  loadVocabulary(objects: LanguageObject[]): void {
    this.vocabulary.clear();
    for (const obj of objects) {
      this.vocabulary.set(obj.content.toLowerCase(), obj);
    }
  }

  /**
   * Load semantic groups.
   */
  loadSemanticGroups(groups: Map<string, string[]>): void {
    this.semanticGroups = groups;
  }

  /**
   * Load morphological families.
   */
  loadMorphologicalFamilies(families: Map<string, string[]>): void {
    this.morphologicalFamilies = families;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a distractor generator instance.
 */
export function createDistractorGenerator(): DistractorGenerator {
  return new DistractorGenerator();
}

/**
 * Quick distractor generation helper.
 */
export function generateDistractors(
  target: LanguageObject,
  count: number = 3,
  vocabulary: LanguageObject[] = []
): DistractorSet {
  const generator = createDistractorGenerator();

  if (vocabulary.length > 0) {
    generator.loadVocabulary(vocabulary);
  }

  return generator.generate(target, { count });
}
