# Core Algorithms (`src/core/`)

Pure TypeScript implementations of LOGOS learning algorithms. **Zero external dependencies, zero side effects.**

## Quick Start

```typescript
// Import everything from barrel export
import { probability2PL, estimateThetaEAP, PMICalculator } from '@core';

// Or import specific modules
import { probability2PL } from '@core/irt';
import { updateFSRS } from '@core/fsrs';
```

## Directory Structure

```
core/
├── index.ts              # Barrel export (use this!)
├── types.ts              # All type definitions
│
├── # Learning Metrics
├── irt.ts                # Item Response Theory
├── fsrs.ts               # Spaced Repetition Scheduling
├── pmi.ts                # Corpus Statistics (PMI)
├── priority.ts           # FRE Priority Calculation
├── bottleneck.ts         # Error Pattern Detection
│
├── # Linguistic Analysis
├── morphology.ts         # Word Structure
├── g2p.ts                # Pronunciation (Grapheme-to-Phoneme)
├── syntactic.ts          # Grammar Parsing
├── response-timing.ts    # Fluency Metrics
│
├── # Supporting
├── task-matching.ts      # Exercise Selection
├── transfer.ts           # L1 Transfer Prediction
├── stage-thresholds.ts   # Mastery Progression
├── quadrature.ts         # Numerical Integration
│
├── # Submodules
├── content/              # Content Generation
├── tasks/                # Task Type Library
├── grammar/              # Grammar Sequences
├── state/                # Component State
└── register/             # Register Profiling
```

## Key Algorithms

### IRT (Item Response Theory) - `irt.ts`

Estimates learner ability (theta) from response patterns.

```typescript
import { probability2PL, estimateThetaEAP } from '@core/irt';

// Calculate probability of correct response
const prob = probability2PL(theta, a, b);

// Estimate ability from responses
const estimate = estimateThetaEAP(responses, items);
```

### FSRS (Spaced Repetition) - `fsrs.ts`

Schedules optimal review times based on memory model.

```typescript
import { createFSRSCard, updateFSRS } from '@core/fsrs';

const card = createFSRSCard();
const updated = updateFSRS(card, rating, params);
```

### Priority (FRE) - `priority.ts`

Calculates learning priority: `Priority = (wF*F + wR*R + wE*E) / Cost`

```typescript
import { calculatePriority, rankByPriority } from '@core/priority';

const priority = calculatePriority(object, userState, masteryInfo);
const ranked = rankByPriority(objects, userState);
```

### Bottleneck Detection - `bottleneck.ts`

Identifies which language component is blocking progress.

```typescript
import { analyzeBottleneck } from '@core/bottleneck';

const analysis = analyzeBottleneck(errorRecords);
// Returns: { primaryBottleneck: 'MORPH', confidence: 0.85, ... }
```

## Design Principles

1. **Pure Functions**: Same input = same output, always
2. **No I/O**: No database, no network, no file system
3. **No External Dependencies**: Only TypeScript standard library
4. **Comprehensive Types**: Everything is strongly typed
5. **Well Documented**: JSDoc on all exports

## Testing

```bash
npm test -- --grep "core"
```

Tests are in `src/core/__tests__/`.

## Adding New Algorithms

1. Create `src/core/my-algorithm.ts`
2. Add exports to `src/core/index.ts`
3. Add tests in `src/core/__tests__/my-algorithm.test.ts`
4. Document in `docs/narrative/src/core/my-algorithm.md`
