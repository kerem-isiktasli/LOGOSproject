/**
 * Pragmatics Module
 *
 * Implements pragmatic competence analysis for language learning.
 * Covers register, speech acts, politeness, and contextual appropriateness.
 *
 * Pragmatics is the "hidden curriculum" of language learning - knowing not just
 * what is grammatically correct but what is socially appropriate in context.
 *
 * Academic References:
 * - Brown, P. & Levinson, S.C. (1987). Politeness: Some Universals in Language Usage.
 * - Bardovi-Harlig, K. (2013). Developing L2 Pragmatics. Language Learning.
 * - Kasper, G. & Rose, K.R. (2002). Pragmatic Development in a Second Language.
 * - Taguchi, N. (2015). Instructed pragmatics at a glance and then focus on
 *   speech-act production in a second language. Language Teaching.
 *
 * @module core/pragmatics
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Register levels in English.
 * Based on Biber's register analysis framework.
 */
export type Register =
  | 'frozen'       // Legal documents, religious texts, oaths
  | 'formal'       // Academic papers, professional reports, official communication
  | 'consultative' // Doctor-patient, teacher-student, business meetings
  | 'casual'       // Friends, colleagues, familiar conversation
  | 'intimate';    // Family, close friends, private communication

/**
 * Speech act categories.
 * Based on Searle's (1979) speech act taxonomy.
 */
export type SpeechActCategory =
  | 'assertive'    // Stating facts, claiming, reporting
  | 'directive'    // Requesting, ordering, advising
  | 'commissive'   // Promising, offering, threatening
  | 'expressive'   // Thanking, apologizing, congratulating
  | 'declarative'; // Declaring, pronouncing, sentencing

/**
 * Specific speech act types commonly taught in L2 pragmatics.
 */
export type SpeechActType =
  // Assertives
  | 'statement' | 'claim' | 'report' | 'description'
  // Directives
  | 'request' | 'command' | 'suggestion' | 'invitation' | 'warning'
  // Commissives
  | 'promise' | 'offer' | 'refusal' | 'threat'
  // Expressives
  | 'apology' | 'thanks' | 'congratulation' | 'complaint' | 'compliment'
  // Declaratives
  | 'declaration' | 'announcement';

/**
 * Politeness strategy based on Brown & Levinson.
 */
export type PolitenessStrategy =
  | 'bald_on_record'     // Direct, no mitigation ("Give me that")
  | 'positive_politeness' // Solidarity, in-group markers ("Hey buddy, could you...")
  | 'negative_politeness' // Deference, hedging ("I was wondering if you might...")
  | 'off_record'          // Indirect, hints ("It's cold in here" = close window)
  | 'dont_do_fta';        // Avoid the face-threatening act entirely

/**
 * Face-threatening act direction.
 */
export type FTADirection =
  | 'speaker_positive'  // Threatens speaker's positive face (apology)
  | 'speaker_negative'  // Threatens speaker's negative face (accepting offer)
  | 'hearer_positive'   // Threatens hearer's positive face (criticism)
  | 'hearer_negative';  // Threatens hearer's negative face (request)

/**
 * Context factors affecting pragmatic choices.
 */
export interface PragmaticContext {
  /** Power differential: positive = speaker has more power */
  powerDifferential: number;

  /** Social distance: higher = more distant relationship */
  socialDistance: number;

  /** Imposition rank: how big the request/action is */
  impositionRank: number;

  /** Cultural context */
  culturalContext: 'western' | 'east_asian' | 'middle_eastern' | 'latin' | 'neutral';

  /** Setting formality */
  setting: 'professional' | 'academic' | 'social' | 'private';
}

/**
 * Pragmatic appropriateness assessment.
 */
export interface PragmaticAssessment {
  /** Overall appropriateness score (0-1) */
  overallScore: number;

  /** Register appropriateness (0-1) */
  registerScore: number;

  /** Politeness appropriateness (0-1) */
  politenessScore: number;

  /** Speech act execution quality (0-1) */
  speechActScore: number;

  /** Detected issues */
  issues: PragmaticIssue[];

  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * A specific pragmatic issue detected.
 */
export interface PragmaticIssue {
  type: 'register_mismatch' | 'politeness_violation' | 'speech_act_failure' | 'cultural_mismatch';
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  location?: string;
  suggestion?: string;
}

/**
 * Pragmatic profile for a language expression.
 */
export interface PragmaticProfile {
  /** Typical register for this expression */
  register: Register;

  /** Flexibility across registers (0-1) */
  registerFlexibility: number;

  /** Speech act category if applicable */
  speechActCategory?: SpeechActCategory;

  /** Specific speech act type */
  speechActType?: SpeechActType;

  /** Typical politeness strategy */
  politenessStrategy?: PolitenessStrategy;

  /** Cultural sensitivity level (0-1) */
  culturalSensitivity: number;

