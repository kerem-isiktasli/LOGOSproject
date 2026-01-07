# useLogos.ts - Type-Safe IPC Hooks

## Why This Exists

This file is the bridge between React components and the Electron main process. It provides reactive, type-safe hooks that wrap the IPC API exposed by the preload script (`window.logos`). Without these hooks, components would need to manage loading states, error handling, and caching manually for every IPC call.

By encapsulating IPC complexity in hooks, components remain declarative and testable while the hooks handle the imperative async plumbing.

## Key Concepts

- **AsyncState<T> Interface**: Standard shape for async data (`{ data, loading, error }`). All query hooks return this shape plus a `refetch` function.

- **useAsync Helper**: A generic hook factory that executes an async function, manages state transitions, and supports dependency-based refetching. Most read hooks are built atop this.

- **Mutation Hooks Pattern**: Write operations (`useCreateGoal`, `useUpdateGoal`, etc.) return `{ mutate, loading, error }` rather than auto-executing. This gives components control over when mutations fire.

- **Domain Groupings**:
  - Goals: CRUD for learning goals
  - Objects: Manage vocabulary/grammar items
  - Queue: Build optimized practice sequences
  - Session: Start/end sessions, record responses
  - Analytics: Fetch progress and bottleneck data
  - Mastery: Get mastery state per object
  - Claude: AI content generation, error analysis, hints
  - Onboarding: First-run wizard state and completion

- **window.logos Bridge**: Accesses `window.logos` (exposed by preload) which contains typed IPC invoke wrappers for each domain.

## Design Decisions

1. **Generic useAsync Factory**: Rather than duplicating loading/error handling in every hook, `useAsync` provides a reusable pattern. This reduces boilerplate and ensures consistent behavior.

2. **Null-Safe goalId/objectId**: Many hooks accept nullable IDs and short-circuit to return empty data. This handles the common case where a goal isn't selected yet.

3. **Dependency Array Serialization**: `useNextItem` serializes `excludeIds.join(',')` as a dependency. This ensures referential stability for array dependencies.

4. **Standalone vs. Stateful Session Hooks**: Both `useSession` (stateful, tracks current session) and `useStartSession`/`useEndSession` (standalone, no internal state) are provided. This flexibility supports different page architectures.

5. **Cue Level Mapping**: `useRecordResponse` converts `scaffoldingUsed.length` to `cueLevel` (0-3). This keeps the API ergonomic for callers who think in terms of scaffolding steps.

6. **Default Export Object**: The file exports both named hooks and a default object containing all hooks. This supports both tree-shakeable imports and dynamic access patterns.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/hooks/index.ts` | Re-exports all hooks from this file |
| Upstream | `renderer/pages/*` | Pages consume hooks for data and mutations |
| Upstream | `renderer/components/session/*` | Session components use session/queue hooks |
| Downstream | `window.logos` (preload) | IPC bridge object with domain-specific methods |
| Downstream | `main/ipc/*.ipc.ts` | Handlers for `goal.*`, `session.*`, `analytics.*`, etc. |
| Downstream | `main/services/*` | Services that execute business logic on main process |
| Downstream | `core/irt`, `core/fsrs` | Algorithms invoked during queue building and response recording |

## Hook Reference

| Hook | Type | Purpose |
|------|------|---------|
| `useGoals` | Query | List all goals |
| `useGoal` | Query | Get single goal by ID |
| `useCreateGoal` | Mutation | Create new goal |
| `useUpdateGoal` | Mutation | Update goal fields |
| `useDeleteGoal` | Mutation | Soft or hard delete goal |
| `useObjects` | Query | List objects in a goal |
| `useCreateObject` | Mutation | Add learning object |
| `useImportObjects` | Mutation | Bulk import objects |
| `useQueue` | Query | Build practice queue |
| `useNextItem` | Lazy Query | Get next item (manual fetch) |
| `useSession` | Stateful | Manage session lifecycle |
| `useSessionHistory` | Query | Past sessions for goal |
| `useStartSession` | Mutation | Start session (standalone) |
| `useEndSession` | Mutation | End session (standalone) |
| `useRecordResponse` | Mutation | Record practice response |
| `useProgress` | Query | Aggregate progress metrics |
| `useMasteryStats` | Query | Mastery distribution |
| `useBottlenecks` | Query | Struggling items |
| `useSessionStats` | Query | Session activity stats |
| `useMastery` | Query | Single object mastery |
| `useGenerateContent` | Mutation | AI content generation |
| `useAnalyzeError` | Mutation | AI error analysis |
| `useGetHint` | Mutation | AI hint generation |
| `useOnboardingStatus` | Query | Check first-run state |
| `useCompleteOnboarding` | Mutation | Finish onboarding wizard |
| `useSkipOnboarding` | Mutation | Skip onboarding |
