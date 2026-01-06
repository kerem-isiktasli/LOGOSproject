/**
 * LOGOS Morphological Analysis Module
 *
 * Pure TypeScript implementation for word structure analysis.
 * Extracts roots, affixes, and morphological patterns.
 *
 * From ALGORITHMIC-FOUNDATIONS.md Part 6.1
 * From THEORETICAL-FOUNDATIONS.md Section 2.2 (LanguageObjectVector.morphological)
 *
 * Key Use Cases:
 * 1. LanguageObjectVector.morphological computation
 * 2. Transfer Effect measurement (affix training → novel word inference)
 * 3. θ_morphological estimation support
 * 4. Bottleneck detection for morphological component
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Affix (prefix, suffix, infix) with linguistic properties.
 */
export interface Affix {
  /** Surface form (e.g., 'pre-', '-tion') */
  form: string;

  /** Affix type */
  type: 'prefix' | 'suffix' | 'infix';

  /** Semantic meaning/function */
  meaning: string;

  /** Productivity: how freely it combines (0-1) */
  productivity: number;

  /** Common in which domains */
  domains?: string[];
}

/**
 * Complete morphological analysis result.
 */
export interface MorphologicalAnalysis {
  /** Original word */
  word: string;

  /** Extracted root/stem */
  root: string;

  /** Identified prefixes (in order) */
  prefixes: Affix[];

  /** Identified suffixes (in order) */
  suffixes: Affix[];

  /** Inflection type */
  inflection: InflectionType;

  /** Derivation complexity */
  derivationType: DerivationType;

  /** Morpheme count */
  morphemeCount: number;

  /** Difficulty score for learning (0-1) */
  difficultyScore: number;
}

export type InflectionType =
  | 'base'
  | 'past'
  | 'past_participle'
  | 'progressive'
  | 'plural'
  | 'third_person_singular'
  | 'comparative'
  | 'superlative'
  | 'possessive';

export type DerivationType = 'simple' | 'derived' | 'compound' | 'complex';

/**
 * Transfer measurement for morphological training.
 */
export interface MorphologicalTransfer {
  /** Affixes that were trained */
  trainedAffixes: string[];

  /** Novel words containing those affixes */
  novelWords: string[];

  /** Inference accuracy before training */
  accuracyBefore: number;

  /** Inference accuracy after training */
  accuracyAfter: number;

  /** Transfer gain (after - before) */
  transferGain: number;
}

/**
 * Morphological vector for LanguageObjectVector.
 */
export interface MorphologicalVector {
  root: string;
  prefixes: Affix[];
  suffixes: Affix[];
  inflectionParadigm: string;
  morphemeCount: number;
  productivity: number;
  transparency: number; // How predictable is meaning from parts (0-1)
}

// ============================================================================
// Affix Databases
// ============================================================================

/**
 * Common English prefixes with linguistic properties.
 */
export const ENGLISH_PREFIXES: Record<string, Affix> = {
  // Negation/Opposition
  'un': { form: 'un-', type: 'prefix', meaning: 'not, opposite', productivity: 0.9, domains: ['general'] },
  'in': { form: 'in-', type: 'prefix', meaning: 'not', productivity: 0.7, domains: ['general', 'academic'] },
  'im': { form: 'im-', type: 'prefix', meaning: 'not (before b,m,p)', productivity: 0.7, domains: ['general'] },
  'il': { form: 'il-', type: 'prefix', meaning: 'not (before l)', productivity: 0.6, domains: ['academic'] },
  'ir': { form: 'ir-', type: 'prefix', meaning: 'not (before r)', productivity: 0.6, domains: ['academic'] },
  'dis': { form: 'dis-', type: 'prefix', meaning: 'not, opposite', productivity: 0.8, domains: ['general'] },
  'non': { form: 'non-', type: 'prefix', meaning: 'not', productivity: 0.85, domains: ['general', 'technical'] },
  'anti': { form: 'anti-', type: 'prefix', meaning: 'against', productivity: 0.9, domains: ['general', 'medical'] },
  'contra': { form: 'contra-', type: 'prefix', meaning: 'against', productivity: 0.6, domains: ['medical', 'legal'] },
  'counter': { form: 'counter-', type: 'prefix', meaning: 'against', productivity: 0.7, domains: ['general'] },

  // Time/Order
  'pre': { form: 'pre-', type: 'prefix', meaning: 'before', productivity: 0.85, domains: ['general', 'medical'] },
  'post': { form: 'post-', type: 'prefix', meaning: 'after', productivity: 0.8, domains: ['general', 'medical'] },
  'ex': { form: 'ex-', type: 'prefix', meaning: 'former', productivity: 0.7, domains: ['general'] },
  'neo': { form: 'neo-', type: 'prefix', meaning: 'new', productivity: 0.6, domains: ['academic', 'medical'] },

  // Degree/Size
  'super': { form: 'super-', type: 'prefix', meaning: 'above, beyond', productivity: 0.8, domains: ['general'] },
  'sub': { form: 'sub-', type: 'prefix', meaning: 'under, below', productivity: 0.75, domains: ['general', 'medical'] },
  'over': { form: 'over-', type: 'prefix', meaning: 'excessive', productivity: 0.85, domains: ['general'] },
  'under': { form: 'under-', type: 'prefix', meaning: 'insufficient', productivity: 0.8, domains: ['general'] },
  'hyper': { form: 'hyper-', type: 'prefix', meaning: 'excessive', productivity: 0.7, domains: ['medical', 'technical'] },
  'hypo': { form: 'hypo-', type: 'prefix', meaning: 'under, below normal', productivity: 0.65, domains: ['medical'] },
  'ultra': { form: 'ultra-', type: 'prefix', meaning: 'beyond, extreme', productivity: 0.7, domains: ['general', 'medical'] },
  'semi': { form: 'semi-', type: 'prefix', meaning: 'half, partly', productivity: 0.75, domains: ['general'] },
  'multi': { form: 'multi-', type: 'prefix', meaning: 'many', productivity: 0.85, domains: ['general', 'technical'] },
  'poly': { form: 'poly-', type: 'prefix', meaning: 'many', productivity: 0.6, domains: ['medical', 'academic'] },
  'mono': { form: 'mono-', type: 'prefix', meaning: 'one', productivity: 0.6, domains: ['medical', 'academic'] },
  'bi': { form: 'bi-', type: 'prefix', meaning: 'two', productivity: 0.7, domains: ['general', 'medical'] },
  'tri': { form: 'tri-', type: 'prefix', meaning: 'three', productivity: 0.6, domains: ['general', 'medical'] },

  // Direction/Location
  'inter': { form: 'inter-', type: 'prefix', meaning: 'between', productivity: 0.8, domains: ['general', 'academic'] },
  'intra': { form: 'intra-', type: 'prefix', meaning: 'within', productivity: 0.65, domains: ['medical', 'academic'] },
  'trans': { form: 'trans-', type: 'prefix', meaning: 'across', productivity: 0.7, domains: ['general', 'medical'] },
  'extra': { form: 'extra-', type: 'prefix', meaning: 'outside', productivity: 0.7, domains: ['general', 'medical'] },
  'circum': { form: 'circum-', type: 'prefix', meaning: 'around', productivity: 0.5, domains: ['medical', 'academic'] },

  // Manner/Repetition
  're': { form: 're-', type: 'prefix', meaning: 'again, back', productivity: 0.95, domains: ['general'] },
  'mis': { form: 'mis-', type: 'prefix', meaning: 'wrongly', productivity: 0.8, domains: ['general'] },
  'co': { form: 'co-', type: 'prefix', meaning: 'together', productivity: 0.75, domains: ['general', 'business'] },
  'auto': { form: 'auto-', type: 'prefix', meaning: 'self', productivity: 0.7, domains: ['general', 'technical'] },

  // Medical-specific
  'cardio': { form: 'cardio-', type: 'prefix', meaning: 'heart', productivity: 0.6, domains: ['medical'] },
  'neuro': { form: 'neuro-', type: 'prefix', meaning: 'nerve', productivity: 0.6, domains: ['medical'] },
  'gastro': { form: 'gastro-', type: 'prefix', meaning: 'stomach', productivity: 0.55, domains: ['medical'] },
  'hemo': { form: 'hemo-', type: 'prefix', meaning: 'blood', productivity: 0.5, domains: ['medical'] },
  'dermato': { form: 'dermato-', type: 'prefix', meaning: 'skin', productivity: 0.5, domains: ['medical'] },
};

