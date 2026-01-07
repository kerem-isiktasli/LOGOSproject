/**
 * LOGOS AI-Powered Onboarding Module
 *
 * Converts natural language goal descriptions to structured learning plans
 * with minimal cognitive load on the user.
 *
 * Academic Foundations:
 * - Cognitive Load Theory (Sweller, 1988): Minimize extraneous load
 * - Progressive Disclosure: Show only what's needed
 * - Hick's Law: Minimize choices to reduce decision time
 * - Nielsen Norman Group: UX patterns for reduced friction
 *
 * This module implements:
 * 1. Natural language goal parsing
 * 2. Structured goal extraction
 * 3. Clarifying question generation
 * 4. Cognitive load estimation
 * 5. Onboarding flow management
 *
 * @module core/onboarding-ai
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Raw natural language input from user.
 */
export interface NaturalLanguageGoal {
  /** The raw text input */
  rawText: string;

  /** User's UI language */
  userLanguage: string;

  /** Target learning language */
  targetLanguage: string;
}

/**
 * Structured goal extracted from natural language.
 */
export interface ParsedGoal {
  /** Primary domain (medical, legal, business, academic, general) */
  domain: string;

  /** Target modalities */
  modalities: GoalModality[];

  /** Genre within domain */
  genre: string;

  /** Learning purpose */
  purpose: string;

  /** Specific benchmark if mentioned */
  benchmark?: string;

  /** Target deadline if mentioned */
  deadline?: Date;

  /** Extraction confidence (0-1) */
  confidence: number;

  /** Entities extracted from text */
  extractedEntities: ExtractedEntity[];

  /** Original text for reference */
  originalText: string;
}

/**
 * Modality for language learning.
 */
export type GoalModality = 'reading' | 'listening' | 'speaking' | 'writing';

/**
 * An entity extracted from natural language.
 */
export interface ExtractedEntity {
  /** Entity type */
  type: 'domain' | 'benchmark' | 'deadline' | 'modality' | 'purpose' | 'profession';

  /** Extracted value */
  value: string;

  /** Confidence (0-1) */
  confidence: number;

  /** Character span in original text */
  span: [number, number];
}

/**
 * A step in the onboarding flow.
 */
export interface OnboardingStep {
  /** Step identifier */
  id: string;

  /** Step type */
  type: 'choice' | 'text' | 'confirmation' | 'assessment';

  /** Step content */
  content: StepContent;

  /** Estimated cognitive load */
  cognitiveLoad: CognitiveLoadLevel;

  /** Whether step is required */
  required: boolean;

  /** Dependencies on previous steps */
  dependsOn?: string[];
}

/**
 * Content for an onboarding step.
 */
export interface StepContent {
  /** Title/question */
  title: string;

  /** Detailed description */
  description?: string;

  /** Available options for choice type */
  options?: StepOption[];

  /** Placeholder for text type */
  placeholder?: string;

  /** Examples for text type */
  examples?: string[];

  /** Data to confirm for confirmation type */
  confirmationData?: ParsedGoal;
}

/**
 * An option in a choice step.
 */
export interface StepOption {
  /** Option value */
  value: string;

  /** Display label */
  label: string;

  /** Optional description */
  description?: string;

  /** Icon identifier */
  icon?: string;
}

/**
 * Cognitive load levels based on Sweller's CLT.
 */
export type CognitiveLoadLevel = 'low' | 'medium' | 'high';

/**
 * Complete onboarding flow.
 */
export interface OnboardingFlow {
  /** Flow identifier */
  id: string;

  /** All steps in order */
  steps: OnboardingStep[];

  /** Current step index */
  currentStep: number;

  /** Collected responses */
  responses: Record<string, string | string[]>;

  /** Estimated total time (seconds) */
  estimatedTime: number;

  /** Overall cognitive load */
  overallLoad: CognitiveLoadLevel;
}

