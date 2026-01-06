/**
 * Claude IPC Handlers
 *
 * Handles all Claude API-related IPC communication.
 * Provides content generation, error analysis, and hints to the renderer.
 */

import { registerDynamicHandler, success, error, validateUUID, validateNonEmpty } from './contracts';
import { prisma } from '../db/client';
import { getClaudeService } from '../services/claude.service';
import type { ContentRequest, ErrorAnalysisRequest, HintRequest } from '../services/claude.service';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a recommendation based on component and error rate.
 */
function getComponentRecommendation(component: string, errorRate: number): string {
  const recommendations: Record<string, { low: string; medium: string; high: string }> = {
    PHON: {
      low: 'Good phonological awareness. Continue with listening exercises.',
      medium: 'Focus on sound patterns. Try minimal pair exercises.',
      high: 'Prioritize pronunciation drills. Work with audio materials.',
    },
    MORPH: {
      low: 'Strong morphological understanding. Explore complex word forms.',
      medium: 'Review word formation patterns. Practice affixes and roots.',
      high: 'Focus on basic morphology. Study common prefixes and suffixes.',
    },
    LEX: {
      low: 'Excellent vocabulary. Expand into specialized domains.',
      medium: 'Build contextual vocabulary. Use words in sentences.',
      high: 'Strengthen core vocabulary. Focus on high-frequency words.',
    },
    SYNT: {
      low: 'Good syntactic control. Practice complex sentence structures.',
      medium: 'Review sentence patterns. Practice with varied structures.',
      high: 'Focus on basic sentence structure. Study word order rules.',
    },
    PRAG: {
      low: 'Strong pragmatic awareness. Explore nuanced language use.',
      medium: 'Practice register switching. Focus on context appropriateness.',
      high: 'Study basic pragmatics. Learn common social expressions.',
    },
  };

  const rec = recommendations[component] || recommendations.LEX;

  if (errorRate < 0.2) return rec.low;
  if (errorRate < 0.5) return rec.medium;
  return rec.high;
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all Claude-related IPC handlers.
 */
export function registerClaudeHandlers(): void {
  // Generate content (exercise, explanation, example)
  registerDynamicHandler('claude:generateContent', async (_event, request) => {
    const { type, objectId, context } = request as {
      type: 'exercise' | 'explanation' | 'example';
      objectId: string;
      context?: string;
    };

    if (!['exercise', 'explanation', 'example'].includes(type)) {
      return error('type must be exercise, explanation, or example');
    }

    const objectError = validateUUID(objectId, 'objectId');
    if (objectError) return error(objectError);

    try {
      // Get the learning object and its goal for language context
      const object = await prisma.languageObject.findUnique({
        where: { id: objectId },
        include: { goal: { include: { user: true } }, masteryState: true },
      });

      if (!object) {
        return error('Learning object not found');
      }

      const claude = getClaudeService();
      const contentRequest: ContentRequest = {
        type,
        content: object.content,
        targetLanguage: object.goal.user.targetLanguage,
        nativeLanguage: object.goal.user.nativeLanguage,
        context,
        difficulty: object.masteryState?.stage ?? 2,
      };

      const generated = await claude.generateContent(contentRequest);

      return success({
        content: generated.content,
        type: generated.type,
        objectId,
        metadata: generated.metadata,
      });
    } catch (err) {
      console.error('Failed to generate content:', err);
      return error(err instanceof Error ? err.message : 'Failed to generate content');
    }
  });

  // Analyze an error and store in database
  registerDynamicHandler('claude:analyzeError', async (_event, request) => {
    const { objectId, userResponse, expectedResponse, responseId } = request as {
      objectId: string;
      userResponse: string;
      expectedResponse: string;
      responseId?: string;
    };

    const objectError = validateUUID(objectId, 'objectId');
    if (objectError) return error(objectError);

    const userResponseError = validateNonEmpty(userResponse, 'userResponse');
    if (userResponseError) return error(userResponseError);

    const expectedError = validateNonEmpty(expectedResponse, 'expectedResponse');
    if (expectedError) return error(expectedError);

    try {
      const object = await prisma.languageObject.findUnique({
        where: { id: objectId },
        include: { goal: { include: { user: true } } },
      });

      if (!object) {
        return error('Learning object not found');
      }

      const claude = getClaudeService();
      const analysisRequest: ErrorAnalysisRequest = {
        content: object.content,
        userResponse,
        expectedResponse,
        targetLanguage: object.goal.user.targetLanguage,
        nativeLanguage: object.goal.user.nativeLanguage,
      };

      const analysis = await claude.analyzeError(analysisRequest);

      // Store error analysis if responseId provided
      if (responseId) {
        await prisma.errorAnalysis.create({
          data: {
            responseId,
            objectId,
            component: analysis.component,
            errorType: analysis.errorType,
            explanation: analysis.explanation,
            correction: analysis.correction,
            similarErrors: analysis.similarErrors ? JSON.stringify(analysis.similarErrors) : null,
            source: 'claude',
          },
        });

        // Update component error stats for the user
        const userId = object.goal.userId;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get recent error count for this component
        const recentCount = await prisma.errorAnalysis.count({
          where: {
            component: analysis.component,
            object: { goal: { userId } },
            createdAt: { gte: sevenDaysAgo },
          },
        });

        // Get total error count for this component
        const totalCount = await prisma.errorAnalysis.count({
          where: {
            component: analysis.component,
            object: { goal: { userId } },
          },
        });

        // Get total response count for error rate calculation
        const totalResponses = await prisma.response.count({
          where: {
            session: { userId },
            createdAt: { gte: sevenDaysAgo },
          },
        });

        const errorRate = totalResponses > 0 ? recentCount / totalResponses : 0;

        // Upsert component error stats
        await prisma.componentErrorStats.upsert({
          where: {
            userId_component_goalId: {
              userId,
              component: analysis.component,
              goalId: object.goalId,
            },
          },
          update: {
            totalErrors: totalCount,
            recentErrors: recentCount,
            errorRate,
            recommendation: getComponentRecommendation(analysis.component, errorRate),
          },
          create: {
            userId,
            component: analysis.component,
            goalId: object.goalId,
            totalErrors: totalCount,
            recentErrors: recentCount,
            errorRate,
            recommendation: getComponentRecommendation(analysis.component, errorRate),
          },
        });
      }

      return success({
        objectId,
        responseId,
        errorType: analysis.errorType,
        component: analysis.component,
        explanation: analysis.explanation,
        correction: analysis.correction,
        similarErrors: analysis.similarErrors,
      });
    } catch (err) {
      console.error('Failed to analyze error:', err);
      return error(err instanceof Error ? err.message : 'Failed to analyze error');
    }
  });

  // Get component bottlenecks for a user
  registerDynamicHandler('claude:getBottlenecks', async (_event, request) => {
    const { userId, goalId, limit } = request as {
      userId?: string;
      goalId?: string;
      limit?: number;
    };

    try {
      // Get user ID from goal if not provided
      let targetUserId = userId;
      if (!targetUserId && goalId) {
        const goal = await prisma.goalSpec.findUnique({ where: { id: goalId } });
        targetUserId = goal?.userId;
      }

      if (!targetUserId) {
        // Get default user
        const user = await prisma.user.findFirst();
        targetUserId = user?.id;
      }

      if (!targetUserId) {
        return success({ bottlenecks: [], primaryBottleneck: null });
      }

      // Get component error stats sorted by error rate
      const stats = await prisma.componentErrorStats.findMany({
        where: {
          userId: targetUserId,
          ...(goalId ? { goalId } : {}),
        },
        orderBy: { errorRate: 'desc' },
        take: limit || 5,
      });

      // Transform to bottleneck format
      const bottlenecks = stats.map((stat) => ({
        component: stat.component,
        errorRate: stat.errorRate,
        totalErrors: stat.totalErrors,
        recentErrors: stat.recentErrors,
        trend: stat.trend,
        recommendation: stat.recommendation || getComponentRecommendation(stat.component, stat.errorRate),
        confidence: Math.min(0.95, 0.5 + stat.totalErrors * 0.01), // Confidence increases with more data
      }));

      return success({
        bottlenecks,
        primaryBottleneck: bottlenecks.length > 0 ? bottlenecks[0] : null,
      });
    } catch (err) {
      console.error('Failed to get bottlenecks:', err);
      return error(err instanceof Error ? err.message : 'Failed to get bottlenecks');
    }
  });

  // Get a hint
  registerDynamicHandler('claude:getHint', async (_event, request) => {
    const { objectId, hintLevel, previousHints } = request as {
      objectId: string;
      hintLevel: 1 | 2 | 3;
      previousHints?: string[];
    };

    const objectError = validateUUID(objectId, 'objectId');
    if (objectError) return error(objectError);

    if (![1, 2, 3].includes(hintLevel)) {
      return error('hintLevel must be 1, 2, or 3');
    }

    try {
      const object = await prisma.languageObject.findUnique({
        where: { id: objectId },
        include: { goal: { include: { user: true } } },
      });

      if (!object) {
        return error('Learning object not found');
      }

      const claude = getClaudeService();
      const hintRequest: HintRequest = {
        content: object.content,
        translation: (object as any).translation || undefined,
        targetLanguage: object.goal.user.targetLanguage,
        nativeLanguage: object.goal.user.nativeLanguage,
        hintLevel,
        previousHints,
      };

      const hint = await claude.getHint(hintRequest);

      return success({
        objectId,
        hint: hint.hint,
        level: hint.level,
        remainingLevels: hint.remainingLevels,
      });
    } catch (err) {
      console.error('Failed to get hint:', err);
      return error(err instanceof Error ? err.message : 'Failed to get hint');
    }
  });
}

/**
 * Unregister Claude handlers.
 */
export function unregisterClaudeHandlers(): void {
  const { unregisterHandler } = require('./contracts');
  unregisterHandler('claude:generateContent');
  unregisterHandler('claude:analyzeError');
  unregisterHandler('claude:getBottlenecks');
  unregisterHandler('claude:getHint');
}
