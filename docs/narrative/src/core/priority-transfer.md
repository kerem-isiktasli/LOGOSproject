# Priority-Transfer Integration Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/priority-transfer.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to answer a fundamental question in language learning: **How much easier (or harder) will a word be for a specific learner based on what they already know from their native language?**

The priority-transfer module bridges two critical systems in LOGOS: the **transfer coefficient analysis** (which measures how similar the learner's native language is to their target language) and the **learning queue** (which determines what the learner should study next). Without this bridge, the system would treat all learners identically, ignoring the massive advantage that a German speaker has learning English vocabulary compared to a Japanese speaker.

**Business Need**: Personalized learning paths that respect each learner's linguistic background. A Spanish speaker learning English medical vocabulary can leverage Latin cognates like "cardio-" and "-itis" - the system should recognize this advantage and deprioritize these "easy wins" in favor of truly challenging vocabulary that needs more practice.

**When Used**: Every time the system calculates what a learner should study next. This happens during:
- Session initialization (building the study queue)
- Real-time priority recalculation after a response
- Batch processing when new vocabulary is introduced
- User analytics (showing transfer strengths/weaknesses)

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/core/transfer.ts`: **getTransferCoefficients()** - Fetches the raw linguistic similarity scores between L1 and L2 language families (lexical, phonological, morphological, syntactic, pragmatic)
- `src/core/transfer.ts`: **calculateTransferGain()** - Converts component-specific transfer into a 0-1 gain score for cost calculations
- `src/core/transfer.ts`: **getLanguageFamily()** - Determines which language family (Germanic, Romance, Slavic, etc.) the native language belongs to
- `src/core/transfer.ts`: **TransferCoefficients, LanguageFamily** - Type definitions for transfer data structures

### Dependents (What Needs This)

Currently, this module is designed to be consumed by:
- **Session planning services** - Would call `calculateFullPriority()` to rank all available items
- **Queue building logic** - Would use `batchCalculateTransfer()` for efficient bulk processing
- **User analytics dashboard** - Would display `getTransferSummary()` to show learners their L1 advantages
- **IRT parameter adjustment** - Would integrate `calculateCostWithTransfer()` into difficulty estimates

### Data Flow

```
User Profile (native language, target language)
    |
    v
TransferContext created (languages + object type + domain)
    |
    v
getTransferCoefficients() fetches L1-L2 similarity matrix
    |
    v
calculateTransferGain() converts to 0-1 gain score
    |
    v
Priority adjusted: high transfer = LOWER priority (already easy)
                   low/negative transfer = HIGHER priority (needs attention)
    |
    v
Final priority returned with explanation for transparency
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at the **Algorithm Core Layer** of the LOGOS architecture:

```
Layer 1: Renderer (React UI) - Shows study items to user
    |
Layer 2: IPC Bridge - Communicates between UI and main process
    |
Layer 3: Services (state-priority.service.ts) - Orchestrates priority decisions
    |
Layer 4: Algorithm Core (THIS MODULE) - Pure mathematical calculations
    |
Layer 5: Data Layer (transfer.ts, priority.ts) - Raw linguistic data
```

This module is **pure computation** with no side effects, no database access, and no state mutations. It receives inputs and returns outputs, making it highly testable and predictable.

### Big Picture Impact

The priority-transfer module enables **linguistically-aware adaptive learning**. Without it, LOGOS would have two significant problems:

1. **Wasted Study Time**: Learners would spend equal time on cognates (words nearly identical to their L1) and genuinely difficult vocabulary. A French speaker doesn't need 20 repetitions to learn "communication" - they need those repetitions for words with no L1 anchor.

2. **Missed Interference**: Some L1 patterns actually *hurt* L2 learning (negative transfer). Japanese SOV word order causes interference with English SVO structure. This module detects and increases priority for these interference-prone items.

**System-Wide Value**:
- Reduces average time-to-mastery by prioritizing true learning needs
- Improves learner motivation by reducing busywork on "easy" items
- Enables personalized recommendations based on linguistic background
- Provides explainable AI (every priority decision has a human-readable reason)

### Critical Path Analysis

**Importance Level**: High

This module is **optional but transformative**. The system can function without it (using base priority calculations), but learning efficiency would decrease significantly:

- **If this fails**: System falls back to language-agnostic priority, treating all learners identically
- **Failure mode**: Graceful degradation - no crashes, just less personalized learning
- **Performance impact**: Minimal - pure mathematical operations with O(1) complexity per item
- **Recovery**: No state to corrupt, simply restart with correct L1/L2 configuration

---

## Technical Concepts (Plain English)

### Transfer Coefficient

**Technical**: A numeric value from -1 to +1 representing the degree of linguistic similarity between two languages for a specific component (lexical, phonological, syntactic, etc.).

**Plain English**: A "similarity score" between your native language and the language you're learning. +1 means nearly identical (Dutch vocabulary to English), -1 means actively confusing (Japanese word order to English), and 0 means neutral (no help, no hurt).

**Why We Use It**: To quantify something language teachers know intuitively - that certain language pairs are easier to learn than others.

### Transfer Gain

**Technical**: A normalized 0-1 value representing the cost reduction from positive L1-L2 transfer, calculated by shifting the -1 to +1 transfer coefficient to a 0-1 scale.

**Plain English**: A "discount" on learning difficulty. A gain of 0.8 means this item is 80% easier for you because of your native language background, so the system can spend less time drilling it.

**Why We Use It**: The priority formula needs positive numbers, so we convert the raw similarity score into a "learning cost reduction" factor.

### Mastery Factor g(m) - Inverted U-Curve

**Technical**: A function based on Zone of Proximal Development theory that peaks priority at intermediate mastery (40-50%) and reduces it for both beginners (lack foundation) and advanced items (already mastered).

**Plain English**: The "Goldilocks Zone" for learning. Items you're just starting (too hard) and items you've mastered (too easy) get lower priority. Items in your learning sweet spot (challenging but achievable) get highest priority.

**Why We Use It**: Based on decades of educational psychology research - learners progress fastest on material that's slightly above their current level.

### Scaffolding Gap

**Technical**: The difference between a learner's performance with hints/cues versus without, indicating how much independent mastery has been achieved.

**Plain English**: The gap between "I can answer this with hints" and "I can answer this cold." A large gap means you're relying on training wheels and need more independent practice.

**Why We Use It**: Distinguishes genuine learning from pattern matching. Students who always need hints haven't truly internalized the material.

### Bottleneck Boost

**Technical**: A priority increase applied to items identified as prerequisite blockers, calculated via topological analysis of the learning dependency graph.

**Plain English**: Extra priority for foundational items that unlock other learning. If you can't learn "running" without knowing "run," then "run" gets a priority boost because it's blocking progress.

**Why We Use It**: Ensures learners build on solid foundations rather than accumulating gaps that compound over time.

### Batch Processing

**Technical**: Processing multiple items in a single function call with shared context to reduce redundant coefficient lookups and improve computational efficiency.

**Plain English**: Instead of looking up the German-English similarity table 500 times (once per word), we look it up once and apply it to all 500 words in bulk.

**Why We Use It**: Performance optimization. When processing thousands of vocabulary items, avoiding repeated lookups makes the system responsive.

---

## Change History

### 2026-01-05 - Initial Documentation

- **What Changed**: Created narrative documentation for priority-transfer module
- **Why**: Implementing Shadow Map documentation system for LOGOS codebase
- **Impact**: Enables future developers to understand the WHY behind transfer-adjusted priority calculations

---

## Formula Reference

The complete priority formula implemented in this module:

```
S_eff(w) = S_base(w) x g(m) x (1 + T_penalty) + Urgency + Bottleneck
```

Where:
- **S_base(w)**: Base FRE score (Frequency + Relational + Contextual weighted sum)
- **g(m)**: Mastery factor (inverted U-curve from ZPD theory)
- **T_penalty**: Transfer adjustment (-0.25 to +0.25 based on L1-L2 similarity)
- **Urgency**: Spaced repetition scheduling pressure
- **Bottleneck**: Dependency graph priority boost

And the cost formula:
```
Cost = BaseDifficulty - TransferGain + ExposureNeed
```

---

## Design Decisions

### Why Reduce Priority for High Transfer?

Counter-intuitive insight: Items that are *easier* to learn should have *lower* priority. The system optimizes for learning efficiency, not completion order. Cognates will be learned quickly regardless of study order, so the system focuses attention on items that genuinely need repetition.

### Why 0.25 as Transfer Weight?

The `TRANSFER_PRIORITY_WEIGHT = 0.25` constant was chosen to make transfer effects noticeable but not overwhelming. At 0.25, a maximum positive transfer reduces priority by 12.5%, while maximum negative transfer increases it by 12.5%. This keeps transfer as one factor among many, respecting frequency and urgency as primary drivers.

### Why Pure Functions?

All functions in this module are pure (no side effects, deterministic outputs). This design enables:
- Easy unit testing without mocks
- Parallel processing without race conditions
- Predictable debugging (same inputs always produce same outputs)
- Hot-reloading during development without state corruption