/**
 * Common English suffixes with linguistic properties.
 */
export const ENGLISH_SUFFIXES: Record<string, Affix> = {
  // Noun-forming
  'tion': { form: '-tion', type: 'suffix', meaning: 'action/state', productivity: 0.9, domains: ['general'] },
  'sion': { form: '-sion', type: 'suffix', meaning: 'action/state', productivity: 0.85, domains: ['general'] },
  'ment': { form: '-ment', type: 'suffix', meaning: 'action/result', productivity: 0.85, domains: ['general'] },
  'ness': { form: '-ness', type: 'suffix', meaning: 'state/quality', productivity: 0.9, domains: ['general'] },
  'ity': { form: '-ity', type: 'suffix', meaning: 'state/quality', productivity: 0.8, domains: ['general', 'academic'] },
  'ance': { form: '-ance', type: 'suffix', meaning: 'state/action', productivity: 0.75, domains: ['general'] },
  'ence': { form: '-ence', type: 'suffix', meaning: 'state/action', productivity: 0.75, domains: ['general'] },
  'er': { form: '-er', type: 'suffix', meaning: 'agent/doer', productivity: 0.95, domains: ['general'] },
  'or': { form: '-or', type: 'suffix', meaning: 'agent/doer', productivity: 0.8, domains: ['general', 'academic'] },
  'ist': { form: '-ist', type: 'suffix', meaning: 'person who', productivity: 0.8, domains: ['general', 'academic'] },
  'ism': { form: '-ism', type: 'suffix', meaning: 'belief/practice', productivity: 0.75, domains: ['general', 'academic'] },
  'ship': { form: '-ship', type: 'suffix', meaning: 'state/condition', productivity: 0.7, domains: ['general'] },
  'hood': { form: '-hood', type: 'suffix', meaning: 'state/condition', productivity: 0.6, domains: ['general'] },
  'dom': { form: '-dom', type: 'suffix', meaning: 'state/realm', productivity: 0.5, domains: ['general'] },

  // Adjective-forming
  'ful': { form: '-ful', type: 'suffix', meaning: 'full of', productivity: 0.85, domains: ['general'] },
  'less': { form: '-less', type: 'suffix', meaning: 'without', productivity: 0.9, domains: ['general'] },
  'able': { form: '-able', type: 'suffix', meaning: 'capable of', productivity: 0.9, domains: ['general'] },
  'ible': { form: '-ible', type: 'suffix', meaning: 'capable of', productivity: 0.7, domains: ['general'] },
  'ous': { form: '-ous', type: 'suffix', meaning: 'having quality', productivity: 0.8, domains: ['general'] },
  'ive': { form: '-ive', type: 'suffix', meaning: 'having quality', productivity: 0.8, domains: ['general'] },
  'al': { form: '-al', type: 'suffix', meaning: 'relating to', productivity: 0.85, domains: ['general', 'medical'] },
  'ial': { form: '-ial', type: 'suffix', meaning: 'relating to', productivity: 0.75, domains: ['general'] },
  'ic': { form: '-ic', type: 'suffix', meaning: 'relating to', productivity: 0.8, domains: ['general', 'academic'] },
  'ical': { form: '-ical', type: 'suffix', meaning: 'relating to', productivity: 0.75, domains: ['general', 'academic'] },
  'ary': { form: '-ary', type: 'suffix', meaning: 'relating to', productivity: 0.7, domains: ['general'] },
  'ory': { form: '-ory', type: 'suffix', meaning: 'relating to', productivity: 0.7, domains: ['general'] },

  // Verb-forming
  'ize': { form: '-ize', type: 'suffix', meaning: 'to make', productivity: 0.9, domains: ['general', 'business'] },
  'ise': { form: '-ise', type: 'suffix', meaning: 'to make (British)', productivity: 0.85, domains: ['general'] },
  'ify': { form: '-ify', type: 'suffix', meaning: 'to make', productivity: 0.8, domains: ['general'] },
  'ate': { form: '-ate', type: 'suffix', meaning: 'to make/cause', productivity: 0.75, domains: ['general', 'academic'] },
  'en': { form: '-en', type: 'suffix', meaning: 'to make', productivity: 0.6, domains: ['general'] },

  // Adverb-forming
  'ly': { form: '-ly', type: 'suffix', meaning: 'in manner of', productivity: 0.95, domains: ['general'] },
  'ward': { form: '-ward', type: 'suffix', meaning: 'direction', productivity: 0.6, domains: ['general'] },
  'wise': { form: '-wise', type: 'suffix', meaning: 'in manner of', productivity: 0.7, domains: ['general', 'business'] },

  // Medical-specific
  'itis': { form: '-itis', type: 'suffix', meaning: 'inflammation', productivity: 0.7, domains: ['medical'] },
  'osis': { form: '-osis', type: 'suffix', meaning: 'condition', productivity: 0.65, domains: ['medical'] },
  'ectomy': { form: '-ectomy', type: 'suffix', meaning: 'surgical removal', productivity: 0.6, domains: ['medical'] },
  'otomy': { form: '-otomy', type: 'suffix', meaning: 'surgical incision', productivity: 0.55, domains: ['medical'] },
  'ology': { form: '-ology', type: 'suffix', meaning: 'study of', productivity: 0.7, domains: ['medical', 'academic'] },
  'pathy': { form: '-pathy', type: 'suffix', meaning: 'disease/feeling', productivity: 0.6, domains: ['medical'] },
  'scopy': { form: '-scopy', type: 'suffix', meaning: 'examination', productivity: 0.55, domains: ['medical'] },
  'gram': { form: '-gram', type: 'suffix', meaning: 'record/image', productivity: 0.6, domains: ['medical'] },
  'graphy': { form: '-graphy', type: 'suffix', meaning: 'recording process', productivity: 0.6, domains: ['medical'] },
};