  /** Domain appropriateness */
  domainAppropriateness: Record<string, number>;
}

// =============================================================================
// Register Analysis
// =============================================================================

/**
 * Register markers - linguistic features indicating register.
 */
const REGISTER_MARKERS: Record<Register, {
  vocabulary: string[];
  contractions: boolean;
  passiveVoice: number; // likelihood 0-1
  firstPerson: number;  // likelihood 0-1
  hedging: number;      // likelihood 0-1
}> = {
  frozen: {
    vocabulary: ['hereby', 'whereas', 'aforementioned', 'notwithstanding', 'heretofore'],
    contractions: false,
    passiveVoice: 0.9,
    firstPerson: 0.1,
    hedging: 0.2,
  },
  formal: {
    vocabulary: ['therefore', 'consequently', 'moreover', 'furthermore', 'regarding'],
    contractions: false,
    passiveVoice: 0.7,
    firstPerson: 0.3,
    hedging: 0.6,
  },
  consultative: {
    vocabulary: ['please', 'could you', 'would you mind', "I'd recommend", 'in my opinion'],
    contractions: true,
    passiveVoice: 0.4,
    firstPerson: 0.7,
    hedging: 0.7,
  },
  casual: {
    vocabulary: ['kinda', 'gonna', 'wanna', 'stuff', 'yeah', 'cool', 'awesome'],
    contractions: true,
    passiveVoice: 0.1,
    firstPerson: 0.9,
    hedging: 0.3,
  },
  intimate: {
    vocabulary: ['honey', 'sweetie', 'babe', "c'mon", 'y\'know'],
    contractions: true,
    passiveVoice: 0.05,
    firstPerson: 0.95,
    hedging: 0.2,
  },
};

/**
 * Analyze the register of a text.
 *
 * @param text - Text to analyze
 * @returns Register scores for each level
 */
export function analyzeRegister(text: string): Record<Register, number> {
  const lowerText = text.toLowerCase();
  const scores: Record<Register, number> = {
    frozen: 0,
    formal: 0,
    consultative: 0,
    casual: 0,
    intimate: 0,
  };

  // Check vocabulary markers
  for (const [register, markers] of Object.entries(REGISTER_MARKERS)) {
    let markerCount = 0;
    for (const word of markers.vocabulary) {
      if (lowerText.includes(word.toLowerCase())) {
        markerCount++;
      }
    }
    scores[register as Register] += markerCount * 0.2;
  }

  // Check contractions
  const hasContractions = /\b(don't|can't|won't|isn't|aren't|I'm|you're|we're|they're|it's|that's|what's|who's|there's|here's|let's|'ll|'ve|'d)\b/i.test(text);

  if (hasContractions) {
    scores.casual += 0.2;
    scores.consultative += 0.1;
    scores.intimate += 0.15;
  } else {
    scores.formal += 0.15;
    scores.frozen += 0.1;
  }

  // Check passive voice (simplified)
  const passivePattern = /\b(is|are|was|were|been|being)\s+\w+ed\b/gi;
  const passiveCount = (text.match(passivePattern) || []).length;
  if (passiveCount > 0) {
    scores.frozen += passiveCount * 0.1;
    scores.formal += passiveCount * 0.08;
  }

  // Check first person usage
  const firstPersonCount = (text.match(/\b(I|me|my|mine|we|us|our|ours)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;
  const firstPersonRatio = wordCount > 0 ? firstPersonCount / wordCount : 0;

  if (firstPersonRatio > 0.1) {
    scores.casual += 0.15;
    scores.intimate += 0.1;
  } else if (firstPersonRatio < 0.02) {
    scores.formal += 0.1;
    scores.frozen += 0.1;
  }

  // Normalize scores
  const maxScore = Math.max(...Object.values(scores), 0.001);
  for (const register of Object.keys(scores) as Register[]) {
    scores[register] = Math.min(1, scores[register] / maxScore);
  }

  return scores;
}

/**
 * Detect the dominant register of a text.
 */
export function detectRegister(text: string): Register {
  const scores = analyzeRegister(text);
  let maxScore = 0;
  let dominant: Register = 'consultative';

  for (const [register, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominant = register as Register;
    }
  }

  return dominant;
}

/**
 * Check if a register is appropriate for a context.
 */
export function isRegisterAppropriate(
  usedRegister: Register,
  context: PragmaticContext
): { appropriate: boolean; explanation: string } {
  const registerOrder: Register[] = ['intimate', 'casual', 'consultative', 'formal', 'frozen'];
  const usedIndex = registerOrder.indexOf(usedRegister);

  // Determine expected register from context
  let expectedIndex: number;

  if (context.setting === 'professional' || context.setting === 'academic') {
    expectedIndex = context.powerDifferential > 0 ? 2 : 3; // consultative or formal
  } else if (context.setting === 'social') {
    expectedIndex = context.socialDistance > 0.5 ? 2 : 1; // consultative or casual
  } else {
    expectedIndex = 0; // intimate for private
  }

  // Adjust for power differential
  if (context.powerDifferential < -0.5) {
    expectedIndex = Math.min(4, expectedIndex + 1); // More formal when speaking to authority
  }

  const difference = Math.abs(usedIndex - expectedIndex);

  if (difference === 0) {
    return { appropriate: true, explanation: 'Register matches the context perfectly.' };
  } else if (difference === 1) {
    return { appropriate: true, explanation: 'Register is acceptable for this context.' };
  } else if (usedIndex < expectedIndex) {
    return {
      appropriate: false,
      explanation: `Register is too informal. Consider using ${registerOrder[expectedIndex]} register.`,
    };
  } else {
    return {
      appropriate: false,
      explanation: `Register is overly formal for this context. ${registerOrder[expectedIndex]} register would be more natural.`,
    };
  }
}

// =============================================================================
// Speech Act Analysis
// =============================================================================

/**
 * Speech act patterns for recognition.
 */
const SPEECH_ACT_PATTERNS: Record<SpeechActType, RegExp[]> = {
  // Assertives
  statement: [/^(I think|I believe|In my opinion|It seems)/i],
  claim: [/^(I claim|I assert|The fact is|It is true that)/i],
  report: [/^(I heard|They said|According to|It was reported)/i],
  description: [/^(It is|There is|This has|The \w+ is)/i],

  // Directives
  request: [
    /^(Could you|Would you|Can you|Will you|Please)/i,
    /\?$/,
    /(I was wondering if|Do you mind|Would it be possible)/i,
  ],
  command: [/^(Do|Don't|Stop|Start|Give|Take|Go|Come|Be quiet|Listen)/i],
  suggestion: [/(Why don't you|You should|You might want to|How about|What about)/i],
  invitation: [/(Would you like to|Do you want to|Let's|Shall we|Come with)/i],
  warning: [/(Be careful|Watch out|Don't forget|Make sure|Warning)/i],

  // Commissives
  promise: [/(I promise|I will|I'll make sure|You have my word|I guarantee)/i],
  offer: [/(Let me|I can|Shall I|Would you like me to|I'd be happy to)/i],
  refusal: [/(I'm sorry but|I'm afraid|I can't|I won't be able to|Unfortunately)/i],
  threat: [/(If you don't|Or else|I'll have to|You'll regret)/i],

  // Expressives
  apology: [/(I'm sorry|I apologize|Forgive me|My apologies|I regret)/i],
  thanks: [/(Thank you|Thanks|I appreciate|I'm grateful|Much obliged)/i],
  congratulation: [/(Congratulations|Well done|Good job|Way to go|I'm proud)/i],
  complaint: [/(I'm not happy|This is unacceptable|I have a problem|Why did you)/i],
  compliment: [/(You look|That's great|Excellent|Wonderful|I love your)/i],

  // Declaratives
  declaration: [/(I hereby|I declare|I pronounce|Let it be known)/i],
  announcement: [/(I'd like to announce|We are pleased to|It is my pleasure)/i],
};

/**
 * Detect the speech act type of an utterance.
 */
export function detectSpeechAct(utterance: string): {
  category: SpeechActCategory | null;
  type: SpeechActType | null;
  confidence: number;
} {
  const categoryMapping: Record<SpeechActType, SpeechActCategory> = {
    statement: 'assertive', claim: 'assertive', report: 'assertive', description: 'assertive',
    request: 'directive', command: 'directive', suggestion: 'directive', invitation: 'directive', warning: 'directive',
    promise: 'commissive', offer: 'commissive', refusal: 'commissive', threat: 'commissive',
    apology: 'expressive', thanks: 'expressive', congratulation: 'expressive', complaint: 'expressive', compliment: 'expressive',
    declaration: 'declarative', announcement: 'declarative',
  };

  let bestMatch: SpeechActType | null = null;
  let bestConfidence = 0;

  for (const [type, patterns] of Object.entries(SPEECH_ACT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(utterance)) {
        const confidence = 0.7; // Base confidence for pattern match
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = type as SpeechActType;
        }
      }
    }
  }

  // Question mark often indicates request
  if (utterance.trim().endsWith('?') && bestConfidence < 0.5) {
    bestMatch = 'request';
    bestConfidence = 0.5;
  }

  return {
    category: bestMatch ? categoryMapping[bestMatch] : null,
    type: bestMatch,
    confidence: bestConfidence,
  };
}

// =============================================================================
// Politeness Analysis
// =============================================================================

/**
 * Politeness markers for each strategy.
 */
const POLITENESS_MARKERS: Record<PolitenessStrategy, string[]> = {
  bald_on_record: [
    'do it', 'give me', 'tell me', 'stop', 'wait', 'listen',
  ],
  positive_politeness: [
    'buddy', 'friend', 'we', 'us', 'let\'s', 'together',
    'great', 'awesome', 'love', 'appreciate',
  ],
  negative_politeness: [
    'would you mind', 'I was wondering', 'if it\'s not too much trouble',
    'I don\'t want to bother you', 'possibly', 'perhaps', 'might',
    'I hate to ask', 'sorry to trouble you',
  ],
  off_record: [
    'it\'s cold', 'it\'s hot', 'I\'m thirsty', 'I\'m hungry',
    'someone should', 'it would be nice if',
  ],
  dont_do_fta: [],
};

/**
 * Analyze politeness strategy used in an utterance.
 */
export function analyzePoliteness(utterance: string): {
  strategy: PolitenessStrategy;
  confidence: number;
  markers: string[];
} {
  const lowerUtterance = utterance.toLowerCase();
  const foundMarkers: string[] = [];
  const strategyScores: Record<PolitenessStrategy, number> = {
    bald_on_record: 0,
    positive_politeness: 0,
    negative_politeness: 0,
    off_record: 0,
    dont_do_fta: 0,
  };

  for (const [strategy, markers] of Object.entries(POLITENESS_MARKERS)) {
    for (const marker of markers) {
      if (lowerUtterance.includes(marker.toLowerCase())) {
        strategyScores[strategy as PolitenessStrategy]++;
        foundMarkers.push(marker);
      }
    }
  }

  // Find dominant strategy
  let maxScore = 0;
  let dominant: PolitenessStrategy = 'bald_on_record';

  for (const [strategy, score] of Object.entries(strategyScores)) {
    if (score > maxScore) {
      maxScore = score;
      dominant = strategy as PolitenessStrategy;
    }
  }

  // Calculate confidence
  const totalMarkers = Object.values(strategyScores).reduce((a, b) => a + b, 0);
  const confidence = totalMarkers > 0 ? maxScore / totalMarkers : 0.3;

  return {
    strategy: dominant,
    confidence: Math.min(1, confidence),
    markers: foundMarkers,
  };
}

/**
 * Recommend appropriate politeness strategy for a context.
 */
export function recommendPolitenessStrategy(
  context: PragmaticContext,
  speechActType?: SpeechActType
): PolitenessStrategy {
  // Calculate weight of FTA (face-threatening act)
  const ftaWeight =
    context.powerDifferential * -1 +
    context.socialDistance +
    context.impositionRank;

  // High FTA weight = more indirect strategy needed
  if (ftaWeight > 1.5) {
    return 'off_record';
  } else if (ftaWeight > 0.5) {
    return 'negative_politeness';
  } else if (ftaWeight > -0.5) {
    return context.socialDistance < 0.3 ? 'positive_politeness' : 'negative_politeness';
  } else {
    return 'bald_on_record';
  }
}

// =============================================================================
// Pragmatic Assessment
// =============================================================================

/**
 * Assess the pragmatic appropriateness of an utterance in context.
 */
export function assessPragmaticAppropriateness(
  utterance: string,
  context: PragmaticContext,
  intendedSpeechAct?: SpeechActType
): PragmaticAssessment {
  const issues: PragmaticIssue[] = [];
  const recommendations: string[] = [];

  // 1. Register analysis
  const detectedRegister = detectRegister(utterance);
  const registerCheck = isRegisterAppropriate(detectedRegister, context);
  const registerScore = registerCheck.appropriate ? 1 : 0.5;

  if (!registerCheck.appropriate) {
    issues.push({
      type: 'register_mismatch',
      severity: 'moderate',
      description: registerCheck.explanation,
    });
    recommendations.push(registerCheck.explanation);
  }

  // 2. Speech act analysis
  const speechAct = detectSpeechAct(utterance);
  let speechActScore = 1;

  if (intendedSpeechAct && speechAct.type !== intendedSpeechAct) {
    speechActScore = 0.6;
    issues.push({
      type: 'speech_act_failure',
      severity: 'moderate',
      description: `Intended ${intendedSpeechAct} but utterance reads as ${speechAct.type || 'unclear'}`,
    });
  }

  // 3. Politeness analysis
  const politeness = analyzePoliteness(utterance);
  const recommendedStrategy = recommendPolitenessStrategy(context, intendedSpeechAct);
  let politenessScore = 1;

  const strategyOrder: PolitenessStrategy[] = [
    'bald_on_record',
    'positive_politeness',
    'negative_politeness',
    'off_record',
    'dont_do_fta',
  ];

  const usedIndex = strategyOrder.indexOf(politeness.strategy);
  const recommendedIndex = strategyOrder.indexOf(recommendedStrategy);

  if (usedIndex < recommendedIndex - 1) {
    politenessScore = 0.4;
    issues.push({
      type: 'politeness_violation',
      severity: 'major',
      description: `Too direct for this context. Consider using ${recommendedStrategy.replace('_', ' ')}`,
    });
    recommendations.push(`Use more indirect language: ${recommendedStrategy.replace('_', ' ')}`);
  } else if (usedIndex > recommendedIndex + 1) {
    politenessScore = 0.7;
    issues.push({
      type: 'politeness_violation',
      severity: 'minor',
      description: 'Overly indirect for this context, may seem insincere or inefficient',
    });
  }

  // 4. Cultural considerations
  if (context.culturalContext !== 'neutral' && context.culturalContext !== 'western') {
    if (context.culturalContext === 'east_asian' && politeness.strategy === 'bald_on_record') {
      issues.push({
        type: 'cultural_mismatch',
        severity: 'major',
        description: 'Direct requests may be considered rude in East Asian contexts',
      });
      recommendations.push('Consider adding more hedging and deference markers');
    }
  }

  // Calculate overall score
  const overallScore = (registerScore * 0.3 + politenessScore * 0.4 + speechActScore * 0.3);

  return {
    overallScore,
    registerScore,
    politenessScore,
    speechActScore,
    issues,
    recommendations,
  };
}

// =============================================================================
// Pragmatic Profile Generation
// =============================================================================

/**
 * Generate a pragmatic profile for a word or phrase.
 */
export function generatePragmaticProfile(
  expression: string,
  usageExamples?: string[]
): PragmaticProfile {
  // Analyze the expression itself
  const registerScores = analyzeRegister(expression);
  let dominantRegister: Register = 'consultative';
  let maxScore = 0;

  for (const [reg, score] of Object.entries(registerScores)) {
    if (score > maxScore) {
      maxScore = score;
      dominantRegister = reg as Register;
    }
  }

  // Calculate register flexibility
  const scores = Object.values(registerScores);
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - maxScore, 2), 0) / scores.length;
  const registerFlexibility = 1 - Math.sqrt(variance);

  // Detect speech act if applicable
  const speechActResult = detectSpeechAct(expression);

  // Analyze politeness
  const politenessResult = analyzePoliteness(expression);

  // Estimate cultural sensitivity based on politeness complexity
  const culturalSensitivity = politenessResult.strategy === 'bald_on_record' ? 0.2 :
    politenessResult.strategy === 'off_record' ? 0.9 :
      politenessResult.strategy === 'negative_politeness' ? 0.7 : 0.5;

  // Domain appropriateness (default estimates)
  const domainAppropriateness: Record<string, number> = {
    general: 0.8,
    medical: dominantRegister === 'formal' || dominantRegister === 'consultative' ? 0.7 : 0.3,
    legal: dominantRegister === 'frozen' || dominantRegister === 'formal' ? 0.8 : 0.2,
    business: dominantRegister !== 'intimate' && dominantRegister !== 'casual' ? 0.7 : 0.3,
    academic: dominantRegister === 'formal' || dominantRegister === 'consultative' ? 0.8 : 0.3,
  };

  return {
    register: dominantRegister,
    registerFlexibility,
    speechActCategory: speechActResult.category ?? undefined,
    speechActType: speechActResult.type ?? undefined,
    politenessStrategy: politenessResult.strategy,
    culturalSensitivity,
    domainAppropriateness,
  };
}

/**
 * Calculate a pragmatic difficulty score for learning.
 * Higher = more difficult to use appropriately.
 */
export function calculatePragmaticDifficulty(profile: PragmaticProfile): number {
  let difficulty = 0.5; // Base difficulty

  // Low register flexibility = harder (context-dependent)
  difficulty += (1 - profile.registerFlexibility) * 0.2;

  // High cultural sensitivity = harder
  difficulty += profile.culturalSensitivity * 0.2;

  // Certain speech acts are harder
  if (profile.speechActType === 'refusal' || profile.speechActType === 'complaint') {
    difficulty += 0.15; // Face-threatening acts are tricky
  }

  // Indirect strategies are harder
  if (profile.politenessStrategy === 'off_record') {
    difficulty += 0.15;
  } else if (profile.politenessStrategy === 'negative_politeness') {
    difficulty += 0.1;
  }

  return Math.min(1, Math.max(0, difficulty));
}

// =============================================================================
// Exports
// =============================================================================

// =============================================================================
// Domain-Based Pragmatic Text Type Model
// =============================================================================

/**
 * Text Type Classification based on Biber (1988) Multi-Dimensional Analysis
 *
 * Academic References:
 * - Biber, D. (1988). Variation across speech and writing. Cambridge University Press.
 * - Biber, D. & Conrad, S. (2009). Register, Genre, and Style. Cambridge University Press.
 * - Swales, J. M. (1990). Genre Analysis. Cambridge University Press.
 * - Hyland, K. (2005). Metadiscourse. Continuum.
 *
 * Text types are linguistically-defined categories, unlike registers which are
 * situationally-defined. Texts within a text type share similar linguistic features.
 */

/**
 * Biber's (1988) Multi-Dimensional Text Types
 * Based on co-occurring linguistic features across dimensions
 */
export type TextType =
  | 'involved_persuasion'       // High involvement, interactive, persuasive
  | 'informational_exposition'  // Informational, elaborated, explicit
  | 'scientific_discourse'      // Technical, specialized, abstract
  | 'narrative'                 // Temporal sequencing, past tense, events
  | 'situated_reportage'        // Real-time, situated, descriptive
  | 'argumentative'             // Claims, evidence, counterarguments
  | 'instructional'             // Directives, procedures, imperatives
  | 'interactional';            // Conversational, turn-taking, informal

/**
 * Genre categories within ESP domains
 * Based on Swales (1990) and Bhatia (2004)
 */
export type Genre =
  // Academic genres
  | 'research_article'
  | 'literature_review'
  | 'case_study'
  | 'thesis'
  | 'abstract'
  | 'grant_proposal'
  // Medical genres
  | 'medical_history'
  | 'clinical_notes'
  | 'patient_education'
  | 'medical_research'
  | 'discharge_summary'
  | 'consultation_letter'
  // Legal genres
  | 'contract'
  | 'brief'
  | 'opinion'
  | 'statute'
  | 'memorandum'
  | 'pleading'
  // Business genres
  | 'business_report'
  | 'proposal'
  | 'memo'
  | 'email_business'
  | 'presentation'
  | 'meeting_minutes'
  // General genres
  | 'conversation'
  | 'news_report'
  | 'editorial'
  | 'blog_post'
  | 'tutorial';

/**
 * Move structure for genre analysis (Swales, 1990)
 * Rhetorical moves are functional units within a genre
 */
export interface RhetoricalMove {
  /** Move name */
  name: string;

  /** Move function */
  function: string;

  /** Typical linguistic features */
  linguisticFeatures: string[];

  /** Whether this move is obligatory */
  obligatory: boolean;

  /** Typical position (0-1, where 0 is start) */
  typicalPosition: number;

  /** Steps within this move */
  steps?: {
    name: string;
    optional: boolean;
  }[];
}

/**
 * Biber's Dimensions of Linguistic Variation
 * Each dimension represents a continuum of co-occurring features
 */
export interface DimensionalScores {
  /** Dimension 1: Involved vs. Informational Production */
  involvedVsInformational: number;

  /** Dimension 2: Narrative vs. Non-Narrative Concerns */
  narrativeVsNonNarrative: number;

  /** Dimension 3: Explicit vs. Situation-Dependent Reference */
  explicitVsSituationDependent: number;

  /** Dimension 4: Overt Expression of Persuasion */
  overtPersuasion: number;

  /** Dimension 5: Abstract vs. Non-Abstract Information */
  abstractVsNonAbstract: number;

  /** Dimension 6: On-line Informational Elaboration */
  onlineElaboration: number;
}

/**
 * Metadiscourse markers (Hyland, 2005)
 * Interactive and interactional resources in text
 */
export interface MetadiscourseProfile {
  /** Interactive resources - help guide the reader through text */
  interactive: {
    /** Transition markers: express semantic relations (also, but, however) */
    transitions: number;
    /** Frame markers: signal text stages (first, finally, to conclude) */
    frameMarkers: number;
    /** Endophoric markers: refer to other parts of text (see Figure 2) */
    endophoricMarkers: number;
    /** Evidentials: refer to source of information (according to X) */
    evidentials: number;
    /** Code glosses: elaborate meanings (namely, e.g., in other words) */
    codeGlosses: number;
  };

  /** Interactional resources - involve the reader in the text */
  interactional: {
    /** Hedges: withhold commitment (might, perhaps, possible) */
    hedges: number;
    /** Boosters: emphasize certainty (in fact, definitely, certainly) */
    boosters: number;
    /** Attitude markers: express attitude (unfortunately, I agree) */
    attitudeMarkers: number;
    /** Self mentions: explicit reference to author(s) (I, we, the author) */
    selfMentions: number;
    /** Engagement markers: address readers (consider, note that, you) */
    engagementMarkers: number;
  };
}

/**
 * Domain-specific text type statistics
 * Corpus-derived statistical patterns for each domain
 */
export interface DomainTextTypeStatistics {
  /** Domain identifier */
  domain: string;

  /** Primary text types used in this domain (with frequency) */
  textTypeDistribution: Record<TextType, number>;

  /** Primary genres used in this domain (with frequency) */
  genreDistribution: Record<Genre, number>;

  /** Typical dimensional scores for this domain */
  typicalDimensionalScores: DimensionalScores;

  /** Typical metadiscourse profile for this domain */
  typicalMetadiscourse: MetadiscourseProfile;

  /** Vocabulary selection patterns by text position */
  vocabularyPatterns: {
    /** Opening lexical bundles */
    openingBundles: string[];
    /** Transition lexical bundles */
    transitionBundles: string[];
    /** Closing lexical bundles */
    closingBundles: string[];
    /** Domain-specific collocations */
    domainCollocations: string[];
  };

  /** Co-occurrence statistics across learning components */
  componentCooccurrence: {
    /** Syntactic patterns commonly co-occurring */
    syntacticPatterns: string[];
    /** Lexical fields commonly used together */
    lexicalFields: string[];
    /** Pragmatic conventions required */
    pragmaticConventions: string[];
  };
}

/**
 * Corpus-derived statistics for domain text types
 * Based on Biber (1988), Hyland (2005), and specialized corpus studies
 */
export const DOMAIN_TEXT_TYPE_STATISTICS: Record<string, DomainTextTypeStatistics> = {
  medical: {
    domain: 'medical',
    textTypeDistribution: {
      involved_persuasion: 0.05,
      informational_exposition: 0.35,
      scientific_discourse: 0.25,
      narrative: 0.15,
      situated_reportage: 0.10,
      argumentative: 0.05,
      instructional: 0.03,
      interactional: 0.02,
    },
    genreDistribution: {
      research_article: 0.15,
      literature_review: 0.05,
      case_study: 0.12,
      thesis: 0.02,
      abstract: 0.08,
      grant_proposal: 0.02,
      medical_history: 0.18,
      clinical_notes: 0.15,
      patient_education: 0.08,
      medical_research: 0.05,
      discharge_summary: 0.05,
      consultation_letter: 0.05,
      contract: 0,
      brief: 0,
      opinion: 0,
      statute: 0,
      memorandum: 0,
      pleading: 0,
      business_report: 0,
      proposal: 0,
      memo: 0,
      email_business: 0,
      presentation: 0,
      meeting_minutes: 0,
      conversation: 0,
      news_report: 0,
      editorial: 0,
      blog_post: 0,
      tutorial: 0,
    },
    typicalDimensionalScores: {
      involvedVsInformational: -0.6,  // Informational
      narrativeVsNonNarrative: 0.3,   // Some narrative (case histories)
      explicitVsSituationDependent: 0.7,  // Explicit reference required
      overtPersuasion: -0.2,          // Low persuasion
      abstractVsNonAbstract: 0.5,     // Moderately abstract
      onlineElaboration: 0.4,         // Elaborated
    },
    typicalMetadiscourse: {
      interactive: {
        transitions: 0.7,
        frameMarkers: 0.6,
        endophoricMarkers: 0.5,
        evidentials: 0.8,
        codeGlosses: 0.6,
      },
      interactional: {
        hedges: 0.7,
        boosters: 0.4,
        attitudeMarkers: 0.3,
        selfMentions: 0.4,
        engagementMarkers: 0.3,
      },
    },
    vocabularyPatterns: {
      openingBundles: [
        'the patient presented with',
        'history of present illness',
        'chief complaint',
        'on examination',
        'the purpose of this study',
      ],
      transitionBundles: [
        'in addition to',
        'consistent with',
        'in the context of',
        'as a result of',
        'with respect to',
      ],
      closingBundles: [
        'in conclusion',
        'further studies are needed',
        'the patient was discharged',
        'follow-up is recommended',
        'these findings suggest',
      ],
      domainCollocations: [
        'vital signs',
        'differential diagnosis',
        'adverse effects',
        'clinical presentation',
        'treatment plan',
        'informed consent',
        'medical history',
        'physical examination',
      ],
    },
    componentCooccurrence: {
      syntacticPatterns: [
        'passive voice for procedures',
        'nominalization for conditions',
        'conditional for prognosis',
        'hedged assertions',
      ],
      lexicalFields: [
        'anatomy',
        'pathology',
        'pharmacology',
        'diagnostics',
        'treatment',
      ],
      pragmaticConventions: [
        'formal register',
        'hedged language',
        'evidence-based assertions',
        'patient-centered communication',
      ],
    },
  },

  legal: {
    domain: 'legal',
    textTypeDistribution: {
      involved_persuasion: 0.15,
      informational_exposition: 0.25,
      scientific_discourse: 0.05,
      narrative: 0.10,
      situated_reportage: 0.05,
      argumentative: 0.35,
      instructional: 0.03,
      interactional: 0.02,
    },
    genreDistribution: {
      research_article: 0.05,
      literature_review: 0.02,
      case_study: 0.05,
      thesis: 0.01,
      abstract: 0.02,
      grant_proposal: 0,
      medical_history: 0,
      clinical_notes: 0,
      patient_education: 0,
      medical_research: 0,
      discharge_summary: 0,
      consultation_letter: 0,
      contract: 0.25,
      brief: 0.15,
      opinion: 0.12,
      statute: 0.10,
      memorandum: 0.15,
      pleading: 0.08,
      business_report: 0,
      proposal: 0,
      memo: 0,
      email_business: 0,
      presentation: 0,
      meeting_minutes: 0,
      conversation: 0,
      news_report: 0,
      editorial: 0,
      blog_post: 0,
      tutorial: 0,
    },
    typicalDimensionalScores: {
      involvedVsInformational: -0.8,  // Highly informational
      narrativeVsNonNarrative: 0.2,   // Some narrative (case facts)
      explicitVsSituationDependent: 0.9,  // Very explicit reference
      overtPersuasion: 0.6,           // Persuasive in briefs
      abstractVsNonAbstract: 0.6,     // Abstract principles
      onlineElaboration: 0.5,         // Elaborated
    },
    typicalMetadiscourse: {
      interactive: {
        transitions: 0.8,
        frameMarkers: 0.7,
        endophoricMarkers: 0.6,
        evidentials: 0.9,
        codeGlosses: 0.7,
      },
      interactional: {
        hedges: 0.5,
        boosters: 0.6,
        attitudeMarkers: 0.4,
        selfMentions: 0.3,
        engagementMarkers: 0.5,
      },
    },
    vocabularyPatterns: {
      openingBundles: [
        'in the matter of',
        'pursuant to',
        'the plaintiff alleges',
        'this court finds',
        'for the reasons set forth',
      ],
      transitionBundles: [
        'notwithstanding',
        'in accordance with',
        'subject to',
        'without prejudice to',
        'provided that',
      ],
      closingBundles: [
        'wherefore',
        'it is so ordered',
        'judgment is entered',
        'the court concludes',
        'for the foregoing reasons',
      ],
      domainCollocations: [
        'burden of proof',
        'due process',
        'reasonable doubt',
        'good faith',
        'breach of contract',
        'tortious interference',
        'fiduciary duty',
        'prima facie',
      ],
    },
    componentCooccurrence: {
      syntacticPatterns: [
        'complex noun phrases',
        'multiple embeddings',
        'conditional clauses',
        'nominalization heavy',
        'passive for authority',
      ],
      lexicalFields: [
        'procedural terms',
        'rights and duties',
        'parties and courts',
        'remedies',
        'evidence',
      ],
      pragmaticConventions: [
        'frozen/formal register',
        'precise terminology',
        'authoritative tone',
        'logical argumentation',
      ],
    },
  },

  business: {
    domain: 'business',
    textTypeDistribution: {
      involved_persuasion: 0.25,
      informational_exposition: 0.30,
      scientific_discourse: 0.05,
      narrative: 0.05,
      situated_reportage: 0.10,
      argumentative: 0.10,
      instructional: 0.05,
      interactional: 0.10,
    },
    genreDistribution: {
      research_article: 0.02,
      literature_review: 0.01,
      case_study: 0.05,
      thesis: 0,
      abstract: 0.02,
      grant_proposal: 0,
      medical_history: 0,
      clinical_notes: 0,
      patient_education: 0,
      medical_research: 0,
      discharge_summary: 0,
      consultation_letter: 0,
      contract: 0.08,
      brief: 0,
      opinion: 0,
      statute: 0,
      memorandum: 0.10,
      pleading: 0,
      business_report: 0.20,
      proposal: 0.15,
      memo: 0.12,
      email_business: 0.15,
      presentation: 0.08,
      meeting_minutes: 0.02,
      conversation: 0,
      news_report: 0,
      editorial: 0,
      blog_post: 0,
      tutorial: 0,
    },
    typicalDimensionalScores: {
      involvedVsInformational: -0.2,  // Balanced
      narrativeVsNonNarrative: -0.1,  // Non-narrative
      explicitVsSituationDependent: 0.5,  // Moderately explicit
      overtPersuasion: 0.5,           // Often persuasive
      abstractVsNonAbstract: 0.2,     // Concrete focus
      onlineElaboration: 0.3,         // Moderately elaborated
    },
    typicalMetadiscourse: {
      interactive: {
        transitions: 0.7,
        frameMarkers: 0.6,
        endophoricMarkers: 0.4,
        evidentials: 0.5,
        codeGlosses: 0.5,
      },
      interactional: {
        hedges: 0.5,
        boosters: 0.6,
        attitudeMarkers: 0.5,
        selfMentions: 0.6,
        engagementMarkers: 0.7,
      },
    },
    vocabularyPatterns: {
      openingBundles: [
        'I am writing to',
        'thank you for your',
        'with reference to',
        'as per our discussion',
        'please find attached',
      ],
      transitionBundles: [
        'in addition',
        'furthermore',
        'on the other hand',
        'as a result',
        'moving forward',
      ],
      closingBundles: [
        'please let me know',
        'I look forward to',
        'do not hesitate to',
        'thank you for your consideration',
        'best regards',
      ],
      domainCollocations: [
        'bottom line',
        'key stakeholders',
        'value proposition',
        'competitive advantage',
        'market share',
        'return on investment',
        'quarterly report',
        'action items',
      ],
    },
    componentCooccurrence: {
      syntacticPatterns: [
        'imperative for action',
        'modals for suggestions',
        'conditional for proposals',
        'questions for engagement',
      ],
      lexicalFields: [
        'finance',
        'marketing',
        'management',
        'operations',
        'strategy',
      ],
      pragmaticConventions: [
        'consultative/formal register',
        'positive politeness',
        'action-oriented',
        'reader-focused',
      ],
    },
  },

  academic: {
    domain: 'academic',
    textTypeDistribution: {
      involved_persuasion: 0.05,
      informational_exposition: 0.40,
      scientific_discourse: 0.30,
      narrative: 0.05,
      situated_reportage: 0.02,
      argumentative: 0.15,
      instructional: 0.02,
      interactional: 0.01,
    },
    genreDistribution: {
      research_article: 0.35,
      literature_review: 0.15,
      case_study: 0.08,
      thesis: 0.12,
      abstract: 0.10,
      grant_proposal: 0.08,
      medical_history: 0,
      clinical_notes: 0,
      patient_education: 0,
      medical_research: 0,
      discharge_summary: 0,
      consultation_letter: 0,
      contract: 0,
      brief: 0,
      opinion: 0,
      statute: 0,
      memorandum: 0,
      pleading: 0,
      business_report: 0,
      proposal: 0.05,
      memo: 0,
      email_business: 0.02,
      presentation: 0.03,
      meeting_minutes: 0,
      conversation: 0,
      news_report: 0,
      editorial: 0,
      blog_post: 0,
      tutorial: 0.02,
    },
    typicalDimensionalScores: {
      involvedVsInformational: -0.7,  // Highly informational
      narrativeVsNonNarrative: -0.3,  // Non-narrative
      explicitVsSituationDependent: 0.8,  // Very explicit
      overtPersuasion: 0.3,           // Some argumentation
      abstractVsNonAbstract: 0.7,     // Abstract
      onlineElaboration: 0.6,         // Elaborated
    },
    typicalMetadiscourse: {
      interactive: {
        transitions: 0.8,
        frameMarkers: 0.7,
        endophoricMarkers: 0.7,
        evidentials: 0.9,
        codeGlosses: 0.7,
      },
      interactional: {
        hedges: 0.8,
        boosters: 0.5,
        attitudeMarkers: 0.4,
        selfMentions: 0.5,
        engagementMarkers: 0.4,
      },
    },
    vocabularyPatterns: {
      openingBundles: [
        'this study aims to',
        'the purpose of this paper',
        'in recent years',
        'it has been argued that',
        'the present study',
      ],
      transitionBundles: [
        'on the other hand',
        'in contrast',
        'as a result',
        'in addition to',
        'with respect to',
      ],
      closingBundles: [
        'in conclusion',
        'the findings suggest',
        'future research should',
        'limitations of this study',
        'implications for',
      ],
      domainCollocations: [
        'significant difference',
        'research question',
        'theoretical framework',
        'data analysis',
        'literature review',
        'methodology',
        'empirical evidence',
        'hypothesis testing',
      ],
    },
    componentCooccurrence: {
      syntacticPatterns: [
        'passive for objectivity',
        'nominalization',
        'complex noun phrases',
        'hedged claims',
        'citation integration',
      ],
      lexicalFields: [
        'methodology',
        'analysis',
        'theory',
        'evidence',
        'argumentation',
      ],
      pragmaticConventions: [
        'formal register',
        'hedged assertions',
        'evidence-based claims',
        'objective stance',
      ],
    },
  },

  general: {
    domain: 'general',
    textTypeDistribution: {
      involved_persuasion: 0.15,
      informational_exposition: 0.20,
      scientific_discourse: 0.05,
      narrative: 0.20,
      situated_reportage: 0.15,
      argumentative: 0.10,
      instructional: 0.05,
      interactional: 0.10,
    },
    genreDistribution: {
      research_article: 0.02,
      literature_review: 0.01,
      case_study: 0.02,
      thesis: 0,
      abstract: 0.01,
      grant_proposal: 0,
      medical_history: 0,
      clinical_notes: 0,
      patient_education: 0,
      medical_research: 0,
      discharge_summary: 0,
      consultation_letter: 0,
      contract: 0.02,
      brief: 0,
      opinion: 0,
      statute: 0,
      memorandum: 0,
      pleading: 0,
      business_report: 0.02,
      proposal: 0.02,
      memo: 0.02,
      email_business: 0.05,
      presentation: 0.03,
      meeting_minutes: 0,
      conversation: 0.25,
      news_report: 0.15,
      editorial: 0.10,
      blog_post: 0.15,
      tutorial: 0.13,
    },
    typicalDimensionalScores: {
      involvedVsInformational: 0.0,   // Balanced
      narrativeVsNonNarrative: 0.2,   // Some narrative
      explicitVsSituationDependent: 0.3,  // Variable
      overtPersuasion: 0.2,           // Some persuasion
      abstractVsNonAbstract: 0.0,     // Concrete
      onlineElaboration: 0.2,         // Variable
    },
    typicalMetadiscourse: {
      interactive: {
        transitions: 0.5,
        frameMarkers: 0.4,
        endophoricMarkers: 0.3,
        evidentials: 0.3,
        codeGlosses: 0.4,
      },
      interactional: {
        hedges: 0.4,
        boosters: 0.5,
        attitudeMarkers: 0.6,
        selfMentions: 0.7,
        engagementMarkers: 0.7,
      },
    },
    vocabularyPatterns: {
      openingBundles: [
        'I think that',
        'in my opinion',
        'have you ever',
        'did you know',
        'let me tell you',
      ],
      transitionBundles: [
        'but',
        'and then',
        'so',
        'anyway',
        'by the way',
      ],
      closingBundles: [
        'that\'s all',
        'thanks for',
        'let me know',
        'see you',
        'take care',
      ],
      domainCollocations: [
        'pretty much',
        'kind of',
        'a lot of',
        'you know',
        'I mean',
        'sort of',
        'at least',
        'right now',
      ],
    },
    componentCooccurrence: {
      syntacticPatterns: [
        'simple sentences',
        'coordinated clauses',
        'questions',
        'contractions',
        'ellipsis',
      ],
      lexicalFields: [
        'everyday vocabulary',
        'common verbs',
        'basic adjectives',
        'time expressions',
        'spatial expressions',
      ],
      pragmaticConventions: [
        'casual register',
        'positive politeness',
        'personal involvement',
        'reader engagement',
      ],
    },
  },
};

/**
 * Genre move structures (Swales, 1990)
 * CARS (Create a Research Space) model and extensions
 */
export const GENRE_MOVE_STRUCTURES: Partial<Record<Genre, RhetoricalMove[]>> = {
  research_article: [
    {
      name: 'Establishing a territory',
      function: 'Claiming importance of field/topic',
      linguisticFeatures: ['present tense', 'citations', 'general statements'],
      obligatory: true,
      typicalPosition: 0.0,
      steps: [
        { name: 'Claiming centrality', optional: false },
        { name: 'Making topic generalization', optional: true },
        { name: 'Reviewing previous research', optional: false },
      ],
    },
    {
      name: 'Establishing a niche',
      function: 'Indicating gap in research',
      linguisticFeatures: ['negatives', 'adversatives', 'hedges'],
      obligatory: true,
      typicalPosition: 0.15,
      steps: [
        { name: 'Counter-claiming', optional: true },
        { name: 'Indicating a gap', optional: false },
        { name: 'Question-raising', optional: true },
        { name: 'Continuing a tradition', optional: true },
      ],
    },
    {
      name: 'Occupying the niche',
      function: 'Presenting the current research',
      linguisticFeatures: ['purpose statements', 'future/present tense', 'first person'],
      obligatory: true,
      typicalPosition: 0.25,
      steps: [
        { name: 'Outlining purposes', optional: false },
        { name: 'Announcing present research', optional: false },
        { name: 'Announcing principal findings', optional: true },
        { name: 'Indicating structure', optional: true },
      ],
    },
    {
      name: 'Methods description',
      function: 'Describing research procedures',
      linguisticFeatures: ['passive voice', 'past tense', 'procedural vocabulary'],
      obligatory: true,
      typicalPosition: 0.40,
    },
    {
      name: 'Results presentation',
      function: 'Presenting findings',
      linguisticFeatures: ['past tense', 'hedges', 'quantifiers'],
      obligatory: true,
      typicalPosition: 0.60,
    },
    {
      name: 'Discussion',
      function: 'Interpreting and contextualizing results',
      linguisticFeatures: ['hedges', 'modals', 'comparatives', 'citations'],
      obligatory: true,
      typicalPosition: 0.80,
    },
  ],

  medical_history: [
    {
      name: 'Chief Complaint',
      function: 'Presenting main reason for visit',
      linguisticFeatures: ['chief complaint', 'cc:', 'presents with', 'complaining of'],
      obligatory: true,
      typicalPosition: 0.0,
    },
    {
      name: 'History of Present Illness',
      function: 'Chronological narrative of current condition',
      linguisticFeatures: ['history of present illness', 'hpi', 'patient reports', 'onset', 'duration'],
      obligatory: true,
      typicalPosition: 0.1,
    },
    {
      name: 'Past Medical History',
      function: 'Listing previous conditions',
      linguisticFeatures: ['past medical history', 'pmh', 'medical history', 'history of', 'diagnosed with'],
      obligatory: true,
      typicalPosition: 0.3,
    },
    {
      name: 'Medications',
      function: 'Current medication list',
      linguisticFeatures: ['medications', 'meds', 'current medications', 'mg', 'daily', 'twice daily'],
      obligatory: true,
      typicalPosition: 0.4,
    },
    {
      name: 'Social History',
      function: 'Lifestyle and social factors',
      linguisticFeatures: ['social history', 'smoking', 'alcohol', 'occupation', 'lives with'],
      obligatory: false,
      typicalPosition: 0.5,
    },
    {
      name: 'Physical Examination',
      function: 'Documenting examination findings',
      linguisticFeatures: ['physical examination', 'physical exam', 'on examination', 'vital signs', 'lungs clear'],
      obligatory: true,
      typicalPosition: 0.6,
    },
    {
      name: 'Assessment and Plan',
      function: 'Diagnosis and treatment decisions',
      linguisticFeatures: ['assessment and plan', 'assessment', 'plan', 'diagnosis', 'will order', 'recommend'],
      obligatory: true,
      typicalPosition: 0.8,
    },
  ],

  contract: [
    {
      name: 'Preamble',
      function: 'Identifying parties and date',
      linguisticFeatures: ['formal identification', 'hereinafter', 'whereas'],
      obligatory: true,
      typicalPosition: 0.0,
    },
    {
      name: 'Recitals',
      function: 'Background and purpose',
      linguisticFeatures: ['whereas clauses', 'nominalization'],
      obligatory: false,
      typicalPosition: 0.05,
    },
    {
      name: 'Definitions',
      function: 'Defining key terms',
      linguisticFeatures: ['shall mean', 'capitalized terms'],
      obligatory: true,
      typicalPosition: 0.1,
    },
    {
      name: 'Operative Provisions',
      function: 'Core obligations and rights',
      linguisticFeatures: ['shall', 'must', 'covenant', 'agree'],
      obligatory: true,
      typicalPosition: 0.2,
    },
    {
      name: 'Representations and Warranties',
      function: 'Statements of fact',
      linguisticFeatures: ['represents', 'warrants', 'as of the date'],
      obligatory: true,
      typicalPosition: 0.5,
    },
    {
      name: 'Boilerplate',
      function: 'Standard legal clauses',
      linguisticFeatures: ['notwithstanding', 'severability', 'governing law'],
      obligatory: true,
      typicalPosition: 0.8,
    },
    {
      name: 'Signature Block',
      function: 'Execution formalities',
      linguisticFeatures: ['in witness whereof', 'duly authorized'],
      obligatory: true,
      typicalPosition: 0.95,
    },
  ],
};

/**
 * Analyze text type based on linguistic features
 * Returns dimensional scores following Biber (1988)
 */
export function analyzeTextType(text: string): {
  textType: TextType;
  dimensionalScores: DimensionalScores;
  confidence: number;
} {
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const wordCount = words.length;

  // Calculate dimensional features
  const scores: DimensionalScores = {
    involvedVsInformational: 0,
    narrativeVsNonNarrative: 0,
    explicitVsSituationDependent: 0,
    overtPersuasion: 0,
    abstractVsNonAbstract: 0,
    onlineElaboration: 0,
  };

  // Dimension 1: Involved vs. Informational
  const contractions = (text.match(/\b(don't|can't|won't|isn't|aren't|I'm|you're|we're|they're|it's|that's)\b/gi) || []).length;
  const firstPerson = (text.match(/\b(I|me|my|we|us|our)\b/gi) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const passives = (text.match(/\b(is|are|was|were|been|being)\s+\w+ed\b/gi) || []).length;
  const nouns = (text.match(/\b(tion|ment|ness|ity|ism)\b/gi) || []).length;

  scores.involvedVsInformational = (
    (contractions / wordCount * 100) * 0.3 +
    (firstPerson / wordCount * 100) * 0.3 +
    (questions / sentences.length) * 0.2 -
    (passives / wordCount * 100) * 0.2 -
    (nouns / wordCount * 100) * 0.1
  );
  scores.involvedVsInformational = Math.max(-1, Math.min(1, scores.involvedVsInformational / 5));

  // Dimension 2: Narrative vs. Non-Narrative
  const pastTense = (text.match(/\b(was|were|had|did|\w+ed)\b/gi) || []).length;
  const thirdPerson = (text.match(/\b(he|she|they|him|her|them|his|her|their)\b/gi) || []).length;
  const present = (text.match(/\b(is|are|have|has|do|does)\b/gi) || []).length;

  scores.narrativeVsNonNarrative = (
    (pastTense / wordCount * 100) * 0.4 +
    (thirdPerson / wordCount * 100) * 0.3 -
    (present / wordCount * 100) * 0.3
  );
  scores.narrativeVsNonNarrative = Math.max(-1, Math.min(1, scores.narrativeVsNonNarrative / 5));

  // Dimension 3: Explicit vs. Situation-Dependent
  const whRelatives = (text.match(/\b(which|who|whom|whose|that)\b/gi) || []).length;
  const nominalizations = (text.match(/\b\w+(tion|ment|ness|ity)\b/gi) || []).length;
  const pronouns = (text.match(/\b(it|this|that|these|those)\b/gi) || []).length;

  scores.explicitVsSituationDependent = (
    (whRelatives / wordCount * 100) * 0.4 +
    (nominalizations / wordCount * 100) * 0.4 -
    (pronouns / wordCount * 100) * 0.2
  );
  scores.explicitVsSituationDependent = Math.max(-1, Math.min(1, scores.explicitVsSituationDependent / 3));

  // Dimension 4: Overt Persuasion
  const modals = (text.match(/\b(should|must|need|have to|ought)\b/gi) || []).length;
  const conditionals = (text.match(/\b(if|unless|provided|assuming)\b/gi) || []).length;
  const persuasiveAdj = (text.match(/\b(important|necessary|essential|crucial|vital)\b/gi) || []).length;

  scores.overtPersuasion = (
    (modals / wordCount * 100) * 0.4 +
    (conditionals / wordCount * 100) * 0.3 +
    (persuasiveAdj / wordCount * 100) * 0.3
  );
  scores.overtPersuasion = Math.max(-1, Math.min(1, scores.overtPersuasion / 2));

  // Dimension 5: Abstract vs. Non-Abstract
  const abstractNouns = (text.match(/\b(concept|theory|principle|analysis|approach|method)\b/gi) || []).length;
  const technicalTerms = (text.match(/\b(significant|correlation|variable|factor|parameter)\b/gi) || []).length;

  scores.abstractVsNonAbstract = (
    (abstractNouns / wordCount * 100) * 0.5 +
    (technicalTerms / wordCount * 100) * 0.5
  );
  scores.abstractVsNonAbstract = Math.max(-1, Math.min(1, scores.abstractVsNonAbstract / 2));

  // Dimension 6: On-line Elaboration
  const thatDeletion = sentences.filter(s => /\b(said|think|believe|know)\s+\w/i.test(s)).length;
  const avgSentenceLength = wordCount / Math.max(1, sentences.length);

  scores.onlineElaboration = (
    (avgSentenceLength / 20) * 0.5 -
    (thatDeletion / sentences.length) * 0.5
  );
  scores.onlineElaboration = Math.max(-1, Math.min(1, scores.onlineElaboration));

  // Determine text type based on dimensional profile
  let textType: TextType = 'informational_exposition';
  let maxMatch = -Infinity;

  const textTypeProfiles: Record<TextType, DimensionalScores> = {
    involved_persuasion: {
      involvedVsInformational: 0.6,
      narrativeVsNonNarrative: -0.2,
      explicitVsSituationDependent: 0.3,
      overtPersuasion: 0.8,
      abstractVsNonAbstract: 0.2,
      onlineElaboration: 0.3,
    },
    informational_exposition: {
      involvedVsInformational: -0.5,
      narrativeVsNonNarrative: -0.3,
      explicitVsSituationDependent: 0.6,
      overtPersuasion: 0.1,
      abstractVsNonAbstract: 0.4,
      onlineElaboration: 0.5,
    },
    scientific_discourse: {
      involvedVsInformational: -0.8,
      narrativeVsNonNarrative: -0.4,
      explicitVsSituationDependent: 0.8,
      overtPersuasion: 0.2,
      abstractVsNonAbstract: 0.8,
      onlineElaboration: 0.6,
    },
    narrative: {
      involvedVsInformational: 0.2,
      narrativeVsNonNarrative: 0.8,
      explicitVsSituationDependent: 0.3,
      overtPersuasion: -0.2,
      abstractVsNonAbstract: -0.3,
      onlineElaboration: 0.4,
    },
    situated_reportage: {
      involvedVsInformational: 0.3,
      narrativeVsNonNarrative: 0.5,
      explicitVsSituationDependent: -0.2,
      overtPersuasion: -0.1,
      abstractVsNonAbstract: -0.4,
      onlineElaboration: 0.2,
    },
    argumentative: {
      involvedVsInformational: -0.2,
      narrativeVsNonNarrative: -0.3,
      explicitVsSituationDependent: 0.5,
      overtPersuasion: 0.7,
      abstractVsNonAbstract: 0.5,
      onlineElaboration: 0.4,
    },
    instructional: {
      involvedVsInformational: 0.1,
      narrativeVsNonNarrative: -0.5,
      explicitVsSituationDependent: 0.4,
      overtPersuasion: 0.5,
      abstractVsNonAbstract: -0.2,
      onlineElaboration: 0.3,
    },
    interactional: {
      involvedVsInformational: 0.8,
      narrativeVsNonNarrative: 0.1,
      explicitVsSituationDependent: -0.4,
      overtPersuasion: 0.2,
      abstractVsNonAbstract: -0.5,
      onlineElaboration: -0.2,
    },
  };

  for (const [type, profile] of Object.entries(textTypeProfiles)) {
    let similarity = 0;
    for (const dim of Object.keys(scores) as (keyof DimensionalScores)[]) {
      similarity -= Math.pow(scores[dim] - profile[dim], 2);
    }
    if (similarity > maxMatch) {
      maxMatch = similarity;
      textType = type as TextType;
    }
  }

  // Calculate confidence based on match quality
  const confidence = Math.max(0, Math.min(1, 1 + maxMatch / 3));

  return { textType, dimensionalScores: scores, confidence };
}

/**
 * Analyze metadiscourse markers in text (Hyland, 2005)
 */
export function analyzeMetadiscourse(text: string): MetadiscourseProfile {
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Interactive markers
  const transitionPatterns = /\b(also|but|however|therefore|thus|moreover|furthermore|consequently|hence|nevertheless|nonetheless|although|though|whereas|while|in addition|as a result|on the contrary)\b/gi;
  const framePatterns = /\b(first|second|third|finally|to begin|to conclude|in summary|in conclusion|next|then|lastly|overall)\b/gi;
  const endophoricPatterns = /\b(see|noted|above|below|earlier|later|figure|table|section|chapter)\b/gi;
  const evidentialPatterns = /\b(according to|cited|quoted|\(.*\d{4}\)|et al\.|states that|argues that)\b/gi;
  const codeGlossPatterns = /\b(namely|e\.g\.|i\.e\.|for example|for instance|in other words|that is|such as|specifically|in particular)\b/gi;

  // Interactional markers
  const hedgePatterns = /\b(might|may|could|would|perhaps|possibly|probably|likely|seem|appear|suggest|indicate|tend|generally|usually|often|sometimes)\b/gi;
  const boosterPatterns = /\b(certainly|definitely|clearly|obviously|undoubtedly|indeed|in fact|actually|always|never|must|will|prove|demonstrate|show|find)\b/gi;
  const attitudePatterns = /\b(unfortunately|surprisingly|interestingly|importantly|significantly|remarkably|agree|disagree|prefer|hope|expect)\b/gi;
  const selfMentionPatterns = /\b(I|we|me|my|our|the author|the researcher)\b/gi;
  const engagementPatterns = /\b(you|your|consider|note|see|imagine|think about|let us|let's|one can|one might)\b/gi;

  // Count matches
  const transitions = (lowerText.match(transitionPatterns) || []).length;
  const frameMarkers = (lowerText.match(framePatterns) || []).length;
  const endophoricMarkers = (lowerText.match(endophoricPatterns) || []).length;
  const evidentials = (text.match(evidentialPatterns) || []).length;
  const codeGlosses = (lowerText.match(codeGlossPatterns) || []).length;
  const hedges = (lowerText.match(hedgePatterns) || []).length;
  const boosters = (lowerText.match(boosterPatterns) || []).length;
  const attitudeMarkers = (lowerText.match(attitudePatterns) || []).length;
  const selfMentions = (text.match(selfMentionPatterns) || []).length;
  const engagementMarkers = (lowerText.match(engagementPatterns) || []).length;

  // Normalize to 0-1 scale (per 1000 words, capped)
  const normalize = (count: number) => Math.min(1, (count / wordCount) * 100);

  return {
    interactive: {
      transitions: normalize(transitions),
      frameMarkers: normalize(frameMarkers),
      endophoricMarkers: normalize(endophoricMarkers),
      evidentials: normalize(evidentials),
      codeGlosses: normalize(codeGlosses),
    },
    interactional: {
      hedges: normalize(hedges),
      boosters: normalize(boosters),
      attitudeMarkers: normalize(attitudeMarkers),
      selfMentions: normalize(selfMentions),
      engagementMarkers: normalize(engagementMarkers),
    },
  };
}

/**
 * Get domain-appropriate text type statistics
 */
export function getDomainStatistics(domain: string): DomainTextTypeStatistics {
  return DOMAIN_TEXT_TYPE_STATISTICS[domain] || DOMAIN_TEXT_TYPE_STATISTICS.general;
}

/**
 * Analyze genre moves in a text
 */
export function analyzeGenreMoves(
  text: string,
  genre: Genre
): { moves: { name: string; present: boolean; position: number }[]; completeness: number } {
  const moveStructure = GENRE_MOVE_STRUCTURES[genre];
  if (!moveStructure) {
    return { moves: [], completeness: 0 };
  }

  const lowerText = text.toLowerCase();
  const textLength = text.length;
  const results: { name: string; present: boolean; position: number }[] = [];
  let foundCount = 0;
  let obligatoryCount = 0;
  let obligatoryFound = 0;

  for (const move of moveStructure) {
    if (move.obligatory) obligatoryCount++;

    // Check for move presence using linguistic features
    let found = false;
    let position = -1;

    for (const feature of move.linguisticFeatures) {
      const featureLower = feature.toLowerCase();
      const idx = lowerText.indexOf(featureLower);
      if (idx !== -1) {
        found = true;
        position = idx / textLength;
        break;
      }
    }

    if (found) {
      foundCount++;
      if (move.obligatory) obligatoryFound++;
    }

    results.push({
      name: move.name,
      present: found,
      position: found ? position : -1,
    });
  }

  const completeness = obligatoryCount > 0 ? obligatoryFound / obligatoryCount : foundCount / moveStructure.length;

  return { moves: results, completeness };
}

/**
 * Calculate text-type appropriateness for a domain
 */
export function calculateDomainAppropriateness(
  text: string,
  targetDomain: string
): {
  appropriatenessScore: number;
  textTypeMatch: number;
  metadiscourseMatch: number;
  recommendations: string[];
} {
  const domainStats = getDomainStatistics(targetDomain);
  const { textType, dimensionalScores } = analyzeTextType(text);
  const metadiscourse = analyzeMetadiscourse(text);

  // Calculate text type match
  const expectedTextType = Object.entries(domainStats.textTypeDistribution)
    .sort(([, a], [, b]) => b - a)[0][0] as TextType;
  const textTypeMatch = textType === expectedTextType ? 1 : domainStats.textTypeDistribution[textType] || 0.3;

  // Calculate dimensional similarity
  const typicalScores = domainStats.typicalDimensionalScores;
  let dimensionalSimilarity = 0;
  for (const dim of Object.keys(dimensionalScores) as (keyof DimensionalScores)[]) {
    dimensionalSimilarity += 1 - Math.abs(dimensionalScores[dim] - typicalScores[dim]) / 2;
  }
  dimensionalSimilarity /= 6;

  // Calculate metadiscourse match
  const typicalMeta = domainStats.typicalMetadiscourse;
  let metadiscourseMatch = 0;
  let metaCount = 0;

  for (const category of ['interactive', 'interactional'] as const) {
    for (const marker of Object.keys(metadiscourse[category]) as (keyof typeof metadiscourse[typeof category])[]) {
      const diff = Math.abs(metadiscourse[category][marker] - typicalMeta[category][marker]);
      metadiscourseMatch += 1 - diff;
      metaCount++;
    }
  }
  metadiscourseMatch /= metaCount;

  // Generate recommendations
  const recommendations: string[] = [];

  if (textTypeMatch < 0.5) {
    recommendations.push(`Consider using more ${expectedTextType.replace('_', ' ')} style features.`);
  }

  if (dimensionalScores.involvedVsInformational > typicalScores.involvedVsInformational + 0.3) {
    recommendations.push('Use more formal, impersonal language for this domain.');
  }

  if (metadiscourse.interactional.hedges < typicalMeta.interactional.hedges - 0.2) {
    recommendations.push('Consider adding more hedging expressions (may, might, suggest, appear).');
  }

  if (metadiscourse.interactive.evidentials < typicalMeta.interactive.evidentials - 0.2) {
    recommendations.push('Include more citations and evidence markers.');
  }

  // Calculate overall score
  const appropriatenessScore = (textTypeMatch * 0.3 + dimensionalSimilarity * 0.4 + metadiscourseMatch * 0.3);

  return {
    appropriatenessScore,
    textTypeMatch,
    metadiscourseMatch,
    recommendations,
  };
}

export default {
  analyzeRegister,
  detectRegister,
  isRegisterAppropriate,
  detectSpeechAct,
  analyzePoliteness,
  recommendPolitenessStrategy,
  assessPragmaticAppropriateness,
  generatePragmaticProfile,
  calculatePragmaticDifficulty,
  // Text type model exports
  analyzeTextType,
  analyzeMetadiscourse,
  getDomainStatistics,
  analyzeGenreMoves,
  calculateDomainAppropriateness,
  // Constants
  REGISTER_MARKERS,
  SPEECH_ACT_PATTERNS,
  POLITENESS_MARKERS,
  DOMAIN_TEXT_TYPE_STATISTICS,
  GENRE_MOVE_STRUCTURES,
};
