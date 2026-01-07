# Multi-Object Calibration Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/multi-object-calibration.service.ts`
> **Status**: Active

---

## Context & Purpose

This service exists to solve a fundamental limitation in traditional language learning systems: they treat vocabulary items as isolated units, measuring only whether a learner "knows" a single word. Real language competence, however, involves the **simultaneous deployment of multiple linguistic skills** when producing or comprehending even a single sentence.

Consider a learner attempting to say "The committee has decided to postpone the meeting." This single utterance requires:
- **Lexical knowledge**: knowing "committee," "decided," "postpone," "meeting"
- **Morphological awareness**: using "has decided" (present perfect), not "have decided"
- **Syntactic competence**: proper word order and clause structure
- **Pragmatic sensitivity**: appropriate register for formal communication

The Multi-Object Calibration Service addresses this reality by implementing **Within-Item Multidimensional Item Response Theory (MIRT)**. Instead of asking "did they get it right?", it asks "which specific linguistic components did they handle correctly, and how should we update our model of their abilities across all five dimensions?"

**Business Need**: LOGOS requires psychometrically sound ability estimation that reflects the true multidimensional nature of language proficiency. Without this, the adaptive algorithm cannot:
1. Accurately identify which specific skills need remediation
2. Generate appropriately targeted practice tasks
3. Provide component-specific feedback to accelerate learning

**When Used**: This service processes every task response where multiple linguistic components are engaged. It is invoked after the user submits a response to any production, transformation, or complex recognition task. Single-word recognition tasks may bypass this service in favor of the simpler `scoring-update.service.ts`.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**Database Layer:**
- `src/main/db/prisma.ts`: getPrisma() - Provides database connection for reading/writing mastery states and sessions
- `src/main/db/repositories/mastery.repository.ts`:
  - updateMasteryState() - Persists updated accuracy and stage information
  - recordExposure() - Logs that the learner encountered this object
  - updateFSRSParameters() - Updates spaced repetition scheduling
  - transitionStage() - Handles promotion/demotion between mastery stages (0-4)
- `src/main/db/repositories/session.repository.ts`:
  - recordResponse() - Logs the raw response data
  - applyThetaRules() - Persists theta (ability) changes to the session
- `src/main/db/repositories/goal.repository.ts`:
  - updateObjectPriority() - Adjusts learning priority based on new mastery state

**Service Layer:**
- `src/main/services/state-priority.service.ts`:
  - calculateEffectivePriority() - Computes new priority from FRE metrics and mastery
  - calculateMasteryAdjustment() - Derives priority modifier from stage/accuracy
  - calculateUrgencyScore() - Factors in FSRS due dates

**Type System:**
- `src/core/types.ts`: All type definitions including:
  - ComponentCode, CognitiveProcess, MultiObjectTarget
  - QMatrixEntry, UserThetaProfile, MasteryStage
  - DEFAULT_Q_MATRIX, COGNITIVE_PROCESS_MULTIPLIERS

### Dependents (What Needs This)

- `src/main/services/task-generation.service.ts`: Uses `createMultiObjectTaskSpec()` to build task specifications that will be processed by this service
- `src/main/services/scoring-update.service.ts`: May delegate to this service for multi-component tasks via `shouldUseMultiObjectProcessing()` check
- `src/main/ipc/session.ipc.ts`: IPC handlers call `processMultiObjectResponse()` when processing learner submissions
- `src/renderer/components/TaskFeedback.tsx`: Consumes the `MultiComponentEvaluation` feedback strings for UI display

### Data Flow

```
User Response Submitted
        |
        v
+----------------------------------+
| processMultiObjectResponse()     |
+----------------------------------+
        |
        |-- 1. Fetch Session & Theta Profile from DB
        |
        v
+----------------------------------+
| evaluateMultiComponentResponse() |
| (Per-component correctness)      |
+----------------------------------+
        |
        v
+------------------------------------------+
| calculateMultiComponentThetaContributions |
| (MIRT probability -> theta deltas)        |
+------------------------------------------+
        |
        v
+----------------------------------+
| aggregateThetaContributions()    |
| (Merge per-component to profile) |
+----------------------------------+
        |
        |-- Write theta to Session (applyThetaRules)
        |
        v
+----------------------------------+
| For Each Target Object:          |
|   - recordExposure()             |
|   - updateMasteryState()         |
|   - transitionStage()            |
|   - updateFSRSParameters()       |
|   - updateObjectPriority()       |
+----------------------------------+
        |
        v
+----------------------------------+
| generateMultiComponentFeedback() |
+----------------------------------+
        |
        v
  Return MultiObjectResponseOutcome
```

---

## Macroscale: System Integration

### Architectural Layer

This service operates at **Layer 3: Scoring + Update** in the LOGOS three-layer learning pipeline:

