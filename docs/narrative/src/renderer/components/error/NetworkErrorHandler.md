# NetworkErrorHandler Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/error/NetworkErrorHandler.tsx`
> **Status**: Active

---

## Why This Exists

The NetworkErrorHandler provides **network-aware error handling and automatic recovery** for the application. It monitors the browser's online/offline status, queues failed requests for later retry, and provides visual feedback about connection state.

**Business Need**: Language learning requires consistent data synchronization - progress tracking, vocabulary updates, and session data must be saved reliably. Users working in cafes, on trains, or in areas with spotty WiFi need the app to handle disconnections gracefully rather than losing their work or showing cryptic errors.

**When Used**:
- Continuously monitors network status throughout the app lifecycle
- Activates when browser transitions between online/offline states
- Intercepts failed network requests for retry management
- Provides UI feedback during connectivity issues

---

## Key Concepts

### Online/Offline Event Listeners
**Technical**: Uses browser's `navigator.onLine` property and `online`/`offline` window events to detect connectivity changes in real-time.

**Plain English**: Like a phone showing WiFi bars or "No Signal" - the browser tells us when we've lost connection, and we respond by showing appropriate UI and queueing work for later.

**Why We Use It**: Browser-native detection is reliable, doesn't require polling, and responds instantly to network changes.

### Failed Request Queue
**Technical**: Maintains a queue of failed requests with metadata (endpoint, method, retry count) that can be replayed when connectivity is restored.

**Plain English**: Like a postal worker collecting mail during a road closure - when the road reopens (network returns), the backlogged mail (requests) gets delivered.

**Why We Use It**: Users shouldn't have to manually retry every failed action. The system remembers what needed to happen and does it automatically when possible.

### Context-Based State Management
**Technical**: Uses React Context to share network state across the entire application, allowing any component to react to connectivity changes.

**Plain English**: Like an airport announcement system - when the network status changes, every "gate" (component) in the "terminal" (app) hears about it simultaneously.

**Why We Use It**: Network status affects many components (forms, data loaders, sync indicators). Context avoids prop-drilling this everywhere.

### useNetworkAware Hook
**Technical**: A custom hook that wraps async operations with network awareness, automatic retry with exponential backoff, and failed request tracking.

**Plain English**: Like a smart assistant that checks if you're online before trying to send an email, retries if it fails, and reminds you to send it later if all attempts fail.

**Why We Use It**: Provides a consistent pattern for any component needing network operations, reducing boilerplate and ensuring uniform error handling.

---

## Design Decisions

### Why Separate from ErrorBoundary
ErrorBoundary catches JavaScript errors; NetworkErrorHandler catches network-specific issues. Separating them:
- Keeps each component focused (Single Responsibility Principle)
- Allows different recovery strategies (retry vs. navigate home)
- Network errors need different UI (offline banner) than JS errors (error cards)

### Why Toast Integration
The handler uses the Toast system for notifications because:
- Toasts are non-blocking (users can continue reading/interacting)
- Consistent feedback mechanism across the app
- Offline notifications with `duration: 0` stay visible until resolved

### Why Custom Events for Retry
Dispatches `logos:retry-request` custom events rather than calling API functions directly because:
- Components that made the original request can handle their own retry logic
- Decouples the network handler from specific API implementations
- Allows request-specific state updates after successful retry

### Why Offline Banner at Top
- Persistent visibility (can't scroll past it)
- Yellow/warning color is universally recognized
- Retry button immediately accessible
- Doesn't overlay content (pushes it down conceptually)

### Why Track Failed Request Metadata
The queue stores `endpoint`, `method`, `timestamp`, `retryCount`, and `maxRetries` to:
- Provide meaningful retry logs
- Prevent infinite retry loops
- Allow prioritization of failed requests
- Enable debugging of chronic failures

---

## Integration Points

### Dependencies (What This Needs)
- `react`: Core hooks (`createContext`, `useContext`, `useState`, `useEffect`, `useCallback`)
- `framer-motion`: Animation for offline banner (`motion`, `AnimatePresence`)
- `lucide-react`: Icons (`Wifi`, `WifiOff`, `RefreshCw`, `AlertCircle`)
- `../feedback/Toast`: Toast system for notifications (`useToast`)

### Dependents (What Needs This)
- `src/renderer/App.tsx`: Wraps the main content with this provider
- Any component using `useNetwork()` hook to check connectivity
- Any component using `useNetworkAware()` for network-aware async operations
- API service layers could integrate with `addFailedRequest`

### Hierarchical Position
```
ErrorBoundary (catches JS errors)
  -> AppProvider (app state)
    -> ToastProvider (notifications)
      -> NetworkErrorHandler (network state) <- YOU ARE HERE
        -> AppContent (main UI)
```

This positioning ensures:
- Network handler can use Toast for notifications
- Network handler is inside ErrorBoundary for its own error safety
- Network state is available to all content components

### Data Flow
```
Network goes offline
    -> 'offline' event fires
    -> State updated: isOnline=false
    -> Toast shown: "Offline" (persistent)
    -> Offline banner appears at top

User action fails due to network
    -> Error caught by useNetworkAware
    -> Added to failedRequests queue
    -> User sees error feedback

Network comes back online
    -> 'online' event fires
    -> State updated: isOnline=true
    -> Toast shown: "Connected"
    -> handleReconnect() called
    -> failedRequests replayed via custom events
    -> Offline banner disappears
```

### Exports
- `NetworkErrorHandler`: Provider component (wrap content)
- `useNetwork()`: Hook returning full network state and actions
- `useNetworkAware<T>()`: Hook for network-aware async operations

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing NetworkErrorHandler component
- **Why**: Part of systematic documentation effort for error handling systems
- **Impact**: Clarifies network resilience architecture for maintainers
