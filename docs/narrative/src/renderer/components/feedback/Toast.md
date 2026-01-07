# Toast Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/feedback/Toast.tsx`
> **Status**: Active

---

## Why This Exists

The Toast component exists to provide **non-intrusive feedback** to users about system events, operation results, and important notifications. It solves the fundamental UX challenge of communicating status changes without disrupting the user's primary workflow.

**Business Need**: Users need immediate feedback when actions succeed, fail, or require attention, but this feedback should never block their learning flow. A language learning app must feel seamless - interrupting a user mid-practice with modal dialogs would break concentration and harm retention.

**Philosophical Foundation** (from the Korean comments in the source):
- **Non-invasive presence** (sonanhui jonjae): The toast exists without demanding attention
- **State projection** (sangtae tusa): Instantly reflects system state to the user
- **Designed concealment** (seolgye-jeok eunpye): Hides complexity (error stacks) while surfacing essential messages

**When Used**:
- After successful operations (goal creation, session completion, settings saved)
- When errors occur (API failures, validation errors)
- For warnings (session timeout approaching, offline mode)
- For informational messages (new features, tips)

---

## Key Concepts

### Toast Provider Pattern (Context API)
**Technical**: A React Context provider that manages toast state globally and renders toasts outside the normal component tree to avoid z-index and overflow issues.

**Plain English**: Think of it like a building's PA system - any room (component) can send an announcement, and it always plays through the same speakers (the fixed toast container) regardless of which room triggered it.

**Why We Use It**: Components deep in the tree (like a form validation error) need to show toasts without prop-drilling through dozens of parent components.

### Auto-Dismiss with Timer Cleanup
**Technical**: Uses `useRef` to store timeout IDs mapped by toast ID, with proper cleanup on removal and unmount to prevent memory leaks and stale callbacks.

**Plain English**: Like a parking meter that automatically expires tickets. Each toast gets its own timer, and if you manually dismiss it early, the timer gets cancelled so it doesn't try to dismiss a toast that's already gone.

**Why We Use It**: Toasts should disappear automatically after a few seconds, but users can dismiss them early. Without proper timer management, you'd get ghost dismissals or memory leaks.

### Framer Motion AnimatePresence
**Technical**: Uses `AnimatePresence` with `mode="popLayout"` to handle exit animations and layout shifts when toasts are added or removed from the stack.

**Plain English**: Like an elevator display that smoothly slides numbers up when floors change, rather than just blinking to new numbers. When a toast leaves, others slide up gracefully.

**Why We Use It**: Abrupt appearance/disappearance feels jarring. Smooth animations make the UI feel polished and help users track what's happening.

---

## Design Decisions

### Why Context Instead of Global Singleton
The toast system could have been a global singleton (like some toast libraries), but we chose React Context because:
1. **Testability**: Context can be mocked in tests; global singletons are harder to isolate
2. **SSR Safety**: Context handles server-side rendering properly; global state can cause hydration mismatches
3. **React DevTools Integration**: Context state is visible in React DevTools for debugging

### Why 4000ms Default Duration
The 4-second default balances:
- Long enough to read a moderate-length message
- Short enough not to clutter the screen during rapid operations
- Aligned with accessibility guidelines (WCAG recommends at least 3 seconds for time-limited content)

### Why Fixed Position Top-Right
- Top-right is a conventional location users expect for notifications
- Above-fold position ensures visibility without scrolling
- Right-side placement avoids covering navigation (typically left-side in this app)

### Why CSS Variables for Colors
Colors use CSS custom properties (`var(--pro-success)`, etc.) rather than hardcoded values to:
- Support theme switching (dark/light mode)
- Maintain consistency with the design system
- Allow easy global color adjustments

---

## Integration Points

### Dependencies (What This Needs)
- `react`: Core React hooks (`createContext`, `useContext`, `useState`, `useCallback`, `useRef`)
- `framer-motion`: Animation library (`motion`, `AnimatePresence`)
- `lucide-react`: Icon components (`CheckCircle`, `XCircle`, `AlertTriangle`, `Info`, `X`)
- CSS variables from global styles for theming

### Dependents (What Needs This)
- `src/renderer/App.tsx`: Wraps entire app with `ToastProvider`
- `src/renderer/components/error/NetworkErrorHandler.tsx`: Shows connection status toasts
- Any component using `useToast()` hook for notifications
- Form components showing success/error feedback

### Data Flow
```
Component calls addToast()
    -> Toast added to state array with unique ID
    -> Timer started for auto-dismiss
    -> AnimatePresence detects new item, animates in
    -> Timer fires OR user clicks X
    -> Toast removed from state
    -> AnimatePresence animates out
```

### Exports
- `ToastProvider`: Context provider component (wrap app)
- `useToast`: Hook returning `{ toasts, addToast, removeToast, clearAll }`
- `toast`: Convenience object with `success`, `error`, `warning`, `info` methods (placeholder implementation)
- `Toast`, `ToastType` interfaces for type-safe toast creation

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing Toast component
- **Why**: Part of systematic documentation effort for error handling and feedback systems
- **Impact**: Improves maintainability and onboarding for new developers
