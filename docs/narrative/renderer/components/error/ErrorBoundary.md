# ErrorBoundary

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/error/ErrorBoundary.tsx`
> **Status**: Active

---

## Context & Purpose

The ErrorBoundary is LOGOS's safety net for the user interface. When React components encounter JavaScript errors during rendering, the entire application would normally crash, leaving users staring at a blank screen or cryptic browser error. This component catches those errors before they cascade, presenting a graceful fallback UI that keeps users informed and empowered to recover.

**Business Need**: Language learning requires sustained engagement. If a rare bug causes the app to crash mid-lesson, users lose their progress, their momentum, and potentially their trust in the application. ErrorBoundary ensures that even when things go wrong, users see a helpful message in Korean ("Something went wrong" / "An error occurred loading this component") with clear recovery options like retry buttons or navigation back to the dashboard. This transforms potential abandonment moments into minor inconveniences.

**When Used**:
- **Critical/Page Level**: Wrapping entire page components or the root application to catch catastrophic failures
- **Component Level**: Wrapping individual features (e.g., a chart, a complex form) so one broken component doesn't take down the whole page
- **Programmatic Error Handling**: Via the `useErrorHandler` hook when async operations fail and you want to bubble the error up to the nearest boundary
- **HOC Pattern**: Using `withErrorBoundary(Component)` to wrap any component declaratively

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/renderer/components/ui/GlassCard.tsx`: Provides the frosted glass container for the full-page error display, maintaining visual consistency with the rest of the LOGOS UI
- `src/renderer/components/ui/GlassButton.tsx`: Renders the "Retry", "Go to Dashboard", and "Reload Page" action buttons with proper styling and loading states
- `lucide-react`: Supplies icons (`AlertTriangle` for error indication, `RefreshCw` for retry, `Home` for navigation, `Bug` for debug purposes)
- `localStorage` (browser API): Persists error logs for debugging without requiring network connectivity

### Dependents (What Needs This)

**Potential Consumers** (designed for but not yet integrated):
- `src/renderer/App.tsx`: Could wrap `<AppContent />` with `<ErrorBoundary level="critical">` to catch application-wide failures
- `src/renderer/pages/SessionPage.tsx`: High-value candidate for wrapping the learning session to prevent data loss
- `src/renderer/components/analytics/NetworkGraph.tsx`: Complex D3 visualizations are prone to edge-case errors
- `src/renderer/components/charts/*`: Chart components with complex data transformations

**HOC Usage Pattern**:
```
const SafeNetworkGraph = withErrorBoundary(NetworkGraph, {
  level: 'component',
  showDetails: process.env.NODE_ENV === 'development'
});
```

**Hook Usage Pattern**:
```
const handleError = useErrorHandler();
try {
  await riskyAsyncOperation();
} catch (err) {
  handleError(err); // Triggers nearest ErrorBoundary
}
```

### Data Flow

```
Child component throws error
    |
    v
React's error boundary lifecycle catches it
    |
    v
getDerivedStateFromError() -> Sets hasError: true
    |
    v
componentDidCatch() -> Logs error, notifies parent via onError callback
    |
    v
reportError() -> Writes structured error report to localStorage
    |
    v
render() returns fallback UI based on 'level' prop
    |
    v
User clicks "Retry" -> handleRetry() clears error state
    |
    v
Component re-renders children (may succeed or fail again)
    |
    v
If retry fails, increment retryCount (max 3 attempts)
    |
    v
If max retries exceeded, offer "Reload Page" as final option
```

---

## Macroscale: System Integration

### Architectural Layer

This component operates at the **Presentation Layer** of the LOGOS architecture, specifically as a **defensive wrapper** that sits between React's rendering engine and the application's component tree:

- **Layer 0: React Core** - Error boundary API (getDerivedStateFromError, componentDidCatch)
- **Layer 1: ErrorBoundary** - This module (error interception, UI fallback)
- **Layer 2: Application Components** - The protected child components
- **Layer 3: User** - Sees either normal UI or graceful error recovery

Unlike most components that render content, ErrorBoundary is an **infrastructure component** that renders *other* components while protecting the system from their failures.

### Big Picture Impact

ErrorBoundary is a **resilience mechanism** that prevents localized failures from becoming systemic crashes:

| Scenario | Without ErrorBoundary | With ErrorBoundary |
|----------|----------------------|-------------------|
| Chart throws on bad data | Entire app crashes | Chart shows inline error, rest of app works |
| Network graph fails to render | Blank page | Component-level error with retry button |
| Session page exception | User loses progress, sees white screen | Page-level error, can navigate to dashboard |
| Unhandled async rejection | Silent failure or crash | Hook triggers boundary, shows recovery UI |

