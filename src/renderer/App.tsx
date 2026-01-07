/**
 * LOGOS App
 *
 * Root React component with routing and providers.
 * Includes onboarding flow for new users.
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context';
import { AppShell, Sidebar } from './components/layout';
import { DashboardPage, SessionPage, GoalsPage } from './pages';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { OnboardingWizard } from './components/onboarding';
import { useOnboardingStatus, useCompleteOnboarding, useSkipOnboarding } from './hooks/useLogos';
import { ToastProvider } from './components/feedback';
import { ErrorBoundary, NetworkErrorHandler } from './components/error';
import {
  LayoutDashboard,
  BookOpen,
  Target,
  Settings,
  BarChart3,
  Library,
} from 'lucide-react';

// Simple client-side routing
type Page = 'dashboard' | 'session' | 'goals' | 'analytics' | 'vocabulary';

// Main app content with navigation
const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { activeGoal, goals, setActiveGoal, refreshGoals } = useApp();

  // Onboarding hooks
  const { data: onboardingStatus, loading: statusLoading } = useOnboardingStatus();
  const { complete: completeOnboarding } = useCompleteOnboarding();
  const { skip: skipOnboarding } = useSkipOnboarding();

  // Check if onboarding is needed on mount
  useEffect(() => {
    if (!statusLoading && onboardingStatus) {
      setShowOnboarding(onboardingStatus.needsOnboarding);
    }
  }, [statusLoading, onboardingStatus]);

  // Handle onboarding completion
  const handleOnboardingComplete = async (data: {
    nativeLanguage: string;
    targetLanguage: string;
    domain: string;
    modality: string[];
    purpose: string;
    benchmark?: string;
    deadline?: string;
    dailyTime: number;
  }) => {
    try {
      const result = await completeOnboarding(data);
      if (result) {
        // Set the new goal as active first (this ID is already valid)
        setActiveGoal(result.goalId);
        // Wait for goals list to refresh (ensures sidebar shows new goal)
        await refreshGoals();
        // State is now fully propagated, hide onboarding
        setShowOnboarding(false);
      }
    } catch (error) {
      console.error('Onboarding failed:', error);
    }
  };

  // Handle onboarding skip
  const handleOnboardingSkip = async () => {
    try {
      await skipOnboarding();
      setShowOnboarding(false);
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  };

  // Navigation handlers
  const navigateTo = (page: Page) => setCurrentPage(page);

  // Build navigation items (using Lucide icons for consistency)
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      active: currentPage === 'dashboard',
      onClick: () => navigateTo('dashboard'),
    },
    {
      id: 'session',
      label: 'Practice',
      icon: <BookOpen size={20} />,
      active: currentPage === 'session',
      onClick: () => navigateTo('session'),
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: <Target size={20} />,
      active: currentPage === 'goals',
      onClick: () => navigateTo('goals'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 size={20} />,
      active: currentPage === 'analytics',
      onClick: () => navigateTo('analytics'),
    },
    {
      id: 'vocabulary',
      label: 'Vocabulary',
      icon: <Library size={20} />,
      active: currentPage === 'vocabulary',
      onClick: () => navigateTo('vocabulary'),
    },
  ];

  const secondaryItems = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={20} />,
      onClick: () => console.log('Settings clicked'),
    },
  ];

  // Build sidebar
  // Map GoalSpec fields (genre, domain) to Sidebar expected format (name, targetLanguage)
  const sidebar = (
    <Sidebar
      activeGoal={activeGoal ? {
        id: activeGoal.id,
        name: activeGoal.genre || activeGoal.name || 'Goal',
        targetLanguage: activeGoal.domain || activeGoal.targetLanguage || 'general',
      } : undefined}
      goals={Array.isArray(goals) ? goals.map((g: any) => ({
        id: g.id,
        name: g.genre || g.name || 'Goal',
        targetLanguage: g.domain || g.targetLanguage || 'general',
      })) : []}
      onGoalChange={setActiveGoal}
      onCreateGoal={() => navigateTo('goals')}
      navItems={navItems}
      secondaryItems={secondaryItems}
    />
  );

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigateToSession={() => navigateTo('session')}
            onNavigateToGoals={() => navigateTo('goals')}
          />
        );
      case 'session':
        return (
          <SessionPage
            onNavigateBack={() => navigateTo('dashboard')}
          />
        );
      case 'goals':
        return (
          <GoalsPage
            onNavigateBack={() => navigateTo('dashboard')}
            onSelectGoal={() => navigateTo('dashboard')}
          />
        );
      case 'analytics':
        return (
          <AnalyticsPage
            goalId={activeGoal?.id}
          />
        );
      case 'vocabulary':
        return (
          <VocabularyPage
            goalId={activeGoal?.id}
            onNavigateBack={() => navigateTo('dashboard')}
          />
        );
      default:
        return <DashboardPage />;
    }
  };

  // Show loading state while checking onboarding status
  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Show onboarding wizard for new users
  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  return (
    <AppShell sidebar={sidebar}>
      {renderPage()}
    </AppShell>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary level="critical" showDetails={process.env.NODE_ENV === 'development'}>
      <AppProvider>
        <ToastProvider>
          <NetworkErrorHandler>
            <AppContent />
          </NetworkErrorHandler>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
