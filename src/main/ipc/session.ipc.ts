/**
 * Session IPC Handlers
 *
 * Handles all session-related IPC communication.
 * Sessions track learning activities, responses, and analytics.
 */

import { registerHandler, success, error, validateUUID, validateRequired } from './contracts';
import { prisma } from '../db/client';
import { FSRS, createNewCard, updateMastery, responseToRating, determineStage } from '../../core/fsrs';
import { analyzeBottleneck, ComponentType, ResponseData as BottleneckResponseData } from '../../core/bottleneck';
import { estimateThetaMLE, calibrateItems } from '../../core/irt';
import { computePriority, computeUrgency, DEFAULT_PRIORITY_WEIGHTS } from '../../core/priority';
import {
  analyzeResponseTime,
  calculateFSRSRatingWithTiming,
  getTaskCategory,
} from '../../core/response-timing';
import type { ResponseData } from '../../core/fsrs';

// =============================================================================
// IRT Calibration Configuration
// =============================================================================

const IRT_CALIBRATION_CONFIG = {
  /** Minimum responses per item for calibration */
  minResponsesPerItem: 5,
  /** Minimum unique items required for calibration */
  minItems: 10,
  /** Minimum unique respondents (sessions) required */
  minRespondents: 3,
  /** Maximum iterations for EM algorithm */
  maxIterations: 50,
  /** Whether to auto-calibrate at session end */
  autoCalibrate: true,
};

// Singleton FSRS instance
const fsrs = new FSRS();

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all session-related IPC handlers.
 */
