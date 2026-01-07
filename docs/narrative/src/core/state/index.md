# index.ts — State Module Public API

## Why This Exists

The state module contains complex type hierarchies and numerous functions spread across multiple files. Without a controlled export surface, consumers would need to know the internal file structure and import from specific paths that might change during refactoring. This index file serves as the module's public API contract—it explicitly declares what is part of the stable interface versus internal implementation details. Consumers import from `core/state` and receive exactly what they need.

This pattern also enables tree-shaking: bundlers can analyze the explicit export list to exclude unused code from production builds.

## Key Concepts

- **Type-Only Exports**: TypeScript's `type` keyword in exports signals that these are compile-time-only constructs. Types like `LanguageComponent`, `TaskPhase`, `CognitiveInduction`, and `ComponentObjectState` describe shapes but generate no runtime code.

- **Two Export Groups**: The file is organized into two logical sections mirroring the module's two source files:
  1. Component Object State (types and functions for individual learning item state)
  2. Component Search Engine (types and class for querying collections)

- **Function Exports**: Alongside types, the index exports factory and utility functions: `createComponentObjectState`, `recordExposure`, `updateIRTMetrics`, `updateCognitiveInduction`, `updateMasteryState`, `addRelation`, `calculateEffectivePriority`, `needsReview`, `isAutomized`, `getBottleneckScore`, `createSearchEngine`, and `createSearchEngineWithData`.

## Design Decisions

**Explicit Over Implicit**: Rather than using `export * from './component-object-state'`, each export is listed individually. This prevents accidentally exposing internal helpers and makes the public API self-documenting.

**Grouped by Source File**: The export statements preserve their origin (`./component-object-state` vs `./component-search-engine`), making it easy to trace back to implementation details when needed.

**Class Export**: `ComponentSearchEngine` is exported as a concrete class rather than just an interface. This allows consumers to instantiate it directly or extend it, while the factory functions provide a simpler entry point for common cases.

**Gap 4.3 Reference**: The module header comment explicitly references "Gap 4.3: Component-Object State Dictionary" from the project's requirements specification, maintaining traceability from implementation back to design documents.

## Integration Points

- **`./component-object-state`**: All core types and state manipulation functions for tracking individual learning items.

- **`./component-search-engine`**: The search engine class, query types, and result types for collection-level operations.

- **Consumer Modules**: Any part of the system that needs to work with learning state imports from this index:
  - Task selection algorithms import `ComponentObjectState` and `calculateEffectivePriority`
  - Dictionary UI components import `SearchFilters`, `SearchResult`, and `ComponentSearchEngine`
  - Network visualization imports `NetworkGraphView`, `NetworkNode`, `NetworkEdge`
  - Spaced repetition scheduling imports `MasteryStateSummary` and `needsReview`
  - Progress tracking imports `CognitiveInduction` and `IRTMetrics`

- **Package Boundary**: This file effectively defines the `@logos/core/state` package boundary—everything exported here is public, everything else in the directory is implementation detail.
