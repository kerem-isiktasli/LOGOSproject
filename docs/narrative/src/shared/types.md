# Shared IPC Type Definitions

> **Last Updated**: 2026-01-06
> **Code Location**: `src/shared/types.ts`
> **Status**: Active

---

## Context & Purpose

This file is the **cross-process type bridge** for LOGOS. While `src/core/types.ts` defines types for the core algorithms, this file makes those types available to the renderer process and defines all the IPC-specific types (request/response payloads, API interfaces, event types).

**Business Need**: In an Electron application, the renderer process (React UI) and main process (Node.js backend) are completely separate. They can't share runtime code - each is bundled separately. However, they need to agree on data shapes for communication. This file is the "contract" that both sides reference, ensuring type safety across the process boundary.

**When Used**:
- By the renderer when calling IPC methods (to know what to send and expect)
- By the main process when implementing IPC handlers (to validate requests and shape responses)
- By the preload script when defining the `window.logos` API
- In tests when mocking IPC behavior

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`../core/types`**: Re-exports ALL core algorithm types
  - IRT types: `ItemParameter`, `ThetaEstimate`, `IRTModel`
  - PMI types: `PMIResult`, `PMIPair`, `DifficultyMapping`
  - FSRS types: `FSRSCard`, `FSRSParameters`, `FSRSRating`, etc.
  - Mastery types: `MasteryStage`, `MasteryState`, `MasteryResponse`
  - Task types: `TaskType`, `TaskFormat`, `TaskSpec`, `TaskContent`, `Task`
  - Session types: `SessionMode`, `SessionConfig`, `SessionState`, `SessionSummary`
  - Priority types: `FREMetrics`, `PriorityCalculation`
  - Bottleneck types: `ComponentType`, `BottleneckEvidence`, `BottleneckAnalysis`
  - Language object types: `LanguageObject`, `LanguageObjectType`
  - Goal types: `GoalSpec`, `Domain`, `Modality`
  - User types: `User`, `UserThetaProfile`
  - Queue types: `LearningQueueItem`
  - Evaluation types: `ResponseEvaluation`, `EvaluationScores`, `ResponseError`
  - Utility types: `Result`, `PaginationParams`, `PaginatedResult`, `DateRange`

### Dependents (What Needs This)

**IPC Layer (Main Process):**
- `src/main/ipc/contracts.ts`: Imports `IPCHandlerMap` for type-safe handler registration
- All `*.ipc.ts` files: Import request/response types
- `src/main/preload.ts`: Imports `LogosAPI` for contextBridge

**Renderer Process:**
- `src/renderer/hooks/useLogos.ts`: Uses API types
- React components: Import types for state and props
- `src/renderer/context/AppContext.tsx`: Uses session and user types

**Services:**
- Many services import via this file rather than directly from core/types

### Data Flow

```
src/core/types.ts
       |
       | (core algorithm types)
       v
src/shared/types.ts
       |
       +---------> Main Process
       |             - IPC handlers validate requests
       |             - Services use domain types
       |
       +---------> Preload Script
       |             - Defines window.logos shape
       |
       +---------> Renderer Process
                    - Components use types for props/state
                    - Hooks return typed data
```

---

## Macroscale: System Integration

### Architectural Layer

This file is the **Type Bridge** between architectural boundaries:

```
+----------------------------------------------------------+
| Renderer Process                                          |
| - React components                                        |
| - Uses types from shared/types.ts                         |
| - CANNOT import from main/ or core/ directly             |
+----------------------------------------------------------+
                         |
                         | Types shared via
                         | src/shared/types.ts
                         v
+----------------------------------------------------------+
| Preload Script (contextBridge)                            |
| - Defines window.logos: LogosAPI                          |
| - Uses shared types for API shape                         |
+----------------------------------------------------------+
                         |
                         v
+----------------------------------------------------------+
| Main Process                                              |
| - IPC handlers                                            |
| - Services                                                |
| - Can import from core/ AND shared/                       |
+----------------------------------------------------------+
```

