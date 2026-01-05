/**
 * FeedbackCard Component
 *
 * Displays feedback after answering a question in the Training Gym.
 * Shows correctness, error analysis, and progression options.
 *
 * Design Philosophy:
 * - Clear visual distinction between correct/incorrect
 * - Error feedback is educational, not punitive
 * - Component-level error analysis guides improvement
 * - Quick progression to maintain learning momentum
 */

import React, { useEffect, useState } from 'react';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  ComponentBadge,
  MasteryProgress,
} from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackData {
  /** Whether the answer was correct */
  correct: boolean;
  /** User's submitted answer */
  userAnswer: string;
  /** Expected correct answer */
  correctAnswer: string;
  /** Error analysis (if incorrect) */
  errorAnalysis?: {
    errorType?: string;
    component?: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';
    explanation?: string;
    correction?: string;
    similarErrors?: string[];
  } | null;
  /** Updated mastery info */
  mastery?: {
    previousStage: 0 | 1 | 2 | 3 | 4;
    newStage: 0 | 1 | 2 | 3 | 4;
    stability: number;
    nextReview: Date | null;
  };
  /** Response time in ms */
  responseTimeMs?: number;
  /** Points earned (for gamification) */
  pointsEarned?: number;
}

export interface FeedbackCardProps {
  /** Feedback data */
  feedback: FeedbackData;
  /** Original question content */
  questionContent: string;
  /** Callback to continue to next question */
  onContinue: () => void;
  /** Callback to retry the same question */
  onRetry?: () => void;
  /** Callback to report an issue with the question */
  onReport?: () => void;
  /** Whether to auto-advance after a delay */
  autoAdvance?: boolean;
  /** Delay before auto-advance (ms) */
  autoAdvanceDelay?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// FeedbackCard Component
// ============================================================================

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  feedback,
  questionContent,
  onContinue,
  onRetry,
  onReport,
  autoAdvance = false,
  autoAdvanceDelay = 2000,
  className = '',
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-advance timer
  useEffect(() => {
    if (!autoAdvance) return;

    const delay = feedback.correct ? autoAdvanceDelay : autoAdvanceDelay * 2;
    setCountdown(Math.ceil(delay / 1000));

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          onContinue();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoAdvance, autoAdvanceDelay, feedback.correct, onContinue]);

  // Keyboard shortcut for continue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onContinue]);

  const masteryImproved =
    feedback.mastery &&
    feedback.mastery.newStage > feedback.mastery.previousStage;

  const cardVariant = feedback.correct ? 'success' : 'danger';

