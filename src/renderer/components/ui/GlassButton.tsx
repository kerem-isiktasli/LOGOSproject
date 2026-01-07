/**
 * GlassButton Component
 *
 * An interactive button with Liquid Glass material properties.
 * Provides tactile feedback through elevation changes and subtle glow effects.
 *
 * Design Philosophy:
 * - Buttons are glass surfaces that respond to touch
 * - Primary actions use color-filled glass for emphasis
 * - Secondary actions use transparent glass to reduce visual weight
 * - Loading states maintain layout stability
 */

import React, { forwardRef } from 'react';

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant determining visual style */
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to display before the label */
  iconLeft?: React.ReactNode;
  /** Icon to display after the label */
  iconRight?: React.ReactNode;
  /** Whether this is an icon-only button */
  iconOnly?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

const variantClasses = {
  default: 'glass-button',
  primary: 'glass-button glass-button-primary',
  success: 'glass-button glass-button-success',
  danger: 'glass-button glass-button-danger',
  ghost: 'glass-button glass-button-ghost',
};

const sizeClasses = {
  sm: 'glass-button-sm',
  md: '',
  lg: 'glass-button-lg',
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      iconOnly = false,
      fullWidth = false,
      disabled,
      className = '',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseClasses = variantClasses[variant];
    const sizeClass = sizeClasses[size];
    const iconOnlyClass = iconOnly ? 'glass-button-icon' : '';
    const widthClass = fullWidth ? 'w-full' : '';
    const disabledClass = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';

    // For icon-only buttons, aria-label is required for accessibility
    const computedAriaLabel = iconOnly && !ariaLabel
      ? (typeof children === 'string' ? children : 'Button')
      : ariaLabel;

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${sizeClass} ${iconOnlyClass} ${widthClass} ${disabledClass} ${className}`}
        disabled={disabled || loading}
        aria-label={computedAriaLabel}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size} />
        ) : (
          <>
            {iconLeft && <span className="button-icon-left" aria-hidden="true">{iconLeft}</span>}
            {!iconOnly && children}
            {iconRight && <span className="button-icon-right" aria-hidden="true">{iconRight}</span>}
          </>
        )}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

/**
 * LoadingSpinner - Animated spinner for button loading states
 */
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeMap = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <svg
      className={`animate-spin ${sizeMap[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

/**
 * GlassButtonGroup - Container for related buttons
 */
export const GlassButtonGroup: React.FC<{
  children: React.ReactNode;
  /** Orientation of the group */
  orientation?: 'horizontal' | 'vertical';
  /** Gap between buttons */
  gap?: 'sm' | 'md' | 'lg';
}> = ({ children, orientation = 'horizontal', gap = 'md' }) => {
  const gapClass = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3',
  }[gap];

  const orientationClass = orientation === 'vertical' ? 'flex-col' : 'flex-row';

  return (
    <div className={`flex ${orientationClass} ${gapClass}`}>
      {children}
    </div>
  );
};

/**
 * GlassIconButton - Convenience wrapper for icon-only buttons
 */
export const GlassIconButton = forwardRef<
  HTMLButtonElement,
  Omit<GlassButtonProps, 'iconOnly' | 'iconLeft' | 'iconRight'>
>((props, ref) => (
  <GlassButton ref={ref} iconOnly {...props} />
));

GlassIconButton.displayName = 'GlassIconButton';

export default GlassButton;
