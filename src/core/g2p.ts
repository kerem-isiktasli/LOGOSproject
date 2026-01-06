/**
 * LOGOS Grapheme-to-Phoneme (G2P) Analysis Module
 *
 * Pure TypeScript implementation for spelling-pronunciation analysis.
 * Analyzes pronunciation difficulty based on grapheme-phoneme correspondences.
 *
 * From ALGORITHMIC-FOUNDATIONS.md Part 6.3
 * From THEORETICAL-FOUNDATIONS.md Section 2.2 (LanguageObjectVector.phonological/orthographic)
 *
 * Key Use Cases:
 * 1. LanguageObjectVector.phonological/orthographic computation
 * 2. Pronunciation difficulty estimation for task calibration
 * 3. L1-specific mispronunciation prediction
 * 4. θ_phonological estimation support
 * 5. Transfer Effect measurement (G2P training → vocabulary acquisition)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * G2P rule defining grapheme-to-phoneme mapping.
 */
export interface G2PRule {
  /** Grapheme pattern (regex or string) */
  pattern: RegExp;

  /** Resulting phoneme(s) in IPA */
  phoneme: string;

  /** Positional context where rule applies */
  context: G2PContext;

  /** Exception words that don't follow this rule */
  exceptions: string[];

  /** Rule frequency/reliability (0-1) */
  reliability: number;

  /** Domains where rule is particularly relevant */
  domains?: string[];
}

export type G2PContext = 'initial' | 'medial' | 'final' | 'any';

/**
 * G2P difficulty analysis result.
 */
export interface G2PDifficulty {
  /** Word being analyzed */
  word: string;

  /** Identified irregular patterns */
  irregularPatterns: IrregularPattern[];

  /** Overall difficulty score (0-1) */
  difficultyScore: number;

  /** Potential mispronunciations by L1 */
  potentialMispronunciations: L1Mispronunciation[];

  /** Syllable count */
  syllableCount: number;

  /** Has silent letters */
  hasSilentLetters: boolean;

  /** Has irregular stress */
  hasIrregularStress: boolean;
}

/**
 * Irregular pattern detected in a word.
 */
export interface IrregularPattern {
  /** The grapheme pattern */
  pattern: string;

  /** Why it's irregular */
  reason: string;

  /** Position in word */
  position: number;

  /** Difficulty contribution (0-1) */
  difficulty: number;
}

/**
 * L1-influenced mispronunciation prediction.
 */
export interface L1Mispronunciation {
  /** L1 language */
  l1: string;

  /** Expected mispronunciation */
  mispronunciation: string;

  /** Reason for this error pattern */
  reason: string;

  /** Probability of this error (0-1) */
  probability: number;
}

/**
 * Phonological vector for LanguageObjectVector.
 */
export interface PhonologicalVector {
  /** Phoneme representation (IPA) */
  phonemes: string[];

  /** Syllable structure (e.g., CVC, CVCC) */
  syllableStructure: string;

  /** Stress pattern (1=primary, 2=secondary, 0=unstressed) */
  stress: number[];

  /** Number of syllables */
  syllableCount: number;
}

/**
 * Orthographic vector for LanguageObjectVector.
 */
export interface OrthographicVector {
  /** Grapheme representation */
  graphemes: string;

  /** Identified spelling patterns */
  spellingPatterns: string[];

  /** Has G2P exceptions */
  hasExceptions: boolean;

  /** Exception types if any */
  exceptionTypes: string[];
}

/**
 * Transfer effect for G2P training.
 */
export interface G2PTransfer {
  /** Rules that were trained */
  trainedRules: string[];

  /** Vocabulary acquisition rate before training */
  acquisitionRateBefore: number;

  /** Vocabulary acquisition rate after training */
  acquisitionRateAfter: number;

  /** Transfer gain */
  transferGain: number;
}

// ============================================================================
// G2P Rule Database
// ============================================================================

/**
 * English G2P rules organized by category.
 */
export const ENGLISH_G2P_RULES: G2PRule[] = [
  // ==========================================================================
  // Vowel Rules
  // ==========================================================================

  // Magic E / Silent E patterns
  {
    pattern: /a[^aeiou]e$/,
    phoneme: '/eɪ/',
    context: 'final',
    exceptions: ['have', 'are', 'give', 'love', 'above', 'dove', 'glove', 'shove'],
    reliability: 0.85,
  },
  {
    pattern: /i[^aeiou]e$/,
    phoneme: '/aɪ/',
    context: 'final',
    exceptions: ['live', 'give', 'native', 'active', 'captive'],
    reliability: 0.9,
  },
  {
    pattern: /o[^aeiou]e$/,
    phoneme: '/oʊ/',
    context: 'final',
    exceptions: ['done', 'gone', 'none', 'one', 'come', 'some', 'love', 'move', 'prove'],
    reliability: 0.8,
  },
  {
    pattern: /u[^aeiou]e$/,
    phoneme: '/juː/',
    context: 'final',
    exceptions: ['sure', 'pure', 'cure'],
    reliability: 0.85,
  },

  // Vowel digraphs
  {
    pattern: /ee/,
    phoneme: '/iː/',
    context: 'any',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /ea(?![r])/,
    phoneme: '/iː/',
    context: 'any',
    exceptions: ['bread', 'head', 'dead', 'read', 'lead', 'spread', 'thread', 'tread', 'dread', 'meant', 'dealt', 'dreamt', 'leapt', 'great', 'break', 'steak'],
    reliability: 0.7,
  },
  {
    pattern: /oo/,
    phoneme: '/uː/',
    context: 'any',
    exceptions: ['book', 'look', 'cook', 'took', 'hook', 'good', 'wood', 'stood', 'foot', 'wool', 'blood', 'flood'],
    reliability: 0.75,
  },
  {
    pattern: /ai/,
    phoneme: '/eɪ/',
    context: 'any',
    exceptions: ['said', 'again', 'against'],
    reliability: 0.9,
  },
  {
    pattern: /ay$/,
    phoneme: '/eɪ/',
    context: 'final',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /oa/,
    phoneme: '/oʊ/',
    context: 'any',
    exceptions: ['broad'],
    reliability: 0.9,
  },
  {
    pattern: /ou/,
    phoneme: '/aʊ/',
    context: 'any',
    exceptions: ['you', 'your', 'four', 'pour', 'soul', 'shoulder', 'though', 'through', 'enough', 'tough', 'rough', 'cough', 'thought', 'bought', 'brought'],
    reliability: 0.5,
  },
  {
    pattern: /ow$/,
    phoneme: '/oʊ/',
    context: 'final',
    exceptions: ['how', 'now', 'cow', 'bow', 'wow', 'row', 'sow', 'allow'],
    reliability: 0.6,
  },
  {
    pattern: /oi/,
    phoneme: '/ɔɪ/',
    context: 'any',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /oy/,
    phoneme: '/ɔɪ/',
    context: 'any',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /au/,
    phoneme: '/ɔː/',
    context: 'any',
    exceptions: ['laugh', 'aunt', 'gauge'],
    reliability: 0.8,
  },
  {
    pattern: /aw/,
    phoneme: '/ɔː/',
    context: 'any',
    exceptions: [],
    reliability: 0.95,
  },

  // R-controlled vowels
  {
    pattern: /ar/,
    phoneme: '/ɑːr/',
    context: 'any',
    exceptions: ['warm', 'war', 'wart', 'toward'],
    reliability: 0.85,
  },
  {
    pattern: /er/,
    phoneme: '/ɜːr/',
    context: 'any',
    exceptions: ['clerk', 'sergeant'],
    reliability: 0.9,
  },
  {
    pattern: /ir/,
    phoneme: '/ɜːr/',
    context: 'any',
    exceptions: [],
    reliability: 0.9,
  },
  {
    pattern: /or/,
    phoneme: '/ɔːr/',
    context: 'any',
    exceptions: ['work', 'word', 'world', 'worm', 'worth', 'worse', 'worship'],
    reliability: 0.85,
  },
  {
    pattern: /ur/,
    phoneme: '/ɜːr/',
    context: 'any',
    exceptions: [],
    reliability: 0.9,
  },

  // ==========================================================================
  // Consonant Rules
  // ==========================================================================

  // Silent consonants
  {
    pattern: /^kn/,
    phoneme: '/n/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /^gn/,
    phoneme: '/n/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /^wr/,
    phoneme: '/r/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /^ps/,
    phoneme: '/s/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
    domains: ['medical', 'academic'],
  },
  {
    pattern: /^pn/,
    phoneme: '/n/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
    domains: ['medical'],
  },
  {
    pattern: /mb$/,
    phoneme: '/m/',
    context: 'final',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /bt$/,
    phoneme: '/t/',
    context: 'final',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /gh(?=[^aeiou]|$)/,
    phoneme: '',
    context: 'any',
    exceptions: ['cough', 'enough', 'rough', 'tough', 'laugh'],
    reliability: 0.7,
  },

  // Consonant digraphs
  {
    pattern: /ph/,
    phoneme: '/f/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /ch/,
    phoneme: '/tʃ/',
    context: 'any',
    exceptions: ['school', 'ache', 'anchor', 'chaos', 'character', 'chemical', 'chorus', 'chrome', 'echo', 'mechanic', 'orchestra', 'scheme', 'stomach', 'machine', 'chef', 'chic'],
    reliability: 0.75,
  },
  {
    pattern: /sh/,
    phoneme: '/ʃ/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /th/,
    phoneme: '/θ/ or /ð/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /wh/,
    phoneme: '/w/',
    context: 'initial',
    exceptions: ['who', 'whom', 'whose', 'whole'],
    reliability: 0.85,
  },
  {
    pattern: /ck/,
    phoneme: '/k/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /ng/,
    phoneme: '/ŋ/',
    context: 'any',
    exceptions: [],
    reliability: 0.95,
  },

  // Soft C and G
  {
    pattern: /c(?=[eiy])/,
    phoneme: '/s/',
    context: 'any',
    exceptions: ['soccer', 'cello'],
    reliability: 0.95,
  },
  {
    pattern: /c(?=[aou])/,
    phoneme: '/k/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
  },
  {
    pattern: /g(?=[eiy])/,
    phoneme: '/dʒ/',
    context: 'any',
    exceptions: ['get', 'give', 'gift', 'girl', 'begin', 'finger', 'tiger', 'anger', 'linger', 'singer'],
    reliability: 0.7,
  },
  {
    pattern: /g(?=[aou])/,
    phoneme: '/g/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
  },

  // ==========================================================================
  // Suffix Rules
  // ==========================================================================

  {
    pattern: /tion$/,
    phoneme: '/ʃən/',
    context: 'final',
    exceptions: ['question', 'estion', 'bastion'],
    reliability: 0.95,
    domains: ['general', 'academic', 'medical'],
  },
  {
    pattern: /sion$/,
    phoneme: '/ʒən/ or /ʃən/',
    context: 'final',
    exceptions: [],
    reliability: 0.9,
  },
  {
    pattern: /cian$/,
    phoneme: '/ʃən/',
    context: 'final',
    exceptions: [],
    reliability: 0.95,
    domains: ['medical'],
  },
  {
    pattern: /ous$/,
    phoneme: '/əs/',
    context: 'final',
    exceptions: [],
    reliability: 0.95,
  },
  {
    pattern: /ious$/,
    phoneme: '/iəs/',
    context: 'final',
    exceptions: [],
    reliability: 0.9,
  },
  {
    pattern: /ed$/,
    phoneme: '/d/ or /t/ or /ɪd/',
    context: 'final',
    exceptions: [],
    reliability: 0.95,
  },

  // ==========================================================================
  // Medical Domain Specific
  // ==========================================================================

  {
    pattern: /^psych/,
    phoneme: '/saɪk/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
    domains: ['medical'],
  },
  {
    pattern: /^pneu/,
    phoneme: '/njuː/',
    context: 'initial',
    exceptions: [],
    reliability: 0.99,
    domains: ['medical'],
  },
  {
    pattern: /^rhe/,
    phoneme: '/riː/',
    context: 'initial',
    exceptions: [],
    reliability: 0.95,
    domains: ['medical'],
  },
  {
    pattern: /rrh/,
    phoneme: '/r/',
    context: 'any',
    exceptions: [],
    reliability: 0.99,
    domains: ['medical'],
  },
];