  return (
    <GlassCard
      className={`feedback-card max-w-xl mx-auto ${className}`}
      padding="lg"
    >
      {/* Result header */}
      <div className="feedback-header flex items-center gap-4 mb-6">
        <div
          className={`
            feedback-icon
            flex items-center justify-center
            w-14 h-14 rounded-full
            ${feedback.correct
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
            }
          `}
        >
          {feedback.correct ? <CorrectIcon /> : <IncorrectIcon />}
        </div>
        <div className="feedback-result flex-1">
          <h2 className="text-2xl font-bold mb-1">
            {feedback.correct ? 'Correct!' : 'Not quite right'}
          </h2>
          {feedback.pointsEarned !== undefined && feedback.correct && (
            <span className="text-lg font-semibold text-green-600">
              +{feedback.pointsEarned} pts
            </span>
          )}
        </div>
      </div>

      {/* Question and answer comparison */}
      <div className="feedback-comparison bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 mb-4">
        <div className="comparison-row flex gap-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
          <span className="comparison-label w-28 flex-shrink-0 text-sm text-muted">
            Question:
          </span>
          <span className="comparison-value flex-1 font-medium">
            {questionContent}
          </span>
        </div>

        <div className="comparison-row flex gap-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
          <span className="comparison-label w-28 flex-shrink-0 text-sm text-muted">
            Your answer:
          </span>
          <span
            className={`comparison-value flex-1 font-medium ${
              feedback.correct ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {feedback.userAnswer || <em className="opacity-50">No answer</em>}
          </span>
        </div>

        {!feedback.correct && (
          <div className="comparison-row flex gap-3 py-2">
            <span className="comparison-label w-28 flex-shrink-0 text-sm text-muted">
              Correct answer:
            </span>
            <span className="comparison-value flex-1 font-medium text-green-600">
              {feedback.correctAnswer}
            </span>
          </div>
        )}
      </div>

      {/* Error analysis (if incorrect and available) */}
      {!feedback.correct && feedback.errorAnalysis && (
        <div className="feedback-analysis bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
          <div className="analysis-header flex items-center gap-2 mb-2">
            {feedback.errorAnalysis.component && (
              <ComponentBadge component={feedback.errorAnalysis.component} />
            )}
            {feedback.errorAnalysis.errorType && (
              <span className="font-medium text-blue-800 dark:text-blue-200">
                {feedback.errorAnalysis.errorType}
              </span>
            )}
          </div>

          {feedback.errorAnalysis.explanation && (
            <p className="analysis-explanation text-blue-700 dark:text-blue-300 leading-relaxed mb-2">
              {feedback.errorAnalysis.explanation}
            </p>
          )}

          {feedback.errorAnalysis.correction && (
            <p className="analysis-correction text-sm text-blue-600 dark:text-blue-400">
              <strong>Tip:</strong> {feedback.errorAnalysis.correction}
            </p>
          )}

          {feedback.errorAnalysis.similarErrors &&
            feedback.errorAnalysis.similarErrors.length > 0 && (
              <div className="analysis-similar mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  Watch out for similar patterns:
                </span>
                <ul className="similar-list mt-1 pl-4 text-sm text-blue-700 dark:text-blue-300">
                  {feedback.errorAnalysis.similarErrors.map((error, i) => (
                    <li key={i} className="mb-1">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      {/* Mastery progress */}
      {feedback.mastery && (
        <div className="feedback-mastery bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 mb-4">
          <div className="mastery-header flex justify-between items-center mb-3">
            <span className="font-medium">Mastery Progress</span>
            {masteryImproved && (
              <GlassBadge variant="success" size="sm">
                Level Up!
              </GlassBadge>
            )}
          </div>
          <MasteryProgress stage={feedback.mastery.newStage} showLabels />
          {feedback.mastery.nextReview && (
            <p className="mastery-next-review text-sm text-muted mt-2">
              Next review: {formatNextReview(feedback.mastery.nextReview)}
            </p>
          )}
        </div>
      )}

      {/* Response time (if tracked) */}
      {feedback.responseTimeMs !== undefined && (
        <div className="feedback-stats text-sm text-muted text-center mb-4">
          Response time: {(feedback.responseTimeMs / 1000).toFixed(1)}s
        </div>
      )}

      {/* Actions */}
      <div className="feedback-actions flex justify-between items-center">
        <div className="feedback-actions-left">
          {onReport && (
            <GlassButton variant="ghost" size="sm" onClick={onReport}>
              Report Issue
            </GlassButton>
          )}
        </div>
        <div className="feedback-actions-right flex gap-2">
          {!feedback.correct && onRetry && (
            <GlassButton variant="ghost" onClick={onRetry}>
              Try Again
            </GlassButton>
          )}
          <GlassButton variant="primary" onClick={onContinue}>
            {countdown !== null ? `Continue (${countdown})` : 'Continue'}
          </GlassButton>
        </div>
      </div>

      <p className="feedback-hint text-center text-xs text-muted mt-4 opacity-60">
        Press Enter or Space to continue
      </p>

      <style>{`
        .feedback-card {
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .feedback-icon svg {
          width: 32px;
          height: 32px;
        }
      `}</style>
    </GlassCard>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

const CorrectIcon: React.FC = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const IncorrectIcon: React.FC = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const formatNextReview = (date: Date): string => {
  const now = new Date();
  const reviewDate = new Date(date);
  const diff = reviewDate.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (days > 7) {
    return reviewDate.toLocaleDateString();
  } else if (days > 1) {
    return `in ${days} days`;
  } else if (days === 1) {
    return 'tomorrow';
  } else if (hours > 1) {
    return `in ${hours} hours`;
  } else if (hours > 0) {
    return 'in about an hour';
  } else {
    return 'soon';
  }
};

export default FeedbackCard;
