/**
 * Register Profile Types
 *
 * Defines register profiles for pragmatic competence modeling.
 * Each register represents a formality level and context-specific
 * language variation.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.2
 */

import type { ComponentType } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Genre classification for text types.
 */
export type Genre =
  | 'academic_article'
  | 'business_email'
  | 'casual_conversation'
  | 'formal_letter'
  | 'news_report'
  | 'technical_documentation'
  | 'social_media'
  | 'narrative_fiction'
  | 'instructional'
  | 'persuasive'
  | 'medical_report'
  | 'legal_document'
  | 'informal_chat';

/**
 * Pragmatic function categories.
 */
export type PragmaticFunction =
  | 'informing'
  | 'requesting'
  | 'persuading'
  | 'instructing'
  | 'greeting'
  | 'apologizing'
  | 'thanking'
  | 'complaining'
  | 'refusing'
  | 'agreeing'
  | 'disagreeing'
  | 'hedging'
  | 'emphasizing'
  | 'narrating'
  | 'describing'
  | 'explaining'
  | 'suggesting';

/**
 * Register formality level.
 */
export type FormalityLevel =
  | 'frozen'       // Legal, liturgical (0.9-1.0)
  | 'formal'       // Academic, professional (0.7-0.9)
  | 'consultative' // Professional conversation (0.5-0.7)
  | 'casual'       // Friends, colleagues (0.3-0.5)
  | 'intimate';    // Close family, partners (0.0-0.3)

/**
 * Collocation pattern within register.
 */
export interface CollocationPattern {
  /** First word */
  word1: string;

  /** Second word */
  word2: string;

  /** Relationship type */
  relationshipType: 'verb_noun' | 'adj_noun' | 'adv_verb' | 'noun_noun' | 'phrasal';

  /** Strength (PMI score) */
  strength: number;

  /** Register-specificity (how tied to this register) */
  registerSpecificity: number;

  /** Example usage */
  example: string;
}

/**
 * Register profile definition.
 */
export interface RegisterProfile {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** Formality level */
  formalityLevel: FormalityLevel;

  /** Numeric formality (0-1) */
  formality: number;

  /** Associated text genres */
  genres: Genre[];

  /** High-frequency words in this register */
  typicalWords: string[];

  /** Register-specific collocations */
  collocations: CollocationPattern[];

  /** Common pragmatic functions */
  pragmaticFunctions: PragmaticFunction[];

  /** Linguistic features */
  features: RegisterFeatures;

  /** Example contexts */
  contexts: string[];

  /** Common errors by L1 speakers */
  commonErrors?: Record<string, string[]>;
}

/**
 * Linguistic features of a register.
 */
export interface RegisterFeatures {
  /** Average sentence length */
  avgSentenceLength: number;

  /** Use of passive voice (0-1) */
  passiveVoiceRate: number;

  /** Contraction usage (0-1) */
  contractionRate: number;

  /** Personal pronoun density */
  personalPronounDensity: number;

  /** Technical term density */
  technicalTermDensity: number;

  /** Hedging expression frequency */
  hedgingFrequency: number;

  /** Discourse marker density */
  discourseMarkerDensity: number;

  /** Modal verb usage */
  modalVerbRate: number;

  /** Complex sentence ratio */
  complexSentenceRatio: number;

  /** Nominalization rate */
  nominalizationRate: number;
}

/**
 * Domain structure containing registers.
 */
export interface DomainStructure {
  /** Domain identifier */
  id: string;

  /** Domain name */
  domain: string;

  /** Description */
  description: string;

  /** Registers within domain */
  registers: RegisterProfile[];

  /** Core vocabulary (essential words) */
  coreVocabulary: string[];

  /** Transition paths to other domains */
  transitionPaths: DomainTransition[];

  /** CEFR levels covered */
  cefrRange: ['A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'];
}

/**
 * Domain transition path.
 */
export interface DomainTransition {
  /** Source domain */
  fromDomain: string;

  /** Target domain */
  toDomain: string;

  /** Shared vocabulary count */
  sharedVocabulary: number;

  /** Transfer coefficient (0-1) */
  transferCoefficient: number;

  /** Bridge words (useful for transition) */
  bridgeWords: string[];
}

// =============================================================================
// Register Library
// =============================================================================

/**
 * Core register profiles.
 */
