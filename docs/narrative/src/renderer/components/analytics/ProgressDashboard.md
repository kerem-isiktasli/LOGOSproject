# ProgressDashboard Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/analytics/ProgressDashboard.tsx`
> **Status**: Active

---

## Why This Exists

The ProgressDashboard is the central analytics hub for a single learning goal. It answers the fundamental question every learner asks: "How am I doing?" But it goes beyond simple percentages to provide **actionable insights** that guide future study sessions.

Language learning is a long journey measured in months or years. Without meaningful progress visualization, learners lose motivation because they cannot see how far they have come. This dashboard exists to make invisible progress visible, transforming abstract learning into tangible achievements.

**Business Need**: Users need to understand their current standing, identify areas for improvement, and feel motivated to continue. The dashboard serves both informational and emotional purposes - it informs about progress while celebrating achievements.

**When Used**:
- After selecting a specific goal from the goals list
- As the landing page for each learning goal
- For reviewing progress before starting a study session

---

## Key Concepts

### Theta-to-Level Conversion
**Technical**: The `thetaToLevel()` function maps IRT theta values (typically -3 to +3) to CEFR levels (A1-C2) using threshold ranges.

**Plain English**: Theta is a mathematical measurement of ability that most people would not understand. CEFR levels (A1, A2, B1, B2, C1, C2) are internationally recognized language proficiency labels. This function translates the internal math into familiar terms.

**Why We Use It**: Users care about "Am I intermediate or advanced?" not "Is my theta 0.7 or 1.2?" The conversion bridges technical precision with practical meaning.

### Mastery Distribution Array
**Technical**: `masteryDistribution: [number, number, number, number, number]` - a 5-element tuple representing counts at each mastery stage (0-4).

**Plain English**: This shows how many words are at each learning stage: completely new, just learning, practicing, nearly mastered, and fully automatic. Think of it like sorting vocabulary into five boxes based on how well you know them.

**Why We Use It**: A single "completion percentage" hides important nuance. Knowing that 100 words are at stage 2 versus stage 4 tells users where to focus their effort.

### Scaffolding Gap Analysis
**Technical**: Compares `cueFreeAccuracy` (recall without hints) to `averageAccuracy` (with scaffolding support). The gap indicates how much a learner depends on contextual cues.

**Plain English**: Some learners can answer correctly when given hints but struggle without them. This metric reveals whether knowledge is truly internalized or still relies on support.

**Why We Use It**: True fluency means performing without assistance. This comparison identifies when learners are ready to remove training wheels.

### Bottleneck Detection
**Technical**: The `BottleneckData` interface provides analysis of which linguistic component (PHON, MORPH, LEX, SYNT, PRAG) is weakest, with confidence scores and recommendations.

**Plain English**: If you keep struggling with word endings (morphology) more than pronunciation, the system detects this pattern and highlights it as your "bottleneck" - the thing holding you back.

**Why We Use It**: Targeted practice is more efficient than generic review. Knowing your weakest area lets you focus effort where it matters most.

### Component Types (PHON, MORPH, LEX, SYNT, PRAG)
**Technical**: An enum representing the five linguistic subsystems: Phonology, Morphology, Lexical, Syntax, and Pragmatics.

**Plain English**:
- **Phonology**: How words sound
- **Morphology**: Word parts and endings
- **Lexical**: Vocabulary and word meaning
- **Syntax**: Sentence structure and grammar
- **Pragmatics**: Social context and usage

**Why We Use It**: Language ability is not one thing - it is five interconnected skills. Tracking each separately reveals detailed strengths and weaknesses.

---

## Design Decisions

### Flexible Goal Info Display
The component dynamically builds title and subtitle from whatever goal fields are available (`name`, `genre`, `targetLanguage`, `domain`, `modality`, `purpose`, `benchmark`). This flexibility handles:
- Goals created with minimal information
- Goals with full detail
- Legacy goals that may not have all fields

### Large Circular Progress as Hero Element
The main progress circle is 140px with 12px stroke - deliberately large and prominent. This design choice:
- Draws immediate attention to overall progress
- Provides emotional reward (seeing a filling circle)
- Creates visual hierarchy with smaller stats below

### 2x2 Grid for Key Metrics
Four metric cards (streak, due count, accuracy, study time) are arranged in a 2x2 grid. This layout:
- Balances density with readability
- Works well on various screen sizes
- Groups related information visually

### Warning Variant for Bottleneck Alert
When a bottleneck is detected with sufficient confidence, it displays in a warning-styled card. This ensures important improvement areas are not missed while scanning the dashboard.

### Progress Bar Comparison Pattern
The scaffolding gap section shows two progress bars stacked vertically, making the difference between cue-free and cued accuracy immediately visible. Side-by-side numbers would be harder to compare at a glance.

### ComponentBadge for Visual Consistency
Each linguistic component (PHON, MORPH, etc.) is rendered with a `ComponentBadge` that provides consistent coloring and styling across the application. This creates visual vocabulary users learn once and recognize everywhere.

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `../ui` (GlassCard, GlassButton, GlassBadge, CircularProgress, GlassProgress, ComponentBadge) | UI component library for cards, progress indicators, and badges |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Goal detail page | Primary content area showing progress for selected goal |
| Analytics views | May embed dashboard within larger analytics context |

### Data Sources
The component expects data in these shapes:
- `GoalInfo`: Goal identification and configuration
- `ProgressData`: Aggregated statistics about learning progress
- `BottleneckData`: Optional analysis of weakest component

This data typically comes from:
- Goal database queries
- FSRS algorithm outputs
- IRT theta calculations
- Bottleneck detection service

### Data Flow
```
Goal Service + Progress Service + Bottleneck Analyzer
    |
    v
Parent Component (data fetching/aggregation)
    |
    v
ProgressDashboard (presentation)
    |
    +--> onStartSession: Triggers session start flow
```

### Relationship to Chart Components
The ProgressDashboard provides high-level summary metrics. For deeper analysis, users would navigate to views containing:
- `AbilityRadarChart`: Detailed theta visualization by component
- `MasteryPipeline`: Stage-by-stage word distribution
- `FSRSCalendar`: Historical review activity
- `CascadeDiagram`: Processing bottleneck visualization

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain the dashboard's role as the central progress hub and its analytical concepts
- **Impact**: Clarifies how progress data flows and is presented to users