/**
 * Irregular inflection patterns.
 */
const IRREGULAR_PAST: Record<string, string> = {
  'be': 'was/were', 'have': 'had', 'do': 'did', 'go': 'went', 'say': 'said',
  'make': 'made', 'take': 'took', 'come': 'came', 'see': 'saw', 'get': 'got',
  'give': 'gave', 'find': 'found', 'think': 'thought', 'tell': 'told', 'become': 'became',
  'show': 'showed', 'leave': 'left', 'feel': 'felt', 'put': 'put', 'bring': 'brought',
  'begin': 'began', 'keep': 'kept', 'hold': 'held', 'write': 'wrote', 'stand': 'stood',
  'hear': 'heard', 'let': 'let', 'mean': 'meant', 'set': 'set', 'meet': 'met',
  'run': 'ran', 'pay': 'paid', 'sit': 'sat', 'speak': 'spoke', 'lie': 'lay',
  'lead': 'led', 'read': 'read', 'grow': 'grew', 'lose': 'lost', 'fall': 'fell',
  'understand': 'understood', 'send': 'sent', 'build': 'built', 'spend': 'spent',
  'cut': 'cut', 'win': 'won', 'break': 'broke', 'choose': 'chose', 'eat': 'ate',
};

const IRREGULAR_PLURAL: Record<string, string> = {
  'child': 'children', 'man': 'men', 'woman': 'women', 'tooth': 'teeth',
  'foot': 'feet', 'person': 'people', 'mouse': 'mice', 'goose': 'geese',
  'ox': 'oxen', 'sheep': 'sheep', 'deer': 'deer', 'fish': 'fish',
  'series': 'series', 'species': 'species', 'analysis': 'analyses',
  'diagnosis': 'diagnoses', 'thesis': 'theses', 'crisis': 'crises',
  'phenomenon': 'phenomena', 'criterion': 'criteria', 'datum': 'data',
  'medium': 'media', 'bacterium': 'bacteria', 'curriculum': 'curricula',
};

// ============================================================================
// Word Segmentation Types (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * Morpheme unit for word segmentation.
 */
export interface MorphemeUnit {
  /** The morpheme string */
  morpheme: string;

  /** Type of morpheme */
  type: 'root' | 'prefix' | 'suffix' | 'infix' | 'inflection';

  /** Position in original word (0-indexed) */
  position: number;

  /** Semantic meaning */
  meaning?: string;

  /** Boundary marker for UI highlighting */
  boundary: 'start' | 'middle' | 'end';
}

/**
 * Syllable unit for pronunciation.
 */
export interface SyllableUnit {
  /** The syllable string */
  syllable: string;

  /** Stress level (0=unstressed, 1=primary, 2=secondary) */
  stress: 0 | 1 | 2;

  /** Position in word */
  position: number;
}

/**
 * Complete word segmentation result.
 * Per DEVELOPMENT-PROTOCOL.md Phase 2 Word Organization.
 */
export interface WordSegmentation {
  /** Original word */
  word: string;

  /** Morpheme segments (meaning units) */
  morphemeSegments: MorphemeUnit[];

  /** Syllable segments (pronunciation units) */
  syllableSegments: SyllableUnit[];

  /** Total morpheme count */
  morphemeCount: number;

  /** Total syllable count */
  syllableCount: number;
}

/**
 * Morphological family for a root.
 * Per DEVELOPMENT-PROTOCOL.md Phase 2.
 */
export interface MorphologicalFamily {
  /** Root/stem word */
  root: string;

  /** All words derived from this root */
  derivatives: string[];

  /** Family size (number of derivatives) */
  familySize: number;

  /** Productivity score (how actively root generates new words) */
  productivity: number;

  /** Affixes used in derivatives */
  affixesUsed: string[];
}

/**
 * Multi-layer word card for UI display.
 * Per DEVELOPMENT-PROTOCOL.md Phase 2.
 */
export interface MultiLayerWordCard {
  orthographic: {
    written: string;
    graphemes: string[];
    highlightedMorphemes: string[];
  };
  morphological: {
    root: string;
    affixes: Affix[];
    familySize: number;
    productivity: number;
  };
  semantic: {
    definitions: string[];
    collocations: string[];
    domainTags: string[];
  };
}

