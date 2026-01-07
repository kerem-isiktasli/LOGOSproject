# DashboardPage

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/pages/DashboardPage.tsx`
> **Status**: Active

---

## Why This Exists

The DashboardPage is the **home base** of LOGOS - the first thing users see after selecting a learning goal. It exists because language learners need a quick, at-a-glance understanding of where they stand before diving into a study session.

This page answers the fundamental questions every returning learner asks:
- "How am I doing overall?"
- "What should I focus on today?"
- "Am I making progress?"
- "What's due for review?"

Without a dashboard, users would jump directly into sessions without context, like entering a gym without knowing which muscles need work. The Dashboard provides the situational awareness that transforms random practice into strategic learning.

The page also serves as the **central navigation hub**, offering quick access to Practice (sessions), Goals (management), and Analytics (deep insights). It is the crossroads where all user journeys begin.

---

## Key Concepts

### Progress Overview

The ProgressDashboard component (imported from analytics) displays key metrics for the active goal:
- **Overall Progress**: Percentage of items reaching mastery
- **Due Count**: Items requiring review today
- **Streak**: Consecutive days of practice
- **Accuracy**: Historical correct response rate
- **Cue-Free Accuracy**: Performance without hints (the true mastery indicator)

These metrics feed from the `useProgress` and `useMasteryStats` hooks, which query the main process for aggregated learning data.

### Bottleneck Detection

The page surfaces the user's **primary bottleneck** - the linguistic component (PHON, MORPH, LEX, SYNT, PRAG) where they struggle most. This comes from Claude AI analysis via `useBottlenecks`.

Think of it as a "focus alert": instead of practicing everything equally, the system says "Hey, your morphology is weak - consider focusing there." This enables targeted improvement.

### Vocabulary Network Graph

The NetworkGraphCard visualizes learned vocabulary as an interactive force-directed graph. Nodes are words; edges represent relationships:
- **Semantic links**: Words sharing component types
- **Collocation links**: Words that frequently appear together (via PMI analysis)

This visualization makes the abstract concept of "vocabulary network" tangible. Users see how their learned words cluster and connect, reinforcing the principle that language is learned in chunks, not isolated items.

### Graph Data Transformation

The raw `objects` data (vocabulary items) must be transformed into graph format:
- **Nodes**: Each object becomes a node with id, label, type, and masteryStage
- **Edges**: Created algorithmically - items sharing components or similar mastery levels get connected
- **Limits**: Capped at 30 nodes and 50 edges for performance

This transformation happens in a `useMemo` hook to prevent recalculation on every render.

---

## Design Decisions

### No Goal = Welcome Screen

When no active goal exists, the Dashboard displays a welcoming splash with the LOGOS logo and a "Create Your First Goal" CTA. This guides new users toward the essential first action without showing an empty or broken interface.

### Three-Column Quick Actions Grid

Below the main content, three action cards provide instant navigation:
- Practice (pencil icon) - Start a learning session
- Goals (target icon) - Manage learning goals
- Analytics (chart icon) - View detailed statistics

This grid uses equal columns (`grid-cols-3`) with hover scaling effects, creating an inviting touch target for each action. The icons + labels pattern ensures clarity for new users while remaining scannable for power users.

### Interactive Network Graph

The NetworkGraph supports node selection via click. When a user clicks a node:
1. If the node is already selected, it deselects
2. If a different node is clicked, it becomes the new selection

This toggle behavior enables exploration without modal dialogs or context switches. Selected nodes could highlight related items or display details in future iterations.

### Physics-Enabled Visualization

The graph uses physics simulation (`enablePhysics={true}`) for organic node positioning. This creates natural clustering where related items gravitate together, making the network structure intuitive to understand.

### Loading States

Both `goalsLoading` and `progressLoading` trigger the loading screen. This ensures users never see partially-loaded data that could confuse or mislead. The pulsing book emoji signals "data is being prepared" consistently with other pages.

---

## Integration Points

### Dependencies (What This Needs)

| Module | Import | Purpose |
|--------|--------|---------|
| `../context` | `useApp` | Access `activeGoal`, `activeGoalId`, `goalsLoading` |
| `../hooks` | `useProgress` | Fetch overall progress statistics |
| `../hooks` | `useMasteryStats` | Get mastery stage distribution |
| `../hooks` | `useBottlenecks` | Get AI-analyzed learning bottlenecks |
| `../hooks` | `useObjects` | Fetch vocabulary items for network graph |
| `../components/analytics` | `ProgressDashboard`, `NetworkGraphCard` | Complex visualization components |
| `../components/analytics` | `GraphNode`, `GraphEdge` (types) | Type definitions for graph data |
| `../components/ui` | `GlassCard`, `GlassButton`, `Logo` | Design system primitives |

### IPC Channels (Behind the Hooks)

The hooks abstract these main process calls:
- `window.logos.analytics.getProgress(goalId)` - Progress statistics
- `window.logos.mastery.getStats(goalId)` - Mastery distribution
- `window.logos.claude.getBottlenecks(goalId)` - AI bottleneck analysis
- `window.logos.object.list(goalId)` - Vocabulary objects for graph

### Dependents (What Needs This)

- **App Router**: Primary landing page after login/goal selection
- **Navigation Component**: Links to Dashboard from all other pages
- **SessionPage**: Returns here via "Back to Dashboard" after sessions

### Props Interface

```typescript
interface DashboardPageProps {
  onNavigateToSession?: () => void;  // Navigate to training session
  onNavigateToGoals?: () => void;    // Navigate to goals management
}
```

These callbacks enable the parent to control navigation behavior, useful for both standard routing and electron-specific navigation patterns.

### Data Flow

```
Component mounts with activeGoalId from context
       |
       +--> useProgress(activeGoalId) --> IPC --> progressData
       |
       +--> useMasteryStats(activeGoalId) --> IPC --> masteryStats
       |
       +--> useBottlenecks(activeGoalId) --> IPC (Claude) --> bottlenecks
       |
       +--> useObjects(activeGoalId) --> IPC --> objects
       |
       v
useMemo transforms objects into graphNodes + graphEdges
       |
       v
Render ProgressDashboard with progressData + bottleneckData
       |
       v
Render NetworkGraphCard with graphNodes + graphEdges
       |
       v
Render Quick Actions grid with navigation callbacks
```

### Type Safety Patterns

The code uses defensive type guards (`typeof x === 'object'`) and nullish coalescing (`??`) extensively:

```typescript
const progressObj = progress && typeof progress === 'object' ? progress as any : null;
const masteryObj = masteryStats && typeof masteryStats === 'object' ? masteryStats as any : null;
```

This handles edge cases where IPC responses might be null, undefined, or structured differently than expected. The fallback to `0` or `[]` ensures the UI never crashes due to missing data.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial shadow documentation for DashboardPage
- **Why**: Fulfill documentation-specialist requirements for narrative explanation
- **Impact**: Future developers understand dashboard architecture and data flow

### Initial Implementation
- **What Changed**: Created dashboard with progress overview, vocabulary network, and quick actions
- **Why**: Users need a home base showing learning status and navigation options
- **Impact**: Enables at-a-glance progress monitoring and centralized navigation