```
Layer 1: Selection           Layer 2: Generation         Layer 3: Scoring + Update
+-------------------+       +-------------------+       +-------------------------+
| state-priority    |  -->  | task-generation   |  -->  | scoring-update          |
| fluency-versatil  |       | claude.service    |       | multi-object-calibration| <-- You are here
| diagnostic-assess |       |                   |       |                         |
+-------------------+       +-------------------+       +-------------------------+
```

The service sits at the **convergence point** where all task responses flow for processing. It is the system's "measurement engine" - transforming raw learner behavior into calibrated psychometric signals.

### Big Picture Impact

**Without this module, LOGOS loses:**

1. **Multidimensional Ability Tracking**: The system would collapse to a single "correctness" metric, losing the ability to distinguish between a learner who struggles with morphology vs. one who struggles with pragmatics.

2. **Component-Targeted Remediation**: Task generation would be blind to which specific skills need work, generating generic practice instead of precision-targeted exercises.

3. **Accurate Difficulty Calibration**: The Q-matrix weight allocation ensures that when a learner fails a complex task, we attribute the failure appropriately across components rather than penalizing all abilities equally.

4. **Scaffolding Gap Detection**: By tracking cue-free vs. cue-assisted accuracy per component, the system knows when a learner can perform with help but not independently - the exact signature of productive difficulty.

5. **Psychometric Validity**: The compensatory MIRT model provides theoretically grounded probability estimation that aligns with decades of psychometric research on multidimensional ability structures.

### Critical Path Analysis

**Importance Level**: Critical

**If This Fails:**
- Response processing halts for all multi-component tasks
- Mastery states become stale (no updates)
- Theta estimates drift from true ability
- FSRS scheduling becomes unreliable (wrong review dates)
- Learning efficiency degrades significantly

**Failure Modes:**
1. Database transaction failure: All updates rolled back, user sees error but no data corruption
2. Theta calculation error: Bounded by `boundaryDecay` factor, preventing runaway estimates
3. FSRS update failure: Non-critical, logged and skipped (scheduling recovers on next response)

**Recovery Strategy**: The service uses atomic transactions for critical updates. Non-critical operations (error analysis, bottleneck detection) are fire-and-forget with error logging.

---

## Technical Concepts (Plain English)

### Q-Matrix Weight Allocation

**Technical**: A Q-matrix is a binary or weighted specification matrix from Cognitive Diagnostic Modeling (CDM) that maps items (tasks) to attributes (skills). In LOGOS, the Q-matrix assigns weights to each linguistic component based on how much that component contributes to task success.

**Plain English**: Imagine a cooking recipe that lists ingredients and their proportions. A Q-matrix is like that recipe, but for learning tasks. It says "this sentence-writing task requires 35% syntax skill, 30% vocabulary, 20% pragmatic awareness, and 15% morphology." When evaluating performance, we use these proportions to figure out which skills to credit or blame.

**Why We Use It**: Different tasks test different combinations of skills. A vocabulary recognition task is mostly about knowing words (LEX: 70%), while a register-shift task is primarily about social appropriateness (PRAG: 50%). The Q-matrix lets us handle this diversity systematically rather than treating all tasks as equivalent.

### Compensatory MIRT Model

**Technical**: The Compensatory Multidimensional Item Response Theory model calculates the probability of a correct response as a logistic function of weighted ability parameters across multiple dimensions: P(X=1|theta) = sigma(sum(a_i * theta_i) + d), where a_i are discrimination parameters, theta_i are ability estimates, and d is the difficulty intercept.

**Plain English**: Think of it like calculating your chances of winning a triathlon. You might be a strong swimmer but weak runner. In a "compensatory" model, being exceptionally good at swimming can partially make up for being slow at running. The formula weights each skill by how important it is for that particular race, then combines them to predict your overall chance of success.

**Why We Use It**: Real language use is compensatory - a learner with exceptional vocabulary can sometimes compensate for weaker grammar by choosing simpler sentence structures. This model captures that reality, unlike "all-or-nothing" models that require mastery of every single component.

### Conjunctive vs. Disjunctive Models

**Technical**: Alternative interaction models from CDM. Conjunctive (DINA-like) requires mastery of ALL specified attributes for success. Disjunctive (DINO-like) requires mastery of ANY specified attribute.

**Plain English**:
- **Conjunctive** (like a chain): The chain is only as strong as its weakest link. You must master every required skill. Example: morphological word formation - you cannot form "unhappiness" correctly if you don't know both the prefix "un-" AND the suffix "-ness".
- **Disjunctive** (like multiple paths): Any working path leads to success. Example: error correction - you might spot the grammar mistake OR the spelling mistake OR the vocabulary error.

**Why We Use It**: Different task types have fundamentally different success structures. Word formation is conjunctive (all pieces needed), while error detection is disjunctive (any detection counts). The system selects the appropriate model per task type.

### Boundary Decay for Theta Updates

**Technical**: A multiplicative factor (1 - |theta|/3) that reduces the magnitude of theta updates as estimates approach the boundaries of the ability scale [-3, +3].