/**
 * Corpus sourcing suggestion based on parsed goal.
 */
export interface CorpusSourcingPlan {
  /** Recommended corpus sources */
  recommendedSources: string[];

  /** Domain-specific vocabulary focus */
  vocabularyFocus: string[];

  /** Genre-specific content types */
  contentTypes: string[];

  /** Suggested initial vocabulary count */
  initialVocabularyCount: number;

  /** Priority topics */
  priorityTopics: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Domain keywords for extraction.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  medical: [
    'medical', 'medicine', 'doctor', 'nurse', 'nursing', 'healthcare', 'health care',
    'hospital', 'clinical', 'patient', 'diagnosis', 'treatment', 'pharmaceutical',
    'CELBAN', 'NCLEX', 'USMLE', 'anatomy', 'physiology', 'pathology',
  ],
  legal: [
    'legal', 'law', 'lawyer', 'attorney', 'court', 'litigation', 'contract',
    'corporate law', 'criminal', 'civil', 'paralegal', 'bar exam', 'legislation',
  ],
  business: [
    'business', 'corporate', 'finance', 'marketing', 'management', 'MBA',
    'entrepreneur', 'startup', 'investment', 'accounting', 'economics',
    'sales', 'negotiation', 'presentation', 'meeting',
  ],
  academic: [
    'academic', 'university', 'college', 'research', 'thesis', 'dissertation',
    'IELTS', 'TOEFL', 'GRE', 'graduate', 'undergraduate', 'professor',
    'lecture', 'seminar', 'publication', 'journal',
  ],
  general: [
    'daily', 'everyday', 'conversation', 'travel', 'social', 'casual',
    'communication', 'basic', 'beginner', 'intermediate', 'advanced',
  ],
};

/**
 * Benchmark keywords for extraction.
 */
const BENCHMARK_KEYWORDS: Record<string, { domain: string; name: string }> = {
  celban: { domain: 'medical', name: 'CELBAN' },
  nclex: { domain: 'medical', name: 'NCLEX' },
  usmle: { domain: 'medical', name: 'USMLE' },
  ielts: { domain: 'academic', name: 'IELTS' },
  toefl: { domain: 'academic', name: 'TOEFL' },
  toeic: { domain: 'business', name: 'TOEIC' },
  gre: { domain: 'academic', name: 'GRE' },
  gmat: { domain: 'business', name: 'GMAT' },
  celpip: { domain: 'general', name: 'CELPIP' },
  oet: { domain: 'medical', name: 'OET' },
};

/**
 * Modality keywords for extraction.
 */
const MODALITY_KEYWORDS: Record<GoalModality, string[]> = {
  reading: ['read', 'reading', 'comprehension', 'understand', 'article', 'book', 'text'],
  listening: ['listen', 'listening', 'audio', 'podcast', 'conversation', 'understand spoken'],
  speaking: ['speak', 'speaking', 'talk', 'pronunciation', 'conversation', 'oral', 'verbal'],
  writing: ['write', 'writing', 'essay', 'report', 'email', 'composition', 'document'],
};

/**
 * Deadline patterns for extraction.
 */
const DEADLINE_PATTERNS = [
  /in\s+(\d+)\s+(month|week|year)s?/i,
  /within\s+(\d+)\s+(month|week|year)s?/i,
  /by\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?/i,
  /(\d{1,2})\s+(month|week|year)s?\s+(from now|later)/i,
  /next\s+(month|year)/i,
];

/**
 * Maximum recommended choices per step (Hick's Law).
 */
const MAX_CHOICES_PER_STEP = 4;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Parses natural language goal description into structured format.
 *
 * Uses pattern matching and keyword extraction.
 * In production, this could be enhanced with LLM-based parsing.
 *
 * @param input - Natural language goal input
 * @returns Parsed goal with confidence scores
 */
