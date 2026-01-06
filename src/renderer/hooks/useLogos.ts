/**
 * useLogos Hook
 *
 * Type-safe React hooks for accessing the LOGOS IPC API.
 * Provides reactive data fetching and mutations.
 */

import { useState, useCallback, useEffect } from 'react';

// Get the LOGOS API from window (exposed by preload)
const logos = typeof window !== 'undefined' ? (window as any).logos : null;

// ============================================================================
// Generic Hook Helpers
// ============================================================================

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(asyncFn: () => Promise<T>, deps: any[] = []): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await asyncFn();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { ...state, refetch: execute };
}

// ============================================================================
// Goal Hooks
// ============================================================================

export function useGoals(includeInactive = false) {
  return useAsync(() => logos?.goal.list(includeInactive) ?? Promise.resolve([]), [includeInactive]);
}

export function useGoal(id: string | null) {
  return useAsync(() => id ? logos?.goal.get(id) : Promise.resolve(null), [id]);
}

export function useCreateGoal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGoal = useCallback(async (data: {
    name: string;
    targetLanguage: string;
    nativeLanguage: string;
    description?: string;
    targetLevel?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await logos?.goal.create(data);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
      setLoading(false);
      throw err;
    }
  }, []);

  return { createGoal, loading, error };
}

