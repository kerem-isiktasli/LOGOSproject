# ErrorBoundary Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/error/ErrorBoundary.tsx`
> **Status**: Active

---

## Why This Exists

The ErrorBoundary component exists to **catch JavaScript errors anywhere in the component tree** and prevent them from crashing the entire application. React components that throw errors during rendering would normally unmount the entire React tree, leaving users with a blank screen. This component provides graceful degradation and recovery options.

**Business Need**: A language learning app where a single bug crashes the entire session would be devastating - users might lose progress, context, or abandon the app entirely. ErrorBoundary ensures that even if one component fails, the rest of the application remains functional, and users have clear paths to recovery.

**When Used**:
- Wraps the entire application at the root level (level="critical")
- Wraps individual pages to contain page-specific errors (level="page")
- Wraps risky components that might fail due to data issues (level="component")

---

## Key Concepts

### React Error Boundaries (Class Component Requirement)
**Technical**: React Error Boundaries must be class components that implement `getDerivedStateFromError` and/or `componentDidCatch` lifecycle methods. Functional components cannot catch render errors.

**Plain English**: Think of it like a safety net at a circus - you need a special kind of net (class component) installed in a specific position (parent of failing components) to catch performers (errors) when they fall.

**Why We Use It**: This is the only React-supported way to catch errors during rendering, in lifecycle methods, and in constructors of the whole tree below them.

### Error Level Hierarchy
**Technical**: Three severity levels (`critical`, `page`, `component`) determine the scope and UI treatment of the error - from full-screen recovery to inline error badges.

**Plain English**: Like a building fire system with different response levels - a trash can fire (component) gets a small extinguisher, a room fire (page) triggers the floor alarm, and a building fire (critical) evacuates everyone.

**Why We Use It**: Not all errors are equal. A chart component failing to render shouldn't show the same scary full-screen error as the entire app crashing.

### Retry with Exponential Backoff
**Technical**: Failed components can retry up to 3 times, with auto-retry using exponential backoff (delays of 1s, 2s, 4s, etc.) to avoid hammering a failing system.

**Plain English**: Like repeatedly calling someone who didn't answer - you wait a little longer between each attempt rather than calling every second, giving them time to become available.

**Why We Use It**: Transient errors (network hiccups, race conditions) often resolve themselves. Immediate retry might fail again; waiting progressively longer increases success chances.

### Local Error Logging
**Technical**: Errors are stored in `localStorage` under `logos_error_log`, keeping the last 20 errors with full stack traces and component stacks.

**Plain English**: Like a flight recorder (black box) that keeps a rolling log of the last 20 incidents, so developers can investigate crashes even if users refresh the page.

**Why We Use It**: Production errors are notoriously hard to reproduce. Having a persistent log helps users report issues and developers diagnose problems.

---

## Design Decisions

### Why Class Component (Not Functional)
React explicitly requires class components for error boundaries. There's no functional component equivalent because:
- Error boundaries need lifecycle methods (`componentDidCatch`)
- Hooks cannot replicate error boundary behavior
- This is a fundamental React architecture decision we must follow

### Why Maximum 3 Retries
- Enough attempts to overcome transient issues
- Few enough to not frustrate users waiting for something broken
- Matches common patterns in retry libraries
- After 3 failures, the issue is likely persistent

### Why Custom Event for Navigation
The component dispatches `logos:navigate` custom event to go home rather than using React Router directly because:
- ErrorBoundary is a class component with limited access to hooks
- Decouples navigation from the error handling code
- Allows parent components to handle navigation in their preferred way

### Why Korean Language in UI
The application appears to target Korean-speaking users (based on text like "jongjeda" - an error occurred). This is a localization choice - the error boundary should speak the user's language for a less jarring experience during stressful error situations.

### Why Store Errors in localStorage
- Works offline (unlike server-side logging)
- Persists across refreshes
- No API key or endpoint required
- Users can copy/paste for bug reports
- Limited to 20 to prevent storage bloat

---

## Integration Points

### Dependencies (What This Needs)
- `react`: Component base class, ErrorInfo type
- `lucide-react`: Icons (`AlertTriangle`, `RefreshCw`, `Home`, `Bug`)
- `../ui/GlassCard`: Styled card component for error display
- `../ui/GlassButton`: Styled button component for actions

### Dependents (What Needs This)
- `src/renderer/App.tsx`: Wraps entire application with `level="critical"`
- Any page or component needing error isolation
- `withErrorBoundary` HOC allows wrapping any component

### Data Flow
```
Child component throws error
    -> getDerivedStateFromError captures error, sets hasError=true
    -> componentDidCatch logs error, stores in localStorage
    -> Fallback UI renders based on level
    -> User clicks retry OR navigate home
    -> State resets, children re-render
    -> If error persists, repeat (up to MAX_RETRIES)
```

### Exports
- `ErrorBoundary`: The main class component
- `withErrorBoundary<P>()`: HOC to wrap any component with error boundary
- `useErrorHandler()`: Hook for functional components to trigger error boundaries from async code

### withErrorBoundary HOC Pattern
```typescript
// Usage example (not actual code)
const SafeChart = withErrorBoundary(RiskyChart, {
  level: 'component',
  showDetails: true
});
```

### useErrorHandler Hook
Allows functional components to "throw" errors that will be caught by the nearest ErrorBoundary:
```typescript
// Usage pattern (not actual code)
const handleError = useErrorHandler();
fetch('/api/data').catch(err => handleError(err));
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing ErrorBoundary component
- **Why**: Part of systematic documentation effort for error handling systems
- **Impact**: Provides clear understanding of error handling architecture for future maintenance