/**
 * L1-specific interference patterns.
 */
export const L1_INTERFERENCE_PATTERNS: Record<string, {
  patterns: { grapheme: RegExp; error: string; reason: string }[];
  generalPatterns: string[];
}> = {
  'Spanish': {
    patterns: [
      { grapheme: /^sp/, error: '/esp/', reason: 'Spanish adds /e/ before initial s+consonant' },
      { grapheme: /^st/, error: '/est/', reason: 'Spanish adds /e/ before initial s+consonant' },
      { grapheme: /^sc/, error: '/esc/', reason: 'Spanish adds /e/ before initial s+consonant' },
      { grapheme: /v/, error: '/b/', reason: 'Spanish /v/ and /b/ merge' },
      { grapheme: /z/, error: '/s/', reason: 'Spanish /z/ often realized as /s/' },
      { grapheme: /th/, error: '/t/ or /d/', reason: 'Spanish lacks /θ/ and /ð/' },
      { grapheme: /[aeiou]$/, error: 'added vowel', reason: 'Spanish words typically end in vowels' },
    ],
    generalPatterns: ['vowel reduction difficulty', 'schwa insertion'],
  },
  'Portuguese': {
    patterns: [
      { grapheme: /th/, error: '/t/ or /f/', reason: 'Portuguese lacks /θ/ and /ð/' },
      { grapheme: /h/, error: 'silent', reason: 'Portuguese h is always silent' },
      { grapheme: /r/, error: '/h/ or trill', reason: 'Portuguese r varies by position' },
    ],
    generalPatterns: ['nasalization transfer', 'vowel raising'],
  },
  'Mandarin': {
    patterns: [
      { grapheme: /r/, error: 'approximant', reason: 'Mandarin r differs from English' },
      { grapheme: /l/, error: '/n/ or /r/', reason: 'l/n/r confusion' },
      { grapheme: /th/, error: '/s/ or /z/', reason: 'Mandarin lacks dental fricatives' },
      { grapheme: /v/, error: '/w/', reason: 'Mandarin lacks /v/' },
    ],
    generalPatterns: ['tonal transfer', 'final consonant deletion', 'consonant cluster simplification'],
  },
  'Japanese': {
    patterns: [
      { grapheme: /r/, error: '/l/', reason: 'Japanese r/l merger' },
      { grapheme: /l/, error: '/r/', reason: 'Japanese r/l merger' },
      { grapheme: /th/, error: '/s/ or /z/', reason: 'Japanese lacks dental fricatives' },
      { grapheme: /v/, error: '/b/', reason: 'Japanese lacks /v/' },
      { grapheme: /f/, error: '/h/', reason: 'Japanese f is bilabial' },
    ],
    generalPatterns: ['vowel insertion in clusters', 'pitch accent transfer'],
  },
  'Korean': {
    patterns: [
      { grapheme: /f/, error: '/p/', reason: 'Korean lacks /f/' },
      { grapheme: /v/, error: '/b/', reason: 'Korean lacks /v/' },
      { grapheme: /z/, error: '/j/', reason: 'Korean /z/ varies' },
      { grapheme: /th/, error: '/s/ or /d/', reason: 'Korean lacks dental fricatives' },
      { grapheme: /r/, error: '/l/', reason: 'Korean r/l allophony' },
    ],
    generalPatterns: ['final consonant unreleased', 'tenseness confusion'],
  },
  'Arabic': {
    patterns: [
      { grapheme: /p/, error: '/b/', reason: 'Arabic lacks /p/' },
      { grapheme: /v/, error: '/f/', reason: 'Arabic lacks /v/' },
      { grapheme: /[aeiou]{2}/, error: 'broken up', reason: 'Arabic disfavors vowel clusters' },
    ],
    generalPatterns: ['emphatic transfer', 'short vowel reduction'],
  },
};

/**
 * Silent letter patterns.
 */