export function registerSessionHandlers(): void {
  // Start a new session
  registerHandler('session:start', async (_event, request) => {
    const { goalId, mode, maxItems, targetDurationMinutes, focusComponents } = request as {
      goalId: string;
      mode: 'learning' | 'training' | 'evaluation';
      maxItems?: number;
      targetDurationMinutes?: number;
      focusComponents?: string[];
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    if (!['learning', 'training', 'evaluation'].includes(mode)) {
      return error('mode must be learning, training, or evaluation');
    }

    try {
      // Get or create default user
      let user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            nativeLanguage: 'en',
            targetLanguage: 'en',
          },
        });
      }

      // End any existing active session for this goal
      await prisma.session.updateMany({
        where: { goalId, endedAt: null },
        data: { endedAt: new Date() },
      });

      const session = await prisma.session.create({
        data: {
          goalId,
          userId: user.id,
          mode,
          startedAt: new Date(),
        },
      });

      // Get first task from learning queue
      const firstItem = await prisma.languageObject.findFirst({
        where: { goalId },
        include: { masteryState: true },
        orderBy: { priority: 'desc' },
      });

      return success({
        sessionId: session.id,
        firstTask: firstItem ? {
          objectId: firstItem.id,
          content: firstItem.content,
          type: firstItem.type,
          masteryStage: firstItem.masteryState?.stage ?? 0,
        } : null,
        queueLength: await prisma.languageObject.count({ where: { goalId } }),
      });
    } catch (err) {
      console.error('Failed to start session:', err);
      return error('Failed to start session');
    }
  });

  // End current session
  registerHandler('session:end', async (_event, request) => {
    const { sessionId } = request as { sessionId: string };

    const idError = validateUUID(sessionId, 'sessionId');
    if (idError) return error(idError);

    try {
      const session = await prisma.session.update({
        where: { id: sessionId },
        data: { endedAt: new Date() },
        include: {
          responses: true,
        },
      });

      // Calculate session stats
      const totalResponses = session.responses.length;
      const correctResponses = session.responses.filter(r => r.correct).length;
      const accuracy = totalResponses > 0 ? correctResponses / totalResponses : 0;
      const duration = session.endedAt
        ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000 / 60
        : 0;

      // Run IRT calibration if configured and sufficient data exists
      let calibrationResult: {
        calibrated: boolean;
        itemsUpdated: number;
        reason?: string;
      } = { calibrated: false, itemsUpdated: 0 };

      if (IRT_CALIBRATION_CONFIG.autoCalibrate && totalResponses >= IRT_CALIBRATION_CONFIG.minResponsesPerItem) {
        try {
          calibrationResult = await runIRTCalibration(session.goalId);
        } catch (calibErr) {
          console.warn('IRT calibration skipped:', calibErr);
          calibrationResult.reason = calibErr instanceof Error ? calibErr.message : 'Unknown calibration error';
        }
      }

      return success({
        id: session.id,
        endedAt: session.endedAt,
        stats: {
          totalResponses,
          correctResponses,
          accuracy,
          durationMinutes: Math.round(duration * 10) / 10,
        },
        calibration: calibrationResult,
      });
    } catch (err) {
      console.error('Failed to end session:', err);
      return error('Failed to end session');
    }
  });

  // Get current session state
  registerHandler('session:get-state', async (_event, request) => {
    const { sessionId } = request as { sessionId: string };

    const idError = validateUUID(sessionId, 'sessionId');
    if (idError) return error(idError);

    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          responses: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!session) {
        return error('Session not found');
      }

      const correctCount = session.responses.filter(r => r.correct).length;

      return success({
        sessionId: session.id,
        mode: session.mode,
        itemsPracticed: session.itemsPracticed,
        stageTransitions: session.stageTransitions,
        accuracy: session.responses.length > 0 ? correctCount / session.responses.length : 0,
        startedAt: session.startedAt,
        isActive: session.endedAt === null,
      });
    } catch (err) {
      console.error('Failed to get session state:', err);
      return error('Failed to get session state');
    }
  });

  // Submit a response
  registerHandler('session:submit-response', async (_event, request) => {
    const { sessionId, objectId, correct, cueLevel, responseTimeMs, taskType, taskFormat, modality, responseContent, expectedContent } = request as {
      sessionId: string;
      objectId: string;
      correct: boolean;
      cueLevel: 0 | 1 | 2 | 3;
      responseTimeMs: number;
      taskType?: string;
      taskFormat?: string;
      modality?: string;
      responseContent?: string;
      expectedContent?: string;
    };

    const sessionError = validateUUID(sessionId, 'sessionId');
    if (sessionError) return error(sessionError);

    const objectError = validateUUID(objectId, 'objectId');
    if (objectError) return error(objectError);

    if (typeof correct !== 'boolean') {
      return error('correct must be a boolean');
    }

    if (![0, 1, 2, 3].includes(cueLevel)) {
      return error('cueLevel must be 0, 1, 2, or 3');
    }

    try {
      // Get the language object for word length and mastery info
      const languageObject = await prisma.languageObject.findUnique({
        where: { id: objectId },
        select: { content: true, type: true },
      });

      const wordLength = languageObject?.content.length ?? 6;

      // Get mastery state early for response timing analysis
      let mastery = await prisma.masteryState.findUnique({
        where: { objectId },
      });

      const currentStage = mastery?.stage ?? 0;

      // Analyze response timing for quality assessment
      const taskCategory = getTaskCategory(taskFormat as 'mcq' | 'fill_blank' | 'free_response', taskType);
      const timingAnalysis = analyzeResponseTime(
        responseTimeMs,
        taskCategory,
        currentStage,
        wordLength,
        correct
      );

      // Calculate timing-aware FSRS rating
      const timingAwareRating = calculateFSRSRatingWithTiming(
        correct,
        responseTimeMs,
        taskFormat as 'mcq' | 'fill_blank' | 'free_response',
        currentStage,
        wordLength
      );

      // Create response record with timing metadata
      const response = await prisma.response.create({
        data: {
          sessionId,
          objectId,
          correct,
          cueLevel,
          responseTimeMs,
          taskType: taskType || 'recall',
          taskFormat: taskFormat || 'free_response',
          modality: modality || 'visual',
          responseContent,
          expectedContent,
        },
      });

      const responseData: ResponseData = {
        correct,
        cueLevel: cueLevel as 0 | 1 | 2 | 3,
        responseTimeMs,
      };

      const now = new Date();

      // Track old stage for transition detection
      const oldStage = mastery?.stage ?? 0;
      let newStage = oldStage;
      let stageChanged = false;

      if (!mastery) {
        // Create new mastery state
        const newCard = createNewCard();
        // Use timing-aware rating for more accurate scheduling
        const updatedCard = fsrs.schedule(newCard, timingAwareRating, now);

        newStage = responseData.correct ? 1 : 0;
        stageChanged = newStage !== oldStage;

        mastery = await prisma.masteryState.create({
          data: {
            objectId,
            stage: newStage,
            fsrsStability: updatedCard.stability,
            fsrsDifficulty: updatedCard.difficulty,
            cueFreeAccuracy: cueLevel === 0 ? (correct ? 1 : 0) : 0,
            cueAssistedAccuracy: cueLevel > 0 ? (correct ? 1 : 0) : 0,
            exposureCount: 1,
            fsrsLastReview: now,
            nextReview: fsrs.nextReviewDate(updatedCard),
            fsrsReps: 1,
            fsrsLapses: correct ? 0 : 1,
          },
        });
      } else {
        // Update existing mastery
        const existingCard = {
          difficulty: mastery.fsrsDifficulty,
          stability: mastery.fsrsStability,
          lastReview: mastery.fsrsLastReview,
          reps: mastery.fsrsReps,
          lapses: mastery.fsrsLapses,
          state: mastery.fsrsReps === 0 ? 'new' as const : 'review' as const,
        };

        // Use timing-aware rating for better scheduling (accounts for response speed)
        const updatedCard = fsrs.schedule(existingCard, timingAwareRating, now);

        // Calculate updated accuracy with recency weighting
        const weight = 1 / (mastery.exposureCount * 0.3 + 1);
        let newCueFreeAccuracy = mastery.cueFreeAccuracy;
        let newCueAssistedAccuracy = mastery.cueAssistedAccuracy;

        if (cueLevel === 0) {
          newCueFreeAccuracy = (1 - weight) * mastery.cueFreeAccuracy + weight * (correct ? 1 : 0);
        } else {
          newCueAssistedAccuracy = (1 - 0.2) * mastery.cueAssistedAccuracy + 0.2 * (correct ? 1 : 0);
        }

        // Determine stage
        const gap = newCueAssistedAccuracy - newCueFreeAccuracy;

        if (newCueFreeAccuracy >= 0.9 && updatedCard.stability > 30 && gap < 0.1) {
          newStage = 4;
        } else if (newCueFreeAccuracy >= 0.75 && updatedCard.stability > 7) {
          newStage = 3;
        } else if (newCueFreeAccuracy >= 0.6 || newCueAssistedAccuracy >= 0.8) {
          newStage = 2;
        } else if (newCueAssistedAccuracy >= 0.5) {
          newStage = 1;
        }

        stageChanged = newStage !== oldStage;

        mastery = await prisma.masteryState.update({
          where: { objectId },
          data: {
            stage: newStage,
            fsrsStability: updatedCard.stability,
            fsrsDifficulty: updatedCard.difficulty,
            cueFreeAccuracy: newCueFreeAccuracy,
            cueAssistedAccuracy: newCueAssistedAccuracy,
            exposureCount: mastery.exposureCount + 1,
            fsrsLastReview: now,
            nextReview: fsrs.nextReviewDate(updatedCard),
            fsrsReps: updatedCard.reps,
            fsrsLapses: updatedCard.lapses,
          },
        });
      }

      // Update user theta if we have enough responses
      const recentResponses = await prisma.response.findMany({
        where: { session: { goalId: (await prisma.session.findUnique({ where: { id: sessionId } }))?.goalId } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { object: true },
      });

      if (recentResponses.length >= 10) {
        // Build IRT item parameters and response array for theta estimation
        const items = recentResponses.map((r: { object: { irtDifficulty: number; irtDiscrimination?: number | null } }) => ({
          id: r.object.irtDifficulty.toString(),
          a: r.object.irtDiscrimination ?? 1.0, // discrimination parameter
          b: r.object.irtDifficulty, // difficulty parameter
        }));
        const responseArray = recentResponses.map((r: { correct: boolean }) => r.correct);

        // Global theta estimate
        const estimate = estimateThetaMLE(responseArray, items);

        // Component-specific theta updates (P1: per-component theta estimation)
        type ComponentKey = 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';
        const componentMapping: Record<ComponentKey, keyof typeof componentThetas> = {
          PHON: 'thetaPhonology',
          MORPH: 'thetaMorphology',
          LEX: 'thetaLexical',
          SYNT: 'thetaSyntactic',
          PRAG: 'thetaPragmatic',
        };

        // Group responses by component type
        const responsesByComponent = new Map<ComponentKey, { items: typeof items; responses: boolean[] }>();
        for (let i = 0; i < recentResponses.length; i++) {
          const r = recentResponses[i];
          const componentType = (r.object.type || 'LEX').toUpperCase() as ComponentKey;
          const validComponent = componentMapping[componentType] ? componentType : 'LEX';

          if (!responsesByComponent.has(validComponent)) {
            responsesByComponent.set(validComponent, { items: [], responses: [] });
          }
          const componentData = responsesByComponent.get(validComponent)!;
          componentData.items.push(items[i]);
          componentData.responses.push(responseArray[i]);
        }

        // Calculate component-specific theta values
        const componentThetas: Record<string, number> = {};
        for (const [component, data] of responsesByComponent) {
          if (data.items.length >= 5) { // Minimum 5 responses for component estimation
            const componentEstimate = estimateThetaMLE(data.responses, data.items);
            const fieldName = componentMapping[component];
            if (fieldName) {
              componentThetas[fieldName] = componentEstimate.theta;
            }
          }
        }

        await prisma.user.updateMany({
          data: {
            thetaGlobal: estimate.theta,
            ...componentThetas,
          },
        });
      }

      // Track stage transitions in session
      if (stageChanged) {
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            stageTransitions: { increment: 1 },
            itemsPracticed: { increment: 1 },
          },
        });
      } else {
        await prisma.session.update({
          where: { id: sessionId },
          data: { itemsPracticed: { increment: 1 } },
        });
      }

      // Recalculate priority for the language object
      const languageObject = await prisma.languageObject.findUnique({
        where: { id: objectId },
      });

      if (languageObject) {
        // Get user state for priority calculation
        const user = await prisma.user.findFirst();
        const userTheta = user?.thetaGlobal ?? 0;

        const userState = {
          theta: userTheta,
          weights: DEFAULT_PRIORITY_WEIGHTS,
        };

        const langObj = {
          id: languageObject.id,
          content: languageObject.content,
          type: languageObject.type,
          frequency: languageObject.frequency,
          relationalDensity: languageObject.relationalDensity,
          contextualContribution: languageObject.contextualContribution,
          irtDifficulty: languageObject.irtDifficulty,
        };

        // Compute new priority with urgency factored in
        const basePriority = computePriority(langObj, userState);
        const urgency = computeUrgency(mastery.nextReview, now);
        const finalPriority = basePriority * (1 + urgency);

        await prisma.languageObject.update({
          where: { id: objectId },
          data: { priority: finalPriority },
        });
      }

      // Update ComponentErrorStats for bottleneck tracking (if error occurred)
      if (!correct && languageObject) {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { userId: true, goalId: true },
        });

        if (session) {
          // Map language object type to component type
          const componentType = languageObject.type as ComponentType;

          // Upsert error stats
          await prisma.componentErrorStats.upsert({
            where: {
              userId_component_goalId: {
                userId: session.userId,
                component: componentType,
                goalId: session.goalId,
              },
            },
            create: {
              userId: session.userId,
              component: componentType,
              goalId: session.goalId,
              totalErrors: 1,
              recentErrors: 1,
              errorRate: 1.0,
              trend: 0,
            },
            update: {
              totalErrors: { increment: 1 },
              recentErrors: { increment: 1 },
            },
          });
        }
      }

      return success({
        responseId: response.id,
        mastery: {
          stage: mastery.stage,
          stability: mastery.fsrsStability,
          nextReview: mastery.nextReview,
          cueFreeAccuracy: mastery.cueFreeAccuracy,
        },
        stageChanged,
        oldStage,
        newStage,
        fsrsRating: timingAwareRating,
        timing: {
          classification: timingAnalysis.classification,
          normalizedTime: timingAnalysis.normalizedTime,
          isAutomatic: timingAnalysis.isAutomatic,
          possibleGuessing: timingAnalysis.possibleGuessing,
        },
      });
    } catch (err) {
      console.error('Failed to record response:', err);
      return error('Failed to record response');
    }
  });

  // List sessions
  registerHandler('session:list', async (_event, request) => {
    const { goalId, limit, offset } = request as {
      goalId: string;
      limit?: number;
      offset?: number;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    try {
      const sessions = await prisma.session.findMany({
        where: { goalId },
        include: {
          _count: { select: { responses: true } },
          responses: {
            select: { correct: true },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit || 20,
        skip: offset || 0,
      });

      return success(sessions.map(s => {
        const correct = s.responses.filter(r => r.correct).length;
        const total = s.responses.length;
        return {
          id: s.id,
          mode: s.mode,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationMinutes: s.endedAt
            ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000 / 60 * 10) / 10
            : 0,
          itemsPracticed: s.itemsPracticed,
          stageTransitions: s.stageTransitions,
          responseCount: total,
          accuracy: total > 0 ? correct / total : 0,
        };
      }));
    } catch (err) {
      console.error('Failed to list sessions:', err);
      return error('Failed to list sessions');
    }
  });

  // Get next task
  registerHandler('session:get-next-task', async (_event, request) => {
    const { sessionId } = request as { sessionId: string };

    const idError = validateUUID(sessionId, 'sessionId');
    if (idError) return error(idError);

    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { goalId: true },
      });

      if (!session) {
        return error('Session not found');
      }

      // Get next item based on priority and due date
      const nextItem = await prisma.languageObject.findFirst({
        where: { goalId: session.goalId },
        include: { masteryState: true },
        orderBy: [
          { priority: 'desc' },
        ],
      });

      if (!nextItem) {
        return success(null);
      }

      return success({
        objectId: nextItem.id,
        content: nextItem.content,
        type: nextItem.type,
        masteryStage: nextItem.masteryState?.stage ?? 0,
        difficulty: nextItem.irtDifficulty,
      });
    } catch (err) {
      console.error('Failed to get next task:', err);
      return error('Failed to get next task');
    }
  });

  // Get session summary
  registerHandler('session:get-summary', async (_event, request) => {
    const { sessionId } = request as { sessionId: string };

    const idError = validateUUID(sessionId, 'sessionId');
    if (idError) return error(idError);

    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          responses: {
            include: { object: true },
          },
        },
      });

      if (!session) {
        return error('Session not found');
      }

      const totalResponses = session.responses.length;
      const correctResponses = session.responses.filter(r => r.correct).length;
      const cueFreeResponses = session.responses.filter(r => r.cueLevel === 0);
      const cueFreeCorrect = cueFreeResponses.filter(r => r.correct).length;

      const duration = session.endedAt
        ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000 / 60
        : (new Date().getTime() - session.startedAt.getTime()) / 1000 / 60;

      return success({
        sessionId: session.id,
        mode: session.mode,
        durationMinutes: Math.round(duration * 10) / 10,
        itemsPracticed: session.itemsPracticed,
        stageTransitions: session.stageTransitions,
        totalResponses,
        correctResponses,
        accuracy: totalResponses > 0 ? correctResponses / totalResponses : 0,
        cueFreeAccuracy: cueFreeResponses.length > 0 ? cueFreeCorrect / cueFreeResponses.length : 0,
      });
    } catch (err) {
      console.error('Failed to get session summary:', err);
      return error('Failed to get session summary');
    }
  });

  // Get progress analytics
  registerHandler('analytics:get-progress', async (_event, request) => {
    const { goalId, timeRange } = request as {
      goalId: string;
      timeRange?: 'day' | 'week' | 'month' | 'all';
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    try {
      const now = new Date();
      let startDate: Date | undefined;

      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const whereClause = {
        session: { goalId },
        ...(startDate ? { createdAt: { gte: startDate } } : {}),
      };

      const responses = await prisma.response.findMany({
        where: whereClause,
        include: { object: true },
      });

      const objects = await prisma.languageObject.findMany({
        where: { goalId },
        include: { masteryState: true },
      });

      // Calculate stats
      const totalResponses = responses.length;
      const correctResponses = responses.filter(r => r.correct).length;
      const cueFreeResponses = responses.filter(r => r.cueLevel === 0);
      const cueFreeCorrect = cueFreeResponses.filter(r => r.correct).length;

      const stageDistribution = [0, 0, 0, 0, 0];
      for (const obj of objects) {
        const stage = obj.masteryState?.stage ?? 0;
        stageDistribution[stage]++;
      }

      return success({
        totalObjects: objects.length,
        totalResponses,
        accuracy: totalResponses > 0 ? correctResponses / totalResponses : 0,
        cueFreeAccuracy: cueFreeResponses.length > 0 ? cueFreeCorrect / cueFreeResponses.length : 0,
        stageDistribution,
        masteredCount: stageDistribution[3] + stageDistribution[4],
        learningCount: stageDistribution[1] + stageDistribution[2],
        newCount: stageDistribution[0],
      });
    } catch (err) {
      console.error('Failed to get progress:', err);
      return error('Failed to get progress analytics');
    }
  });

  // Get bottleneck analysis
  registerHandler('analytics:get-bottlenecks', async (_event, request) => {
    const { goalId, minResponses } = request as {
      goalId: string;
      minResponses?: number;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    try {
      // Fetch responses with their related LanguageObject to get component type
      const responses = await prisma.response.findMany({
        where: {
          session: { goalId },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          object: {
            select: { type: true, content: true },
          },
        },
      });

      // Convert to bottleneck response format using LanguageObject.type as component
      const bottleneckResponses: BottleneckResponseData[] = responses.map(r => ({
        id: r.id,
        correct: r.correct,
        componentType: (r.object.type || 'LEX') as ComponentType,
        sessionId: r.sessionId,
        content: r.object.content,
        timestamp: r.createdAt,
      }));

      const analysis = analyzeBottleneck(bottleneckResponses, {
        minResponses: minResponses ?? 10,
        minResponsesPerType: 5,
        errorRateThreshold: 0.3,
        cascadeConfidenceThreshold: 0.7,
      });

      return success(analysis);
    } catch (err) {
      console.error('Failed to get bottlenecks:', err);
      return error('Failed to analyze bottlenecks');
    }
  });

  // Get session stats (analytics:get-history)
  registerHandler('analytics:get-history', async (_event, request) => {
    const { goalId, days } = request as {
      goalId: string;
      days?: number;
    };

    const goalError = validateUUID(goalId, 'goalId');
    if (goalError) return error(goalError);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days || 30));

      const sessions = await prisma.session.findMany({
        where: {
          goalId,
          startedAt: { gte: startDate },
          endedAt: { not: null },
        },
        include: {
          responses: { select: { correct: true, responseTimeMs: true } },
        },
      });

      const totalSessions = sessions.length;
      const totalTime = sessions.reduce((sum, s) => {
        if (!s.endedAt) return sum;
        return sum + (s.endedAt.getTime() - s.startedAt.getTime()) / 1000 / 60;
      }, 0);
      const avgSessionLength = totalSessions > 0 ? totalTime / totalSessions : 0;

      const allResponses = sessions.flatMap(s => s.responses);
      const avgResponseTime = allResponses.length > 0
        ? allResponses.reduce((sum, r) => sum + r.responseTimeMs, 0) / allResponses.length
        : 0;

      // Calculate streak
      const sessionDates = sessions
        .map(s => s.startedAt.toISOString().split('T')[0])
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort()
        .reverse();

      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      for (let i = 0; i < sessionDates.length; i++) {
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        if (sessionDates[i] === expectedDate.toISOString().split('T')[0]) {
          streak++;
        } else {
          break;
        }
      }

      return success({
        totalSessions,
        totalTimeMinutes: Math.round(totalTime),
        avgSessionLengthMinutes: Math.round(avgSessionLength * 10) / 10,
        avgResponseTimeMs: Math.round(avgResponseTime),
        currentStreak: streak,
        responsesPerSession: totalSessions > 0 ? Math.round(allResponses.length / totalSessions) : 0,
      });
    } catch (err) {
      console.error('Failed to get session stats:', err);
      return error('Failed to get session stats');
    }
  });
}

