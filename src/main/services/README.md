# Services (`src/main/services/`)

Business logic layer for LOGOS. Services orchestrate core algorithms, database operations, and external APIs.

## Directory Structure

```
services/
├── index.ts                        # Barrel export (use this!)
│
├── # 3-Layer Learning Pipeline
├── state-priority.service.ts       # Layer 1
├── task-generation.service.ts      # Layer 2
├── scoring-update.service.ts       # Layer 3
├── fluency-versatility.service.ts  # Balance control
│
├── # External Integration
├── claude.service.ts               # Anthropic API
├── offline-queue.service.ts        # Offline operations
├── pmi.service.ts                  # PMI calculations
│
├── # Agent System
├── agent-trigger.service.ts        # Trigger detection
├── agent-hooks.service.ts          # Operation hooks
│
└── corpus-sources/                 # Corpus management
    ├── registry.ts                 # Available sources
    ├── filter.ts                   # Source selection
    └── corpus-pipeline.service.ts  # Vocabulary population
```

## Import Convention

```typescript
// Import from barrel (preferred)
import {
  getLearningQueue,
  generateTask,
  processResponse,
  getClaudeService,
} from '@main/services';

// Or import specific service
import { getLearningQueue } from '@main/services/state-priority.service';
```

## 3-Layer Learning Pipeline

### Layer 1: State + Priority (`state-priority.service.ts`)

Builds and manages the learning queue.

```typescript
import { getLearningQueue, getNextLearningItem } from '@main/services';

// Get prioritized queue
const queue = await getLearningQueue(goalId, { limit: 20 });

// Get next item with IRT-based selection
const nextItem = await getNextItemWithIRT(goalId, userTheta);
```

**Key Functions:**
- `getUserThetaState()` - Get user ability profile
- `calculateEffectivePriority()` - Compute item priority
- `getLearningQueue()` - Build prioritized queue
- `getNextLearningItem()` - Select next item
- `applyIRTReordering()` - IRT-based queue optimization

### Layer 2: Task Generation (`task-generation.service.ts`)

Creates exercises from learning items.

```typescript
import { generateTask, generateTaskWithClaude } from '@main/services';

// Generate task (template-based)
const task = await generateTask(queueItem);

// Generate task with Claude AI
const aiTask = await generateTaskWithClaude(queueItem, claudeService);
```

**Key Functions:**
- `selectTaskFormat()` - Choose MCQ, fill-blank, etc.
- `determineCueLevel()` - Set scaffolding level
- `generateTask()` - Create exercise
- `generateHints()` - Create progressive hints
- `getOrGenerateTask()` - Cache-aware generation

### Layer 3: Scoring + Update (`scoring-update.service.ts`)

Processes responses and updates learner state.

```typescript
import { processResponse, evaluateResponse } from '@main/services';

// Full response processing
const result = await processResponse(sessionId, {
  taskId,
  response: userAnswer,
  responseTimeMs: 2500,
  hintsUsed: 1,
});

// Just evaluation (no state update)
const evaluation = evaluateResponse(userResponse, expectedAnswer, taskType);
```

**Key Functions:**
- `evaluateResponse()` - Check correctness
- `calculateMasteryUpdates()` - Compute new mastery state
- `calculateThetaContribution()` - Update ability estimate
- `processResponse()` - Full pipeline

### Phase 3.4: Fluency/Versatility Balance (`fluency-versatility.service.ts`)

Controls training mode balance.

```typescript
import { selectTrainingMode, getBalancedTask } from '@main/services';

// Select mode based on learner state
const mode = selectTrainingMode(masteryDistribution, sessionProgress);

// Get task that maintains balance
const task = await getBalancedTask(goalId, currentBalance);
```

## External Services

### Claude Service (`claude.service.ts`)

Anthropic API integration for AI-generated content.

```typescript
import { getClaudeService } from '@main/services';

const claude = getClaudeService();

// Generate content
const content = await claude.generateContent(request);

// Analyze errors
const analysis = await claude.analyzeError(request);

// Get hint
const hint = await claude.getHint(request);
```

### Offline Queue (`offline-queue.service.ts`)

Queues operations when offline.

```typescript
import { queueTaskGeneration, getOfflineQueueService } from '@main/services';

// Queue an operation
await queueTaskGeneration(objectId, taskSpec);

// Get queue stats
const stats = await getOfflineQueueService().getStats();
```

## Naming Convention

All services use `.service.ts` suffix:
```
kebab-case.service.ts
```

## Adding a New Service

1. Create `src/main/services/my-feature.service.ts`
2. Follow this template:

```typescript
/**
 * My Feature Service
 *
 * Description of what this service does.
 */

// Types
export interface MyFeatureConfig { ... }
export type MyFeatureResult = { ... };

// Functions
export async function myFeatureFunction(input: Input): Promise<Output> {
  // Implementation
}
```

3. Export from `src/main/services/index.ts`:

```typescript
export {
  type MyFeatureConfig,
  type MyFeatureResult,
  myFeatureFunction,
} from './my-feature.service';
```

4. Document in `docs/narrative/src/main/services/my-feature.md`
