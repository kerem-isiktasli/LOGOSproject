# IPC Contracts Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/ipc/contracts.ts`
> **Status**: Active

---

## Context & Purpose

This module defines the **communication contract** between Electron's main process and renderer process. In an Electron application, the UI (React/renderer) cannot directly access system resources like the database or file system - it must ask the main process to perform those operations. This module standardizes that communication.

**Business Need**: Electron applications are fundamentally split into two worlds: the renderer (browser-like, sandboxed, runs UI) and the main (Node.js, full system access, runs backend logic). Without a clear contract, communication becomes chaotic - different developers might use different channel names, inconsistent response formats, or forget error handling. This module creates a single source of truth for all IPC communication.

**When Used**:
- Every time the UI needs data from the database
- Every time the UI triggers a backend operation
- Every time the main process sends events to the UI
- During handler registration at app startup
- In tests that mock IPC behavior

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`electron`**:
  - `ipcMain` - For registering handlers in main process
  - `IpcMainInvokeEvent` - Type for handler event parameter

- **`../../shared/types`**:
  - `IPCHandlerMap` - Type-safe mapping of channels to request/response types
  - `GoalSpec`, `LanguageObject`, `SessionState`, etc. - Domain types used in IPC

### Dependents (What Needs This)

**IPC Handler Modules:**
- `src/main/ipc/onboarding.ipc.ts`: Uses `registerDynamicHandler()`, `success()`, `error()`
- `src/main/ipc/session.ipc.ts`: Uses same utilities
- `src/main/ipc/learning.ipc.ts`: Uses same utilities
- `src/main/ipc/claude.ipc.ts`: Uses same utilities
- `src/main/ipc/goal.ipc.ts`: Uses same utilities
- `src/main/ipc/agent.ipc.ts`: Uses same utilities
- `src/main/ipc/sync.ipc.ts`: Uses same utilities
- `src/main/ipc/index.ts`: Coordinates all handlers

**Tests:**
- Any test that mocks IPC uses the response structure defined here

### Data Flow

```
Renderer Process                    Main Process
================                    ============

React Component
      |
      | window.logos.goal.create(data)
      v
[preload.ts contextBridge]
      |
      | ipcRenderer.invoke('goal:create', data)
      v
===== IPC Channel =====
      |
      v
[ipcMain.handle('goal:create', handler)]
      |
      | Registered by contracts.ts
      v
Handler function
      |
      | Business logic (service calls, DB ops)
      v
success(data) or error(message)
      |
      v
IPCResponse<T> back to renderer
```

---

## Macroscale: System Integration

### Architectural Layer

This module is the **IPC Foundation** - all cross-process communication flows through patterns defined here:

```
+----------------------------------------------------------+
| Renderer: React Components                                |
| (uses window.logos API or direct ipcRenderer.invoke)      |
+----------------------------------------------------------+
                         |
                         | IPC Invoke
                         v
+----------------------------------------------------------+
| Preload: contextBridge                                    |
| (exposes safe API to renderer)                            |
+----------------------------------------------------------+
                         |
                         | ipcMain.handle
                         v
+----------------------------------------------------------+
| IPC Layer: contracts.ts + *.ipc.ts handlers              |  <-- You are here
| (THIS MODULE defines patterns, others implement)          |
+----------------------------------------------------------+
                         |
                         v
+----------------------------------------------------------+
| Services & Database                                       |
| (business logic, data persistence)                        |
+----------------------------------------------------------+
```

### Big Picture Impact

This module establishes **communication standards** for the entire application:

| Standard | What It Provides |
|----------|-----------------|
| Channel naming | Consistent `domain:action` format (e.g., `goal:create`) |
| Response wrapper | Always `{ success, data?, error? }` structure |
| Error handling | Automatic try/catch in all handlers |
| Type safety | Full TypeScript inference for requests/responses |
| Handler utilities | `success()`, `error()`, `registerHandler()` helpers |
| Validation helpers | `validateRequired()`, `validateUUID()`, etc. |

**Without This Module:**
- Each IPC handler would implement its own error handling
- Response formats would be inconsistent
- Channel names would be invented ad-hoc
- Type safety would be lost across the IPC boundary
- Testing would be harder (no standard mocking pattern)

### Critical Path Analysis

**Importance Level**: Critical (Communication Foundation)

- **If handler registration fails**: UI cannot communicate with backend
- **If response format is wrong**: UI cannot parse responses
- **If error handling breaks**: Errors silently fail