### Big Picture Impact

This file enables **type-safe full-stack development** in LOGOS:

| Capability | How This File Enables It |
|------------|-------------------------|
| Type-safe IPC | `IPCHandlerMap` ensures request/response types match |
| IDE autocomplete | Renderer knows all available API methods and their shapes |
| Refactoring safety | Changing a type updates all usages across processes |
| Documentation | Types serve as self-documenting API specification |
| Testing | Mock implementations can be type-checked |

**Without This File:**
- Renderer would use `any` for all IPC data
- No compile-time catching of IPC mismatches
- API changes would silently break renderer code
- No autocomplete when using `window.logos`

### Critical Path Analysis

**Importance Level**: Critical (Type Bridge)

- **If types are wrong**: Runtime errors instead of compile errors
- **If types drift from implementation**: Silent data corruption
- **If re-exports are missing**: Renderer can't access needed types

**Maintenance Requirement**: This file must stay synchronized with `core/types.ts` and all IPC handler implementations.

---

## File Organization

### 1. Core Type Re-exports

The file starts by importing and re-exporting everything from `core/types`:

```typescript
import type {
  ItemParameter, ThetaEstimate, IRTModel,
  PMIResult, PMIPair, DifficultyMapping,
  // ... all core types
} from '../core/types';

export type {
  ItemParameter, ThetaEstimate, IRTModel,
  // ... re-exported for renderer access
};
```

**Why Re-export**: The renderer can't import from `core/` directly (different bundle). By re-exporting here, we create a single import path for all types.

### 2. IPC Channel Constants

```typescript
export const IPC_CHANNELS = {
  GOAL_CREATE: 'goal:create',
  GOAL_UPDATE: 'goal:update',
  // ... 50+ channel constants
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
```

**Purpose**: Single source of truth for channel names. `as const` makes TypeScript treat values as literal types, enabling full type inference.

### 3. IPC Request/Response Types

For each IPC operation, defines the request and response shapes:

```typescript
// Goal Operations
export interface GoalCreateRequest {
  domain: string;
  modality: string[];
  genre: string;
  purpose: string;
  benchmark?: string;
  deadline?: string;
}

export interface GoalListResponse {
  goals: GoalSpec[];
  total: number;
}
```

### 4. IPCHandlerMap

The master type map connecting channels to their request/response types:

```typescript
export interface IPCHandlerMap {
  [IPC_CHANNELS.GOAL_CREATE]: {
    request: GoalCreateRequest;
    response: GoalSpec;
  };
  [IPC_CHANNELS.GOAL_LIST]: {
    request: GoalListRequest;
    response: GoalListResponse;
  };
  // ... every channel
}
```

**How It's Used**:
```typescript
// In contracts.ts
registerHandler<'goal:create'>('goal:create', async (event, request) => {
  // TypeScript knows: request is GoalCreateRequest
  // TypeScript knows: must return IPCResponse<GoalSpec>
});
```

### 5. Type Helpers

Utilities for extracting types from the map:

```typescript
// Get request type for a channel
export type IPCRequest<T extends IPCChannel> =
  T extends keyof IPCHandlerMap ? IPCHandlerMap[T]['request'] : never;

// Get response type for a channel
export type IPCResponseData<T extends IPCChannel> =
  T extends keyof IPCHandlerMap ? IPCHandlerMap[T]['response'] : never;
```

### 6. Preload API Interfaces

Structured interfaces for the `window.logos` API:

```typescript
export interface GoalAPI {
  create: (data: {...}) => Promise<GoalSpec>;
  get: (id: string) => Promise<GoalSpec | null>;
  list: (includeInactive?: boolean) => Promise<GoalSpec[]>;
  update: (data: {...}) => Promise<GoalSpec>;
  delete: (id: string, hard?: boolean) => Promise<void>;
}

export interface LogosAPI {
  goal: GoalAPI;
  object: ObjectAPI;
  session: SessionAPI;
  queue: QueueAPI;
  mastery: MasteryAPI;
  analytics: AnalyticsAPI;
  profile: ProfileAPI;
  claude: ClaudeAPI;
  corpus: CorpusAPI;
  sync: SyncAPI;
  onboarding: OnboardingAPI;
  app: AppAPI;
}
```

