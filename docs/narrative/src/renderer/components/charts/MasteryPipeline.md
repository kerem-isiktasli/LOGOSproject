# MasteryPipeline Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/charts/MasteryPipeline.tsx`
> **Status**: Active

---

## Why This Exists

The MasteryPipeline visualizes vocabulary distribution across five learning stages: Unknown, Recognition, Recall, Production, and Automatic. This component exists to answer: **"Where are my words in the learning journey?"**

Learning a word is not a binary event - it is a gradual process from "never seen" to "automatic recall." Traditional vocabulary trackers show only total words learned, hiding the critical distinction between words you can recognize and words you can produce fluently. This pipeline makes the full learning journey visible.

The philosophical framework (from the source comments) emphasizes:
- **Visual Isomorphism**: Linear left-to-right flow mirrors learning progression
- **Affordance**: Each stage is a "container" holding words at that level
- **State Projection**: Animations celebrate stage transitions as achievements
- **Concealment by Design**: FSRS algorithm complexity is hidden behind intuitive stages

**Business Need**: Users need to understand vocabulary depth, not just breadth. Knowing you have 500 words at Recognition but only 50 at Automatic reveals that most vocabulary is not yet usable in real conversation.

**When Used**:
- Dashboard showing current vocabulary status
- Progress reports comparing stages over time
- Goal detail pages showing mastery breakdown

---

## Key Concepts

### The Five Mastery Stages
**Technical**: A staged model mapping FSRS stability and retrievability to qualitative learning phases.

| Stage | Key | Description |
|-------|-----|-------------|
| 0 | Unknown | Not yet studied |
| 1 | Recognition | Can recognize when seen/heard |
| 2 | Recall | Can recall with effort |
| 3 | Production | Can produce actively |
| 4 | Automatic | Fluent, instant recall |

**Plain English**: Think of these stages as boxes words move through. When you first see a word, it is in the "Unknown" box. After some practice, you can recognize it. With more practice, you can recall it yourself. Eventually, it becomes automatic - like your native language.

**Why We Use It**: This staging model makes abstract FSRS metrics tangible and actionable. Users understand "move words from Recognition to Recall" better than "increase stability coefficient."

### Stage Progression Metaphor
**Technical**: The left-to-right flow with chevron connectors visualizes progression as a pipeline where items move through stages.

**Plain English**: Like an assembly line, words enter on the left (Unknown) and gradually move right as you practice them. The goal is to get all words to the far right (Automatic).

**Why We Use It**: The pipeline metaphor creates a clear mental model. Users naturally understand they need to "move words through the pipeline" to achieve fluency.

### Change Indicators
**Technical**: When `previousData` is provided, the component calculates and displays delta values (current - previous) for each stage.

**Plain English**: If you had 50 words at Recall yesterday and 55 today, the card shows "+5" to celebrate your progress.

**Why We Use It**: Change indicators provide immediate feedback on learning momentum. Seeing "+10" at Production is more motivating than just seeing "47."

---

## Design Decisions

### Two Rendering Modes (Compact and Full)
The `compact` prop switches between:
- **Compact**: Horizontal button row with icons and counts, suitable for headers
- **Full**: Detailed cards with icons, counts, labels, change indicators, and progress bar

This serves both summary and detailed contexts without separate components.

### Animated Count Changes
When the count for a stage changes, it animates with a scale/opacity transition. This creates:
- Visual feedback that data updated
- A small celebration when numbers increase
- Clear indication of which stages changed

### Stage Configuration Array
All stage metadata (label, short label, icon, colors, description) is defined in a single `stageConfigs` array. This:
- Centralizes configuration for easy updates
- Ensures consistency across compact and full modes
- Makes it easy to modify stage definitions

### Distinct Icons per Stage
Each stage has a unique Lucide icon:
- `CircleDashed`: Unknown (empty, not started)
- `CircleDot`: Recognition (starting to form)
- `Circle`: Recall (solid but simple)
- `Circle` with thick stroke: Production (more substantial)
- `CheckCircle`: Automatic (complete, done)

This progression of icons mirrors the journey from incomplete to complete.

### Color-Coded Stages
Each stage has a distinct color using CSS variables (`--pro-stage-0` through `--pro-stage-4`). These colors:
- Provide quick visual identification
- Create consistent vocabulary across charts
- Progress from cooler to warmer as mastery increases

### Stacked Progress Bar
Below the stage cards, a horizontal stacked bar shows the proportional distribution of words across stages. This provides:
- At-a-glance summary of overall distribution
- Visual emphasis on where most words currently sit
- Animated growth as stages change

### Percentage Legend
A 5-column grid below the progress bar shows each stage's percentage of total words. This gives precise numbers for users who want exact data rather than visual approximations.

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `framer-motion` (motion, AnimatePresence) | Animations for counts, hover effects, and change indicators |
| `lucide-react` (CircleDashed, CircleDot, Circle, CheckCircle, ChevronRight) | Stage icons and connectors |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Dashboard | Shows current vocabulary distribution |
| Goal detail pages | Displays mastery breakdown for specific goal |
| Progress reports | Compares distribution over time with previousData |

### Data Sources
The `MasteryStageCount` interface expects:
```typescript
{
  unknown: number,      // Count at stage 0
  recognition: number,  // Count at stage 1
  recall: number,       // Count at stage 2
  production: number,   // Count at stage 3
  automatic: number     // Count at stage 4
}
```

This data comes from:
- FSRS algorithm output (stability/retrievability mapped to stages)
- Vocabulary database aggregation by mastery level

### Data Flow
```
FSRS Algorithm / Vocabulary Database
    |
    v
Parent Component (aggregates counts, optionally fetches previous)
    |
    v
MasteryPipeline (visualization)
    |
    +--> onStageClick: Filters vocabulary list to show words at that stage
```

### Related Components
- `FSRSCalendar`: Shows when reviews happened (activity)
- `AbilityRadarChart`: Shows ability levels by linguistic component
- `ProgressDashboard`: May embed pipeline or show summary metrics

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain the five-stage mastery model and pipeline visualization
- **Impact**: Clarifies how vocabulary depth is tracked and displayed
