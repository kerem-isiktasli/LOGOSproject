/**
 * Logo Component
 *
 * LOGOS application logo with network/graph motif representing
 * interconnected language concepts and the lambda symbol for linguistics.
 */

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 40,
  lg: 64,
  xl: 120,
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const pixelSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="logoNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Main circle background */}
        <circle cx="60" cy="60" r="56" fill="url(#logoBgGrad)" />

        {/* Network connections */}
        <g stroke="#ffffff" strokeWidth="2" strokeOpacity="0.4">
          <line x1="40" y1="35" x2="80" y2="35" />
          <line x1="40" y1="35" x2="35" y2="60" />
          <line x1="80" y1="35" x2="85" y2="60" />
          <line x1="35" y1="60" x2="60" y2="85" />
          <line x1="85" y1="60" x2="60" y2="85" />
          <line x1="35" y1="60" x2="85" y2="60" />
          <line x1="40" y1="35" x2="60" y2="85" />
          <line x1="80" y1="35" x2="60" y2="85" />
        </g>

        {/* Network nodes */}
        <g fill="url(#logoNodeGrad)">
          <circle cx="40" cy="35" r="8" />
          <circle cx="80" cy="35" r="8" />
          <circle cx="35" cy="60" r="6" />
          <circle cx="85" cy="60" r="6" />
          <circle cx="60" cy="85" r="10" />
        </g>

        {/* Highlights */}
        <g fill="#ffffff" fillOpacity="0.3">
          <circle cx="38" cy="33" r="3" />
          <circle cx="78" cy="33" r="3" />
          <circle cx="58" cy="82" r="4" />
        </g>

        {/* Lambda symbol */}
        <text
          x="60"
          y="72"
          fontFamily="Georgia, serif"
          fontSize="28"
          fontWeight="bold"
          fill="#ffffff"
          textAnchor="middle"
        >
          λ
        </text>
      </svg>

      {showText && (
        <span
          className="font-bold tracking-wide"
          style={{
            fontSize: pixelSize * 0.5,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          LOGOS
        </span>
      )}
    </div>
  );
};

export default Logo;
