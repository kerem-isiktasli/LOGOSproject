# IPC Request/Response Schemas

> **Last Updated**: 2026-01-06
> **Code Location**: `src/shared/schemas/ipc-schemas.ts`
> **Status**: Active

---

## Context & Purpose

This module exists as the **runtime validation layer** for all communication between the Electron renderer process (the user interface) and the main process (where business logic and database access happen). While TypeScript provides compile-time type checking, it cannot catch malformed data at runtime - and in an Electron app, the renderer and main processes are essentially separate programs that exchange serialized data.

**Business Need**: Users interact with complex learning features (creating goals, recording responses, importing vocabulary). Invalid data could corrupt the database, crash the application, or produce incorrect learning recommendations. This module prevents "garbage in, garbage out" by ensuring every IPC request meets strict validation rules before processing.

**When Used**: Every single IPC call from the renderer goes through these schemas. When a user clicks "Start Session", imports vocabulary, records a response, or performs any action - the request data is validated against these schemas before the main process handles it.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `zod` (npm package): The runtime schema validation library that powers all validators. Zod provides declarative schema definitions that generate both validators and TypeScript types.

### Dependents (What Needs This)

- `src/main/ipc/learning.ipc.ts`: Imports and uses `QueueGetSchema`, `ObjectCreateSchema`, `ObjectUpdateSchema`, `ObjectListSchema`, `ObjectImportSchema`, `ObjectSearchSchema`, and the `validateInput` helper to validate incoming requests before database operations.

- `src/main/ipc/contracts.ts`: Defines the IPC handler infrastructure. While it has its own simpler validators, the Zod schemas in this file provide more robust validation with better error messages.

- `src/main/preload.ts`: Exposes the API to the renderer - requests from here flow through handlers that use these schemas.

### Data Flow

```
Renderer UI (React)
    |
    | User action triggers API call
    v
preload.ts (contextBridge)
    |
    | ipcRenderer.invoke(channel, data)
    v
IPC Handler (main process)
    |
    | validateInput(Schema, data) <-- THIS FILE
    |
    +--[Invalid]--> Return error response
    |
    +--[Valid]--> Continue to business logic
```

---

## Macroscale: System Integration

### Architectural Role

This module sits at the **IPC Boundary Layer** - the critical checkpoint between untrusted renderer input and trusted main process operations.

```
Architecture Layers:
-----------------------------------------
Layer 1: UI (React Components)
    |
    v [IPC Call]
-----------------------------------------
Layer 2: IPC Boundary (contextBridge + preload)
    |
    v [Serialized Data]
-----------------------------------------
>>> Layer 3: Schema Validation (THIS MODULE) <<<
    |
    +--[Invalid]--> Error Response
    |
    v [Validated Data]
-----------------------------------------
Layer 4: IPC Handlers (business logic)
    |
    v [Database Operations]
-----------------------------------------
Layer 5: Database (Prisma + SQLite)
-----------------------------------------
```

### Big Picture Impact

Without this module, the entire application's data integrity is at risk. It enables:

1. **Safe database operations**: Prevents SQL injection-like issues and data corruption
2. **Meaningful error messages**: Users see "goalId must be a valid UUID" instead of cryptic database errors
3. **Type inference**: The exported types (`QueueGetRequest`, `ObjectCreateRequest`, etc.) provide TypeScript types derived directly from runtime validators, eliminating type/validation drift
4. **Default values**: Schema defaults (like `sessionSize: 20`, `newItemRatio: 0.3`) ensure consistent behavior even when optional fields are omitted

### Critical Path Analysis

**Importance Level**: Critical

- **If this fails**: Invalid data reaches the database layer, causing either crashes, corrupted learning records, or incorrect algorithm outputs (bad IRT calculations, wrong scheduling)
- **Security surface**: This is the first line of defense against malformed input from the renderer
- **Performance**: Zod validation is fast (<1ms per validation), but runs on every IPC call - keeping schemas efficient matters

---

## Technical Concepts (Plain English)

### Zod Schema Validation

**Technical**: A TypeScript-first schema declaration and validation library that provides runtime type checking with automatic TypeScript type inference.

**Plain English**: Think of it like a security checkpoint at an airport. TypeScript is like the booking system that says "this ticket should have a name and seat number." Zod is the actual guard who checks your ticket at the gate - even if someone forged a ticket that looks right, Zod catches it because it checks the actual values, not just the structure.