// =============================================================================
// IRT Calibration Helper
// =============================================================================

/**
 * Run IRT item parameter calibration based on accumulated response data.
 *
 * Uses the EM algorithm (Joint Maximum Likelihood via calibrateItems) to
 * estimate item difficulty (b) and discrimination (a) parameters from
 * the response matrix.
 *
 * Academic reference: Baker & Kim (2004) "Item Response Theory: Parameter
 * Estimation Techniques"
 *
 * @param goalId - The learning goal to calibrate items for
 * @returns Calibration result with number of items updated
 */
async function runIRTCalibration(goalId: string): Promise<{
  calibrated: boolean;
  itemsUpdated: number;
  reason?: string;
}> {
  // Get all responses for this goal, grouped by item
  const responses = await prisma.response.findMany({
    where: {
      session: { goalId },
    },
    select: {
      objectId: true,
      correct: true,
      sessionId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (responses.length < IRT_CALIBRATION_CONFIG.minResponsesPerItem * IRT_CALIBRATION_CONFIG.minItems) {
    return {
      calibrated: false,
      itemsUpdated: 0,
      reason: 'Insufficient total responses for calibration',
    };
  }

  // Build response matrix: rows = sessions (as proxy for persons), cols = items
  const sessionIds = [...new Set(responses.map(r => r.sessionId))];
  const objectIds = [...new Set(responses.map(r => r.objectId))];

  if (sessionIds.length < IRT_CALIBRATION_CONFIG.minRespondents) {
    return {
      calibrated: false,
      itemsUpdated: 0,
      reason: `Need at least ${IRT_CALIBRATION_CONFIG.minRespondents} sessions for calibration`,
    };
  }

  if (objectIds.length < IRT_CALIBRATION_CONFIG.minItems) {
    return {
      calibrated: false,
      itemsUpdated: 0,
      reason: `Need at least ${IRT_CALIBRATION_CONFIG.minItems} items for calibration`,
    };
  }

  // Count responses per item to filter out items with insufficient data
  const responsesPerItem = new Map<string, number>();
  for (const r of responses) {
    responsesPerItem.set(r.objectId, (responsesPerItem.get(r.objectId) ?? 0) + 1);
  }

  // Filter items with minimum responses
  const calibratableItems = objectIds.filter(
    id => (responsesPerItem.get(id) ?? 0) >= IRT_CALIBRATION_CONFIG.minResponsesPerItem
  );

  if (calibratableItems.length < IRT_CALIBRATION_CONFIG.minItems) {
    return {
      calibrated: false,
      itemsUpdated: 0,
      reason: `Only ${calibratableItems.length} items have sufficient responses`,
    };
  }

  // Create item index map
  const itemIndex = new Map<string, number>();
  calibratableItems.forEach((id, idx) => itemIndex.set(id, idx));

  // Build response matrix
  // For sessions with multiple responses to same item, use last response
  const responseMap = new Map<string, Map<string, boolean>>();
  for (const r of responses) {
    if (!itemIndex.has(r.objectId)) continue;

    if (!responseMap.has(r.sessionId)) {
      responseMap.set(r.sessionId, new Map());
    }
    responseMap.get(r.sessionId)!.set(r.objectId, r.correct);
  }

  // Convert to matrix format (sessions x items)
  // Fill missing values with null (will need to handle)
  const responseMatrix: boolean[][] = [];

  for (const sessionId of sessionIds) {
    const sessionResponses = responseMap.get(sessionId);
    if (!sessionResponses) continue;

    // Only include sessions that have responses to at least half the items
    const responseCount = calibratableItems.filter(id => sessionResponses.has(id)).length;
    if (responseCount < calibratableItems.length * 0.3) continue;

    const row: boolean[] = calibratableItems.map(itemId =>
      sessionResponses.get(itemId) ?? false // Missing treated as incorrect
    );
    responseMatrix.push(row);
  }

  if (responseMatrix.length < IRT_CALIBRATION_CONFIG.minRespondents) {
    return {
      calibrated: false,
      itemsUpdated: 0,
      reason: 'Not enough complete response patterns for calibration',
    };
  }

  // Run calibration
  const calibrated = calibrateItems(responseMatrix, IRT_CALIBRATION_CONFIG.maxIterations);

  // Update item parameters in database
  let itemsUpdated = 0;

  for (let i = 0; i < calibratableItems.length; i++) {
    const itemId = calibratableItems[i];
    const params = calibrated[i];

    if (!params || !isFinite(params.a) || !isFinite(params.b)) {
      continue;
    }

    // Only update if standard errors are reasonable (not Infinity)
    if (params.se_a > 1.0 || params.se_b > 1.0) {
      continue;
    }

    try {
      await prisma.languageObject.update({
        where: { id: itemId },
        data: {
          irtDifficulty: params.b,
          irtDiscrimination: params.a,
        },
      });
      itemsUpdated++;
    } catch {
      // Item may have been deleted, skip
    }
  }

  return {
    calibrated: itemsUpdated > 0,
    itemsUpdated,
  };
}

export function unregisterSessionHandlers(): void {
  const { unregisterHandler } = require('./contracts') as { unregisterHandler: (channel: string) => void };
  const channels = [
    'session:start',
    'session:end',
    'session:get-state',
    'session:get-next-task',
    'session:get-summary',
    'session:submit-response',
    'session:list',
    'analytics:get-progress',
    'analytics:get-bottlenecks',
    'analytics:get-history',
  ];
  channels.forEach(unregisterHandler);
}
