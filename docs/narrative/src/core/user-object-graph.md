# User-Object Relationship Graph Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/user-object-graph.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to track and analyze the evolving relationship between a language learner and each individual language object (word, pattern, expression) they encounter. Unlike simple flashcard systems that track "seen/not seen," this module captures the **multi-dimensional nature of language acquisition**.

**The Core Problem It Solves**:

Traditional vocabulary learning apps treat words as binary states: either you know a word or you do not. Real language knowledge is far more nuanced. A learner might:
- Recognize a word when reading but fail to produce it when writing
- Understand a word in medical contexts but not in casual conversation
- Hear a word correctly but misspell it consistently

This module captures these asymmetries by building a **relationship graph** between each user and each language object, recording not just *whether* the learner succeeded, but *how*, *when*, and *in what context*.

**Business Need**: Personalized language learning requires understanding each learner's unique strengths and weaknesses across different skill dimensions. Without granular encounter data, the system cannot make intelligent decisions about what to practice next.

**When Used**:
- Every time a learner completes a task (any interaction with a language object)
- When generating learning session recommendations
- When building progress visualizations for the learner
- When calculating which items need targeted practice

---

## Academic Foundations

This module is built on three major research foundations in educational data mining and knowledge tracing:

### Deep Knowledge Tracing (DKT) - Piech et al., 2015

**Technical**: DKT uses **Long Short-Term Memory (LSTM) networks** (a type of neural network that can remember information over long sequences) to model how student knowledge evolves over time as they practice problems.

**Plain English**: Instead of just counting "correct vs incorrect," DKT recognizes that each practice attempt changes what the student knows. It is like tracking not just wins and losses in a game, but how the player's skill level shifts after each match.

**Why We Use It**: DKT showed that sequential learning patterns matter. This module implements a similar philosophy: each encounter with a word is not isolated but part of a learning trajectory.

### DyGKT - Dynamic Graph Learning for Knowledge Tracing (2024)

**Technical**: DyGKT models the learner-concept relationship as a **heterogeneous dynamic graph** where nodes represent students, questions, and knowledge concepts, with edges capturing interactions that evolve over time.

**Plain English**: Imagine a web of connections between you, all the words you are learning, and the underlying concepts (grammar rules, pronunciation patterns). DyGKT tracks how this web changes as you practice. Some connections get stronger, others reveal gaps.

**Why We Use It**: DyGKT inspired our multi-dimensional tracking. We do not just track "user knows word X" but "user recognizes X visually, struggles to produce X auditorily, has seen X mainly in medical contexts."

### Knowledge Relation Rank (PMC 2023)

**Technical**: This research models **heterogeneous learning interactions** where different types of engagement (reading, writing, listening) create different types of knowledge edges with different weights.

**Plain English**: Learning a word by reading it 10 times creates a different kind of knowledge than using it in conversation twice. This research quantifies these differences.

**Why We Use It**: It validates our decision to track interpretation vs. production ratios and modality-specific success rates as fundamentally different types of knowledge.

---

## Microscale: Direct Relationships

### Dependencies (What This Module Needs)

| File | Import | Purpose |
|------|--------|---------|
| `src/core/types.ts` | `TaskType`, `TaskFormat`, `TaskModality` | Type definitions for task classification - ensures consistent vocabulary across the codebase |

**Internal Dependencies**:
- Uses only pure TypeScript with no external library dependencies
- Relies on JavaScript's native `Date`, `Math`, and `Map` objects

### Dependents (What Needs This Module)

**Note**: This module is newly implemented and not yet fully integrated. Expected consumers include:

| Expected Consumer | How It Will Use This Module |
|-------------------|----------------------------|
| `src/main/services/learning-session.ts` | Will call `buildRelationshipStats()` to get current user-object state for session planning |
| `src/main/services/task-selector.ts` | Will use `buildRelationshipProfile()` to find exposure gaps and recommend balanced practice |
| `src/renderer/components/ProgressDashboard.tsx` | Will consume `generateVisualizationData()` for charts and graphs |
| `src/main/db/operations/mastery.ts` | Will call `createEncounter()` and `updateStatsWithEncounter()` when recording practice results |

