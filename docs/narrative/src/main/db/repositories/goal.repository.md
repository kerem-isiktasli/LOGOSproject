# Goal Repository - Learning Goal Data Access

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/db/repositories/goal.repository.ts`
> **Status**: Active

---

## Why This Exists

A **learning goal** is the central organizing concept in LOGOS. Users don't just "learn vocabulary" - they learn vocabulary for a specific purpose: passing IELTS, working in healthcare, writing academic papers. Each goal has a domain, modalities (reading, writing, speaking, listening), genre, purpose, and optional benchmark exam.

This repository provides the **data access layer** for goals and their associated language objects. It abstracts database operations (Prisma/SQLite) behind a clean interface, ensuring:

1. **Consistent data handling**: Modality arrays are JSON-serialized consistently
2. **Business logic encapsulation**: Progress calculation lives here, not in IPC handlers
3. **Automatic enrichment**: Morphological/phonological scores calculated on insert
4. **Type safety**: Input/output types are explicitly defined

**Business Impact**: Every learning session, every vocabulary item, every progress metric is organized around goals. This repository is the foundation of LOGOS's ability to provide personalized, goal-oriented learning.

---

## Key Concepts

### GoalSpec Entity

**Technical Definition**: A `GoalSpec` record in the database representing a user's learning objective. Contains domain, modality (JSON array), genre, purpose, optional benchmark, optional deadline, completion percentage, and active status.

**Plain English**: A goal is like a course syllabus - it describes what you want to learn (domain), how you'll learn it (modalities), what type of content (genre), why you're learning (purpose), and optionally what test you're preparing for (benchmark).

### Language Object Association

**Technical Definition**: Each goal has many `LanguageObject` records (vocabulary, grammar patterns, etc.) linked via `goalId` foreign key. Objects inherit goal context for domain-appropriate learning.

**Plain English**: A goal contains your study materials - the specific words, phrases, and patterns you'll practice. Each item knows which goal it belongs to.

### Automatic Score Calculation

**Technical Definition**: When adding language objects, the repository automatically calculates `morphologicalScore` (affix complexity) and `phonologicalDifficulty` (pronunciation complexity) if not provided, using `computeMorphologicalScore()` and local analysis functions.

**Plain English**: When you add a word, the system automatically figures out how hard it is to spell and pronounce. This helps the learning algorithm pick easier words first.

### Mastery State Initialization

**Technical Definition**: Progress tracking requires `MasteryState` records linking users to objects. The repository ensures these exist when objects are added to goals.

**Plain English**: Every vocabulary item gets a "progress card" that tracks how well you know it. This is created automatically when vocabulary is added.

---

## Design Decisions

### Why JSON Serialize Modalities?

The `modality` field stores an array like `["reading", "writing"]` but SQLite doesn't support arrays. The repository handles JSON serialization/deserialization transparently.

**Trade-off**: Query complexity (can't easily filter by modality in SQL) vs. schema simplicity (single column).

### Why Calculate Phonological Difficulty Locally?

The `calculatePhonologicalDifficulty()` function is defined inline rather than importing from `src/core/g2p`.

**Reason**: Avoid circular dependencies. The repository is a low-level module; core algorithms shouldn't depend on it, and it shouldn't heavily depend on core algorithms. A simplified local calculation is sufficient for initial scoring.

### Why Bulk Update Priorities in Transaction?

`bulkUpdatePriorities()` wraps all updates in a Prisma transaction.

**Reason**: Priority recalculation updates hundreds of objects simultaneously. A transaction ensures either all succeed or all fail, preventing partially-updated states that could confuse the scheduling algorithm.

### Why Update Completion Percent in calculateGoalProgress?

The function both returns progress data AND updates the `GoalSpec.completionPercent` field.

**Reason**: Ensures the denormalized completion percentage stays in sync with actual progress. Callers don't need to remember to update separately.

### Why Return void for Delete?

`deleteGoal()` returns `Promise<void>` rather than the deleted record.

**Reason**: Cascade deletes remove the goal and all associated objects, mastery states, sessions, etc. There's no meaningful return value - success is indicated by no exception.

---

## Integration Points

### Prisma Schema Mapping

| Repository Type | Prisma Model | Key Fields |
|----------------|--------------|------------|
| `CreateGoalInput` | `GoalSpec` | userId, domain, modality, genre, purpose, benchmark?, deadline? |
| `UpdateGoalInput` | `GoalSpec` | All fields optional except id |
| `GoalWithObjects` | `GoalSpec` + relations | Includes languageObjects[] and _count |
| `GoalProgress` | Computed | Aggregated from MasteryState data |

### Upstream Dependencies

| Module | Import | Purpose |
|--------|--------|---------|
| `@prisma/client` | `GoalSpec`, `LanguageObject`, `Prisma` | Type definitions |
| `../prisma` | `getPrisma` | Database client access |
| `../../../core/morphology` | `computeMorphologicalScore`, `getMorphologicalComplexity` | Auto-scoring |

### Downstream Consumers

| Consumer | Functions Used |
|----------|----------------|
| `src/main/ipc/goal.ipc.ts` | All CRUD operations |
| `src/main/services/corpus-sources/corpus-pipeline.service.ts` | `addLanguageObjectsToGoal` for population |
| `src/main/services/state-priority.service.ts` | `getLanguageObjects` for queue building |
| `src/main/services/scoring-update.service.ts` | Progress calculations |

### Function Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `createGoal(input)` | Create new goal | `GoalSpec` |
| `getGoalById(goalId)` | Fetch single goal | `GoalSpec | null` |
| `getGoalWithObjects(goalId, limit?)` | Goal with vocabulary | `GoalWithObjects | null` |
| `getGoalsByUser(userId, activeOnly?)` | List user's goals | `GoalSpec[]` |
| `updateGoal(goalId, input)` | Modify goal | `GoalSpec` |
| `deleteGoal(goalId)` | Remove goal + cascade | `void` |
| `calculateGoalProgress(goalId)` | Compute completion stats | `GoalProgress` |
| `addLanguageObjectsToGoal(goalId, objects, options?)` | Bulk insert vocabulary | `number` (count) |
| `getLanguageObjects(goalId, options?)` | Query vocabulary | `LanguageObject[]` |
| `updateObjectPriority(objectId, priority)` | Single priority update | `void` |
| `bulkUpdatePriorities(updates)` | Batch priority update | `void` |

### Data Flow: Goal Creation to Learning

```
[User creates goal]
        |
        v
[createGoal()] --> [GoalSpec inserted]
        |
        v
[Corpus pipeline populates vocabulary]
        |
        v
[addLanguageObjectsToGoal()] --> [LanguageObjects inserted]
        |                        |
        |                        v
        |                [Auto-calculate morphological/phonological scores]
        |                        |
        |                        v
        |                [MasteryState records created]
        |
        v
[User starts session]
        |
        v
[getLanguageObjects()] --> [Priority-sorted items for queue]
        |
        v
[User completes items]
        |
        v
[calculateGoalProgress()] --> [Update completionPercent]
```

### Critical Path Status

**Severity**: CRITICAL

If this repository fails:
- **No goals**: Users cannot create learning objectives
- **No vocabulary**: Items cannot be added to goals
- **No progress**: Completion tracking unavailable
- **Cascade failure**: Sessions, analytics, and queue all depend on goals

**Mitigation**: Repository functions are thin wrappers around Prisma. Failures indicate database-level issues (schema mismatch, connection lost) which require infrastructure-level resolution.

---

## Change History

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-01-06 | Shadow documentation created | Establish narrative context for goal data access | Developers understand goal-centric data model |