**System Dependencies**:
- Does NOT depend on main process (works entirely in renderer)
- Does NOT require network (localStorage-based logging)
- Works offline, in development, and production

### Critical Path Analysis

**Importance Level**: High (Safety Net)

- **If this component itself fails**: The error would propagate upward. However, the component is deliberately simple with minimal dependencies to reduce this risk. Worst case: React's default error behavior (crash).

- **If this component is absent**: Every unhandled error in any wrapped component tree causes a full application crash. Users see blank screens with no recovery path.

- **Failure modes addressed**:
  - Component render errors -> Caught and displayed
  - Infinite re-render loops -> Limited by MAX_RETRIES (3 attempts)
  - Network errors -> Detected by message content, shown with appropriate guidance
  - Memory/timeout issues -> Auto-retry with exponential backoff prevents hammering

- **Backup mechanisms**:
  - Retry with exponential backoff (1s, 2s, 4s, max 10s)
  - Navigation to dashboard via custom event
  - Full page reload as last resort
  - Error log stored in localStorage for post-mortem debugging

---

## Component Architecture

### The Three UI Levels

ErrorBoundary adapts its visual presentation based on the `level` prop:

| Level | UI Presentation | Use Case |
|-------|-----------------|----------|
| `component` | Inline error card (red border, retry icon) | Individual widgets, charts, optional features |
| `page` | Full-screen centered error card | Page-level failures, routing errors |
| `critical` | Full-screen with prominent styling | App-level failures, unrecoverable states |

### State Management

The boundary tracks four pieces of state:

```typescript
interface ErrorBoundaryState {
  hasError: boolean;    // Whether an error has been caught
  error: Error | null;  // The actual Error object
  errorInfo: ErrorInfo | null;  // React's component stack trace
  retryCount: number;   // How many retry attempts have been made
}
```

The retry count is crucial for preventing infinite retry loops when an error is deterministic (e.g., bad data that will always cause the same crash).

### Recovery Mechanisms

**Manual Retry** (`handleRetry`):
- Clears error state completely
- Increments retryCount
- Triggers `onReset` callback for parent cleanup
- Children attempt to re-render

**Auto-Retry** (`handleAutoRetry`):
- Uses exponential backoff: delay = min(1000 * 2^retryCount, 10000)
- Prevents rapid-fire retries that could overwhelm systems
- Not currently triggered automatically (available for future use)

**Navigation** (`handleGoHome`):
- Dispatches custom `logos:navigate` event
- Parent components should listen and handle navigation
- Provides escape hatch when retry won't help

**Full Reload** (`handleReload`):
- Last resort when all else fails
- Calls `window.location.reload()`
- Clears all JavaScript state, starts fresh

---

## Error Logging System

### localStorage Persistence

Errors are logged to `logos_error_log` in localStorage with structured data:

```typescript
const errorReport = {
  timestamp: string;           // ISO timestamp of when error occurred
  error: {
    name: string;              // Error constructor name (e.g., "TypeError")
    message: string;           // Error message
    stack: string | undefined; // Full stack trace
  };
  componentStack: string;      // React component hierarchy at failure point
  level: 'page' | 'component' | 'critical';
  retryCount: number;          // Which retry attempt this was
};
```

**Why localStorage?**
- Works offline (no network dependency)
- Persists across page reloads
- Accessible to developers via browser DevTools
- Can be retrieved for bug reports or analytics later
- Limited to 20 most recent errors to prevent unbounded growth

### Integration Points for Error Services

The `reportError` method is designed to be extended:

```typescript
private reportError(error: Error, errorInfo: ErrorInfo): void {
  // Current: localStorage logging
  // Future: Could integrate with:
  //   - Sentry, Bugsnag, or similar error tracking
  //   - IPC channel to main process for centralized logging
  //   - Analytics service for error frequency tracking
}
```

---

## Technical Concepts (Plain English)

### React Error Boundary

**Technical**: A class component implementing `getDerivedStateFromError()` and `componentDidCatch()` lifecycle methods to intercept JavaScript errors during the React rendering phase and display fallback UI.

**Plain English**: Think of it like a circuit breaker in your house. When one appliance shorts out, the breaker trips to protect the rest of your electrical system. ErrorBoundary does the same for React components - when one "shorts out" (throws an error), the boundary catches it before it can crash everything else.

**Why We Use It**: React intentionally crashes the entire component tree when an error occurs, on the principle that displaying broken UI is worse than displaying nothing. Error boundaries let us override this behavior for specific parts of the tree.

### Exponential Backoff

**Technical**: A retry strategy where each subsequent attempt waits exponentially longer (1s, 2s, 4s, 8s...) up to a maximum delay, reducing load on failing systems and preventing retry storms.