const SILENT_LETTER_PATTERNS: { pattern: RegExp; silent: string }[] = [
  { pattern: /^kn/, silent: 'k' },
  { pattern: /^gn/, silent: 'g' },
  { pattern: /^wr/, silent: 'w' },
  { pattern: /^ps/, silent: 'p' },
  { pattern: /^pn/, silent: 'p' },
  { pattern: /mb$/, silent: 'b' },
  { pattern: /bt$/, silent: 'b' },
  { pattern: /mn$/, silent: 'n' },
  { pattern: /igh/, silent: 'gh' },
  { pattern: /ough/, silent: 'gh' },
  { pattern: /augh/, silent: 'gh' },
  { pattern: /lk$/, silent: 'l' },
  { pattern: /lm$/, silent: 'l' },
  { pattern: /stl/, silent: 't' },
  { pattern: /stle$/, silent: 't' },
];

// ============================================================================
// Grapheme Unit Types (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * A grapheme unit representing one or more letters that map to a single phoneme.
 */
export interface GraphemeUnit {
  /** The grapheme string (e.g., 'sh', 'igh', 'a') */
  grapheme: string;

  /** Position in original word (0-indexed) */
  position: number;

  /** Length in characters */
  length: number;

  /** Type of grapheme */
  type: 'single' | 'digraph' | 'trigraph' | 'silent' | 'split-digraph';

  /** Expected phoneme(s) in IPA */
  phoneme?: string;

  /** Confidence in the mapping (0-1) */
  confidence: number;
}

/**
 * Result of applying G2P rules to graphemes.
 */
export interface PhonemeResult {
  /** Input word */
  word: string;

  /** Segmented graphemes */
  graphemes: GraphemeUnit[];

  /** Resulting phoneme sequence */
  phonemes: string[];

  /** Overall confidence (0-1) */
  confidence: number;

  /** Rules that were applied */
  appliedRules: string[];

  /** Exceptions encountered */
  exceptions: string[];
}

// ============================================================================
// Grapheme Segmentation (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * English digraphs and trigraphs for segmentation.
 */
const ENGLISH_DIGRAPHS = [
  'ch', 'sh', 'th', 'wh', 'ph', 'gh', 'ck', 'ng', 'qu',
  'ee', 'ea', 'oo', 'ai', 'ay', 'oa', 'ou', 'ow', 'oi', 'oy', 'au', 'aw',
  'ar', 'er', 'ir', 'or', 'ur', 'ey', 'ie', 'ei', 'ue', 'ew'
];

const ENGLISH_TRIGRAPHS = [
  'igh', 'tch', 'dge', 'air', 'ear', 'ure', 'ore', 'are', 'eer', 'oor'
];

/**
 * Segment a word into grapheme units.
 * Handles digraphs (sh, ch, th), trigraphs (igh, tch), and silent letters.
 *
 * @param word - Word to segment
 * @returns Array of grapheme units
 *
 * @example
 * ```typescript
 * const graphemes = segmentGraphemes('through');
 * // Returns: [
 * //   { grapheme: 'th', type: 'digraph', phoneme: '/θ/', ... },
 * //   { grapheme: 'r', type: 'single', ... },
 * //   { grapheme: 'ough', type: 'trigraph', phoneme: '/uː/', ... }
 * // ]
 * ```
 */
export function segmentGraphemes(word: string): GraphemeUnit[] {
  const normalized = word.toLowerCase();
  const units: GraphemeUnit[] = [];
  let i = 0;

  while (i < normalized.length) {
    // Try trigraphs first (longest match)
    if (i + 2 < normalized.length) {
      const trigraph = normalized.slice(i, i + 3);
      if (ENGLISH_TRIGRAPHS.includes(trigraph)) {
        units.push({
          grapheme: trigraph,
          position: i,
          length: 3,
          type: 'trigraph',
          phoneme: getTrigraphPhoneme(trigraph),
          confidence: 0.9
        });
        i += 3;
        continue;
      }
    }

    // Try digraphs
    if (i + 1 < normalized.length) {
      const digraph = normalized.slice(i, i + 2);
      if (ENGLISH_DIGRAPHS.includes(digraph)) {
        units.push({
          grapheme: digraph,
          position: i,
          length: 2,
          type: 'digraph',
          phoneme: getDigraphPhoneme(digraph),
          confidence: 0.85
        });
        i += 2;
        continue;
      }
    }

    // Check for silent letters at specific positions
    const char = normalized[i];
    if (isSilentLetter(normalized, i)) {
      units.push({
        grapheme: char,
        position: i,
        length: 1,
        type: 'silent',
        phoneme: '',
        confidence: 0.95
      });
      i++;
      continue;
    }

    // Single grapheme
    units.push({
      grapheme: char,
      position: i,
      length: 1,
      type: 'single',
      phoneme: getSingleGraphemePhoneme(char),
      confidence: 0.7
    });
    i++;
  }

  return units;
}

/**
 * Check if a letter at position is silent.
 */
function isSilentLetter(word: string, pos: number): boolean {
  const char = word[pos];

  // Initial silent letters
  if (pos === 0) {
    if (char === 'k' && word[1] === 'n') return true;  // know
    if (char === 'g' && word[1] === 'n') return true;  // gnome
    if (char === 'w' && word[1] === 'r') return true;  // write
    if (char === 'p' && (word[1] === 's' || word[1] === 'n')) return true;  // psychology, pneumonia
  }

  // Final silent letters
  if (pos === word.length - 1) {
    if (char === 'e' && word.length > 2) {
      const prev = word[pos - 1];
      // Silent e after consonant (but not after vowel or double e)
      if (!'aeiou'.includes(prev) && prev !== 'e') return true;
    }
    if (char === 'b' && word[pos - 1] === 'm') return true;  // climb
  }

  // Silent 'b' before 't' at end
  if (char === 'b' && pos === word.length - 2 && word[pos + 1] === 't') return true;  // debt

  // Silent 'l' before certain consonants
  if (char === 'l' && pos < word.length - 1) {
    const next = word[pos + 1];
    if ((next === 'k' || next === 'm') && pos === word.length - 2) return true;  // walk, calm
  }

  // Silent 'gh' (handled in digraph, but check for standalone)
  if (char === 'g' && word[pos + 1] === 'h') {
    // Check context - 'gh' is often silent after vowels
    if (pos > 0 && 'aeiou'.includes(word[pos - 1])) return true;  // might, thought
  }

  return false;
}

/**
 * Get phoneme for a trigraph.
 */
function getTrigraphPhoneme(trigraph: string): string {
  const mapping: Record<string, string> = {
    'igh': '/aɪ/',
    'tch': '/tʃ/',
    'dge': '/dʒ/',
    'air': '/ɛər/',
    'ear': '/ɪər/',
    'ure': '/jʊər/',
    'ore': '/ɔːr/',
    'are': '/ɛər/',
    'eer': '/ɪər/',
    'oor': '/ʊər/'
  };
  return mapping[trigraph] || '';
}

/**
 * Get phoneme for a digraph.
 */
function getDigraphPhoneme(digraph: string): string {
  const mapping: Record<string, string> = {
    'ch': '/tʃ/',
    'sh': '/ʃ/',
    'th': '/θ/',
    'wh': '/w/',
    'ph': '/f/',
    'gh': '',  // Often silent or /f/
    'ck': '/k/',
    'ng': '/ŋ/',
    'qu': '/kw/',
    'ee': '/iː/',
    'ea': '/iː/',
    'oo': '/uː/',
    'ai': '/eɪ/',
    'ay': '/eɪ/',
    'oa': '/oʊ/',
    'ou': '/aʊ/',
    'ow': '/oʊ/',
    'oi': '/ɔɪ/',
    'oy': '/ɔɪ/',
    'au': '/ɔː/',
    'aw': '/ɔː/',
    'ar': '/ɑːr/',
    'er': '/ɜːr/',
    'ir': '/ɜːr/',
    'or': '/ɔːr/',
    'ur': '/ɜːr/',
    'ey': '/iː/',
    'ie': '/iː/',
    'ei': '/eɪ/',
    'ue': '/uː/',
    'ew': '/juː/'
  };
  return mapping[digraph] || '';
}

/**
 * Get phoneme for a single grapheme (consonant or vowel).
 */
