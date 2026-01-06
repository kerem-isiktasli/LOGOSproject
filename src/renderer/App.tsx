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

// Simple client-side routing
type Page = 'dashboard' | 'session' | 'goals' | 'analytics' | 'vocabulary';

// Navigation icons
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const SessionIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const GoalsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const VocabularyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

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
        setShowOnboarding(false);
        // Refresh goals to pick up the new goal
        refreshGoals();
        // Set the new goal as active
        setActiveGoal(result.goalId);
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

  // Build navigation items
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      active: currentPage === 'dashboard',
      onClick: () => navigateTo('dashboard'),
    },
    {
      id: 'session',
      label: 'Practice',
      icon: <SessionIcon />,
      active: currentPage === 'session',
      onClick: () => navigateTo('session'),
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: <GoalsIcon />,
      active: currentPage === 'goals',
      onClick: () => navigateTo('goals'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <AnalyticsIcon />,
      active: currentPage === 'analytics',
      onClick: () => navigateTo('analytics'),
    },
    {
      id: 'vocabulary',
      label: 'Vocabulary',
      icon: <VocabularyIcon />,
      active: currentPage === 'vocabulary',
      onClick: () => navigateTo('vocabulary'),
    },
  ];

  const secondaryItems = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon />,
      onClick: () => console.log('Settings clicked'),
    },
  ];

  // Build sidebar
  const sidebar = (
    <Sidebar
      activeGoal={activeGoal ? {
        id: activeGoal.id,
        name: activeGoal.name,
        targetLanguage: activeGoal.targetLanguage,
      } : undefined}
      goals={goals?.map((g: any) => ({
        id: g.id,
        name: g.name,
        targetLanguage: g.targetLanguage,
      })) || []}
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
