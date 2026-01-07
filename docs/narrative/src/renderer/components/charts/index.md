# index.ts - Charts Components Barrel Export

## Why This Exists

LOGOS relies heavily on data visualization to make adaptive learning algorithms comprehensible to users. The charts index provides a unified export surface for specialized visualizations that translate IRT ability estimates, FSRS scheduling predictions, and linguistic component analysis into visual metaphors learners can intuitively grasp.

Without centralized exports, chart consumption would become inconsistent and import paths brittle, especially as the visualization library grows.

## Key Concepts

- **AbilityRadarChart**: Renders a radar/spider chart showing the learner's estimated ability across multiple linguistic dimensions (e.g., vocabulary, morphology, syntax). Accepts `AbilityData[]` representing each axis.

- **MasteryPipeline**: Visualizes the funnel of learning objects across mastery stages (new, learning, review, mastered). Uses `MasteryStageCount` to drive bar or Sankey-style representation, revealing where objects accumulate or drop off.

- **FSRSCalendar**: A heatmap calendar showing predicted and actual review activity per day. `DayData` encodes scheduled vs. completed reviews, enabling learners to spot adherence patterns.

- **CascadeDiagram**: Shows hierarchical component relationships (e.g., how a sentence decomposes into morphemes). `ComponentData` structures nested component information for recursive rendering.

## Design Decisions

1. **Domain-Specific Chart Library**: Rather than exposing generic chart primitives (line, bar, pie), this module exports LOGOS-specific visualizations. Each chart encapsulates domain knowledge (IRT scales, FSRS intervals) so consumers need not re-implement that logic.

2. **Type-per-Chart Pattern**: Each chart defines and exports its own data type (AbilityData, MasteryStageCount, DayData, ComponentData). This keeps contracts explicit and aids TypeScript inference without a monolithic types file.

3. **Korean Code Comments**: The JSDoc header uses Korean (`데이터 시각화 컴포넌트 모음`) reflecting the project's multilingual documentation approach for language-learning context.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/components/analytics/*` | ProgressDashboard may embed these charts |
| Upstream | `renderer/pages/AnalyticsPage` | Primary consumer of FSRSCalendar and AbilityRadarChart |
| Downstream | `renderer/hooks/useLogos` | `useMasteryStats`, `useProgress` supply the underlying data |
| Downstream | `core/irt`, `core/fsrs` | Algorithms whose outputs these charts visualize |
| Sibling | `renderer/components/ui/GlassCard` | Charts are typically wrapped in glass card containers for consistent styling |
