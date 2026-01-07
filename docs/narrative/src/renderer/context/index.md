# index.ts - Context Providers Barrel Export

## Why This Exists

React contexts in LOGOS manage cross-cutting state that many components need (current user, active goal, theme preferences). This index consolidates all context exports so the app can wrap providers cohesively and consumers can import hooks without knowing internal file paths.

Centralizing context also establishes a clear pattern for adding new global state domains.

## Key Concepts

- **AppProvider**: The root context provider aggregating all application-level state. Should wrap the entire component tree (typically in `App.tsx`). Internally may compose multiple sub-providers (auth, theme, etc.).

- **useApp Hook**: Provides read/write access to the global app context. Components call `useApp()` to access current user, active goal ID, and global dispatch actions.

- **AppContext Type**: Exported for typing purposes when defining context value shapes or extending the context in tests.

## Design Decisions

1. **Single Root Provider**: Rather than exporting multiple individual providers (AuthProvider, ThemeProvider, etc.), `AppProvider` composes them internally. This simplifies the App.tsx tree and hides composition complexity.

2. **Hook + Provider Pairing**: The canonical React pattern-export the provider for setup and the hook for consumption. This prevents direct context imports which bypass null checks.

3. **Default Type Export**: `AppContext` is exported as a type (via `export type { default as AppContext }`) to enable TypeScript consumers to reference the context shape without importing runtime code.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/App.tsx` | Wraps `<Router>` in `<AppProvider>` |
| Upstream | Any component | Calls `useApp()` to access global state |
| Downstream | `renderer/hooks/useLogos` | App context may hold the active goal ID used by many hooks |
| Downstream | `main/ipc/*` | Context may subscribe to IPC events for real-time updates |
| Sibling | `renderer/components/layout/AppShell` | Header may display user info from `useApp()` |
| Sibling | `renderer/components/feedback/ToastProvider` | May be composed inside AppProvider |
