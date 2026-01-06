# Core Module Barrel Export

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/index.ts`
> **Status**: Active

---

## Context & Purpose

This file is the **central nervous system gateway** of the LOGOS learning algorithms. It serves as a barrel export that provides a single, unified entry point to access all core computational functions without needing to know their internal file organization.

**Business Need**: LOGOS implements sophisticated psychometric, linguistic, and memory science algorithms. Without a central export point, developers would need to import from 15+ individual files, remember internal directory structures, and maintain imports scattered across the codebase. This barrel export transforms algorithmic chaos into a clean API surface.

**When Used**:
- Every time the main process needs to calculate learning priorities
- Every time the UI needs to display mastery progress
- Every IPC handler that processes learner responses
- Every service that schedules reviews or selects items
- Essentially: any code outside `/src/core` that needs computational logic

**Why It Exists (The Deeper Why)**:
LOGOS follows a strict **pure algorithm isolation** principle. All computation lives in `/src/core` with zero external dependencies, no database calls, no network requests, no side effects. This barrel export is the "membrane" that separates pure mathematical functions from the messy reality of Electron IPC, database access, and UI state. By channeling all access through this single file, the architecture enforces:
1. Pure functions remain pure (testable, predictable, portable)
2. Implementation details stay hidden (refactoring without breaking consumers)
3. Circular dependencies become impossible (clear dependency direction)

---

## Microscale: Direct Relationships

### Dependencies (What This Module Exports From)

The barrel aggregates exports from **15 algorithm files** and **5 submodules**:

**Foundation Layer:**
- `./types.ts`: All TypeScript interfaces and type definitions (the shared vocabulary)
- `./quadrature.ts`: Gaussian-Hermite numerical integration (mathematical utility for IRT)

**Psychometric Layer (Learner Modeling):**
- `./irt.ts`: Item Response Theory functions - `probability1PL`, `probability2PL`, `probability3PL`, `estimateThetaMLE`, `estimateThetaEAP`, `calculateFisherInformation`, `selectNextItemFisher`, `selectNextItemKL`, `calibrateItemsEM`
- `./fsrs.ts`: Free Spaced Repetition Scheduler - `createFSRSCard`, `updateFSRS`, `calculateNextInterval`, mastery stage functions

**Linguistic Analysis Layer:**
- `./pmi.ts`: Pointwise Mutual Information for corpus analysis - `PMICalculator`, `computePMI`, `computeNPMI`, `mapDifficultyToTask`
- `./morphology.ts`: Word structure decomposition - `analyzeMorphology`, `getMorphemeComplexity`, `identifyMorphemes`
- `./g2p.ts`: Grapheme-to-Phoneme rules - `graphemeToPhoneme`, `calculatePhonemicDistance`, `identifyPronunciationPatterns`
- `./syntactic.ts`: Grammar complexity analysis - `parseSentence`, `identifyConstituents`, `calculateSyntacticComplexity`

**Learning Optimization Layer:**
- `./priority.ts`: FRE-based queue ordering - `calculateFREScore`, `calculatePriority`, `rankByPriority`, `adjustWeightsForGoal`
- `./bottleneck.ts`: Error cascade detection - `analyzeBottleneck`, `detectCascadePattern`, `identifyRootCause`, `getComponentOrder`
- `./task-matching.ts`: Exercise-learner fit - `matchTaskToLearner`, `calculateTaskSuitability`, `selectOptimalTask`
- `./response-timing.ts`: Fluency metrics - `analyzeResponseTiming`, `calculateFluencyScore`, `detectHesitationPatterns`
- `./transfer.ts`: L1 influence prediction - `predictTransfer`, `calculateTransferGain`, `identifyInterference`
- `./stage-thresholds.ts`: Mastery progression gates - `getStageThresholds`, `checkStageAdvancement`, `calculateStageProgress`

**Submodule Re-exports (Entire Namespaces):**
- `./content/`: Pedagogical intent mapping, content specification, generation, validation
- `./tasks/`: Traditional task type library, constraint solving, distractor generation
- `./grammar/`: Syntactic construction library, grammar sequence optimization
- `./state/`: Component-object state tracking, priority search engine
- `./register/`: Domain/register profiles, pragmatic appropriateness scoring

### Dependents (What Uses This Module)

**Direct Consumers:**
- `src/main/services/state-priority.service.ts`: Imports priority functions for queue management
- `src/main/services/scoring-update.service.ts`: Imports IRT and FSRS for response processing
- `src/main/services/task-generation.service.ts`: Imports task matching, content generation
- `src/main/services/pmi.service.ts`: Imports PMICalculator for corpus processing
- `src/main/ipc/*.ipc.ts`: Various IPC handlers import types and functions
- `src/renderer/hooks/*.ts`: React hooks that compute derived state

**Import Patterns:**
```typescript
// Full namespace import (common in services)
import { probability2PL, estimateThetaEAP, PMICalculator } from '@core';

// Specific deep imports (when only one thing needed)
import { probability2PL } from '@core/irt';
```

### Data Flow Through This Module

```
External Request (IPC/Service)
         |
         v
    [index.ts] -----> Selects appropriate algorithm
         |
         +---> IRT functions (ability estimation)
         |           |
         |           v
         |      Returns theta estimate
         |
         +---> FSRS functions (scheduling)
         |           |
         |           v
         |      Returns next review date
         |
         +---> Priority functions (queue ordering)
         |           |
         |           v
         |      Returns sorted learning queue
         |
         +---> Bottleneck functions (diagnosis)
                     |
                     v
                Returns intervention recommendation
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at **Layer 0: Pure Computation** in LOGOS's four-tier architecture:

```
Layer 3: UI (React/Renderer)
    ^
    | (via hooks)
    |
Layer 2: IPC Handlers (Main Process)
    ^
    | (via services)
    |
Layer 1: Services (Business Logic)
    ^
    | (imports from)
    |
[Layer 0: Core Algorithms] <-- YOU ARE HERE
    |
    v
(No dependencies - pure functions only)
```

This is the **foundation layer** that everything else builds upon. It has zero dependencies on other application code, only standard TypeScript/JavaScript.

### Big Picture Impact

**If This Module Disappeared:**
The entire LOGOS application would collapse. Every intelligent feature relies on these algorithms:

| Feature | Algorithms Used |
|---------|-----------------|
| "What should I learn next?" | priority.ts, task-matching.ts |
| "How well do I know this word?" | irt.ts, fsrs.ts, stage-thresholds.ts |
| "When should I review this?" | fsrs.ts, priority.ts |
| "Why do I keep making this error?" | bottleneck.ts, transfer.ts |
| "Is this word important to learn?" | pmi.ts, priority.ts |
| "Generate an appropriate exercise" | content/, tasks/, grammar/ |
| "What's my fluency level?" | response-timing.ts, irt.ts |
| "Match content to my level" | irt.ts, task-matching.ts, register/ |

### The Twelve Algorithm Domains

The barrel export organizes algorithms into coherent domains that mirror the theoretical foundations:

1. **IRT (Psychometrics)**: Models learner ability on a statistical scale, enabling adaptive difficulty
2. **FSRS (Memory Science)**: Predicts forgetting curves, schedules optimal review timing
3. **PMI (Corpus Linguistics)**: Measures word associations, identifies collocations worth learning
4. **Priority (Learning Science)**: Combines frequency, relations, and context into learning order
5. **Bottleneck (Error Analysis)**: Traces error cascades through language components (PHON->MORPH->LEX->SYNT->PRAG)
6. **Morphology (Word Structure)**: Decomposes words into meaningful units for pattern learning
7. **G2P (Phonology)**: Maps spelling to pronunciation, identifies pronunciation difficulties
8. **Syntactic (Grammar)**: Analyzes sentence complexity, identifies grammatical patterns
9. **Response Timing (Fluency)**: Measures automaticity through response speed patterns
10. **Task Matching (Pedagogy)**: Selects appropriate exercise types for learner state
11. **Transfer (L1 Influence)**: Predicts positive/negative transfer from native language
12. **Stage Thresholds (Mastery)**: Defines criteria for progressing through learning stages

### Critical Path Analysis

**Importance Level**: CRITICAL (Tier 0)

This is the single most critical module in LOGOS. Unlike services or UI components that can be worked around, the core algorithms cannot be bypassed or mocked without fundamentally breaking the learning system.

**Failure Modes:**
- If IRT fails: Ability estimates become random, adaptive difficulty breaks
- If FSRS fails: Review scheduling becomes arbitrary, forgetting curves ignored
- If Priority fails: Learning queue becomes unordered, inefficient learning
- If Bottleneck fails: Error diagnosis impossible, learners get stuck

**Recovery Strategy:**
The pure function architecture means failures are deterministic and testable. Each algorithm has corresponding tests in `src/core/__tests__/`. If an algorithm produces wrong results, the fix propagates everywhere automatically through this single export point.

---

## Technical Concepts (Plain English)

### Barrel Export Pattern
**Technical**: A module that re-exports other modules' exports, aggregating them into a single import point. Also called "index exports" or "public API surface."

**Plain English**: Like a reception desk at a large company. Instead of knowing which floor and office each department is on, you ask at reception and they connect you. The barrel export is the reception desk for all core algorithms.

**Why We Use It**:
- Clean imports (`from '@core'` instead of `from '@core/irt'`, `from '@core/fsrs'`, etc.)
- Freedom to reorganize internal files without breaking consumers
- Single point to audit what's publicly available vs. internal

### Pure Functions
**Technical**: Functions that always produce the same output for the same input, have no side effects, and don't depend on external state. Also called "referentially transparent" functions.

**Plain English**: Like a calculator. Press 2+2, always get 4. Doesn't matter what time it is, who's using it, or what happened before. The calculation is the same every time. LOGOS core functions are all calculators - feed in data, get predictable results.

**Why We Use It**:
- Testable (no mocks needed, just call with inputs)
- Cacheable (same inputs = cached output valid)
- Parallelizable (no shared state to corrupt)
- Debuggable (trace inputs to outputs deterministically)

### Named Exports vs. Namespace Exports
**Technical**: `export { foo, bar }` (named) vs. `export * from './module'` (namespace re-export). This barrel uses both strategically.

**Plain English**: Named exports are like a restaurant menu listing specific dishes. Namespace exports are like saying "we serve everything from our Italian kitchen." The core index uses specific menus for complex algorithms (so you know exactly what's available) and "serve everything" for simpler submodules.

**Why We Use It**:
- Named exports for IRT, FSRS, etc.: Makes the API discoverable, enables tree-shaking, prevents accidental exposure of internals
- Namespace exports for submodules (content/, tasks/): The submodules have their own barrel exports that curate their API

### Tree-Shaking
**Technical**: Bundler optimization that removes unused exports from the final bundle. Named exports enable fine-grained tree-shaking; namespace exports may include unused code.

**Plain English**: Like packing only the clothes you'll actually wear on a trip instead of your entire closet. Named exports let the bundler pack only the functions that are actually called.

**Why It Matters**: Core algorithms are substantial. Tree-shaking ensures the Electron app only bundles algorithms actually used, keeping the application lean.

---

## Design Decisions

### Why Explicit Named Exports for Main Algorithms?

The barrel could simply do `export * from './irt'` but instead explicitly lists each export. This is intentional:

1. **API Documentation**: The index.ts file IS the API documentation. Reading it shows exactly what's available.
2. **Breaking Change Detection**: Adding/removing exports requires changing this file, making API changes visible in code review.
3. **Selective Exposure**: Internal helper functions in algorithm files stay internal (not exported here).

### Why Namespace Re-exports for Submodules?

Submodules like `content/`, `tasks/`, `grammar/` use `export * from './content'`:

1. **Delegation**: These submodules have their own index.ts that curates their exports
2. **Growth**: These areas evolve rapidly; direct re-export avoids maintaining two lists
3. **Coherence**: Each submodule is a coherent domain that should be consumed together

### Why Type Exports Alongside Functions?

Types are exported with their functions (`type FSRSRating`, `type FSRSState` alongside `createFSRSCard`):

1. **Consumer Convenience**: Code using FSRS functions likely needs FSRS types
2. **Colocation**: Types and functions that go together should import together
3. **TypeScript Best Practice**: Explicit type exports enable better type inference

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Added narrative documentation explaining barrel export architecture
- **Why**: Support shadow documentation system for improved maintainability
- **Impact**: Enables new developers to understand core module organization

### 2026-01-03 - Added Stage Thresholds Export
- **What Changed**: Added `stage-thresholds.ts` exports for mastery progression
- **Why**: Mastery stage transitions needed explicit threshold configuration
- **Impact**: Enables UI and services to check/display stage advancement criteria

### 2026-01-02 - Added Transfer, Response Timing, Task Matching
- **What Changed**: Three new algorithm files integrated into barrel
- **Why**: Gap analysis identified missing L1 transfer prediction and fluency measurement
- **Impact**: Enables more sophisticated learner modeling and exercise selection

### 2026-01-01 - Initial Submodule Structure
- **What Changed**: Created content/, tasks/, grammar/, state/, register/ submodules
- **Why**: Growing complexity required domain organization
- **Impact**: Algorithms organized by theoretical domain rather than flat file list

---

## Relationship Map

```
                            +-----------------+
                            |   index.ts      |
                            | (This File)     |
                            +--------+--------+
                                     |
        +----------------------------+----------------------------+
        |                            |                            |
        v                            v                            v
+---------------+          +------------------+         +------------------+
|   types.ts    |          |  Algorithm Files |         |    Submodules    |
| (Shared Types)|          |  (15 files)      |         |   (5 modules)    |
+---------------+          +------------------+         +------------------+
                                     |                            |
        +----+-----------+-----------+                            |
        |    |           |           |                            |
        v    v           v           v                            v
     +----+ +----+    +------+   +------+          +---------+----------+
     |IRT | |FSRS|    |PMI   |   |Others|          |content/ |  tasks/  |
     +----+ +----+    +------+   +------+          +---------+----------+
                                                   |grammar/ | state/   |
                                                   +---------+----------+
                                                   |       register/    |
                                                   +--------------------+
```

---

## Usage Examples

### Basic Import (Most Common)
```typescript
// Import what you need from the unified entry point
import {
  probability2PL,
  estimateThetaEAP,
  updateFSRS,
  calculatePriority
} from '@core';
```

### Type-Only Import
```typescript
import type {
  ItemParameter,
  ThetaEstimate,
  FSRSCard,
  MasteryState
} from '@core';
```

### Submodule Features
```typescript
import {
  ContentGenerator,
  createContentSpec,
  TRADITIONAL_TASK_TYPES,
  selectOptimalTaskType
} from '@core';
```

### Deep Import (When Tree-Shaking Matters)
```typescript
// Import directly from specific file for minimal bundle
import { probability2PL } from '@core/irt';
```
