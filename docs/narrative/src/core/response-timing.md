# Response Timing Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/response-timing.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to transform raw response times into meaningful learning signals. When a user answers a vocabulary question, the time they take to respond reveals crucial information about their cognitive processing that goes far beyond simple correctness.

**Business/User Need**: Language learning applications typically only track whether an answer is right or wrong. But a correct answer that takes 10 seconds indicates very different knowledge than one that takes 800 milliseconds. LOGOS needs to distinguish between:
- **Automatic knowledge**: Fast, fluent responses that indicate deep learning
- **Effortful retrieval**: Slow but correct responses that suggest fragile memory traces
- **Lucky guesses**: Suspiciously fast responses on multiple-choice questions
- **Gaming behavior**: Robotic patterns that suggest the user is trying to cheat the system

The response timing module bridges the gap between raw millisecond measurements and pedagogically meaningful classifications that drive the spaced repetition algorithm (FSRS).

**When Used**: Every time a user completes a learning task. The response time is captured, analyzed against research-backed thresholds, and converted into an FSRS rating that influences when the item will be reviewed next.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/core/types.ts`: Imports fundamental type definitions
  - `TaskFormat`: The presentation format of tasks (mcq, fill_blank, free_response, matching, ordering, dictation)
  - `TaskType`: The cognitive type of task (recognition, recall, production, timed)
  - `MasteryStage`: The 0-4 progression scale representing how well a user knows an item
  - `FSRSRating`: The 1-4 rating scale used by the FSRS scheduling algorithm

### Dependents (What Needs This)

Currently, this module is designed to be consumed by:

- `src/main/services/scoring-update.service.ts`: The service that processes user responses and updates mastery state. When a response is submitted, this service can use `calculateFSRSRatingWithTiming()` to convert the response time into an appropriate FSRS rating.

- Future integration with `src/main/ipc/learning.ipc.ts`: IPC handlers will call this module when processing learning responses from the renderer process.

- Future integration with `src/renderer/components/session/*`: Session components may use fluency metrics to display progress indicators.

### Data Flow

```
User completes task
        |
        v
Response time (ms) captured
        |
        v
getTaskCategory() determines task type
        |
        v
getAdjustedThresholds() calculates personalized thresholds
  - Based on task category (recognition vs production)
  - Adjusted for mastery stage (lenient for beginners)
  - Adjusted for word length (longer words = more time)
        |
        v
analyzeResponseTime() classifies the response
  - too_fast / fast / good / slow / very_slow
  - Detects automaticity
  - Flags potential guessing
        |
        v
calculateFSRSRatingWithTiming() produces FSRS rating (1-4)
        |
        v
FSRS algorithm uses rating to schedule next review
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithm Layer** of LOGOS's architecture:

```
Layer 1: Renderer (React UI) - User sees task, types response
    |
Layer 2: IPC Bridge - Response sent to main process
    |
Layer 3: Services - scoring-update.service orchestrates
    |
Layer 4: Core Algorithms - THIS MODULE lives here
    |              alongside irt.ts, fsrs.ts, pmi.ts
    |
Layer 5: Database - Mastery state persisted
```

The response timing module is a **pure function library** with no side effects. It takes inputs (response time, task type, mastery stage) and returns outputs (analysis, ratings). This makes it highly testable and portable.

### Big Picture Impact

Response timing is the **quality signal** that prevents the FSRS algorithm from being fooled. Without it:

- A user who guesses correctly on every MCQ would advance as if they truly knew the material
- A user who struggles for 30 seconds but eventually gets the right answer would receive the same scheduling as someone who answered instantly
- There would be no way to detect when knowledge has become automatic (the ultimate goal of language learning)

This module enables LOGOS to implement **automaticity tracking**, a concept from second language acquisition research. The transition from effortful retrieval to automatic access is the hallmark of true language proficiency.

**System Dependencies**:

| Component | Dependency Type | Impact if Response Timing Fails |
|-----------|----------------|--------------------------------|
| FSRS Scheduling | Direct | Suboptimal review intervals |
| Mastery Stage Detection | Indirect | Stage 4 (Automatic) unreliable |
| Session Analytics | Direct | Fluency metrics unavailable |
| Anti-Gaming Detection | Critical | Cheating undetectable |

### Critical Path Analysis

**Importance Level**: Medium-High

- **If this fails completely**: FSRS falls back to correctness-only ratings, learning continues but suboptimally
- **If thresholds are miscalibrated**: Users may be incorrectly classified as automatic or struggling
- **Graceful degradation**: All functions have sensible defaults and handle edge cases

---

## Technical Concepts (Plain English)

### Lexical Decision Task Thresholds

**Technical**: Response time thresholds derived from psycholinguistic research on lexical decision tasks (LDT), where participants must quickly decide if a letter string is a real word.

**Plain English**: Scientists have been measuring how fast people recognize words for decades. Native English speakers typically recognize common words in 400-600 milliseconds. Second language learners take longer, typically 600-1500ms depending on proficiency. These research findings form the basis for LOGOS's "how fast is fast enough" judgments.

**Why We Use It**: Rather than inventing arbitrary thresholds, we use empirically-validated timing benchmarks from peer-reviewed research (Yap & Balota, 2015; Harrington, 2006; Segalowitz & Hulstijn, 2005).

### Task Categories

**Technical**: A classification system that groups task formats into cognitive processing categories: recognition (identify), recall (retrieve), production (generate), and timed (fluency-focused).

**Plain English**:
- **Recognition tasks** (like multiple choice) are like recognizing a friend's face in a crowd - you just need to match what you see to what you know
- **Recall tasks** (like fill-in-the-blank) are like remembering a friend's name when you see them - you have to retrieve the information
- **Production tasks** (like writing a sentence) are like introducing your friend to someone - you have to generate language from scratch
- **Timed tasks** are specifically designed to test whether knowledge is automatic

**Why We Use It**: Different cognitive processes have fundamentally different time profiles. Expecting a user to write a sentence in 500ms is unreasonable; expecting them to recognize a word in 15 seconds suggests a problem.

### Mastery Stage Modifiers

**Technical**: Multiplicative adjustment factors (0.8 to 2.0) applied to base thresholds based on the learner's current mastery stage with an item.

**Plain English**: We cut beginners more slack. If you just learned a word yesterday, we don't expect you to respond as quickly as you would for a word you've known for months. The modifiers are:
- Stage 0 (New): 2x more time allowed
- Stage 1 (Recognition): 1.5x more time
- Stage 2 (Recall): 1.2x more time
- Stage 3 (Controlled): Normal time
- Stage 4 (Automatic): 0.8x time (we expect faster responses)

**Why We Use It**: Fair assessment requires accounting for learning stage. A 2-second response that's "slow" for a well-known word might be "good" for a newly introduced one.

### Automaticity Detection

**Technical**: Boolean classification based on whether response time falls below a category-specific threshold (1000ms for recognition, 2000ms for recall, 4000ms for production) combined with correctness.

**Plain English**: True language fluency means you don't have to think about it. When you read "the cat sat on the" you instantly know the next word should be something like "mat" or "floor" - you don't consciously search your memory. Automaticity detection identifies when responses happen fast enough to suggest this unconscious, fluent processing.

**Why We Use It**: Stage 4 mastery (Automatic) should only be awarded when the learner demonstrates fast, effortless access to knowledge. This prevents "paper fluency" where someone knows vocabulary but can't actually use it in real-time conversation.

### Coefficient of Variation

**Technical**: The ratio of standard deviation to mean (CV = sigma / mu), used in fluency metrics to measure response time consistency.

**Plain English**: If you respond to 10 questions with times of [800, 850, 790, 810, 820, 805, 795, 830, 815, 785] milliseconds, your responses are very consistent. If your times are [500, 2000, 800, 3500, 400, 1900, 600, 2800, 450, 1700], you're all over the place. The coefficient of variation captures this consistency - lower numbers mean more consistent (and thus more automatic) responses.

**Why We Use It**: Automatic knowledge is characterized not just by speed but by consistency. A low CV indicates stable, reliable access to knowledge.

### Guessing Detection

**Technical**: Heuristic classification of responses as potential guesses based on: response time below the "fast" threshold AND (task is recognition-type OR response is incorrect).

**Plain English**: If someone answers a multiple-choice question in 300ms and gets it right, they might actually know the answer - or they might have just clicked randomly and gotten lucky. On a 4-option MCQ, random guessing gives you a 25% chance of being right. We flag suspiciously fast responses so the system doesn't reward lucky guesses with high ratings.

**Why We Use It**: Prevents gaming of the spaced repetition system. If guessing was rewarded, users could advance items without actually learning them, then fail catastrophically when asked to produce the language.

### Bot/Cheating Pattern Detection

**Technical**: Multi-pattern analysis of response sequences to identify non-human or gaming behaviors: uniform timing (robotic), all-fast-high-accuracy (bot), all-fast-low-accuracy (random clicking).

**Plain English**:
- **Robotic timing**: Human response times naturally vary. If someone responds at exactly 1000ms for 10 questions in a row, something is off.
- **Bot pattern**: Extremely fast responses with very high accuracy suggests automation or looking up answers.
- **Random clicking**: Extremely fast responses with very low accuracy suggests the user is just clicking through without trying.

**Why We Use It**: Protects the integrity of learning data. If a user is gaming the system, their mastery records become meaningless, and the entire adaptive system breaks down.

---

## Academic Foundation

This module is grounded in established psycholinguistic research:

| Research Area | Key Finding | How LOGOS Uses It |
|---------------|-------------|-------------------|
| Lexical Decision Tasks | Native speakers: 400-600ms for high-frequency words | Base threshold for recognition tasks |
| L2 Processing | Proficient L2 speakers: 600-900ms | Adjusted thresholds for learners |
| Automaticity Theory | <1000ms recognition indicates automatic access | Stage 4 gating criterion |
| Production vs Recognition | Production takes 1.5-3x longer than recognition | Different thresholds per task category |

**Key Citations**:
- Yap, M.J. & Balota, D.A. (2015). Visual word recognition. Oxford Handbook of Reading.
- Harrington, M. (2006). The lexical decision task as a measure of L2 lexical proficiency. EUROSLA Yearbook.
- Segalowitz, N. & Hulstijn, J. (2005). Automaticity in bilingualism and second language learning.

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for response-timing module
- **Why**: Module implemented to provide research-backed response time analysis for FSRS integration
- **Impact**: Enables quality-aware spaced repetition scheduling across all task types
