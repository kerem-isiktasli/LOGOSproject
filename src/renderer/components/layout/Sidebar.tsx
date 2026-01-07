/**
 * Sidebar Component
 *
 * Navigation sidebar with Liquid Glass aesthetic.
 * Provides goal selection, navigation, and quick actions.
 *
 * Design Philosophy:
 * - Sidebar is a floating glass panel, visually distinct from content
 * - Collapsed state maintains icon visibility for quick access
 * - Active state uses inner glow rather than harsh backgrounds
 * - Goal selector at top establishes learning context
 */

import React from 'react';
import { useAppShell } from './AppShell';
import { GlassButton, GlassIconButton } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface NavItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component or element */
  icon: React.ReactNode;
  /** Navigation path */
  href?: string;
  /** Click handler (alternative to href) */
  onClick?: () => void;
  /** Whether this item is currently active */
  active?: boolean;
  /** Badge content (e.g., notification count) */
  badge?: string | number;
  /** Nested items for expandable sections */
  children?: NavItem[];
}

/**
 * Goal display info derived from GoalSpec.
 * Uses domain for category badge and genre for display name.
 */
export interface SidebarGoal {
  id: string;
  /** Display name - typically the genre (e.g., "conversation", "report") */
  genre: string;
  /** Domain category (e.g., "medical", "legal", "general") */
  domain: string;
  /** Optional modalities for additional context */
  modality?: string[];
}

export interface SidebarProps {
  /** Current active goal */
  activeGoal?: SidebarGoal;
  /** List of available goals */
  goals?: SidebarGoal[];
  /** Callback when goal is changed */
  onGoalChange?: (goalId: string) => void;
  /** Callback to create a new goal */
  onCreateGoal?: () => void;
  /** Primary navigation items */
  navItems: NavItem[];
  /** Secondary/utility navigation items */
  secondaryItems?: NavItem[];
  /** User information for avatar/profile section */
  user?: {
    name: string;
    avatar?: string;
  };
  /** Callback for user menu actions */
  onUserAction?: (action: 'profile' | 'settings' | 'logout') => void;
}

// ============================================================================
// Icons (inline SVG for simplicity)
// ============================================================================

