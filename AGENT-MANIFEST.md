# LOGOS Agent Coordination Manifest

## Purpose

This document ensures all agents work coherently toward the same product vision. Every agent MUST reference this before making changes.

---

## Product Truth Source

| Question | Answer | Source Document |
|----------|--------|-----------------|
| What is LOGOS? | Learning control engine for language usage space expansion | FINAL-SPEC.md |
| What's the architecture? | Electron desktop app (no separate backend) | DEVELOPMENT-PROTOCOL.md |
| What algorithms do we use? | IRT, PMI, FSRS, bottleneck detection | ALGORITHMIC-FOUNDATIONS.md |
| What's the core data model? | GoalSpec → LanguageObject → MasteryState | ALGORITHMIC-FOUNDATIONS.md Part 4 |
| What npm packages? | ts-fsrs, @anthropic-ai/sdk, prisma, better-sqlite3 | REFERENCE-IMPLEMENTATIONS.md |

---

## Coherence Rules

### Rule 1: Layer Boundaries

```
UI (React) ──IPC──► Main Process ──Prisma──► SQLite
                         │
                         └──async──► Claude API (optional)
```

**Violations to detect:**
- ❌ UI directly accessing database
- ❌ UI holding API keys
- ❌ Main process with React dependencies
- ❌ Synchronous Claude API calls blocking UI

### Rule 2: Algorithm Purity

All algorithms in `/src/core/` MUST be:
- Pure functions (same input → same output)
- No external dependencies (no fetch, no db)
- Individually testable

**Files that must stay pure:**
- `irt.ts` - θ estimation, item selection
- `pmi.ts` - PMI computation, difficulty mapping
- `fsrs.ts` - Spaced repetition scheduling
- `priority.ts` - FRE calculation
- `bottleneck.ts` - Error pattern analysis

### Rule 3: Schema Authority

The Prisma schema in ALGORITHMIC-FOUNDATIONS.md Part 4 is the **single source of truth** for data structures.

**Before any agent modifies data:**
1. Check if schema supports the change
2. If not, propose schema migration FIRST
3. Get approval before implementation

### Rule 4: Naming Conventions

| Concept | Code Name | Never Use |
|---------|-----------|-----------|
| User ability | `theta` or `θ` | `score`, `level`, `ability` |
| Learning priority | `priority` | `weight`, `importance` |
| Item difficulty | `irtDifficulty` | `hardness`, `difficulty` alone |
| Frequency metric | `frequency` (F) | `count`, `occurrences` |
| Relational metric | `relationalDensity` (R) | `connections`, `links` |
| Contextual metric | `contextualContribution` (E) | `importance`, `meaning` |

---

## Agent Responsibilities

