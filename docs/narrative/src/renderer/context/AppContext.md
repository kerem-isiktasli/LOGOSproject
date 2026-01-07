# AppContext

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/context/AppContext.tsx`
> **Status**: Active

---

## Why This Exists

AppContext is the **central nervous system** of the LOGOS application, managing global state that needs to be accessible across all pages and components. It serves as the single source of truth for the currently active learning goal, user preferences, and UI state.

**Business Need**: A language learning app with multiple goals (Japanese, Korean, Spanish, etc.) needs to know which goal is "active" at any moment - the dashboard should show progress for that goal, practice sessions should use vocabulary from that goal, and analytics should display data for that goal. Without centralized state, components would constantly disagree about context.

**When Used**:
- On app startup: loads persisted active goal and preferences
- When switching goals: updates context, triggering re-renders across the app
- When toggling UI features: sidebar collapse, focus mode, theme
- By any component needing goal-specific data

---

## Key Concepts

### Active Goal Pattern
**Technical**: A single `activeGoalId` state drives all goal-dependent data fetching via hooks (`useGoal`, `useProgress`, `useMasteryStats`). Changing this ID cascades updates throughout the app.

**Plain English**: Like a TV remote's "Source" button - pressing it to switch from HDMI1 to HDMI2 changes everything on screen, but through a single control point.

**Why We Use It**: Ensures the entire app is always showing data for the same goal. Without this, you might see Japanese vocabulary with Korean progress stats.

### LocalStorage Persistence
**Technical**: Active goal ID, theme preference, and other settings are persisted to `localStorage`, restored on app load, and kept in sync via `useEffect`.

**Plain English**: Like your car remembering your seat and mirror positions - when you return, everything is where you left it.

**Why We Use It**: Users shouldn't have to re-select their goal every time they open the app. Learning continuity matters.

### Auto-Selection of First Goal
**Technical**: If no active goal is set but goals exist, the first goal is automatically selected via a `useEffect` hook.

**Plain English**: Like a playlist that auto-plays the first song if you haven't picked one - the app needs a goal to function, so it makes a reasonable default choice.

**Why We Use It**: Prevents empty states for returning users who somehow lost their active goal setting.

### Theme System Integration
**Technical**: Theme changes set a `data-theme` attribute on the document root, which CSS custom properties reference. Supports `light`, `dark`, and `system` (follows OS preference).

**Plain English**: Like a building's smart lighting that can be set to "always bright," "always dim," or "follow sunrise/sunset."

**Why We Use It**: Users have different preferences and environments. Dark mode is essential for nighttime study; light mode may be better in bright rooms.

### Focus Mode
**Technical**: A boolean that sets `data-focus-mode` attribute on the document, allowing CSS to hide distracting elements (sidebar, notifications) during intense practice.

**Plain English**: Like a "Do Not Disturb" sign that tells the entire hotel (app) to leave you alone while you study.

**Why We Use It**: Language learning requires concentration. Focus mode removes visual clutter during timed exercises or intensive sessions.

---

## Design Decisions

### Why Context Instead of Redux/Zustand
- **Simplicity**: Context is built-in, no extra dependencies
- **Scope**: The state needs are relatively simple (one active goal, a few preferences)
- **Performance**: With proper memoization, Context performs well for this use case
- **Co-location**: State management lives near the React tree, making data flow obvious

### Why Separate from UI State Libraries
AppContext handles app-level concerns, not component-level UI state. This separation:
- Keeps the context lean (only truly global state)
- Avoids re-rendering the entire app for local state changes
- Makes the global/local boundary explicit

### Why Default State Object
The `defaultState` object with no-op functions ensures:
- Components have safe fallbacks if used outside provider (though they shouldn't be)
- TypeScript can infer the full type from the default
- Testing can use defaults without mocking

### Why Hooks for Data Fetching
Uses hooks like `useGoals`, `useProgress` instead of direct API calls because:
- Hooks encapsulate loading/error states
- Automatic refetching on goal change
- Caching handled at the hook level
- Consistent patterns across the app

---

## Integration Points

### Dependencies (What This Needs)
- `react`: Core hooks (`createContext`, `useContext`, `useState`, `useEffect`, `useCallback`)
- `../hooks/useLogos`: Data fetching hooks (`useGoals`, `useGoal`, `useProgress`, `useMasteryStats`)
- `localStorage`: Browser storage for persistence

### Dependents (What Needs This)
- `src/renderer/App.tsx`: Wraps app with `AppProvider`, uses `useApp()` for navigation
- `src/renderer/components/layout/Sidebar.tsx`: Displays goal switcher
- `src/renderer/pages/DashboardPage.tsx`: Shows progress for active goal
- `src/renderer/pages/SessionPage.tsx`: Loads vocabulary for active goal
- `src/renderer/pages/AnalyticsPage.tsx`: Displays stats for active goal
- Essentially every page and many components

### Hierarchical Position
```
ErrorBoundary
  -> AppProvider <- YOU ARE HERE
    -> ToastProvider
      -> NetworkErrorHandler
        -> AppContent
```

AppProvider is high in the tree because nearly everything needs goal context.

### Data Flow
```
App mounts
    -> localStorage checked for logos_active_goal
    -> useGoals() fetches all goals
    -> If no active goal but goals exist, first is selected
    -> useGoal(), useProgress(), useMasteryStats() fetch data for active goal
    -> Context value updated, children re-render with new data

User switches goal in sidebar
    -> setActiveGoal(newId) called
    -> localStorage updated
    -> Data hooks refetch for new goal
    -> Entire app reflects new goal
```

### Exports
- `AppContext`: The raw context (rarely used directly)
- `AppProvider`: Provider component (wrap app)
- `useApp()`: Hook returning full context value (most common usage)

### AppState Interface
The context provides:
- `activeGoalId`, `activeGoal`: Current goal
- `goals`, `goalsLoading`: All user goals
- `progress`, `masteryStats`: Analytics data for active goal
- `sidebarCollapsed`, `focusMode`, `theme`: UI preferences
- Action functions: `setActiveGoal`, `refreshGoals`, `toggleSidebar`, `toggleFocusMode`, `setTheme`

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing AppContext
- **Why**: Part of systematic documentation effort for core application architecture
- **Impact**: Provides clarity on global state management patterns for the team
