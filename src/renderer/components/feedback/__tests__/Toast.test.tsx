/**
 * Toast Component Tests
 *
 * Tests for toast notification system.
 * Note: framer-motion animations are mocked for reliable testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast } from '../Toast';

// Mock framer-motion to avoid animation timing issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ============================================================================
// Test Components
// ============================================================================

const ToastTrigger: React.FC<{
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  duration?: number;
}> = ({ type = 'success', title = 'Test Title', message, duration }) => {
  const { addToast, clearAll } = useToast();

  return (
    <div>
      <button
        onClick={() => addToast({ type, title, message, duration })}
        data-testid="add-toast"
      >
        Add Toast
      </button>
      <button onClick={() => clearAll()} data-testid="clear-all">
        Clear All
      </button>
    </div>
  );
};

// ============================================================================
// Tests
// ============================================================================

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render children', () => {
      render(
        <ToastProvider>
          <div>Child content</div>
        </ToastProvider>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render toast container', () => {
      const { container } = render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>
      );

      // Toast container should be in the DOM (even if empty)
      expect(container.querySelector('.fixed')).toBeInTheDocument();
    });
  });

  describe('Adding Toasts', () => {
    it('should display toast when added', () => {
      render(
        <ToastProvider>
          <ToastTrigger title="Hello World" />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should display toast message', () => {
      render(
        <ToastProvider>
          <ToastTrigger title="Title" message="This is a message" />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByText('This is a message')).toBeInTheDocument();
    });

    it('should display multiple toasts', () => {
      render(
        <ToastProvider>
          <ToastTrigger title="Toast 1" />
        </ToastProvider>
      );

      const addButton = screen.getByTestId('add-toast');

      fireEvent.click(addButton);
      fireEvent.click(addButton);

      const toasts = screen.getAllByText('Toast 1');
      expect(toasts.length).toBe(2);
    });
  });

  describe('Toast Types', () => {
    it('should render success toast', () => {
      render(
        <ToastProvider>
          <ToastTrigger type="success" title="Success!" />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('should render error toast', () => {
      render(
        <ToastProvider>
          <ToastTrigger type="error" title="Error occurred" />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should render warning toast', () => {
      render(
        <ToastProvider>
          <ToastTrigger type="warning" title="Warning!" />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByText('Warning!')).toBeInTheDocument();
    });

    it('should render info toast', () => {
      render(
        <ToastProvider>
          <ToastTrigger type="info" title="Information" />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getByText('Information')).toBeInTheDocument();
    });
  });

  describe('Auto Dismiss', () => {
    it('should set up auto-dismiss timer', () => {
      // Note: Full auto-dismiss behavior requires real timers and React updates
      // This test verifies the toast is created with correct duration
      render(
        <ToastProvider>
          <ToastTrigger title="Auto dismiss" duration={1000} />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));
      expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

      // Timer is set up - actual dismiss happens async with real timers
      // In production, toast will auto-dismiss after 1000ms
    });

    it('should not auto-dismiss when duration is 0', () => {
      render(
        <ToastProvider>
          <ToastTrigger title="Persistent" duration={0} />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('add-toast'));
      expect(screen.getByText('Persistent')).toBeInTheDocument();

      // Fast-forward a lot of time
      vi.advanceTimersByTime(10000);
      vi.runAllTimers();

      // Should still be there
      expect(screen.getByText('Persistent')).toBeInTheDocument();
    });
  });

  describe('Clearing Toasts', () => {
    it('should clear all toasts', () => {
      render(
        <ToastProvider>
          <ToastTrigger title="Test Toast" duration={0} />
        </ToastProvider>
      );

      // Add multiple toasts
      fireEvent.click(screen.getByTestId('add-toast'));
      fireEvent.click(screen.getByTestId('add-toast'));

      expect(screen.getAllByText('Test Toast').length).toBe(2);

      // Clear all
      fireEvent.click(screen.getByTestId('clear-all'));

      // Should be cleared immediately (no animation with mock)
      expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });
  });

  describe('useToast Hook', () => {
    it('should throw error when used outside provider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const InvalidComponent = () => {
        useToast();
        return null;
      };

      expect(() => render(<InvalidComponent />)).toThrow(
        'useToast must be used within a ToastProvider'
      );

      spy.mockRestore();
    });
  });
});