**Plain English**: If you knock on a door and nobody answers, you don't immediately knock again - you wait a bit longer each time. First 1 second, then 2, then 4. This gives whatever was broken time to recover without you hammering on it constantly.

**Why We Use It**: If a component fails due to a temporary condition (server overload, network hiccup), immediate retries might make things worse. Backing off gives the system breathing room to recover.

### Component Stack Trace

**Technical**: React's `ErrorInfo.componentStack` provides a string representation of the component hierarchy at the time of the error, showing which components were ancestors of the failing component.

**Plain English**: When a doctor examines you, they don't just look at the symptom - they want to know what you ate, where you were, what you touched. The component stack is like a medical history for errors, showing the path through the component tree that led to the failure.

**Why We Use It**: Knowing that "NetworkGraph threw an error" is helpful. Knowing that "NetworkGraph inside AnalyticsPage inside AppShell threw an error when rendering the 'connections' prop" is much more useful for debugging.

### Higher-Order Component (HOC)

**Technical**: `withErrorBoundary(Component)` is a function that takes a component and returns a new component wrapped in an ErrorBoundary, using the wrapper pattern to add behavior without modifying the original.

**Plain English**: Like putting a protective case on your phone - the phone works exactly the same, but now it's protected from drops. The HOC wraps your component in protection without changing the component itself.

**Why We Use It**: You might have dozens of components that need error protection. Instead of manually wrapping each one with `<ErrorBoundary><MyComponent /></ErrorBoundary>`, you can do `export default withErrorBoundary(MyComponent)` once.

### useErrorHandler Hook

**Technical**: A React hook that returns a callback function. When called with an error, it sets that error as state and immediately throws it on the next render, allowing imperative error handling to trigger declarative error boundaries.

**Plain English**: Error boundaries only catch errors that happen during rendering. But what about errors in button click handlers or API calls? This hook is like a "throw this to my error boundary" button - you catch the error yourself, then use the hook to relay it to the boundary.

**Why We Use It**: Without this, async errors (like failed API calls) would need their own error handling in every component. The hook lets you centralize error display by routing all errors to the nearest ErrorBoundary.

---

## Internationalization Note

The error messages in the fallback UI are currently hardcoded in Korean:

| Message | Translation |
|---------|-------------|
| "Something went wrong" | "An unexpected error occurred. Please try again later." |
| "Please check your network connection" | "Please check your network connection." |
| "An error occurred loading this component" | "An error occurred loading this component." |
| "Retry (X remaining)" | "Retry (X remaining)" |
| "Go to Dashboard" | "Go to Dashboard" |
| "Reload Page" | "Reload Page" |
| "Retry count: X/3" | "Retry count: X/3" |

Future consideration: These should be internationalized via i18n system when LOGOS adds multi-language UI support.

---

## Usage Patterns

### Wrapping a Page

```tsx
// In a page component file
import { ErrorBoundary } from '../components/error';

export const AnalyticsPage: React.FC = () => (
  <ErrorBoundary level="page" showDetails={isDev}>
    <AnalyticsContent />
  </ErrorBoundary>
);
```

### Wrapping a Risky Component

```tsx
// Inline wrapping
<ErrorBoundary level="component" onError={logToAnalytics}>
  <NetworkGraph data={complexData} />
</ErrorBoundary>
```

### Using the HOC

```tsx
// In the component's own file
import { withErrorBoundary } from '../error/ErrorBoundary';

const NetworkGraph: React.FC<Props> = ({ data }) => {
  // Complex rendering logic that might fail
};

export default withErrorBoundary(NetworkGraph, {
  level: 'component',
  showDetails: false,
});
```

### Using the Hook for Async Errors

```tsx
import { useErrorHandler } from '../error/ErrorBoundary';

const DataFetcher: React.FC = () => {
  const throwError = useErrorHandler();

  const fetchData = async () => {
    try {
      const response = await api.getData();
      setData(response);
    } catch (err) {
      throwError(err as Error); // Triggers nearest ErrorBoundary
    }
  };

  return <button onClick={fetchData}>Load Data</button>;
};
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created narrative documentation for ErrorBoundary component
- **Why**: Shadow documentation required for all code files per CLAUDE.md specifications
- **Impact**: Provides context for future developers and AI agents working on error handling

### Initial Implementation (prior to documentation)
- **What Changed**: Complete ErrorBoundary implementation with class component, HOC wrapper, and useErrorHandler hook
- **Why**: LOGOS needed graceful error recovery to prevent app crashes from degrading user experience
- **Impact**: Enables resilient UI that can recover from component-level failures without full application crashes
