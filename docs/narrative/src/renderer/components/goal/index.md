# index.ts - Goal Components Barrel Export

## Why This Exists

Goals are the central organizing concept in LOGOS-a user's language learning journey is partitioned into discrete goals (e.g., "JLPT N3 Vocabulary", "Business Korean Writing"). This index aggregates all goal-related UI components so pages can import cohesively without reaching into implementation files.

By grouping creation, display, and listing components together, the module maintains clear ownership of the "goal" domain within the renderer layer.

## Key Concepts

- **GoalCard**: Renders a single goal's summary (name, progress, target level). Accepts `GoalCardProps` and typically displays inside a list or dashboard.

- **GoalList**: Wraps multiple `GoalCard` instances with optional empty-state handling. Uses `GoalListProps` to configure layout and filtering.

- **CreateGoalForm**: A controlled form for goal creation including fields for name, target language, native language, description, and target level. Emits `CreateGoalFormData` on submit.

- **GoalData Type**: The domain shape representing a goal entity as surfaced to the UI (id, name, languages, progress metrics).

## Design Decisions

1. **Card + List Pairing**: Rather than a single monolithic component, `GoalCard` and `GoalList` are separated. This allows embedding individual cards in contexts like dashboards while still offering a pre-composed list for the Goals page.

2. **Form Colocation**: `CreateGoalForm` lives in the goal module rather than a generic forms folder. This keeps goal-specific validation and field logic encapsulated.

3. **Type Re-exports**: `GoalCardProps`, `GoalData`, `GoalListProps`, `CreateGoalFormProps`, `CreateGoalFormData` are all explicitly exported so consumers can type parent containers and callbacks.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/pages/GoalsPage` | Primary consumer rendering `GoalList` and `CreateGoalForm` |
| Upstream | `renderer/pages/DashboardPage` | May show a `GoalCard` summary widget |
| Downstream | `renderer/hooks/useLogos` | `useGoals`, `useGoal`, `useCreateGoal` provide data and mutations |
| Downstream | `main/ipc/goal.ipc` | IPC handlers for CRUD operations |
| Sibling | `renderer/components/ui/GlassCard` | `GoalCard` likely extends `GlassCard` for styling |
| Sibling | `renderer/components/ui/GlassButton` | `CreateGoalForm` uses styled buttons for submit/cancel |
