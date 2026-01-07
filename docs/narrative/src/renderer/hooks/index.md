# index.ts - Hooks Barrel Export

## Why This Exists

This index centralizes all custom React hooks that interface with the LOGOS backend via IPC. By re-exporting from `useLogos`, consuming components get a single import path for goals, objects, queues, sessions, analytics, mastery, and AI-assisted features.

This barrel pattern decouples page components from hook implementation details, allowing hook internals to evolve without updating dozens of import statements.

## Key Concepts

- **Goal Hooks**: `useGoals`, `useGoal`, `useCreateGoal`, `useUpdateGoal`, `useDeleteGoal` - CRUD operations for learning goals.

- **Object Hooks**: `useObjects`, `useCreateObject`, `useImportObjects` - Manage learning objects (vocabulary, grammar points) within a goal.

- **Queue Hooks**: `useQueue`, `useNextItem` - Build and traverse the optimized practice queue based on IRT/FSRS algorithms.

- **Session Hooks**: `useSession`, `useSessionHistory`, `useStartSession`, `useEndSession`, `useRecordResponse` - Lifecycle management for learning sessions.

- **Analytics Hooks**: `useProgress`, `useMasteryStats`, `useBottlenecks`, `useSessionStats` - Fetch aggregated learning metrics.

- **Mastery Hooks**: `useMastery` - Retrieve mastery state for individual learning objects.

- **Claude Hooks**: `useGenerateContent`, `useAnalyzeError`, `useGetHint` - AI-powered content generation and error analysis.

## Design Decisions

1. **Single Source File**: All hooks are defined in `useLogos.ts` and re-exported here. This keeps related IPC logic together and avoids a sprawl of tiny hook files.

2. **Grouped by Domain**: The export list is organized by domain (Goal, Object, Queue, Session, Analytics, Mastery, Claude) with comments. This aids discoverability when scanning the barrel.

3. **No Wildcard Export**: Unlike some barrel files, this one uses explicit named exports. This makes the public API surface intentional and enables tree-shaking of unused hooks.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/pages/*` | All pages import hooks from this barrel |
| Upstream | `renderer/components/goal/*` | Goal components use goal hooks |
| Upstream | `renderer/components/session/*` | Session components use session/queue hooks |
| Downstream | `useLogos.ts` | Implementation file containing all hook definitions |
| Downstream | `window.logos` (preload) | Hooks call IPC bridge methods exposed on window |
| Downstream | `main/ipc/*.ipc.ts` | IPC handlers that process hook requests |