function getSingleGraphemePhoneme(char: string): string {
  // Consonants (simplified - context-dependent in reality)
  const consonants: Record<string, string> = {
    'b': '/b/', 'c': '/k/', 'd': '/d/', 'f': '/f/', 'g': '/g/',
    'h': '/h/', 'j': '/dʒ/', 'k': '/k/', 'l': '/l/', 'm': '/m/',
    'n': '/n/', 'p': '/p/', 'q': '/k/', 'r': '/r/', 's': '/s/',
    't': '/t/', 'v': '/v/', 'w': '/w/', 'x': '/ks/', 'y': '/j/',
    'z': '/z/'
  };

  // Vowels (short by default)
  const vowels: Record<string, string> = {
    'a': '/æ/', 'e': '/ɛ/', 'i': '/ɪ/', 'o': '/ɒ/', 'u': '/ʌ/'
  };

  return consonants[char] || vowels[char] || '';
}

// ============================================================================
// G2P Rule Application (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * Apply G2P rules to segmented graphemes to produce phoneme output.
 *
 * @param graphemes - Segmented grapheme units
 * @param rules - G2P rules to apply
 * @returns Phoneme result with applied rules
 *
 * @example
 * ```typescript
 * const graphemes = segmentGraphemes('night');
 * const result = applyG2PRules(graphemes, ENGLISH_G2P_RULES);
 * // result.phonemes = ['/n/', '/aɪ/', '/t/']
 * ```
 */
export function applyG2PRules(
  graphemes: GraphemeUnit[],
  rules: G2PRule[] = ENGLISH_G2P_RULES
): PhonemeResult {
  const word = graphemes.map(g => g.grapheme).join('');
  const phonemes: string[] = [];
  const appliedRules: string[] = [];
  const exceptions: string[] = [];
  let totalConfidence = 0;

  for (const unit of graphemes) {
    // Skip silent graphemes
    if (unit.type === 'silent' || unit.phoneme === '') {
      continue;
    }

    // Check if word is an exception to any rule
    let foundException = false;
    for (const rule of rules) {
      if (rule.exceptions.includes(word) && rule.pattern.test(unit.grapheme)) {
        exceptions.push(`${unit.grapheme} in ${word}`);
        foundException = true;
        break;
      }
    }

    // Find applicable rule
    let ruleApplied = false;
    for (const rule of rules) {
      if (rule.pattern.test(unit.grapheme) && !foundException) {
        // Check context
        const contextMatch = checkRuleContext(rule.context, unit.position, word);
        if (contextMatch) {
          phonemes.push(rule.phoneme);
          appliedRules.push(rule.pattern.source);
          totalConfidence += rule.reliability;
          ruleApplied = true;
          break;
        }
      }
    }

    // Fallback to unit's default phoneme
    if (!ruleApplied && unit.phoneme) {
      phonemes.push(unit.phoneme);
      totalConfidence += unit.confidence;
    }
  }

  const avgConfidence = graphemes.length > 0 ? totalConfidence / graphemes.length : 0;

  return {
    word,
    graphemes,
    phonemes: phonemes.filter(p => p !== ''),
    confidence: Math.min(1, avgConfidence),
    appliedRules,
    exceptions
  };
}

/**
 * Check if rule context matches grapheme position.
 */
function checkRuleContext(
  context: G2PContext,
  position: number,
  word: string
): boolean {
  if (context === 'any') return true;
  if (context === 'initial' && position === 0) return true;
  if (context === 'final' && position >= word.length - 3) return true;
  if (context === 'medial' && position > 0 && position < word.length - 1) return true;
  return false;
}

// ============================================================================
// G2P Entropy Calculation (per DEVELOPMENT-PROTOCOL.md Phase 2)
// ============================================================================

/**
 * Compute G2P entropy for a word.
 * Higher entropy = less predictable pronunciation = higher phonological difficulty.
 *
 * Formula: H(w) = -Σ P(phoneme|grapheme,context) × log₂(P)
 *
 * This measures the uncertainty in grapheme-to-phoneme mappings for the word.
 *
 * @param word - Word to analyze
 * @returns Entropy value (0 = perfectly predictable, higher = more unpredictable)
 *
 * @example
 * ```typescript
 * const entropy1 = computeG2PEntropy('cat');     // Low entropy (~0.1)
 * const entropy2 = computeG2PEntropy('through'); // High entropy (~0.8)
 * ```
 */
export function computeG2PEntropy(word: string): number {
  const graphemes = segmentGraphemes(word);
  let totalEntropy = 0;

  for (const unit of graphemes) {
    // Get the number of possible phonemes for this grapheme
    const possiblePhonemes = getPossiblePhonemes(unit.grapheme);
    const numPossibilities = possiblePhonemes.length;

    if (numPossibilities <= 1) {
      // No ambiguity - zero entropy for this grapheme
      continue;
    }

    // Calculate entropy for this grapheme
    // Using reliability as inverse probability (less reliable = more possibilities equally likely)
    const reliability = getGraphemeReliability(unit.grapheme);

    // Entropy contribution: more possibilities and lower reliability = higher entropy
    // H = log₂(n) × (1 - reliability) where n is number of possibilities
    const entropyContribution = Math.log2(numPossibilities) * (1 - reliability);
    totalEntropy += entropyContribution;
  }

  // Normalize by word length to get per-grapheme entropy
  const normalizedEntropy = graphemes.length > 0 ? totalEntropy / graphemes.length : 0;

  // Scale to 0-1 range (typical max entropy is around 2-3 bits)
  return Math.min(1, normalizedEntropy / 2);
}

/**
 * Get possible phonemes for a grapheme.
 */
function getPossiblePhonemes(grapheme: string): string[] {
  // Multi-phoneme graphemes (ambiguous)
  const ambiguousGraphemes: Record<string, string[]> = {
    'a': ['/æ/', '/eɪ/', '/ɑː/', '/ə/'],
    'e': ['/ɛ/', '/iː/', '/ə/', '/ɪ/'],
    'i': ['/ɪ/', '/aɪ/', '/iː/', '/ə/'],
    'o': ['/ɒ/', '/oʊ/', '/uː/', '/ʌ/', '/ə/'],
    'u': ['/ʌ/', '/juː/', '/ʊ/', '/ə/'],
    'c': ['/k/', '/s/'],
    'g': ['/g/', '/dʒ/'],
    's': ['/s/', '/z/', '/ʃ/', '/ʒ/'],
    'x': ['/ks/', '/gz/', '/z/'],
    'y': ['/j/', '/aɪ/', '/iː/', '/ɪ/'],
    'ea': ['/iː/', '/ɛ/', '/eɪ/'],
    'oo': ['/uː/', '/ʊ/'],
    'ou': ['/aʊ/', '/uː/', '/ʌ/', '/oʊ/', '/ə/'],
    'ow': ['/oʊ/', '/aʊ/'],
    'ch': ['/tʃ/', '/k/', '/ʃ/'],
    'gh': ['', '/f/', '/g/'],
    'th': ['/θ/', '/ð/'],
    'ed': ['/d/', '/t/', '/ɪd/']
  };

  return ambiguousGraphemes[grapheme] || [getSingleGraphemePhoneme(grapheme[0])];
}

/**
 * Get reliability score for a grapheme's pronunciation.
 */
function getGraphemeReliability(grapheme: string): number {
  // Find the most relevant rule
  for (const rule of ENGLISH_G2P_RULES) {
    if (rule.pattern.test(grapheme)) {
      return rule.reliability;
    }
  }

  // Default reliability based on grapheme type
  if (grapheme.length === 1) {
    if ('aeiou'.includes(grapheme)) return 0.5;  // Vowels are ambiguous
    return 0.8;  // Consonants are more reliable
  }

  return 0.7;  // Digraphs/trigraphs
}

/**
 * Compute phonological difficulty score (P score) for LanguageObjectVector.
 * Combines G2P entropy with other phonological factors.
 *
 * @param word - Word to analyze
 * @param l1 - Optional L1 language for interference adjustment
 * @returns P score (0-1, higher = more difficult)
 */