// ============================================================================
// Word Segmentation (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * Segment a word into morpheme and syllable units.
 *
 * @param word - Word to segment
 * @param domain - Optional domain context
 * @returns Complete word segmentation
 *
 * @example
 * ```typescript
 * const seg = segmentWord('unhappiness');
 * // seg.morphemeSegments = [
 * //   { morpheme: 'un', type: 'prefix', meaning: 'not', ... },
 * //   { morpheme: 'happy', type: 'root', ... },
 * //   { morpheme: 'ness', type: 'suffix', meaning: 'state of', ... }
 * // ]
 * ```
 */
export function segmentWord(word: string, domain?: string): WordSegmentation {
  const normalized = word.toLowerCase().trim();
  const morphemeSegments: MorphemeUnit[] = [];
  let position = 0;
  let remaining = normalized;

  // 1. Extract prefixes
  const sortedPrefixes = Object.entries(ENGLISH_PREFIXES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [prefix, affix] of sortedPrefixes) {
    if (remaining.startsWith(prefix) && remaining.length > prefix.length + 2) {
      // Check domain relevance
      if (!domain || !affix.domains || affix.domains.includes(domain) || affix.domains.includes('general')) {
        morphemeSegments.push({
          morpheme: prefix,
          type: 'prefix',
          position,
          meaning: affix.meaning,
          boundary: 'start'
        });
        position += prefix.length;
        remaining = remaining.slice(prefix.length);
        break; // Only one prefix per pass (can iterate for multiple)
      }
    }
  }

  // 2. Extract suffixes (from end, store temporarily)
  const suffixSegments: MorphemeUnit[] = [];
  const sortedSuffixes = Object.entries(ENGLISH_SUFFIXES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [suffix, affix] of sortedSuffixes) {
    if (remaining.endsWith(suffix) && remaining.length > suffix.length + 2) {
      if (!domain || !affix.domains || affix.domains.includes(domain) || affix.domains.includes('general')) {
        suffixSegments.unshift({
          morpheme: suffix,
          type: 'suffix',
          position: normalized.length - suffix.length,
          meaning: affix.meaning,
          boundary: 'end'
        });
        remaining = remaining.slice(0, -suffix.length);
        break; // Only one suffix per pass
      }
    }
  }

  // 3. Check for inflectional suffixes
  const inflection = detectInflectionSuffix(remaining);
  if (inflection) {
    suffixSegments.push({
      morpheme: inflection.suffix,
      type: 'inflection',
      position: normalized.length - inflection.suffix.length,
      meaning: inflection.meaning,
      boundary: 'end'
    });
    remaining = remaining.slice(0, -inflection.suffix.length);
  }

  // 4. What remains is the root
  if (remaining.length > 0) {
    morphemeSegments.push({
      morpheme: remaining,
      type: 'root',
      position,
      boundary: morphemeSegments.length === 0 ? 'start' : 'middle'
    });
  }

  // 5. Add suffix segments
  morphemeSegments.push(...suffixSegments);

  // 6. Segment into syllables
  const syllableSegments = segmentIntoSyllables(normalized);

  return {
    word: normalized,
    morphemeSegments,
    syllableSegments,
    morphemeCount: morphemeSegments.length,
    syllableCount: syllableSegments.length
  };
}

/**
 * Detect inflectional suffix.
 */
function detectInflectionSuffix(word: string): { suffix: string; meaning: string } | null {
  // Order matters - check longer patterns first
  if (word.endsWith('ing')) {
    return { suffix: 'ing', meaning: 'progressive aspect' };
  }
  if (word.endsWith('ed')) {
    return { suffix: 'ed', meaning: 'past tense' };
  }
  if (word.endsWith('ies')) {
    return { suffix: 'ies', meaning: 'plural (y->ies)' };
  }
  if (word.endsWith('es') && word.length > 3) {
    return { suffix: 'es', meaning: 'plural' };
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    return { suffix: 's', meaning: 'plural/3rd person' };
  }
  if (word.endsWith('er') && word.length > 3) {
    // Check if it's comparative or agent suffix
    const base = word.slice(0, -2);
    if (base.endsWith(base.charAt(base.length - 1))) {
      return { suffix: 'er', meaning: 'comparative' };
    }
  }
  if (word.endsWith('est')) {
    return { suffix: 'est', meaning: 'superlative' };
  }
  return null;
}

/**
 * Segment word into syllables.
 */
function segmentIntoSyllables(word: string): SyllableUnit[] {
  const syllables: SyllableUnit[] = [];
  const vowelPattern = /[aeiouy]+/gi;
  let match;
  let lastEnd = 0;
  let syllableIndex = 0;

  // Find vowel nuclei
  const vowelPositions: number[] = [];
  while ((match = vowelPattern.exec(word)) !== null) {
    vowelPositions.push(match.index);
  }

  if (vowelPositions.length === 0) {
    // No vowels - treat whole word as one syllable
    syllables.push({
      syllable: word,
      stress: 1,
      position: 0
    });
    return syllables;
  }

  // Split between vowel groups
  for (let i = 0; i < vowelPositions.length; i++) {
    const vowelStart = vowelPositions[i];
    const nextVowelStart = vowelPositions[i + 1] || word.length;

    // Find syllable boundary (typically split consonant clusters)
    let syllableEnd: number;
    if (i === vowelPositions.length - 1) {
      syllableEnd = word.length;
    } else {
      // Find consonants between vowels
      const gap = word.slice(vowelStart + 1, nextVowelStart);
      const consonants = gap.match(/[^aeiouy]+/i)?.[0] || '';

      if (consonants.length <= 1) {
        syllableEnd = nextVowelStart;
      } else {
        // Split consonant cluster (put first consonant with previous syllable)
        syllableEnd = vowelStart + 1 + Math.ceil(consonants.length / 2);
      }
    }

    const syllable = word.slice(lastEnd, syllableEnd);
    if (syllable.length > 0) {
      syllables.push({
        syllable,
        stress: syllableIndex === 0 ? 1 : 0, // Default: first syllable stressed
        position: syllableIndex
      });
      syllableIndex++;
    }
    lastEnd = syllableEnd;
  }

  // Handle trailing consonants
  if (lastEnd < word.length) {
    if (syllables.length > 0) {
      syllables[syllables.length - 1].syllable += word.slice(lastEnd);
    } else {
      syllables.push({
        syllable: word.slice(lastEnd),
        stress: 1,
        position: 0
      });
    }
  }

  return syllables;
}

