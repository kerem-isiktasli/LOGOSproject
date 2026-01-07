# grammar-sequence-optimizer.ts — Optimal Learning Path Generation

## Why This Exists

Language learners need to acquire grammar constructions in a sensible order, but determining that order is non-trivial. Some patterns must be learned before others (prerequisites), some are more frequent and thus more valuable early, and learners have limited cognitive capacity per session. This module solves the sequencing problem by computing optimal learning paths that respect prerequisites, prioritize high-value constructions, and avoid cognitive overload.

The algorithm addresses Gap 4.1 from GAPS-AND-CONNECTIONS.md: without intelligent sequencing, learners either face constructions they lack the foundation for, or waste time on rare patterns when common ones remain unlearned.

## Key Concepts

- **ScoredConstruction**: A construction paired with a priority score (0-100+) and breakdown of why it scored that way. Includes frequency, complexity, prerequisite count, mastery state, and cognitive load subscores. Also tracks whether all prerequisites are satisfied (`readyToLearn`).

- **SequenceOptimizationConfig**: Controls the optimizer's behavior:
  - `targetLevel`: CEFR ceiling (A1-C2)
  - `maxCognitiveLoad`: Session intensity limit (1-5 scale)
  - `frequencyFirst`: Whether to prioritize common patterns over simple ones
  - `masteryStates`: Existing learner progress to avoid redundant sequencing

- **GrammarSessionPlan**: Groups constructions into time-bounded sessions respecting cognitive load limits. Each session gets ~15 minutes per construction and recommended task types.

- **Topological Sort with Priority**: The core algorithm uses Kahn's algorithm to respect prerequisites while selecting the highest-priority available construction at each step. Handles cycles gracefully by falling back to pure priority ordering.

- **Syntactic Priority Score**: Computes how valuable a word is for grammar learning based on which constructions it exemplifies and the learner's current mastery of those constructions.

## Design Decisions

**Priority scoring uses additive components (not multiplicative)**. A construction can score high even if one factor is weak. This prevents "zero-out" situations where a single poor metric kills an otherwise good candidate. The weights are: frequency (0-30), complexity-inverse (0-25), prerequisite-count-inverse (0-20), mastery-gap (0-15), cognitive-load-inverse (0-10), plus bonuses for core constructions (+10) and frequency-first mode (+50% frequency).

**Session planning uses a greedy bin-packing approach**. Constructions are added to the current session until time or cognitive load limits are exceeded, then a new session starts. This is simple but effective because constructions are already in optimal order from the topological sort.

**The frequency-first toggle exists because learner goals differ**. Someone preparing for a conversation-heavy trip benefits from frequent patterns; someone studying for academic writing benefits from building complexity foundations first.

**Mastery stage filtering prevents repetition**. Constructions already at stage 4 (mastered) are deprioritized. Constructions at stages 1-3 get a 1.5x boost to syntactic priority calculations because active learning constructions benefit from reinforcement.

## Integration Points

- **Imports from `syntactic-construction.ts`**: The entire construction library (`CORE_CONSTRUCTIONS`), type definitions (`SyntacticConstruction`, `GrammarLearningSequence`, etc.), and utilities (`getAllPrerequisites`, `calculateTotalCognitiveLoad`).

- **Imports from `core/types`**: `MasteryStage` type for tracking learner progress stages (0-4).

- **Consumed by task generation**: The `taskTypes` array in session plans drives which exercise types get created. Categories map to tasks: verb_system -> tense_transformation, modification -> sentence_combining, etc.

- **Used by vocabulary integration**: `computeSyntacticPriority()` is designed to be called when ranking vocabulary items, boosting words that appear as exemplars in constructions the learner is actively working on.

- **Exported via `index.ts`**: The class, factory function (`createGrammarOptimizer`), and convenience helpers (`generateGrammarSequence`, `getConstructionsForStage`) are all re-exported for external consumption.
