# LOGOS Architecture Guide

This document provides a comprehensive overview of the LOGOS codebase organization, making it easier to navigate, understand, and maintain.

## Quick Navigation

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/core/` | Pure algorithms (no I/O) | `irt.ts`, `fsrs.ts`, `pmi.ts`, `priority.ts` |
| `src/main/` | Electron main process | `index.ts`, `preload.ts` |
| `src/main/services/` | Business logic | `*-*.service.ts` |
| `src/main/ipc/` | IPC handlers | `*.ipc.ts` |
| `src/main/db/` | Database layer | `prisma.ts`, `repositories/` |
| `src/renderer/` | React UI | `App.tsx`, `pages/`, `components/` |
| `src/shared/` | Shared types | `types.ts` |
| `prisma/` | Database schema | `schema.prisma` |
| `docs/` | Documentation | `narrative/` mirrors `src/` |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOGOS ELECTRON APP                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐              ┌─────────────────────────────┐   │
│  │   RENDERER PROCESS  │              │      MAIN PROCESS           │   │
│  │   (React UI)        │              │      (Node.js)              │   │
│  │                     │              │                             │   │
│  │  ┌───────────────┐  │    IPC      │  ┌─────────────────────────┐│   │
│  │  │    Pages      │  │◄──────────►│  │     IPC Handlers        ││   │
│  │  │  - Dashboard  │  │              │  │  goal.ipc.ts           ││   │
│  │  │  - Session    │  │              │  │  session.ipc.ts        ││   │
│  │  │  - Analytics  │  │              │  │  learning.ipc.ts       ││   │
│  │  │  - Settings   │  │              │  │  claude.ipc.ts         ││   │
│  │  └───────────────┘  │              │  └──────────┬──────────────┘│   │
│  │         │           │              │             │               │   │
│  │  ┌───────────────┐  │              │  ┌──────────▼──────────────┐│   │
│  │  │  Components   │  │              │  │      Services           ││   │
│  │  │  - ui/        │  │              │  │  state-priority.service ││   │
│  │  │  - session/   │  │              │  │  task-generation.service││   │
│  │  │  - analytics/ │  │              │  │  scoring-update.service ││   │
│  │  │  - goal/      │  │              │  │  claude.service         ││   │
│  │  └───────────────┘  │              │  └──────────┬──────────────┘│   │
│  │         │           │              │             │               │   │
│  │  ┌───────────────┐  │              │  ┌──────────▼──────────────┐│   │
│  │  │   Hooks       │  │              │  │    Core Algorithms      ││   │
│  │  │  useLogos.ts  │  │              │  │  (Pure Functions)       ││   │
│  │  └───────────────┘  │              │  │  irt.ts, fsrs.ts, etc.  ││   │
│  │                     │              │  └──────────┬──────────────┘│   │
│  └─────────────────────┘              │             │               │   │
│                                        │  ┌──────────▼──────────────┐│   │
│                                        │  │    Database (SQLite)    ││   │
│                                        │  │    via Prisma ORM       ││   │
│                                        │  └─────────────────────────┘│   │
│                                        └─────────────────────────────┘   │
│                                                      │                   │
│                                                      │ HTTPS             │
│                                                      ▼                   │
│                                        ┌─────────────────────────────┐   │
│                                        │     Anthropic Claude API    │   │
│                                        └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Architecture

LOGOS uses a 4-tier architecture where each layer has clear responsibilities:

### Layer 0: Core Algorithms (`src/core/`)

**Purpose**: Pure computation with ZERO side effects

```
src/core/
├── index.ts              # Barrel export for all algorithms
├── types.ts              # Shared type definitions
│
├── # Learning Metrics
├── irt.ts                # Item Response Theory (ability estimation)
├── fsrs.ts               # Free Spaced Repetition Scheduler
├── pmi.ts                # Pointwise Mutual Information (corpus stats)
├── priority.ts           # FRE-based priority calculation
├── bottleneck.ts         # Error pattern detection
│
├── # Linguistic Analysis
├── morphology.ts         # Word structure analysis
├── g2p.ts                # Grapheme-to-phoneme conversion
├── syntactic.ts          # Grammar parsing
├── response-timing.ts    # Fluency metrics
│
├── # Submodules
├── content/              # Content generation specs
├── tasks/                # Task type library
├── grammar/              # Grammar sequence optimization
├── state/                # Component state management
└── register/             # Register profiling
```

**Key Principle**: All functions are pure - same input always produces same output.

---

### Layer 1: Services (`src/main/services/`)

**Purpose**: Business logic orchestration, I/O operations

```
src/main/services/
│
├── # 3-Layer Learning Pipeline
├── state-priority.service.ts      # Layer 1: Queue building
├── task-generation.service.ts     # Layer 2: Task creation
├── scoring-update.service.ts      # Layer 3: Response processing
├── fluency-versatility.service.ts # Balance control
│
├── # External Integration
├── claude.service.ts              # Anthropic API wrapper
├── offline-queue.service.ts       # Offline operation queue
├── pmi.service.ts                 # PMI database operations
│
├── # Agent System
├── agent-trigger.service.ts       # Bottleneck detection
├── agent-hooks.service.ts         # Operation hooks
│
├── # Corpus Management
└── corpus-sources/
    ├── registry.ts                # Available sources
    ├── filter.ts                  # Source selection
    └── corpus-pipeline.service.ts # Vocabulary population