**Plain English**: Imagine a thermostat that becomes less responsive as the temperature approaches extreme values. Near -3 or +3 (the edges of our ability scale), we become more conservative with updates because: (1) extreme estimates are more likely to be measurement artifacts, and (2) we want to prevent "runaway" estimates that exceed the meaningful range.

**Why We Use It**: Without boundary decay, a series of lucky guesses could push theta to +5 or higher, which has no meaningful interpretation and distorts future probability calculations. The decay ensures stable, interpretable estimates.

### Levenshtein-Based Partial Credit

**Technical**: String similarity calculated as 1 - (edit_distance / max_length), where edit distance is the minimum number of insertions, deletions, or substitutions needed to transform one string into another.

**Plain English**: If the correct answer is "happiness" and the learner writes "happyness", we count how many letter changes are needed to fix it (1 change: y->i). Fewer changes mean the answer was "closer" and deserves partial credit. It's like grading a spelling test where "almost right" earns more than "completely wrong".

**Why We Use It**: Binary right/wrong scoring discards valuable information. A learner who writes "happyness" understands the concept but has a spelling gap - very different from someone who writes "chair". Partial credit captures this nuance and provides smoother, more informative feedback to the adaptive algorithm.

### FSRS Integration

**Technical**: Free Spaced Repetition Scheduler parameters (Difficulty, Stability, Retrievability) are updated based on response quality, using ratings 1-4 mapped from correctness and partial credit scores.

**Plain English**: FSRS is like a personal assistant that remembers when you last studied something and predicts when you'll forget it. When you get something right easily, it schedules the next review further out. When you struggle, it schedules sooner. This service feeds each response into FSRS so the scheduling stays optimized.

**Why We Use It**: Optimal learning requires reviewing material at the right time - not too soon (wasted effort) and not too late (forgotten). FSRS provides mathematically optimized scheduling that adapts to each learner's actual retention patterns.

---

## Theoretical Foundations

This service implements concepts from four foundational research papers:

### Within-Item MIRT (Hartig & Hohler, 2008)
The core insight that a single test item can measure multiple latent abilities simultaneously. LOGOS applies this by recognizing that a single sentence production task simultaneously exercises vocabulary, grammar, and pragmatic skills - and we can estimate all three from one response.

### Compensatory MIRT (Reckase, 1985)
The mathematical model for combining multiple ability dimensions into a single response probability. The logistic formulation allows partial compensation between abilities while still respecting the difficulty and discrimination characteristics of individual items.

### G-DINA Cognitive Diagnostic Model (de la Torre, 2011)
The framework for specifying which attributes (skills) are required by which items (tasks). The Q-matrix concept comes from CDM, adapted here to specify continuous weights rather than binary requirements, allowing more nuanced attribution of success and failure.

### Multivariate Elo (Pelanek, 2016)
The approach to updating multiple ability estimates simultaneously from a single observation. The Elo-inspired update formula (delta = K * weight * (observed - expected)) provides a computationally efficient alternative to full maximum likelihood estimation while maintaining reasonable accuracy.

---

## Change History

### 2026-01-06 - Initial Implementation
- **What Changed**: Created multi-object calibration service with full MIRT pipeline
- **Why**: LOGOS requires multidimensional ability tracking to provide component-specific feedback and targeted practice generation
- **Impact**: Enables simultaneous theta updates across all 5 linguistic components (PHON, MORPH, LEX, SYNT, PRAG) from single task responses

### Key Implementation Decisions

1. **Chose Compensatory as Default Model**: Most language tasks allow partial compensation between skills. Conjunctive and disjunctive models are available for specific task types where appropriate.

2. **Weight Normalization to 1.0**: All target object weights sum to 1.0, ensuring theta contributions are properly scaled regardless of how many objects appear in a task.

3. **Primary Target Minimum 50%**: Design decision to ensure the main learning target always contributes at least half the signal, preventing secondary context words from dominating.

4. **Boundary Decay Factor**: Prevents theta estimates from exceeding [-3, +3] range, maintaining psychometric interpretability.

5. **Fire-and-Forget for Non-Critical Operations**: Bottleneck detection and error analysis run asynchronously and won't block response processing if they fail.

---

## References

- Hartig, J., & Hohler, J. (2008). Representation of Competencies in Multidimensional IRT Models with Within-Item and Between-Item Multidimensionality. *Zeitschrift fur Psychologie*, 216(2), 89-101.
- Reckase, M. D. (1985). The Difficulty of Test Items That Measure More Than One Ability. *Applied Psychological Measurement*, 9(4), 401-412.
- de la Torre, J. (2011). The Generalized DINA Model Framework. *Psychometrika*, 76(2), 179-199.
- Pelanek, R. (2016). Applications of the Elo Rating System in Adaptive Educational Systems. *Computers & Education*, 98, 169-179.
