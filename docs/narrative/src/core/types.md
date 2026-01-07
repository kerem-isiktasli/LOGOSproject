# Core Type Definitions

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/types.ts`
> **Status**: Active

---

## Context & Purpose

This file is the **type system foundation** for the entire LOGOS application. It defines every data structure used by the core algorithms, establishing a shared vocabulary across the codebase. Without this file, the rest of LOGOS cannot communicate - it is quite literally the language that all other modules speak.

**Business Need**: Language learning is a complex domain with many interrelated concepts (ability levels, memory scheduling, vocabulary metrics, task types). To build reliable software, all these concepts need precise, consistent definitions. This file prevents developers from using different terms for the same thing (like "score" vs "ability" vs "theta") and ensures type safety across the entire application.

**When Used**: This file is imported by virtually every other module in LOGOS. Any code that works with IRT calculations, FSRS scheduling, PMI analysis, task generation, bottleneck detection, or user data will import types from here.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

This file has **no dependencies** - it is the foundation layer. It only uses TypeScript's built-in types.

### Dependents (What Needs This)

**Core Algorithm Modules:**
- `src/core/irt.ts`: Uses `ItemParameter`, `ThetaEstimate`, `ItemCalibrationResult`
- `src/core/fsrs.ts`: Re-exports/extends `FSRSCard`, `FSRSParameters`, `MasteryState`
- `src/core/pmi.ts`: Uses `PMIResult`, `PMIPair`, `DifficultyMapping`, `TaskType`
- `src/core/priority.ts`: Uses `FREMetrics`, `PriorityCalculation`, `PriorityWeights`
- `src/core/bottleneck.ts`: Uses `BottleneckEvidence`, `BottleneckAnalysis`, `ComponentType`
- `src/core/morphology.ts`: Uses `Affix`, `MorphologicalAnalysis`
- `src/core/g2p.ts`: Uses `G2PRule`, `G2PDifficulty`
- `src/core/syntactic.ts`: Uses `SyntacticComplexity`

**Shared Layer:**
- `src/shared/types.ts`: Re-exports all types for cross-process communication

**Service Layer:**
- `src/main/services/task-generation.service.ts`: Uses `TaskSpec`, `TaskContent`, `Task`
- `src/main/services/scoring-update.service.ts`: Uses `MasteryState`, `MasteryResponse`
- `src/main/services/state-priority.service.ts`: Uses `PriorityCalculation`, `LearningQueueItem`

### Data Flow

```
types.ts
    |
    +--> Core algorithms (irt.ts, fsrs.ts, pmi.ts, etc.)
    |         |
    |         v
    |    Service layer (task-generation, scoring-update, etc.)
    |         |
    +--> shared/types.ts --> IPC layer --> Renderer process
```

---

## Macroscale: System Integration

### Architectural Layer

This file sits at **Layer 0 (Foundation)** - it has no dependencies and everything depends on it:

```
+------------------------------------------------------------+
| Layer 3: Renderer (React Components)                        |
+------------------------------------------------------------+
                            |
                            v
+------------------------------------------------------------+
| Layer 2: IPC Bridge (contracts.ts, *.ipc.ts)               |
|          Imports types via shared/types.ts                  |
+------------------------------------------------------------+
                            |
                            v
+------------------------------------------------------------+
| Layer 1: Services & Main Process                            |
|          Imports types directly from core/types.ts          |
+------------------------------------------------------------+
                            |
                            v