```

**Naming Convention**: All services use `.service.ts` suffix.

---

### Layer 2: IPC Handlers (`src/main/ipc/`)

**Purpose**: Bridge between renderer and main process

```
src/main/ipc/
├── index.ts          # Handler registration
├── contracts.ts      # Type-safe IPC utilities
│
├── # Domain Handlers
├── goal.ipc.ts       # Goal CRUD operations
├── session.ipc.ts    # Training session management
├── learning.ipc.ts   # Learning queue operations
├── claude.ipc.ts     # AI content generation
├── agent.ipc.ts      # Agent coordination
└── sync.ipc.ts       # Offline sync operations
```

**Pattern**: Each handler file exports `register*Handlers()` and `unregister*Handlers()`.

---

### Layer 3: UI (`src/renderer/`)

**Purpose**: React-based user interface

```
src/renderer/
├── App.tsx           # Root component with routing
├── main.tsx          # Entry point
│
├── pages/            # Route-level components
│   ├── DashboardPage.tsx
│   ├── SessionPage.tsx
│   ├── GoalsPage.tsx
│   ├── AnalyticsPage.tsx
│   └── SettingsPage.tsx
│
├── components/       # Reusable UI components
│   ├── ui/           # Design system primitives
│   │   ├── GlassCard.tsx
│   │   ├── GlassButton.tsx
│   │   └── ...
│   ├── layout/       # App structure
│   │   ├── AppShell.tsx
│   │   └── Sidebar.tsx
│   ├── session/      # Training components
│   ├── goal/         # Goal management
│   ├── analytics/    # Data visualization
│   └── onboarding/   # First-run experience
│
├── hooks/            # Custom React hooks
│   └── useLogos.ts   # IPC communication hook
│
├── context/          # React context providers
│   └── AppContext.tsx
│
└── styles/           # CSS files
    ├── globals.css
    ├── design-tokens.css
    └── glass.css
```

---

## Data Flow

### Learning Session Flow

```
User clicks "Start Session"
         │
         ▼
┌─────────────────────┐
│  SessionPage.tsx    │  UI Layer
└─────────┬───────────┘
          │ IPC: session:start
          ▼
┌─────────────────────┐
│  session.ipc.ts     │  IPC Layer
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ state-priority      │  Service Layer 1
│ .service.ts         │  Build learning queue
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ task-generation     │  Service Layer 2
│ .service.ts         │  Generate task content
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Core Algorithms     │  Core Layer
│ irt.ts, priority.ts │  Pure calculations
└─────────────────────┘
```

### Response Processing Flow

```
User submits answer
         │
         ▼
┌─────────────────────┐
│  QuestionCard.tsx   │
└─────────┬───────────┘
          │ IPC: session:submit-response
          ▼
┌─────────────────────┐
│  session.ipc.ts     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ scoring-update      │  Evaluate response
│ .service.ts         │  Update mastery
└─────────┬───────────┘
          │
          ├──────────────────────────┐
          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│ fsrs.ts             │    │ bottleneck.ts       │
