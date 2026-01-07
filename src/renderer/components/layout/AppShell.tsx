/**
 * AppShell Component
 *
 * The root layout container for the LOGOS application.
 * Provides the structural framework with sidebar, header, and main content area.
 *
 * Design Philosophy:
 * - Glass surfaces create distinct functional layers
 * - Sidebar floats independently for visual hierarchy
 * - Content area maximizes focus during learning sessions
 * - Responsive layout adapts to screen size
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// ============================================================================
// Context for Shell State
// ============================================================================

interface AppShellContextValue {
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state directly */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Whether in focus mode (reduced UI during learning) */
  focusMode: boolean;
  /** Toggle focus mode */
  toggleFocusMode: () => void;
  /** Current theme */
  theme: 'light' | 'dark' | 'system';
  /** Set theme */
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export const useAppShell = () => {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within an AppShell');
  }
  return context;
};

// ============================================================================
// AppShell Component
// ============================================================================

export interface AppShellProps {
  /** Child components */
  children: React.ReactNode;
  /** Initial sidebar collapsed state */
  defaultSidebarCollapsed?: boolean;
  /** Sidebar content */
  sidebar?: React.ReactNode;
  /** Header content */
  header?: React.ReactNode;
  /** Initial theme */
  defaultTheme?: 'light' | 'dark' | 'system';
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  defaultSidebarCollapsed = false,
  sidebar,
  header,
  defaultTheme = 'system',
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultSidebarCollapsed);
  const [focusMode, setFocusMode] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(defaultTheme);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => !prev);
  }, []);

  // Apply theme to document
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Apply focus mode
  React.useEffect(() => {
    document.documentElement.setAttribute('data-focus-mode', String(focusMode));
  }, [focusMode]);

  const contextValue: AppShellContextValue = {
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    focusMode,
    toggleFocusMode,
    theme,
    setTheme,
  };

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed}>
        {/* Sidebar */}
        {sidebar && !focusMode && (
          <aside
            className={`app-shell-sidebar ${
              sidebarCollapsed ? 'app-shell-sidebar--collapsed' : ''
            }`}
          >
            {sidebar}
          </aside>
        )}

        {/* Main container */}
        <div className="app-shell-main">
          {/* Header */}
          {header && !focusMode && (
            <header className="app-shell-header">{header}</header>
          )}

          {/* Content */}
          <main className="app-shell-content">{children}</main>
        </div>
      </div>

      <style>{`
        .app-shell {
          display: flex;
          height: 100vh;
          width: 100%;
        }

        .app-shell-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: var(--sidebar-width);
          z-index: var(--z-fixed);
          transition: width var(--duration-300) var(--ease-glass),
                      transform var(--duration-300) var(--ease-glass);
        }

        .app-shell-sidebar--collapsed {
          width: var(--sidebar-collapsed-width);
        }

        .app-shell-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          margin-left: var(--sidebar-width);
          transition: margin-left var(--duration-300) var(--ease-glass);
        }

        .app-shell[data-sidebar-collapsed="true"] .app-shell-main {
          margin-left: var(--sidebar-collapsed-width);
        }

        .app-shell-header {
          position: sticky;
          top: 0;
          z-index: var(--z-sticky);
          height: var(--header-height);
          padding: 0 var(--space-6);
          display: flex;
          align-items: center;
        }

        .app-shell-content {
          flex: 1;
          padding: var(--space-6);
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Focus mode - sidebar hidden */
        [data-focus-mode="true"] .app-shell-sidebar {
          transform: translateX(-100%);
        }

        [data-focus-mode="true"] .app-shell-main {
          margin-left: 0;
        }

        [data-focus-mode="true"] .app-shell-header {
          display: none;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .app-shell-sidebar {
            transform: translateX(-100%);
          }

          .app-shell-sidebar.app-shell-sidebar--open {
            transform: translateX(0);
          }

          .app-shell-main {
            margin-left: 0;
          }
        }
      `}</style>
    </AppShellContext.Provider>
  );
};

// ============================================================================
// Header Component
// ============================================================================

export interface AppHeaderProps {
  /** Left side content (e.g., breadcrumbs, title) */
  left?: React.ReactNode;
  /** Center content */
  center?: React.ReactNode;
  /** Right side content (e.g., actions, user menu) */
  right?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  left,
  center,
  right,
  className = '',
}) => {
  return (
    <div className={`app-header glass-light ${className}`}>
      <div className="app-header-left">{left}</div>
      {center && <div className="app-header-center">{center}</div>}
      <div className="app-header-right">{right}</div>

      <style>{`
        .app-header {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-4);
          border-radius: var(--radius-2xl);
        }

        .app-header-left,
        .app-header-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .app-header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Content Container
// ============================================================================

export interface ContentContainerProps {
  /** Child content */
  children: React.ReactNode;
  /** Maximum width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Center the content */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  maxWidth = '2xl',
  centered = true,
  className = '',
}) => {
  return (
    <div
      className={`content-container ${maxWidthClasses[maxWidth]} ${
        centered ? 'mx-auto' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default AppShell;