export function parseNaturalLanguageGoal(input: NaturalLanguageGoal): ParsedGoal {
  const text = input.rawText.toLowerCase();
  const extractedEntities: ExtractedEntity[] = [];

  // Extract domain
  const domainResult = extractDomain(text);
  if (domainResult) {
    extractedEntities.push(domainResult.entity);
  }

  // Extract benchmark
  const benchmarkResult = extractBenchmark(text);
  if (benchmarkResult) {
    extractedEntities.push(benchmarkResult.entity);
  }

  // Extract modalities
  const modalityResults = extractModalities(text);
  extractedEntities.push(...modalityResults.map((r) => r.entity));

  // Extract deadline
  const deadlineResult = extractDeadline(text);
  if (deadlineResult) {
    extractedEntities.push(deadlineResult.entity);
  }

  // Determine domain (benchmark can inform domain)
  let domain = domainResult?.domain || 'general';
  if (benchmarkResult && !domainResult) {
    domain = benchmarkResult.domain;
  }

  // Determine modalities (default to all if none specified)
  const modalities: GoalModality[] =
    modalityResults.length > 0
      ? modalityResults.map((r) => r.modality)
      : ['reading', 'listening', 'speaking', 'writing'];

  // Infer genre based on domain
  const genre = inferGenre(domain, text);

  // Infer purpose
  const purpose = inferPurpose(text, domain, benchmarkResult?.benchmark);

  // Calculate overall confidence
  const confidence = calculateConfidence(extractedEntities);

  return {
    domain,
    modalities,
    genre,
    purpose,
    benchmark: benchmarkResult?.benchmark,
    deadline: deadlineResult?.deadline,
    confidence,
    extractedEntities,
    originalText: input.rawText,
  };
}

/**
 * Extracts domain from text.
 */
function extractDomain(
  text: string
): { domain: string; entity: ExtractedEntity } | null {
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      const index = text.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        return {
          domain,
          entity: {
            type: 'domain',
            value: domain,
            confidence: 0.8,
            span: [index, index + keyword.length],
          },
        };
      }
    }
  }
  return null;
}

/**
 * Extracts benchmark from text.
 */
function extractBenchmark(
  text: string
): { benchmark: string; domain: string; entity: ExtractedEntity } | null {
  for (const [keyword, info] of Object.entries(BENCHMARK_KEYWORDS)) {
    const index = text.indexOf(keyword.toLowerCase());
    if (index !== -1) {
      return {
        benchmark: info.name,
        domain: info.domain,
        entity: {
          type: 'benchmark',
          value: info.name,
          confidence: 0.95,
          span: [index, index + keyword.length],
        },
      };
    }
  }
  return null;
}

/**
 * Extracts modalities from text.
 */
function extractModalities(
  text: string
): Array<{ modality: GoalModality; entity: ExtractedEntity }> {
  const results: Array<{ modality: GoalModality; entity: ExtractedEntity }> = [];

  for (const [modality, keywords] of Object.entries(MODALITY_KEYWORDS)) {
    for (const keyword of keywords) {
      const index = text.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        // Avoid duplicates
        if (!results.some((r) => r.modality === modality)) {
          results.push({
            modality: modality as GoalModality,
            entity: {
              type: 'modality',
              value: modality,
              confidence: 0.85,
              span: [index, index + keyword.length],
            },
          });
        }
        break;
      }
    }
  }

  return results;
}

/**
 * Extracts deadline from text.
 */
function extractDeadline(
  text: string
): { deadline: Date; entity: ExtractedEntity } | null {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const deadline = parseDeadlineMatch(match);
      if (deadline) {
        return {
          deadline,
          entity: {
            type: 'deadline',
            value: match[0],
            confidence: 0.75,
            span: [match.index!, match.index! + match[0].length],
          },
        };
      }
    }
  }
  return null;
}

/**
 * Parses a deadline regex match into a Date.
 */
