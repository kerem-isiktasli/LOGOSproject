/**
 * Tests for AI-Powered Onboarding Module
 *
 * Covers:
 * - Natural language goal parsing
 * - Entity extraction (domain, benchmark, modalities, deadline)
 * - Clarifying question generation
 * - Onboarding flow creation
 * - Cognitive load estimation
 * - Corpus sourcing suggestions
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type NaturalLanguageGoal,
  type ParsedGoal,
  type OnboardingStep,
  type OnboardingFlow,
  type GoalModality,

  // Core functions
  parseNaturalLanguageGoal,
  generateClarifyingQuestions,
  createOnboardingFlow,
  suggestCorpusSourcing,
  estimateCognitiveLoad,
  validateParsedGoal,
  updateGoalWithClarifications,
  createGoalFromResponses,
} from '../onboarding-ai';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestInput(rawText: string): NaturalLanguageGoal {
  return {
    rawText,
    userLanguage: 'en',
    targetLanguage: 'en',
  };
}

// ============================================================================
// Natural Language Parsing Tests
// ============================================================================

describe('Natural Language Goal Parsing', () => {
  describe('parseNaturalLanguageGoal', () => {
    it('extracts medical domain from text', () => {
      const input = createTestInput('I want to study medical English for my nursing career');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.domain).toBe('medical');
    });

    it('extracts business domain from text', () => {
      const input = createTestInput('I need business English for corporate meetings');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.domain).toBe('business');
    });

    it('extracts academic domain from text', () => {
      const input = createTestInput('I want to improve my academic writing for university');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.domain).toBe('academic');
    });

    it('extracts legal domain from text', () => {
      const input = createTestInput('I need to understand legal contracts for my work as a lawyer');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.domain).toBe('legal');
    });

    it('defaults to general for unrecognized domains', () => {
      const input = createTestInput('I want to learn English');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.domain).toBe('general');
    });

    it('preserves original text', () => {
      const rawText = 'I want to pass CELBAN for nursing in Canada';
      const input = createTestInput(rawText);
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.originalText).toBe(rawText);
    });

    it('returns confidence score', () => {
      const input = createTestInput('I want to pass IELTS for medical school in Canada');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.confidence).toBeGreaterThan(0);
      expect(parsed.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('benchmark extraction', () => {
    it('extracts CELBAN benchmark', () => {
      const input = createTestInput('I need to prepare for the CELBAN exam');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.benchmark).toBe('CELBAN');
      expect(parsed.domain).toBe('medical'); // Inferred from benchmark
    });

    it('extracts IELTS benchmark', () => {
      const input = createTestInput('I want to get a high score on IELTS');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.benchmark).toBe('IELTS');
    });

    it('extracts TOEFL benchmark', () => {
      const input = createTestInput('Preparing for TOEFL to study in the US');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.benchmark).toBe('TOEFL');
    });

    it('extracts TOEIC benchmark', () => {
      const input = createTestInput('I need TOEIC score for my job application');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.benchmark).toBe('TOEIC');
    });

    it('extracts OET benchmark', () => {
      const input = createTestInput('Preparing for OET medical English exam');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.benchmark).toBe('OET');
    });

    it('benchmark informs domain when domain not explicit', () => {
      const input = createTestInput('I need to pass NCLEX');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.benchmark).toBe('NCLEX');
      expect(parsed.domain).toBe('medical');
    });
  });

  describe('modality extraction', () => {
    it('extracts reading modality', () => {
      const input = createTestInput('I want to improve my reading comprehension');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.modalities).toContain('reading');
    });

    it('extracts listening modality', () => {
      const input = createTestInput('I need to understand spoken English better');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.modalities).toContain('listening');
    });

    it('extracts speaking modality', () => {
      const input = createTestInput('I want to improve my speaking skills');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.modalities).toContain('speaking');
    });

    it('extracts writing modality', () => {
      const input = createTestInput('I need to write better essays');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.modalities).toContain('writing');
    });

    it('extracts multiple modalities', () => {
      const input = createTestInput('I want to improve my reading and writing');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.modalities).toContain('reading');
      expect(parsed.modalities).toContain('writing');
    });

    it('defaults to all modalities when none specified', () => {
      const input = createTestInput('I want to learn medical English');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.modalities).toContain('reading');
      expect(parsed.modalities).toContain('listening');
      expect(parsed.modalities).toContain('speaking');
      expect(parsed.modalities).toContain('writing');
    });
  });

  describe('deadline extraction', () => {
    it('extracts "in X months" deadline', () => {
      const input = createTestInput('I need to pass in 3 months');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.deadline).toBeDefined();
      const now = new Date();
      const expected = new Date(now.setMonth(now.getMonth() + 3));
      // Allow for small time difference in test execution
      expect(parsed.deadline!.getMonth()).toBe(expected.getMonth());
    });

    it('extracts "within X weeks" deadline', () => {
      const input = createTestInput('I need to be ready within 6 weeks');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.deadline).toBeDefined();
    });

    it('extracts "next month" deadline', () => {
      const input = createTestInput('I have an exam next month');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.deadline).toBeDefined();
    });

    it('extracts "next year" deadline', () => {
      const input = createTestInput('I plan to take the exam next year');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.deadline).toBeDefined();
    });

    it('returns undefined for no deadline', () => {
      const input = createTestInput('I want to improve my English');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.deadline).toBeUndefined();
    });
  });

  describe('entity extraction', () => {
    it('tracks extracted entities', () => {
      const input = createTestInput('I need CELBAN for nursing in 6 months');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.extractedEntities.length).toBeGreaterThan(0);
    });

    it('entities have type and confidence', () => {
      const input = createTestInput('Medical English for CELBAN');
      const parsed = parseNaturalLanguageGoal(input);

      parsed.extractedEntities.forEach((entity) => {
        expect(entity.type).toBeDefined();
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('entities have character spans', () => {
      const input = createTestInput('I need CELBAN preparation');
      const parsed = parseNaturalLanguageGoal(input);

      const benchmarkEntity = parsed.extractedEntities.find(
        (e) => e.type === 'benchmark'
      );
      expect(benchmarkEntity).toBeDefined();
      expect(benchmarkEntity!.span).toBeDefined();
      expect(benchmarkEntity!.span[0]).toBeGreaterThanOrEqual(0);
      expect(benchmarkEntity!.span[1]).toBeGreaterThan(benchmarkEntity!.span[0]);
    });
  });

  describe('purpose inference', () => {
    it('infers certification purpose from exam keywords', () => {
      const input = createTestInput('I need to pass the nursing exam');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.purpose).toContain('certification');
    });

    it('infers professional purpose from work keywords', () => {
      const input = createTestInput('I need English for my job');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.purpose).toBe('professional');
    });

    it('infers academic purpose from study keywords', () => {
      const input = createTestInput('I want to study at university');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.purpose).toBe('academic');
    });

    it('infers immigration purpose from immigration keywords', () => {
      const input = createTestInput('I need English to immigrate to Canada');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.purpose).toBe('immigration');
    });
  });

  describe('genre inference', () => {
    it('infers clinical genre for medical domain', () => {
      const input = createTestInput('I work with patients in a hospital');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.genre).toBe('clinical');
    });

    it('infers research genre for academic research', () => {
      const input = createTestInput('I need to write my thesis');
      const parsed = parseNaturalLanguageGoal(input);

      expect(parsed.genre).toBe('research');
    });
  });
});

// ============================================================================
// Clarifying Questions Tests
// ============================================================================

describe('Clarifying Questions', () => {
  describe('generateClarifyingQuestions', () => {
    it('generates domain question when domain is uncertain', () => {
      const parsed: ParsedGoal = {
        domain: 'general',
        modalities: ['reading', 'listening', 'speaking', 'writing'],
        genre: 'general',
        purpose: 'general',
        confidence: 0.3,
        extractedEntities: [],
        originalText: 'I want to learn English',
      };

      const questions = generateClarifyingQuestions(parsed);

      const domainQuestion = questions.find((q) => q.id === 'clarify_domain');
      expect(domainQuestion).toBeDefined();
    });

    it('generates modality question when not specified', () => {
      const parsed: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading', 'listening', 'speaking', 'writing'], // All = not specified
        genre: 'general',
        purpose: 'certification',
        confidence: 0.8,
        extractedEntities: [
          { type: 'domain', value: 'medical', confidence: 0.9, span: [0, 7] },
        ],
        originalText: 'Medical English',
      };

      const questions = generateClarifyingQuestions(parsed);

      const modalityQuestion = questions.find((q) => q.id === 'clarify_modality');
      expect(modalityQuestion).toBeDefined();
    });

    it('generates timeline question when no deadline', () => {
      const parsed: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.8,
        extractedEntities: [],
        originalText: 'Medical reading',
      };

      const questions = generateClarifyingQuestions(parsed);

      const timelineQuestion = questions.find((q) => q.id === 'clarify_timeline');
      expect(timelineQuestion).toBeDefined();
    });

    it('skips domain question when domain is confident', () => {
      const parsed: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [
          { type: 'domain', value: 'medical', confidence: 0.9, span: [0, 7] },
        ],
        originalText: 'Medical reading',
      };

      const questions = generateClarifyingQuestions(parsed);

      const domainQuestion = questions.find((q) => q.id === 'clarify_domain');
      expect(domainQuestion).toBeUndefined();
    });

    it('questions have appropriate cognitive load', () => {
      const parsed: ParsedGoal = {
        domain: 'general',
        modalities: ['reading', 'listening', 'speaking', 'writing'],
        genre: 'general',
        purpose: 'general',
        confidence: 0.3,
        extractedEntities: [],
        originalText: 'Learn English',
      };

      const questions = generateClarifyingQuestions(parsed);

      questions.forEach((q) => {
        expect(['low', 'medium', 'high']).toContain(q.cognitiveLoad);
      });
    });
  });
});

// ============================================================================
// Onboarding Flow Tests
// ============================================================================

describe('Onboarding Flow', () => {
  describe('createOnboardingFlow', () => {
    it('creates flow with required steps', () => {
      const flow = createOnboardingFlow('en');

      expect(flow.steps.length).toBeGreaterThan(0);
    });

    it('flow has unique ID', () => {
      const flow1 = createOnboardingFlow('en');
      const flow2 = createOnboardingFlow('en');

      expect(flow1.id).not.toBe(flow2.id);
    });

    it('flow starts at step 0', () => {
      const flow = createOnboardingFlow('en');

      expect(flow.currentStep).toBe(0);
    });

    it('flow has estimated time', () => {
      const flow = createOnboardingFlow('en');

      expect(flow.estimatedTime).toBeGreaterThan(0);
    });

    it('flow has overall cognitive load', () => {
      const flow = createOnboardingFlow('en');

      expect(['low', 'medium', 'high']).toContain(flow.overallLoad);
    });

    it('includes language selection step', () => {
      const flow = createOnboardingFlow('en');

      const languageStep = flow.steps.find((s) => s.id === 'target_language');
      expect(languageStep).toBeDefined();
      expect(languageStep!.type).toBe('choice');
    });

    it('includes goal text input step', () => {
      const flow = createOnboardingFlow('en');

      const goalStep = flow.steps.find((s) => s.id === 'goal_text');
      expect(goalStep).toBeDefined();
      expect(goalStep!.type).toBe('text');
    });

    it('includes confirmation step', () => {
      const flow = createOnboardingFlow('en');

      const confirmStep = flow.steps.find((s) => s.id === 'confirm_goal');
      expect(confirmStep).toBeDefined();
      expect(confirmStep!.type).toBe('confirmation');
    });

    it('includes optional assessment step', () => {
      const flow = createOnboardingFlow('en');

      const assessmentStep = flow.steps.find((s) => s.id === 'initial_assessment');
      expect(assessmentStep).toBeDefined();
      expect(assessmentStep!.required).toBe(false);
    });

    it('steps have dependencies', () => {
      const flow = createOnboardingFlow('en');

      const confirmStep = flow.steps.find((s) => s.id === 'confirm_goal');
      expect(confirmStep!.dependsOn).toContain('goal_text');
    });
  });
});

// ============================================================================
// Cognitive Load Tests
// ============================================================================

describe('Cognitive Load Estimation', () => {
  describe('estimateCognitiveLoad', () => {
    it('choice with few options has lower load than many options', () => {
      const fewOptionsStep: OnboardingStep = {
        id: 'test',
        type: 'choice',
        content: {
          title: 'Pick one',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
        cognitiveLoad: 'low',
        required: false,
      };

      const manyOptionsStep: OnboardingStep = {
        id: 'test2',
        type: 'choice',
        content: {
          title: 'Pick one',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
            { value: 'd', label: 'D' },
          ],
        },
        cognitiveLoad: 'medium',
        required: false,
      };

      const fewLoad = estimateCognitiveLoad(fewOptionsStep);
      const manyLoad = estimateCognitiveLoad(manyOptionsStep);

      expect(fewLoad).toBeLessThan(manyLoad);
    });

    it('choice with many options has higher load', () => {
      const step: OnboardingStep = {
        id: 'test',
        type: 'choice',
        content: {
          title: 'Pick one',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
            { value: 'd', label: 'D' },
          ],
        },
        cognitiveLoad: 'medium',
        required: false,
      };

      const load = estimateCognitiveLoad(step);

      expect(load).toBeGreaterThan(0.5);
    });

    it('text input has medium load', () => {
      const step: OnboardingStep = {
        id: 'test',
        type: 'text',
        content: {
          title: 'Enter text',
        },
        cognitiveLoad: 'medium',
        required: false,
      };

      const load = estimateCognitiveLoad(step);

      expect(load).toBeCloseTo(0.6, 1);
    });

    it('confirmation has low load', () => {
      const step: OnboardingStep = {
        id: 'test',
        type: 'confirmation',
        content: {
          title: 'Confirm',
        },
        cognitiveLoad: 'low',
        required: false,
      };

      const load = estimateCognitiveLoad(step);

      expect(load).toBeLessThan(0.4);
    });

    it('assessment has high load', () => {
      const step: OnboardingStep = {
        id: 'test',
        type: 'assessment',
        content: {
          title: 'Assessment',
        },
        cognitiveLoad: 'high',
        required: false,
      };

      const load = estimateCognitiveLoad(step);

      expect(load).toBeGreaterThan(0.8);
    });

    it('required steps add load', () => {
      const optionalStep: OnboardingStep = {
        id: 'test',
        type: 'choice',
        content: {
          title: 'Pick one',
          options: [{ value: 'a', label: 'A' }],
        },
        cognitiveLoad: 'low',
        required: false,
      };

      const requiredStep: OnboardingStep = {
        ...optionalStep,
        required: true,
      };

      const optionalLoad = estimateCognitiveLoad(optionalStep);
      const requiredLoad = estimateCognitiveLoad(requiredStep);

      expect(requiredLoad).toBeGreaterThan(optionalLoad);
    });
  });
});

// ============================================================================
// Corpus Sourcing Tests
// ============================================================================

describe('Corpus Sourcing Suggestions', () => {
  describe('suggestCorpusSourcing', () => {
    it('suggests medical sources for medical domain', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading', 'speaking'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(plan.recommendedSources).toContain('embedded_medical');
    });

    it('suggests business sources for business domain', () => {
      const goal: ParsedGoal = {
        domain: 'business',
        modalities: ['reading', 'writing'],
        genre: 'corporate',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Business English',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(plan.recommendedSources).toContain('embedded_business');
    });

    it('suggests academic sources for academic domain', () => {
      const goal: ParsedGoal = {
        domain: 'academic',
        modalities: ['reading', 'writing'],
        genre: 'research',
        purpose: 'academic',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Academic English',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(plan.recommendedSources).toContain('embedded_academic');
    });

    it('includes vocabulary focus areas', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(plan.vocabularyFocus.length).toBeGreaterThan(0);
    });

    it('includes content types', () => {
      const goal: ParsedGoal = {
        domain: 'business',
        modalities: ['writing'],
        genre: 'corporate',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Business writing',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(plan.contentTypes.length).toBeGreaterThan(0);
    });

    it('suggests initial vocabulary count', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(plan.initialVocabularyCount).toBeGreaterThan(0);
    });

    it('includes benchmark in priorities when specified', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'certification:CELBAN',
        benchmark: 'CELBAN',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'CELBAN preparation',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(
        plan.priorityTopics.some((t) => t.includes('CELBAN'))
      ).toBe(true);
    });

    it('adds speaking content for speaking modality', () => {
      const goal: ParsedGoal = {
        domain: 'business',
        modalities: ['speaking'],
        genre: 'corporate',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [],
        originalText: 'Business speaking',
      };

      const plan = suggestCorpusSourcing(goal);

      expect(
        plan.contentTypes.some((t) => t.includes('dialogue'))
      ).toBe(true);
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Goal Validation', () => {
  describe('validateParsedGoal', () => {
    it('validates complete goal', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading', 'speaking'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.9,
        extractedEntities: [
          { type: 'domain', value: 'medical', confidence: 0.9, span: [0, 7] },
        ],
        originalText: 'Medical English for nursing',
      };

      const validation = validateParsedGoal(goal);

      expect(validation.isValid).toBe(true);
      expect(validation.missingFields.length).toBe(0);
    });

    it('identifies missing domain with low confidence', () => {
      const goal: ParsedGoal = {
        domain: 'general',
        modalities: ['reading'],
        genre: 'general',
        purpose: 'general',
        confidence: 0.3,
        extractedEntities: [],
        originalText: 'Learn English',
      };

      const validation = validateParsedGoal(goal);

      expect(validation.missingFields).toContain('domain');
    });

    it('identifies missing modalities', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: [],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.8,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const validation = validateParsedGoal(goal);

      expect(validation.missingFields).toContain('modalities');
    });

    it('provides suggestions for improvement', () => {
      const goal: ParsedGoal = {
        domain: 'general',
        modalities: ['reading'],
        genre: 'general',
        purpose: 'general',
        confidence: 0.3,
        extractedEntities: [],
        originalText: 'Learn English',
      };

      const validation = validateParsedGoal(goal);

      expect(validation.suggestions.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Clarification Update Tests
// ============================================================================

describe('Goal Update with Clarifications', () => {
  describe('updateGoalWithClarifications', () => {
    it('updates domain from clarification', () => {
      const goal: ParsedGoal = {
        domain: 'general',
        modalities: ['reading'],
        genre: 'general',
        purpose: 'general',
        confidence: 0.3,
        extractedEntities: [],
        originalText: 'Learn English',
      };

      const updated = updateGoalWithClarifications(goal, {
        clarify_domain: 'medical',
      });

      expect(updated.domain).toBe('medical');
      expect(updated.confidence).toBeGreaterThan(goal.confidence);
    });

    it('updates modalities from clarification', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading', 'listening', 'speaking', 'writing'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.8,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const updated = updateGoalWithClarifications(goal, {
        clarify_modality: ['reading', 'speaking'],
      });

      expect(updated.modalities).toEqual(['reading', 'speaking']);
    });

    it('updates deadline from timeline clarification', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.8,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const updated = updateGoalWithClarifications(goal, {
        clarify_timeline: '6months',
      });

      expect(updated.deadline).toBeDefined();
    });

    it('preserves unmodified fields', () => {
      const goal: ParsedGoal = {
        domain: 'medical',
        modalities: ['reading'],
        genre: 'clinical',
        purpose: 'professional',
        confidence: 0.8,
        extractedEntities: [],
        originalText: 'Medical English',
      };

      const updated = updateGoalWithClarifications(goal, {
        clarify_timeline: '3months',
      });

      expect(updated.domain).toBe('medical');
      expect(updated.genre).toBe('clinical');
      expect(updated.purpose).toBe('professional');
    });
  });
});

// ============================================================================
// Goal Creation from Responses Tests
// ============================================================================

describe('Goal Creation from Responses', () => {
  describe('createGoalFromResponses', () => {
    it('creates goal from text response', () => {
      const responses = {
        target_language: 'en',
        goal_text: 'I want to pass CELBAN for nursing',
      };

      const goal = createGoalFromResponses(responses);

      expect(goal.benchmark).toBe('CELBAN');
      expect(goal.domain).toBe('medical');
    });

    it('applies clarifications to parsed goal', () => {
      const responses = {
        target_language: 'en',
        goal_text: 'I want to learn English',
        clarify_domain: 'business',
      };

      const goal = createGoalFromResponses(responses);

      expect(goal.domain).toBe('business');
    });

    it('creates fallback goal for missing text', () => {
      const responses = {
        clarify_domain: 'academic',
        clarify_modality: ['reading', 'writing'],
      };

      const goal = createGoalFromResponses(responses);

      expect(goal.domain).toBe('academic');
      expect(goal.modalities).toEqual(['reading', 'writing']);
    });

    it('uses defaults for completely empty responses', () => {
      const responses = {};

      const goal = createGoalFromResponses(responses);

      expect(goal.domain).toBe('general');
      expect(goal.modalities.length).toBe(4); // All modalities
    });
  });
});
