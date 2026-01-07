/**
 * ErrorBoundary Component Tests
 *
 * Tests for React Error Boundary with retry capability.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from '../ErrorBoundary';

// ============================================================================
// Test Components
// ============================================================================

const ThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal render</div>;
};

const ControlledThrowingComponent: React.FC<{ error: Error | null }> = ({ error }) => {
  if (error) {
    throw error;
  }
  return <div>No error</div>;
};

// ============================================================================
// Tests
// ============================================================================

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should catch errors and show fallback UI', () => {
      // Suppress React error boundary console output
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="component">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();

      spy.mockRestore();
    });

    it('should use custom fallback when provided', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom fallback')).toBeInTheDocument();

      spy.mockRestore();
    });
  });

  describe('Error Levels', () => {
    it('should render full-page error for critical level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="critical">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();
      // Use getAllByText since "다시 시도" appears in both text and button
      const retryElements = screen.getAllByText(/다시 시도/);
      expect(retryElements.length).toBeGreaterThan(0);

      spy.mockRestore();
    });

    it('should render inline error for component level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="component">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('컴포넌트 로드 중 오류가 발생했습니다')).toBeInTheDocument();

      spy.mockRestore();
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="critical">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      // Use getAllByText since "다시 시도" appears in multiple places
      const retryElements = screen.getAllByText(/다시 시도/);
      expect(retryElements.length).toBeGreaterThan(0);

      spy.mockRestore();
    });

    it('should show remaining retry count', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="critical">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/3회 남음/)).toBeInTheDocument();

      spy.mockRestore();
    });
  });

  describe('Error Details', () => {
    it('should show error details when showDetails is true', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="critical" showDetails={true}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Test error/)).toBeInTheDocument();

      spy.mockRestore();
    });

    it('should hide error details when showDetails is false', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary level="critical" showDetails={false}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      // Error message should only appear in the general text, not detailed
      const detailedError = screen.queryByText('Error: Test error');
      expect(detailedError).not.toBeInTheDocument();

      spy.mockRestore();
    });
  });

  describe('Callbacks', () => {
    it('should call onError when error occurs', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) })
      );

      spy.mockRestore();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const WrappedComponent = withErrorBoundary(ThrowingComponent, { level: 'component' });

    render(<WrappedComponent />);

    expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();

    spy.mockRestore();
  });

  it('should render wrapped component when no error', () => {
    const SafeComponent: React.FC = () => <div>Safe content</div>;
    const WrappedComponent = withErrorBoundary(SafeComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });
});

describe('useErrorHandler', () => {
  it('should throw error when called', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestComponent: React.FC = () => {
      const handleError = useErrorHandler();

      React.useEffect(() => {
        handleError(new Error('Async error'));
      }, [handleError]);

      return <div>Test</div>;
    };

    render(
      <ErrorBoundary level="component">
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument();

    spy.mockRestore();
  });
});