**Why We Use It**: Because TypeScript types are erased at runtime. When data crosses the IPC boundary (renderer to main), TypeScript can't help - we need actual runtime checks.

### UUID Validation

**Technical**: Validates strings conform to UUID v4 format (8-4-4-4-12 hexadecimal character pattern with specific version bits).

**Plain English**: Every learning object, goal, and session has a unique ID like a social security number. This validator ensures someone can't pass "hello" or "12345" as an ID - it must be a properly formatted universal unique identifier.

**Why We Use It**: IDs are the backbone of database lookups. Invalid IDs would cause "not found" errors at best, or match wrong records at worst.

### Ratio Schema (0-1)

**Technical**: Validates numbers are within the [0, 1] interval, typically representing probabilities or proportions.

**Plain English**: Like a volume slider that only goes from off (0) to maximum (100%). Many learning metrics are expressed as ratios - accuracy (0.85 = 85%), difficulty (0.7 = 70% challenging), item frequency in language. This ensures no one passes 150% or -20%.

**Why We Use It**: The IRT (Item Response Theory) and FSRS (Free Spaced Repetition Scheduler) algorithms expect values in this range. Out-of-range values would produce mathematically invalid results.

### Schema Refinements

**Technical**: Zod's `.refine()` method adds custom validation logic beyond simple type/range checks.

**Plain English**: Like a bouncer with special instructions beyond "check IDs." The `ObjectUpdateSchema` uses refinement to ensure at least one field is being updated - otherwise, what's the point of an update call?

**Why We Use It**: Some validations require cross-field logic (like "if A is provided, B must also be provided") that can't be expressed with simple type constraints.

### Type Inference from Schemas

**Technical**: Using `z.infer<typeof Schema>` to derive TypeScript types from Zod schemas, ensuring runtime validation and compile-time types stay synchronized.

**Plain English**: Instead of writing the same rules twice (once for TypeScript, once for validation), we write it once in Zod and extract the TypeScript type automatically. If we update the schema, the type updates too - no risk of them getting out of sync.

**Why We Use It**: Eliminates a whole class of bugs where "the code compiles but the validation rejects it" or vice versa.

---

## Schema Categories

### Common Validators

Reusable building blocks used across multiple schemas:
- `uuidSchema`: UUID v4 format
- `positiveInt`: Positive integers (1, 2, 3...)
- `nonNegativeInt`: Zero or positive (0, 1, 2...)
- `percentageSchema`: 0-100 range
- `ratioSchema`: 0-1 range
- `nonEmptyString`: String with at least one character

### Learning IPC Schemas

Handle vocabulary/learning object management:
- `QueueGetSchema`: Build learning queue for a session
- `ObjectCreateSchema`: Create new vocabulary items
- `ObjectUpdateSchema`: Modify existing items
- `ObjectListSchema`: List items with pagination
- `ObjectImportSchema`: Bulk import (1-10,000 items)
- `ObjectSearchSchema`: Search within goal's vocabulary

### Session IPC Schemas

Handle learning session lifecycle:
- `SessionStartSchema`: Begin a learning/review session
- `SessionEndSchema`: Complete a session
- `RecordResponseSchema`: Record user's answer to a task
- `SessionSummarySchema`: Get session statistics

### Goal IPC Schemas

Handle learning goal management:
- `GoalCreateSchema`: Create new learning goal
- `GoalUpdateSchema`: Modify goal settings

### Onboarding IPC Schemas

Handle new user setup:
- `OnboardingCompleteSchema`: Complete onboarding wizard data

### Claude IPC Schemas

Handle AI-powered features:
- `ClaudeGenerateTaskSchema`: Request AI-generated tasks
- `ClaudeAnalyzeErrorSchema`: Analyze user errors
- `ClaudeGetHintSchema`: Get progressive hints

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial narrative documentation for this module
- **Why**: Shadow documentation system requirement
- **Impact**: Developers now have context for schema validation layer

### Initial Implementation
- **What Changed**: Created comprehensive Zod schemas for all IPC channels
- **Why**: Need runtime validation for Electron IPC communication to ensure data integrity
- **Impact**: All IPC handlers can safely assume validated input; users get meaningful error messages for invalid requests
