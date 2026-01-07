# index.ts - Pages Barrel Export

## Why This Exists

Pages in LOGOS represent top-level routes in the application. This index consolidates all page exports so the router configuration can import from a single location. It also serves as a quick reference for what routes exist in the application.

Centralizing page exports decouples router configuration from page file paths, simplifying route refactoring.

## Key Concepts

- **DashboardPage**: The home/landing view after login or onboarding. Displays goal summaries, recent activity, and quick-start session buttons. This is the "Mission Control" of the learner's journey.

- **SessionPage**: The active learning experience where users practice vocabulary and grammar. Renders the `SessionView` component and manages session lifecycle from start to completion.

- **GoalsPage**: Lists all learning goals with options to create, edit, or archive goals. Serves as the goal management hub.

## Design Decisions

1. **No Props Types Exported**: Unlike component barrels, page exports are plain components without prop type exports. Pages receive route params via React Router hooks rather than props.

2. **Minimal Page Set**: Currently only three pages are exported. As the application grows (Settings, Analytics, Profile), they will be added here following the same pattern.

3. **Implicit Routing Contract**: The barrel doesn't define routes-that lives in the router configuration. This separation keeps routing logic (paths, guards) distinct from page implementation.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/App.tsx` or `renderer/router.tsx` | Router imports pages and maps to paths |
| Downstream | `renderer/components/*` | Pages compose components (AppShell, SessionView, GoalList, etc.) |
| Downstream | `renderer/hooks/*` | Pages call hooks to fetch and mutate data |
| Downstream | `renderer/context/*` | Pages use `useApp()` for global state |
| Sibling | `renderer/pages/SettingsPage` (future) | Will be added to this barrel when implemented |
| Sibling | `renderer/pages/AnalyticsPage` (future) | Will be added when deep analytics view is built |