### Data Flow

```
User completes a task
        |
        v
+-------------------+
| createEncounter() | -- Records raw encounter with full context
+-------------------+
        |
        v
+---------------------------+
| updateStatsWithEncounter()| -- Incrementally updates aggregated statistics
+---------------------------+
        |
        v
+------------------------+
| buildRelationshipStats()| -- (Re)calculates all derived metrics if needed
+------------------------+
        |
        v
+-------------------------+
| buildRelationshipProfile()| -- Adds recommendations based on gaps
+-------------------------+
        |
        v
+---------------------------+
| generateVisualizationData()| -- Formats for UI consumption
+---------------------------+
        |
        v
[UI renders progress charts, session planner uses recommendations]
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithm Layer** of LOGOS architecture:

```
Layer 0: Shared Types (src/shared/, src/core/types.ts)
            |
Layer 1: Core Algorithms (src/core/) <-- YOU ARE HERE
            |
Layer 2: Main Process Services (src/main/services/)
            |
Layer 3: IPC Handlers (src/main/ipc/)
            |
Layer 4: Renderer/UI (src/renderer/)
```

**Architectural Principle**: This module is **pure** - it has no side effects, performs no I/O, and does not access databases directly. It receives data, computes derived values, and returns results. This makes it:
- Testable in isolation
- Reusable across different contexts
- Free from Electron main/renderer process concerns

### Big Picture Impact

This module is the **foundation of personalized learning** in LOGOS. It enables:

| Feature | How This Module Enables It |
|---------|---------------------------|
| **Smart Session Planning** | Identifies under-practiced skill dimensions (e.g., "user needs more auditory production practice") |
| **Balanced Learning** | Tracks interpretation/production ratio to prevent lopsided practice |
| **Domain Contextualization** | Records which domains each word has been seen in, enabling domain-specific practice |
| **Progress Visualization** | Generates radar charts, timelines, and distribution data for the UI |
| **Learning Cost Estimation** | Predicts how much effort future items will require based on past patterns |
| **Transfer Learning Optimization** | Calculates derived effects - learning word X benefits related words Y, Z |

### Critical Path Analysis

**Importance Level**: High (Foundation)

**If This Module Fails**:
- Learning sessions become "dumb" - random or simplistic item selection
- Users practice in unbalanced ways (all reading, no production)
- Progress dashboards show generic or misleading information
- The system cannot identify struggling learners or adapt to their needs

**Failure Modes**:
1. **Data loss**: If encounters are not recorded, the relationship profile becomes stale
2. **Calculation errors**: Incorrect success rates lead to poor recommendations
3. **Performance issues**: If stats recalculation is too slow, sessions feel laggy

**Backup Strategy**: The module supports both full recalculation (`buildRelationshipStats()`) and incremental updates (`updateStatsWithEncounter()`), allowing recovery from inconsistent states.

---

## Technical Concepts (Plain English)

### Encounter

**Technical**: A timestamped record of a single interaction between a user and a language object, capturing the full context (task type, modality, domain) and outcome (success, response time, cue level).

**Plain English**: Every time you practice a word, we write down: "At 3:42 PM, Maria saw 'diagnosis' in a medical reading comprehension task, got it correct in 2.3 seconds without any hints." This is one encounter.

**Why We Track It**: Individual encounters are the raw material for understanding learning patterns. Without them, we only know final states, not trajectories.

### Interpretation vs. Production

**Technical**: **Interpretation tasks** (receptive skills) require recognizing or understanding language input (reading comprehension, listening, matching). **Production tasks** (generative skills) require generating language output (speaking, writing, free response).

**Plain English**:
- *Interpretation* = "I can understand it when I see/hear it" (like recognizing your friend's face in a crowd)
- *Production* = "I can create it from memory" (like drawing your friend's face from memory)

**Why We Track It**: Learners often have asymmetric skills. Someone might understand 1000 words but only be able to use 200 in conversation. Tracking this ratio reveals which direction to push practice.

### Modality Balance (Shannon Entropy)

**Technical**: We calculate the **normalized Shannon entropy** of the modality distribution (visual, auditory, mixed) to measure how evenly distributed practice has been across sensory channels. A value of 1.0 means perfectly balanced; 0.0 means single-modality only.

**Plain English**: If you only ever read words and never hear them, your modality balance is 0 (skewed). If you practice equally through reading, listening, and mixed exercises, your balance approaches 1 (even). We use an information theory formula that measures "how surprising" your next encounter modality would be - high surprise means high balance.

**Why We Track It**: Multi-modal exposure creates more robust memory. Someone who only reads "hospital" may not recognize it when spoken with an accent.

### Interpretation/Production Ratio

**Technical**: A value between 0 and 1 calculated as `interpretationEncounters / totalEncounters`. A value of 0.5 indicates balanced practice; values above 0.5 indicate interpretation-heavy practice.

**Plain English**: This answers: "Out of all your practice, how much was passive (understanding) vs. active (creating)?" If you have done 8 recognition tasks and 2 writing tasks for a word, your ratio is 0.8 - heavily skewed toward passive learning.

**Why We Track It**: Production is harder and creates stronger memory traces. If someone's ratio is too high, we recommend more production tasks.

### Learning Cost Estimation

**Technical**: A composite score (0-1) estimating the effort required to achieve mastery, combining:
- Base IRT difficulty (how hard the item is psychometrically)
- Historical success rate (how the user has performed)
- Exposure factor (how many attempts without mastery)

**Plain English**: "How much work will it take this person to truly learn this word?" A common word that the user keeps failing costs more (they are struggling). A rare word they have never seen costs less initially (unknown territory).

**Why We Track It**: Helps prioritize practice. High-cost items might need special attention (scaffolding, extra practice) rather than being abandoned.

### Derived Effect Score (Transfer Learning)

**Technical**: Measures how much learning one language object benefits related objects through **transfer learning**. Calculated using transfer coefficients and network centrality (how connected the object is to others).

**Plain English**: Learning the prefix "un-" helps with hundreds of words (unhappy, unlikely, unusual). Learning a rare technical term helps only itself. This score captures that multiplier effect - some knowledge is more "strategic" because it unlocks other knowledge.

**Why We Track It**: Allows the system to prioritize high-leverage learning. Studying root words and common patterns has cascading benefits.

### Knowledge Strength

**Technical**: A weighted composite score combining:
- Success rate (40%)
- Retrieval fluency (20%)
- Modality balance (10%)
- Category balance (10%)
- Recency decay (20%)

Uses exponential decay with a 30-day half-life for the recency component.

**Plain English**: "How well does this person really know this word, right now?" It is not just about getting it right - it is about:
- Getting it right consistently
- Getting it right quickly (fluency)
- Getting it right in different formats
- Getting it right in both passive and active tasks
- Having practiced it recently (memory fades)

**Why We Track It**: Single metrics can be misleading. Someone might have 100% accuracy but only on easy recognition tasks. This composite reveals true, robust knowledge.

### Retrieval Fluency

**Technical**: Uses a **sigmoid function** mapping response times to fluency scores. The function is parameterized with a midpoint at 2000ms, where faster responses yield higher fluency scores (approaching 1.0) and slower responses yield lower scores (approaching 0.0).

**Plain English**: "How quickly can you access this word in your memory?" Even if you eventually get the answer right, taking 10 seconds to recall a basic word suggests weak memory. Instant recall (under 1 second) suggests strong, automatic knowledge.

**Why We Track It**: Fluency distinguishes "I eventually figured it out" from "I know it cold." Language use in real life requires rapid access - hesitating for 5 seconds while speaking breaks conversation flow.

---

## Key Functions Explained

### `classifyTaskCategory(taskType: string): TaskCategory`

**What It Does**: Takes a task type string (like "recognition" or "free_response") and classifies it as either "interpretation" or "production."

**Why It Exists**: Different parts of the codebase use different task type names. This function provides consistent classification based on language acquisition theory.

**Fallback Logic**: If an unknown task type is passed, the function uses pattern matching (does it contain "recognition"? "production"?) to make a best guess, defaulting to "interpretation" as the safer assumption.

### `calculateModalityBalance(encounters: ObjectEncounter[]): number`

**What It Does**: Computes how evenly distributed the encounters are across visual, auditory, and mixed modalities using Shannon entropy.

**The Math**:
1. Count encounters by modality
2. Convert counts to probabilities
3. Calculate entropy: `H = -sum(p * log2(p))`
4. Normalize by maximum possible entropy (`log2(3)` for 3 categories)

**Why Entropy**: Entropy naturally captures "spread." If all encounters are visual, entropy is 0 (no uncertainty). If perfectly balanced, entropy is maximum (maximum uncertainty about next modality).

### `updateStatsWithEncounter(currentStats, encounter): ObjectRelationshipStats`

**What It Does**: Incrementally updates aggregated statistics when a new encounter is recorded, without recalculating from the full history.

**Why Incremental**: Recalculating all statistics from scratch every time would be expensive (O(n) where n = total encounters). Incremental updates are O(1) - constant time regardless of history size.

**Running Average Formula**: For success rates, uses the online mean update formula:
```
new_mean = old_mean + (new_value - old_mean) / n
```

### `buildRelationshipProfile(stats): ObjectRelationshipProfile`

**What It Does**: Extends raw statistics with actionable recommendations:
- What task category should the user practice next?
- What modality is under-represented?
- What gaps exist in the user's exposure?

**Why Separate From Stats**: Stats are objective measurements. Profiles include subjective recommendations based on pedagogical principles (e.g., "a 70/30 interpretation/production split is imbalanced").

---

## Change History

### 2026-01-06 - Initial Implementation

- **What Changed**: Created comprehensive user-object relationship tracking module implementing DKT, DyGKT, and Knowledge Relation Rank principles
- **Why**: Priority 1 feature for 2025 implementation roadmap; foundational data for all personalization features
- **Impact**: Enables multi-dimensional tracking of user-object relationships; provides visualization data for progress dashboards; supports balanced learning recommendations

### Design Decisions Made

1. **Pure Functions**: No database access in this module - keeps algorithms testable and separates concerns
2. **Incremental Updates**: `updateStatsWithEncounter()` allows efficient real-time stats without full recalculation
3. **Three-Modality Model**: Chose visual/auditory/mixed rather than finer-grained modalities for simplicity
4. **Shannon Entropy for Balance**: Chose information-theoretic measure over simpler variance for its natural 0-1 normalization
5. **30-Day Half-Life for Recency**: Balances short-term and long-term memory considerations based on FSRS research

---

## Future Considerations

1. **Temporal Patterns**: Currently tracks `avgInterEncounterDays` but does not analyze optimal spacing patterns
2. **Genre Exposure**: `genre` field exists in encounters but is not aggregated into stats
3. **Social Context**: Could add collaborative filtering - "users like you also struggled with X"
4. **Neural Knowledge Tracing**: Full DKT would require LSTM integration; current implementation is statistical approximation

---

## Related Documentation

- `docs/narrative/src/core/types.md` - Type definitions used by this module
- `docs/narrative/src/core/transfer.md` - Transfer coefficient calculations referenced by `calculateDerivedEffect()`
- `docs/narrative/src/core/fsrs.md` - FSRS scheduling integration for `knowledgeStrength` calculations
- `docs/ALGORITHMIC-FOUNDATIONS.md` - Full specification of LOGOS algorithm suite
- `docs/IMPLEMENTATION-PLAN-2025.md` - Roadmap showing this module as Priority 1
