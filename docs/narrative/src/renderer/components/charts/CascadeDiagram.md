# CascadeDiagram Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/charts/CascadeDiagram.tsx`
> **Status**: Active

---

## Why This Exists

The CascadeDiagram visualizes language processing as a sequential flow: PHON (Phonology) to MORPH (Morphology) to LEX (Lexical) to SYNT (Syntax) to PRAG (Pragmatics). This visualization is grounded in psycholinguistic theory that language comprehension and production flow through these stages in order.

The component exists to answer: **"Where is my language processing breaking down?"** If you can hear words correctly (PHON) but struggle with word endings (MORPH), the bottleneck appears visually in the MORPH stage. This targeted insight is far more actionable than a generic "you got 60% correct."

The philosophical framework (from the source comments) emphasizes:
- **Visual Isomorphism**: The left-to-right flow mirrors linguistic hierarchy
- **Affordance**: Bottleneck points visually appear "blocked"
- **State Projection**: Error rates are reflected as color intensity in real-time
- **Concealment by Design**: Complex error analysis algorithms are hidden behind intuitive flow

**Business Need**: Learners need precise diagnosis of where their language processing fails. Generic practice wastes time; targeted practice at the bottleneck accelerates improvement.

**When Used**:
- Analytics views showing error analysis
- Post-session review showing where mistakes occurred
- Diagnostic screens helping users understand their weaknesses

---

## Key Concepts

### Language Processing Cascade
**Technical**: A sequential model where language input/output flows through five processing stages, each dependent on successful processing at earlier stages.

**Plain English**: Understanding language is like an assembly line. First you hear the sounds (phonology), then you recognize word parts (morphology), then you know what words mean (lexical), then you understand the sentence structure (syntax), then you get the social meaning (pragmatics). If one station breaks down, everything after it suffers.

**Why We Use It**: This model explains why some learners can read but not listen, or understand but not speak. Different skills break down at different points in the cascade.

### Bottleneck Detection
**Technical**: The `isBottleneck` flag in `ComponentData` identifies the stage with highest error rate and sufficient confidence, indicating where processing systematically fails.

**Plain English**: A bottleneck is like a traffic jam on a highway. One slow lane backs up everything behind it. Finding the bottleneck tells you exactly where to focus your effort.

**Why We Use It**: Identifying the primary bottleneck enables efficient, targeted practice rather than generic review of all material.

### Error Rate Visualization
**Technical**: Error rates (0-1) map to color intensity and status labels through `getErrorColor()` and `getStatusLabel()` functions.

| Error Rate | Color | Label |
|------------|-------|-------|
| < 10% | Green (success) | Strong |
| 10-25% | Blue (info) | Good |
| 25-40% | Yellow (warning) | Needs Work |
| > 40% | Red (error) | Weak |

**Plain English**: The worse you perform at a stage, the redder it appears. It is like a health indicator - green is healthy, red needs attention.

**Why We Use It**: Color-coded severity makes scanning for problems instant. Users do not need to read numbers to spot issues.

### Confidence Score
**Technical**: The `confidence` value (0-1) indicates how reliable the error rate measurement is based on sample size and consistency.

**Plain English**: If you have only tried 3 questions, the system is not sure if your error rate is real or just chance. Higher confidence means more data backs up the conclusion.

**Why We Use It**: Prevents premature conclusions from small sample sizes. A 50% error rate on 2 items is noise; on 100 items is a pattern.

---

## Design Decisions

### Two Rendering Modes (Compact and Full)
The `compact` prop switches between:
- **Compact**: A single row of small buttons with icons, suitable for headers or summaries
- **Full**: Large cards with detailed statistics, connectors, and recommendations

This allows the same component to serve overview and detail contexts without code duplication.

### Ordered Component Array
The component explicitly defines processing order: `['phonology', 'morphology', 'lexical', 'syntactic', 'pragmatic']`. This ensures consistent left-to-right rendering regardless of how data arrives.

### Motion Animations with Framer Motion
Interactive elements use `motion.button` with `whileHover` and `whileTap` animations. The connector arrows animate in sequence with staggered delays. This creates:
- Visual feedback for interactivity
- A sense of flow from left to right
- Engaging, modern feel

### Bottleneck Highlighting
When `isBottleneck` is true for a component:
- Border changes to red
- Background uses error-muted color
- AlertTriangle icon appears
- Connector arrow to next stage turns red

This multi-signal approach ensures bottlenecks are unmissable.

### Progress Flow Bar
At the bottom, a stacked horizontal bar shows all components with opacity based on success rate (1 - errorRate). This provides:
- A holistic view of the entire cascade
- Quick visual summary of where processing is weakest
- Secondary confirmation of bottleneck location

### Recommendation Display
When `recommendation` is provided, it appears in an info-styled box at the bottom. This moves from diagnosis ("MORPH is your bottleneck") to action ("Focus on verb conjugation patterns").

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `framer-motion` (motion, AnimatePresence) | Animations for hover, tap, and entrance effects |
| `lucide-react` (Volume2, Puzzle, BookOpen, Link, MessageCircle, AlertTriangle, ChevronRight) | Icons for components, warnings, and connectors |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Analytics views | Shows cascade analysis for a goal or session |
| Session review screens | Displays where errors occurred during practice |
| Diagnostic wizards | Helps users understand their learning profile |

### Data Sources
The `ComponentData` array expects:
```typescript
{
  component: 'phonology' | 'morphology' | 'lexical' | 'syntactic' | 'pragmatic',
  errorRate: number,    // 0-1
  confidence: number,   // 0-1
  itemCount: number,    // how many items analyzed
  isBottleneck?: boolean
}
```

This data comes from error analysis services that categorize mistakes by linguistic component.

### Data Flow
```
Error Analysis Service
    |
    v
Bottleneck Detection Algorithm
    |
    v
Parent Component (combines data + recommendation)
    |
    v
CascadeDiagram (visualization)
    |
    +--> onComponentClick: Drills into specific component
```

### Related Components
- `AbilityRadarChart`: Shows theta (ability) by component
- `ProgressDashboard`: Shows high-level summary with bottleneck alert
- `ComponentBadge`: Shared visual vocabulary for component colors/icons

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain the cascade model and bottleneck visualization
- **Impact**: Clarifies psycholinguistic foundations and diagnostic value
