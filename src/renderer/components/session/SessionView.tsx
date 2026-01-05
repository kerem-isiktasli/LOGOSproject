/**
 * SessionView Component
 *
 * The main task rendering interface for the Training Gym.
 * Handles different task formats (MCQ, fill-in-blank, free response)
 * with real-time feedback and progressive scaffolding.
 *
 * Design Philosophy:
 * - Focus mode: minimal distractions during learning
 * - Smooth transitions between question and feedback
 * - Clear visual hierarchy for different task types
 * - Immediate feedback with educational error analysis
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GlassCard, GlassButton, GlassInput, GlassTextarea, GlassBadge, MasteryBadge } from '../ui';
import { FeedbackCard } from './FeedbackCard';

// ============================================================================
// Types
// ============================================================================

type TaskFormat = 'mcq' | 'fill_blank' | 'free_response' | 'typing';

export interface SessionTask {
  id: string;
  objectId: string;
  content: string;
  type: string;
  format: TaskFormat;
  prompt: string;
  expectedAnswer: string;
  options?: string[];
  blankTemplate?: string;
  hints?: string[];
  masteryStage: 0 | 1 | 2 | 3 | 4;
  difficulty: number;
}

export interface SessionViewProps {
  /** Current task to display */
  task: SessionTask;
  /** Current task index (0-based) */
  taskIndex: number;
  /** Total number of tasks */
  totalTasks: number;
  /** Submit response callback - returns correctness and error analysis */
  onSubmit: (
    answer: string,
    cueLevel: 0 | 1 | 2 | 3,
    responseTimeMs: number
  ) => Promise<{ correct: boolean; errorAnalysis?: any } | undefined>;
  /** Move to next task */
  onNext: () => void;
  /** Request a hint (level 1-3) */
  onGetHint: (level: number) => Promise<string>;
  /** Exit session early */
  onExit: () => void;
  /** Additional CSS classes */
  className?: string;
}

type ViewPhase = 'question' | 'feedback';

interface FeedbackState {
  correct: boolean;
  userAnswer: string;
  expectedAnswer: string;
  errorAnalysis?: any;
  responseTimeMs: number;
  cueLevel: 0 | 1 | 2 | 3;
}

// ============================================================================
// SessionView Component
// ============================================================================