function parseDeadlineMatch(match: RegExpMatchArray): Date | null {
  const now = new Date();

  // "in X months/weeks/years"
  if (match[1] && match[2]) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const result = new Date(now);
    if (unit.startsWith('month')) {
      result.setMonth(result.getMonth() + amount);
    } else if (unit.startsWith('week')) {
      result.setDate(result.getDate() + amount * 7);
    } else if (unit.startsWith('year')) {
      result.setFullYear(result.getFullYear() + amount);
    }
    return result;
  }

  // "next month/year"
  if (match[0].includes('next month')) {
    const result = new Date(now);
    result.setMonth(result.getMonth() + 1);
    return result;
  }
  if (match[0].includes('next year')) {
    const result = new Date(now);
    result.setFullYear(result.getFullYear() + 1);
    return result;
  }

  return null;
}

/**
 * Infers genre based on domain and text.
 */
function inferGenre(domain: string, text: string): string {
  const genreMap: Record<string, Record<string, string[]>> = {
    medical: {
      clinical: ['clinical', 'patient', 'hospital', 'ward'],
      research: ['research', 'study', 'journal', 'publication'],
      nursing: ['nurse', 'nursing', 'care'],
    },
    business: {
      corporate: ['corporate', 'company', 'organization'],
      finance: ['finance', 'investment', 'banking'],
      marketing: ['marketing', 'sales', 'advertising'],
    },
    academic: {
      research: ['research', 'thesis', 'dissertation'],
      lecture: ['lecture', 'class', 'course'],
      publication: ['publish', 'journal', 'paper'],
    },
    legal: {
      litigation: ['court', 'trial', 'litigation'],
      corporate: ['corporate', 'contract', 'merger'],
      criminal: ['criminal', 'prosecution', 'defense'],
    },
  };

  const domainGenres = genreMap[domain];
  if (!domainGenres) return 'general';

  for (const [genre, keywords] of Object.entries(domainGenres)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return genre;
    }
  }

  return 'general';
}

/**
 * Infers purpose from text.
 */
function inferPurpose(text: string, domain: string, benchmark?: string): string {
  if (benchmark) {
    return `certification:${benchmark}`;
  }

  const purposePatterns: Record<string, string[]> = {
    certification: ['exam', 'test', 'certification', 'license', 'qualify'],
    professional: ['work', 'job', 'career', 'profession', 'workplace'],
    immigration: ['immigrate', 'immigration', 'visa', 'canada', 'australia', 'uk'],
    academic: ['study', 'university', 'college', 'degree', 'graduate'],
    personal: ['travel', 'hobby', 'interest', 'fun', 'personal'],
  };

  for (const [purpose, keywords] of Object.entries(purposePatterns)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return purpose;
    }
  }

  return 'general';
}

/**
 * Calculates overall confidence from extracted entities.
 */
function calculateConfidence(entities: ExtractedEntity[]): number {
  if (entities.length === 0) return 0.3;

  const avgConfidence =
    entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;

  // Boost confidence if we have multiple entities
  const coverageBonus = Math.min(0.2, entities.length * 0.05);

  return Math.min(1, avgConfidence + coverageBonus);
}

/**
 * Generates clarifying questions if parsed goal has low confidence.
 *
 * @param parsed - Parsed goal
 * @returns Array of clarifying steps
 */
