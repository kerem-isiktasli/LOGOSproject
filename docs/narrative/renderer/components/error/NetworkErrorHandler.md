# NetworkErrorHandler Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/error/NetworkErrorHandler.tsx`
> **Status**: Active

---

## Context & Purpose

This component exists to protect language learners from the frustration of lost progress due to network failures. In a language learning application like LOGOS, users may be in the middle of a practice session, submitting answers, or syncing their progress when their internet connection drops. Without proper network handling, these scenarios could result in lost data, confusing error messages, or a frozen interface.

**Business Need**: Language learning requires consistent, uninterrupted practice sessions. Users studying on laptops in coffee shops, commuting with spotty connections, or working in areas with unreliable internet need confidence that their progress will not be lost. This component provides that safety net by gracefully handling connectivity issues and automatically recovering when the connection returns.

**User Need**: When the internet goes down mid-session, users need:
1. Clear visual feedback that something is wrong (not a mysterious freeze)
2. Assurance that their work is being preserved
3. Automatic recovery without manual intervention when possible
4. A simple retry button when manual action is needed

**When Used**: This component operates at the application shell level, wrapping the entire LOGOS application. It activates whenever:
- The browser detects an offline status change
- An API request fails due to network issues
- The application attempts to reconnect after connectivity is restored

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`src/renderer/components/feedback/Toast.tsx`**: `useToast()` hook
  - Provides the notification system for displaying network status changes
  - Shows success toasts when connection is restored
  - Shows persistent error toasts when offline (duration: 0 means no auto-dismiss)

- **React Context API**: `createContext`, `useContext`
  - Creates the NetworkContext that shares network state across the application
  - Enables any child component to access network status via hooks

- **Browser Navigator API**: `navigator.onLine`
  - Provides initial online/offline status detection
  - Browser built-in for detecting connectivity state

- **Browser Window Events**: `online`, `offline`
  - Native browser events that fire when connectivity changes
  - More reliable than polling for network status

- **Framer Motion**: `motion`, `AnimatePresence`
  - Powers smooth slide-in/out animations for the offline banner
  - Creates polished visual transitions without jarring state changes

- **Lucide React Icons**: `Wifi`, `WifiOff`, `RefreshCw`, `AlertCircle`
  - Provides visual iconography for network states
  - Universal symbols users immediately understand

### Dependents (What Needs This)

Currently, the NetworkErrorHandler is **not yet integrated** into the main App.tsx, but is designed to be used by:

- **`src/renderer/App.tsx`**: Should wrap the application to provide network context
  - Would be placed alongside ToastProvider and AppProvider
  - Enables all child components to access network state

- **Any component making API calls**: Can use `useNetworkAware()` hook
  - Automatically handles retries with exponential backoff
  - Queues failed requests for later retry
  - Reports network errors to the centralized handler

- **Custom IPC handlers**: Can integrate with the custom event system
  - Listens for `logos:retry-request` events to retry failed operations
  - Enables main process communication to participate in retry flow

### Data Flow

```
Browser 'offline' event detected
       |
       v
NetworkErrorHandler updates state: isOnline = false
       |
       +---> Toast notification: "Offline - check connection"
       |
       +---> OfflineBanner slides into view at top of screen
       |
       v
User continues working (requests queued in failedRequests array)
       |
       v
Browser 'online' event detected
       |
       v
NetworkErrorHandler updates state: isOnline = true
       |
       +---> Toast notification: "Connected - network restored"
       |
       +---> Auto-retry begins: handleReconnect() called
       |
       v
Each queued request emits 'logos:retry-request' custom event
       |
       v
Successful requests removed from queue
       |
       v
OfflineBanner disappears (AnimatePresence exit animation)
```

---

## Macroscale: System Integration

### Architectural Layer

This component sits in the **Presentation Infrastructure Layer** of the LOGOS architecture:

```
Layer 1: Visual Components (Pages, UI Elements)
         |
         v
Layer 2: THIS MODULE (NetworkErrorHandler) <-- Infrastructure Provider
         |
         +---> Provides network context to all components above
         +---> Intercepts and manages network failures
         |
         v
Layer 3: Application Context (AppProvider, ToastProvider)
         |
         v
Layer 4: IPC Bridge (Electron main process communication)
         |
         v
Layer 5: Backend Services (Database, AI APIs)
```

The NetworkErrorHandler acts as a **protective membrane** between the user interface and the network-dependent operations. It does not implement business logic itself but provides the infrastructure for graceful degradation.

### Big Picture Impact

Without this module, LOGOS would exhibit these failure modes:

1. **Silent Failures**: API calls would fail without user notification
2. **Lost Progress**: Quiz answers submitted during brief disconnections would vanish
3. **Confused Users**: No indication of why the app "stopped working"
4. **Manual Recovery**: Users would need to refresh the page to recover

With this module, LOGOS gains:

1. **Resilient User Experience**: Brief disconnections are handled transparently
2. **Progress Protection**: Failed requests are queued, not discarded
3. **Clear Communication**: Visual banner and toast notifications explain the situation
4. **Automatic Recovery**: When connection returns, pending work is automatically retried

### System Dependencies

**Integration Points**:

| System Component | Integration Type | Purpose |
|-----------------|------------------|---------|
| Toast Notification System | Direct dependency | Display network status messages |
| React Component Tree | Context provider | Share network state application-wide |
| Browser Event System | Event listeners | Detect connectivity changes |
| Custom Event System | Event dispatch | Coordinate retry operations |

**Failure Impact Analysis**:

If this component fails, the impact is **moderate but contained**:
- Users lose visibility into network status
- Failed requests are not automatically retried
- However, the core application continues to function
- Users can still manually refresh to recover