### On Every Code Change

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Check: Does this align with FINAL-SPEC.md user stories? │
│ 2. Check: Does this follow DEVELOPMENT-PROTOCOL.md rules?  │
│ 3. Check: Are algorithms from ALGORITHMIC-FOUNDATIONS.md?  │
│ 4. Check: Are packages from REFERENCE-IMPLEMENTATIONS.md?  │
│ 5. If any NO → STOP and flag the conflict                  │
└─────────────────────────────────────────────────────────────┘
```

### Agent-Specific Checks

| Agent | Before Acting, Verify |
|-------|----------------------|
| `frontend-specialist` | UI matches FINAL-SPEC.md mockups |
| `api-specialist` | IPC contracts match Prisma schema |
| `database-specialist` | Schema matches ALGORITHMIC-FOUNDATIONS.md |
| `security-specialist` | No API keys in renderer process |
| `debug-git-specialist` | Commit message references which spec it implements |

---

## Bottleneck Detection Protocol

### Development Bottlenecks (Meta-Level)

When any agent encounters a blocker:

```typescript
interface DevelopmentBottleneck {
  type: 'missing_spec' | 'conflicting_docs' | 'missing_algorithm' |
        'dependency_issue' | 'integration_failure';
  location: string;      // File or component
  blockedBy: string;     // What's missing or conflicting
  proposedFix: string;   // Suggested resolution
  affectedAgents: string[];
}
```

**Escalation Path:**
1. Agent detects blocker → logs to this format
2. Main Claude reviews → decides priority
3. If spec conflict → update spec docs FIRST
4. If implementation issue → targeted agent fixes
5. If architectural issue → all agents pause, redesign

### Code Quality Bottlenecks

Run after each phase checkpoint:

```
Checks:
├── TypeScript compiles with strict mode
├── All pure functions have unit tests
├── IPC handlers have type contracts
├── No circular dependencies
├── Database migrations are reversible
└── Offline mode works for all core features
```

---

## File Structure (Target)

```
logos/
├── docs/                          # Spec documents (already done)
│   ├── FINAL-SPEC.md
│   ├── THEORETICAL-FOUNDATIONS.md
│   ├── DEVELOPMENT-PROTOCOL.md
│   ├── ALGORITHMIC-FOUNDATIONS.md
│   ├── REFERENCE-IMPLEMENTATIONS.md
│   ├── GAPS-AND-CONNECTIONS.md
│   └── AGENT-MANIFEST.md          # This file
│
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # Entry point
│   │   ├── ipc/                   # IPC handlers
│   │   │   ├── contracts.ts       # Typed IPC contracts
│   │   │   ├── goal.ipc.ts
│   │   │   ├── learning.ipc.ts
│   │   │   └── session.ipc.ts
│   │   ├── services/              # External services
│   │   │   ├── claude.service.ts
│   │   │   └── offline.service.ts
│   │   └── db/                    # Database
│   │       ├── schema.prisma
│   │       └── client.ts
│   │
│   ├── core/                      # Pure algorithms (NO dependencies)
│   │   ├── irt.ts                 # From ALGORITHMIC-FOUNDATIONS Part 1
│   │   ├── pmi.ts                 # From ALGORITHMIC-FOUNDATIONS Part 2
│   │   ├── fsrs.ts                # From ALGORITHMIC-FOUNDATIONS Part 3
│   │   ├── priority.ts            # FRE calculation
│   │   ├── bottleneck.ts          # From ALGORITHMIC-FOUNDATIONS Part 7
│   │   └── types.ts               # Shared type definitions
│   │
│   ├── renderer/                  # React UI
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TrainingGym.tsx
│   │   │   ├── NetworkView.tsx
│   │   │   └── Analytics.tsx
│   │   ├── components/
│   │   └── hooks/
│   │       └── useIPC.ts          # Bridge to main process
│   │
│   └── shared/                    # Shared between main/renderer
│       └── types.ts               # IPC message types
│
├── tests/
│   ├── core/                      # Algorithm unit tests
│   ├── integration/               # IPC + DB tests
│   └── e2e/                       # Full app tests
│
└── package.json
```

---

## Development Workflow

### Starting a New Feature

```
1. Which user story in FINAL-SPEC.md?
   └── If none → create user story first

2. Which algorithms needed (ALGORITHMIC-FOUNDATIONS.md)?
   └── If missing → add algorithm spec first

3. Which agent(s) implement this?
   └── Assign based on layer touched

4. Implementation order:
   a. Core algorithm (if new) → test
   b. Database schema (if new) → migrate
   c. IPC handler → test
   d. UI component → test
   e. Integration test

5. Commit with reference:
   "feat(training): implement bottleneck detection

    Implements FINAL-SPEC.md Section X
    Algorithm from ALGORITHMIC-FOUNDATIONS.md Part 7"
```

### Detecting Drift

Weekly coherence check:

```
For each source file:
├── Does it have a corresponding spec reference?
├── Are all imported algorithms from /core/?
├── Are all types from /shared/ or /core/types?
├── Is there a test file?
└── Does the implementation match the spec?
```

---

## Emergency Protocols

### If Main Process Crashes
- SQLite data is safe (file-based)
- Renderer shows "Reconnecting..." state
- Auto-restart main process

### If Claude API Fails
- All features work offline
- Queue content generation requests
- Use cached/template tasks
- Sync when back online

### If Database Corrupts
- SQLite WAL mode prevents most corruption
- Daily automatic backups
- User can export/import data as JSON

### If Agent Produces Conflicting Code
- Git branch per agent task
- Main Claude reviews before merge
- Conflicts block merge until resolved
- Never force-push to main

---

*Manifest Version: 1.0*
*Created: 2026-01-04*
*Purpose: Ensure agent coordination and development coherence*
