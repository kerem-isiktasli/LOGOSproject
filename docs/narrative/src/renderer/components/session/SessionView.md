# SessionView Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/session/SessionView.tsx`
> **Status**: Active

---

## Why This Exists

SessionView is the **orchestration layer** for learning sessions in the Training Gym. While QuestionCard and FeedbackCard handle individual interactions, SessionView manages the entire session lifecycle: presenting tasks, collecting responses, transitioning between question and feedback states, tracking timing, and coordinating with the backend.

**Business Need**: A learning session is more than a sequence of questions - it requires state management, progress tracking, response timing, hint management, and smooth UX transitions. SessionView encapsulates all this complexity so other parts of the application don't need to understand session mechanics.

**User Problem Solved**: Users need a fluid, focused learning experience where:
- Questions appear smoothly
- Hints are available when needed
- Feedback is immediate
- Progress is visible
- They can exit or retry at any time

SessionView provides this unified experience.

**When Used**: SessionView is the main component for any active learning session - new vocabulary introduction, spaced repetition review, or mixed practice.

---

## Key Concepts

### Two-Phase Rendering (Question / Feedback)

SessionView uses a simple state machine with two phases:
1. **Question Phase**: Task is displayed, user inputs answer
2. **Feedback Phase**: Result is displayed with FeedbackCard

The component conditionally renders either the question interface or FeedbackCard based on `phase` state. This creates clean separation between input and feedback.

### Task Format Polymorphism

SessionView adapts to different task formats:

| Format | Interface | Example Use Case |
|--------|-----------|------------------|
| `mcq` | 2x2 button grid | Recognition practice, lower difficulty |
| `fill_blank` | Single input with template | Conjugation practice |
| `free_response` | Open input | Translation, production |
| `typing` | Character-comparison input | Exact form memorization |

The `MCQOptions` and `TypingInput` are internal sub-components that handle specialized rendering.

### Response Time Tracking

SessionView records when each question appears (`questionStartTime`) and calculates duration when the answer is submitted. This timing data:
- Informs the spaced repetition algorithm (fast correct = strong memory)
- Appears in feedback for user awareness
- Contributes to session analytics

### Cue Level Management

The session tracks how many hints the user requested (cue level 0-3). This is:
- Incremented when user clicks "Get Hint"
- Passed to `onSubmit` so backend can adjust scoring
- Reset when moving to next question
- Set to 3 automatically on "Skip"

---

## Design Decisions

### No Internal Question Queue

**Decision**: SessionView receives a single `task` prop rather than managing a queue of tasks.

**Rationale**: The parent component (or custom hook) should manage the task queue and selection algorithm. SessionView focuses solely on presenting the current task. This separation of concerns allows different queue strategies (linear, adaptive, interleaved) without modifying SessionView.

### State Reset on Task Change

**Decision**: `useEffect` resets all interaction state when `task.id` changes.

**Rationale**: Each task is a fresh start. Carrying over state from the previous question (hints, input text, timing) would cause bugs and confusion. The effect ensures clean slate on every new task.

### Direct MCQ Submission

**Decision**: Clicking an MCQ option immediately submits the answer (no separate "Submit" button).

**Rationale**:
- Reduces clicks for the most common question type
- Matches user expectations from language learning apps like Duolingo
- Number keys (1-4) also trigger immediate submission for power users

### Keyboard Navigation Throughout

**Decision**: Extensive keyboard shortcut support:
- `Enter` submits typed answers
- `1-4` keys select MCQ options
- `Enter/Space` continues from feedback

**Rationale**: Power users and accessibility. Learning sessions can involve hundreds of interactions; keyboard support significantly improves efficiency.

### Typing Input with Real-Time Comparison

**Decision**: The `TypingInput` sub-component shows character-by-character comparison (green for correct, red for incorrect) as the user types.

**Rationale**: Provides immediate micro-feedback during typing, helping users catch and understand errors in real-time rather than only after submission. This is especially valuable for languages with unfamiliar characters.

---

## Integration Points

### Parent Component

A page or container provides the session context:
```tsx
<SessionView
  task={currentTask}
  taskIndex={taskIndex}
  totalTasks={totalTasks}
  onSubmit={handleSubmit}
  onNext={loadNextTask}
  onGetHint={fetchHint}
  onExit={endSession}
/>
```

### SessionTask Interface

Each task must conform to:
```typescript
interface SessionTask {
  id: string;
  objectId: string;         // Reference to learning object
  content: string;          // Display content
  type: string;             // Category (vocabulary, grammar)
  format: TaskFormat;       // mcq, fill_blank, free_response, typing
  prompt: string;           // Instruction text
  expectedAnswer: string;   // Correct answer for validation
  options?: string[];       // MCQ options
  blankTemplate?: string;   // For fill_blank format
  hints?: string[];         // Pre-loaded hints
  masteryStage: 0|1|2|3|4;  // Current user mastery
  difficulty: number;       // Item difficulty
}
```

### Callbacks to Parent

| Callback | Signature | Purpose |
|----------|-----------|---------|
| `onSubmit` | `(answer, cueLevel, responseTimeMs) => Promise<{correct, errorAnalysis?}>` | Submit answer for evaluation |
| `onNext` | `() => void` | Request next task |
| `onGetHint` | `(level) => Promise<string>` | Fetch hint at specified level |
| `onExit` | `() => void` | User wants to leave session |

### Internal Components

**MCQOptions**: Renders the multiple-choice grid
- Manages selection state
- Handles keyboard shortcuts
- Applies visual feedback for selected option

**TypingInput**: Specialized input for typing tasks
- Character-by-character comparison display
- Progress indicator (X of Y characters)
- Accuracy percentage calculation

### Child Component Used

**FeedbackCard**: Rendered during feedback phase with:
```tsx
<FeedbackCard
  feedback={{ correct, userAnswer, correctAnswer, errorAnalysis, responseTimeMs }}
  questionContent={task.content}
  onContinue={handleContinue}
  onRetry={!correct ? handleRetry : undefined}
  autoAdvance={correct}
/>
```

### UI Component Dependencies

Imports from `../ui`:
- `GlassCard` - Task container
- `GlassButton` - Action buttons
- `GlassInput` - Text input
- `GlassTextarea` - (imported but not currently used)
- `GlassBadge` - Type indicator
- `MasteryBadge` - Mastery stage indicator

### Legacy Exports

The file exports several interfaces for backward compatibility:
- `SessionConfig` - Session configuration options
- `SessionItem` - Older item format
- `SessionState` - Full session state shape
- `SessionStats` - Session summary statistics

These may be used by session management hooks or analytics.

### CSS Requirements

Relies on:
- Tailwind utility classes
- Glass design system variables
- Animation keyframes for transitions
- Dark mode variants
