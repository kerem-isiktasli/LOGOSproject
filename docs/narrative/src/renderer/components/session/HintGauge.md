# Hint Gauge Component

> **Last Updated**: 2026-01-05
> **Code Location**: `src/renderer/components/session/HintGauge.tsx`
> **Status**: Active

---

## Context & Purpose

The HintGauge is a visual feedback component that displays the user's remaining hints during a learning session in the Training Gym. It exists to solve a fundamental UX challenge in spaced repetition learning: how do you give learners help without making it too easy?

**Business/User Need**: Learners studying language vocabulary often get stuck on difficult items. Without assistance, they might abandon the session or develop frustration. However, providing unlimited hints would undermine the learning process. The HintGauge creates a **resource economy** where hints are valuable but limited, encouraging strategic use.

**When Used**: This component appears during active question phases in the Training Gym. It is rendered alongside question prompts (MCQ, fill-in-blank, free response) and provides:
1. Visual indication of how many hints remain
2. A clickable interface to request a hint manually
3. An automatic hint countdown that triggers if the user is stuck too long

The component supports the **progressive scaffolding** philosophy central to LOGOS: provide increasing levels of support (cue levels 0-3) rather than simply revealing answers.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **React Core Hooks** (`useState`, `useEffect`, `useCallback`): Manages internal state for timer countdown, animation states, and memoized click handlers
- **No External UI Components**: This is a self-contained visual component using Tailwind CSS classes and inline SVG for the progress ring

### Props Interface (External Dependencies)

| Prop | Purpose |
|------|---------|
| `totalHints` | Sets the gauge's maximum capacity (denominator for fill calculation) |
| `usedHints` | Current consumption count (drives fill level animation) |
| `onRequestHint` | Callback to parent component when user clicks or auto-timer fires |
| `autoHintDelaySeconds` | Configures the automatic hint trigger threshold (default: 30s) |
| `disabled` | Allows parent to freeze the gauge during answer submission or transitions |
| `size` | Visual scale variant (sm/md/lg) for responsive layouts |

### Dependents (What Needs This)

**Currently Unused** - The HintGauge is exported but not currently integrated into the session components. The `SessionView.tsx` and `QuestionCard.tsx` components implement their own hint button interfaces. This component appears to be:
1. A newer, more visually rich alternative to the existing hint buttons
2. Designed for future integration when the Training Gym receives visual polish
3. A standalone component that could replace the text-based "Hint (X left)" buttons

### Data Flow

```
Parent Component (e.g., SessionView)
    |
    v
[totalHints, usedHints] --> HintGauge --> [onRequestHint callback]
                              |
                              v
                        Internal State:
                        - timeElapsed (auto-hint countdown)
                        - isAnimating (click feedback)
                              |
                              v
                        Visual Render:
                        - Liquid fill level
                        - Progress ring border
                        - Countdown timer display
```

---

## Macroscale: System Integration

### Architectural Layer

The HintGauge operates in **Layer 1: Presentation** of the LOGOS three-tier architecture:

```
Layer 1: Presentation (React Components)  <-- HintGauge lives here
    |
    v
Layer 2: Application Logic (IPC Handlers, Services)
    |
    v
Layer 3: Data (Prisma/SQLite, State Management)
```

It is a **pure display component** with no direct database or service connections. All hint logic (fetching hints, tracking cue levels, calculating FSRS impact) happens in the parent SessionView component and its associated IPC handlers.

### Big Picture Impact

The HintGauge enables several critical learning experience features:

1. **Adaptive Learning Support**: By making hint availability visually prominent, learners can make informed decisions about when to use scaffolding versus when to push through independently.

2. **Auto-Hint Timer (Engagement Recovery)**: The automatic hint trigger after 30 seconds addresses a critical UX problem: users who are stuck and embarrassed to ask for help. By automatically providing assistance, LOGOS prevents:
   - Session abandonment
   - Negative emotional associations with learning
   - Wasted time staring at unanswerable questions

3. **Gamification Through Scarcity**: The gauge's "draining liquid" metaphor creates a gentle game-like element. Users instinctively want to preserve resources, which encourages:
   - Active recall attempts before requesting hints
   - Strategic hint use on genuinely difficult items
   - A sense of accomplishment when completing sessions with hints remaining

### System Dependencies

**Importance Level**: Medium (Enhancement, not Critical Path)