// ============================================================================
// Morphological Family Building (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * Common English roots for family building.
 */
const COMMON_ROOTS: Record<string, string[]> = {
  'act': ['action', 'active', 'activity', 'actor', 'react', 'reaction', 'interactive', 'activate'],
  'form': ['inform', 'information', 'format', 'formal', 'reform', 'transform', 'perform', 'formation'],
  'port': ['import', 'export', 'report', 'transport', 'support', 'portable', 'deportation'],
  'ject': ['inject', 'project', 'reject', 'subject', 'object', 'injection', 'projector'],
  'dict': ['predict', 'dictate', 'dictionary', 'contradict', 'verdict', 'addiction'],
  'scrib': ['describe', 'prescribe', 'subscribe', 'inscribe', 'manuscript', 'description'],
  'spect': ['inspect', 'expect', 'respect', 'prospect', 'spectator', 'inspection'],
  'duct': ['conduct', 'produce', 'reduce', 'introduce', 'product', 'production'],
  'struct': ['construct', 'instruct', 'destruct', 'structure', 'instruction', 'construction'],
  'tend': ['extend', 'intend', 'attend', 'pretend', 'extension', 'attention', 'intensive'],
  'vert': ['convert', 'invert', 'divert', 'revert', 'conversion', 'vertical'],
  'mit': ['commit', 'submit', 'permit', 'admit', 'transmit', 'commission', 'permission'],
  'cede': ['precede', 'succeed', 'proceed', 'exceed', 'concede', 'recession'],
  'press': ['express', 'impress', 'compress', 'depress', 'suppress', 'expression', 'impression'],
  'pose': ['compose', 'expose', 'impose', 'propose', 'dispose', 'composition', 'exposure'],
};

/**
 * Build a morphological family for a given root.
 *
 * @param root - Root word or stem
 * @param knownWords - Optional corpus of known words to search
 * @returns Morphological family with derivatives
 *
 * @example
 * ```typescript
 * const family = buildMorphologicalFamily('act');
 * // family.derivatives = ['action', 'active', 'react', 'actor', ...]
 * // family.familySize = 8
 * // family.productivity = 0.85
 * ```
 */
export function buildMorphologicalFamily(
  root: string,
  knownWords?: string[]
): MorphologicalFamily {
  const normalized = root.toLowerCase().trim();
  const derivatives: Set<string> = new Set();
  const affixesUsed: Set<string> = new Set();

  // 1. Check if root is in our known roots database
  if (COMMON_ROOTS[normalized]) {
    COMMON_ROOTS[normalized].forEach(d => derivatives.add(d));
  }

  // 2. Search known words for derivatives containing the root
  if (knownWords) {
    for (const word of knownWords) {
      const wordLower = word.toLowerCase();
      if (wordLower.includes(normalized) && wordLower !== normalized) {
        derivatives.add(wordLower);
      }
    }
  }

  // 3. Generate potential derivatives using productive affixes
  const productivePrefixes = Object.entries(ENGLISH_PREFIXES)
    .filter(([_, a]) => a.productivity > 0.7)
    .map(([p]) => p);

  const productiveSuffixes = Object.entries(ENGLISH_SUFFIXES)
    .filter(([_, a]) => a.productivity > 0.7)
    .map(([s]) => s);

  // Generate prefix + root combinations
  for (const prefix of productivePrefixes) {
    const derivative = prefix + normalized;
    derivatives.add(derivative);
    affixesUsed.add(prefix);
  }

  // Generate root + suffix combinations
  for (const suffix of productiveSuffixes) {
    let derivative = normalized + suffix;
    // Handle spelling changes
    if (normalized.endsWith('e') && suffix.startsWith('i')) {
      derivative = normalized.slice(0, -1) + suffix;
    }
    if (normalized.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(normalized.charAt(normalized.length - 2))) {
      if (suffix !== 'ing') {
        derivative = normalized.slice(0, -1) + 'i' + suffix;
      }
    }
    derivatives.add(derivative);
    affixesUsed.add(suffix);
  }

  // 4. Analyze existing derivatives for affixes used
  for (const derivative of derivatives) {
    const analysis = analyzeMorphology(derivative);
    analysis.prefixes.forEach(p => affixesUsed.add(p.form.replace('-', '')));
    analysis.suffixes.forEach(s => affixesUsed.add(s.form.replace('-', '')));
  }

  // 5. Calculate productivity
  // Based on: family size, affix diversity, and whether root generates novel words
  const familySize = derivatives.size;
  const affixDiversity = affixesUsed.size;
  const productivity = Math.min(1, (familySize * 0.1) + (affixDiversity * 0.05) + 0.3);

  return {
    root: normalized,
    derivatives: Array.from(derivatives).slice(0, 50), // Limit for practical use
    familySize,
    productivity,
    affixesUsed: Array.from(affixesUsed)
  };
}

// ============================================================================
// Morphological Score Computation (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * Compute the morphological score (M score) for a word.
 * This is used for the extended z(w) vector in LanguageObjectVector.
 *
 * M = familySize × productivity × transparency
 *
 * Higher M score indicates:
 * - Word belongs to a large morphological family
 * - Root is productive (generates many derivatives)
 * - Meaning is transparent from morphemes
 *
 * @param word - Word to analyze
 * @param domain - Optional domain context
 * @param knownWords - Optional corpus for family building
 * @returns M score (0-1, higher = richer morphological structure)
 *
 * @example
 * ```typescript
 * const score1 = computeMorphologicalScore('cat');        // Low (~0.2)
 * const score2 = computeMorphologicalScore('unhappiness'); // High (~0.7)
 * ```
 */
