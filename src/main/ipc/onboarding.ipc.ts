/**
 * Onboarding IPC Handlers
 *
 * Handles user onboarding flow - checking if user needs onboarding
 * and creating user profile + first goal from wizard data.
 */

import { registerDynamicHandler, success, error } from './contracts';
import { prisma } from '../db/client';
import { populateVocabularyForGoal } from '../services/corpus-sources/corpus-pipeline.service';

// =============================================================================
// Types
// =============================================================================

interface OnboardingData {
  nativeLanguage: string;
  targetLanguage: string;
  domain: string;
  modality: string[];
  purpose: string;
  benchmark?: string;
  deadline?: string;
  dailyTime: number;
}

interface OnboardingStatus {
  needsOnboarding: boolean;
  hasUser: boolean;
  hasGoals: boolean;
  userId?: string;
}

// =============================================================================
// Handler Registration
// =============================================================================

/**
 * Register all onboarding-related IPC handlers.
 */
export function registerOnboardingHandlers(): void {
  /**
   * Check if user needs onboarding.
   * Returns true if no user exists or user has no goals.
   */
  registerDynamicHandler('onboarding:check-status', async () => {
    try {
      const user = await prisma.user.findFirst({
        include: {
          _count: {
            select: { goals: true },
          },
        },
      });

      const status: OnboardingStatus = {
        needsOnboarding: !user || user._count.goals === 0,
        hasUser: !!user,
        hasGoals: user ? user._count.goals > 0 : false,
        userId: user?.id,
      };

      return success(status);
    } catch (err) {
      console.error('Failed to check onboarding status:', err);
      return error('Failed to check onboarding status');
    }
  });

  /**
   * Complete onboarding by creating user profile and first goal.
   */
  registerDynamicHandler('onboarding:complete', async (_event, request) => {
    const data = request as OnboardingData;

    // Validate required fields
    if (!data.nativeLanguage || !data.targetLanguage) {
      return error('Native and target languages are required');
    }
    if (!data.domain) {
      return error('Domain is required');
    }
    if (!data.modality || data.modality.length === 0) {
      return error('At least one modality is required');
    }
    if (!data.purpose) {
      return error('Purpose is required');
    }

    try {
      // Create or update user with language preferences
      let user = await prisma.user.findFirst();

      if (user) {
        // Update existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            nativeLanguage: data.nativeLanguage,
            targetLanguage: data.targetLanguage,
          },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            nativeLanguage: data.nativeLanguage,
            targetLanguage: data.targetLanguage,
            thetaGlobal: 0,
            thetaPhonology: 0,
            thetaMorphology: 0,
            thetaLexical: 0,
            thetaSyntactic: 0,
            thetaPragmatic: 0,
          },
        });
      }

      // Create the first goal
      const goal = await prisma.goalSpec.create({
        data: {
          userId: user.id,
          domain: data.domain.toLowerCase(),
          modality: JSON.stringify(data.modality.map((m) => m.toLowerCase())),
          genre: getDefaultGenre(data.domain, data.purpose),
          purpose: data.purpose,
          benchmark: data.benchmark?.trim() || null,
          deadline: data.deadline ? new Date(data.deadline) : null,
          completionPercent: 0,
          isActive: true,
        },
      });

      // Start vocabulary population in background
      // Don't await - let it run asynchronously
      populateVocabularyForGoal(goal.id, {
        targetVocabSize: getInitialVocabSize(data.dailyTime, data.purpose),
      }).catch((err) => {
        console.error('Background vocabulary population failed:', err);
      });

      return success({
        userId: user.id,
        goalId: goal.id,
        nativeLanguage: user.nativeLanguage,
        targetLanguage: user.targetLanguage,
        domain: goal.domain,
        modality: data.modality,
        purpose: goal.purpose,
      });
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      return error('Failed to complete onboarding');
    }
  });

  /**
   * Skip onboarding (create minimal user without goal).
   */
  registerDynamicHandler('onboarding:skip', async () => {
    try {
      let user = await prisma.user.findFirst();

      if (!user) {
        // Create minimal user with defaults
        user = await prisma.user.create({
          data: {
            nativeLanguage: 'en-US',
            targetLanguage: 'en-US',
            thetaGlobal: 0,
            thetaPhonology: 0,
            thetaMorphology: 0,
            thetaLexical: 0,
            thetaSyntactic: 0,
            thetaPragmatic: 0,
          },
        });
      }

      return success({
        userId: user.id,
        skipped: true,
      });
    } catch (err) {
      console.error('Failed to skip onboarding:', err);
      return error('Failed to skip onboarding');
    }
  });

  /**
   * Get user profile for onboarding resume/edit.
   */
  registerDynamicHandler('onboarding:get-user', async () => {
    try {
      const user = await prisma.user.findFirst({
        include: {
          goals: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        return success(null);
      }

      return success({
        id: user.id,
        nativeLanguage: user.nativeLanguage,
        targetLanguage: user.targetLanguage,
        hasActiveGoal: user.goals.length > 0,
        activeGoal: user.goals[0] || null,
      });
    } catch (err) {
      console.error('Failed to get user:', err);
      return error('Failed to get user');
    }
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get default genre based on domain and purpose.
 */
function getDefaultGenre(domain: string, purpose: string): string {
  const genreMap: Record<string, Record<string, string>> = {
    medical: {
      certification: 'clinical documentation',
      professional: 'patient communication',
      academic: 'medical research',
      default: 'healthcare terminology',
    },
    legal: {
      certification: 'legal documentation',
      professional: 'client communication',
      academic: 'legal research',
      default: 'legal terminology',
    },
    business: {
      certification: 'business communication',
      professional: 'professional correspondence',
      academic: 'business analysis',
      default: 'business terminology',
    },
    academic: {
      certification: 'academic writing',
      professional: 'scholarly communication',
      academic: 'research papers',
      default: 'academic discourse',
    },
    technology: {
      certification: 'technical documentation',
      professional: 'technical communication',
      academic: 'technical research',
      default: 'technical terminology',
    },
    travel: {
      default: 'travel communication',
    },
    general: {
      default: 'everyday communication',
    },
  };

  const domainGenres = genreMap[domain] || genreMap.general;
  return domainGenres[purpose] || domainGenres.default || 'general communication';
}

/**
 * Calculate initial vocabulary size based on daily time and purpose.
 */
function getInitialVocabSize(dailyTimeMinutes: number, purpose: string): number {
  // Base size on purpose urgency
  const purposeMultipliers: Record<string, number> = {
    certification: 1.5, // Need more words for exams
    professional: 1.2,
    academic: 1.3,
    immigration: 1.4,
    personal: 1.0,
  };

  const multiplier = purposeMultipliers[purpose] || 1.0;

  // Estimate: ~3 words learned per minute of study (with reviews)
  // Initial corpus should be ~4 weeks of content
  const wordsPerSession = dailyTimeMinutes * 3;
  const initialDays = 28;

  return Math.round(wordsPerSession * initialDays * multiplier);
}

/**
 * Unregister all onboarding handlers (for cleanup/testing).
 */
export function unregisterOnboardingHandlers(): void {
  const { unregisterHandler } = require('./contracts') as { unregisterHandler: (channel: string) => void };
  unregisterHandler('onboarding:check-status');
  unregisterHandler('onboarding:complete');
  unregisterHandler('onboarding:skip');
  unregisterHandler('onboarding:get-user');
}
