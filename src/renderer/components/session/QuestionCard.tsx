/**
 * QuestionCard Component
 *
 * The primary learning interface for presenting questions/prompts.
 * Designed with certification test UX principles for focused learning.
 *
 * Design Philosophy:
 * - Clean, distraction-free presentation
 * - Clear visual hierarchy: question > input > feedback
 * - Subtle cues for difficulty and mastery without anxiety
 * - Progressive hint revelation (scaffolding)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassBadge,
  MasteryBadge,
  ComponentBadge,
} from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface LearningItem {
  id: string;
  content: string;
  type: string;
  translation?: string;
  audioUrl?: string;
  imageUrl?: string;
  hint?: string;
  difficulty?: number;
  masteryStage?: 0 | 1 | 2 | 3 | 4;
}

export interface QuestionCardProps {
  /** The learning item to display */
  item: LearningItem;
  /** Question type determining the interaction mode */
  mode: 'recall' | 'recognition' | 'typing' | 'listening';
  /** Options for recognition mode */
  options?: string[];
  /** Current cue level (0 = no cues, 3 = max cues) */
  cueLevel?: 0 | 1 | 2 | 3;
  /** Callback when user submits an answer */
  onSubmit: (answer: string, cueLevel: 0 | 1 | 2 | 3) => void;
  /** Callback to request a hint (increases cue level) */
  onRequestHint?: () => Promise<string>;
  /** Show item number and total */
  progress?: { current: number; total: number };
  /** Time limit in seconds (optional) */
  timeLimit?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// QuestionCard Component
// ============================================================================

