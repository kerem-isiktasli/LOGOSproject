# Prisma Database Client

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/db/client.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to provide a **singleton database connection** for the entire LOGOS Electron application. It solves two critical infrastructure challenges:

1. **Connection Pooling**: Databases have a limited number of connections. Without a singleton, every file that needs database access would create its own connection, quickly exhausting the pool.

2. **Hot Module Replacement (HMR) Leak Prevention**: During development, when you save a file, the bundler reloads modules. Without special handling, each reload would create a NEW database connection while leaving the old one open - a memory leak that crashes the app after enough saves.

**Business Need**: Every feature in LOGOS that persists data (learning sessions, user progress, goals, mastery states) depends on reliable database access. This module is the foundation that makes all data persistence possible.

**When Used**:
- At application startup (via `initDatabase()`)
- Every time any code needs to read/write to the database (via the exported `prisma` client)
- At application shutdown (via automatic graceful shutdown handlers)

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)
- `@prisma/client`: PrismaClient class - The auto-generated type-safe database client from Prisma ORM
- `prisma/schema.prisma`: Schema definition - Defines all database tables, relationships, and types (not imported directly, but generates the client)

### Dependents (What Needs This)

**Main Entry Point:**
- `src/main/index.ts`: Calls `initDatabase()` during app startup to ensure database is ready before any features load

**IPC Handlers (API Layer):**
- `src/main/ipc/claude.ipc.ts`: Uses `prisma` for AI-related data operations
- `src/main/ipc/goal.ipc.ts`: Uses `prisma` for learning goal CRUD operations
- `src/main/ipc/learning.ipc.ts`: Uses `prisma` for learning session data
- `src/main/ipc/onboarding.ipc.ts`: Uses `prisma` for user setup data
- `src/main/ipc/session.ipc.ts`: Uses `prisma` for practice session tracking

**Note on Repository Pattern:**
The codebase has two database access patterns:
1. **Direct client usage** (`client.ts`) - Used by IPC handlers
2. **Repository pattern** (`prisma.ts` + repositories) - Used by service layer

This file serves the direct access pattern. The `prisma.ts` file provides the same singleton pattern but with additional transaction helpers.

### Data Flow
```
Application Start
       |
       v
initDatabase() called in index.ts
       |
       v
PrismaClient.$connect() opens database connection
       |
       v
prisma client available globally via singleton
       |
       v
IPC handlers import and use prisma for queries
       |
       v
Application Exit triggers SIGINT/SIGTERM
       |
       v
gracefulShutdown() closes connection cleanly
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Data Access Layer** of the LOGOS three-tier Electron architecture:

```
Layer 1: Renderer Process (React UI)
         |
         | IPC Messages
         v
Layer 2: Main Process IPC Handlers
         |
         | prisma client calls
         v
Layer 3: THIS MODULE (Database Access)  <-- You are here
         |
         | SQL via Prisma
         v
