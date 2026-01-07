# App Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/App.tsx`
> **Status**: Active

---

## Why This Exists

The App component is the **root of the React application**, responsible for composing the provider hierarchy, managing top-level routing, and orchestrating the onboarding-to-main-app flow. It's the "main function" of the renderer process.

**Business Need**: Users need a coherent application experience from the moment they open LOGOS. New users should be guided through onboarding; returning users should land on their dashboard. The app needs error handling, network resilience, and state management all wired up before any UI renders.

**When Used**:
- Rendered by `main.tsx` as the single React root component
- Controls all navigation between pages
- Determines onboarding vs. main app display
- Composes all provider layers

---

## Key Concepts

### Provider Composition (Wrapper Hierarchy)
**Technical**: Multiple context providers are nested in a specific order to ensure dependencies are satisfied: ErrorBoundary > AppProvider > ToastProvider > NetworkErrorHandler > AppContent.

**Plain English**: Like Russian nesting dolls - each layer wraps around the next, and the order matters because inner dolls (components) need their outer dolls (providers) to exist first.

**Why We Use It**: NetworkErrorHandler needs Toast for notifications, so ToastProvider must wrap it. AppProvider needs to be inside ErrorBoundary so errors in context don't crash everything.

### Client-Side Routing
**Technical**: Uses simple state-based routing (`currentPage`) rather than a full router library. Page components are conditionally rendered based on this state.

**Plain English**: Like a TV showing different channels based on what button you press - no URL changes, just internal state switching which component to display.

**Why We Use It**:
- Electron apps don't need URL-based routing (no shareable URLs)
- Simpler than adding React Router for a desktop app
- Faster transitions (no URL parsing overhead)

### Onboarding Gate
**Technical**: Checks `onboardingStatus.needsOnboarding` on mount. If true, renders `OnboardingWizard` instead of the main app. Only after completion does the main UI appear.

**Plain English**: Like a hotel that requires check-in before giving you room access - new guests (users) must complete the onboarding flow before they can access the main app.

**Why We Use It**: New users need to set up their first learning goal before the app is useful. The onboarding collects language preferences, learning objectives, and daily time commitment.

### Navigation Callbacks Pattern
**Technical**: Pages receive navigation callbacks as props (`onNavigateToSession`, `onNavigateBack`, etc.) rather than importing a global router.

**Plain English**: Like giving someone directions verbally ("turn left at the corner") rather than giving them a GPS device - simpler for this use case.

**Why We Use It**:
- Explicit dependencies (pages declare what navigation they need)
- Easier testing (mock the callbacks)
- Type-safe (TypeScript knows what callbacks exist)

---

## Design Decisions

### Why No React Router
- Desktop apps don't benefit from URL-based routing
- Simpler mental model for a contained application
- No need for deep linking, bookmarks, or back button
- Reduces bundle size

### Why Onboarding in App.tsx (Not Separate Route)
- Onboarding is fundamentally different from the main app
- Doesn't need the sidebar, navigation, or app shell
- Cleaner separation of concerns
- Single responsibility: App.tsx decides which "mode" to show

### Why Loading State for Onboarding Check
The `showOnboarding === null` state shows a loading spinner because:
- We don't know if user needs onboarding until API responds
- Showing the wrong UI briefly would be jarring
- Spinner is neutral and fast

### Why Pass activeGoal to Pages
Pages like `AnalyticsPage` receive `goalId={activeGoal?.id}` as a prop even though they could use `useApp()`:
- Makes dependencies explicit
- Easier to test pages in isolation
- Could support multi-goal views in the future

### Why Korean Navigation Labels (in comments) but English in UI
The codebase has Korean comments but English UI labels ("Dashboard", "Practice", "Goals"). This suggests:
- Developer documentation in Korean
- UI internationalization pending
- English as default/fallback language

---

## Integration Points

### Dependencies (What This Needs)
- `react`: Core React hooks
- `./context`: `AppProvider`, `useApp`
- `./components/layout`: `AppShell`, `Sidebar`
- `./pages`: All page components (`DashboardPage`, `SessionPage`, `GoalsPage`, `AnalyticsPage`, `VocabularyPage`)
- `./components/onboarding`: `OnboardingWizard`
- `./components/feedback`: `ToastProvider`
- `./components/error`: `ErrorBoundary`, `NetworkErrorHandler`
- `./hooks/useLogos`: Onboarding hooks
- `lucide-react`: Navigation icons

### Dependents (What Needs This)
- `src/renderer/main.tsx`: Renders this component into the DOM

### Provider Hierarchy (Detailed)
```
ErrorBoundary (level="critical")
  │
  └─ AppProvider (global state)
       │
       └─ ToastProvider (notifications)
            │
            └─ NetworkErrorHandler (network resilience)
                 │
                 └─ AppContent (routing + UI)
                      │
                      ├─ OnboardingWizard (if new user)
                      │
                      └─ AppShell + Sidebar + Pages (if returning user)
```

### Page Routing Map
| Page State | Component | Description |
|------------|-----------|-------------|
| `dashboard` | `DashboardPage` | Overview, progress, quick actions |
| `session` | `SessionPage` | Active learning/practice |
| `goals` | `GoalsPage` | Goal management, creation |
| `analytics` | `AnalyticsPage` | Detailed progress charts |
| `vocabulary` | `VocabularyPage` | Word lists, mastery levels |

### Navigation Items Structure
Each navigation item has:
- `id`: Unique identifier matching page state
- `label`: Display text
- `icon`: Lucide icon component
- `active`: Boolean for current page highlight
- `onClick`: Navigation callback

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing App component
- **Why**: Part of systematic documentation effort for core application architecture
- **Impact**: Clarifies app structure and provider hierarchy for maintainers