export function useUpdateGoal() {
  const [loading, setLoading] = useState(false);

  const updateGoal = useCallback(async (data: { id: string; name?: string; description?: string; isActive?: boolean }) => {
    setLoading(true);
    try {
      const result = await logos?.goal.update(data);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { updateGoal, loading };
}

export function useDeleteGoal() {
  const [loading, setLoading] = useState(false);

  const deleteGoal = useCallback(async (id: string, hard = false) => {
    setLoading(true);
    try {
      await logos?.goal.delete(id, hard);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { deleteGoal, loading };
}

// ============================================================================
// Learning Object Hooks
// ============================================================================

export function useObjects(goalId: string | null, options?: { type?: string; limit?: number }) {
  return useAsync(
    () => goalId ? logos?.object.list(goalId, options) : Promise.resolve([]),
    [goalId, options?.type, options?.limit]
  );
}

export function useCreateObject() {
  const [loading, setLoading] = useState(false);

  const createObject = useCallback(async (data: {
    goalId: string;
    content: string;
    type: string;
    translation?: string;
    frequency?: number;
  }) => {
    setLoading(true);
    try {
      const result = await logos?.object.create(data);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { createObject, loading };
}

export function useImportObjects() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const importObjects = useCallback(async (goalId: string, objects: Array<{ content: string; type: string; translation?: string }>) => {
    setLoading(true);
    setProgress(0);
    try {
      const result = await logos?.object.import(goalId, objects);
      setProgress(100);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { importObjects, loading, progress };
}

// ============================================================================
// Queue Hooks
// ============================================================================

export function useQueue(goalId: string | null, options?: { sessionSize?: number; newItemRatio?: number }) {
  return useAsync(
    () => goalId ? logos?.queue.build(goalId, options) : Promise.resolve([]),
    [goalId, options?.sessionSize, options?.newItemRatio]
  );
}

export function useNextItem(goalId: string | null, excludeIds: string[] = []) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchNext = useCallback(async () => {
    if (!goalId) return null;
    setLoading(true);
    try {
      const result = await logos?.queue.getNext(goalId, excludeIds);
      setItem(result);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [goalId, excludeIds.join(',')]);

  return { item, fetchNext, loading };
}

// ============================================================================
// Session Hooks
// ============================================================================

export function useSession(goalId: string | null) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const startSession = useCallback(async (type: 'learn' | 'review' | 'mixed', targetDuration?: number) => {
    if (!goalId) return null;
    setLoading(true);
    try {
      const result = await logos?.session.start(goalId, type, targetDuration);
      setSession(result);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [goalId]);

  const endSession = useCallback(async () => {
    if (!session?.id) return null;
    setLoading(true);
    try {
      const result = await logos?.session.end(session.id);
      setSession(null);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [session?.id]);

  const recordResponse = useCallback(async (data: {
    objectId: string;
    correct: boolean;
    cueLevel: 0 | 1 | 2 | 3;
    responseTimeMs: number;
    errorComponents?: string[];
  }) => {
    if (!session?.id) return null;
    try {
      return await logos?.session.recordResponse({ sessionId: session.id, ...data });
    } catch (err) {
      throw err;
    }
  }, [session?.id]);

  return { session, startSession, endSession, recordResponse, loading };
}

export function useSessionHistory(goalId: string | null, limit = 20) {
  return useAsync(
    () => goalId ? logos?.session.getHistory(goalId, { limit }) : Promise.resolve([]),
    [goalId, limit]
  );
}

// ============================================================================
// Standalone Session Action Hooks
// (Wrappers for use without useSession's state management)
// ============================================================================

export function useStartSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (params: { goalId: string; type?: 'learn' | 'review' | 'mixed'; targetDuration?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await logos?.session.start(params.goalId, params.type || 'mixed', params.targetDuration);
      setLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start session';
      setError(message);
      setLoading(false);
      throw err;
    }
  }, []);

  return { execute, loading, error };
}

export function useEndSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (params: { sessionId: string; stats?: any }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await logos?.session.end(params.sessionId);
      setLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end session';
      setError(message);
      setLoading(false);
      throw err;
    }
  }, []);

  return { execute, loading, error };
}

export function useRecordResponse() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (params: {
    sessionId: string;
    itemId: string;
    response: string;
    correct: boolean;
    responseTime: number;
    scaffoldingUsed?: string[];
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await logos?.session.recordResponse({
        sessionId: params.sessionId,
        objectId: params.itemId,
        correct: params.correct,
        cueLevel: (params.scaffoldingUsed?.length || 0) as 0 | 1 | 2 | 3,
        responseTimeMs: params.responseTime,
      });
      setLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record response';
      setError(message);
      setLoading(false);
      throw err;
    }
  }, []);

  return { execute, loading, error };
}

// ============================================================================
// Analytics Hooks
// ============================================================================

export function useProgress(goalId: string | null, timeRange?: 'day' | 'week' | 'month' | 'all') {
  return useAsync(
    () => goalId ? logos?.analytics.getProgress(goalId, timeRange) : Promise.resolve(null),
    [goalId, timeRange]
  );
}

export function useBottlenecks(goalId: string | null) {
  return useAsync(
    () => goalId ? logos?.analytics.getBottlenecks(goalId) : Promise.resolve(null),
    [goalId]
  );
}

export function useSessionStats(goalId: string | null, days = 30) {
  return useAsync(
    () => goalId ? logos?.analytics.getSessionStats(goalId, days) : Promise.resolve(null),
    [goalId, days]
  );
}

// ============================================================================
// Mastery Hooks
// ============================================================================

export function useMastery(objectId: string | null) {
  return useAsync(
    () => objectId ? logos?.mastery.get(objectId) : Promise.resolve(null),
    [objectId]
  );
}

export function useMasteryStats(goalId: string | null) {
  return useAsync(
    () => goalId ? logos?.mastery.getStats(goalId) : Promise.resolve(null),
    [goalId]
  );
}

// ============================================================================
// Claude Hooks
// ============================================================================

export function useGenerateContent() {
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (type: 'exercise' | 'explanation' | 'example', objectId: string, context?: string) => {
    setLoading(true);
    try {
      const result = await logos?.claude.generateContent(type, objectId, context);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { generate, loading };
}

export function useAnalyzeError() {
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async (objectId: string, userResponse: string, expectedResponse: string) => {
    setLoading(true);
    try {
      const result = await logos?.claude.analyzeError(objectId, userResponse, expectedResponse);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { analyze, loading };
}

export function useGetHint() {
  const [loading, setLoading] = useState(false);

  const getHint = useCallback(async (objectId: string, level: 1 | 2 | 3, previousHints?: string[]) => {
    setLoading(true);
    try {
      const result = await logos?.claude.getHint(objectId, level, previousHints);
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { getHint, loading };
}

// ============================================================================
// Onboarding Hooks
// ============================================================================

interface OnboardingStatus {
  needsOnboarding: boolean;
  hasUser: boolean;
  hasGoals: boolean;
  userId?: string;
}

interface OnboardingData {
  nativeLanguage: string;
  targetLanguage: string;
  domain: string;
  modality: string[];
  purpose: string;
  benchmark?: string;
  deadline?: string;
  dailyTime: number;
}

interface OnboardingResult {
  userId: string;
  goalId: string;
  nativeLanguage: string;
  targetLanguage: string;
  domain: string;
  modality: string[];
  purpose: string;
}

export function useOnboardingStatus() {
  return useAsync<OnboardingStatus>(
    () => logos?.onboarding?.checkStatus() ?? Promise.resolve({ needsOnboarding: false, hasUser: true, hasGoals: true }),
    []
  );
}

export function useCompleteOnboarding() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async (data: OnboardingData): Promise<OnboardingResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await logos?.onboarding?.complete(data);
      setLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete onboarding';
      setError(message);
      setLoading(false);
      throw err;
    }
  }, []);

  return { complete, loading, error };
}

export function useSkipOnboarding() {
  const [loading, setLoading] = useState(false);

  const skip = useCallback(async () => {
    setLoading(true);
    try {
      const result = await logos?.onboarding?.skip();
      setLoading(false);
      return result;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  return { skip, loading };
}

export default {
  useGoals, useGoal, useCreateGoal, useUpdateGoal, useDeleteGoal,
  useObjects, useCreateObject, useImportObjects,
  useQueue, useNextItem,
  useSession, useSessionHistory, useStartSession, useEndSession, useRecordResponse,
  useProgress, useBottlenecks, useSessionStats,
  useMastery, useMasteryStats,
  useGenerateContent, useAnalyzeError, useGetHint,
  useOnboardingStatus, useCompleteOnboarding, useSkipOnboarding,
};