export function generateClarifyingQuestions(parsed: ParsedGoal): OnboardingStep[] {
  const steps: OnboardingStep[] = [];

  // If domain confidence is low, ask about domain
  const domainEntity = parsed.extractedEntities.find((e) => e.type === 'domain');
  if (!domainEntity || domainEntity.confidence < 0.7) {
    steps.push({
      id: 'clarify_domain',
      type: 'choice',
      content: {
        title: 'What field is your English learning focused on?',
        options: [
          { value: 'medical', label: 'Medical/Healthcare', icon: '🏥' },
          { value: 'business', label: 'Business/Finance', icon: '💼' },
          { value: 'academic', label: 'Academic/Research', icon: '📚' },
          { value: 'general', label: 'General/Everyday', icon: '🌐' },
        ],
      },
      cognitiveLoad: 'low',
      required: true,
    });
  }

  // If no modalities specified, ask about focus
  if (parsed.modalities.length === 4) {
    // Default all = not specified
    steps.push({
      id: 'clarify_modality',
      type: 'choice',
      content: {
        title: 'Which skills do you want to focus on?',
        description: 'Select all that apply',
        options: [
          { value: 'reading', label: 'Reading', description: 'Understanding written text' },
          { value: 'listening', label: 'Listening', description: 'Understanding spoken English' },
          { value: 'speaking', label: 'Speaking', description: 'Verbal communication' },
          { value: 'writing', label: 'Writing', description: 'Written communication' },
        ],
      },
      cognitiveLoad: 'medium',
      required: false,
    });
  }

  // If no deadline, optionally ask
  if (!parsed.deadline) {
    steps.push({
      id: 'clarify_timeline',
      type: 'choice',
      content: {
        title: 'Do you have a target timeline?',
        options: [
          { value: '3months', label: '3 months' },
          { value: '6months', label: '6 months' },
          { value: '1year', label: '1 year' },
          { value: 'no_deadline', label: 'No specific deadline' },
        ],
      },
      cognitiveLoad: 'low',
      required: false,
    });
  }

  return steps;
}

/**
 * Creates a minimal onboarding flow.
 *
 * Follows Cognitive Load Theory principles:
 * - Minimize choices (Hick's Law)
 * - Progressive disclosure
 * - One decision per step
 *
 * @param userLanguage - User's interface language
 * @returns Complete onboarding flow
 */
export function createOnboardingFlow(userLanguage: string): OnboardingFlow {
  const steps: OnboardingStep[] = [
    // Step 1: Language selection (minimal)
    {
      id: 'target_language',
      type: 'choice',
      content: {
        title: 'What language do you want to learn?',
        options: [
          { value: 'en', label: 'English', icon: '🇺🇸' },
          { value: 'other', label: 'Other...', icon: '🌐' },
        ],
      },
      cognitiveLoad: 'low',
      required: true,
    },

    // Step 2: Free text goal (low friction)
    {
      id: 'goal_text',
      type: 'text',
      content: {
        title: 'Tell us about your learning goal',
        description: 'Describe what you want to achieve in your own words',
        placeholder: 'e.g., I want to pass IELTS for medical school in Canada',
        examples: [
          'I need to prepare for CELBAN nursing exam',
          'I want to improve my business English for meetings',
          'I\'m studying for TOEFL to apply to US universities',
        ],
      },
      cognitiveLoad: 'medium',
      required: true,
    },

    // Step 3: Confirmation (shows AI interpretation)
    {
      id: 'confirm_goal',
      type: 'confirmation',
      content: {
        title: 'Here\'s your personalized learning plan',
        description: 'Based on what you told us',
      },
      cognitiveLoad: 'low',
      required: true,
      dependsOn: ['goal_text'],
    },

    // Step 4: Optional quick assessment
    {
      id: 'initial_assessment',
      type: 'assessment',
      content: {
        title: 'Let\'s see where you\'re starting from',
        description: 'A quick 5-question assessment to personalize your experience',
      },
      cognitiveLoad: 'high',
      required: false,
      dependsOn: ['confirm_goal'],
    },
  ];

  return {
    id: generateFlowId(),
    steps,
    currentStep: 0,
    responses: {},
    estimatedTime: calculateEstimatedTime(steps),
    overallLoad: calculateOverallLoad(steps),
  };
}

/**
 * Suggests corpus sourcing based on parsed goal.
 *
 * @param goal - Parsed goal
 * @returns Corpus sourcing plan
 */
