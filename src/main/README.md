# Main Process (`src/main/`)

Electron main process - handles database, IPC, and business logic.

## Directory Structure

```
main/
├── index.ts              # App entry point, window creation
├── preload.ts            # IPC bridge (contextBridge)
│
├── db/                   # Database layer
│   ├── client.ts         # Prisma client singleton
│   ├── prisma.ts         # Prisma configuration
│   └── repositories/     # Domain data access
│
├── ipc/                  # IPC handlers
│   ├── index.ts          # Handler registration
│   ├── contracts.ts      # Type-safe utilities
│   └── *.ipc.ts          # Domain handlers
│
└── services/             # Business logic
    ├── index.ts          # Barrel export
    └── *.service.ts      # Service implementations
```

## Services (3-Layer Pipeline)

The learning engine uses a 3-layer pipeline:

```
┌─────────────────────────────────────┐
│ Layer 1: State + Priority           │
│ state-priority.service.ts           │
│ - Build learning queue              │
│ - Calculate item priorities         │
│ - Select next item                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Layer 2: Task Generation            │
│ task-generation.service.ts          │
│ - Select task format                │
│ - Generate content                  │
│ - Apply cue levels                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Layer 3: Scoring + Update           │
│ scoring-update.service.ts           │
│ - Evaluate response                 │
│ - Update mastery state              │
│ - Schedule next review              │
└─────────────────────────────────────┘
```

## Service Files

| Service | Purpose |
|---------|---------|
| `state-priority.service.ts` | Learning queue management |
| `task-generation.service.ts` | Exercise creation |
| `scoring-update.service.ts` | Response processing |
| `fluency-versatility.service.ts` | Training balance |
| `claude.service.ts` | Anthropic API integration |
| `offline-queue.service.ts` | Offline operation queue |
| `pmi.service.ts` | PMI database operations |
| `agent-trigger.service.ts` | Bottleneck detection |
| `agent-hooks.service.ts` | Operation hooks |

## IPC Handlers

| Handler | Channels |
|---------|----------|
| `goal.ipc.ts` | Goal CRUD |
| `session.ipc.ts` | Training sessions |
| `learning.ipc.ts` | Learning queue |
| `claude.ipc.ts` | AI content |
| `agent.ipc.ts` | Agent coordination |
| `sync.ipc.ts` | Offline sync |

## Usage Example

```typescript
// In IPC handler
import { getLearningQueue, generateTask, processResponse } from './services';

// Layer 1: Get next item
const queue = await getLearningQueue(goalId);
const nextItem = queue[0];

// Layer 2: Generate task
const task = await generateTask(nextItem);

// Layer 3: Process response
const result = await processResponse(sessionId, response);
```

## Naming Convention

All service files use `.service.ts` suffix:
- `my-feature.service.ts`
- `kebab-case.service.ts`

## Adding a New Service

1. Create `src/main/services/my-feature.service.ts`
2. Export from `src/main/services/index.ts`
3. Create IPC handler if UI needs access
4. Document in `docs/narrative/src/main/services/my-feature.md`
