# TimedExercise Component

> **Last Updated**: 2026-01-05
> **Code Location**: `src/renderer/components/session/TimedExercise.tsx`
> **Status**: Active

---

## Context & Purpose

This component implements a **Stage 4 (Automatic) mastery exercise** that introduces time pressure to reinforce automaticity in language recall. It exists because true language fluency requires not just accurate responses but *fast* responses -- the kind of automatic retrieval that characterizes native-like proficiency.

**Business Need**: When learners reach the highest mastery stage (Stage 4), they need exercises that push beyond mere accuracy. The TimedExercise creates controlled pressure that trains the brain to retrieve language patterns without conscious deliberation, simulating real-world conversation demands where hesitation disrupts communication flow.

**When Used**:
- Triggered when a language object reaches Stage 4 mastery (cueFreeAccuracy >= 0.9, stability > 30 days, scaffolding gap < 0.1)
- Used in "Training Gym" sessions for speed drills
- Applied to high-frequency vocabulary and common patterns that should become reflexive

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/renderer/components/ui/GlassCard.tsx`: **GlassCard** - Provides the translucent container with Apple's "Liquid Glass" aesthetic; handles the visual framing with blur effects and depth hierarchy
- `src/renderer/components/ui/GlassButton.tsx`: **GlassButton** - Renders the Submit and Skip action buttons with tactile hover feedback and loading states
- `src/renderer/components/ui/GlassInput.tsx`: **GlassInput** - Provides the styled text input field with focus states; includes built-in accessibility attributes (aria-invalid, aria-describedby)
- `React hooks`: **useState, useEffect, useCallback, useRef** - Core React state management for timer countdown, input handling, and DOM references

### Dependents (What Needs This)

- `src/renderer/components/session/SessionView.tsx`: Currently does **not** directly consume TimedExercise, but the architectural intent is for SessionView to render TimedExercise when `task.masteryStage === 4` and a timed task type is selected
- Future integration point: The `selectTaskTypeForStage()` function in LOGOS's algorithmic foundations maps Stage 4 to `'timed'` task type, indicating TimedExercise should be the renderer

### Data Flow

```
Parent Component
    |
    v
[Props: prompt, expectedAnswer, timeLimitSeconds, onSubmit, onSkip, difficulty]
    |
    v
TimedExercise Component
    |
    +---> [State: response, timeRemaining, isSubmitting, shake]
    |
    +---> [Timer Effect: 100ms intervals, countdown]
    |         |
    |         +---> When timeRemaining <= 0: Auto-submit with timedOut=true
    |         |
    |         +---> When timeRemaining <= 5: Trigger shake animation
    |
    +---> [User Input or Timeout]
    |
    v
onSubmit(response: string, timeUsed: number, timedOut: boolean)
    |
    v
