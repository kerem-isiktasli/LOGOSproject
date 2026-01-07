/**
 * AppContext
 *
 * Global application state for LOGOS.
 * Manages active goal, user preferences, and app-wide state.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useGoals, useGoal, useProgress, useMasteryStats } from '../hooks/useLogos';

// ============================================================================
// Types
// ============================================================================

interface Goal {
  id: string;
  name: string;
  targetLanguage: string;
  nativeLanguage: string;
  description?: string;
  isActive: boolean;
}

interface AppState {
  // Active goal
  activeGoalId: string | null;
  activeGoal: Goal | null;
  goals: Goal[];
  goalsLoading: boolean;

  // Progress data
  progress: any | null;
  masteryStats: any | null;

  // UI state
  sidebarCollapsed: boolean;
  focusMode: boolean;
  theme: 'light' | 'dark' | 'system';

  // Actions
  setActiveGoal: (goalId: string | null) => void;
  refreshGoals: () => Promise<void>;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const defaultState: AppState = {
  activeGoalId: null,
  activeGoal: null,
  goals: [],
  goalsLoading: true,
  progress: null,
  masteryStats: null,
  sidebarCollapsed: false,
  focusMode: false,
  theme: 'system',
  setActiveGoal: () => {},
  refreshGoals: async () => {},
  toggleSidebar: () => {},
  toggleFocusMode: () => {},
  setTheme: () => {},
};

// ============================================================================
// Context
// ============================================================================

const AppContext = createContext<AppState>(defaultState);

export const useApp = () => useContext(AppContext);

// ============================================================================
// Provider
// ============================================================================

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Local state
  const [activeGoalId, setActiveGoalId] = useState<string | null>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('logos_active_goal') || null;
    }
    return null;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system');

  // Data fetching
  const { data: goals, loading: goalsLoading, refetch: refreshGoals } = useGoals();
  const { data: activeGoal } = useGoal(activeGoalId);
  const { data: progress } = useProgress(activeGoalId);
  const { data: masteryStats } = useMasteryStats(activeGoalId);

  // Persist active goal
  useEffect(() => {
    if (activeGoalId) {
      localStorage.setItem('logos_active_goal', activeGoalId);
    } else {
      localStorage.removeItem('logos_active_goal');
    }
  }, [activeGoalId]);

  // Auto-select first goal if none selected
  useEffect(() => {
    if (!activeGoalId && goals && goals.length > 0) {
      setActiveGoalId(goals[0].id);
    }
  }, [activeGoalId, goals]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Apply focus mode
  useEffect(() => {
    document.documentElement.setAttribute('data-focus-mode', String(focusMode));
  }, [focusMode]);

  // Actions
  const setActiveGoal = useCallback((goalId: string | null) => {
    setActiveGoalId(goalId);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => !prev);
  }, []);

  const setTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('logos_theme', newTheme);
  }, []);

  const value: AppState = {
    activeGoalId,
    activeGoal,
    goals: goals || [],
    goalsLoading,
    progress,
    masteryStats,
    sidebarCollapsed,
    focusMode,
    theme,
    setActiveGoal,
    refreshGoals,
    toggleSidebar,
    toggleFocusMode,
    setTheme,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