Layer 4: SQLite Database (logos.db)
```

### Big Picture Impact

This module is the **single point of database access** for the entire application. It enables:

- **User Profile System**: All user data, preferences, and theta ability scores
- **Learning Goals**: Goal creation, tracking, and completion status
- **Session Recording**: Every practice session and individual response
- **Mastery Tracking**: FSRS scheduling states for spaced repetition
- **Collocation Learning**: PMI-scored phrase patterns and usage examples
- **Error Analysis**: AI-generated error explanations and patterns
- **Progress Analytics**: Historical data for charts and statistics

### Critical Path Analysis

**Importance Level**: CRITICAL

This is a **foundational module** - if it fails, the entire application cannot function:

| Failure Mode | Impact |
|--------------|--------|
| Connection fails at startup | App cannot start - no data access |
| Connection drops mid-session | All learning progress lost, app crashes |
| Multiple instances created | Memory exhaustion, database locks, corruption risk |
| No graceful shutdown | Data corruption, incomplete writes |

**Failure Recovery**: The singleton pattern with global storage ensures resilience during development. Production uses environment-based logging to catch issues early.

---

## Technical Concepts (Plain English)

### Singleton Pattern
**Technical**: A design pattern ensuring only one instance of a class exists throughout the application lifecycle, accessed via a shared reference.

**Plain English**: Imagine a water cooler in an office. Everyone goes to the SAME water cooler rather than each person having their own. This singleton is like that one water cooler - there is only one database connection, and everyone shares it.

**Why We Use It**: Creating database connections is expensive (takes time and memory). Sharing one connection is efficient and prevents resource exhaustion.

### Global Object Storage (globalThis)
**Technical**: Using `globalThis` to store the client reference survives module reloads during Hot Module Replacement in development.

**Plain English**: When you save a file during development, Node.js reloads your code. But some things need to survive this reload - like your database connection. Storing it on `globalThis` is like putting it in a "safe room" that the reload process does not touch.

**Why We Use It**: Prevents the "connection leak" problem where each code reload creates a new connection while the old one stays open.

### Nullish Coalescing Operator (??)
**Technical**: Returns the right-hand operand when the left-hand operand is `null` or `undefined`, otherwise returns the left-hand operand.

**Plain English**: The code says "use the existing database connection IF we have one, OTHERWISE create a new one." It is like checking if there is coffee in the pot before making a fresh batch.

**Why We Use It**: Efficiently implements the "create only if needed" logic in a single, readable expression.

### Graceful Shutdown
**Technical**: Registering handlers for SIGINT and SIGTERM signals to properly close database connections before the process exits.

**Plain English**: When you close the app (or press Ctrl+C in terminal), the system sends a "please stop" signal. This module listens for that signal and properly says goodbye to the database before shutting down - like a polite guest who cleans up before leaving a party.

**Why We Use It**: Abruptly killing a database connection can leave data in an inconsistent state or cause file corruption. Graceful shutdown ensures all pending writes complete.

### Connection Pooling
**Technical**: Prisma manages a pool of database connections internally, reusing them for queries rather than opening a new connection for each query.

**Plain English**: Instead of making a new phone call for every question you have, you keep the phone line open and ask multiple questions in one call. The "pool" is a set of open phone lines ready to use.

**Why We Use It**: Opening a database connection takes ~50-200ms. With pooling, queries can start immediately using pre-opened connections, making the app feel faster.

### Environment-Aware Logging
**Technical**: The `log` configuration in PrismaClient changes based on `NODE_ENV`, showing detailed query logs in development but only errors in production.

**Plain English**: In development, you want to see everything the database is doing (like having security cameras everywhere). In production, you only want to know when something goes wrong (like having an alarm system). This code adjusts the "visibility level" based on context.

**Why We Use It**: Detailed logs help debug issues during development but would slow down production and fill up log storage with unnecessary data.

---

## Design Decisions

### Why Two Database Modules? (client.ts vs prisma.ts)

The codebase has both `client.ts` and `prisma.ts`. This appears to be an evolution:

1. **client.ts** (this file): Original singleton with direct export, used by IPC handlers
2. **prisma.ts**: Newer implementation with transaction helpers, used by repository pattern

Both solve the same singleton problem. The repository layer uses `prisma.ts` for its `withTransaction()` helper. IPC handlers use `client.ts` for simpler direct access.

**Recommendation**: Future work should consolidate to a single database access module to avoid confusion.

### Why SQLite?

LOGOS is a desktop Electron app. SQLite is the ideal choice because:
- **No server required**: Database is a single file in user data folder
- **Zero configuration**: Works immediately after install
- **Portable**: User can backup/restore by copying one file
- **Fast for single-user**: No network latency, direct disk access

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Created shadow documentation for database client module
- **Why**: Part of Shadow Map documentation initiative
- **Impact**: Improves codebase understanding for future developers

### Initial Implementation
- **What Changed**: Created singleton Prisma client with HMR survival and graceful shutdown
- **Why**: LOGOS needed reliable database access across all features
- **Impact**: Enabled all data persistence features (goals, sessions, mastery, etc.)