**Reliability Requirements**: This module must be rock-solid. Every user action that involves data persistence flows through IPC.

---

## Channel Organization

### Channel Naming Convention

All channels follow the pattern: `domain:action`

| Domain | Purpose | Examples |
|--------|---------|----------|
| `goal:` | Learning goal management | `goal:create`, `goal:list`, `goal:delete` |
| `session:` | Learning session control | `session:start`, `session:end`, `session:submit-response` |
| `queue:` | Learning queue operations | `queue:get`, `queue:refresh` |
| `object:` | Language object CRUD | `object:get`, `object:search`, `object:create` |
| `user:` | User profile management | `user:get-profile`, `user:update-settings` |
| `analytics:` | Progress and insights | `analytics:get-progress`, `analytics:get-bottlenecks` |
| `claude:` | AI content generation | `claude:generate-task`, `claude:evaluate-response` |
| `sync:` | Offline/online sync | `sync:status`, `sync:force` |
| `system:` | App-level operations | `system:get-info`, `system:backup` |
| `agent:` | Agent coordination | `agent:detect-triggers`, `agent:register-bottleneck` |
| `onboarding:` | New user setup | `onboarding:check-status`, `onboarding:complete` |

### Channel Constants

The `CHANNELS` object provides type-safe constants:

```typescript
export const CHANNELS = {
  GOAL_CREATE: 'goal:create',
  GOAL_UPDATE: 'goal:update',
  // ... 40+ channels
} as const;
```

**Why Constants**: Using `CHANNELS.GOAL_CREATE` instead of `'goal:create'`:
- Autocomplete in IDE
- Typos caught at compile time
- Refactoring updates all usages
- Single source of truth

---

## Response Pattern

### Standard Response Structure

All IPC handlers return the same shape:

```typescript
interface IPCResponse<T> {
  success: boolean;     // Did the operation succeed?
  data?: T;             // The result data (if success)
  error?: string;       // Error message (if failure)
}
```

**Why This Pattern**:
- Renderer always knows what to expect
- Error handling is explicit
- TypeScript can infer the data type
- Easy to check: `if (response.success) { use(response.data) }`

### Helper Functions

#### `success<T>(data: T): IPCResponse<T>`

Creates a success response:

```typescript
return success({ userId: '123', goalId: '456' });
// Returns: { success: true, data: { userId: '123', goalId: '456' } }
```

#### `error<T>(message: string): IPCResponse<T>`

Creates an error response:

```typescript
return error('Invalid email format');
// Returns: { success: false, error: 'Invalid email format' }
```

---

## Handler Registration

### Type-Safe Registration

```typescript
registerHandler<'goal:create'>(
  'goal:create',
  async (event, request) => {
    // request is typed as GoalCreateRequest
    // return type must be IPCResponse<GoalSpec>
  }
);
```

**How It Works**:
1. Channel name as generic parameter
2. TypeScript looks up types in `IPCHandlerMap`
3. Request and response types are inferred automatically
4. Compile error if types don't match

### Dynamic Registration

For channels not in `IPCHandlerMap`:

```typescript
registerDynamicHandler(
  'custom:channel',
  async (event, request) => {
    // request is `any`, response is `IPCResponse<any>`
  }
);
```

**When to Use**: New channels during development, experimental features, or channels that don't need strict typing.

### Error Boundary

Both registration functions wrap handlers with try/catch:

```typescript
ipcMain.handle(channel, async (event, request) => {
  try {
    return await handler(event, request);
  } catch (error) {
    console.error(`IPC Error [${channel}]:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});
```

**Why This Matters**: Unhandled errors in IPC handlers would crash the main process. The wrapper ensures errors are caught and returned as structured error responses.

---

## Validation Utilities

### `validateRequired(request, fields)`

Checks that required fields are present:

```typescript
const validationError = validateRequired(request, ['name', 'email']);
if (validationError) {
  return error(validationError);
}
```

### `validateNonEmpty(value, fieldName)`

Checks string is non-empty:

```typescript
const validationError = validateNonEmpty(request.name, 'name');
// Returns: null if valid, or "name must be a non-empty string"
```

### `validateRange(value, fieldName, min, max)`

Checks number is within bounds:

```typescript
const validationError = validateRange(request.rating, 'rating', 1, 5);
// Returns: null if valid, or "rating must be a number between 1 and 5"
```

### `validateUUID(value, fieldName)`

Checks string is valid UUID format:

```typescript
const validationError = validateUUID(request.id, 'id');
// Returns: null if valid, or "id must be a valid UUID"
```

---

## Request/Response Types

### Goal Operations

```typescript
// Create
Request:  { name, targetLanguage, nativeLanguage, description?, targetLevel? }
Response: GoalSpec