│ Schedule next review│    │ Detect error patterns│
└─────────────────────┘    └─────────────────────┘
```

---

## Import Conventions

### Path Aliases (tsconfig.json)

```typescript
// Use aliases for cross-layer imports
import { probability2PL } from '@core/irt';
import { getLearningQueue } from '@main/services';
import { GlassButton } from '@renderer/components/ui';
import type { GoalSpec } from '@shared/types';
```

### Barrel Exports

Each major directory has an `index.ts` that re-exports its contents:

```typescript
// Import from barrel (preferred)
import { IRT, FSRS, PMI } from '@core';

// Import specific module (when needed)
import { probability2PL } from '@core/irt';
```

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Service | `kebab-case.service.ts` | `task-generation.service.ts` |
| IPC Handler | `kebab-case.ipc.ts` | `session.ipc.ts` |
| React Component | `PascalCase.tsx` | `GlassButton.tsx` |
| React Page | `PascalCasePage.tsx` | `DashboardPage.tsx` |
| Hook | `useCamelCase.ts` | `useLogos.ts` |
| Types | `types.ts` or inline | `types.ts` |
| Tests | `*.test.ts` | `irt.test.ts` |

---

## Database Structure

### Prisma Schema Location

```
prisma/
├── schema.prisma     # Database schema definition
├── seed.ts           # Seed data script
└── data/             # Seed data files
```

### Repository Pattern

```
src/main/db/
├── client.ts         # Prisma client initialization
├── prisma.ts         # Prisma configuration
└── repositories/     # Domain-specific data access
    ├── goal.repository.ts
    ├── session.repository.ts
    ├── mastery.repository.ts
    ├── collocation.repository.ts
    └── error-analysis.repository.ts
```

---

## Common Tasks

### Adding a New Algorithm

1. Create file in `src/core/` (e.g., `my-algorithm.ts`)
2. Export from `src/core/index.ts`
3. Add tests in `src/core/__tests__/my-algorithm.test.ts`
4. Create narrative doc in `docs/narrative/src/core/my-algorithm.md`

### Adding a New Service

1. Create `src/main/services/my-feature.service.ts`
2. Export from `src/main/services/index.ts`
3. Create IPC handler if UI needs access

### Adding a New UI Component

1. Create in appropriate `src/renderer/components/` subdirectory
2. Follow Glass design system patterns
3. Use `useLogos()` hook for data fetching

### Adding a New IPC Channel

1. Add channel name to `IPC_CHANNELS` in `src/shared/types.ts`
2. Add request/response types to `IPCHandlerMap`
3. Create handler in appropriate `*.ipc.ts` file
4. Add to preload API if needed

---

## Testing

```
src/core/__tests__/     # Unit tests for core algorithms
e2e/                    # End-to-end Playwright tests
tests/                  # Additional test utilities
```

Run tests:
```bash
npm test              # Run unit tests
npm run test:e2e      # Run E2E tests
```

---

## Documentation

```
docs/
├── narrative/        # Shadow documentation (mirrors src/)
│   ├── src/
│   │   ├── core/     # Algorithm explanations
│   │   ├── main/     # Service documentation
│   │   └── renderer/ # UI documentation
│   └── prisma/       # Database documentation
│
├── # Root-level docs
├── DEVELOPMENT-PROTOCOL.md   # Development guidelines
├── AGENT-MANIFEST.md         # Agent coordination
├── ALGORITHMIC-FOUNDATIONS.md # Algorithm specs
├── THEORETICAL-FOUNDATIONS.md # Learning theory
└── FINAL-SPEC.md             # Product specification
```

---

## Quick Reference

### Key Entry Points

| What | Where |
|------|-------|
| App starts | `src/main/index.ts` |
| UI renders | `src/renderer/main.tsx` |
| IPC registered | `src/main/ipc/index.ts` |
| Types defined | `src/shared/types.ts` + `src/core/types.ts` |

### Key Algorithms

| Algorithm | File | Purpose |
|-----------|------|---------|
| IRT | `src/core/irt.ts` | Ability estimation |
| FSRS | `src/core/fsrs.ts` | Spaced repetition scheduling |
| PMI | `src/core/pmi.ts` | Collocation strength |
| Priority | `src/core/priority.ts` | Learning queue ordering |
| Bottleneck | `src/core/bottleneck.ts` | Error root cause detection |

### Key Services

| Service | Purpose |
|---------|---------|
| `state-priority.service` | Build and manage learning queue |
| `task-generation.service` | Create exercises |
| `scoring-update.service` | Process responses, update mastery |
| `claude.service` | AI content generation |
| `offline-queue.service` | Handle offline operations |
