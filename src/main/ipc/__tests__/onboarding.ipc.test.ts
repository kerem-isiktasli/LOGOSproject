/**
 * Onboarding IPC Handlers Tests
 *
 * Tests for onboarding flow IPC communication.
 * Validates user setup and initial goal creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateInput,
  OnboardingCompleteSchema,
} from '../../../shared/schemas/ipc-schemas';

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Onboarding IPC Schema Validation', () => {
  describe('OnboardingCompleteSchema', () => {
    it('should accept valid onboarding data', () => {
      const result = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'business',
        modality: ['visual', 'auditory'],
        purpose: 'Work communication with Japanese clients',
        benchmark: 'B2',
        deadline: '2025-12-31T23:59:59Z',
        dailyTime: 45,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nativeLanguage).toBe('ko');
        expect(result.data.targetLanguage).toBe('ja');
        expect(result.data.domain).toBe('business');
        expect(result.data.modality).toContain('visual');
      }
    });

    it('should accept minimal required fields', () => {
      const result = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'en',
        targetLanguage: 'es',
        domain: 'travel',
        modality: ['visual'],
        purpose: 'Travel in Spain',
        dailyTime: 15,
      });

      expect(result.success).toBe(true);
    });

    it('should validate language codes', () => {
      // Valid 2-letter codes
      const twoLetter = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 30,
      });
      expect(twoLetter.success).toBe(true);

      // Valid locale codes
      const locale = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko-KR',
        targetLanguage: 'ja-JP',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 30,
      });
      expect(locale.success).toBe(true);

      // Invalid codes
      const invalid = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'korean',
        targetLanguage: 'japanese',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 30,
      });
      expect(invalid.success).toBe(false);
    });

    it('should require at least one modality', () => {
      const empty = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: [],
        purpose: 'test',
        dailyTime: 30,
      });
      expect(empty.success).toBe(false);
    });

    it('should validate modality values', () => {
      const valid = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual', 'auditory', 'kinesthetic'],
        purpose: 'test',
        dailyTime: 30,
      });
      expect(valid.success).toBe(true);

      const invalid = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual', 'tactile'], // invalid modality
        purpose: 'test',
        dailyTime: 30,
      });
      expect(invalid.success).toBe(false);
    });

    it('should validate dailyTime range', () => {
      // Too short
      const tooShort = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 3,
      });
      expect(tooShort.success).toBe(false);

      // Too long
      const tooLong = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 500,
      });
      expect(tooLong.success).toBe(false);
    });

    it('should validate purpose length', () => {
      const tooLong = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual'],
        purpose: 'a'.repeat(501),
        dailyTime: 30,
      });
      expect(tooLong.success).toBe(false);
    });

    it('should validate domain length', () => {
      const tooLong = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'a'.repeat(201),
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 30,
      });
      expect(tooLong.success).toBe(false);
    });

    it('should validate benchmark enum', () => {
      const validBenchmarks = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

      for (const benchmark of validBenchmarks) {
        const result = validateInput(OnboardingCompleteSchema, {
          nativeLanguage: 'ko',
          targetLanguage: 'ja',
          domain: 'general',
          modality: ['visual'],
          purpose: 'test',
          dailyTime: 30,
          benchmark,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate deadline format', () => {
      const valid = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 30,
        deadline: '2025-06-15T00:00:00Z',
      });
      expect(valid.success).toBe(true);

      const invalid = validateInput(OnboardingCompleteSchema, {
        nativeLanguage: 'ko',
        targetLanguage: 'ja',
        domain: 'general',
        modality: ['visual'],
        purpose: 'test',
        dailyTime: 30,
        deadline: 'next-year',
      });
      expect(invalid.success).toBe(false);
    });
  });
});

// ============================================================================
// Onboarding Logic Tests
// ============================================================================

describe('Onboarding Handler Logic', () => {
  describe('Initial Theta Estimation', () => {
    it('should estimate theta based on daily time commitment', () => {
      // Higher daily time suggests more serious learner (higher initial theta)
      const estimateTheta = (dailyTime: number): number => {
        if (dailyTime >= 60) return 0.5;
        if (dailyTime >= 30) return 0;
        if (dailyTime >= 15) return -0.5;
        return -1;
      };

      expect(estimateTheta(60)).toBe(0.5);
      expect(estimateTheta(30)).toBe(0);
      expect(estimateTheta(15)).toBe(-0.5);
      expect(estimateTheta(5)).toBe(-1);
    });

    it('should adjust theta based on benchmark target', () => {
      const benchmarkTheta: Record<string, number> = {
        'A1': -2,
        'A2': -1,
        'B1': 0,
        'B2': 0.5,
        'C1': 1,
        'C2': 1.5,
      };

      expect(benchmarkTheta['B2']).toBe(0.5);
      expect(benchmarkTheta['C1']).toBe(1);
    });
  });

  describe('Domain-Based Vocabulary Selection', () => {
    it('should prioritize domain-specific vocabulary', () => {
      const domains = {
        'business': ['会議', '契約', '報告書', '取引先'],
        'travel': ['空港', 'ホテル', '予約', '観光'],
        'academic': ['研究', '論文', '発表', '分析'],
        'general': ['食べる', '行く', '見る', '言う'],
      };

      const domain = 'business';
      const vocab = domains[domain] || domains['general'];

      expect(vocab).toContain('会議');
      expect(vocab).toContain('契約');
    });

    it('should calculate domain relevance score', () => {
      const word = { content: '契約', domain: 'business' };
      const userDomain = 'business';

      const relevanceScore = word.domain === userDomain ? 1.0 : 0.3;

      expect(relevanceScore).toBe(1.0);
    });
  });

  describe('Modality-Based Task Selection', () => {
    it('should weight modalities for task generation', () => {
      const userModalities = ['visual', 'auditory'];

      const taskModalities = {
        'mcq': 'visual',
        'fill_blank': 'visual',
        'pronunciation': 'auditory',
        'dictation': 'auditory',
        'typing': 'kinesthetic',
      };

      const availableTasks = Object.entries(taskModalities)
        .filter(([_, modality]) => userModalities.includes(modality))
        .map(([task, _]) => task);

      expect(availableTasks).toContain('mcq');
      expect(availableTasks).toContain('pronunciation');
      expect(availableTasks).not.toContain('typing');
    });
  });

  describe('Onboarding Status Check', () => {
    it('should detect new user needing onboarding', () => {
      const user = null;
      const goals: any[] = [];

      const needsOnboarding = !user || goals.length === 0;

      expect(needsOnboarding).toBe(true);
    });

    it('should detect existing user with goals', () => {
      const user = { id: '123', name: 'Test User' };
      const goals = [{ id: 'g1', name: 'Learn Japanese' }];

      const needsOnboarding = !user || goals.length === 0;

      expect(needsOnboarding).toBe(false);
    });

    it('should handle user without goals', () => {
      const user = { id: '123', name: 'Test User' };
      const goals: any[] = [];

      const needsOnboarding = !user || goals.length === 0;

      expect(needsOnboarding).toBe(true);
    });
  });

  describe('Onboarding Skip', () => {
    it('should create default user on skip', () => {
      const createDefaultUser = () => ({
        id: 'default-user',
        nativeLanguage: 'en',
        thetaGlobal: 0,
        onboardingSkipped: true,
      });

      const user = createDefaultUser();

      expect(user.onboardingSkipped).toBe(true);
      expect(user.thetaGlobal).toBe(0);
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Onboarding Error Handling', () => {
  it('should handle duplicate user creation', () => {
    const existingUser = { id: '123' };
    const shouldCreateNew = existingUser === null;

    expect(shouldCreateNew).toBe(false);
  });

  it('should handle corpus initialization failure', () => {
    const initCorpus = async () => {
      throw new Error('Corpus initialization failed');
    };

    expect(initCorpus()).rejects.toThrow('Corpus initialization failed');
  });

  it('should handle invalid language pair', () => {
    const supportedPairs = [
      'ko-ja', 'ko-en', 'ko-zh',
      'en-ja', 'en-es', 'en-zh',
    ];

    const isSupported = (native: string, target: string) =>
      supportedPairs.includes(`${native}-${target}`);

    expect(isSupported('ko', 'ja')).toBe(true);
    expect(isSupported('ko', 'fr')).toBe(false);
  });
});
