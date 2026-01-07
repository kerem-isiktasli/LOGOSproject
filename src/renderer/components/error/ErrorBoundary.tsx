/**
 * ErrorBoundary Component
 *
 * React Error Boundary with retry capability.
 * Catches JavaScript errors and provides recovery options.
 *
 * Features:
 * - Catches render errors in child components
 * - Provides retry functionality
 * - Logs errors for debugging
 * - Graceful fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'critical';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RETRIES = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Notify parent if callback provided
    this.props.onError?.(error, errorInfo);

    // Report to error tracking service (if available)
    this.reportError(error, errorInfo);
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo): void {
    // In production, send to error tracking service
    // For now, log to console with structured data
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
      retryCount: this.state.retryCount,
    };

    // Store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('logos_error_log') || '[]');
      errors.push(errorReport);
      // Keep only last 20 errors
      if (errors.length > 20) errors.shift();
      localStorage.setItem('logos_error_log', JSON.stringify(errors));
    } catch {
      // Ignore storage errors
    }
  }

  private handleRetry = (): void => {
    if (this.state.retryCount < this.MAX_RETRIES) {
      this.setState(
        (prev) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
        }),
        () => {
          this.props.onReset?.();
        }
      );
    }
  };

  private handleAutoRetry = (): void => {
    // Exponential backoff for auto-retry
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    this.retryTimeoutId = setTimeout(this.handleRetry, delay);
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    // Reset state and trigger navigation
    this.setState(
      { hasError: false, error: null, errorInfo: null, retryCount: 0 },
      () => {
        // The parent component should handle navigation
        window.dispatchEvent(new CustomEvent('logos:navigate', { detail: 'dashboard' }));
      }
    );
  };

  render(): ReactNode {
    const { children, fallback, showDetails = false, level = 'component' } = this.props;
    const { hasError, error, errorInfo, retryCount } = this.state;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Determine UI based on error level
    const canRetry = retryCount < this.MAX_RETRIES;
    const isNetworkError = error?.message?.toLowerCase().includes('network') ||
                           error?.message?.toLowerCase().includes('fetch');

    // Critical level shows full-page error
    if (level === 'critical' || level === 'page') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
          <GlassCard className="max-w-md w-full p-8 text-center">
            <div className="flex justify-center mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--pro-error-muted)' }}
              >
                <AlertTriangle size={32} style={{ color: 'var(--pro-error)' }} />
              </div>
            </div>

            <h1
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--pro-text-primary)' }}
            >
              문제가 발생했습니다
            </h1>

            <p
              className="text-sm mb-6"
              style={{ color: 'var(--pro-text-secondary)' }}
            >
              {isNetworkError
                ? '네트워크 연결을 확인해주세요.'
                : '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
            </p>

            {showDetails && error && (
              <div
                className="text-left text-xs font-mono p-4 rounded-lg mb-6 max-h-32 overflow-auto"
                style={{
                  backgroundColor: 'var(--pro-bg-tertiary)',
                  color: 'var(--pro-text-muted)',
                }}
              >
                <p className="font-semibold mb-1">{error.name}: {error.message}</p>
                {errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap opacity-60">
                    {errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {canRetry && (
                <GlassButton
                  onClick={this.handleRetry}
                  variant="primary"
                  className="w-full"
                >
                  <RefreshCw size={16} className="mr-2" />
                  다시 시도 ({this.MAX_RETRIES - retryCount}회 남음)
                </GlassButton>
              )}

              <GlassButton
                onClick={this.handleGoHome}
                variant="secondary"
                className="w-full"
              >
                <Home size={16} className="mr-2" />
                대시보드로 이동
              </GlassButton>

              {!canRetry && (
                <GlassButton
                  onClick={this.handleReload}
                  variant="ghost"
                  className="w-full"
                >
                  페이지 새로고침
                </GlassButton>
              )}
            </div>

            {retryCount > 0 && (
              <p
                className="text-xs mt-4"
                style={{ color: 'var(--pro-text-muted)' }}
              >
                재시도 횟수: {retryCount}/{this.MAX_RETRIES}
              </p>
            )}
          </GlassCard>
        </div>
      );
    }

    // Component level shows inline error
    return (
      <div
        className="rounded-lg p-4 flex items-start gap-3"
        style={{
          backgroundColor: 'var(--pro-error-muted)',
          border: '1px solid var(--pro-error)',
        }}
      >
        <AlertTriangle
          size={18}
          className="flex-shrink-0 mt-0.5"
          style={{ color: 'var(--pro-error)' }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--pro-text-primary)' }}
          >
            컴포넌트 로드 중 오류가 발생했습니다
          </p>
          {showDetails && error && (
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--pro-text-muted)' }}
            >
              {error.message}
            </p>
          )}
        </div>
        {canRetry && (
          <button
            onClick={this.handleRetry}
            className="flex-shrink-0 p-1.5 rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'var(--pro-error)' }}
            title="다시 시도"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>
    );
  }
}

// ============================================================================
// HOC for wrapping components with error boundary
// ============================================================================

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

// ============================================================================
// Utility hook for triggering error boundary
// ============================================================================

export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  if (error) {
    throw error;
  }

  return React.useCallback((error: Error) => {
    setError(error);
  }, []);
}

export default ErrorBoundary;
