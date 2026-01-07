/**
 * SessionPage
 *
 * Training Gym page that manages complete learning sessions with:
 * - Session initialization via IPC
 * - Real task rendering (MCQ, fill-in-blank, free response)
 * - Progress tracking and feedback display
 * - Session summary on completion
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context';
import { useQueue, useStartSession, useEndSession, useAnalyzeError, useGetHint } from '../hooks';
import { SessionView } from '../components/session';
import { GlassCard, GlassButton, GlassProgress, CircularProgress } from '../components/ui';

// Get the LOGOS API from window (exposed by preload)
const logos = typeof window !== 'undefined' ? (window as any).logos : null;

interface SessionPageProps {
  onNavigateBack?: () => void;
}

// Task format types for the Training Gym
// Extended to support multi-component learning (MORPH, G2P, SYNT, PRAG)
type TaskFormat = 'mcq' | 'fill_blank' | 'free_response' | 'typing' | 'morpheme_analysis' | 'pronunciation' | 'sentence_completion' | 'register_selection';

// Language object types from corpus pipeline
type ObjectType = 'LEX' | 'MORPH' | 'G2P' | 'SYNT' | 'PRAG';

interface SessionTask {
  id: string;
  objectId: string;
  content: string;
  type: string;
  objectType?: ObjectType;  // Multi-component object type
  format: TaskFormat;
  prompt: string;
  expectedAnswer: string;
  options?: string[];  // For MCQ
  blankTemplate?: string;  // For fill-in-blank
  hints?: string[];
  masteryStage: 0 | 1 | 2 | 3 | 4;
  difficulty: number;
  metadata?: Record<string, any>;  // Additional metadata for specialized tasks
}

interface SessionSummary {
  totalItems: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
  cueFreeAccuracy: number;
  averageResponseTime: number;
  totalTimeMs: number;
  stageTransitions: { up: number; down: number };
  itemsReviewed: Array<{
    id: string;
    content: string;
    correct: boolean;
    cueLevel: number;
  }>;
}

export const SessionPage: React.FC<SessionPageProps> = ({ onNavigateBack }) => {
  const { activeGoal, activeGoalId } = useApp();
  const { data: queue, loading: queueLoading, refetch: refreshQueue } = useQueue(activeGoalId, { sessionSize: 20 });
  const { execute: startSessionApi } = useStartSession();
  const { execute: endSessionApi } = useEndSession();
  const { analyze: analyzeError } = useAnalyzeError();
  const { getHint } = useGetHint();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionPhase, setSessionPhase] = useState<'idle' | 'starting' | 'active' | 'complete'>('idle');
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [responses, setResponses] = useState<Array<{
    taskId: string;
    objectId: string;
    correct: boolean;
    userAnswer: string;
    expectedAnswer: string;
    cueLevel: 0 | 1 | 2 | 3;
    responseTimeMs: number;
    errorAnalysis?: any;
  }>>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer effect
  useEffect(() => {
    if (sessionPhase !== 'active') return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - sessionStartTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionPhase, sessionStartTime]);

  // Transform queue items into session tasks
  // Uses server-generated task specs when available, falls back to local generation
  // Now supports multi-component object types: LEX, MORPH, G2P, SYNT, PRAG
  const transformQueueToTasks = useCallback((queueItems: any[]): SessionTask[] => {
    return queueItems.map((item, index) => {
      const masteryStage = item.masteryStage ?? 0;
      const content = item.object?.content ?? item.content;
      const type = item.object?.type ?? item.type ?? 'LEX';
      const objectType = type as ObjectType;
      const metadata = item.object?.metadata ? JSON.parse(item.object.metadata) : {};

      // Use server-generated task if available
      if (item.task) {
        const serverTask = item.task;
        return {
          id: `task-${index}-${item.object?.id ?? item.id}`,
          objectId: item.object?.id ?? item.id,
          content,
          type,
          objectType,
          format: serverTask.format as TaskFormat,
          prompt: serverTask.prompt,
          expectedAnswer: serverTask.expectedAnswer ?? content,
          options: serverTask.options,
          blankTemplate: serverTask.format === 'fill_blank' ? createBlankTemplate(content) : undefined,
          hints: serverTask.hints ?? [],
          masteryStage: masteryStage as 0 | 1 | 2 | 3 | 4,
          difficulty: serverTask.difficulty ?? 0.5,
          metadata,
        };
      }

      // Fallback: generate task locally based on object type
      const difficulty = item.object?.difficulty ?? item.difficulty ?? 0.5;
      let format: TaskFormat = 'free_response';
      let options: string[] | undefined;
      let blankTemplate: string | undefined;
      let prompt: string;

      // Generate format and prompt based on object type
      switch (objectType) {
        case 'MORPH':
          // Morphological analysis tasks
          if (masteryStage <= 1) {
            format = 'mcq';
            options = generateMorphDistractors(content, metadata, queueItems);
            prompt = createMorphPrompt(content, metadata, format);
          } else {
            format = 'morpheme_analysis';
            prompt = createMorphPrompt(content, metadata, format);
          }
          break;

        case 'G2P':
          // Pronunciation/spelling tasks
          if (masteryStage <= 1) {
            format = 'mcq';
            options = generateG2PDistractors(content, metadata, queueItems);
            prompt = createG2PPrompt(content, metadata, format);
          } else {
            format = 'pronunciation';
            prompt = createG2PPrompt(content, metadata, format);
          }
          break;

        case 'SYNT':
          // Syntactic/grammar tasks
          if (masteryStage <= 1) {
            format = 'mcq';
            options = generateSyntDistractors(content, metadata, queueItems);
            prompt = createSyntPrompt(content, metadata, format);
          } else {
            format = 'sentence_completion';
            blankTemplate = createSentenceBlank(content);
            prompt = createSyntPrompt(content, metadata, format);
          }
          break;

        case 'PRAG':
          // Pragmatic/register tasks
          if (masteryStage <= 2) {
            format = 'mcq';
            options = generatePragDistractors(content, metadata, queueItems);
            prompt = createPragPrompt(content, metadata, format);
          } else {
            format = 'register_selection';
            prompt = createPragPrompt(content, metadata, format);
          }
          break;

        case 'LEX':
        default:
          // Lexical/vocabulary tasks (original behavior)
          if (masteryStage === 0 || masteryStage === 1) {
            format = 'mcq';
            options = generateDistractors(content, queueItems.map(q => q.object?.content ?? q.content));
          } else if (masteryStage === 2) {
            format = 'fill_blank';
            blankTemplate = createBlankTemplate(content);
          } else {
            format = 'free_response';
          }
          prompt = createPrompt(content, type, format);
          break;
      }

      return {
        id: `task-${index}-${item.object?.id ?? item.id}`,
        objectId: item.object?.id ?? item.id,
        content,
        type,
        objectType,
        format,
        prompt,
        expectedAnswer: getExpectedAnswer(content, objectType, metadata),
        options,
        blankTemplate,
        hints: [],
        masteryStage: masteryStage as 0 | 1 | 2 | 3 | 4,
        difficulty,
        metadata,
      };
    });
  }, []);

  // Start session handler
  const handleStartSession = useCallback(async () => {
    if (!activeGoalId || !queue || queue.length === 0) return;

    setSessionPhase('starting');

    try {
      const result = await startSessionApi({ goalId: activeGoalId, type: 'mixed' });
      setSessionId(result?.sessionId ?? result?.id ?? null);

      const sessionTasks = transformQueueToTasks(queue);
      setTasks(sessionTasks);
      setCurrentTaskIndex(0);
      setResponses([]);
      setSessionStartTime(Date.now());
      setElapsedTime(0);
      setSessionPhase('active');
    } catch (error) {
      console.error('Failed to start session:', error);
      setSessionPhase('idle');
    }
  }, [activeGoalId, queue, startSessionApi, transformQueueToTasks]);

  // Submit response handler
  const handleSubmitResponse = useCallback(async (
    answer: string,
    cueLevel: 0 | 1 | 2 | 3,
    responseTimeMs: number
  ) => {
    const currentTask = tasks[currentTaskIndex];
    if (!currentTask || !sessionId) return;

    // Check correctness (case-insensitive, trimmed)
    const normalizedAnswer = answer.trim().toLowerCase();
    const normalizedExpected = currentTask.expectedAnswer.trim().toLowerCase();
    const correct = normalizedAnswer === normalizedExpected;

    // Record response via IPC
    try {
      await logos?.session.recordResponse({
        sessionId,
        objectId: currentTask.objectId,
        correct,
        cueLevel,
        responseTimeMs,
        taskType: 'recall',
        taskFormat: currentTask.format,
        modality: 'visual',
        responseContent: answer,
        expectedContent: currentTask.expectedAnswer,
      });
    } catch (error) {
      console.error('Failed to record response:', error);
    }

    // Get error analysis for incorrect answers
    let errorAnalysis;
    if (!correct && answer.trim()) {
      try {
        errorAnalysis = await analyzeError(
          currentTask.objectId,
          answer,
          currentTask.expectedAnswer
        );
      } catch (error) {
        console.error('Failed to analyze error:', error);
      }
    }

    // Store response
    const newResponse = {
      taskId: currentTask.id,
      objectId: currentTask.objectId,
      correct,
      userAnswer: answer,
      expectedAnswer: currentTask.expectedAnswer,
      cueLevel,
      responseTimeMs,
      errorAnalysis,
    };

    setResponses(prev => [...prev, newResponse]);

    return { correct, errorAnalysis };
  }, [tasks, currentTaskIndex, sessionId, analyzeError]);

  // Move to next task
  const handleNextTask = useCallback(() => {
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      // Session complete - calculate summary
      handleCompleteSession();
    }
  }, [currentTaskIndex, tasks.length]);

  // Complete session
  const handleCompleteSession = useCallback(async () => {
    const totalTimeMs = Date.now() - sessionStartTime;
    const correctCount = responses.filter(r => r.correct).length;
    const incorrectCount = responses.filter(r => !r.correct && r.userAnswer.trim()).length;
    const skippedCount = responses.filter(r => !r.userAnswer.trim()).length;
    const cueFreeResponses = responses.filter(r => r.cueLevel === 0);
    const cueFreeCorrect = cueFreeResponses.filter(r => r.correct).length;
    const totalResponseTime = responses.reduce((sum, r) => sum + r.responseTimeMs, 0);

    const summary: SessionSummary = {
      totalItems: responses.length,
      correctCount,
      incorrectCount,
      skippedCount,
      accuracy: responses.length > 0 ? correctCount / responses.length : 0,
      cueFreeAccuracy: cueFreeResponses.length > 0 ? cueFreeCorrect / cueFreeResponses.length : 0,
      averageResponseTime: responses.length > 0 ? totalResponseTime / responses.length : 0,
      totalTimeMs,
      stageTransitions: { up: 0, down: 0 },  // Would be calculated from mastery changes
      itemsReviewed: responses.map(r => ({
        id: r.objectId,
        content: tasks.find(t => t.objectId === r.objectId)?.content ?? '',
        correct: r.correct,
        cueLevel: r.cueLevel,
      })),
    };

    setSessionSummary(summary);
    setSessionPhase('complete');

    // End session via IPC
    if (sessionId) {
      try {
        await endSessionApi({ sessionId });
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  }, [sessionStartTime, responses, tasks, sessionId, endSessionApi]);

  // Get hint handler
  const handleGetHint = useCallback(async (level: number): Promise<string> => {
    const currentTask = tasks[currentTaskIndex];
    if (!currentTask) return '';

    try {
      const result = await getHint(
        currentTask.objectId,
        level as 1 | 2 | 3,
        currentTask.hints
      );

      const hint = result?.hint ?? generateLocalHint(currentTask, level);

      // Update task hints
      setTasks(prev => prev.map((t, i) =>
        i === currentTaskIndex
          ? { ...t, hints: [...(t.hints || []), hint] }
          : t
      ));

      return hint;
    } catch (error) {
      console.error('Failed to get hint:', error);
      return generateLocalHint(currentTask, level);
    }
  }, [tasks, currentTaskIndex, getHint]);

  // Reset and start new session
  const handleNewSession = useCallback(() => {
    setSessionPhase('idle');
    setSessionId(null);
    setTasks([]);
    setCurrentTaskIndex(0);
    setResponses([]);
    setSessionSummary(null);
    setElapsedTime(0);
    refreshQueue();
  }, [refreshQueue]);

  // No goal selected
  if (!activeGoal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <GlassCard className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold mb-2">No Goal Selected</h1>
          <p className="text-muted mb-6">Please select a learning goal to start training.</p>
          {onNavigateBack && (
            <GlassButton variant="ghost" onClick={onNavigateBack}>
              Back to Dashboard
            </GlassButton>
          )}
        </GlassCard>
      </div>
    );
  }

  // Loading queue
  if (queueLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <GlassCard className="p-8 text-center">
          <div className="animate-pulse mb-4">
            <CircularProgress value={0} size={80} variant="primary" showLabel={false}>
              <span className="text-2xl">📚</span>
            </CircularProgress>
          </div>
          <p className="text-muted">Preparing your training session...</p>
        </GlassCard>
      </div>
    );
  }

  // Empty queue
  if (!queue || queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <GlassCard className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">✨</div>
          <h1 className="text-2xl font-bold mb-2">All Caught Up!</h1>
          <p className="text-muted mb-6">
            You've reviewed all items due for now. Add more content or check back later.
          </p>
          <div className="flex gap-3 justify-center">
            {onNavigateBack && (
              <GlassButton variant="ghost" onClick={onNavigateBack}>
                Dashboard
              </GlassButton>
            )}
            <GlassButton variant="primary" onClick={() => refreshQueue()}>
              Refresh Queue
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Session complete - show summary
  if (sessionPhase === 'complete' && sessionSummary) {
    return (
      <SessionSummaryView
        summary={sessionSummary}
        goalName={activeGoal.name}
        onNewSession={handleNewSession}
        onNavigateBack={onNavigateBack}
      />
    );
  }

  // Pre-session screen (idle)
  if (sessionPhase === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <GlassCard className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🏋️</div>
          <h1 className="text-2xl font-bold mb-2">Training Gym</h1>
          <p className="text-muted mb-2">{activeGoal.name}</p>
          <p className="text-lg font-medium mb-6">{queue.length} items ready to practice</p>

          <div className="mb-6 p-4 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/50">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg">{queue.filter((q: any) => (q.masteryStage ?? 0) === 0).length}</div>
                <div className="text-muted">New</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{queue.filter((q: any) => (q.masteryStage ?? 0) > 0 && (q.masteryStage ?? 0) < 3).length}</div>
                <div className="text-muted">Learning</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{queue.filter((q: any) => (q.masteryStage ?? 0) >= 3).length}</div>
                <div className="text-muted">Review</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            {onNavigateBack && (
              <GlassButton variant="ghost" onClick={onNavigateBack}>
                Back
              </GlassButton>
            )}
            <GlassButton
              variant="primary"
              size="lg"
              onClick={handleStartSession}
              disabled={sessionPhase === 'starting'}
            >
              {sessionPhase === 'starting' ? 'Starting...' : 'Start Training'}
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Active session
  const currentTask = tasks[currentTaskIndex];

  return (
    <div className="training-gym h-full flex flex-col">
      {/* Progress header */}
      <div className="training-header p-4 border-b border-neutral-200/50 dark:border-neutral-700/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted">{activeGoal.name}</div>
          <div className="text-sm text-muted">
            {formatDuration(elapsedTime)}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <GlassProgress
              value={(currentTaskIndex + 1) / tasks.length * 100}
              variant="primary"
              size="md"
            />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">
            {currentTaskIndex + 1} / {tasks.length}
          </span>
        </div>
      </div>

      {/* Task content */}
      <div className="flex-1 overflow-auto p-6">
        {currentTask && (
          <SessionView
            task={currentTask}
            taskIndex={currentTaskIndex}
            totalTasks={tasks.length}
            onSubmit={handleSubmitResponse}
            onNext={handleNextTask}
            onGetHint={handleGetHint}
            onExit={() => {
              handleCompleteSession();
            }}
          />
        )}
      </div>
    </div>
  );
};