export const REGISTER_PROFILES: Record<string, RegisterProfile> = {
  // =========================================================================
  // Formal Registers
  // =========================================================================

  academic_formal: {
    id: 'academic_formal',
    name: 'Academic Formal',
    description: 'Formal academic writing in journals, theses, and scholarly publications',
    formalityLevel: 'formal',
    formality: 0.85,
    genres: ['academic_article', 'technical_documentation'],
    typicalWords: [
      'furthermore', 'consequently', 'nevertheless', 'hypothesis',
      'methodology', 'analysis', 'significant', 'demonstrate',
      'indicate', 'suggest', 'conclude', 'examine', 'investigate',
    ],
    collocations: [
      {
        word1: 'conduct',
        word2: 'research',
        relationshipType: 'verb_noun',
        strength: 8.5,
        registerSpecificity: 0.9,
        example: 'We conducted research on language acquisition.',
      },
      {
        word1: 'statistically',
        word2: 'significant',
        relationshipType: 'adv_verb',
        strength: 9.0,
        registerSpecificity: 0.95,
        example: 'The results were statistically significant.',
      },
      {
        word1: 'previous',
        word2: 'studies',
        relationshipType: 'adj_noun',
        strength: 7.8,
        registerSpecificity: 0.85,
        example: 'Previous studies have shown similar results.',
      },
    ],
    pragmaticFunctions: ['informing', 'explaining', 'persuading', 'hedging'],
    features: {
      avgSentenceLength: 25,
      passiveVoiceRate: 0.35,
      contractionRate: 0.02,
      personalPronounDensity: 0.15,
      technicalTermDensity: 0.25,
      hedgingFrequency: 0.2,
      discourseMarkerDensity: 0.15,
      modalVerbRate: 0.12,
      complexSentenceRatio: 0.6,
      nominalizationRate: 0.3,
    },
    contexts: [
      'Writing a research paper',
      'Presenting at a conference',
      'Submitting to an academic journal',
    ],
    commonErrors: {
      Chinese: ['Overuse of "we" instead of passive', 'Missing hedging'],
      Spanish: ['Run-on sentences', 'Direct translation of connectors'],
    },
  },

  business_formal: {
    id: 'business_formal',
    name: 'Business Formal',
    description: 'Formal business communication including reports, proposals, and official correspondence',
    formalityLevel: 'formal',
    formality: 0.8,
    genres: ['business_email', 'formal_letter'],
    typicalWords: [
      'regarding', 'pursuant', 'hereby', 'acknowledge',
      'facilitate', 'implement', 'streamline', 'leverage',
      'stakeholder', 'deliverable', 'milestone', 'objective',
    ],
    collocations: [
      {
        word1: 'submit',
        word2: 'proposal',
        relationshipType: 'verb_noun',
        strength: 8.0,
        registerSpecificity: 0.85,
        example: 'Please submit the proposal by Friday.',
      },
      {
        word1: 'key',
        word2: 'stakeholders',
        relationshipType: 'adj_noun',
        strength: 7.5,
        registerSpecificity: 0.9,
        example: 'We need to consult key stakeholders.',
      },
    ],
    pragmaticFunctions: ['informing', 'requesting', 'persuading', 'instructing'],
    features: {
      avgSentenceLength: 20,
      passiveVoiceRate: 0.25,
      contractionRate: 0.05,
      personalPronounDensity: 0.2,
      technicalTermDensity: 0.15,
      hedgingFrequency: 0.15,
      discourseMarkerDensity: 0.12,
      modalVerbRate: 0.15,
      complexSentenceRatio: 0.45,
      nominalizationRate: 0.25,
    },
    contexts: [
      'Writing a business proposal',
      'Formal email to clients',
      'Annual report',
    ],
  },

  legal_frozen: {
    id: 'legal_frozen',
    name: 'Legal Frozen',
    description: 'Highly formal legal language in contracts, statutes, and official documents',
    formalityLevel: 'frozen',
    formality: 0.95,
    genres: ['legal_document'],
    typicalWords: [
      'herein', 'thereof', 'whereas', 'notwithstanding',
      'aforementioned', 'hereafter', 'pursuant', 'shall',
      'liability', 'indemnify', 'covenant', 'jurisdiction',
    ],
    collocations: [
      {
        word1: 'null',
        word2: 'void',
        relationshipType: 'noun_noun',
        strength: 9.5,
        registerSpecificity: 0.98,
        example: 'The contract shall be null and void.',
      },
      {
        word1: 'binding',
        word2: 'agreement',
        relationshipType: 'adj_noun',
        strength: 8.8,
        registerSpecificity: 0.92,
        example: 'This is a legally binding agreement.',
      },
    ],
    pragmaticFunctions: ['informing', 'instructing'],
    features: {
      avgSentenceLength: 35,
      passiveVoiceRate: 0.45,
      contractionRate: 0.0,
      personalPronounDensity: 0.05,
      technicalTermDensity: 0.35,
      hedgingFrequency: 0.05,
      discourseMarkerDensity: 0.08,
      modalVerbRate: 0.2,
      complexSentenceRatio: 0.75,
      nominalizationRate: 0.4,
    },
    contexts: [
      'Contract drafting',
      'Legal proceedings',
      'Statutory interpretation',
    ],
  },

  // =========================================================================
  // Consultative Registers
  // =========================================================================

  professional_consultative: {
    id: 'professional_consultative',
    name: 'Professional Consultative',
    description: 'Professional conversation between colleagues or with clients',
    formalityLevel: 'consultative',
    formality: 0.6,
    genres: ['business_email', 'instructional'],
    typicalWords: [
      'basically', 'actually', 'essentially', 'generally',
      'typically', 'perhaps', 'probably', 'likely',
      'suggest', 'recommend', 'consider', 'approach',
    ],
    collocations: [
      {
        word1: 'touch',
        word2: 'base',
        relationshipType: 'phrasal',
        strength: 7.0,
        registerSpecificity: 0.75,
        example: 'Let\'s touch base next week.',
      },
      {
        word1: 'moving',
        word2: 'forward',
        relationshipType: 'phrasal',
        strength: 7.2,
        registerSpecificity: 0.7,
        example: 'Moving forward, we should focus on quality.',
      },
    ],
    pragmaticFunctions: ['informing', 'requesting', 'suggesting', 'agreeing', 'disagreeing'],
    features: {
      avgSentenceLength: 15,
      passiveVoiceRate: 0.15,
      contractionRate: 0.3,
      personalPronounDensity: 0.35,
      technicalTermDensity: 0.1,
      hedgingFrequency: 0.2,
      discourseMarkerDensity: 0.18,
      modalVerbRate: 0.18,
      complexSentenceRatio: 0.35,
      nominalizationRate: 0.15,
    },
    contexts: [
      'Team meetings',
      'Client consultations',
      'Professional networking',
    ],
  },

  medical_professional: {
    id: 'medical_professional',
    name: 'Medical Professional',
    description: 'Communication between healthcare professionals',
    formalityLevel: 'consultative',
    formality: 0.65,
    genres: ['medical_report', 'instructional'],
    typicalWords: [
      'diagnose', 'prescribe', 'administer', 'symptom',
      'prognosis', 'contraindication', 'dosage', 'patient',
      'treatment', 'therapy', 'chronic', 'acute',
    ],
    collocations: [
      {
        word1: 'administer',
        word2: 'medication',
        relationshipType: 'verb_noun',
        strength: 8.5,
        registerSpecificity: 0.95,
        example: 'The nurse will administer the medication.',
      },
      {
        word1: 'vital',
        word2: 'signs',
        relationshipType: 'adj_noun',
        strength: 9.0,
        registerSpecificity: 0.98,
        example: 'Monitor the patient\'s vital signs.',
      },
    ],
    pragmaticFunctions: ['informing', 'instructing', 'explaining', 'requesting'],
    features: {
      avgSentenceLength: 18,
      passiveVoiceRate: 0.3,
      contractionRate: 0.1,
      personalPronounDensity: 0.2,
      technicalTermDensity: 0.35,
      hedgingFrequency: 0.15,
      discourseMarkerDensity: 0.1,
      modalVerbRate: 0.15,
      complexSentenceRatio: 0.4,
      nominalizationRate: 0.25,
    },
    contexts: [
      'Medical consultations',
      'Patient handoffs',
      'Case discussions',
    ],
  },

  // =========================================================================
  // Casual Registers
  // =========================================================================

  casual_conversation: {
    id: 'casual_conversation',
    name: 'Casual Conversation',
    description: 'Everyday conversation between friends and acquaintances',
    formalityLevel: 'casual',
    formality: 0.35,
    genres: ['casual_conversation', 'social_media'],
    typicalWords: [
      'gonna', 'wanna', 'kinda', 'stuff',
      'cool', 'awesome', 'basically', 'like',
      'thing', 'guy', 'yeah', 'okay',
    ],
    collocations: [
      {
        word1: 'hang',
        word2: 'out',
        relationshipType: 'phrasal',
        strength: 8.0,
        registerSpecificity: 0.85,
        example: 'Let\'s hang out this weekend.',
      },
      {
        word1: 'no',
        word2: 'way',
        relationshipType: 'phrasal',
        strength: 7.5,
        registerSpecificity: 0.8,
        example: 'No way! That\'s amazing!',
      },
    ],
    pragmaticFunctions: ['greeting', 'agreeing', 'disagreeing', 'narrating', 'complaining'],
    features: {
      avgSentenceLength: 8,
      passiveVoiceRate: 0.05,
      contractionRate: 0.7,
      personalPronounDensity: 0.5,
      technicalTermDensity: 0.02,
      hedgingFrequency: 0.1,
      discourseMarkerDensity: 0.25,
      modalVerbRate: 0.1,
      complexSentenceRatio: 0.15,
      nominalizationRate: 0.05,
    },
    contexts: [
      'Chatting with friends',
      'Social gatherings',
      'Texting',
    ],
  },

  social_media_informal: {
    id: 'social_media_informal',
    name: 'Social Media Informal',
    description: 'Informal writing on social platforms',
    formalityLevel: 'casual',
    formality: 0.25,
    genres: ['social_media', 'informal_chat'],
    typicalWords: [
      'lol', 'omg', 'btw', 'tbh',
      'literally', 'totally', 'amazing', 'love',
      'hate', 'obsessed', 'goals', 'mood',
    ],
    collocations: [
      {
        word1: 'can\'t',
        word2: 'even',
        relationshipType: 'phrasal',
        strength: 6.5,
        registerSpecificity: 0.9,
        example: 'I can\'t even right now.',
      },
    ],
    pragmaticFunctions: ['greeting', 'agreeing', 'complaining', 'emphasizing', 'narrating'],
    features: {
      avgSentenceLength: 6,
      passiveVoiceRate: 0.02,
      contractionRate: 0.85,
      personalPronounDensity: 0.6,
      technicalTermDensity: 0.01,
      hedgingFrequency: 0.05,
      discourseMarkerDensity: 0.3,
      modalVerbRate: 0.08,
      complexSentenceRatio: 0.1,
      nominalizationRate: 0.02,
    },
    contexts: [
      'Twitter/X posts',
      'Instagram captions',
      'Casual comments',
    ],
  },

  // =========================================================================
  // News/Media Register
  // =========================================================================

  news_journalistic: {
    id: 'news_journalistic',
    name: 'News Journalistic',
    description: 'Neutral, objective news reporting style',
    formalityLevel: 'consultative',
    formality: 0.55,
    genres: ['news_report'],
    typicalWords: [
      'reported', 'announced', 'according', 'sources',
      'officials', 'statement', 'investigation', 'alleged',
      'confirmed', 'revealed', 'sparked', 'controversy',
    ],
    collocations: [
      {
        word1: 'breaking',
        word2: 'news',
        relationshipType: 'adj_noun',
        strength: 9.0,
        registerSpecificity: 0.95,
        example: 'Breaking news from the capital.',
      },
      {
        word1: 'sources',
        word2: 'say',
        relationshipType: 'noun_noun',
        strength: 7.5,
        registerSpecificity: 0.85,
        example: 'Sources say the deal is imminent.',
      },
    ],
    pragmaticFunctions: ['informing', 'narrating', 'describing'],
    features: {
      avgSentenceLength: 20,
      passiveVoiceRate: 0.25,
      contractionRate: 0.1,
      personalPronounDensity: 0.15,
      technicalTermDensity: 0.08,
      hedgingFrequency: 0.12,
      discourseMarkerDensity: 0.1,
      modalVerbRate: 0.08,
      complexSentenceRatio: 0.4,
      nominalizationRate: 0.2,
    },
    contexts: [
      'News articles',
      'Press releases',
      'News broadcasts',
    ],
  },
};