+------------------------------------------------------------+
| Layer 0: Core Types (THIS FILE)                             |  <-- Foundation
|          No dependencies, defines ALL domain types          |
+------------------------------------------------------------+
```

### Big Picture Impact

This file defines the **domain language** of LOGOS. Every concept in the application has its authoritative definition here:

| Concept | Type | System Impact |
|---------|------|---------------|
| User ability | `ThetaEstimate` | IRT calculations, adaptive difficulty |
| Item difficulty | `ItemParameter` | Task selection, calibration |
| Memory state | `FSRSCard` | Spaced repetition scheduling |
| Learning stage | `MasteryStage` | Progress tracking, task selection |
| Vocabulary metrics | `FREMetrics` | Priority calculation |
| Error patterns | `BottleneckEvidence` | Diagnostic analytics |
| Task definitions | `TaskSpec`, `TaskContent` | Content generation |
| User profile | `User`, `UserThetaProfile` | Personalization |

**Without this file:**
- No type safety across the application
- Inconsistent naming (developers would invent their own terms)
- No shared understanding between modules
- Runtime errors instead of compile-time errors

### Critical Path Analysis

**Importance Level**: Critical (Foundation)

- **If this file has bugs**: Every module in LOGOS could malfunction
- **If types are inconsistent**: Data flows break between layers
- **If naming is unclear**: Future development becomes confusing

**Stability Requirements**: This file should be extremely stable. Changes here ripple through the entire codebase.

---

## Type Domain Organization

The file is organized into logical sections:

### 1. IRT Types (Item Response Theory)

**Purpose**: Enable psychometric modeling of learner ability and item difficulty.

| Type | Plain English |
|------|---------------|
| `IRTModel` | Which statistical model to use ('1PL', '2PL', '3PL') - each has different assumptions about items |
| `ItemParameter` | Properties of a vocabulary item that affect how hard it is to learn |
| `ThetaEstimate` | A measurement of how skilled the learner is (with confidence bounds) |
| `IRTResponse` | Record of whether a learner got an item right or wrong |

**Key Insight**: Theta (ability) and difficulty are on the same scale. A theta of 0 means average ability; a difficulty of 0 means average difficulty. When theta equals difficulty, the learner has a 50% chance of success.

### 2. PMI Types (Pointwise Mutual Information)

**Purpose**: Measure how strongly words associate with each other in natural language.

| Type | Plain English |
|------|---------------|
| `PMIResult` | The measured association strength between two words |
| `PMIPair` | Two words to analyze |
| `CorpusStatistics` | Background data about word frequencies in a text collection |

**Key Insight**: High PMI means words appear together more than chance would predict. "Coffee" and "cup" have high PMI; "coffee" and "refrigerator" do not.

### 3. FSRS Types (Spaced Repetition)

**Purpose**: Schedule reviews at optimal intervals to maximize long-term retention.

| Type | Plain English |
|------|---------------|
| `FSRSCard` | Memory state for an item (how well learned, how stable) |
| `FSRSRating` | Learner's self-assessment (1=forgot, 4=easy) |
| `FSRSParameters` | Algorithm tuning settings |
| `FSRSScheduleResult` | When to review next |

**Key Insight**: Stability (S) is how many days until you forget. Difficulty (D) is how hard the item is to remember. The algorithm optimizes review timing to maintain 90% retention.

### 4. Mastery Types

**Purpose**: Track progression through learning stages (unknown -> recognized -> recalled -> produced -> automatic).

| Type | Plain English |
|------|---------------|
| `MasteryStage` | Current skill level (0-4) |
| `MasteryState` | Complete learning record for an item |
| `ScaffoldingGap` | Difference between performance with vs without hints |
| `StageThresholds` | Requirements to advance to next stage |

**Key Insight**: Stage progression is not just about accuracy. It requires consistent performance, adequate retention (stability), and reduced dependence on scaffolding (hints).

### 5. Task Types

**Purpose**: Define the kinds of learning exercises LOGOS can generate.

| Type | Plain English |
|------|---------------|
| `TaskType` | What kind of exercise (recognition, recall, production, etc.) |
| `TaskFormat` | How the exercise is presented (MCQ, fill-blank, free response) |
| `TaskSpec` | Request for what exercise to generate |
| `TaskContent` | The actual exercise content (prompt, answers, hints) |

**Key Insight**: Task type + format + modality combine to create diverse exercises. "Recognition + MCQ + visual" = reading multiple choice. "Production + free_response + auditory" = listening and speaking.

### 6. Priority Types (FRE Metrics)

**Purpose**: Decide what to study next based on frequency, relationships, and context.

| Type | Plain English |
|------|---------------|
| `FREMetrics` | Three-dimensional importance score for vocabulary |
| `PriorityCalculation` | Complete ranking data for one item |
| `PriorityWeights` | How to balance F, R, and E in the calculation |

**Key Insight**: FRE stands for Frequency (how common), Relational density (how connected to other words), and Contextual contribution (how meaningful). High-FRE words are learned first.

### 7. Bottleneck Types

**Purpose**: Detect which language component (phonology, morphology, lexical, syntactic, pragmatic) is blocking progress.

| Type | Plain English |
|------|---------------|
| `ComponentType` | The five linguistic levels (PHON, MORPH, LEX, SYNT, PRAG) |
| `BottleneckEvidence` | Error patterns at one level |
| `BottleneckAnalysis` | Diagnosis of what's causing errors |
| `CascadeAnalysis` | How errors at one level cause errors at higher levels |

**Key Insight**: Language levels form a cascade: phonology -> morphology -> lexical -> syntactic -> pragmatic. Errors at lower levels cause apparent errors at higher levels. If a learner mispronounces a word (PHON), they might not recognize it in context (LEX).

### 8. Language Object Types

**Purpose**: Represent anything that can be learned (words, phrases, patterns, rules).

| Type | Plain English |
|------|---------------|
| `LanguageObjectType` | Classification (LEX=word, MWE=phrase, MORPH=pattern, etc.) |
| `LanguageObject` | Complete record of a learnable item with all its metrics |

### 9. Session Types

**Purpose**: Track learning sessions from start to finish.

| Type | Plain English |
|------|---------------|
| `SessionMode` | Purpose of session (learning new, training, evaluation) |
| `SessionConfig` | Settings for the session (duration, focus areas) |
| `SessionState` | Live tracking during session |
| `SessionSummary` | Post-session analytics |

### 10. Utility Types

**Purpose**: Generic helpers used throughout.

| Type | Plain English |
|------|---------------|
| `Result<T, E>` | Either success with data or failure with error |
| `PaginationParams` | For fetching data in pages |
| `DateRange` | Time window for filtering |

---

## Technical Concepts (Plain English)

### Theta (Ability Parameter)

**Technical**: The latent trait parameter in Item Response Theory representing a person's underlying ability on the construct being measured, expressed on a logit scale typically ranging from -3 to +3.

**Plain English**: Think of theta like a hidden skill level. You can't see it directly, but you can estimate it by watching how someone performs. A theta of 0 is average, positive is above average, negative is below. It's like a batting average, but for language skills.

**Why We Use It**: Theta lets us compare learners and items on the same scale. If your theta is 1.0 and an item's difficulty is 1.0, you have a 50% chance of getting it right. If you're at 2.0 and the item is 1.0, you'll probably succeed (~73%).

### Discrimination Parameter (a)

**Technical**: The slope parameter in IRT models that determines how rapidly the probability of success changes as ability approaches the item difficulty.

**Plain English**: How "sensitive" an item is to skill differences. A high-discrimination item sharply separates good learners from struggling ones. A low-discrimination item gives similar results regardless of skill.

**Why We Use It**: Some vocabulary words are "diagnostic" - if you know them, you probably know a lot; if you don't, you're probably a beginner. Others don't tell us much either way. The discrimination parameter captures this.

### Stability (FSRS)

**Technical**: The interval in days at which the probability of successful recall equals the target retention rate (typically 90%).

**Plain English**: How many days until you're likely to forget. If stability is 30 days, the algorithm predicts you'll remember for about a month. High stability = deeply learned.

**Why We Use It**: Stability tells us when to schedule the next review. We want to review just before you'd forget - that's the optimal moment for strengthening memory.

### FRE Metrics

**Technical**: A three-dimensional metric combining corpus frequency (F), semantic network centrality (R), and contextual information gain (E) to quantify vocabulary importance.

**Plain English**: Three ways to measure why a word matters. F = how often it appears in real language. R = how many other words it connects to. E = how much meaning it adds to understanding.

**Why We Use It**: Some words are more "worth learning" than others. FRE helps us prioritize. "The" has high F but low E. "Diagnose" might have moderate F but high E for medical learners.

### Cascade Order

**Technical**: The theoretical hierarchy PHON -> MORPH -> LEX -> SYNT -> PRAG representing the bottom-up processing of language, where deficits at lower levels propagate upward.

**Plain English**: Language understanding flows from sounds to meaning. First you hear sounds (phonology), recognize word parts (morphology), identify words (lexical), parse grammar (syntactic), then understand intent (pragmatic). Problems early in the chain cause problems later.

**Why We Use It**: If someone seems to have grammar problems (SYNT), we check if the real issue is earlier - maybe they don't recognize the words (LEX) because they can't parse the sounds (PHON). We fix the root cause, not the symptom.

---

## Naming Conventions

Per `AGENT-MANIFEST.md`, this file establishes authoritative naming:

| Correct Term | Incorrect Alternatives |
|--------------|------------------------|
| `theta` | score, level, ability |
| `priority` | weight, importance |
| `irtDifficulty` | hardness |
| `frequency` | F |
| `relationalDensity` | R |
| `contextualContribution` | E |

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created shadow documentation for types.ts
- **Why**: Foundation file requires comprehensive documentation for system understanding
- **Impact**: Enables developers and AI agents to understand the type system

### Historical Changes (Inferred from Code)

- Added `TaskType` extensions for sentence combining and clause selection (syntactic complexity)
- Added `TaskFormat` extension for typing exercises
- Added `ComponentType` lowercase aliases for compatibility