Parent handles correctness evaluation and FSRS scheduling
```

---

## Macroscale: System Integration

### Architectural Layer

This component sits in the **Presentation Layer** (Layer 1) of LOGOS's three-tier architecture:

- **Layer 1: Renderer/UI (This component)** - Handles user interaction, visual feedback, time pressure mechanics
- **Layer 2: IPC Bridge** - Communicates response data to main process
- **Layer 3: Main Process Services** - FSRS scheduling, IRT theta estimation, mastery state updates

Within the session flow, TimedExercise represents the **terminal mastery state** -- the final challenge type before a language object is considered fully automatic:

```
Stage 0 (New)         ->  Introduction task
Stage 1 (Recognition) ->  MCQ with QuestionCard
Stage 2 (Recall)      ->  Fill-in-blank via SessionView
Stage 3 (Production)  ->  Free response via SessionView
Stage 4 (Automatic)   ->  TimedExercise (this component)
```

### Big Picture Impact

TimedExercise is the **graduation ceremony** for vocabulary items. Its successful completion signifies:

1. **Fluency validation** - Items passing timed tests move to long-term maintenance scheduling (30+ day intervals)
2. **Cognitive load reduction** - Automatic retrieval frees working memory for higher-order language processing
3. **Real-world readiness** - Timed success correlates with conversational fluency where response latency matters

**Without this component**, LOGOS would lack the mechanism to:
- Distinguish between slow-accurate and fast-automatic knowledge
- Train genuine automaticity rather than just memorization
- Provide the "speed drill" experience that accelerates fluency development

### Critical Path Analysis

**Importance Level**: High (for Stage 4 learners)

- **If this fails**: Learners plateau at Stage 3; mastery metrics show accuracy but not automaticity; real-world fluency development stalls
- **Failure mode**: Timer malfunction could auto-submit correct answers as timeouts, falsely recording failures
- **Backup**: SessionView can fall back to standard free-response tasks if TimedExercise is unavailable, but loses the automaticity training benefit

---

## Technical Concepts (Plain English)

### Countdown Timer with 100ms Precision

**Technical**: The component uses `setInterval` at 100ms intervals to decrement `timeRemaining` by 0.1 seconds, providing sub-second visual feedback while maintaining reasonable performance.

**Plain English**: Like a sports shot clock that updates every tenth of a second, the timer provides precise countdown feedback. This granularity lets users see exactly how much time remains without overwhelming the browser with too many updates.

**Why We Use It**: Tenth-of-a-second precision creates appropriate urgency without the performance cost of millisecond updates. Users can visually track their remaining time with enough detail to make strategic decisions about when to submit.

### Auto-Submit on Timeout

**Technical**: When `timeRemaining` reaches zero, the `useEffect` hook triggers `handleSubmit(true)`, passing `timedOut: true` to the parent callback. This implements **automatic closure** of the exercise window.

**Plain English**: Like a test proctor collecting your paper when time runs out, the component automatically submits whatever you've typed when the clock hits zero -- even if you haven't pressed Submit.

**Why We Use It**: In real conversations, you don't get infinite time to respond. Auto-submit trains learners to work within time constraints and provides accurate data about what they could produce under pressure.

### Shake Animation for Time Pressure

**Technical**: A CSS keyframe animation (`@keyframes shake`) creates a horizontal oscillation effect when `timeRemaining <= 5`. The `shake` state toggles a CSS class that applies `transform: translateX()` in alternating directions.

**Plain English**: When you have 5 seconds left, the entire card vibrates briefly -- like a smartphone buzzing to get your attention. This physical feedback creates urgency without blocking your view of the content.

**Why We Use It**: Visual urgency cues help learners internalize time pressure without causing panic. The shake is brief (500ms) and subtle (4px movement), signaling "hurry up" without disrupting typing.

### Color-Coded Progress Feedback

**Technical**: The `getTimerColor()` and `getProgressColor()` functions return Tailwind CSS classes (`text-green-400`, `text-yellow-400`, `text-red-400`) based on remaining time percentage thresholds (>60%, >30%, <=30%).

**Plain English**: Like a traffic light, the timer changes from green (plenty of time) to yellow (getting low) to red (urgent). This color progression provides at-a-glance status without requiring the user to read numbers.

**Why We Use It**: Color creates pre-attentive processing -- your brain registers "red = danger" faster than it can read "3 seconds remaining." This supports the automaticity training goal by reducing cognitive load during the exercise.

### Submission Guard (Idempotency)

**Technical**: The `isSubmitting` state flag prevents multiple submissions via the `if (isSubmitting) return` guard in `handleSubmit`. This implements **idempotent submission** (like an elevator button that ignores repeated presses).

**Plain English**: Once you hit Submit, the button stops working until the submission completes. This prevents the panicked double-click from submitting your answer twice.

**Why We Use It**: Without this guard, rapid clicking could cause duplicate submissions, corrupting the learner's response history and confusing the FSRS scheduling algorithm.

### Input Auto-Focus

**Technical**: A `useEffect` hook calls `inputRef.current?.focus()` on component mount, programmatically focusing the input element so users can begin typing immediately.

**Plain English**: When the timed exercise appears, your cursor is already blinking in the answer field -- no need to click. Every millisecond counts when you're racing the clock.

**Why We Use It**: In a timed context, forcing users to click the input field wastes precious seconds and disrupts flow. Auto-focus respects the time pressure context.

---

## Design Decisions & Rationale

### Why 100ms Timer Updates (Not Faster or Slower)?

- **Faster (e.g., 16ms)**: Would provide smoother animation but waste CPU cycles for imperceptible visual difference
- **Slower (e.g., 1000ms)**: Would feel laggy and provide inadequate precision for sub-10-second exercises
- **100ms**: Balances visual smoothness with performance; standard interval for UI timers

### Why Auto-Submit Instead of Just Warning?

The pedagogical model requires **consequential time limits**. A warning-only approach would:
- Allow infinite "just one more second" extensions
- Fail to train genuine speed
- Produce inaccurate timing data

Auto-submit creates the stakes that drive automaticity development.

### Why Shake at 5 Seconds Specifically?

Five seconds represents the **speech turn threshold** in natural conversation. Pauses longer than 5 seconds typically signal confusion or disengagement. Training learners to respond within this window prepares them for conversational pacing.

---

## Props Interface Reference

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | Yes | The question or task instruction displayed to the user |
| `expectedAnswer` | `string` | Yes | The correct answer (used by parent for evaluation) |
| `timeLimitSeconds` | `number` | Yes | How many seconds before auto-submit |
| `onSubmit` | `function` | Yes | Callback receiving (response, timeUsed, timedOut) |
| `onSkip` | `function` | No | Optional callback for skip action |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | No | Affects border color styling (default: 'medium') |
| `showProgress` | `boolean` | No | Whether to show the progress bar (default: true) |

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for TimedExercise component
- **Why**: Documentation specialist triggered after component analysis
- **Impact**: Establishes shadow documentation for session component layer

### [Component Creation Date] - Initial Implementation
- **What Changed**: Created Stage 4 mastery component with countdown timer, auto-submit, and visual urgency cues
- **Why**: LOGOS mastery model requires automaticity testing beyond accuracy-only evaluation
- **Impact**: Enables full 5-stage mastery progression; completes the Training Gym task type library