export function suggestCorpusSourcing(goal: ParsedGoal): CorpusSourcingPlan {
  const plan: CorpusSourcingPlan = {
    recommendedSources: [],
    vocabularyFocus: [],
    contentTypes: [],
    initialVocabularyCount: 500,
    priorityTopics: [],
  };

  // Domain-specific sources
  switch (goal.domain) {
    case 'medical':
      plan.recommendedSources = ['embedded_medical', 'opus'];
      plan.vocabularyFocus = ['medical terminology', 'patient communication', 'clinical procedures'];
      plan.contentTypes = ['case studies', 'clinical notes', 'patient dialogues'];
      plan.initialVocabularyCount = 800;
      plan.priorityTopics = ['anatomy', 'symptoms', 'medications', 'procedures'];
      break;

    case 'business':
      plan.recommendedSources = ['embedded_business', 'coca'];
      plan.vocabularyFocus = ['business terminology', 'professional communication', 'negotiations'];
      plan.contentTypes = ['emails', 'reports', 'presentations', 'meeting transcripts'];
      plan.initialVocabularyCount = 600;
      plan.priorityTopics = ['finance', 'marketing', 'management', 'negotiations'];
      break;

    case 'academic':
      plan.recommendedSources = ['embedded_academic', 'coca', 'bnc'];
      plan.vocabularyFocus = ['academic vocabulary', 'research writing', 'formal register'];
      plan.contentTypes = ['journal articles', 'lectures', 'academic essays'];
      plan.initialVocabularyCount = 700;
      plan.priorityTopics = ['research methods', 'academic writing', 'critical thinking'];
      break;

    case 'legal':
      plan.recommendedSources = ['embedded_legal', 'opus'];
      plan.vocabularyFocus = ['legal terminology', 'contract language', 'court procedures'];
      plan.contentTypes = ['contracts', 'legal briefs', 'court transcripts'];
      plan.initialVocabularyCount = 600;
      plan.priorityTopics = ['contracts', 'litigation', 'compliance'];
      break;

    default:
      plan.recommendedSources = ['coca', 'opus'];
      plan.vocabularyFocus = ['general vocabulary', 'everyday communication'];
      plan.contentTypes = ['news articles', 'conversations', 'stories'];
      plan.initialVocabularyCount = 500;
      plan.priorityTopics = ['daily life', 'travel', 'social situations'];
  }

  // Adjust for benchmark
  if (goal.benchmark) {
    plan.vocabularyFocus.push(`${goal.benchmark} specific vocabulary`);
    plan.priorityTopics.unshift(`${goal.benchmark} exam preparation`);
  }

  // Adjust for modalities
  if (goal.modalities.includes('speaking')) {
    plan.contentTypes.push('dialogues', 'pronunciation guides');
  }
  if (goal.modalities.includes('listening')) {
    plan.contentTypes.push('audio transcripts', 'podcasts');
  }

  return plan;
}

/**
 * Estimates cognitive load for a step.
 *
 * Based on:
 * - Number of choices (Hick's Law)
 * - Required attention
 * - Decision complexity
 *
 * @param step - Onboarding step
 * @returns Cognitive load score (0-1)
 */
export function estimateCognitiveLoad(step: OnboardingStep): number {
  let load = 0;

  switch (step.type) {
    case 'choice':
      // Hick's Law: decision time increases with number of choices
      const numChoices = step.content.options?.length || 0;
      load = Math.log2(1 + numChoices) / Math.log2(1 + MAX_CHOICES_PER_STEP);
      break;

    case 'text':
      // Free text requires more cognitive effort
      load = 0.6;
      break;

    case 'confirmation':
      // Just reviewing, low load
      load = 0.3;
      break;

    case 'assessment':
      // Active testing, high load
      load = 0.9;
      break;
  }

  // Required steps add pressure
  if (step.required) {
    load = Math.min(1, load + 0.1);
  }

  return load;
}

/**
 * Validates a parsed goal for completeness.
 *
 * @param goal - Parsed goal
 * @returns Validation result
 */
