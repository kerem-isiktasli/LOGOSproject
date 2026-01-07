# FeedbackCard Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/session/FeedbackCard.tsx`
> **Status**: Active

---

## Why This Exists

The FeedbackCard appears immediately after a user answers a question, providing the crucial **feedback loop** that makes learning effective. Without immediate feedback, learners cannot correct misconceptions, and spaced repetition algorithms cannot adjust scheduling. This component exists to close that loop with rich, educational feedback.

**Business Need**: Effective language learning requires not just knowing right/wrong, but understanding *why* an answer was wrong and *how* to improve. FeedbackCard provides error analysis that transforms mistakes into learning opportunities.

**User Problem Solved**: Learners often repeat the same mistakes without understanding why. By showing:
- What they answered vs. the correct answer
- Which linguistic component they struggled with (phonology, morphology, syntax, etc.)
- Specific explanations and tips
- Similar error patterns to watch for

The FeedbackCard turns each mistake into a mini-lesson.

**When Used**: FeedbackCard appears after each question in a learning session, replacing QuestionCard. It stays visible until the user clicks Continue (or auto-advances after a delay).

---

## Key Concepts

### Educational Error Analysis

When an answer is incorrect, the component displays an **analysis section** that can include:

| Field | Purpose |
|-------|---------|
| `errorType` | Category of mistake (e.g., "Conjugation Error", "Tonal Mistake") |
| `component` | Linguistic component: PHON (phonology), MORPH (morphology), LEX (lexical), SYNT (syntax), PRAG (pragmatics) |
| `explanation` | Plain-language explanation of what went wrong |
| `correction` | Actionable tip for next time |
| `similarErrors` | Other patterns the user should watch for |

This structured error analysis comes from the backend evaluation system and helps users build metalinguistic awareness.

### Mastery Progression Visualization

When mastery data is available, the card shows:
- A progress indicator showing the new mastery stage (0-4)
- A "Level Up!" badge if the stage increased
- Next review date (when this item will appear again)

This provides extrinsic motivation by making learning progress visible and concrete.

### Auto-Advance for Flow

For correct answers, the card can automatically advance to the next question after a delay. This maintains **learning flow** - users who are doing well don't need to click Continue every time.

For incorrect answers, auto-advance uses a longer delay (2x) to give users time to read the error analysis. Users can still manually advance immediately if they're ready.

---

## Design Decisions

### Slide-In Animation

**Decision**: The card animates in with a slide-down effect (`translateY(-10px)` to `0`).

**Rationale**: Provides visual feedback that the view has changed from question to feedback. The motion draws attention without being jarring.

### Color Coding for Correctness

**Decision**: Correct answers show green icon/text, incorrect show red icon/text.

**Rationale**: Universal color conventions. Green = good, red = needs attention. These colors are used consistently throughout learning applications.

**Accessibility Note**: Text labels ("Correct!" / "Not quite right") ensure meaning isn't conveyed by color alone.

### Keyboard Shortcuts for Quick Progression

**Decision**: Enter or Space advances to the next question.

**Rationale**: After reading feedback, users should be able to continue without reaching for the mouse. This is especially important during rapid-fire review sessions.

**Implementation Note**: The component adds a window-level keydown listener and cleans it up on unmount.

### Countdown Timer Visibility

**Decision**: When auto-advance is enabled, the Continue button shows a countdown (e.g., "Continue (3)").

**Rationale**: Users should never be surprised by auto-navigation. Showing the countdown sets expectations and allows users to click early if desired.

### Error Analysis in Blue (Not Red)

**Decision**: The error analysis section uses blue background, not red.

**Rationale**: While the result is "incorrect" (red), the analysis is **educational** content that should feel helpful, not punitive. Blue creates a calmer, more studious tone for the explanation section.

---

## Integration Points

### Parent Component

**SessionView** typically manages the question/feedback flow:
```tsx
{showFeedback ? (
  <FeedbackCard
    feedback={feedbackData}
    questionContent={currentQuestion.content}
    onContinue={goToNextQuestion}
    onRetry={retryCurrentQuestion}
    autoAdvance={feedbackData.correct}
  />
) : (
  <QuestionCard ... />
)}
```

### FeedbackData Interface

The component expects feedback structured as:
```typescript
interface FeedbackData {
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  errorAnalysis?: {
    errorType?: string;
    component?: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG';
    explanation?: string;
    correction?: string;
    similarErrors?: string[];
  } | null;
  mastery?: {
    previousStage: 0 | 1 | 2 | 3 | 4;
    newStage: 0 | 1 | 2 | 3 | 4;
    stability: number;
    nextReview: Date | null;
  };
  responseTimeMs?: number;
  pointsEarned?: number;
}
```

### UI Component Dependencies

Imports from `../ui`:
- `GlassCard` - The container
- `GlassButton` - Continue, Retry, Report buttons
- `GlassBadge` - "Level Up!" indicator
- `ComponentBadge` - Shows PHON/MORPH/LEX/SYNT/PRAG
- `MasteryProgress` - Stage visualization bar

### Callbacks for Parent Control

| Callback | When Called | Expected Behavior |
|----------|-------------|-------------------|
| `onContinue()` | User clicks Continue, presses Enter/Space, or auto-advance triggers | Parent loads next question |
| `onRetry()` | User clicks "Try Again" (only shown for incorrect) | Parent reloads same question |
| `onReport()` | User clicks "Report Issue" | Parent opens issue reporting modal |

### Helper Functions (Internal)

- `formatNextReview(date)` - Converts future date to human-readable string:
  - "in 5 hours", "tomorrow", "in 3 days", or full date for distant futures

### Helper Components (Internal)

- `CorrectIcon` - Green checkmark SVG
- `IncorrectIcon` - Red X SVG

### CSS Requirements

Relies on:
- Tailwind-style utility classes (flex, items-center, gap-*, mb-*, etc.)
- Glass design system variables
- Dark mode variants (`dark:bg-*`, `dark:text-*`)