// Update
Request:  { id, name?, description?, targetLevel?, isActive? }
Response: GoalSpec

// List
Request:  { activeOnly?, limit?, offset? }
Response: GoalSpec[]
```

### Session Operations

```typescript
// Start
Request:  { goalId, sessionType: 'learn' | 'review' | 'mixed', targetDuration? }
Response: { sessionId, firstTask }

// Record Response
Request:  { sessionId, objectId, correct, cueLevel, responseTimeMs, errorComponents? }
Response: { feedback, nextTask }

// End
Request:  { sessionId }
Response: SessionSummary
```

### Analytics Operations

```typescript
// Get Progress
Request:  { goalId, timeRange?: 'day' | 'week' | 'month' | 'all' }
Response: { total, mastered, learning, accuracy, streak }

// Get Bottlenecks
Request:  { goalId, minResponses? }
Response: BottleneckAnalysis
```

---

## Technical Concepts (Plain English)

### IPC (Inter-Process Communication)

**Technical**: The mechanism by which separate processes exchange data and signals in an operating system, in Electron specifically the ipcMain/ipcRenderer API using message passing.

**Plain English**: The UI and backend are in separate "sandboxes." They can't share memory or call each other's functions directly. IPC is like passing notes - the UI writes a request, sends it through a channel, and the backend writes a response back.

**Why We Use It**: Security. The UI runs untrusted web code (could be from anywhere). By isolating it from system access and forcing all communication through defined channels, we prevent malicious code from accessing files, network, or other sensitive resources.

### Channel

**Technical**: A named message queue that ipcMain.handle() registers to receive and ipcRenderer.invoke() sends to.

**Plain English**: Like a mailbox with a name. The backend says "I'll answer questions sent to the 'goal:create' mailbox." The UI sends a message to that mailbox and waits for a response.

**Why Named Channels**: Organization. With 40+ different operations, having named channels keeps things organized. You know `goal:create` is about creating goals without looking at the code.

### Handler

**Technical**: An async function registered with ipcMain.handle() that receives requests and returns responses for a specific channel.

**Plain English**: The person who checks the mailbox and writes responses. When a message arrives at `goal:create`, the handler function runs, does the work (creates a goal in the database), and sends back the result.

### Type Safety Across IPC

**Technical**: Using TypeScript generics and mapped types to ensure compile-time checking of IPC request and response shapes, despite the runtime boundary between processes.

**Plain English**: Even though messages are serialized and sent over a wire (losing type information), TypeScript can still check that you're sending the right shape of data and expecting the right shape of response. It's like having a contract that both sides agree to follow.

**Why It Matters**: Without type safety, you could send `{ name: 'Goal' }` when the handler expects `{ goalName: 'Goal' }`. The error would only appear at runtime. With type safety, the compiler catches this immediately.

---

## Usage Patterns

### In IPC Handler Modules

```typescript
// onboarding.ipc.ts
import { registerDynamicHandler, success, error, validateRequired } from './contracts';

export function registerOnboardingHandlers() {
  registerDynamicHandler('onboarding:complete', async (event, request) => {
    const validation = validateRequired(request, ['nativeLanguage', 'targetLanguage']);
    if (validation) return error(validation);

    // ... business logic ...

    return success({ userId, goalId });
  });
}
```

### In Renderer (via preload)

```typescript
// In a React component
const result = await window.logos.goal.create({
  name: 'Learn Spanish',
  targetLanguage: 'es',
  nativeLanguage: 'en'
});

if (result.success) {
  console.log('Created goal:', result.data);
} else {
  console.error('Failed:', result.error);
}
```

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created shadow documentation for contracts.ts
- **Why**: IPC foundation requires documentation for understanding communication patterns
- **Impact**: Enables developers and AI agents to understand IPC architecture

### Historical Notes

- Channel constants mirror `IPC_CHANNELS` from `shared/types.ts`
- Both type-safe and dynamic registration available
- Validation utilities added to reduce boilerplate in handlers
