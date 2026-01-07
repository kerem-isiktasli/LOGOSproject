# SessionPage

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/pages/SessionPage.tsx`
> **Status**: Active

---

## Why This Exists

The SessionPage is the **Training Gym** of LOGOS - where actual learning happens. While the Dashboard shows progress and the GoalsPage sets direction, this page is where users engage with vocabulary through active recall, retrieval practice, and spaced repetition.

Language acquisition requires active engagement, not passive exposure. Research consistently shows that testing yourself (even unsuccessfully) produces stronger memory traces than re-reading. The SessionPage operationalizes this principle by presenting learners with tasks that require them to actively retrieve and produce language.

This page exists because:
1. **Active recall is essential**: Users must attempt to remember, not just recognize
2. **Spaced repetition requires timing**: Items appear at optimal intervals based on forgetting curves
3. **Error analysis improves learning**: Understanding WHY you got something wrong accelerates mastery
4. **Progress feedback motivates**: Seeing correct/incorrect counts and accuracy drives continued practice

Without this page, LOGOS would be a passive vocabulary list viewer rather than an active learning system.

---

## Key Concepts

### Multi-Component Object Types

LOGOS doesn't just teach vocabulary (LEX). It teaches five linguistic components:

| Type | Name | What It Targets |
|------|------|-----------------|
| LEX | Lexical | Word meanings and usage |
| MORPH | Morphology | Word formation (prefixes, roots, suffixes) |
| G2P | Grapheme-to-Phoneme | Spelling-sound relationships, pronunciation |
| SYNT | Syntactic | Sentence structure and grammar patterns |
| PRAG | Pragmatic | Register, formality, contextual appropriateness |

Each type generates different task formats appropriate to that skill. A morphology item might ask "What is the root of 'unhappiness'?" while a pragmatic item asks "In what context would you use this phrase?"

### Task Formats

Tasks adapt based on object type AND mastery stage:

| Format | Description | When Used |
|--------|-------------|-----------|
| `mcq` | Multiple choice | Early mastery (stage 0-1), all types |
| `fill_blank` | Complete the word | Mid mastery (stage 2), LEX items |
| `free_response` | Type the answer | High mastery (stage 3-4), LEX items |
| `morpheme_analysis` | Break down word parts | Higher mastery, MORPH items |
| `pronunciation` | Identify sound patterns | Higher mastery, G2P items |
| `sentence_completion` | Fill grammar gaps | Higher mastery, SYNT items |
| `register_selection` | Choose formality level | Higher mastery, PRAG items |

This progression from recognition (MCQ) to production (free response) follows the acquisition hierarchy: recognition precedes recall precedes production.

### Session Lifecycle

A session flows through four phases:

1. **idle**: Pre-session screen showing queue summary and "Start Training" button
2. **starting**: Brief transition while IPC creates session record
3. **active**: User works through tasks, responses recorded
4. **complete**: Summary screen with accuracy, timing, and "Train Again" option

The session state machine prevents invalid transitions and ensures data integrity.

### Cue Levels (Scaffolding)

Users can request hints at three levels:

| Level | Cue Type | Example |
|-------|----------|---------|
| 0 | No cue | (pure recall) |
| 1 | Light hint | "This is a LEX. It starts with 'c'." |
| 2 | Medium hint | "The word has 7 characters." |
| 3 | Strong hint | "The answer is: 'cat...'" |

Responses with cues (level > 0) count separately for "cue-free accuracy" - the truest measure of mastery. A user might achieve 90% accuracy overall but only 60% cue-free, indicating over-reliance on scaffolding.

### Error Analysis

When a user answers incorrectly, the system analyzes the error via `analyzeError()`. This might identify:
- Phonological confusion (similar-sounding words)
- Morphological errors (wrong suffix)
- Semantic proximity (related but not identical meaning)

This analysis feeds back into the learning algorithm and may trigger targeted remediation.

---

## Design Decisions

### Server-First Task Generation with Local Fallback

Tasks are preferably generated server-side (`item.task`) where the main process has full context about the learner and content. However, the page includes extensive local task generation as a fallback:

```typescript
if (item.task) {
  // Use server-generated task
} else {
  // Fallback: generate task locally based on object type
}
```

This ensures the UI never breaks if the server task generation fails or hasn't been implemented for a particular object type.

### Real-Time Timer

A session timer updates every second (`setInterval` with 1000ms) during active phase. This creates urgency and provides data for average response time calculations. The timer uses elapsed time (`Date.now() - sessionStartTime`) rather than incremental counting to prevent drift.

### Distractor Generation Strategies

For MCQ tasks, distractors (wrong options) must be plausible but incorrect. Different strategies apply per component type:

- **LEX**: Other words from the same queue (familiar but distinct)
- **MORPH**: Modified versions of the root (adding/removing affixes)
- **G2P**: Letters that aren't silent (for "which letters are silent" questions)
- **SYNT**: Related but incorrect grammatical structures
- **PRAG**: Contexts with different formality levels

All options get shuffled to prevent pattern-based guessing.

### Session Summary as Separate Component

`SessionSummaryView` is extracted as a separate component within the file rather than inline JSX. This improves readability and enables future extraction to a separate file if the summary grows more complex.

### Grade System

Accuracy maps to encouraging grades:

| Accuracy | Label | Emoji | Color Variant |
|----------|-------|-------|---------------|
| >= 90% | Excellent! | star | success |
| >= 75% | Great! | party | primary |
| >= 60% | Good | thumbs up | warning |
| < 60% | Keep practicing | flexed arm | danger |

This gamification element provides emotional feedback beyond raw numbers.

### IPC Session Recording

Each response is recorded via IPC immediately:

```typescript
await logos?.session.recordResponse({
  sessionId,
  objectId,
  correct,
  cueLevel,
  responseTimeMs,
  taskType,
  taskFormat,
  modality,
  responseContent,
  expectedContent,
});
```

This ensures data persistence even if the user abandons the session unexpectedly. The session can be reconstructed from individual response records.

---

## Integration Points

### Dependencies (What This Needs)

| Module | Import | Purpose |
|--------|--------|---------|
| `../context` | `useApp` | Access `activeGoal`, `activeGoalId` |
| `../hooks` | `useQueue` | Fetch items due for review (session size: 20) |
| `../hooks` | `useStartSession` | Create session record via IPC |
| `../hooks` | `useEndSession` | Close session record via IPC |
| `../hooks` | `useAnalyzeError` | Get AI error analysis for incorrect responses |
| `../hooks` | `useGetHint` | Request progressive hints |
| `../components/session` | `SessionView` | Task presentation and response capture |
| `../components/ui` | `GlassCard`, `GlassButton`, `GlassProgress`, `CircularProgress` | Design system |
| `window.logos` | IPC bridge | Direct IPC access for response recording |

### IPC Channels

| Channel | Purpose |
|---------|---------|
| `window.logos.session.start(goalId, type)` | Create session, returns sessionId |
| `window.logos.session.recordResponse(data)` | Persist individual response |
| `window.logos.session.end(sessionId)` | Close session, trigger mastery updates |
| `window.logos.learning.getQueue(goalId, size)` | Fetch due items with priority ordering |
| `window.logos.claude.analyzeError(objectId, response, expected)` | AI error analysis |
| `window.logos.learning.getHint(objectId, level, existingHints)` | Progressive hint generation |

### Dependents (What Needs This)

- **DashboardPage**: "Practice" quick action navigates here
- **App Router**: Route typically at `/session` or `/training`
- **Navigation Component**: May provide direct access to training

### Props Interface

```typescript
interface SessionPageProps {
  onNavigateBack?: () => void;  // Return to Dashboard after session
}
```

### Data Flow

```
Component mounts
       |
       v