export function computePhonologicalDifficulty(word: string, l1?: string): number {
  const entropy = computeG2PEntropy(word);
  const analysis = l1 ? analyzeG2PWithL1(word, l1) : analyzeG2PDifficulty(word);

  // Combine factors
  const entropyWeight = 0.4;
  const difficultyWeight = 0.4;
  const syllableWeight = 0.2;

  // Syllable complexity factor (more syllables = slightly harder)
  const syllableFactor = Math.min(1, (analysis.syllableCount - 1) / 5);

  const pScore =
    entropy * entropyWeight +
    analysis.difficultyScore * difficultyWeight +
    syllableFactor * syllableWeight;

  return Math.min(1, pScore);
}

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Analyze G2P difficulty of a word.
 *
 * @param word - Word to analyze
 * @param domain - Optional domain context
 * @returns Complete G2P difficulty analysis
 *
 * @example
 * ```typescript
 * const result = analyzeG2PDifficulty('psychology', 'medical');
 * // {
 * //   word: 'psychology',
 * //   irregularPatterns: [{ pattern: 'ps', reason: 'Silent p', ... }],
 * //   difficultyScore: 0.45,
 * //   ...
 * // }
 * ```
 */
export function analyzeG2PDifficulty(
  word: string,
  domain?: string
): G2PDifficulty {
  const normalized = word.toLowerCase().trim();
  const irregularPatterns: IrregularPattern[] = [];
  let difficultyScore = 0;

  // Check for exception words in rules
  for (const rule of ENGLISH_G2P_RULES) {
    // Skip domain-specific rules if not in that domain
    if (rule.domains && domain && !rule.domains.includes(domain) && !rule.domains.includes('general')) {
      continue;
    }

    if (rule.exceptions.includes(normalized)) {
      const match = normalized.match(rule.pattern);
      irregularPatterns.push({
        pattern: rule.pattern.source,
        reason: `Exception to ${rule.pattern.source} → ${rule.phoneme}`,
        position: match?.index ?? 0,
        difficulty: 0.2
      });
      difficultyScore += 0.2;
    }
  }

  // Check for silent letters
  const hasSilentLetters = checkSilentLetters(normalized, irregularPatterns);
  if (hasSilentLetters) {
    difficultyScore += 0.15;
  }

  // Check for vowel digraphs (complex)
  const vowelDigraphs = normalized.match(/[aeiou]{2,}/g) || [];
  if (vowelDigraphs.length > 0) {
    for (const digraph of vowelDigraphs) {
      irregularPatterns.push({
        pattern: digraph,
        reason: 'Vowel combination with variable pronunciation',
        position: normalized.indexOf(digraph),
        difficulty: 0.1
      });
      difficultyScore += 0.1;
    }
  }

  // Check for consonant clusters
  const consonantClusters = normalized.match(/[bcdfghjklmnpqrstvwxyz]{3,}/gi) || [];
  if (consonantClusters.length > 0) {
    for (const cluster of consonantClusters) {
      irregularPatterns.push({
        pattern: cluster,
        reason: 'Complex consonant cluster',
        position: normalized.indexOf(cluster),
        difficulty: 0.15
      });
      difficultyScore += 0.15;
    }
  }

  // Syllable count affects difficulty
  const syllableCount = countSyllables(normalized);
  if (syllableCount > 3) {
    difficultyScore += (syllableCount - 3) * 0.05;
  }

  // Stress irregularity check (simplified)
  const hasIrregularStress = checkIrregularStress(normalized);
  if (hasIrregularStress) {
    difficultyScore += 0.1;
  }

  // Generate mispronunciation predictions (empty by default, populated by L1-specific function)
  const potentialMispronunciations: L1Mispronunciation[] = [];

  return {
    word: normalized,
    irregularPatterns,
    difficultyScore: Math.min(1, difficultyScore),
    potentialMispronunciations,
    syllableCount,
    hasSilentLetters,
    hasIrregularStress
  };
}

/**
 * Check for silent letters and add to patterns list.
 */
function checkSilentLetters(
  word: string,
  patterns: IrregularPattern[]
): boolean {
  let hasSilent = false;

  for (const { pattern, silent } of SILENT_LETTER_PATTERNS) {
    if (pattern.test(word)) {
      patterns.push({
        pattern: silent,
        reason: `Silent ${silent}`,
        position: word.search(pattern),
        difficulty: 0.15
      });
      hasSilent = true;
    }
  }

  return hasSilent;
}

/**
 * Count syllables in a word (heuristic).
 */
export function countSyllables(word: string): number {
  const normalized = word.toLowerCase();

  // Count vowel groups
  let count = (normalized.match(/[aeiouy]+/g) || []).length;

  // Subtract silent e
  if (normalized.endsWith('e') && normalized.length > 2) {
    const beforeE = normalized.charAt(normalized.length - 2);
    if (!'aeiou'.includes(beforeE)) {
      count = Math.max(1, count - 1);
    }
  }

  // Handle special endings
  if (normalized.endsWith('le') && normalized.length > 2) {
    const beforeLe = normalized.charAt(normalized.length - 3);
    if (!'aeiou'.includes(beforeLe)) {
      count++; // -ble, -ple, -tle are syllabic
    }
  }

  // -ed ending
  if (normalized.endsWith('ed') && normalized.length > 3) {
    const beforeEd = normalized.charAt(normalized.length - 3);
    if ('dt'.includes(beforeEd)) {
      count++; // -ted, -ded are syllabic
    }
  }

  return Math.max(1, count);
}

/**
 * Check for irregular stress patterns (simplified heuristic).
 */
function checkIrregularStress(word: string): boolean {
  // Words with certain suffixes have predictable stress
  const predictableSuffixes = [
    /tion$/, /sion$/, /ic$/, /ical$/, /ity$/,  // Stress on syllable before
    /ous$/, /ive$/, /able$/, /ible$/,          // Stress patterns
  ];

  // Words ending in these often have irregular stress
  const irregularPatterns = [
    /ate$/, // Can be verb (creATE) or adjective (delicate)
    /ment$/, // Variable stress
  ];

  for (const pattern of irregularPatterns) {
    if (pattern.test(word)) return true;
  }

  // Multi-syllable words without clear suffix markers may have irregular stress
  const syllables = countSyllables(word);
  if (syllables >= 3) {
    const hasPredictable = predictableSuffixes.some(p => p.test(word));
    if (!hasPredictable) return true;
  }

  return false;
}

// ============================================================================
// L1-Specific Analysis
// ============================================================================

/**
 * Predict mispronunciations based on L1 interference.
 *
 * @param word - Word to analyze
 * @param l1 - Learner's native language
 * @returns List of potential mispronunciations
 */
export function predictMispronunciations(
  word: string,
  l1: string
): L1Mispronunciation[] {
  const normalized = word.toLowerCase();
  const predictions: L1Mispronunciation[] = [];

  const l1Patterns = L1_INTERFERENCE_PATTERNS[l1];
  if (!l1Patterns) return predictions;

  // Check specific patterns
  for (const { grapheme, error, reason } of l1Patterns.patterns) {
    if (grapheme.test(normalized)) {
      predictions.push({
        l1,
        mispronunciation: error,
        reason,
        probability: 0.7
      });
    }
  }

  // Add general patterns
  for (const generalPattern of l1Patterns.generalPatterns) {
    predictions.push({
      l1,
      mispronunciation: generalPattern,
      reason: `General ${l1} interference pattern`,
      probability: 0.5
    });
  }

  return predictions;
}

/**
 * Get G2P difficulty analysis with L1-specific predictions.
 */
export function analyzeG2PWithL1(
  word: string,
  l1: string,
  domain?: string
): G2PDifficulty {
  const baseAnalysis = analyzeG2PDifficulty(word, domain);
  baseAnalysis.potentialMispronunciations = predictMispronunciations(word, l1);

  // Adjust difficulty based on L1 interference count
  const l1Adjustment = baseAnalysis.potentialMispronunciations.length * 0.05;
  baseAnalysis.difficultyScore = Math.min(1, baseAnalysis.difficultyScore + l1Adjustment);

  return baseAnalysis;
}

// ============================================================================
// Vector Generation
// ============================================================================

/**
 * Generate phonological vector for LanguageObjectVector.
 */
export function toPhonologicalVector(word: string): PhonologicalVector {
  const syllableCount = countSyllables(word);

  // Estimate phonemes (simplified - real implementation would use a dictionary)
  const phonemes = estimatePhonemes(word);

  // Estimate syllable structure
  const syllableStructure = estimateSyllableStructure(word);

  // Estimate stress pattern
  const stress = estimateStressPattern(word, syllableCount);

  return {
    phonemes,
    syllableStructure,
    stress,
    syllableCount
  };
}

/**
 * Generate orthographic vector for LanguageObjectVector.
 */