export function computeMorphologicalScore(
  word: string,
  domain?: string,
  knownWords?: string[]
): number {
  const analysis = analyzeMorphology(word, domain);
  const vector = toMorphologicalVector(word, domain);

  // 1. Get family information
  const family = buildMorphologicalFamily(analysis.root, knownWords);

  // 2. Normalize family size (log scale, max ~50 words)
  const familySizeNorm = Math.min(1, Math.log10(family.familySize + 1) / Math.log10(50));

  // 3. Get productivity from family
  const productivityNorm = family.productivity;

  // 4. Get transparency from vector
  const transparencyNorm = vector.transparency;

  // 5. Consider morpheme count (more morphemes = richer structure, but diminishing returns)
  const morphemeBonus = Math.min(0.2, (analysis.morphemeCount - 1) * 0.05);

  // 6. Domain-specific bonus
  let domainBonus = 0;
  if (domain) {
    const domainAffixes = getAffixesForDomain(domain);
    const hasRelevantAffix = analysis.prefixes.some(p =>
      domainAffixes.prefixes.some(dp => dp.form === p.form)
    ) || analysis.suffixes.some(s =>
      domainAffixes.suffixes.some(ds => ds.form === s.form)
    );
    if (hasRelevantAffix) {
      domainBonus = 0.1;
    }
  }

  // 7. Combine scores
  const mScore =
    familySizeNorm * 0.3 +
    productivityNorm * 0.3 +
    transparencyNorm * 0.2 +
    morphemeBonus +
    domainBonus;

  return Math.min(1, Math.max(0, mScore));
}

/**
 * Build word indexes for fast retrieval by morphological properties.
 *
 * @param words - Array of words to index
 * @returns Indexes organized by root, affix, and family
 */
export function buildWordIndexes(words: string[]): {
  byRoot: Map<string, string[]>;
  byPrefix: Map<string, string[]>;
  bySuffix: Map<string, string[]>;
  byFamilySize: Map<number, string[]>;
} {
  const byRoot = new Map<string, string[]>();
  const byPrefix = new Map<string, string[]>();
  const bySuffix = new Map<string, string[]>();
  const byFamilySize = new Map<number, string[]>();

  for (const word of words) {
    const analysis = analyzeMorphology(word);

    // Index by root
    const roots = byRoot.get(analysis.root) || [];
    roots.push(word);
    byRoot.set(analysis.root, roots);

    // Index by prefix
    for (const prefix of analysis.prefixes) {
      const key = prefix.form.replace('-', '');
      const list = byPrefix.get(key) || [];
      list.push(word);
      byPrefix.set(key, list);
    }

    // Index by suffix
    for (const suffix of analysis.suffixes) {
      const key = suffix.form.replace('-', '');
      const list = bySuffix.get(key) || [];
      list.push(word);
      bySuffix.set(key, list);
    }

    // Index by morpheme count (proxy for family structure)
    const count = analysis.morphemeCount;
    const sizeList = byFamilySize.get(count) || [];
    sizeList.push(word);
    byFamilySize.set(count, sizeList);
  }

  return { byRoot, byPrefix, bySuffix, byFamilySize };
}

/**
 * Build a multi-layer word card for UI display.
 *
 * @param word - Word to create card for
 * @param domain - Optional domain context
 * @returns Multi-layer word card
 */
export function buildMultiLayerWordCard(
  word: string,
  domain?: string
): MultiLayerWordCard {
  const analysis = analyzeMorphology(word, domain);
  const family = buildMorphologicalFamily(analysis.root);

  return {
    orthographic: {
      written: word,
      graphemes: word.split(''),
      highlightedMorphemes: [
        ...analysis.prefixes.map(p => p.form.replace('-', '')),
        analysis.root,
        ...analysis.suffixes.map(s => s.form.replace('-', ''))
      ]
    },
    morphological: {
      root: analysis.root,
      affixes: [...analysis.prefixes, ...analysis.suffixes],
      familySize: family.familySize,
      productivity: family.productivity
    },
    semantic: {
      definitions: [], // Would come from dictionary lookup
      collocations: [], // Would come from PMI analysis
      domainTags: domain ? [domain] : []
    }
  };
}

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Analyze the morphological structure of a word.
 *
 * @param word - Word to analyze
 * @param domain - Optional domain for specialized affixes
 * @returns Complete morphological analysis
 *
 * @example
 * ```typescript
 * const result = analyzeMorphology('contraindication', 'medical');
 * // {
 * //   word: 'contraindication',
 * //   root: 'indic',
 * //   prefixes: [{ form: 'contra-', meaning: 'against', ... }],
 * //   suffixes: [{ form: '-tion', meaning: 'action/state', ... }],
 * //   ...
 * // }
 * ```
 */
export function analyzeMorphology(
  word: string,
  domain?: string,
  maxPasses: number = 3
): MorphologicalAnalysis {
  const normalized = word.toLowerCase().trim();
  const prefixes: Affix[] = [];
  const suffixes: Affix[] = [];
  let remaining = normalized;
  let derivationType: DerivationType = 'simple';

  // Sorted affix lists for matching
  const sortedPrefixes = Object.entries(ENGLISH_PREFIXES)
    .sort((a, b) => b[0].length - a[0].length);
  const sortedSuffixes = Object.entries(ENGLISH_SUFFIXES)
    .sort((a, b) => b[0].length - a[0].length);

  // Multi-pass prefix extraction (e.g., "anti-re-" or "un-pre-")
  for (let pass = 0; pass < maxPasses; pass++) {
    let foundPrefix = false;
    for (const [prefix, affix] of sortedPrefixes) {
      if (remaining.startsWith(prefix) && remaining.length > prefix.length + 2) {
        // Domain filtering
        if (!domain || !affix.domains || affix.domains.includes(domain) || affix.domains.includes('general')) {
          prefixes.push(affix);
          remaining = remaining.slice(prefix.length);
          derivationType = 'derived';
          foundPrefix = true;
          break; // Found one prefix this pass, continue to next pass
        }
      }
    }
    if (!foundPrefix) break; // No more prefixes to extract
  }

  // Multi-pass suffix extraction (e.g., "-able-ity" or "-ation-al")
  // Work from outermost to innermost
  for (let pass = 0; pass < maxPasses; pass++) {
    let foundSuffix = false;
    for (const [suffix, affix] of sortedSuffixes) {
      if (remaining.endsWith(suffix) && remaining.length > suffix.length + 2) {
        if (!domain || !affix.domains || affix.domains.includes(domain) || affix.domains.includes('general')) {
          suffixes.unshift(affix); // Add to front (innermost first)
          remaining = remaining.slice(0, -suffix.length);
          derivationType = 'derived';
          foundSuffix = true;
          break; // Found one suffix this pass, continue to next pass
        }
      }
    }
    if (!foundSuffix) break; // No more suffixes to extract
  }

  // Handle spelling changes that may have occurred during derivation
  remaining = normalizeRoot(remaining);

  // Detect inflection
  const inflection = detectInflection(normalized, remaining);

  // If both prefix and suffix, it's complex
  if (prefixes.length > 0 && suffixes.length > 0) {
    derivationType = 'complex';
  }

  // If multiple affixes of same type, it's also complex
  if (prefixes.length > 1 || suffixes.length > 1) {
    derivationType = 'complex';
  }

  // Check for compound (contains hyphen or known compound patterns)
  if (normalized.includes('-') || isCompound(remaining)) {
    derivationType = 'compound';
  }

  // Calculate morpheme count and difficulty
  const morphemeCount = 1 + prefixes.length + suffixes.length;
  const difficultyScore = calculateMorphologicalDifficulty(
    prefixes,
    suffixes,
    inflection,
    derivationType
  );

  return {
    word: normalized,
    root: remaining,
    prefixes,
    suffixes,
    inflection,
    derivationType,
    morphemeCount,
    difficultyScore
  };
}

