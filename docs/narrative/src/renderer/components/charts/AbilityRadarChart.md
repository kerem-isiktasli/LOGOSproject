# AbilityRadarChart Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/charts/AbilityRadarChart.tsx`
> **Status**: Active

---

## Why This Exists

The AbilityRadarChart visualizes language proficiency across five linguistic dimensions using a radar (spider) chart. This component exists because **language ability is not a single number** - it is a profile of strengths and weaknesses across interconnected skills.

The philosophical framework (noted in Korean in the source comments) emphasizes:
- **Visual Isomorphism**: The 5-axis radar chart mirrors the 5-component linguistic hierarchy
- **State Projection**: Changes in theta values animate as area changes in real-time
- **Concealment by Design**: Complex IRT mathematics are hidden behind an intuitive "ability profile" abstraction

**Business Need**: Learners need to understand their ability profile to make informed decisions about what to practice. A simple "you are at level B1" hides the fact that someone might be B2 in reading but A2 in speaking.

**When Used**:
- Deep analytics views for goal progress
- Session review screens showing ability changes
- Comparative analysis between current and previous states

---

## Key Concepts

### IRT Theta Values
**Technical**: Item Response Theory (IRT) estimates learner ability as theta values, typically ranging from -3 to +3, where 0 represents average ability relative to calibrated item difficulties.

**Plain English**: Theta is like a standardized test score where 0 is average, positive numbers mean you are better than average, and negative numbers mean you are still building skills.

**Why We Use It**: Theta provides statistically rigorous ability estimates that account for item difficulty and response patterns, unlike simple percentage scores.

### The Five Linguistic Components
**Technical**: The chart maps five theta values corresponding to distinct linguistic subsystems.

| Component | What It Measures |
|-----------|-----------------|
| Phonology (PHON) | Sound recognition and pronunciation |
| Morphology (MORPH) | Word formation rules and affixes |
| Lexical (LEX) | Vocabulary breadth and depth |
| Syntactic (SYNT) | Grammar and sentence structure |
| Pragmatic (PRAG) | Contextual and social language use |

**Plain English**: Think of these as five different "muscles" for language. Some people have strong vocabulary but weak grammar; others speak correctly but lack social fluency.

**Why We Use It**: Separating these components enables targeted practice where each learner can focus on their specific weaknesses.

### Theta-to-Percent Conversion
**Technical**: `thetaToPercent(theta) = ((theta + 3) / 6) * 100` - normalizes theta from [-3, +3] to [0, 100] for radar chart display.

**Plain English**: The chart needs values between 0 and 100 to draw properly. This formula converts the statistical theta scale into a percentage scale while preserving the relative positions.

**Why We Use It**: Recharts (the charting library) expects 0-100 values. Users also find percentages more intuitive than raw theta values.

### CEFR Level Mapping
**Technical**: `thetaToCEFR(theta)` maps theta ranges to Common European Framework of Reference levels (A1-C2).

**Plain English**: CEFR levels are the international standard for describing language proficiency. A1/A2 are beginner, B1/B2 are intermediate, C1/C2 are advanced. This translation helps users understand where they stand.

**Why We Use It**: While theta is mathematically precise, CEFR levels are meaningful to learners, employers, and institutions.

---

## Design Decisions

### Recharts Library Usage
The component uses Recharts (RadarChart, PolarGrid, etc.) rather than custom SVG or D3. This decision:
- Provides well-tested, accessible chart components
- Handles responsive sizing via ResponsiveContainer
- Reduces custom code and potential bugs

### Previous Data Overlay
When `previousData` is provided, the chart renders two radar areas: a muted background showing previous state and a brighter foreground showing current state. This enables:
- Visual diff between sessions
- Immediate recognition of improvement areas
- Emotional reward when seeing the area expand

### Size Configuration Object
Rather than accepting arbitrary dimensions, the component offers three preset sizes (sm, md, lg). This:
- Ensures consistent sizing across the application
- Simplifies the API (pick a size, do not calculate pixels)
- Maintains proper proportions for labels and stroke widths

### Custom Tooltip Component
The `CustomTooltip` renders component icon, label, raw theta value, and CEFR level on hover. This provides full information on demand without cluttering the always-visible chart.

### Component Detail Grid
Below the radar chart, a 5-column grid shows each component with:
- Colored icon
- Numeric theta value
- Change indicator (+/- from previous)

This redundancy ensures users can get precise values without hovering while also seeing the holistic picture in the chart.

### Color Coding by Component
Each linguistic component has a distinct color (cyan, purple, amber, red, green) defined in `componentLabels`. This consistent color vocabulary appears across:
- Radar chart
- Bottom detail grid
- Related components (CascadeDiagram, ProgressDashboard)

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `recharts` (RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip) | Core charting library |
| `lucide-react` (Volume2, Puzzle, BookOpen, Link, MessageCircle) | Icons for each linguistic component |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Analytics/Deep progress views | Shows detailed ability profile |
| Session summary screens | Displays ability changes from study session |
| Goal comparison views | May show multiple goals' ability profiles |

### Data Sources
The `AbilityData` interface expects theta values for each component:
```typescript
{
  phonology: number,   // theta for PHON
  morphology: number,  // theta for MORPH
  lexical: number,     // theta for LEX
  syntactic: number,   // theta for SYNT
  pragmatic: number    // theta for PRAG
}
```

This data comes from the IRT calculation service that processes response history.

### Data Flow
```
IRT Calculation Service
    |
    v
Parent Component (fetches current + previous theta)
    |
    v
AbilityRadarChart (visualization)
    |
    +--> Tooltip interactions (on hover)
```

### Related Charts
This chart shows ability levels. Related visualizations include:
- `MasteryPipeline`: Shows word counts by mastery stage
- `CascadeDiagram`: Shows error rates by component
- `FSRSCalendar`: Shows study activity over time

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain IRT theta visualization and the five-component linguistic model
- **Impact**: Provides conceptual grounding for understanding ability profiling
