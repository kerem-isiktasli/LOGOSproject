# component-object-state.ts — Unified Learning State for Language Components

## Why This Exists

Language learning involves tracking many dimensions simultaneously: vocabulary exposure, grammar pattern recognition, pronunciation practice, and more. Without a unified state model, the system would fragment into disconnected tracking systems that cannot inform each other. This module provides a comprehensive data structure that captures everything the system needs to know about a learner's relationship with any language component—from raw exposure counts to sophisticated cognitive metrics like automation level and transfer effects.

This directly implements Gap 4.3 from the project's GAPS-AND-CONNECTIONS specification, which identified the need for a "Component-Object State Dictionary" that spans all language domains.

## Key Concepts

- **LanguageComponent**: Categorizes learning items into five domains: grapheme-phoneme correspondence (g2p), morphology, vocabulary, grammar, and pragmatics. This taxonomy ensures the system can apply domain-appropriate learning strategies.

- **TaskPhase**: Distinguishes between learning (initial introduction), training (deliberate practice), and evaluation (assessment) phases. Each phase serves different pedagogical purposes and generates different metrics.

- **ExposurePattern**: A timestamped record of each interaction with a learning item, capturing task type, modality (visual/auditory/mixed), success outcome, response time, and scaffolding level used.

- **CognitiveInduction**: Tracks the transition from explicit to implicit knowledge through metrics like automation level (how automatic the knowledge has become), usage space expansion (diversity of contexts mastered), and procedural fluency (speed/accuracy in real-time use).

- **IRTMetrics**: Item Response Theory parameters including theta estimate (learner ability), difficulty calibration, discrimination index, and standard error. These enable adaptive difficulty selection.

- **TransferEffects**: Maps how learning one item affects others—positive transfer (learning "un-" helps with "undo", "unfair"), negative interference (false friends between languages), and cross-component transfer (vocabulary knowledge aiding grammar acquisition).

- **FeatureVector**: Static properties of the learning item encoded as z(w): frequency (F), relational density (R), domain distribution (D), morphological complexity (M), and phonological difficulty (P).

- **ComponentObjectState**: The master interface that aggregates all the above into a single trackable entity with full exposure history, cognitive metrics, relations, and mastery state.

## Design Decisions

**Immutable Update Functions**: All state modification functions (`recordExposure`, `updateIRTMetrics`, etc.) return new state objects rather than mutating in place. This enables time-travel debugging, undo functionality, and safe concurrent access.

**Exponential Moving Average for Metrics**: Accuracy and performance metrics use EMA with alpha=0.1, giving 90% weight to historical data. This smooths out noise from individual responses while remaining responsive to genuine changes in learner ability.

**Capped Exposure History**: The `exposurePattern` array keeps only the last 100 entries (via `.slice(-99)`). This bounds memory usage while preserving enough history for trend analysis.

**Scaffolding Gap as First-Class Metric**: The difference between cue-assisted and cue-free accuracy (`scaffoldingGap`) is explicitly tracked because it reveals knowledge that exists but has not yet been internalized—a key signal for choosing appropriate practice tasks.

**Bounded Theta Estimates**: The IRT theta parameter is clamped to [-3, 3] with diminishing returns near bounds. This prevents runaway estimates from outlier responses.

## Integration Points

- **`../types`**: Imports `MasteryStage`, `ComponentType`, and `TaskModality` type definitions that standardize values across the system.

- **`../content/pedagogical-intent`**: Uses `PedagogicalIntent` to track accuracy broken down by learning goal (introduction, reinforcement, assessment, etc.).

- **`../tasks/traditional-task-types`**: References `TraditionalTaskType` to record which exercise format produced each exposure.

- **`./component-search-engine`**: The search engine imports this module's types and utility functions to enable filtering and sorting across the entire component state collection.

- **FSRS Integration**: The `masteryState.fsrsState` optional field bridges to the Free Spaced Repetition Scheduler algorithm, allowing this state to drive spaced repetition scheduling.

- **Priority Calculation**: The `calculateEffectivePriority` function synthesizes goal context, review urgency, automation needs, and transfer value into a single priority score used by task selection algorithms.