/**
 * Normalize root after affix stripping.
 * Handles common spelling changes during derivation.
 */
function normalizeRoot(root: string): string {
  // Handle doubled consonants (e.g., "runn" -> "run")
  if (root.length >= 3 && root[root.length - 1] === root[root.length - 2]) {
    const potentialRoot = root.slice(0, -1);
    // Keep doubled consonants if they're part of common patterns
    const keepDoubled = ['ll', 'ss', 'ff', 'zz', 'cc'];
    if (!keepDoubled.includes(root.slice(-2))) {
      return potentialRoot;
    }
  }

  // Handle y -> i transformation (e.g., "happi" -> "happy")
  if (root.endsWith('i') && root.length >= 3) {
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    if (consonants.includes(root[root.length - 2])) {
      return root.slice(0, -1) + 'y';
    }
  }

  // Handle dropped 'e' (e.g., "believ" -> "believe")
  if (root.length >= 3 && !root.match(/[aeiou]$/)) {
    // Could have dropped 'e' - return as is since we can't be certain
  }

  return root;
}

/**
 * Detect inflection type from word form.
 */
function detectInflection(original: string, root: string): InflectionType {
  // Check irregular forms first
  if (Object.values(IRREGULAR_PAST).some(v => v.includes(original))) {
    return 'past';
  }
  if (Object.values(IRREGULAR_PLURAL).includes(original)) {
    return 'plural';
  }

  // Regular patterns
  if (original.endsWith("'s") || original.endsWith("s'")) {
    return 'possessive';
  }
  if (original.endsWith('ing')) {
    return 'progressive';
  }
  if (original.endsWith('ed')) {
    // Could be past or past participle - default to past
    return 'past';
  }
  if (original.endsWith('er') && !ENGLISH_SUFFIXES['er']) {
    return 'comparative';
  }
  if (original.endsWith('est')) {
    return 'superlative';
  }
  if (original.endsWith('s') && !original.endsWith('ss') && !original.endsWith('us')) {
    // Could be plural or 3rd person singular
    return 'plural';
  }

  return 'base';
}

/**
 * Check if a word is likely a compound.
 */
function isCompound(word: string): boolean {
  // Common compound patterns
  const compoundPatterns = [
    /^(air|back|book|day|down|eye|fire|foot|hand|head|heart|home|house|life|light|night|out|over|rain|school|sea|side|snow|some|sun|time|under|up|water|wind|work)/,
    /(book|case|day|door|fall|fire|ground|house|land|light|line|maker|man|mark|master|mate|piece|place|room|side|smith|stone|time|town|ward|way|woman|wood|work|yard)$/
  ];

  return compoundPatterns.some(pattern => pattern.test(word));
}

/**
 * Calculate morphological difficulty score.
 */
function calculateMorphologicalDifficulty(
  prefixes: Affix[],
  suffixes: Affix[],
  inflection: InflectionType,
  derivationType: DerivationType
): number {
  let score = 0;

  // Base difficulty by derivation type
  const typeScores: Record<DerivationType, number> = {
    'simple': 0.1,
    'derived': 0.3,
    'compound': 0.4,
    'complex': 0.5
  };
  score += typeScores[derivationType];

  // Add difficulty for each affix (weighted by inverse productivity)
  for (const prefix of prefixes) {
    score += (1 - prefix.productivity) * 0.15;
  }
  for (const suffix of suffixes) {
    score += (1 - suffix.productivity) * 0.15;
  }

  // Irregular inflection adds difficulty
  if (inflection !== 'base') {
    score += 0.1;
  }

  return Math.min(1, score);
}

// ============================================================================
// Vector Generation
// ============================================================================

/**
 * Generate morphological vector for LanguageObjectVector.
 *
 * @param word - Word to vectorize
 * @param domain - Optional domain context
 * @returns MorphologicalVector for the word
 */
export function toMorphologicalVector(
  word: string,
  domain?: string
): MorphologicalVector {
  const analysis = analyzeMorphology(word, domain);

  // Calculate transparency (how predictable meaning is from parts)
  const transparency = calculateTransparency(analysis);

  // Calculate overall productivity
  const avgProductivity = calculateAverageProductivity(analysis);

  // Build inflection paradigm string
  const paradigm = buildInflectionParadigm(analysis);

  return {
    root: analysis.root,
    prefixes: analysis.prefixes,
    suffixes: analysis.suffixes,
    inflectionParadigm: paradigm,
    morphemeCount: analysis.morphemeCount,
    productivity: avgProductivity,
    transparency
  };
}

/**
 * Calculate semantic transparency (meaning predictability from parts).
 */
function calculateTransparency(analysis: MorphologicalAnalysis): number {
  if (analysis.derivationType === 'simple') {
    return 1.0; // Simple words are fully transparent
  }

  let transparency = 0.5; // Base for derived words

  // High productivity affixes increase transparency
  for (const prefix of analysis.prefixes) {
    transparency += prefix.productivity * 0.1;
  }
  for (const suffix of analysis.suffixes) {
    transparency += suffix.productivity * 0.1;
  }

  // Complex derivation reduces transparency
  if (analysis.derivationType === 'complex') {
    transparency -= 0.1;
  }

  return Math.min(1, Math.max(0, transparency));
}