export const QuestionCard: React.FC<QuestionCardProps> = ({
  item,
  mode,
  options = [],
  cueLevel = 0,
  onSubmit,
  onRequestHint,
  progress,
  timeLimit,
  className = '',
}) => {
  const [answer, setAnswer] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [currentCueLevel, setCurrentCueLevel] = useState(cueLevel);
  const [loadingHint, setLoadingHint] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (mode === 'typing' || mode === 'recall') {
      inputRef.current?.focus();
    } else if (mode === 'recognition') {
      // Focus the card for keyboard navigation in recognition mode
      cardRef.current?.focus();
    }
  }, [mode, item.id]);

  // Global keyboard shortcuts for MCQ options (1-4 or A-D)
  useEffect(() => {
    if (mode !== 'recognition') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toUpperCase();
      let optionIndex = -1;

      // Support both number keys (1-4) and letter keys (A-D)
      if (key >= '1' && key <= '4') {
        optionIndex = parseInt(key) - 1;
      } else if (key >= 'A' && key <= 'D') {
        optionIndex = key.charCodeAt(0) - 'A'.charCodeAt(0);
      }

      if (optionIndex >= 0 && optionIndex < options.length) {
        e.preventDefault();
        handleOptionSelect(options[optionIndex]);
      }

      // H key for hint
      if (key === 'H' && onRequestHint && currentCueLevel < 3) {
        e.preventDefault();
        handleHintRequest();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, options, currentCueLevel, onRequestHint]);

  // Timer countdown
  useEffect(() => {
    if (!timeLimit) return;

    setTimeRemaining(timeLimit);
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit on timeout
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimit, item.id]);

  const handleSubmit = () => {
    onSubmit(answer.trim(), currentCueLevel as 0 | 1 | 2 | 3);
    setAnswer('');
  };

  const handleHintRequest = async () => {
    if (!onRequestHint || currentCueLevel >= 3) return;

    setLoadingHint(true);
    try {
      const hint = await onRequestHint();
      setHints((prev) => [...prev, hint]);
      setCurrentCueLevel((prev) => Math.min(3, prev + 1) as 0 | 1 | 2 | 3);
    } catch (error) {
      console.error('Failed to get hint:', error);
    } finally {
      setLoadingHint(false);
    }
  };

  const handleOptionSelect = (option: string) => {
    onSubmit(option, currentCueLevel as 0 | 1 | 2 | 3);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <GlassCard
      ref={cardRef}
      className={`question-card ${className}`}
      padding="lg"
      tabIndex={mode === 'recognition' ? 0 : undefined}
      role="region"
      aria-label={`Question ${progress?.current || 1} of ${progress?.total || 1}: ${item.content}`}
    >
      {/* Header with progress and timer */}
      <div className="question-header">
        <div className="question-meta">
          {progress && (
            <span className="question-progress" aria-label={`Question ${progress.current} of ${progress.total}`}>
              {progress.current} / {progress.total}
            </span>
          )}
          {item.masteryStage !== undefined && (
            <MasteryBadge stage={item.masteryStage} size="sm" />
          )}
          <GlassBadge variant="default" size="sm">
            {item.type}
          </GlassBadge>
        </div>

        {timeLimit && (
          <div
            className={`question-timer ${
              timeRemaining <= 10 ? 'question-timer--warning' : ''
            }`}
            role="timer"
            aria-live="polite"
            aria-label={`Time remaining: ${formatTime(timeRemaining)}`}
          >
            <TimerIcon aria-hidden="true" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {/* Main question content */}
      <div className="question-content">
        {/* Image (if available) */}
        {item.imageUrl && (
          <div className="question-image">
            <img src={item.imageUrl} alt="" />
          </div>
        )}

        {/* Audio (if available) */}
        {item.audioUrl && mode === 'listening' && (
          <div className="question-audio">
            <AudioPlayer src={item.audioUrl} />
          </div>
        )}

        {/* Question text */}
        <div className="question-prompt">
          {mode === 'listening' ? (
            <p className="text-lg text-muted">Listen and type what you hear</p>
          ) : (
            <p className="question-text">{item.content}</p>
          )}
        </div>

        {/* Translation hint (based on cue level) */}
        {currentCueLevel >= 1 && item.translation && (
          <div className="question-translation animate-slide-in">
            <span className="text-sm text-muted">Meaning: </span>
            <span className="text-sm">{item.translation}</span>
          </div>
        )}

        {/* Progressive hints */}
        {hints.length > 0 && (
          <div className="question-hints">
            {hints.map((hint, index) => (
              <div key={index} className="question-hint glass-light animate-slide-in">
                <span className="hint-label">Hint {index + 1}:</span>
                <span className="hint-text">{hint}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Answer input area */}
      <div className="question-input-area">
        {mode === 'recognition' ? (
          <div
            className="recognition-options"
            role="group"
            aria-label="Answer options. Press A-D or 1-4 to select."
          >
            {options.map((option, index) => (
              <GlassButton
                key={index}
                variant="default"
                size="lg"
                onClick={() => handleOptionSelect(option)}
                className="recognition-option"
                aria-label={`Option ${String.fromCharCode(65 + index)}: ${option}. Press ${String.fromCharCode(65 + index)} or ${index + 1} to select.`}
              >
                <span className="option-key" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                <span className="option-text">{option}</span>
              </GlassButton>
            ))}
          </div>
        ) : (
          <div className="typing-input">
            <GlassInput
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'listening'
                  ? 'Type what you heard...'
                  : 'Type your answer...'
              }
              size="lg"
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="question-actions" role="group" aria-label="Question actions">
        <div className="question-actions-left">
          {onRequestHint && currentCueLevel < 3 && (
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={handleHintRequest}
              loading={loadingHint}
              disabled={loadingHint}
              aria-label={`Get hint. ${3 - currentCueLevel} hints remaining. Press H for shortcut.`}
            >
              <HintIcon aria-hidden="true" />
              Get Hint ({3 - currentCueLevel} left)
            </GlassButton>
          )}
        </div>

        <div className="question-actions-right">
          {mode !== 'recognition' && (
            <>
              <GlassButton
                variant="ghost"
                onClick={() => onSubmit('', 3)}
                aria-label="Skip this question"
              >
                Skip
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!answer.trim()}
                aria-label="Submit your answer"
              >
                Check Answer
              </GlassButton>
            </>
          )}
        </div>
      </div>

      <style>{`
        .question-card {
          max-width: 700px;
          margin: 0 auto;
        }

        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid hsl(var(--glass-border));
        }

        .question-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .question-progress {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: hsl(var(--color-neutral-500));
        }

        .question-timer {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: hsl(var(--color-neutral-600));
        }

        .question-timer--warning {
          color: hsl(var(--color-danger));
          animation: pulse 1s ease-in-out infinite;
        }

        .question-content {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .question-image {
          max-width: 300px;
          margin: 0 auto var(--space-6);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .question-image img {
          width: 100%;
          height: auto;
        }

        .question-audio {
          margin-bottom: var(--space-6);
        }

        .question-prompt {
          margin-bottom: var(--space-4);
        }

        .question-text {
          font-size: var(--text-3xl);
          font-weight: var(--font-semibold);
          color: hsl(var(--color-neutral-900));
          line-height: var(--leading-tight);
        }

        .question-translation {
          margin-top: var(--space-2);
        }

        .question-hints {
          margin-top: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .question-hint {
          display: flex;
          gap: var(--space-2);
          padding: var(--space-3);
          border-radius: var(--radius-lg);
          text-align: left;
        }

        .hint-label {
          font-weight: var(--font-medium);
          color: hsl(var(--color-primary));
        }

        .hint-text {
          color: hsl(var(--color-neutral-700));
        }

        .question-input-area {
          margin-bottom: var(--space-6);
        }

        .recognition-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
        }

        .recognition-option {
          justify-content: flex-start;
          padding: var(--space-4);
          height: auto;
          min-height: 60px;
        }

        .option-key {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: hsl(var(--color-primary) / 0.1);
          color: hsl(var(--color-primary));
          border-radius: var(--radius-md);
          font-weight: var(--font-semibold);
          font-size: var(--text-sm);
          margin-right: var(--space-3);
        }

        .option-text {
          flex: 1;
          text-align: left;
        }

        .typing-input {
          max-width: 500px;
          margin: 0 auto;
        }

        .question-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .question-actions-left,
        .question-actions-right {
          display: flex;
          gap: var(--space-2);
        }

        @media (max-width: 600px) {
          .recognition-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </GlassCard>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

const TimerIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
  </svg>
);

const HintIcon: React.FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
      />
      <GlassButton
        variant="primary"
        size="lg"
        onClick={togglePlay}
        className="audio-button"
      >
        {playing ? (
          <PauseIcon />
        ) : (
          <PlayIcon />
        )}
        <span>{playing ? 'Pause' : 'Play Audio'}</span>
      </GlassButton>
    </div>
  );
};

const PlayIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default QuestionCard;
