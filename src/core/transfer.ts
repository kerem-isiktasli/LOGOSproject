/**
 * L1-L2 Transfer Coefficient Module
 *
 * Implements language transfer effects between native (L1) and target (L2) languages.
 * Based on contrastive analysis and transfer learning research.
 *
 * Academic References:
 * - Jarvis, S. & Pavlenko, A. (2008). Crosslinguistic Influence in Language and Cognition.
 * - Ringbom, H. (2007). Cross-linguistic Similarity in Foreign Language Learning.
 * - Odlin, T. (1989). Language Transfer: Cross-linguistic influence in language learning.
 *
 * @module core/transfer
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Language family classification for transfer prediction.
 */
export type LanguageFamily =
  | 'germanic'      // English, German, Dutch, Swedish, etc.
  | 'romance'       // Spanish, French, Italian, Portuguese, etc.
  | 'slavic'        // Russian, Polish, Czech, etc.
  | 'sino-tibetan'  // Chinese, Tibetan, etc.
  | 'japonic'       // Japanese
  | 'koreanic'      // Korean
  | 'semitic'       // Arabic, Hebrew
  | 'indo-aryan'    // Hindi, Urdu, Bengali
  | 'dravidian'     // Tamil, Telugu
  | 'turkic'        // Turkish, Azerbaijani
  | 'other';

/**
 * Transfer coefficient by linguistic component.
 * Values range from -1 (negative transfer/interference) to +1 (positive transfer).
 */
export interface TransferCoefficients {
  /** Phonological transfer (pronunciation, phoneme inventory) */
  phonological: number;

  /** Orthographic transfer (writing system similarity) */
  orthographic: number;

  /** Morphological transfer (affix systems, inflection) */
  morphological: number;

  /** Lexical transfer (cognates, borrowed words) */
  lexical: number;

  /** Syntactic transfer (word order, grammatical structures) */
  syntactic: number;

  /** Pragmatic transfer (politeness, speech acts) */
  pragmatic: number;
}

/**
 * Language pair profile with transfer characteristics.
 */
export interface LanguagePairProfile {
  l1: string;           // ISO 639-1 code
  l2: string;           // ISO 639-1 code
  l1Family: LanguageFamily;
  l2Family: LanguageFamily;
  coefficients: TransferCoefficients;
  cognateRatio: number; // 0-1, proportion of shared vocabulary
  orthographicDistance: number; // 0-1, writing system difference
}

/**
 * Transfer-adjusted difficulty calculation.
 */
export interface TransferAdjustedDifficulty {
  baseDifficulty: number;
  transferModifier: number;
  adjustedDifficulty: number;
  dominantTransferType: keyof TransferCoefficients;
  transferDescription: string;
}

// =============================================================================
// Language Family Mappings
// =============================================================================

/**
 * Map ISO 639-1 codes to language families.
 */
const LANGUAGE_FAMILIES: Record<string, LanguageFamily> = {
  // Germanic
  en: 'germanic', de: 'germanic', nl: 'germanic', sv: 'germanic',
  no: 'germanic', da: 'germanic', is: 'germanic',

  // Romance
  es: 'romance', fr: 'romance', it: 'romance', pt: 'romance',
  ro: 'romance', ca: 'romance',

  // Slavic
  ru: 'slavic', pl: 'slavic', cs: 'slavic', sk: 'slavic',
  uk: 'slavic', bg: 'slavic', hr: 'slavic', sr: 'slavic',

  // Sino-Tibetan
  zh: 'sino-tibetan', bo: 'sino-tibetan',

  // Japonic
  ja: 'japonic',

  // Koreanic
  ko: 'koreanic',

  // Semitic
  ar: 'semitic', he: 'semitic',

  // Indo-Aryan
  hi: 'indo-aryan', ur: 'indo-aryan', bn: 'indo-aryan',
  pa: 'indo-aryan', gu: 'indo-aryan', mr: 'indo-aryan',

  // Dravidian
  ta: 'dravidian', te: 'dravidian', kn: 'dravidian', ml: 'dravidian',

  // Turkic
  tr: 'turkic', az: 'turkic', uz: 'turkic', kk: 'turkic',
};

/**
 * Get language family for a language code.
 */