### 7. Global Window Extension

Extends TypeScript's global Window interface:

```typescript
declare global {
  interface Window {
    logos: LogosAPI;
  }
}
```

**Why Global Declaration**: Without this, TypeScript would error on `window.logos` saying property doesn't exist. This tells TypeScript "trust me, this property will exist at runtime."

### 8. Event Types

For main-to-renderer push notifications:

```typescript
export const IPC_EVENTS = {
  SESSION_TASK_READY: 'event:session:task-ready',
  SYNC_COMPLETED: 'event:sync:completed',
  // ...
} as const;

export interface IPCEventPayloads {
  [IPC_EVENTS.SESSION_TASK_READY]: {
    sessionId: string;
    task: Task;
  };
  // ...
}
```

---

## API Domain Groups

### Goal Management (`GoalAPI`)

Manage learning goals with domain, modality, and purpose settings.

| Method | Description |
|--------|-------------|
| `create` | Create a new learning goal |
| `get` | Retrieve a specific goal |
| `list` | List all goals (optionally filter) |
| `update` | Modify goal properties |
| `delete` | Remove a goal |

### Session Management (`SessionAPI`)

Control learning sessions from start to finish.

| Method | Description |
|--------|-------------|
| `start` | Begin a new learning session |
| `end` | Complete and summarize session |
| `getCurrent` | Get active session state |
| `recordResponse` | Submit learner response |
| `getHistory` | Get past session summaries |

### Learning Queue (`QueueAPI`)

Manage what items to practice.

| Method | Description |
|--------|-------------|
| `build` | Create prioritized queue |
| `getNext` | Get next item to practice |
| `refresh` | Recalculate queue |

### Language Objects (`ObjectAPI`)

CRUD operations for vocabulary items.

| Method | Description |
|--------|-------------|
| `create` | Add new vocabulary |
| `get` | Retrieve specific item |
| `list` | List items (filtered) |
| `update` | Modify item properties |
| `delete` | Remove item |
| `import` | Bulk import items |

### Analytics (`AnalyticsAPI`)

Progress tracking and insights.

| Method | Description |
|--------|-------------|
| `getProgress` | Overall progress metrics |
| `getBottlenecks` | Identify learning blockers |
| `getSessionStats` | Session statistics over time |

### Mastery Tracking (`MasteryAPI`)

Track learning stage progression.

| Method | Description |
|--------|-------------|
| `get` | Get mastery state for item |
| `getStats` | Distribution and retention stats |

### User Profile (`ProfileAPI`)

Manage user settings and preferences.

| Method | Description |
|--------|-------------|
| `get` | Get user profile |
| `update` | Update profile fields |
| `getSettings` | Get app settings |
| `updateSettings` | Modify settings |

### Claude AI (`ClaudeAPI`)

AI-powered content generation.

| Method | Description |
|--------|-------------|
| `generateContent` | Create exercises/explanations |
| `analyzeError` | Diagnose learner errors |
| `getHint` | Generate progressive hints |
| `getBottlenecks` | AI-powered bottleneck analysis |

### Corpus Management (`CorpusAPI`)

Vocabulary source management.

| Method | Description |
|--------|-------------|
| `listSources` | Available corpus sources |
| `getRecommendedSources` | Sources matching goal |
| `populateVocabulary` | Import vocabulary |
| `getPopulationStatus` | Check import progress |
| `clearVocabulary` | Remove vocabulary |
| `uploadDocuments` | Import from user docs |

### Sync Management (`SyncAPI`)

Offline/online synchronization.

