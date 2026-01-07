# index.ts - Analytics Components Barrel Export

## Why This Exists

The analytics index file serves as the single point of entry for all dashboard and data visualization components in LOGOS. Without this barrel export, every consumer would need to know the exact file path of each analytics component, leading to fragile imports scattered throughout the codebase. By consolidating exports here, refactoring internal file structures becomes transparent to consumers.

This module enables the "Insights Cockpit" experience where learners can observe their progress, identify bottlenecks, and understand knowledge relationships.

## Key Concepts

- **ProgressDashboard**: The main analytics view aggregating learning metrics (accuracy, streak, mastery distribution) into a digestible summary. Consumes `ProgressData` and `BottleneckData` to render high-level KPIs.

- **NetworkGraph / NetworkGraphCard**: Force-directed graph visualization for showing relationships between learning objects. Two conversion helpers (`collocationsToGraph`, `morphologyToGraph`) transform raw linguistic data into the `GraphNode` / `GraphEdge` format required by the renderer.

- **Type Re-exports**: Exposes `ProgressDashboardProps`, `NetworkGraphProps`, `NetworkGraphCardProps` so parent components can type-check props without importing implementation files.

## Design Decisions

1. **Co-located Converters**: The `collocationsToGraph` and `morphologyToGraph` functions are exported alongside the visualization component rather than living in a separate `/utils` folder. This keeps the transformation logic close to its sole consumer, reducing cognitive overhead.

2. **Dual Component Export**: `NetworkGraph` (raw canvas) and `NetworkGraphCard` (styled wrapper) are both exposed. This lets simpler pages embed the raw graph while feature pages can use the card variant with built-in controls.

3. **Explicit Type Exports**: Types are re-exported explicitly rather than using `export * from`. This makes the public API surface intentional and prevents accidental internal type leakage.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/pages/DashboardPage` | Imports `ProgressDashboard` to render main view |
| Upstream | `renderer/pages/AnalyticsPage` | Imports `NetworkGraphCard` for relationship visualization |
| Downstream | `renderer/hooks/useLogos` | `useProgress`, `useBottlenecks` provide data consumed by these components |
| Downstream | `main/ipc/analytics.ipc` | IPC handlers supply the raw analytics payload |
| Sibling | `renderer/components/charts/*` | Lower-level chart primitives that may be composed inside ProgressDashboard |