export function getLanguageFamily(langCode: string): LanguageFamily {
  return LANGUAGE_FAMILIES[langCode.toLowerCase()] ?? 'other';
}

// =============================================================================
// Transfer Coefficient Tables
// =============================================================================

/**
 * Base transfer coefficients between language families when learning English.
 * These are empirically-derived estimates based on SLA research.
 */
const ENGLISH_TRANSFER_COEFFICIENTS: Record<LanguageFamily, TransferCoefficients> = {
  germanic: {
    phonological: 0.7,   // Similar phoneme inventory
    orthographic: 0.9,   // Same alphabet
    morphological: 0.6,  // Similar affixes (un-, -ness, -ly)
    lexical: 0.8,        // High cognate ratio (Germanic roots)
    syntactic: 0.7,      // Similar SVO order
    pragmatic: 0.6,      // Similar speech act conventions
  },

  romance: {
    phonological: 0.3,   // Different vowel systems
    orthographic: 0.8,   // Same alphabet, different spelling rules
    morphological: 0.5,  // Some shared Latin affixes
    lexical: 0.6,        // Many Latinate cognates in formal/medical English
    syntactic: 0.5,      // SVO but different adjective placement
    pragmatic: 0.4,      // Different politeness conventions
  },

  slavic: {
    phonological: 0.2,   // Different phoneme contrasts
    orthographic: 0.5,   // Cyrillic vs Latin (some languages)
    morphological: 0.2,  // Rich inflection vs analytic
    lexical: 0.2,        // Few cognates
    syntactic: 0.3,      // Flexible word order vs fixed SVO
    pragmatic: 0.3,      // Different directness norms
  },

  'sino-tibetan': {
    phonological: -0.3,  // Tonal vs non-tonal (negative transfer)
    orthographic: -0.4,  // Logographic vs alphabetic
    morphological: 0.1,  // Analytic similarity but different realization
    lexical: 0.0,        // No cognates
    syntactic: 0.2,      // SVO similarity
    pragmatic: -0.2,     // High-context vs low-context
  },

  japonic: {
    phonological: -0.2,  // Syllable-timed, limited phonemes
    orthographic: -0.3,  // Mixed writing system
    morphological: 0.1,  // Agglutinative vs analytic
    lexical: 0.1,        // Some English loanwords
    syntactic: -0.4,     // SOV vs SVO (major interference)
    pragmatic: -0.3,     // Keigo politeness system
  },

  koreanic: {
    phonological: -0.1,  // Different phoneme inventory
    orthographic: 0.2,   // Hangul is phonetic alphabet
    morphological: 0.2,  // Agglutinative features
    lexical: 0.1,        // Some English loanwords
    syntactic: -0.4,     // SOV vs SVO
    pragmatic: -0.2,     // Honorific system
  },

  semitic: {
    phonological: -0.1,  // Pharyngeal sounds not in English
    orthographic: -0.4,  // Right-to-left, abjad
    morphological: -0.2, // Triconsonantal roots (different system)
    lexical: 0.1,        // Few cognates
    syntactic: 0.3,      // VSO/SVO flexibility
    pragmatic: 0.0,      // Different conventions
  },

  'indo-aryan': {
    phonological: 0.1,   // Some shared sounds (Indo-European)
    orthographic: -0.3,  // Brahmic scripts
    morphological: 0.3,  // Some Indo-European affixes
    lexical: 0.2,        // Indo-European cognates
    syntactic: 0.2,      // SOV but some flexibility
    pragmatic: 0.1,      // Some shared British colonial influence
  },

  dravidian: {
    phonological: -0.1,  // Retroflex sounds
    orthographic: -0.3,  // Brahmic scripts
    morphological: 0.1,  // Agglutinative
    lexical: 0.0,        // No cognates
    syntactic: -0.3,     // SOV
    pragmatic: 0.1,      // Some English influence
  },

  turkic: {
    phonological: 0.2,   // Vowel harmony, but similar consonants
    orthographic: 0.7,   // Latin alphabet (modern Turkish)
    morphological: 0.0,  // Agglutinative vs analytic
    lexical: 0.1,        // Some loanwords
    syntactic: -0.3,     // SOV
    pragmatic: 0.1,      // Relatively neutral
  },

  other: {
    phonological: 0.0,
    orthographic: 0.0,
    morphological: 0.0,
    lexical: 0.0,
    syntactic: 0.0,
    pragmatic: 0.0,
  },
};