useQueue(activeGoalId, { sessionSize: 20 }) --> IPC --> queue items
       |
       v
[idle phase] User sees queue summary, clicks "Start Training"
       |
       v
handleStartSession() --> startSessionApi({ goalId, type: 'mixed' }) --> sessionId
       |
       v
transformQueueToTasks(queue) --> tasks[] with format, prompt, expectedAnswer
       |
       v
[active phase] Render SessionView with currentTask
       |
       v
User submits response --> handleSubmitResponse(answer, cueLevel, responseTimeMs)
       |
       v
Check correctness --> recordResponse via IPC --> analyzeError if wrong
       |
       v
Store response in local state --> handleNextTask()
       |
       v
[if more tasks] Increment currentTaskIndex, loop
       |
       v
[if last task] handleCompleteSession() --> calculate summary --> endSessionApi()
       |
       v
[complete phase] Render SessionSummaryView with accuracy, timing, itemsReviewed
```

### Helper Functions (Internal)

| Function | Purpose |
|----------|---------|
| `generateDistractors` | Create MCQ wrong options from queue |
| `shuffleArray` | Fisher-Yates shuffle for option randomization |
| `createBlankTemplate` | Generate "c____t" from "cat" for fill-blank |
| `createPrompt` | Generate task instruction text |
| `generateLocalHint` | Fallback hint when IPC fails |
| `formatDuration` | Convert ms to "M:SS" format |
| `getGrade` | Map accuracy to label/emoji/variant |
| `createMorphPrompt`, `createG2PPrompt`, etc. | Component-specific prompt generators |
| `generateMorphDistractors`, `generateG2PDistractors`, etc. | Component-specific distractor generators |

### Academic References (Embedded in Code)

The multi-component task generation references linguistic research:
- **Bauer & Nation (1993)**: Affix productivity levels for morphology
- **Venezky (1970)**: Spelling-sound correspondence for G2P
- **Lu L2SCA (2010)**: Syntactic complexity measures
- **Taguchi (2015)**: Pragmatic competence assessment
- **Biber (1988)**: Register analysis

These citations in the code comments indicate the theoretical grounding for task generation strategies.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial shadow documentation for SessionPage
- **Why**: Fulfill documentation-specialist requirements for narrative explanation
- **Impact**: Future developers understand the Training Gym architecture, task generation, and session lifecycle

### Multi-Component Extension
- **What Changed**: Extended task generation to support MORPH, G2P, SYNT, PRAG beyond original LEX-only
- **Why**: Language learning requires more than vocabulary - morphology, pronunciation, grammar, and pragmatics are equally important
- **Impact**: Enables comprehensive linguistic competence training

### Initial Implementation
- **What Changed**: Created session management with queue-based task presentation, response recording, and summary generation
- **Why**: Users need active recall practice with immediate feedback
- **Impact**: Enables the core learning loop of LOGOS