const ChevronIcon: React.FC<{ direction?: 'left' | 'right' | 'down' }> = ({
  direction = 'right',
}) => {
  const rotation = { left: 180, right: 0, down: 90 }[direction];
  return (
    <svg
      className="w-4 h-4"
      style={{ transform: `rotate(${rotation}deg)` }}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
};

const MenuIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// ============================================================================
// Sidebar Component
// ============================================================================

export const Sidebar: React.FC<SidebarProps> = ({
  activeGoal,
  goals = [],
  onGoalChange,
  onCreateGoal,
  navItems,
  secondaryItems = [],
  user,
  onUserAction,
}) => {
  const { sidebarCollapsed, toggleSidebar } = useAppShell();
  const [goalSelectorOpen, setGoalSelectorOpen] = React.useState(false);

  return (
    <div className="sidebar glass-frosted">
      {/* Header with collapse toggle */}
      <div className="sidebar-header">
        {!sidebarCollapsed && (
          <div className="sidebar-logo">
            <span className="text-xl font-bold text-primary">LOGOS</span>
          </div>
        )}
        <GlassIconButton
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <MenuIcon />
        </GlassIconButton>
      </div>

      {/* Goal Selector */}
      {activeGoal && (
        <div className="sidebar-goal-selector">
          <button
            className="goal-selector-button glass-light"
            onClick={() => setGoalSelectorOpen(!goalSelectorOpen)}
            aria-expanded={goalSelectorOpen}
          >
            <div className="goal-selector-content">
              <span className="goal-language">{activeGoal.domain.toUpperCase()}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="goal-name">{activeGoal.genre}</span>
                  <ChevronIcon direction={goalSelectorOpen ? 'down' : 'right'} />
                </>
              )}
            </div>
          </button>

          {/* Goal dropdown */}
          {goalSelectorOpen && !sidebarCollapsed && (
            <div className="goal-dropdown glass">
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  className={`goal-option ${goal.id === activeGoal.id ? 'active' : ''}`}
                  onClick={() => {
                    onGoalChange?.(goal.id);
                    setGoalSelectorOpen(false);
                  }}
                >
                  <span className="goal-language">{goal.domain.toUpperCase()}</span>
                  <span className="goal-name">{goal.genre}</span>
                </button>
              ))}
              {onCreateGoal && (
                <button className="goal-option goal-option--new" onClick={onCreateGoal}>
                  <span>+</span>
                  <span>New Goal</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Primary Navigation */}
      <nav className="sidebar-nav" aria-label="Primary navigation">
        <ul className="nav-list" role="list">
          {navItems.map((item) => (
            <NavItemComponent key={item.id} item={item} collapsed={sidebarCollapsed} />
          ))}
        </ul>
      </nav>

      {/* Spacer */}
      <div className="sidebar-spacer" />

      {/* Secondary Navigation */}
      {secondaryItems.length > 0 && (
        <nav className="sidebar-nav sidebar-nav--secondary" aria-label="Secondary navigation">
          <ul className="nav-list" role="list">
            {secondaryItems.map((item) => (
              <NavItemComponent key={item.id} item={item} collapsed={sidebarCollapsed} />
            ))}
          </ul>
        </nav>
      )}

      {/* User Section */}
      {user && (
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <span>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <button
                className="user-menu-button"
                onClick={() => onUserAction?.('settings')}
              >
                Settings
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .sidebar {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: var(--space-4);
          border-radius: 0 var(--radius-2xl) var(--radius-2xl) 0;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid hsl(var(--glass-border));
        }

        .sidebar-logo {
          overflow: hidden;
          white-space: nowrap;
        }

        .sidebar-goal-selector {
          position: relative;
          margin-bottom: var(--space-4);
        }

        .goal-selector-button {
          width: 100%;
          padding: var(--space-3);
          border-radius: var(--radius-xl);
          cursor: pointer;
          border: 1px solid hsl(var(--glass-border));
          text-align: left;
          transition: all var(--duration-200) var(--ease-out);
        }

        .goal-selector-button:hover {
          background: hsl(var(--glass-tint-light) / 0.8);
        }

        .goal-selector-content {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .goal-language {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          background: hsl(var(--color-primary) / 0.1);
          color: hsl(var(--color-primary));
          border-radius: var(--radius-md);
        }

        .goal-name {
          flex: 1;
          font-weight: var(--font-medium);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .goal-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: var(--space-2);
          padding: var(--space-2);
          z-index: var(--z-dropdown);
        }

        .goal-option {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2);
          border: none;
          background: transparent;
          border-radius: var(--radius-lg);
          cursor: pointer;
          text-align: left;
          transition: background var(--duration-150) var(--ease-out);
        }

        .goal-option:hover {
          background: hsl(var(--color-neutral-100));
        }

        .goal-option.active {
          background: hsl(var(--color-primary) / 0.1);
        }

        .goal-option--new {
          color: hsl(var(--color-primary));
          border-top: 1px solid hsl(var(--glass-border));
          margin-top: var(--space-2);
          padding-top: var(--space-3);
        }

        .sidebar-nav {
          margin-bottom: var(--space-4);
        }

        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .sidebar-spacer {
          flex: 1;
        }

        .sidebar-nav--secondary {
          padding-top: var(--space-4);
          border-top: 1px solid hsl(var(--glass-border));
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          margin-top: var(--space-4);
          background: hsl(var(--glass-tint-light) / 0.5);
          border-radius: var(--radius-xl);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: hsl(var(--color-primary) / 0.1);
          color: hsl(var(--color-primary));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-semibold);
          overflow: hidden;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-info {
          flex: 1;
          overflow: hidden;
        }

        .user-name {
          display: block;
          font-weight: var(--font-medium);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .user-menu-button {
          font-size: var(--text-xs);
          color: hsl(var(--color-neutral-500));
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }

        .user-menu-button:hover {
          color: hsl(var(--color-primary));
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Nav Item Component
// ============================================================================

const NavItemComponent: React.FC<{ item: NavItem; collapsed: boolean }> = ({
  item,
  collapsed,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const content = (
    <>
      <span className="nav-item-icon" aria-hidden="true">{item.icon}</span>
      {!collapsed && (
        <>
          <span className="nav-item-label">{item.label}</span>
          {item.badge && (
            <span className="nav-item-badge" aria-label={`${item.badge} notifications`}>
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronIcon direction={expanded ? 'down' : 'right'} />
          )}
        </>
      )}
    </>
  );

  const className = `nav-item ${item.active ? 'nav-item--active' : ''} ${
    collapsed ? 'nav-item--collapsed' : ''
  }`;

  // Accessibility attributes
  const a11yProps = {
    'aria-label': collapsed ? item.label : undefined,
    'aria-current': item.active ? 'page' as const : undefined,
    'aria-expanded': hasChildren ? expanded : undefined,
    tabIndex: 0,
  };

  return (
    <li role="listitem">
      {item.href ? (
        <a
          href={item.href}
          className={className}
          onKeyDown={handleKeyDown}
          {...a11yProps}
        >
          {content}
        </a>
      ) : (
        <button
          className={className}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          {...a11yProps}
        >
          {content}
        </button>
      )}

      {/* Nested items */}
      {hasChildren && expanded && !collapsed && (
        <ul className="nav-list nav-list--nested" role="list">
          {item.children!.map((child) => (
            <NavItemComponent key={child.id} item={child} collapsed={collapsed} />
          ))}
        </ul>
      )}

      <style>{`
        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-2-5) var(--space-3);
          margin-bottom: var(--space-1);
          border: none;
          background: transparent;
          border-radius: var(--radius-lg);
          color: hsl(var(--color-neutral-600));
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          text-decoration: none;
          cursor: pointer;
          transition: all var(--duration-150) var(--ease-out);
        }

        .nav-item:hover {
          background: hsl(var(--glass-tint-light) / 0.6);
          color: hsl(var(--color-neutral-800));
        }

        .nav-item--active {
          background: hsl(var(--color-primary) / 0.1);
          color: hsl(var(--color-primary));
          box-shadow: var(--shadow-inner-glow);
        }

        .nav-item--collapsed {
          justify-content: center;
          padding: var(--space-2-5);
        }

        .nav-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .nav-item-label {
          flex: 1;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nav-item-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 var(--space-1);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          background: hsl(var(--color-danger));
          color: white;
          border-radius: var(--radius-full);
        }

        .nav-list--nested {
          margin-left: var(--space-6);
          padding-left: var(--space-3);
          border-left: 1px solid hsl(var(--glass-border));
        }
      `}</style>
    </li>
  );
};

export default Sidebar;