/**
 * Calculate average affix productivity.
 */
function calculateAverageProductivity(analysis: MorphologicalAnalysis): number {
  const affixes = [...analysis.prefixes, ...analysis.suffixes];
  if (affixes.length === 0) return 1.0;

  const sum = affixes.reduce((acc, affix) => acc + affix.productivity, 0);
  return sum / affixes.length;
}

/**
 * Build inflection paradigm description.
 */
function buildInflectionParadigm(analysis: MorphologicalAnalysis): string {
  const parts: string[] = [];

  if (analysis.prefixes.length > 0) {
    parts.push(`prefix:${analysis.prefixes.map(p => p.form).join('+')}`);
  }
  if (analysis.suffixes.length > 0) {
    parts.push(`suffix:${analysis.suffixes.map(s => s.form).join('+')}`);
  }
  parts.push(`inflection:${analysis.inflection}`);
  parts.push(`type:${analysis.derivationType}`);

  return parts.join('|');
}

// ============================================================================
// Transfer Effect Functions
// ============================================================================

/**
 * Identify words that share affixes with trained items.
 *
 * @param trainedWords - Words the user has practiced
 * @param candidateWords - Potential novel words
 * @param domain - Optional domain filter
 * @returns Words that could benefit from transfer
 */
export function findTransferCandidates(
  trainedWords: string[],
  candidateWords: string[],
  domain?: string
): { word: string; sharedAffixes: string[]; transferPotential: number }[] {
  // Extract affixes from trained words
  const trainedAffixes = new Set<string>();
  for (const word of trainedWords) {
    const analysis = analyzeMorphology(word, domain);
    analysis.prefixes.forEach(p => trainedAffixes.add(p.form));
    analysis.suffixes.forEach(s => trainedAffixes.add(s.form));
  }

  // Find candidates with shared affixes
  const results: { word: string; sharedAffixes: string[]; transferPotential: number }[] = [];

  for (const word of candidateWords) {
    const analysis = analyzeMorphology(word, domain);
    const wordAffixes = [
      ...analysis.prefixes.map(p => p.form),
      ...analysis.suffixes.map(s => s.form)
    ];

    const shared = wordAffixes.filter(a => trainedAffixes.has(a));

    if (shared.length > 0) {
      // Transfer potential based on shared affix count and productivity
      const potential = shared.length * 0.3 + (1 - analysis.difficultyScore) * 0.2;
      results.push({
        word,
        sharedAffixes: shared,
        transferPotential: Math.min(1, potential)
      });
    }
  }

  return results.sort((a, b) => b.transferPotential - a.transferPotential);
}

/**
 * Calculate transfer effect measurement.
 *
 * @param trainedAffixes - Affixes that were explicitly trained
 * @param testResults - Test results on novel words containing those affixes
 * @returns Transfer measurement
 */
export function measureTransferEffect(
  trainedAffixes: string[],
  testResults: { word: string; correctBefore: boolean; correctAfter: boolean }[]
): MorphologicalTransfer {
  const novelWords = testResults.map(r => r.word);

  const correctBefore = testResults.filter(r => r.correctBefore).length;
  const correctAfter = testResults.filter(r => r.correctAfter).length;

  const accuracyBefore = correctBefore / testResults.length;
  const accuracyAfter = correctAfter / testResults.length;

  return {
    trainedAffixes,
    novelWords,
    accuracyBefore,
    accuracyAfter,
    transferGain: accuracyAfter - accuracyBefore
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all affixes used in a domain.
 */
export function getAffixesForDomain(domain: string): { prefixes: Affix[]; suffixes: Affix[] } {
  const prefixes = Object.values(ENGLISH_PREFIXES)
    .filter(a => a.domains?.includes(domain) || a.domains?.includes('general'));

  const suffixes = Object.values(ENGLISH_SUFFIXES)
    .filter(a => a.domains?.includes(domain) || a.domains?.includes('general'));

  return { prefixes, suffixes };
}

/**
 * Check if a word contains a specific affix.
 */
export function hasAffix(word: string, affix: string, type: 'prefix' | 'suffix'): boolean {
  const normalized = word.toLowerCase();
  const affixNorm = affix.replace('-', '').toLowerCase();

  if (type === 'prefix') {
    return normalized.startsWith(affixNorm);
  } else {
    return normalized.endsWith(affixNorm);
  }
}

/**
 * Extract the base form (lemma) from an inflected word.
 * Simplified implementation - for production, use a proper lemmatizer.
 */
export function extractLemma(word: string): string {
  const normalized = word.toLowerCase();

  // Check irregular forms
  for (const [base, irregular] of Object.entries(IRREGULAR_PAST)) {
    if (irregular.includes(normalized)) return base;
  }
  for (const [base, irregular] of Object.entries(IRREGULAR_PLURAL)) {
    if (irregular === normalized) return base;
  }

  // Regular patterns
  if (normalized.endsWith('ies')) {
    return normalized.slice(0, -3) + 'y';
  }
  if (normalized.endsWith('es') && normalized.length > 3) {
    return normalized.slice(0, -2);
  }
  if (normalized.endsWith('ing')) {
    // Running -> run, making -> make
    const base = normalized.slice(0, -3);
    if (base.endsWith(base.charAt(base.length - 1))) {
      return base.slice(0, -1); // running -> run
    }
    return base + 'e'; // making -> make (simplified)
  }
  if (normalized.endsWith('ed')) {
    const base = normalized.slice(0, -2);
    if (base.endsWith(base.charAt(base.length - 1))) {
      return base.slice(0, -1); // stopped -> stop
    }
    return base;
  }
  if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Get morphological complexity level (for task generation).
 */
export function getMorphologicalComplexity(word: string): 'simple' | 'moderate' | 'complex' {
  const analysis = analyzeMorphology(word);

  if (analysis.morphemeCount <= 1) return 'simple';
  if (analysis.morphemeCount <= 3 && analysis.derivationType !== 'complex') return 'moderate';
  return 'complex';
}