This is intentional design: the NetworkErrorHandler improves UX but is not on the critical path for core functionality.

### Integration with Error Handling Ecosystem

The NetworkErrorHandler works alongside the `ErrorBoundary` component:

| Component | Handles | Recovery Strategy |
|-----------|---------|-------------------|
| **ErrorBoundary** | React rendering errors, JavaScript exceptions | Re-render, navigate home, reload page |
| **NetworkErrorHandler** | Connectivity issues, API timeouts, fetch failures | Queue requests, auto-retry, visual feedback |

Together, they form a comprehensive error resilience layer:
- ErrorBoundary catches code errors
- NetworkErrorHandler catches network errors
- Users experience graceful degradation in both cases

---

## Technical Concepts (Plain English)

### Context Provider Pattern

**Technical**: A React pattern using `createContext` and `useContext` to share state across the component tree without prop drilling. The NetworkErrorHandler creates a context that any descendant component can access.

**Plain English**: Like a building's PA system - instead of passing messages person-to-person through every floor, the NetworkErrorHandler broadcasts network status to everyone in the building simultaneously. Any component can "tune in" to hear the current status.

**Why We Use It**: Components deep in the UI hierarchy (like a quiz submit button) need to know if the network is available, but we do not want to pass `isOnline` through 10 layers of components.

### Exponential Backoff

**Technical**: A retry strategy where the delay between attempts increases exponentially (e.g., 1s, 2s, 4s, 8s). Implemented in `useNetworkAware` as `retryDelay * Math.pow(2, attempt - 1)`.

**Plain English**: Like knocking on a door - if nobody answers, you wait a bit longer before knocking again. If they are busy, giving them more time between knocks is more polite than hammering continuously. The longer you wait, the more likely they will be ready.

**Why We Use It**: Prevents overwhelming a recovering server with retry requests. If the API is struggling, blasting it with rapid retries makes things worse. Exponential backoff gives the server breathing room to recover.

### Failed Request Queue

**Technical**: An array (`failedRequests[]`) that stores metadata about API calls that failed due to network issues. Each entry includes endpoint, method, timestamp, and retry count.

**Plain English**: Like a post office holding undeliverable mail - when the network is down, requests go into a "holding area" instead of being thrown away. When connectivity returns, the post office delivers everything that was waiting.

**Why We Use It**: Users should not lose their work just because the WiFi flickered. By queuing failed requests, we can retry them automatically when the connection stabilizes.

### Browser Online/Offline Events

**Technical**: Native browser events (`online`, `offline`) that fire when the browser detects network connectivity changes. Accessed via `window.addEventListener`.

**Plain English**: Like your phone's signal bars - the browser tells us when it thinks we have internet or not. We listen for these announcements and update our UI accordingly.

**Why We Use It**: More efficient than constantly pinging a server to check connectivity. The browser already knows when it loses connection, so we just listen for its announcements.

### AnimatePresence for Exit Animations

**Technical**: A Framer Motion component that enables exit animations for components being removed from the React tree. Without it, components disappear instantly.

**Plain English**: Like a theater curtain that closes smoothly instead of the lights just snapping off. When the offline banner goes away, it slides up gracefully instead of vanishing abruptly.

**Why We Use It**: Smooth transitions feel more polished and professional. Jarring state changes make the app feel broken; smooth animations feel intentional and controlled.

### Custom Events for Cross-Component Communication

**Technical**: Using `window.dispatchEvent(new CustomEvent('logos:retry-request', { detail }))` to broadcast retry events that any listener can receive.

**Plain English**: Like announcing over the intercom that it is time to retry failed deliveries. Any service that was waiting to retry a request hears the announcement and takes action.

**Why We Use It**: Decouples the NetworkErrorHandler from specific retry implementations. It announces "time to retry" without needing to know what each component wants to retry.

---

## Exported Interfaces

### NetworkErrorHandler (Component)

The main provider component that wraps the application.

**Props**:
- `children`: React nodes to wrap
- `onReconnect`: Optional callback when connection is restored
- `showBanner`: Whether to display the OfflineBanner (default: true)

### useNetwork (Hook)

Access network state from any component.

**Returns**:
- `isOnline`: Current connectivity status
- `isReconnecting`: Whether a reconnection attempt is in progress
- `lastError`: Most recent network error
- `failedRequests`: Array of queued failed requests
- `retry()`: Manual retry trigger
- `clearError()`: Clear the current error
- `addFailedRequest()`: Queue a failed request
- `removeFailedRequest()`: Remove a request from the queue

### useNetworkAware (Hook)

Wrap async functions with network-aware retry logic.

**Parameters**:
- `asyncFn`: The async function to execute
- `options.maxRetries`: Maximum retry attempts (default: 3)
- `options.retryDelay`: Base delay between retries in ms (default: 1000)
- `options.onError`: Error callback

**Returns**:
- `execute()`: Trigger the wrapped function
- `loading`: Loading state
- `error`: Current error if any
- `data`: Successful response data

---

## Localization Notes

The component uses Korean language strings for user-facing text:
- "Connected" / "Network connection restored"
- "Offline" / "Please check your internet connection"
- "Offline status. Please check your internet connection."
- "Reconnecting..." / "Reconnect"

These are hardcoded and would need to be extracted to a localization system for multi-language support.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial narrative documentation
- **Why**: Shadow documentation system requirement
- **Impact**: Enables understanding of network handling strategy

### [Implementation Date] - Initial Implementation
- **What Changed**: Created NetworkErrorHandler with online/offline detection, retry queue, and visual feedback
- **Why**: Users needed resilient experience during network instability
- **Impact**: Enables graceful degradation and automatic recovery throughout the application
