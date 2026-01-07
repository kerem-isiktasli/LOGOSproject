# Services Index - Learning Engine Hub

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/index.ts`
> **Status**: Active

---

## Why This Exists

LOGOS implements a sophisticated adaptive learning engine with multiple interconnected algorithms: Item Response Theory (IRT) for learner ability estimation, FSRS for spaced repetition scheduling, PMI for vocabulary relationship analysis, and Claude AI for content generation. Each of these capabilities is implemented in separate service modules with dozens of types and functions.

This index file serves as the **central nervous system** of the learning engine - a single import point that organizes and re-exports all service functionality. Without it, other parts of the codebase would need to import from 10+ different files, leading to:

- Import statement bloat
- Difficult refactoring when service locations change
- Unclear picture of available capabilities
- Missing or inconsistent exports

**Business Impact**: Development velocity. When building new features, developers consult this one file to discover available services, types, and functions. The organized structure (by layer and purpose) makes the learning engine's architecture immediately visible.

---

## Key Concepts

### Three-Layer Learning Pipeline

**Technical Definition**: LOGOS implements a three-layer architecture for adaptive learning:
1. **Layer 1 (State + Priority)**: Computes learner ability (theta) and determines which items to study next
2. **Layer 2 (Task Generation)**: Creates appropriate exercises based on mastery level and learning mode
3. **Layer 3 (Scoring + Update)**: Evaluates responses and updates mastery states

**Plain English**: Think of a personal tutor who (1) assesses what you know and picks the right topic, (2) creates a quiz question at the right difficulty, and (3) grades your answer and updates their notes about your progress. These three steps repeat continuously.

### Fluency vs Versatility Balance

**Technical Definition**: Phase 3.4 of the learning system distinguishes between fluency tasks (rapid, automatic recall of known items) and versatility tasks (transfer and application to new contexts). The system dynamically balances these based on learner progress.

**Plain English**: Like learning piano - sometimes you practice scales (fluency) to build speed and muscle memory, other times you learn new songs (versatility) to apply skills in fresh contexts. LOGOS automatically adjusts this balance based on your progress.

### Corpus Pipeline

**Technical Definition**: The corpus pipeline service fetches vocabulary from multiple sources (Wikipedia, Wiktionary, PubMed, user uploads, Claude AI generation), extracts and deduplicates items, computes linguistic metrics (PMI, morphological complexity, phonological difficulty), and populates the database.

**Plain English**: When you create a learning goal like "medical English vocabulary," this system goes shopping across the internet and AI to find relevant words, removes duplicates, measures how difficult each word is, and stocks your personal learning library.

### Offline Queue

**Technical Definition**: A queuing system that captures operations requiring Claude API calls (task generation, error analysis, content creation) and executes them when connectivity is available. Failed operations are retried with exponential backoff.

**Plain English**: Like a post office that holds your letters during a storm and delivers them when the roads clear. If you're studying offline or Claude's API is down, your learning continues - AI-enhanced features catch up when connectivity returns.

---

## Design Decisions

### Why Export Types Alongside Functions?

Each service section exports both types (interfaces, type aliases) and functions together. This enables consumers to import everything they need from a single source.

**Alternative Considered**: Separate type exports from a `types.ts` file. Rejected because it splits related concepts and creates more import statements.

### Why Organize by Pipeline Layer?

The exports are grouped by conceptual layer (Layer 1, 2, 3, Phase 3.4, PMI, Corpus, Offline, Claude, Agent) with clear comments. This makes the learning system's architecture visible directly in the code.

**Alternative Considered**: Alphabetical ordering. Rejected because it obscures the logical relationships between services.

### Why Re-Export Everything?

This file re-exports every public type and function from every service. No filtering or renaming.

**Reason**: Simplicity and discoverability. Developers can explore all capabilities from one place. If something shouldn't be exported, it should be module-private in its source file.

### Why Separate Corpus Modules (Registry, Filter, Pipeline)?

The corpus system is split into three modules:
- **Registry**: Static catalog of available corpus sources
- **Filter**: Matching and ranking sources for goals
- **Pipeline**: Orchestrating fetch, extraction, and database insertion

**Reason**: Single Responsibility Principle. Each module has one clear job, making them easier to test and modify independently.

---

## Integration Points

### Service Modules Re-Exported

| Service Module | Purpose | Key Exports |
|---------------|---------|-------------|
| `state-priority.service` | Layer 1: Learner state and item prioritization | `getUserThetaState`, `getLearningQueue`, `applyIRTReordering` |
| `task-generation.service` | Layer 2: Creating learning tasks | `generateTask`, `generateTaskWithClaude`, `getOrGenerateTask` |
| `scoring-update.service` | Layer 3: Response evaluation and mastery updates | `evaluateResponse`, `calculateMasteryUpdates`, `processResponse` |
| `fluency-versatility.service` | Phase 3.4: Training mode balance | `calculateTargetRatio`, `getBalancedTask`, `selectTrainingMode` |
| `pmi.service` | Vocabulary relationship analysis | `getWordDifficulty`, `getCollocations`, `updateIRTDifficulties` |
| `corpus-sources/registry` | Corpus source catalog | `CORPUS_SOURCES`, `getEnabledSources`, `getSourcesByDomain` |
| `corpus-sources/filter` | Source selection for goals | `filterSources`, `rankSourcesForGoal`, `getRecommendedSources` |
| `corpus-sources/corpus-pipeline.service` | Vocabulary population orchestration | `populateVocabularyForGoal`, `processUserUploads`, `clearVocabulary` |
| `offline-queue.service` | Offline operation queuing | `getOfflineQueueService`, `queueTaskGeneration`, `queueErrorAnalysis` |
| `claude.service` | Claude AI integration | `getClaudeService`, `ClaudeService` |
| `agent-trigger.service` | Development agent system | `detectAgentTriggers`, `registerBottleneck` |
| `agent-hooks.service` | Agent detection hooks | `createOperationHook`, `wrapWithAgentDetection` |

### Upstream Dependencies

This file imports from all service modules listed above. It has no direct external dependencies - it purely re-exports.

### Downstream Consumers

| Consumer | Usage |
|----------|-------|
| `src/main/ipc/*.ipc.ts` | IPC handlers import services to implement handler logic |
| `src/main/services/*.ts` | Services import from sibling services |
| Test files | Import services and types for testing |

### Dependency Flow

```
[IPC Handlers]
     |
     v imports from
[src/main/services/index.ts]  <-- YOU ARE HERE
     |
     v re-exports from
+-----------------+----------------+------------------+
|                 |                |                  |
v                 v                v                  v
[state-priority]  [task-gen]  [scoring-update]  [pmi.service]
                                                      |
                                                      v
                                              [corpus-sources/*]
```

### Critical Path Status

**Severity**: MEDIUM-HIGH

If this file fails:
- **Build errors**: Any file importing from services will fail to compile
- **No learning engine**: All adaptive learning functionality unavailable

**Mitigation**: This file has no logic - it only re-exports. Failures here indicate issues in the source modules, not this file itself.

---

## Change History

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-01-06 | Shadow documentation created | Establish narrative context for service organization | Developers understand service layer architecture |
