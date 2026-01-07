# index.ts — Grammar Module Public API

## Why This Exists

The grammar module has two implementation files with over 30 exports between them. Without a central index, consumers would need to know which specific file contains each type or function. This index provides a single import point that exposes the complete public API while hiding internal organization details.

This pattern also enforces deliberate API design: only what appears in index.ts is considered stable public interface. Internal helpers that might change stay private to their implementation files.

## Key Concepts

- **Type Exports**: All grammar-related types are re-exported with the `type` keyword for TypeScript consumers:
  - `GrammarCategory`, `ClauseType`, `SyntacticFunction`: Enums for classification
  - `CognitiveLoadMetrics`, `SyntacticConstruction`: Core data structures
  - `GrammarLearningSequence`, `ConstructionMasteryState`: Learning state types
  - `SequenceOptimizationConfig`, `ScoredConstruction`, `SequenceOptimizationResult`, `GrammarSessionPlan`: Optimizer types

- **Construction Library**: `CORE_CONSTRUCTIONS` is the readonly record containing all 20+ grammar patterns with their metadata.

- **Query Functions**: Utilities for filtering the construction library:
  - `getConstructionsByCategory()`: Filter by grammar category
  - `getConstructionsForLevel()`: Get constructions up to a CEFR level
  - `getCoreConstructions()`: Get only essential constructions
  - `getConstructionsByComplexity()`: Filter by complexity range
  - `getAllPrerequisites()`: Recursively get all prerequisites for a construction
  - `calculateTotalCognitiveLoad()`: Compute average cognitive load score

- **Optimizer Exports**: The sequence optimizer and its factory:
  - `GrammarSequenceOptimizer`: The main class
  - `createGrammarOptimizer()`: Factory with optional config
  - `generateGrammarSequence()`: One-liner convenience function
  - `getConstructionsForStage()`: Get constructions appropriate for a mastery stage

## Design Decisions

**All exports are explicit, not re-exported with `*`**. This prevents accidental exposure of internal helpers and makes the API surface self-documenting. Anyone reading index.ts immediately sees the complete public interface.

**Types use `export type` syntax**. This enables proper tree-shaking and makes clear which exports are runtime values vs. compile-time only.

**Two source files, one module**. The split between `syntactic-construction.ts` (data + queries) and `grammar-sequence-optimizer.ts` (algorithms) reflects separation of concerns, but consumers see a unified module.

## Integration Points

- **From `syntactic-construction.ts`**: All type definitions, the `CORE_CONSTRUCTIONS` library, and query/utility functions.

- **From `grammar-sequence-optimizer.ts`**: The optimizer class, configuration types, result types, and factory functions.

- **Consumed by services layer**: Main process services import from `@/core/grammar` to generate learning sequences and compute syntactic priorities.

- **Consumed by IPC handlers**: Handlers use this module to expose grammar sequencing to the renderer process.

- **Implements Gap 4.1**: The module header explicitly references this as the implementation of the Grammar Organization Algorithm from the project's gap analysis.