// Session Summary Component
const SessionSummaryView: React.FC<{
  summary: SessionSummary;
  goalName: string;
  onNewSession: () => void;
  onNavigateBack?: () => void;
}> = ({ summary, goalName, onNewSession, onNavigateBack }) => {
  const accuracyPercent = Math.round(summary.accuracy * 100);
  const grade = getGrade(summary.accuracy);

  return (
    <div className="session-summary min-h-full flex items-center justify-center p-6">
      <GlassCard className="max-w-lg w-full p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">{grade.emoji}</div>
          <h1 className="text-2xl font-bold mb-2">Session Complete!</h1>
          <p className="text-muted">{goalName}</p>
        </div>

        {/* Main stats */}
        <div className="flex justify-center mb-6">
          <CircularProgress
            value={accuracyPercent}
            size={140}
            strokeWidth={12}
            variant={grade.variant}
          >
            <div className="text-center">
              <div className="text-3xl font-bold">{accuracyPercent}%</div>
              <div className="text-sm text-muted">{grade.label}</div>
            </div>
          </CircularProgress>
        </div>

        {/* Detail stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="stat-card p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600">{summary.correctCount}</div>
            <div className="text-sm text-green-600/80">Correct</div>
          </div>
          <div className="stat-card p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
            <div className="text-2xl font-bold text-red-600">{summary.incorrectCount}</div>
            <div className="text-sm text-red-600/80">Incorrect</div>
          </div>
          <div className="stat-card p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <div className="text-2xl font-bold text-blue-600">
              {(summary.averageResponseTime / 1000).toFixed(1)}s
            </div>
            <div className="text-sm text-blue-600/80">Avg. Response</div>
          </div>
          <div className="stat-card p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20">
            <div className="text-2xl font-bold text-purple-600">
              {formatDuration(summary.totalTimeMs)}
            </div>
            <div className="text-sm text-purple-600/80">Total Time</div>
          </div>
        </div>

        {/* Cue-free accuracy */}
        <div className="mb-6 p-4 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">Cue-Free Accuracy</span>
            <span className="font-semibold">{Math.round(summary.cueFreeAccuracy * 100)}%</span>
          </div>
          <GlassProgress
            value={summary.cueFreeAccuracy * 100}
            variant="success"
            size="sm"
            className="mt-2"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {onNavigateBack && (
            <GlassButton variant="ghost" onClick={onNavigateBack}>
              Dashboard
            </GlassButton>
          )}
          <GlassButton variant="primary" size="lg" onClick={onNewSession}>
            Train Again
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};

// Helper functions
function generateDistractors(correct: string, allOptions: string[]): string[] {
  const distractors = allOptions
    .filter(opt => opt && opt.toLowerCase() !== correct.toLowerCase())
    .slice(0, 3);

  // Ensure we have at least 3 distractors
  while (distractors.length < 3) {
    distractors.push(`Option ${distractors.length + 1}`);
  }

  // Shuffle correct answer with distractors
  const options = [correct, ...distractors];
  return shuffleArray(options);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createBlankTemplate(content: string): string {
  // For simple words, replace middle characters with underscores
  if (content.length <= 3) {
    return '_'.repeat(content.length);
  }

  const firstChar = content[0];
  const lastChar = content[content.length - 1];
  const middleLength = content.length - 2;

  return firstChar + '_'.repeat(middleLength) + lastChar;
}

function createPrompt(content: string, type: string, format: TaskFormat): string {
  switch (format) {
    case 'mcq':
      return `Select the correct answer:`;
    case 'fill_blank':
      return `Complete the word:`;
    case 'free_response':
      return `Type the word:`;
    default:
      return `What is this ${type}?`;
  }
}

function generateLocalHint(task: SessionTask, level: number): string {
  const { content, type } = task;

  switch (level) {
    case 1:
      return `This is a ${type}. It starts with "${content[0]}".`;
    case 2:
      return `The word has ${content.length} characters.`;
    case 3:
      return `The answer is: ${content.substring(0, Math.ceil(content.length / 2))}...`;
    default:
      return `Think about the meaning...`;
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getGrade(accuracy: number): { label: string; variant: 'success' | 'primary' | 'warning' | 'danger'; emoji: string } {
  if (accuracy >= 0.9) return { label: 'Excellent!', variant: 'success', emoji: '🌟' };
  if (accuracy >= 0.75) return { label: 'Great!', variant: 'primary', emoji: '🎉' };
  if (accuracy >= 0.6) return { label: 'Good', variant: 'warning', emoji: '👍' };
  return { label: 'Keep practicing', variant: 'danger', emoji: '💪' };
}

// =============================================================================
// Multi-Component Task Generation Helpers
// Reference: Bauer & Nation (1993), Lu L2SCA (2010), Taguchi (2015)
// =============================================================================

/**
 * Generate morphological task prompt based on format.
 * Reference: Bauer & Nation (1993) - affix productivity levels
 */
function createMorphPrompt(content: string, metadata: any, format: TaskFormat): string {
  const baseWord = metadata?.baseWord || content.split(' = ')[0];
  const root = metadata?.root || baseWord;

  switch (format) {
    case 'mcq':
      return `What is the root/base form of "${baseWord}"?`;
    case 'morpheme_analysis':
      return `Break down "${baseWord}" into its morphemes (prefix + root + suffix):`;
    default:
      return `Analyze the word structure: ${baseWord}`;
  }
}

/**
 * Generate G2P/pronunciation task prompt.
 * Reference: Venezky (1970) - spelling-sound correspondence
 */
function createG2PPrompt(content: string, metadata: any, format: TaskFormat): string {
  const baseWord = metadata?.baseWord || content.split(' [')[0];
  const irregularities = metadata?.irregularities || [];

  switch (format) {
    case 'mcq':
      if (metadata?.silentLetters?.length > 0) {
        return `Which letter(s) are silent in "${baseWord}"?`;
      }
      return `What is the correct pronunciation pattern for "${baseWord}"?`;
    case 'pronunciation':
      return `Identify the pronunciation challenges in "${baseWord}":`;
    default:
      return `Analyze the spelling-sound relationship: ${baseWord}`;
  }
}

/**
 * Generate syntactic task prompt.
 * Reference: Lu L2SCA (2010) - syntactic complexity measures
 */
function createSyntPrompt(content: string, metadata: any, format: TaskFormat): string {
  const cefrLevel = metadata?.estimatedCEFR || 'B1';
  const clauseCount = metadata?.clauseCount || 1;

  switch (format) {
    case 'mcq':
      return `What is the grammatical structure of this sentence?`;
    case 'sentence_completion':
      return `Complete the sentence with the correct grammatical form:`;
    default:
      return `Analyze the syntactic structure (${cefrLevel} level):`;
  }
}

/**
 * Generate pragmatic task prompt.
 * Reference: Taguchi (2015) - pragmatic competence, Biber (1988) - register analysis
 */
function createPragPrompt(content: string, metadata: any, format: TaskFormat): string {
  const speechAct = metadata?.speechAct || 'communicate';
  const register = metadata?.register || 'neutral';
  const pragType = metadata?.pragmaticType || 'general';

  switch (format) {
    case 'mcq':
      return `In what context would you use: "${content}"?`;
    case 'register_selection':
      return `Select the appropriate register/formality level for this ${speechAct}:`;
    default:
      return `When would you use this expression? (${register} register)`;
  }
}

/**
 * Generate morphological distractors.
 */
function generateMorphDistractors(content: string, metadata: any, queueItems: any[]): string[] {
  const root = metadata?.root || content;
  const distractors: string[] = [];

  // Add similar roots from queue
  for (const item of queueItems) {
    if (item.object?.type === 'MORPH' && item.object?.content !== content) {
      const itemMeta = item.object?.metadata ? JSON.parse(item.object.metadata) : {};
      if (itemMeta.root && itemMeta.root !== root) {
        distractors.push(itemMeta.root);
      }
    }
  }

  // Add some common wrong patterns
  const commonDistractors = [
    root + 's',
    root + 'ed',
    root + 'ing',
    root.slice(0, -1),
    root.slice(0, -2),
  ].filter(d => d !== root && d.length > 2);

  distractors.push(...commonDistractors);

  return shuffleArray([root, ...distractors.slice(0, 3)]);
}

/**
 * Generate G2P/pronunciation distractors.
 */
function generateG2PDistractors(content: string, metadata: any, queueItems: any[]): string[] {
  const silentLetters = metadata?.silentLetters || [];
  const baseWord = metadata?.baseWord || content;

  if (silentLetters.length > 0) {
    // Generate options for silent letter question
    const allLetters = baseWord.split('').filter((c: string) => /[a-z]/i.test(c));
    const uniqueLetters = [...new Set(allLetters)];
    const distractors = uniqueLetters.filter((l: string) => !silentLetters.includes(l)).slice(0, 3);
    return shuffleArray([silentLetters.join(', '), ...distractors]);
  }

  // Default pronunciation pattern options
  return shuffleArray([
    'Regular pronunciation',
    'Silent letters present',
    'Irregular vowel sound',
    'Consonant cluster',
  ]);
}

/**
 * Generate syntactic distractors.
 */
function generateSyntDistractors(content: string, metadata: any, queueItems: any[]): string[] {
  const structures = [
    'Simple sentence (SVO)',
    'Complex sentence (subordinate clause)',
    'Compound sentence (coordinating)',
    'Passive construction',
    'Relative clause',
    'Conditional structure',
  ];

  // Determine the correct answer based on metadata
  let correct = 'Simple sentence (SVO)';
  if (metadata?.subordinationIndex > 0.5) {
    correct = 'Complex sentence (subordinate clause)';
  } else if (metadata?.passiveRatio > 0.3) {
    correct = 'Passive construction';
  } else if (metadata?.clauseCount > 1) {
    correct = 'Compound sentence (coordinating)';
  }

  const distractors = structures.filter(s => s !== correct).slice(0, 3);
  return shuffleArray([correct, ...distractors]);
}

/**
 * Generate pragmatic distractors.
 */
function generatePragDistractors(content: string, metadata: any, queueItems: any[]): string[] {
  const contexts = [
    'Formal business meeting',
    'Casual conversation with friends',
    'Academic presentation',
    'Medical consultation',
    'Customer service interaction',
    'Legal proceeding',
  ];

  // Determine correct context based on register and domain
  const register = metadata?.register || 'neutral';
  const domain = metadata?.domain || 'general';

  let correct = 'Casual conversation with friends';
  if (register === 'formal' || register === 'academic') {
    correct = domain === 'medical' ? 'Medical consultation' :
              domain === 'legal' ? 'Legal proceeding' :
              domain === 'business' ? 'Formal business meeting' :
              'Academic presentation';
  } else if (register === 'professional') {
    correct = 'Customer service interaction';
  }

  const distractors = contexts.filter(c => c !== correct).slice(0, 3);
  return shuffleArray([correct, ...distractors]);
}

/**
 * Create sentence blank for syntactic tasks.
 */
function createSentenceBlank(content: string): string {
  // Find a suitable word to blank out (verb, noun, or key phrase)
  const words = content.split(' ');
  if (words.length <= 3) return content.replace(/\w+/, '____');

  // Blank out a word in the middle third of the sentence
  const startIdx = Math.floor(words.length / 3);
  const endIdx = Math.floor(words.length * 2 / 3);
  const blankIdx = startIdx + Math.floor(Math.random() * (endIdx - startIdx));

  words[blankIdx] = '____';
  return words.join(' ');
}

/**
 * Get expected answer based on object type.
 */
function getExpectedAnswer(content: string, objectType: ObjectType, metadata: any): string {
  switch (objectType) {
    case 'MORPH':
      return metadata?.root || content.split(' = ')[0];
    case 'G2P':
      return metadata?.silentLetters?.join(', ') || content.split(' [')[0];
    case 'SYNT':
    case 'PRAG':
      // For MCQ tasks, the correct answer is handled by options
      return content;
    case 'LEX':
    default:
      return content;
  }
}

export default SessionPage;
