/**
 * Timed Exercise Component
 *
 * A Stage 4 (Automatic) mastery component that adds time pressure
 * to reinforce automaticity. Auto-submits when time expires.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';

interface TimedExerciseProps {
  prompt: string;
  expectedAnswer: string;
  timeLimitSeconds: number;
  onSubmit: (response: string, timeUsed: number, timedOut: boolean) => void;
  onSkip?: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  showProgress?: boolean;
}

export const TimedExercise: React.FC<TimedExerciseProps> = ({
  prompt,
  expectedAnswer,
  timeLimitSeconds,
  onSubmit,
  onSkip,
  difficulty = 'medium',
  showProgress = true,
}) => {
  const [response, setResponse] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const startTimeRef = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate progress percentage
  const progressPercent = (timeRemaining / timeLimitSeconds) * 100;

  // Get color based on time remaining
  const getTimerColor = () => {
    if (progressPercent > 60) return 'text-green-400';
    if (progressPercent > 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = () => {
    if (progressPercent > 60) return 'bg-green-500';
    if (progressPercent > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Handle submission
  const handleSubmit = useCallback(
    (timedOut: boolean = false) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      const timeUsed = (Date.now() - startTimeRef.current) / 1000;
      onSubmit(response, timeUsed, timedOut);
    },
    [response, onSubmit, isSubmitting]
  );

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 0.1;

        // Shake effect when time is critical
        if (next <= 5 && next > 4.9) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
        }

        return Math.max(0, next);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [timeRemaining, handleSubmit]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(false);
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);

    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    if (seconds < 10) {
      return `${secs}.${tenths}`;
    }
    return `${secs}`;
  };

  // Difficulty-based styling
  const difficultyStyles = {
    easy: 'border-green-500/30',
    medium: 'border-yellow-500/30',
    hard: 'border-red-500/30',
  };

  return (
    <GlassCard
      className={`
        relative overflow-hidden transition-all duration-300
        ${difficultyStyles[difficulty]}
        ${shake ? 'animate-shake' : ''}
      `}
    >
      {/* Progress bar at top */}
      {showProgress && (
        <div className="absolute left-0 right-0 top-0 h-1 bg-white/10">
          <div
            className={`h-full transition-all duration-100 ${getProgressColor()}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="p-6">
        {/* Timer display */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm uppercase tracking-wide text-white/60">
            Timed Challenge
          </span>
          <div
            className={`
              font-mono text-2xl font-bold transition-colors duration-300
              ${getTimerColor()}
              ${timeRemaining <= 5 ? 'animate-pulse' : ''}
            `}
          >
            {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-6">
          <p className="text-lg text-white">{prompt}</p>
        </div>

        {/* Input area */}
        <div className="mb-4">
          <GlassInput
            ref={inputRef}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={isSubmitting || timeRemaining <= 0}
            className={`
              w-full text-lg
              ${timeRemaining <= 5 ? 'border-red-500/50' : ''}
            `}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <GlassButton
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || timeRemaining <= 0}
            className="flex-1"
          >
            Submit
          </GlassButton>

          {onSkip && (
            <GlassButton
              onClick={onSkip}
              variant="ghost"
              disabled={isSubmitting}
            >
              Skip
            </GlassButton>
          )}
        </div>

        {/* Warning when time is low */}
        {timeRemaining <= 10 && timeRemaining > 0 && (
          <div className="mt-4 text-center text-sm text-red-400">
            ⚡ Hurry! Time is running out!
          </div>
        )}
      </div>

      {/* CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </GlassCard>
  );
};

export default TimedExercise;
