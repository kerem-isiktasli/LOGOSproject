# QuestionCard Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/session/QuestionCard.tsx`
> **Status**: Active

---

## Why This Exists

The QuestionCard is the primary learning interaction surface in LOGOS. It presents vocabulary, grammar, or other language items to the user and captures their response. This component exists to create a clean, focused testing environment similar to professional language certification tests, where cognitive load is minimized and attention is directed entirely to the learning task.

**Business Need**: Effective language learning requires repeated retrieval practice with immediate feedback. QuestionCard provides the interface for this retrieval practice across multiple question formats.

**User Problem Solved**: Language learners need varied testing modes to build robust knowledge. QuestionCard supports:
- **Recall mode**: See target language, produce meaning/translation
- **Recognition mode**: Select correct answer from options (multiple choice)
- **Typing mode**: Type the exact target language form
- **Listening mode**: Hear audio, transcribe what was heard

**When Used**: QuestionCard appears during active learning sessions (Training Gym). It is typically orchestrated by SessionView, which manages the question queue and progression.

---

## Key Concepts

### The Cue Level System (Progressive Scaffolding)

LOGOS implements a **scaffolding** approach to hints. Rather than giving all information at once or none at all, hints are revealed progressively:

| Cue Level | What's Revealed | Impact on Scoring |
|-----------|-----------------|-------------------|
| 0 | No hints, pure recall | Full credit |
| 1 | Translation/meaning shown | Reduced credit |
| 2 | First letter or partial hint | Further reduced |
| 3 | Maximum hints available | Minimal credit |

This design allows struggling learners to still answer questions (maintaining engagement) while tracking that they needed help (informing the spaced repetition algorithm).

### Mode-Driven Interface

The component adapts its input interface based on `mode`:

- **recall / typing**: Free-text input field appears
- **recognition**: Grid of clickable option buttons appears
- **listening**: Audio player appears, text input for transcription

This polymorphic behavior is controlled by a single `mode` prop rather than separate components, keeping the mental model simple.

### Timer as Optional Pressure

The optional `timeLimit` prop creates time-bounded practice. The timer:
- Counts down from the limit
- Changes color (warning state) in final 10 seconds
- Auto-submits the current answer when time expires

Timed practice is valuable for learners preparing for real exams, but is off by default to avoid anxiety.

---

## Design Decisions

### Centered, Constrained Width

**Decision**: The card is centered with `max-width: 700px`.

**Rationale**: Research on reading comprehension shows 50-75 characters per line is optimal. Constraining width prevents questions from spanning too wide on large monitors, which would impair readability.

### Large Typography for Question Text

**Decision**: Question content uses `var(--text-3xl)` (large) font size.

**Rationale**: The question is the most important element on screen. Large, clear typography ensures it's immediately readable and emphasizes its primacy in the visual hierarchy.

### Auto-Focus Input on Mount

**Decision**: For typing and recall modes, the input field receives focus automatically when the component mounts or when the question changes.

**Rationale**: Reduces friction. Users don't have to click the input field before typing - they can immediately begin answering.

### Keyboard-First Interaction

**Decision**: Enter key submits the answer (for non-recognition modes).

**Rationale**: Power users and touch typists should be able to complete questions rapidly without reaching for the mouse.

### Recognition Options as 2-Column Grid

**Decision**: Multiple choice options display in a 2x2 grid on desktop, 1-column on mobile.

**Rationale**:
- 2-column is efficient use of space
- Letter keys (A, B, C, D) are displayed as badges, matching standardized test conventions
- 1-column on mobile prevents options from being too cramped

---

## Integration Points

### Parent Component

**SessionView** typically orchestrates QuestionCard:
```tsx
<QuestionCard
  item={currentQuestion}
  mode={questionMode}
  options={mcqOptions}
  onSubmit={handleAnswer}
  onRequestHint={getNextHint}
  progress={{ current: 5, total: 20 }}
/>
```

### LearningItem Interface

QuestionCard expects an item conforming to:
```typescript
interface LearningItem {
  id: string;
  content: string;          // The question/prompt text
  type: string;             // Category (vocabulary, grammar, etc.)
  translation?: string;     // Meaning (revealed at cue level 1)
  audioUrl?: string;        // For listening mode
  imageUrl?: string;        // Visual support
  hint?: string;            // Progressive hint content
  difficulty?: number;      // Item difficulty rating
  masteryStage?: 0|1|2|3|4; // User's current mastery
}
```

### UI Component Dependencies

Imports from `../ui`:
- `GlassCard` - The container card
- `GlassButton` - Action buttons (Submit, Skip, Get Hint)
- `GlassInput` - Text input field
- `GlassBadge` - Item type badge
- `MasteryBadge` - Mastery stage indicator
- `ComponentBadge` - Linguistic component indicator

### Callbacks for Parent Control

| Callback | When Called | Expected Behavior |
|----------|-------------|-------------------|
| `onSubmit(answer, cueLevel)` | User clicks Check Answer, presses Enter, or time expires | Parent evaluates answer, shows feedback |
| `onRequestHint()` | User clicks "Get Hint" | Parent returns next hint string, async |

### CSS/Styling Requirements

The component embeds its own styles via `<style>` tag and relies on:
- Glass design system variables
- `@keyframes pulse` for timer warning animation
- `animate-slide-in` class for hint appearance

### Helper Components (Internal)

The file includes several internal helper components:
- `TimerIcon` - SVG clock icon
- `HintIcon` - SVG lightbulb icon
- `AudioPlayer` - Play/pause audio interface
- `formatTime(seconds)` - Converts seconds to MM:SS format

These are not exported; they exist only to support QuestionCard.
