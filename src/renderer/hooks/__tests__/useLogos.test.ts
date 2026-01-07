/**
 * useLogos Hooks Tests
 *
 * Tests for LOGOS IPC API hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useGoals,
  useGoal,
  useCreateGoal,
  useSession,
  useQueue,
  useOnboardingStatus,
  categorizeError,
  type LogosError,
} from '../useLogos';

// Get mock logos from window
const mockLogos = (window as any).logos;

// ============================================================================
// Error Categorization Tests
// ============================================================================

describe('categorizeError', () => {
  it('should categorize network errors', () => {
    const error = new Error('Network request failed');
    const result = (categorizeError as any)(error);

    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  it('should categorize fetch errors', () => {
    const error = new Error('Fetch failed');
    const result = (categorizeError as any)(error);

    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  it('should categorize timeout errors', () => {
    const error = new Error('Request timeout');
    const result = (categorizeError as any)(error);

    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  it('should categorize validation errors', () => {
    const error = new Error('Validation failed: invalid input');
    const result = (categorizeError as any)(error);

    expect(result.type).toBe('validation');
    expect(result.retryable).toBe(false);
  });

  it('should categorize server errors', () => {
    const error = new Error('500 Internal Server Error');
    const result = (categorizeError as any)(error);

    expect(result.type).toBe('server');
    expect(result.retryable).toBe(true);
  });

  it('should categorize unknown errors', () => {
    const error = new Error('Something weird happened');
    const result = (categorizeError as any)(error);

    expect(result.type).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error objects', () => {
    const result = (categorizeError as any)('String error');

    expect(result.type).toBe('unknown');
    expect(result.message).toBe('String error');
  });
});

// ============================================================================
// Goal Hooks Tests
// ============================================================================

describe('useGoals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch goals on mount', async () => {
    const mockGoals = [
      { id: '1', name: 'Japanese' },
      { id: '2', name: 'Spanish' },
    ];
    mockLogos.goal.list.mockResolvedValue(mockGoals);

    const { result } = renderHook(() => useGoals());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockGoals);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    mockLogos.goal.list.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useGoals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
  });
});

describe('useGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch specific goal', async () => {
    const mockGoal = { id: '123', name: 'Japanese' };
    mockLogos.goal.get.mockResolvedValue(mockGoal);

    const { result } = renderHook(() => useGoal('123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockGoal);
  });

  it('should return null for null id', async () => {
    const { result } = renderHook(() => useGoal(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(mockLogos.goal.get).not.toHaveBeenCalled();
  });
});

describe('useCreateGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create goal successfully', async () => {
    const mockResult = { id: 'new-goal', name: 'French' };
    mockLogos.goal.create.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useCreateGoal());

    let createResult;
    await act(async () => {
      createResult = await result.current.createGoal({
        name: 'French',
        targetLanguage: 'fr',
        nativeLanguage: 'en',
      });
    });

    expect(createResult).toEqual(mockResult);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle create error', async () => {
    mockLogos.goal.create.mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => useCreateGoal());

    await act(async () => {
      try {
        await result.current.createGoal({
          name: 'French',
          targetLanguage: 'fr',
          nativeLanguage: 'en',
        });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('Create failed');
  });
});

// ============================================================================
// Queue Hooks Tests
// ============================================================================

describe('useQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch queue for goal', async () => {
    const mockQueue = [
      { id: '1', content: 'Word 1', priority: 0.9 },
      { id: '2', content: 'Word 2', priority: 0.7 },
    ];
    mockLogos.queue.build.mockResolvedValue(mockQueue);

    const { result } = renderHook(() => useQueue('goal-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockQueue);
  });

  it('should return empty for null goalId', async () => {
    const { result } = renderHook(() => useQueue(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });
});

// ============================================================================
// Session Hooks Tests
// ============================================================================

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start session', async () => {
    const mockSession = { id: 'session-1', mode: 'mixed' };
    mockLogos.session.start.mockResolvedValue(mockSession);

    const { result } = renderHook(() => useSession('goal-id'));

    await act(async () => {
      await result.current.startSession('mixed');
    });

    expect(result.current.session).toEqual(mockSession);
  });

  it('should end session', async () => {
    mockLogos.session.start.mockResolvedValue({ id: 'session-1' });
    mockLogos.session.end.mockResolvedValue({ summary: {} });

    const { result } = renderHook(() => useSession('goal-id'));

    await act(async () => {
      await result.current.startSession('mixed');
    });

    await act(async () => {
      await result.current.endSession();
    });

    expect(result.current.session).toBeNull();
  });

  it('should record response', async () => {
    mockLogos.session.start.mockResolvedValue({ id: 'session-1' });
    mockLogos.session.recordResponse.mockResolvedValue({ updated: true });

    const { result } = renderHook(() => useSession('goal-id'));

    await act(async () => {
      await result.current.startSession('mixed');
    });

    await act(async () => {
      await result.current.recordResponse({
        objectId: 'obj-1',
        correct: true,
        cueLevel: 0,
        responseTimeMs: 1500,
      });
    });

    expect(mockLogos.session.recordResponse).toHaveBeenCalled();
  });
});

// ============================================================================
// Onboarding Hooks Tests
// ============================================================================

describe('useOnboardingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check onboarding status', async () => {
    mockLogos.onboarding.checkStatus.mockResolvedValue({
      needsOnboarding: true,
      hasUser: false,
      hasGoals: false,
    });

    const { result } = renderHook(() => useOnboardingStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.needsOnboarding).toBe(true);
  });
});
