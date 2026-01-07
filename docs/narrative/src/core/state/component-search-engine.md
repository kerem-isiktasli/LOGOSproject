# component-search-engine.ts — Query Interface for Learning State Collections

## Why This Exists

A language learner's state contains thousands of tracked items across vocabulary, grammar, phonology, and more. Without efficient querying, the system would need to scan every item for every decision—what to review next, which items are bottlenecks, what concepts cluster together. This search engine provides indexed access to component states with rich filtering, sorting, grouping, and graph traversal capabilities. It powers the dictionary views, network visualizations, and priority lists that drive both the learner-facing UI and the internal scheduling algorithms.

## Key Concepts

- **Triple Indexing Strategy**: The engine maintains three parallel indexes: a primary `states` Map (objectId to state), a `componentIndex` (language component to set of objectIds), and a `contentIndex` (tokenized content words to set of objectIds). This enables O(1) lookup by ID and fast narrowing by component or text search.

- **SearchFilters**: A comprehensive filter interface supporting component type, text query, minimum priority, mastery stages, automation level range, recency of exposure, review status, context emphasis, domain tags, relation presence, and transfer value thresholds.

- **SortOption**: Seven ordering strategies—priority (composite score), frequency (corpus commonality), mastery (stage level), recency (last exposure), alphabetical, automation (procedural fluency), and bottleneck (blocking other learning).

- **GroupOption**: Organizes results by category, domain, difficulty tier, mastery stage, or language component for grouped display.

- **PriorityListItem**: Wraps a state object with its computed priority score, a human-readable reason for prioritization, and a recommended task type—ready for display in a "what to study next" interface.

- **NetworkGraphView**: Represents relationships between learning items as nodes and edges for visualization. Nodes encode component type, importance (size), and mastery (color). Edges capture collocations, morphological families, semantic similarity, syntactic patterns, and prerequisite chains.

## Design Decisions

**Class-Based Engine with Encapsulated State**: Unlike the pure-function approach in `component-object-state.ts`, the search engine uses a class to encapsulate mutable index structures. This is appropriate because the engine is a service layer that maintains derived data structures (indexes) that must stay synchronized with the source data.

**Tokenization for Content Search**: Content is split on whitespace and tokens under 2 characters are discarded. This simple approach works well for language learning content (words, short phrases) without the overhead of a full-text search engine.

**BFS for Network Graph Construction**: The `buildNetworkGraph` method uses breadth-first search from a center object to collect related items up to a specified depth. This produces a bounded, focused subgraph suitable for visualization without loading the entire relationship network.

**Color-Coded Mastery Stages**: The private `getMasteryColor` method maps stages 0-4 to a red-orange-yellow-green-blue progression. This provides immediate visual feedback in network graphs about which areas need attention.

**Factory Functions for Convenience**: `createSearchEngine()` and `createSearchEngineWithData()` provide clean instantiation patterns, supporting both empty initialization and bulk loading scenarios.

**Performance Timing**: Search results include `searchDuration` in milliseconds, enabling performance monitoring and optimization decisions.

## Integration Points

- **`./component-object-state`**: Imports the `ComponentObjectState` type and utility functions (`needsReview`, `isAutomized`, `getBottleneckScore`, `calculateEffectivePriority`) to power filtering and sorting logic.

- **`../types`**: Uses `MasteryStage` for type-safe stage filtering.

- **UI Components**: The `SearchResult`, `GroupedSearchResult`, and `NetworkGraphView` types are designed as DTOs (Data Transfer Objects) ready for direct consumption by React components rendering dictionary views, grouped lists, and force-directed graphs.

- **Task Selection Algorithms**: The `generatePriorityList` method returns task recommendations alongside priority scores, bridging state queries to the task generation pipeline.

- **Statistics Aggregation**: The `getStatistics` method provides dashboard-ready metrics: total objects, counts by component, counts by mastery stage, items needing review, and items not yet automated.