export const SessionView: React.FC<SessionViewProps> = ({
  task,
  taskIndex,
  totalTasks,
  onSubmit,
  onNext,
  onGetHint,
  onExit,
  className = '',
}) => {
  const [phase, setPhase] = useState<ViewPhase>('question');
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [cueLevel, setCueLevel] = useState<0 | 1 | 2 | 3>(0);
  const [hints, setHints] = useState<string[]>([]);
  const [loadingHint, setLoadingHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when task changes
  useEffect(() => {
    setPhase('question');
    setAnswer('');
    setSelectedOption(null);
    setCueLevel(0);
    setHints([]);
    setFeedback(null);
    setQuestionStartTime(Date.now());

    // Focus input after task change
    setTimeout(() => {
      if (task.format === 'free_response' || task.format === 'fill_blank') {
        inputRef.current?.focus();
      }
    }, 100);
  }, [task.id]);

  // Handle answer submission
  const handleSubmit = useCallback(async () => {
    const responseTimeMs = Date.now() - questionStartTime;
    const finalAnswer = task.format === 'mcq' ? selectedOption || '' : answer;

    if (!finalAnswer.trim() && task.format !== 'mcq') {
      return; // Don't submit empty answers for non-MCQ
    }

    setSubmitting(true);

    try {
      const result = await onSubmit(finalAnswer, cueLevel, responseTimeMs);

      setFeedback({
        correct: result?.correct ?? false,
        userAnswer: finalAnswer,
        expectedAnswer: task.expectedAnswer,
        errorAnalysis: result?.errorAnalysis,
        responseTimeMs,
        cueLevel,
      });

      setPhase('feedback');
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setSubmitting(false);
    }
  }, [task, answer, selectedOption, cueLevel, questionStartTime, onSubmit]);

  // Handle MCQ option selection
  const handleOptionSelect = useCallback((option: string) => {
    setSelectedOption(option);
  }, []);

  // Handle MCQ submission (double-click or explicit submit)
  const handleMCQSubmit = useCallback(async (option: string) => {
    const responseTimeMs = Date.now() - questionStartTime;

    setSubmitting(true);
    setSelectedOption(option);

    try {
      const result = await onSubmit(option, cueLevel, responseTimeMs);

      setFeedback({
        correct: result?.correct ?? false,
        userAnswer: option,
        expectedAnswer: task.expectedAnswer,
        errorAnalysis: result?.errorAnalysis,
        responseTimeMs,
        cueLevel,
      });

      setPhase('feedback');
    } catch (error) {
      console.error('Failed to submit MCQ answer:', error);
    } finally {
      setSubmitting(false);
    }
  }, [task, cueLevel, questionStartTime, onSubmit]);

  // Handle hint request
  const handleGetHint = useCallback(async () => {
    if (cueLevel >= 3 || loadingHint) return;

    setLoadingHint(true);

    try {
      const newLevel = (cueLevel + 1) as 1 | 2 | 3;
      const hint = await onGetHint(newLevel);

      setHints(prev => [...prev, hint]);
      setCueLevel(newLevel);
    } catch (error) {
      console.error('Failed to get hint:', error);
    } finally {
      setLoadingHint(false);
    }
  }, [cueLevel, loadingHint, onGetHint]);

  // Handle skip
  const handleSkip = useCallback(async () => {
    const responseTimeMs = Date.now() - questionStartTime;

    setSubmitting(true);

    try {
      const result = await onSubmit('', 3, responseTimeMs);

      setFeedback({
        correct: false,
        userAnswer: '',
        expectedAnswer: task.expectedAnswer,
        errorAnalysis: null,
        responseTimeMs,
        cueLevel: 3,
      });

      setPhase('feedback');
    } catch (error) {
      console.error('Failed to skip:', error);
    } finally {
      setSubmitting(false);
    }
  }, [task, questionStartTime, onSubmit]);

  // Handle continue to next
  const handleContinue = useCallback(() => {
    onNext();
  }, [onNext]);

  // Handle retry (same question)
  const handleRetry = useCallback(() => {
    setPhase('question');
    setAnswer('');
    setSelectedOption(null);
    setFeedback(null);
    setQuestionStartTime(Date.now());

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // In feedback phase, Enter continues
      if (phase === 'feedback') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleContinue();
        }
        return;
      }

      // In question phase
      if (phase === 'question') {
        // Enter submits (for non-MCQ)
        if (e.key === 'Enter' && !e.shiftKey && task.format !== 'mcq') {
          e.preventDefault();
          handleSubmit();
        }

        // Number keys for MCQ selection (1-4)
        if (task.format === 'mcq' && task.options) {
          const num = parseInt(e.key);
          if (num >= 1 && num <= task.options.length) {
            e.preventDefault();
            const option = task.options[num - 1];
            handleMCQSubmit(option);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, task, handleSubmit, handleContinue, handleMCQSubmit]);

  // Render feedback phase
  if (phase === 'feedback' && feedback) {
    return (
      <div className={`session-view ${className}`}>
        <FeedbackCard
          feedback={{
            correct: feedback.correct,
            userAnswer: feedback.userAnswer,
            correctAnswer: feedback.expectedAnswer,
            errorAnalysis: feedback.errorAnalysis,
            responseTimeMs: feedback.responseTimeMs,
          }}
          questionContent={task.content}
          onContinue={handleContinue}
          onRetry={!feedback.correct ? handleRetry : undefined}
          autoAdvance={feedback.correct}
          autoAdvanceDelay={1500}
        />
      </div>
    );
  }

  // Render question phase
  return (
    <div className={`session-view ${className}`}>
      <GlassCard className="task-card max-w-2xl mx-auto" padding="lg">
        {/* Task header */}
        <div className="task-header flex items-center justify-between mb-6 pb-4 border-b border-neutral-200/50 dark:border-neutral-700/50">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              {taskIndex + 1} / {totalTasks}
            </span>
            <MasteryBadge stage={task.masteryStage} size="sm" />
            <GlassBadge variant="default" size="sm">
              {task.type}
            </GlassBadge>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={onExit}>
            Exit
          </GlassButton>
        </div>

        {/* Task content */}
        <div className="task-content text-center mb-8">
          <p className="text-lg text-muted mb-4">{task.prompt}</p>

          {/* Display the content/question based on format */}
          {task.format === 'fill_blank' && task.blankTemplate ? (
            <div className="blank-template text-4xl font-bold tracking-wider mb-4">
              {task.blankTemplate}
            </div>
          ) : task.format !== 'mcq' ? (
            <div className="question-content text-3xl font-semibold mb-4">
              {task.content}
            </div>
          ) : null}
        </div>

        {/* Hints section */}
        {hints.length > 0 && (
          <div className="hints-section mb-6">
            {hints.map((hint, index) => (
              <div
                key={index}
                className="hint-item p-3 mb-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm"
              >
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  Hint {index + 1}:
                </span>{' '}
                <span className="text-blue-800 dark:text-blue-200">{hint}</span>
              </div>
            ))}
          </div>
        )}

        {/* Input area based on format */}
        <div className="input-area mb-6">
          {task.format === 'mcq' && task.options ? (
            <MCQOptions
              options={task.options}
              selectedOption={selectedOption}
              onSelect={handleOptionSelect}
              onSubmit={handleMCQSubmit}
              disabled={submitting}
            />
          ) : task.format === 'fill_blank' ? (
            <div className="max-w-md mx-auto">
              <GlassInput
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                size="lg"
                disabled={submitting}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <GlassInput
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                size="lg"
                disabled={submitting}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="action-buttons flex items-center justify-between">
          <div className="left-actions">
            {cueLevel < 3 && (
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleGetHint}
                disabled={loadingHint || submitting}
              >
                {loadingHint ? (
                  'Getting hint...'
                ) : (
                  <>
                    <HintIcon />
                    <span className="ml-1">Hint ({3 - cueLevel} left)</span>
                  </>
                )}
              </GlassButton>
            )}
          </div>

          <div className="right-actions flex gap-2">
            <GlassButton
              variant="ghost"
              onClick={handleSkip}
              disabled={submitting}
            >
              Skip
            </GlassButton>
            {task.format !== 'mcq' && (
              <GlassButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!answer.trim() || submitting}
              >
                {submitting ? 'Checking...' : 'Check Answer'}
              </GlassButton>
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-muted mt-4 opacity-60">
          {task.format === 'mcq'
            ? 'Press 1-4 to select an answer'
            : 'Press Enter to submit'}
        </p>
      </GlassCard>

      <style>{`
        .task-card {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .blank-template {
          font-family: monospace;
          letter-spacing: 0.3em;
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// MCQ Options Component
// ============================================================================

interface MCQOptionsProps {
  options: string[];
  selectedOption: string | null;
  onSelect: (option: string) => void;
  onSubmit: (option: string) => void;
  disabled?: boolean;
}

const MCQOptions: React.FC<MCQOptionsProps> = ({
  options,
  selectedOption,
  onSelect,
  onSubmit,
  disabled,
}) => {
  return (
    <div className="mcq-options grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((option, index) => {
        const isSelected = selectedOption === option;
        const letter = String.fromCharCode(65 + index); // A, B, C, D

        return (
          <button
            key={index}
            onClick={() => onSubmit(option)}
            disabled={disabled}
            className={`
              mcq-option
              flex items-center gap-3 p-4 rounded-xl
              text-left transition-all duration-200
              border-2
              ${isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
            `}
          >
            <span
              className={`
                option-key
                flex items-center justify-center
                w-8 h-8 rounded-lg
                text-sm font-bold
                ${isSelected
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }
              `}
            >
              {letter}
            </span>
            <span className="option-text flex-1 font-medium">
              {option}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

const HintIcon: React.FC = () => (
  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

export interface SessionConfig {
  type: 'learn' | 'review' | 'mixed';
  targetDuration?: number;
  sessionSize?: number;
  questionTimeLimit?: number;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
}

export interface SessionItem {
  id: string;
  content: string;
  type: string;
  translation?: string;
  audioUrl?: string;
  imageUrl?: string;
  hint?: string;
  difficulty?: number;
  masteryStage?: 0 | 1 | 2 | 3 | 4;
  options?: string[];
  mode: 'recall' | 'recognition' | 'typing' | 'listening';
  expectedAnswer: string;
}

export interface SessionState {
  phase: 'ready' | 'question' | 'feedback' | 'complete' | 'paused';
  currentIndex: number;
  items: SessionItem[];
  responses: Array<{
    itemId: string;
    correct: boolean;
    userAnswer: string;
    cueLevel: 0 | 1 | 2 | 3;
    responseTimeMs: number;
  }>;
  startTime: Date;
  elapsedMs: number;
}

export interface SessionStats {
  totalItems: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
  averageResponseTime: number;
  totalTimeMs: number;
  cueFreeAccuracy: number;
}

export default SessionView;