export function toOrthographicVector(word: string): OrthographicVector {
  const normalized = word.toLowerCase();
  const difficulty = analyzeG2PDifficulty(word);

  // Identify spelling patterns
  const spellingPatterns: string[] = [];

  // Check for common patterns
  if (/tion$/.test(normalized)) spellingPatterns.push('-tion');
  if (/ous$/.test(normalized)) spellingPatterns.push('-ous');
  if (/ight/.test(normalized)) spellingPatterns.push('-ight');
  if (/ough/.test(normalized)) spellingPatterns.push('-ough');
  if (/[aeiou][^aeiou]e$/.test(normalized)) spellingPatterns.push('magic-e');
  if (/ee|ea|oo|ai|ay|oa|ou|ow|oi|oy/.test(normalized)) spellingPatterns.push('vowel-digraph');
  if (/ph|ch|sh|th|wh|ck|ng/.test(normalized)) spellingPatterns.push('consonant-digraph');

  // Exception types
  const exceptionTypes = difficulty.irregularPatterns.map(p => p.reason);

  return {
    graphemes: normalized,
    spellingPatterns,
    hasExceptions: difficulty.irregularPatterns.length > 0,
    exceptionTypes
  };
}

/**
 * Estimate phonemes for a word (simplified).
 */
function estimatePhonemes(word: string): string[] {
  const phonemes: string[] = [];
  const normalized = word.toLowerCase();

  // This is a simplified estimation - real implementation would use CMU dict or similar
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1] || '';

    // Skip if part of digraph already processed
    if (i > 0 && isDigraphSecond(normalized[i - 1], char)) continue;

    // Handle common patterns
    if (char + next === 'th') phonemes.push('/θ/');
    else if (char + next === 'sh') phonemes.push('/ʃ/');
    else if (char + next === 'ch') phonemes.push('/tʃ/');
    else if (char + next === 'ph') phonemes.push('/f/');
    else if (char + next === 'ng') phonemes.push('/ŋ/');
    else if ('aeiou'.includes(char)) phonemes.push(`/${char}/`);
    else if ('bcdfghjklmnpqrstvwxyz'.includes(char)) phonemes.push(`/${char}/`);
  }

  return phonemes;
}

/**
 * Check if character is second part of a digraph.
 */
function isDigraphSecond(first: string, second: string): boolean {
  const digraphs = ['th', 'sh', 'ch', 'ph', 'ng', 'wh', 'ck'];
  return digraphs.includes(first + second);
}

/**
 * Estimate syllable structure.
 */
function estimateSyllableStructure(word: string): string {
  // Simplified: count consonant and vowel patterns
  const normalized = word.toLowerCase();
  let structure = '';

  for (const char of normalized) {
    if ('aeiou'.includes(char)) {
      structure += 'V';
    } else if ('bcdfghjklmnpqrstvwxyz'.includes(char)) {
      structure += 'C';
    }
  }

  // Simplify consecutive same letters
  return structure.replace(/C+/g, 'C').replace(/V+/g, 'V');
}

/**
 * Estimate stress pattern.
 */
function estimateStressPattern(word: string, syllableCount: number): number[] {
  if (syllableCount === 1) return [1];
  if (syllableCount === 2) return [1, 0]; // Default: first syllable stressed

  // Multi-syllable: common patterns
  const pattern = new Array(syllableCount).fill(0);

  // Suffix-based stress rules
  if (/tion$|sion$|ic$|ity$/.test(word)) {
    // Stress on syllable before suffix
    pattern[syllableCount - 2] = 1;
  } else if (/ate$|ize$|ise$/.test(word)) {
    // Stress on third-from-last
    pattern[Math.max(0, syllableCount - 3)] = 1;
  } else {
    // Default: first syllable
    pattern[0] = 1;
  }

  return pattern;
}

// ============================================================================
// Transfer Effect Functions
// ============================================================================

/**
 * Identify words that share G2P patterns with trained items.
 */
export function findG2PTransferCandidates(
  trainedWords: string[],
  candidateWords: string[]
): { word: string; sharedPatterns: string[]; transferPotential: number }[] {
  // Extract patterns from trained words
  const trainedPatterns = new Set<string>();
  for (const word of trainedWords) {
    const vector = toOrthographicVector(word);
    vector.spellingPatterns.forEach(p => trainedPatterns.add(p));
  }

  // Find candidates with shared patterns
  const results: { word: string; sharedPatterns: string[]; transferPotential: number }[] = [];

  for (const word of candidateWords) {
    const vector = toOrthographicVector(word);
    const shared = vector.spellingPatterns.filter(p => trainedPatterns.has(p));

    if (shared.length > 0) {
      const difficulty = analyzeG2PDifficulty(word);
      const potential = shared.length * 0.25 + (1 - difficulty.difficultyScore) * 0.3;

      results.push({
        word,
        sharedPatterns: shared,
        transferPotential: Math.min(1, potential)
      });
    }
  }

  return results.sort((a, b) => b.transferPotential - a.transferPotential);
}

/**
 * Measure G2P transfer effect on vocabulary acquisition.
 */
