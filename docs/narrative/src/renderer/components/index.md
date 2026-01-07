# index.ts - Central Components Barrel Export

## Why This Exists

This is the root barrel file for the entire renderer component library. It aggregates and re-exports every component category (ui, layout, goal, session, analytics) so that any consumer in the application can import from a single path:

```typescript
import { GlassButton, AppShell, GoalCard, SessionView, ProgressDashboard } from '@/renderer/components';
```

Without this central index, imports would scatter across dozens of paths, making refactors painful and mental models fragmented.

## Key Concepts

- **Wildcard Re-exports**: Uses `export * from './submodule'` pattern for each component category. This means additions to child index files automatically propagate to the root.

- **Category Modules**:
  - `ui`: Design system primitives (buttons, cards, inputs, badges, progress indicators)
  - `layout`: Application shell, sidebar, navigation chrome
  - `goal`: Goal CRUD components
  - `session`: Learning session experience (questions, feedback, progress)
  - `analytics`: Dashboards and data visualizations

## Design Decisions

1. **Flat Re-export Strategy**: All child modules are re-exported without namespacing. This prioritizes import convenience (`{ GlassButton }`) over strict categorization. The trade-off is potential name collisions if two modules export the same name-currently avoided by convention.

2. **Order by Dependency**: Imports are ordered roughly by dependency level (ui first, then layout, then domain components). UI primitives have no internal deps; domain components may depend on UI.

3. **No Direct Component Definitions**: This file contains zero component code-only re-exports. It exists purely as an aggregation point, keeping the Single Responsibility Principle intact.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/pages/*` | All pages import components from this barrel |
| Upstream | `renderer/App.tsx` | May import layout components directly |
| Downstream | `renderer/components/ui/index` | Provides design system primitives |
| Downstream | `renderer/components/layout/index` | Provides app shell and navigation |
| Downstream | `renderer/components/goal/index` | Provides goal domain components |
| Downstream | `renderer/components/session/index` | Provides session domain components |
| Downstream | `renderer/components/analytics/index` | Provides visualization components |
