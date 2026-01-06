/**
 * Hint Gauge Component
 *
 * A liquid-fill gauge visualization showing remaining hints.
 * Animates as hints are used, with time-based hint triggering.
 */

import React, { useEffect, useState, useCallback } from 'react';

interface HintGaugeProps {
  totalHints: number;
  usedHints: number;
  onRequestHint: () => void;
  autoHintDelaySeconds?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const HintGauge: React.FC<HintGaugeProps> = ({
  totalHints,
  usedHints,
  onRequestHint,
  autoHintDelaySeconds = 30,
  disabled = false,
  size = 'md',
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const remainingHints = Math.max(0, totalHints - usedHints);
  const fillPercent = (remainingHints / totalHints) * 100;
  const autoHintProgress = Math.min(100, (timeElapsed / autoHintDelaySeconds) * 100);

  // Size configurations
  const sizeConfig = {
    sm: { width: 48, height: 64, fontSize: 'text-sm' },
    md: { width: 64, height: 80, fontSize: 'text-base' },
    lg: { width: 80, height: 100, fontSize: 'text-lg' },
  };

  const { width, height, fontSize } = sizeConfig[size];

  // Auto-hint timer
  useEffect(() => {
    if (disabled || remainingHints === 0) return;

    const interval = setInterval(() => {
      setTimeElapsed((prev) => {
        const next = prev + 1;
        if (next >= autoHintDelaySeconds) {
          // Trigger auto-hint
          onRequestHint();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [disabled, remainingHints, autoHintDelaySeconds, onRequestHint]);

  // Reset timer when hint is used
  useEffect(() => {
    setTimeElapsed(0);
  }, [usedHints]);

  // Animation on hint use
  const handleClick = useCallback(() => {
    if (disabled || remainingHints === 0) return;

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    onRequestHint();
  }, [disabled, remainingHints, onRequestHint]);

  // Get color based on remaining hints
  const getColor = () => {
    if (remainingHints === 0) return 'bg-gray-400';
    if (remainingHints === 1) return 'bg-red-500';
    if (remainingHints === 2) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Gauge Container */}
      <button
        onClick={handleClick}
        disabled={disabled || remainingHints === 0}
        className={`
          relative overflow-hidden rounded-lg border-2 border-white/20
          bg-white/5 backdrop-blur-sm transition-all duration-300
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-white/40'}
          ${isAnimating ? 'scale-95' : 'scale-100'}
        `}
        style={{ width, height }}
        title={
          remainingHints > 0
            ? `${remainingHints} hints remaining. Click to use one.`
            : 'No hints remaining'
        }
      >
        {/* Liquid Fill */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out
            ${getColor()}
          `}
          style={{
            height: `${fillPercent}%`,
            transform: isAnimating ? 'translateY(10px)' : 'translateY(0)',
          }}
        >
          {/* Wave effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-2 left-1/2 h-4 w-[200%] -translate-x-1/2 bg-white/20"
              style={{
                borderRadius: '40%',
                animation: 'wave 2s infinite ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Auto-hint progress ring */}
        {remainingHints > 0 && !disabled && (
          <svg
            className="absolute inset-0 -rotate-90"
            viewBox={`0 0 ${width} ${height}`}
          >
            <rect
              x="2"
              y="2"
              width={width - 4}
              height={height - 4}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              rx="6"
              strokeDasharray={`${((width - 4 + height - 4) * 2 * autoHintProgress) / 100} ${(width - 4 + height - 4) * 2}`}
              className="transition-all duration-1000"
            />
          </svg>
        )}

        {/* Hint count */}
        <div
          className={`
            absolute inset-0 flex items-center justify-center
            font-bold text-white drop-shadow-lg ${fontSize}
          `}
        >
          {remainingHints}
        </div>
      </button>

      {/* Label */}
      <span className="text-xs text-white/60">
        {remainingHints > 0
          ? `${remainingHints} hint${remainingHints !== 1 ? 's' : ''}`
          : 'No hints'}
      </span>

      {/* Auto-hint timer */}
      {remainingHints > 0 && !disabled && (
        <span className="text-xs text-white/40">
          Auto: {autoHintDelaySeconds - timeElapsed}s
        </span>
      )}

      {/* CSS for wave animation */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: translateX(-50%) rotate(0deg); }
          50% { transform: translateX(-50%) rotate(5deg); }
        }
      `}</style>
    </div>
  );
};

export default HintGauge;