export function measureG2PTransfer(
  trainedRules: string[],
  acquisitionBefore: number,
  acquisitionAfter: number
): G2PTransfer {
  return {
    trainedRules,
    acquisitionRateBefore: acquisitionBefore,
    acquisitionRateAfter: acquisitionAfter,
    transferGain: acquisitionAfter - acquisitionBefore
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all G2P rules for a domain.
 */
export function getRulesForDomain(domain: string): G2PRule[] {
  return ENGLISH_G2P_RULES.filter(rule =>
    !rule.domains || rule.domains.includes(domain) || rule.domains.includes('general')
  );
}

/**
 * Get supported L1 languages.
 */
export function getSupportedL1Languages(): string[] {
  return Object.keys(L1_INTERFERENCE_PATTERNS);
}

/**
 * Check if a word follows regular G2P patterns.
 */
export function isRegularG2P(word: string): boolean {
  const difficulty = analyzeG2PDifficulty(word);
  return difficulty.difficultyScore < 0.2 && difficulty.irregularPatterns.length === 0;
}

/**
 * Get pronunciation difficulty category.
 */
export function getG2PDifficultyCategory(
  word: string
): 'easy' | 'moderate' | 'difficult' {
  const difficulty = analyzeG2PDifficulty(word);

  if (difficulty.difficultyScore < 0.25) return 'easy';
  if (difficulty.difficultyScore < 0.5) return 'moderate';
  return 'difficult';
}

// =============================================================================
// G2P Hierarchical Model (Alphabetic → Syllable → Word)
// =============================================================================

/**
 * G2P Hierarchical Acquisition Model
 *
 * Based on:
 * - Ehri, L.C. (2005). Learning to read words: Theory, findings, and issues.
 *   Scientific Studies of Reading, 9(2), 167-188.
 * - Treiman, R. (1993). Beginning to Spell. Oxford University Press.
 * - Ziegler, J.C. & Goswami, U. (2005). Reading acquisition, developmental
 *   dyslexia, and skilled reading across languages. Psychological Bulletin.
 *
 * The model represents phonological knowledge in three hierarchical layers:
 * 1. Alphabetic Layer: Individual grapheme-phoneme correspondences
 * 2. Syllable Layer: Syllable patterns (onset-rime, syllable types)
 * 3. Word Layer: Whole word representations and morphophonemic patterns
 */

/**
 * Alphabetic layer unit - single grapheme-phoneme mapping
 */
export interface AlphabeticUnit {
  /** The grapheme (letter or letter combination) */
  grapheme: string;

  /** Primary phoneme mapping */
  primaryPhoneme: string;

  /** Alternative phoneme mappings with contexts */
  alternatives: Array<{
    phoneme: string;
    context: string;
    frequency: number;
  }>;

  /** Acquisition stage (0-4) */
  acquisitionStage: number;

  /** Confidence in this mapping (0-1) */
  confidence: number;

  /** Number of successful recognitions */
  exposureCount: number;

  /** Error rate for this mapping */
  errorRate: number;
}

/**
 * Syllable layer unit - syllable-level pattern
 */
export interface SyllableUnit {
  /** Syllable pattern (e.g., 'CVC', 'CVCC') */
  pattern: string;

  /** Onset (initial consonants) */
  onset: string;

  /** Rime (vowel + final consonants) */
  rime: string;

  /** Nucleus (vowel) */
  nucleus: string;

  /** Coda (final consonants) */
  coda: string;

  /** Syllable type */
  type: SyllableType;

  /** Stress level (0=unstressed, 1=primary, 2=secondary) */
  stress: number;

  /** Acquisition stage (0-4) */
  acquisitionStage: number;

  /** Example words containing this pattern */
  examples: string[];
}

export type SyllableType =
  | 'closed'      // CVC - cat, stop
  | 'open'        // CV - go, me
  | 'silent-e'    // CVCe - make, home
  | 'vowel-team'  // CVVC - rain, feet
  | 'r-controlled' // CVr - car, bird
  | 'consonant-le'; // Cle - table, apple

/**
 * Word layer unit - whole word representation
 */
export interface WordUnit {
  /** The word */
  word: string;

  /** Syllable breakdown */
  syllables: SyllableUnit[];

  /** Morphological structure */
  morphemes: string[];

  /** Phonological representation (IPA) */
  phonology: string;

  /** Acquisition stage (0-4) */
  acquisitionStage: number;

  /** Context-usage patterns */
  usageContexts: string[];

  /** Related word forms */
  wordFamily: string[];
}

/**
 * Complete hierarchical G2P profile for a learner
 */
export interface G2PHierarchicalProfile {
  /** Alphabetic layer knowledge */
  alphabetic: {
    /** Known grapheme-phoneme mappings */
    units: Map<string, AlphabeticUnit>;
    /** Overall alphabetic mastery (0-1) */
    mastery: number;
    /** Problematic mappings */
    difficulties: string[];
  };

  /** Syllable layer knowledge */
  syllable: {
    /** Known syllable patterns */
    units: Map<string, SyllableUnit>;
    /** Overall syllable mastery (0-1) */
    mastery: number;
    /** Problematic patterns */
    difficulties: string[];
  };

  /** Word layer knowledge */
  word: {
    /** Known words with full representations */
    units: Map<string, WordUnit>;
    /** Overall word-level mastery (0-1) */
    mastery: number;
    /** Sight word count */
    sightWordCount: number;
  };

  /** L1 language */
  l1: string;

  /** Target language */
  l2: string;
}

/**
 * Parse a word into its hierarchical components.
 *
 * @param word - Word to analyze
 * @returns Hierarchical breakdown of the word
 */
export function parseWordHierarchy(word: string): {
  alphabetic: AlphabeticUnit[];
  syllables: SyllableUnit[];
  wordUnit: WordUnit;
} {
  const normalized = word.toLowerCase();

  // Layer 1: Alphabetic (grapheme segmentation)
  const graphemes = segmentGraphemes(normalized);
  const alphabeticUnits: AlphabeticUnit[] = graphemes.map(g => ({
    grapheme: g.grapheme,
    primaryPhoneme: g.phoneme || '',
    alternatives: getAlternativePhonemes(g.grapheme),
    acquisitionStage: 0,
    confidence: g.confidence,
    exposureCount: 0,
    errorRate: 0,
  }));

  // Layer 2: Syllable parsing
  const syllables = parseSyllables(normalized);

  // Layer 3: Word unit
  const wordUnit: WordUnit = {
    word: normalized,
    syllables,
    morphemes: extractMorphemes(normalized),
    phonology: graphemes.map(g => g.phoneme).filter(p => p).join(''),
    acquisitionStage: 0,
    usageContexts: [],
    wordFamily: [],
  };

  return {
    alphabetic: alphabeticUnits,
    syllables,
    wordUnit,
  };
}

/**
 * Get alternative phoneme mappings for a grapheme.
 */
function getAlternativePhonemes(grapheme: string): Array<{
  phoneme: string;
  context: string;
  frequency: number;
}> {
  const alternatives: Record<string, Array<{ phoneme: string; context: string; frequency: number }>> = {
    'a': [
      { phoneme: '/æ/', context: 'CVC (cat)', frequency: 0.4 },
      { phoneme: '/eɪ/', context: 'CVCe (make)', frequency: 0.3 },
      { phoneme: '/ɑː/', context: 'before r (car)', frequency: 0.15 },
      { phoneme: '/ə/', context: 'unstressed (about)', frequency: 0.15 },
    ],
    'e': [
      { phoneme: '/ɛ/', context: 'CVC (bed)', frequency: 0.4 },
      { phoneme: '/iː/', context: 'CVCe, ee (eve, see)', frequency: 0.3 },
      { phoneme: '/ə/', context: 'unstressed (happen)', frequency: 0.2 },
      { phoneme: '', context: 'silent final (make)', frequency: 0.1 },
    ],
    'i': [
      { phoneme: '/ɪ/', context: 'CVC (sit)', frequency: 0.45 },
      { phoneme: '/aɪ/', context: 'CVCe (time)', frequency: 0.35 },
      { phoneme: '/iː/', context: 'before que (unique)', frequency: 0.1 },
      { phoneme: '/ə/', context: 'unstressed', frequency: 0.1 },
    ],
    'o': [
      { phoneme: '/ɒ/', context: 'CVC (hot)', frequency: 0.35 },
      { phoneme: '/oʊ/', context: 'CVCe, oa (hope, boat)', frequency: 0.35 },
      { phoneme: '/uː/', context: 'do, to, who', frequency: 0.1 },
      { phoneme: '/ʌ/', context: 'some, come', frequency: 0.1 },
      { phoneme: '/ə/', context: 'unstressed', frequency: 0.1 },
    ],
    'u': [
      { phoneme: '/ʌ/', context: 'CVC (cup)', frequency: 0.4 },
      { phoneme: '/juː/', context: 'CVCe (use)', frequency: 0.3 },
      { phoneme: '/ʊ/', context: 'put, push', frequency: 0.15 },
      { phoneme: '/uː/', context: 'rule, rude', frequency: 0.15 },
    ],
    'c': [
      { phoneme: '/k/', context: 'before a, o, u', frequency: 0.7 },
      { phoneme: '/s/', context: 'before e, i, y', frequency: 0.3 },
    ],
    'g': [
      { phoneme: '/g/', context: 'before a, o, u', frequency: 0.7 },
      { phoneme: '/dʒ/', context: 'before e, i, y', frequency: 0.3 },
    ],
    's': [
      { phoneme: '/s/', context: 'initial, after voiceless', frequency: 0.6 },
      { phoneme: '/z/', context: 'between vowels, plural', frequency: 0.35 },
      { phoneme: '/ʃ/', context: 'before i + vowel (mansion)', frequency: 0.05 },
    ],
    'th': [
      { phoneme: '/θ/', context: 'initial in content words', frequency: 0.5 },
      { phoneme: '/ð/', context: 'function words, medial', frequency: 0.5 },
    ],
    'ou': [
      { phoneme: '/aʊ/', context: 'loud, out', frequency: 0.3 },
      { phoneme: '/uː/', context: 'soup, you', frequency: 0.2 },
      { phoneme: '/ʌ/', context: 'tough, enough', frequency: 0.15 },
      { phoneme: '/oʊ/', context: 'soul, shoulder', frequency: 0.15 },
      { phoneme: '/ɔː/', context: 'thought, bought', frequency: 0.1 },
      { phoneme: '/ə/', context: 'famous', frequency: 0.1 },
    ],
    'ea': [
      { phoneme: '/iː/', context: 'eat, team', frequency: 0.5 },
      { phoneme: '/ɛ/', context: 'bread, head', frequency: 0.3 },
      { phoneme: '/eɪ/', context: 'great, break', frequency: 0.1 },
      { phoneme: '/ɪə/', context: 'fear, near', frequency: 0.1 },
    ],
  };

  return alternatives[grapheme] || [];
}

/**
 * Parse word into syllable units.
 */
function parseSyllables(word: string): SyllableUnit[] {
  const syllables: SyllableUnit[] = [];
  const syllableCount = countSyllables(word);

  // Simple syllable boundary detection
  const vowelPositions: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if ('aeiouy'.includes(word[i])) {
      vowelPositions.push(i);
    }
  }

  // Group into syllables (simplified)
  let currentStart = 0;
  for (let i = 0; i < syllableCount; i++) {
    const isLast = i === syllableCount - 1;
    const end = isLast ? word.length : findSyllableBoundary(word, vowelPositions, i);
    const syllableStr = word.slice(currentStart, end);

    const { onset, nucleus, coda } = parseOnsetRimeCoda(syllableStr);
    const rime = nucleus + coda;
    const pattern = getPatternString(onset, nucleus, coda);

    syllables.push({
      pattern,
      onset,
      rime,
      nucleus,
      coda,
      type: determineSyllableType(syllableStr, coda, i === syllableCount - 1, word),
      stress: i === 0 ? 1 : 0, // Simplified: first syllable stressed
      acquisitionStage: 0,
      examples: [],
    });

    currentStart = end;
  }

  return syllables;
}

/**
 * Find syllable boundary position.
 */
function findSyllableBoundary(word: string, vowelPositions: number[], syllableIndex: number): number {
  if (syllableIndex >= vowelPositions.length - 1) {
    return word.length;
  }

  const currentVowel = vowelPositions[syllableIndex];
  const nextVowel = vowelPositions[syllableIndex + 1];

  // Count consonants between vowels
  const consonantsBetween = nextVowel - currentVowel - 1;

  if (consonantsBetween <= 1) {
    // Single consonant goes with next syllable
    return currentVowel + 1;
  } else {
    // Split consonant cluster
    return currentVowel + Math.ceil(consonantsBetween / 2) + 1;
  }
}

/**
 * Parse onset, nucleus (vowel), and coda from a syllable.
 */
function parseOnsetRimeCoda(syllable: string): { onset: string; nucleus: string; coda: string } {
  let onset = '';
  let nucleus = '';
  let coda = '';
  let state: 'onset' | 'nucleus' | 'coda' = 'onset';

  for (const char of syllable) {
    const isVowel = 'aeiouy'.includes(char);

    if (state === 'onset') {
      if (isVowel) {
        nucleus += char;
        state = 'nucleus';
      } else {
        onset += char;
      }
    } else if (state === 'nucleus') {
      if (isVowel) {
        nucleus += char;
      } else {
        coda += char;
        state = 'coda';
      }
    } else {
      coda += char;
    }
  }

  return { onset, nucleus, coda };
}

/**
 * Get CV pattern string.
 */
function getPatternString(onset: string, nucleus: string, coda: string): string {
  return (
    'C'.repeat(onset.length) +
    'V'.repeat(nucleus.length) +
    'C'.repeat(coda.length)
  );
}

/**
 * Determine syllable type.
 */
function determineSyllableType(
  syllable: string,
  coda: string,
  isFinal: boolean,
  fullWord: string
): SyllableType {
  // R-controlled
  if (coda === 'r' || syllable.match(/[aeiou]r$/)) {
    return 'r-controlled';
  }

  // Silent-e pattern
  if (isFinal && fullWord.endsWith('e') && coda === '' && syllable.length > 1) {
    return 'silent-e';
  }

  // Consonant-le
  if (isFinal && syllable.endsWith('le') && syllable.length > 2) {
    return 'consonant-le';
  }

  // Vowel team
  if (syllable.match(/[aeiou]{2}/)) {
    return 'vowel-team';
  }

  // Open vs closed
  if (coda === '') {
    return 'open';
  }

  return 'closed';
}

/**
 * Extract morphemes from a word (simplified).
 */
function extractMorphemes(word: string): string[] {
  const morphemes: string[] = [];

  // Common prefixes
  const prefixes = ['un', 're', 'pre', 'dis', 'mis', 'non', 'over', 'under', 'sub', 'super'];
  for (const prefix of prefixes) {
    if (word.startsWith(prefix) && word.length > prefix.length + 2) {
      morphemes.push(prefix + '-');
      word = word.slice(prefix.length);
      break;
    }
  }

  // Common suffixes
  const suffixes = ['tion', 'sion', 'ness', 'ment', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'ly', 'er', 'est', 'ing', 'ed', 's'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      morphemes.push('-' + suffix);
      word = word.slice(0, -suffix.length);
      break;
    }
  }

  // Root (whatever remains)
  if (word.length > 0) {
    morphemes.unshift(word);
  }

  return morphemes;
}