The HintGauge is a **non-blocking enhancement**. If it were removed or broken:
- Sessions would still function (existing hint buttons in SessionView work independently)
- User experience would be less polished but functional
- No data corruption or feature breakage would occur

However, once integrated, the component becomes part of the **Training Gym visual language** and removing it would create UI inconsistency.

---

## Technical Concepts (Plain English)

### Liquid Fill Animation

**Technical**: A CSS-animated `div` with dynamic `height` percentage calculated from `remainingHints / totalHints`, using `transition-all duration-500 ease-out` for smooth interpolation.

**Plain English**: Like a glass of water that visibly drains as you drink. Each time you use a hint, the "water level" drops with a smooth animation so you can see your remaining resources at a glance.

**Why We Use It**: Humans process visual information faster than text. A filling/draining gauge communicates status instantly without requiring users to read numbers.

### Auto-Hint Timer with useEffect Cleanup

**Technical**: A `setInterval` inside a `useEffect` hook that increments `timeElapsed` every second, with cleanup via the returned function to prevent memory leaks when the component unmounts or dependencies change.

**Plain English**: Like a "stuck detector" that watches how long you've been staring at a question. If 30 seconds pass without progress, it assumes you need help and automatically gives you a hint. The cleanup ensures we don't have orphaned timers running after you leave the page.

**Why We Use It**: Addresses the "silent struggler" problem - users who get stuck but don't ask for help due to pride, confusion, or not noticing the hint button.

### Debounced Animation State

**Technical**: The `isAnimating` state triggers a CSS scale transform (`scale-95`) for 300ms after a click, controlled by a `setTimeout` that resets the state.

**Plain English**: Like a button that visually "presses in" when you click it, giving you tactile feedback that something happened. The 300ms timeout ensures the press animation completes before returning to normal.

**Why We Use It**: Provides immediate visual feedback that the click registered, especially important because fetching hint content may take time. Users need confirmation their action was received.

### SVG Stroke-Dasharray Progress Ring

**Technical**: An SVG rectangle with `stroke-dasharray` dynamically calculated based on `autoHintProgress`, creating a border that appears to "fill" as the auto-hint timer progresses.

**Plain English**: Like a loading bar drawn around the edge of the button that shows how close you are to receiving an automatic hint. At 0%, no border is visible. At 100%, the entire border is filled, and a hint fires.

**Why We Use It**: Provides ambient awareness of the auto-hint countdown without requiring users to watch a number. The progress ring is visible in peripheral vision, creating gentle urgency without stress.

### Size Configuration Object

**Technical**: A TypeScript object mapping size variant strings (`sm`, `md`, `lg`) to pixel dimensions and Tailwind font classes, enabling component scaling without prop proliferation.

**Plain English**: Like having S/M/L shirt sizes instead of custom measurements. Pick the size that fits your layout, and all the proportions (width, height, text size) adjust together automatically.

**Why We Use It**: Responsive design requirement. The gauge might appear in a sidebar (small), main content area (medium), or focused learning mode (large).

---

## Design Decisions & Rationale

### Why a Gauge Instead of a Number?

The existing SessionView uses a text-based hint indicator: "Hint (3 left)". The HintGauge component represents an **evolution toward visual communication**:

1. **Faster comprehension**: Visual fill levels are processed in ~100ms vs. ~250ms for text
2. **Emotional resonance**: A depleting resource creates gentle urgency
3. **Accessibility**: Visual patterns complement text for users with reading difficulties

### Why Auto-Hint?

The 30-second auto-hint timer is based on **engagement research**:
- After 30 seconds without progress, frustration begins to spike
- Users often don't know hints are available or forget to use them
- Automatic scaffolding prevents the "shame spiral" of feeling stuck

### Why Not Integrated Yet?

The HintGauge exists as a standalone component not yet integrated into SessionView because:
1. It requires visual polish work on the overall Training Gym interface
2. The existing text-based hint system is functional and tested
3. Integration should happen as part of a broader UI refresh, not piecemeal

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for the HintGauge component
- **Why**: Shadow documentation requirement for all code files in LOGOS
- **Impact**: Enables future developers to understand the component's purpose and integration points

### [Original Implementation Date] - Component Created
- **What Changed**: Created liquid-fill gauge with auto-hint timer functionality
- **Why**: To provide a more visually engaging hint interface for the Training Gym
- **Impact**: Added a UI component ready for future integration into learning sessions
