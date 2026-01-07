# syntactic-construction.ts — Grammar Pattern Library and Type Definitions

## Why This Exists

A language learning system needs a structured representation of grammar. This file defines what a "syntactic construction" is and provides a curated library of 20+ English constructions organized by complexity, frequency, and prerequisites. Without this foundation, the system would have no grammar to teach, no way to know which patterns are harder than others, and no basis for sequencing lessons.

The construction library encodes decades of applied linguistics research into a machine-readable format that algorithms can reason about.

## Key Concepts

- **SyntacticConstruction**: The central data type representing a grammar pattern. Each construction includes:
  - Identity: `id`, `name`, `description`
  - Classification: `category` (clause_structure, verb_system, etc.), `clauseTypes`, `isCore`
  - Pattern: `pattern` notation (e.g., "S + V + O"), `examples`
  - Metrics: `complexity` (0-1), `frequency` (0-1 corpus-normalized)
  - Dependencies: `prerequisites`, `enablesLearning`
  - Pedagogy: `exemplarWords`, `components`, `cognitiveLoad`, `masteryRange`, `cefrLevel`
  - Error info: `commonErrors`, `l1Interference`

- **GrammarCategory**: Nine categories covering English grammar:
  - `clause_structure`: Basic sentence patterns (SVO, SVC, questions, negation)
  - `verb_system`: Tense, aspect, mood, voice
  - `nominal_system`: Articles, determiners, quantifiers
  - `modification`: Adjectives, adverbs, relative clauses
  - `coordination`: Conjunctions, compound structures
  - `subordination`: Complex sentences, embedded clauses
  - `information_structure`: Focus, topic, clefts
  - `special_constructions`: Existential, conditional, comparative

- **CognitiveLoadMetrics**: Five-dimension cognitive load model (each 1-5 scale):
  - `processingLoad`: Real-time parsing difficulty
  - `memoryDemand`: Working memory requirements
  - `attentionRequired`: Focus needed during use
  - `integrationComplexity`: How many rules must combine
  - `transferDifficulty`: Applying to new contexts

- **CORE_CONSTRUCTIONS**: The library itself, organized into 5 levels:
  - Level 1 (A1): Basic clauses - SVO, SV, SVC, yes/no questions, negation
  - Level 2 (A1-A2): Verb basics - present simple/continuous, past simple, future will
  - Level 3 (A2-B1): Complex structures - present perfect, passive, wh-questions, relative clauses
  - Level 4 (B1-B2): Advanced - conditionals (1st, 2nd), reported speech, existential there
  - Level 5 (B2-C1): Complex subordination - embedded questions, it-clefts, 3rd conditional, participle clauses

## Design Decisions

**Prerequisites form a DAG, not arbitrary dependencies**. Each construction lists only its direct prerequisites; the `getAllPrerequisites()` function computes transitive closure. This keeps the data clean and makes cycle detection straightforward.

**Cognitive load uses five dimensions instead of one**. A construction might be easy to process but hard to transfer (e.g., simple present). Another might demand high memory but low attention (e.g., passive voice patterns). The five dimensions capture these trade-offs; `calculateTotalCognitiveLoad()` averages them for a single score when needed.

**L1 interference is optional and language-keyed**. Not every construction has interference notes, but where common L1 transfer errors are documented (e.g., Japanese SOV transfer into English SVO), they're captured per-language. This enables future L1-aware instruction.

**Frequency is corpus-normalized (0-1) not raw counts**. This makes frequency comparable across constructions without needing to know corpus size. The values come from pedagogical frequency studies, not raw BNC/COCA counts.

**Exemplar words link grammar to vocabulary**. Each construction lists words commonly used with that pattern. This enables the system to select vocabulary that reinforces currently-learning constructions.

**The library is a const Record, not a class**. Constructions are static reference data, not runtime objects with behavior. A plain record is simplest and enables direct property access (`CORE_CONSTRUCTIONS.svo_basic`).

## Integration Points

- **Imports from `core/types`**: `ComponentType` and `MasteryStage` for typing construction fields.

- **Consumed by `grammar-sequence-optimizer.ts`**: The optimizer imports constructions, types, and utilities to build learning sequences.

- **Exported via `index.ts`**: All types, the construction library, and query functions are re-exported as the module's public API.

- **Used by vocabulary services**: The `exemplarWords` field links grammar constructions to vocabulary selection. When a learner is working on present perfect, words like "have", "been", "done" get boosted.

- **Used by task generation**: The `commonErrors` and `l1Interference` fields inform error correction and fill-in-the-blank task design.

- **Used by mastery tracking**: `ConstructionMasteryState` type is used by services to track per-construction progress including recognition/production accuracy and error history.
