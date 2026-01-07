# index.ts - UI Components Barrel Export (Liquid Glass Design System)

## Why This Exists

This index is the foundation of the LOGOS design system, code-named "Liquid Glass". It exports every primitive UI component (buttons, cards, inputs, badges, progress indicators) that higher-level domain components compose.

Centralizing design primitives here ensures visual consistency across the application and provides a single upgrade path when the design language evolves.

## Key Concepts

- **GlassCard / GlassCardHeader / GlassCardBody / GlassCardFooter**: A compound card component with glassmorphism styling (translucent backgrounds, blur, subtle borders). The header/body/footer slots enable flexible content composition.

- **GlassButton / GlassButtonGroup / GlassIconButton**: Button variants supporting primary/secondary/ghost styles. `GlassButtonGroup` handles spacing for adjacent buttons; `GlassIconButton` is a square icon-only variant.

- **GlassInput / GlassTextarea / GlassSelect**: Form controls with consistent glass styling. Each exports a dedicated props type for strict typing.

- **GlassBadge / MasteryBadge / StatusBadge / ComponentBadge**: Badge variants for different contexts-mastery level indicators, status labels, and linguistic component tags.

- **GlassProgress / CircularProgress / MasteryProgress / SessionProgress**: Progress indicators in linear and circular forms, plus domain-specific wrappers for mastery and session contexts.

- **Logo**: The LOGOS wordmark/icon component used in headers and splash screens.

## Design Decisions

1. **Glass Prefix Convention**: All primitives share the "Glass" prefix to signal design system membership and avoid collisions with external library components.

2. **Compound Card Pattern**: Rather than a monolithic card prop for header/body/footer, separate sub-components are exported. This enables flexible composition without complex prop drilling.

3. **Domain Badge Variants**: `MasteryBadge`, `StatusBadge`, `ComponentBadge` wrap `GlassBadge` with domain-specific styling presets, reducing boilerplate in consuming components.

4. **Parallel Progress Variants**: Four progress exports serve different needs-raw linear, raw circular, mastery-styled, and session-styled-balancing reuse with domain optimization.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/components/layout/*` | AppShell, Sidebar use GlassButton, Logo |
| Upstream | `renderer/components/goal/*` | GoalCard extends GlassCard |
| Upstream | `renderer/components/session/*` | QuestionCard, FeedbackCard use GlassCard, GlassInput |
| Upstream | `renderer/components/analytics/*` | ProgressDashboard uses GlassCard wrappers |
| Upstream | `renderer/components/charts/*` | Chart cards use GlassCard styling |
| Downstream | `renderer/styles/glass.css` (or Tailwind config) | Defines the actual CSS for glassmorphism effects |
| Sibling | `renderer/components/feedback/*` | Toast may use GlassBadge for status indication |