// =============================================================================
// Domain Structures
// =============================================================================

/**
 * Pre-defined domain structures.
 */
export const DOMAIN_STRUCTURES: Record<string, DomainStructure> = {
  general: {
    id: 'general',
    domain: 'General English',
    description: 'Everyday English for general communication',
    registers: [
      REGISTER_PROFILES.casual_conversation,
      REGISTER_PROFILES.professional_consultative,
    ],
    coreVocabulary: [
      'be', 'have', 'do', 'say', 'go', 'get', 'make', 'know',
      'think', 'take', 'see', 'come', 'want', 'use', 'find',
    ],
    transitionPaths: [
      {
        fromDomain: 'general',
        toDomain: 'academic',
        sharedVocabulary: 500,
        transferCoefficient: 0.6,
        bridgeWords: ['explain', 'describe', 'analyze', 'compare'],
      },
      {
        fromDomain: 'general',
        toDomain: 'business',
        sharedVocabulary: 400,
        transferCoefficient: 0.55,
        bridgeWords: ['meeting', 'project', 'team', 'deadline'],
      },
    ],
    cefrRange: ['A1', 'B2'],
  },

  academic: {
    id: 'academic',
    domain: 'Academic English',
    description: 'English for academic and research purposes',
    registers: [
      REGISTER_PROFILES.academic_formal,
    ],
    coreVocabulary: [
      'research', 'study', 'analysis', 'method', 'result',
      'theory', 'data', 'evidence', 'conclusion', 'hypothesis',
    ],
    transitionPaths: [
      {
        fromDomain: 'academic',
        toDomain: 'general',
        sharedVocabulary: 500,
        transferCoefficient: 0.7,
        bridgeWords: ['explain', 'understand', 'show', 'prove'],
      },
    ],
    cefrRange: ['B1', 'C2'],
  },

  business: {
    id: 'business',
    domain: 'Business English',
    description: 'English for professional and business contexts',
    registers: [
      REGISTER_PROFILES.business_formal,
      REGISTER_PROFILES.professional_consultative,
    ],
    coreVocabulary: [
      'meeting', 'project', 'deadline', 'client', 'budget',
      'revenue', 'strategy', 'market', 'sales', 'profit',
    ],
    transitionPaths: [
      {
        fromDomain: 'business',
        toDomain: 'general',
        sharedVocabulary: 400,
        transferCoefficient: 0.65,
        bridgeWords: ['explain', 'discuss', 'plan', 'agree'],
      },
    ],
    cefrRange: ['A2', 'C1'],
  },

  medical: {
    id: 'medical',
    domain: 'Medical English',
    description: 'English for healthcare professionals',
    registers: [
      REGISTER_PROFILES.medical_professional,
    ],
    coreVocabulary: [
      'patient', 'treatment', 'diagnosis', 'symptom', 'medication',
      'procedure', 'condition', 'therapy', 'prognosis', 'care',
    ],
    transitionPaths: [
      {
        fromDomain: 'medical',
        toDomain: 'general',
        sharedVocabulary: 300,
        transferCoefficient: 0.5,
        bridgeWords: ['health', 'doctor', 'hospital', 'medicine'],
      },
      {
        fromDomain: 'medical',
        toDomain: 'academic',
        sharedVocabulary: 350,
        transferCoefficient: 0.6,
        bridgeWords: ['research', 'study', 'evidence', 'analysis'],
      },
    ],
    cefrRange: ['B1', 'C2'],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get register by formality level.
 */
export function getRegistersByFormality(level: FormalityLevel): RegisterProfile[] {
  return Object.values(REGISTER_PROFILES).filter(r => r.formalityLevel === level);
}

/**
 * Get registers by genre.
 */
export function getRegistersByGenre(genre: Genre): RegisterProfile[] {
  return Object.values(REGISTER_PROFILES).filter(r => r.genres.includes(genre));
}

/**
 * Find register closest to formality value.
 */
export function findClosestRegister(formality: number): RegisterProfile {
  let closest = Object.values(REGISTER_PROFILES)[0];
  let minDiff = Math.abs(closest.formality - formality);

  for (const register of Object.values(REGISTER_PROFILES)) {
    const diff = Math.abs(register.formality - formality);
    if (diff < minDiff) {
      minDiff = diff;
      closest = register;
    }
  }

  return closest;
}

/**
 * Get domain by ID.
 */
export function getDomain(domainId: string): DomainStructure | undefined {
  return DOMAIN_STRUCTURES[domainId];
}

/**
 * Get all registers for a domain.
 */
export function getRegistersForDomain(domainId: string): RegisterProfile[] {
  const domain = DOMAIN_STRUCTURES[domainId];
  return domain ? domain.registers : [];
}

/**
 * Calculate formality distance between two registers.
 */
export function calculateFormalityDistance(
  register1: RegisterProfile,
  register2: RegisterProfile
): number {
  return Math.abs(register1.formality - register2.formality);
}

/**
 * Check if word is typical for register.
 */
export function isTypicalForRegister(word: string, registerId: string): boolean {
  const register = REGISTER_PROFILES[registerId];
  if (!register) return false;

  return register.typicalWords.includes(word.toLowerCase());
}

/**
 * Get collocations for a word within a register.
 */
export function getCollocationsInRegister(
  word: string,
  registerId: string
): CollocationPattern[] {
  const register = REGISTER_PROFILES[registerId];
  if (!register) return [];

  return register.collocations.filter(
    c => c.word1.toLowerCase() === word.toLowerCase() ||
         c.word2.toLowerCase() === word.toLowerCase()
  );
}