export function validateParsedGoal(goal: ParsedGoal): {
  isValid: boolean;
  missingFields: string[];
  suggestions: string[];
} {
  const missingFields: string[] = [];
  const suggestions: string[] = [];

  if (!goal.domain || goal.domain === 'general') {
    if (goal.confidence < 0.5) {
      missingFields.push('domain');
      suggestions.push('Please specify your field of study or work');
    }
  }

  if (goal.modalities.length === 0) {
    missingFields.push('modalities');
    suggestions.push('Please indicate which skills you want to focus on');
  }

  if (!goal.purpose || goal.purpose === 'general') {
    suggestions.push('Consider adding your specific goal (exam, job, travel, etc.)');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    suggestions,
  };
}

/**
 * Updates parsed goal with user clarifications.
 *
 * @param goal - Original parsed goal
 * @param clarifications - User's clarification responses
 * @returns Updated goal
 */
export function updateGoalWithClarifications(
  goal: ParsedGoal,
  clarifications: Record<string, string | string[]>
): ParsedGoal {
  const updated = { ...goal };

  if (clarifications.clarify_domain) {
    updated.domain = clarifications.clarify_domain as string;
    updated.confidence = Math.min(1, updated.confidence + 0.2);
  }

  if (clarifications.clarify_modality) {
    const modalities = Array.isArray(clarifications.clarify_modality)
      ? clarifications.clarify_modality
      : [clarifications.clarify_modality];
    updated.modalities = modalities as GoalModality[];
  }

  if (clarifications.clarify_timeline) {
    const timeline = clarifications.clarify_timeline as string;
    updated.deadline = parseTimelineChoice(timeline);
  }

  return updated;
}

/**
 * Parses a timeline choice into a Date.
 */
function parseTimelineChoice(choice: string): Date | undefined {
  const now = new Date();

  switch (choice) {
    case '3months':
      return new Date(now.setMonth(now.getMonth() + 3));
    case '6months':
      return new Date(now.setMonth(now.getMonth() + 6));
    case '1year':
      return new Date(now.setFullYear(now.getFullYear() + 1));
    default:
      return undefined;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a unique flow ID.
 */
function generateFlowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculates estimated time for a flow.
 */
function calculateEstimatedTime(steps: OnboardingStep[]): number {
  return steps.reduce((total, step) => {
    switch (step.type) {
      case 'choice':
        return total + 10;
      case 'text':
        return total + 30;
      case 'confirmation':
        return total + 15;
      case 'assessment':
        return total + 120;
      default:
        return total + 15;
    }
  }, 0);
}

/**
 * Calculates overall cognitive load for a flow.
 */
function calculateOverallLoad(steps: OnboardingStep[]): CognitiveLoadLevel {
  const avgLoad =
    steps.reduce((sum, step) => sum + estimateCognitiveLoad(step), 0) / steps.length;

  if (avgLoad < 0.4) return 'low';
  if (avgLoad < 0.7) return 'medium';
  return 'high';
}

/**
 * Creates a goal from onboarding responses.
 *
 * @param responses - Collected responses from onboarding
 * @returns Structured goal
 */
export function createGoalFromResponses(
  responses: Record<string, string | string[]>
): ParsedGoal {
  const goalText = responses.goal_text as string;

  if (goalText) {
    const parsed = parseNaturalLanguageGoal({
      rawText: goalText,
      userLanguage: 'en',
      targetLanguage: responses.target_language as string || 'en',
    });

    // Apply any clarifications
    return updateGoalWithClarifications(parsed, responses);
  }

  // Fallback for incomplete flows
  return {
    domain: (responses.clarify_domain as string) || 'general',
    modalities: (responses.clarify_modality as GoalModality[]) || ['reading', 'listening', 'speaking', 'writing'],
    genre: 'general',
    purpose: 'general',
    confidence: 0.5,
    extractedEntities: [],
    originalText: '',
  };
}