// =============================================================================
// Medical Domain Transfer Modifiers
// =============================================================================

/**
 * Domain-specific transfer bonuses.
 * Medical/scientific vocabulary has high Latin/Greek content.
 */
const MEDICAL_DOMAIN_TRANSFER: Record<LanguageFamily, number> = {
  germanic: 0.1,        // Some shared medical terms
  romance: 0.4,         // High Latin cognate ratio
  slavic: 0.1,          // Some Greek medical terms
  'sino-tibetan': 0.0,  // No cognates
  japonic: 0.1,         // Western medical terms borrowed
  koreanic: 0.1,        // Western medical terms borrowed
  semitic: 0.1,         // Arabic medical terms historical
  'indo-aryan': 0.1,    // Sanskrit medical terms
  dravidian: 0.0,       // No cognates
  turkic: 0.1,          // Some Western borrowings
  other: 0.0,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get transfer coefficients for a language pair.
 *
 * @param l1 - Native language code (ISO 639-1)
 * @param l2 - Target language code (ISO 639-1)
 * @returns Transfer coefficients for all components
 */
export function getTransferCoefficients(
  l1: string,
  l2: string
): TransferCoefficients {
  const l1Family = getLanguageFamily(l1);

  // Currently optimized for English as L2
  if (l2.toLowerCase() === 'en') {
    return ENGLISH_TRANSFER_COEFFICIENTS[l1Family];
  }

  // For other L2s, use symmetric approximation based on family distance
  const l2Family = getLanguageFamily(l2);

  if (l1Family === l2Family) {
    // Same family: high transfer
    return {
      phonological: 0.7,
      orthographic: 0.8,
      morphological: 0.6,
      lexical: 0.7,
      syntactic: 0.7,
      pragmatic: 0.5,
    };
  }

  // Default: use English coefficients as approximation
  return ENGLISH_TRANSFER_COEFFICIENTS[l1Family];
}

/**
 * Get complete language pair profile.
 */
export function getLanguagePairProfile(l1: string, l2: string): LanguagePairProfile {
  const l1Family = getLanguageFamily(l1);
  const l2Family = getLanguageFamily(l2);
  const coefficients = getTransferCoefficients(l1, l2);

  // Calculate cognate ratio estimate
  const cognateRatio = (coefficients.lexical + 1) / 2; // Convert -1..1 to 0..1

  // Calculate orthographic distance
  const orthographicDistance = 1 - (coefficients.orthographic + 1) / 2;

  return {
    l1,
    l2,
    l1Family,
    l2Family,
    coefficients,
    cognateRatio,
    orthographicDistance,
  };
}

/**
 * Calculate transfer-adjusted difficulty for a word.
 *
 * @param baseDifficulty - IRT difficulty parameter (logit scale)
 * @param l1 - Native language code
 * @param l2 - Target language code
 * @param componentType - Which linguistic component is being tested
 * @param domain - Optional domain for domain-specific transfer
 * @returns Adjusted difficulty with transfer effects
 */
export function calculateTransferAdjustedDifficulty(
  baseDifficulty: number,
  l1: string,
  l2: string,
  componentType: keyof TransferCoefficients,
  domain?: string
): TransferAdjustedDifficulty {
  const coefficients = getTransferCoefficients(l1, l2);
  const l1Family = getLanguageFamily(l1);

  // Get component-specific transfer coefficient
  let transfer = coefficients[componentType];

  // Apply domain-specific bonus for medical vocabulary
  if (domain === 'medical' && componentType === 'lexical') {
    transfer += MEDICAL_DOMAIN_TRANSFER[l1Family];
    transfer = Math.min(1, transfer); // Cap at 1
  }

  // Transfer modifier: positive transfer reduces difficulty, negative increases it
  // Scale: transfer of 1 reduces difficulty by 1 logit
  const transferModifier = -transfer * 0.5; // 0.5 logit per unit transfer

  const adjustedDifficulty = baseDifficulty + transferModifier;

  // Find dominant transfer type
  const types = Object.keys(coefficients) as (keyof TransferCoefficients)[];
  const dominantType = types.reduce((max, type) =>
    Math.abs(coefficients[type]) > Math.abs(coefficients[max]) ? type : max
  );

  // Generate description
  let description: string;
  if (transfer > 0.5) {
    description = `Strong positive transfer from ${l1} (${l1Family}) aids learning`;
  } else if (transfer > 0) {
    description = `Moderate positive transfer from ${l1}`;
  } else if (transfer > -0.3) {
    description = `Minimal transfer effect from ${l1}`;
  } else {
    description = `Potential interference from ${l1} (${l1Family}) patterns`;
  }

  return {
    baseDifficulty,
    transferModifier,
    adjustedDifficulty,
    dominantTransferType: dominantType,
    transferDescription: description,
  };
}

/**
 * Calculate cost reduction from L1-L2 transfer.
 * Used in the priority Cost calculation.
 *
 * @param l1 - Native language code
 * @param l2 - Target language code
 * @param objectType - Type of language object (LEX, MORPH, SYNT, etc.)
 * @param domain - Optional domain context
 * @returns Transfer gain (positive = reduces cost)
 */
export function calculateTransferGain(
  l1: string,
  l2: string,
  objectType: string,
  domain?: string
): number {
  // Map object type to component type
  const typeMapping: Record<string, keyof TransferCoefficients> = {
    LEX: 'lexical',
    MORPH: 'morphological',
    G2P: 'phonological',
    SYNT: 'syntactic',
    PRAG: 'pragmatic',
  };

  const componentType = typeMapping[objectType] ?? 'lexical';
  const coefficients = getTransferCoefficients(l1, l2);

  let gain = coefficients[componentType];

  // Medical domain bonus for lexical items
  if (domain === 'medical' && componentType === 'lexical') {
    const l1Family = getLanguageFamily(l1);
    gain += MEDICAL_DOMAIN_TRANSFER[l1Family];
  }

  // Normalize to 0-1 range (where 0 = no gain, 1 = maximum gain)
  return Math.max(0, (gain + 1) / 2);
}

/**
 * Get phonological difficulty adjustment for L1 speakers.
 * Accounts for phonemes in L2 not present in L1.
 */
export function getPhonologicalDifficultyBonus(
  l1: string,
  _word: string
): number {
  const coefficients = getTransferCoefficients(l1, 'en');
  const phonTransfer = coefficients.phonological;

  // Negative transfer increases difficulty
  if (phonTransfer < 0) {
    return Math.abs(phonTransfer) * 0.5; // Add up to 0.5 difficulty
  }

  // Positive transfer reduces difficulty
  return -phonTransfer * 0.3; // Reduce up to 0.3 difficulty
}

/**
 * Check if a word is likely a cognate between L1 and L2.
 * Simple heuristic based on orthographic similarity and language family.
 */
export function isCognate(
  word: string,
  l1: string,
  l2: string
): { isCognate: boolean; confidence: number } {
  const profile = getLanguagePairProfile(l1, l2);

  // High cognate ratio families are more likely to have cognates
  const baseConfidence = profile.cognateRatio;

  // Latin-origin words more likely to be cognates for Romance speakers
  const latinSuffixes = [
    '-tion', '-sion', '-ment', '-ity', '-ous', '-ive',
    '-al', '-ical', '-ology', '-ism', '-ist',
  ];

  const hasLatinSuffix = latinSuffixes.some((s) =>
    word.toLowerCase().endsWith(s)
  );

  if (hasLatinSuffix && profile.l1Family === 'romance') {
    return { isCognate: true, confidence: 0.8 };
  }

  // Germanic words for Germanic speakers
  const germanicPatterns = ['th', 'ght', 'wr', 'kn'];
  const hasGermanicPattern = germanicPatterns.some((p) =>
    word.toLowerCase().includes(p)
  );

  if (hasGermanicPattern && profile.l1Family === 'germanic') {
    return { isCognate: true, confidence: 0.7 };
  }

  // Default based on cognate ratio
  return {
    isCognate: baseConfidence > 0.4,
    confidence: baseConfidence,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  getLanguageFamily,
  getTransferCoefficients,
  getLanguagePairProfile,
  calculateTransferAdjustedDifficulty,
  calculateTransferGain,
  getPhonologicalDifficultyBonus,
  isCognate,
};