| Method | Description |
|--------|-------------|
| `getStatus` | Sync status |
| `forceSync` | Trigger immediate sync |
| `getQueueSize` | Pending operations count |
| `getQueueStats` | Detailed queue breakdown |
| `clearCompleted` | Remove completed items |
| `retryFailed` | Retry failed operations |

### Onboarding (`OnboardingAPI`)

New user setup flow.

| Method | Description |
|--------|-------------|
| `checkStatus` | Needs onboarding? |
| `complete` | Finish onboarding |
| `skip` | Skip with defaults |
| `getUser` | Get current user info |

---

## Technical Concepts (Plain English)

### Type Map (IPCHandlerMap)

**Technical**: An indexed type where keys are literal channel strings and values are objects containing request and response types, enabling compile-time lookup of types based on channel name.

**Plain English**: A "dictionary" where you look up a channel name and get back what data to send and what data you'll receive. TypeScript uses this dictionary at compile time to check your code.

**Why We Use It**: When you write `invoke('goal:create', data)`, TypeScript looks up 'goal:create' in the map and checks that `data` matches `GoalCreateRequest` and that you're handling the response as `GoalSpec`.

### Mapped Type Helpers

**Technical**: Utility types that use `keyof`, `extends`, and conditional types to extract specific types from a complex type structure.

**Plain English**: Little helper types that answer questions like "what's the request type for this channel?" or "what's the response type for this channel?" They're computed from the main map, so they stay in sync automatically.

```typescript
type IPCRequest<'goal:create'> = GoalCreateRequest  // computed from map
```

### Global Declaration

**Technical**: Using `declare global { }` to extend TypeScript's built-in type definitions without modifying the actual source.

**Plain English**: Telling TypeScript "hey, I know the Window type doesn't normally have `logos` on it, but trust me - at runtime, it will exist." This lets us use `window.logos` without TypeScript complaining.

### Const Assertion

**Technical**: The `as const` assertion creates a readonly type with literal types instead of widened types.

**Plain English**: Normally `{ x: 'hello' }` has type `{ x: string }`. With `as const`, it has type `{ readonly x: 'hello' }`. This precision is needed for type inference to work correctly with channel names.

---

## Usage Patterns

### In React Components

```typescript
import type { GoalSpec, MasteryStage } from '@shared/types';

function GoalCard({ goal }: { goal: GoalSpec }) {
  // TypeScript knows goal.domain, goal.modality, etc.
}
```

### In IPC Handlers

```typescript
import type { GoalCreateRequest, GoalSpec } from '../../shared/types';
import { registerHandler, success, error } from './contracts';

registerHandler('goal:create', async (event, request: GoalCreateRequest) => {
  // TypeScript enforces request shape
  const goal = await createGoal(request);
  return success<GoalSpec>(goal);
});
```

### In Tests

```typescript
import type { IPCResponse, GoalSpec } from '@shared/types';

const mockResponse: IPCResponse<GoalSpec> = {
  success: true,
  data: { id: '123', domain: 'medical', /* ... */ }
};
```

---

## Synchronization Requirements

### With core/types.ts

Any new type added to `core/types.ts` that needs to be used in renderer:
1. Import it in the import block
2. Re-export it in the export block

### With IPC Handlers

Any new IPC channel:
1. Add constant to `IPC_CHANNELS`
2. Define request/response interfaces
3. Add entry to `IPCHandlerMap`

### With Preload

Any new API method:
1. Add to appropriate API interface (e.g., `GoalAPI`)
2. Ensure `LogosAPI` includes the updated interface

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created shadow documentation for shared/types.ts
- **Why**: Cross-process type bridge requires documentation for understanding IPC typing
- **Impact**: Enables developers and AI agents to understand type system across process boundaries

### Historical Notes

- File combines re-exports with IPC-specific types
- Window global declaration enables `window.logos` usage
- Event types support main-to-renderer push notifications
- API interfaces document the complete preload surface