/**
 * Calculate hierarchical acquisition score.
 * Determines readiness for word-level vs syllable-level vs alphabetic-level instruction.
 *
 * @param profile - Learner's G2P hierarchical profile
 * @param word - Target word to assess
 * @returns Acquisition readiness scores at each level
 */
export function assessHierarchicalReadiness(
  profile: G2PHierarchicalProfile,
  word: string
): {
  alphabeticReadiness: number;
  syllableReadiness: number;
  wordReadiness: number;
  recommendedLevel: 'alphabetic' | 'syllable' | 'word';
  prerequisites: string[];
} {
  const hierarchy = parseWordHierarchy(word);

  // Check alphabetic readiness
  let knownGraphemes = 0;
  const missingGraphemes: string[] = [];
  for (const unit of hierarchy.alphabetic) {
    const known = profile.alphabetic.units.get(unit.grapheme);
    if (known && known.acquisitionStage >= 2) {
      knownGraphemes++;
    } else {
      missingGraphemes.push(unit.grapheme);
    }
  }
  const alphabeticReadiness = hierarchy.alphabetic.length > 0
    ? knownGraphemes / hierarchy.alphabetic.length
    : 0;

  // Check syllable readiness
  let knownSyllables = 0;
  const missingSyllables: string[] = [];
  for (const syllable of hierarchy.syllables) {
    const known = profile.syllable.units.get(syllable.pattern);
    if (known && known.acquisitionStage >= 2) {
      knownSyllables++;
    } else {
      missingSyllables.push(syllable.pattern);
    }
  }
  const syllableReadiness = hierarchy.syllables.length > 0
    ? knownSyllables / hierarchy.syllables.length
    : 0;

  // Check word readiness (sight word recognition)
  const knownWord = profile.word.units.get(word);
  const wordReadiness = knownWord ? knownWord.acquisitionStage / 4 : 0;

  // Determine recommended level
  let recommendedLevel: 'alphabetic' | 'syllable' | 'word';
  const prerequisites: string[] = [];

  if (alphabeticReadiness < 0.7) {
    recommendedLevel = 'alphabetic';
    prerequisites.push(...missingGraphemes.map(g => `Learn grapheme: ${g}`));
  } else if (syllableReadiness < 0.7) {
    recommendedLevel = 'syllable';
    prerequisites.push(...missingSyllables.map(s => `Practice syllable pattern: ${s}`));
  } else {
    recommendedLevel = 'word';
  }

  return {
    alphabeticReadiness,
    syllableReadiness,
    wordReadiness,
    recommendedLevel,
    prerequisites,
  };
}

/**
 * Generate practice items for a specific hierarchical level.
 *
 * @param level - Target practice level
 * @param targetPattern - Pattern to practice
 * @param wordPool - Available words for practice
 * @returns Filtered word list appropriate for the level
 */
export function generateHierarchicalPractice(
  level: 'alphabetic' | 'syllable' | 'word',
  targetPattern: string,
  wordPool: string[]
): string[] {
  switch (level) {
    case 'alphabetic':
      // Find words containing the target grapheme
      return wordPool.filter(word => {
        const graphemes = segmentGraphemes(word);
        return graphemes.some(g => g.grapheme === targetPattern);
      });

    case 'syllable':
      // Find words with matching syllable patterns
      return wordPool.filter(word => {
        const syllables = parseSyllables(word);
        return syllables.some(s => s.pattern === targetPattern || s.type === targetPattern as SyllableType);
      });

    case 'word':
      // Return words that match morphological patterns
      return wordPool.filter(word => {
        const morphemes = extractMorphemes(word);
        return morphemes.includes(targetPattern) || word.includes(targetPattern);
      });
  }
}

/**
 * Create empty G2P hierarchical profile for a new learner.
 */
export function createEmptyG2PProfile(l1: string, l2: string): G2PHierarchicalProfile {
  return {
    alphabetic: {
      units: new Map(),
      mastery: 0,
      difficulties: [],
    },
    syllable: {
      units: new Map(),
      mastery: 0,
      difficulties: [],
    },
    word: {
      units: new Map(),
      mastery: 0,
      sightWordCount: 0,
    },
    l1,
    l2,
  };
}
