# learning.ipc.ts — Learning Object Management and Queue Construction

## Why This Exists

Learning objects are the atomic units of language acquisition in LOGOS: individual words, phrases, grammar patterns, collocations. This IPC module handles their full lifecycle and, critically, transforms them into a prioritized learning queue. The queue is where the adaptive learning algorithm manifests - deciding what the learner should study next based on mastery state, spaced repetition schedules, and the learner's proficiency level. Without this module, vocabulary would just be a static list rather than a dynamic, personalized curriculum.

## Key Concepts

- **LanguageObject**: The core entity containing content (the word/phrase), type (LEX, SYNT, MORPH, etc.), and three key metrics: frequency (how common in the target domain), relationalDensity (how connected to other concepts), and contextualContribution (how much it unlocks understanding of other content).

- **MasteryState**: Tracks learning progress per object: stage (0-4), FSRS scheduling parameters (stability, difficulty), accuracy metrics (cue-free vs cue-assisted), and next review date. This is the spaced repetition engine's state.

- **Learning Queue / QueueItem**: The prioritized list of what to study. Each item has a priority score (based on object properties and user state), urgency (how overdue for review), and combined finalScore. The queue is rebuilt fresh each time, not persisted.

- **z(w) Vector Task Matching**: Referenced in comments - tasks are generated to match the learning object's characteristics. Nation (2001) and Lu (2010) are cited, connecting to vocabulary depth and syntactic complexity research.

- **UserState for Prioritization**: The user's global theta (IRT ability estimate) and derived weights affect queue ordering. Beginners see different priorities than advanced learners.

## Design Decisions

**Ephemeral Queue**: The queue is computed on-demand from current database state, not stored. This ensures freshness (mastery updates immediately affect ordering) at the cost of computation. With reasonable vocabulary sizes (<10k items), this is acceptable.

**Session Size and New Item Ratio**: `queue:get` accepts parameters controlling how many items to return and what fraction should be new (vs review). Defaults (20 items, 30% new) implement interleaved learning which research suggests improves retention.

**Task Generation Integration**: Unlike a pure queue that just returns objects, this handler generates tasks (prompts, options, hints, expected answers) for each item. This couples queue-building with task-generation but provides a complete "ready to learn" packet to the UI.

**Graceful Task Generation Failure**: If task generation fails for an item, it's returned with `task: null` rather than failing the entire queue. This resilience prevents one problematic object from blocking a session.

**IRT Difficulty in Objects**: Each object has `irtDifficulty` (and optionally `irtDiscrimination`), enabling Item Response Theory-based calibration. Objects that many learners struggle with get higher difficulty estimates, improving ability estimation.

**Bulk Import**: The `object:import` handler uses `createMany` for efficiency when adding many objects at once (e.g., from corpus population). This bypasses validation that individual creates have, trading safety for speed.

## Integration Points

**Upstream Dependencies**:
- `./contracts`: IPC utilities, validation
- `../db/client`: Prisma for database operations
- `../../core/priority`: Queue building algorithm (buildLearningQueue, getSessionItems, computePriority, computeUrgency)
- `../services/task-generation.service`: Generates actual learning tasks from objects
- `../services/state-priority.service`: LearningQueueItem type

**Database Tables Touched**:
- `LanguageObject`: Full CRUD, priority updates
- `MasteryState`: Read for queue building, provides scheduling info
- `User`: Read for theta and language preferences
- `GoalSpec`: Read for domain context in task generation

**Downstream Consumers**:
- Session start flow (needs queue to present first task)
- Learning UI (displays queue items with their tasks)
- Import flows (corpus population, user uploads)
- Analytics (object search, mastery queries)

**Handler Channels**:
| Channel | Purpose |
|---------|---------|
| `object:create` | Create single learning object |
| `object:get` | Fetch object by ID with mastery |
| `object:list` | List objects for a goal with pagination |
| `object:update` | Modify object properties |
| `object:delete` | Remove object |
| `object:import` | Bulk create multiple objects |
| `object:search` | Find objects by content/type |
| `object:get-collocations` | Get related objects (by relational density) |
| `object:get-mastery` | Get mastery state for an object |
| `queue:get` | Build prioritized learning queue with tasks |
| `queue:refresh` | Recalculate queue priorities (returns stats, not items) |

**Queue Building Pipeline**:
```
Objects from DB
       |
       v
buildLearningQueue(objects, userState, masteryMap, now)
       |
       v
getSessionItems(queue, sessionSize, newItemRatio)
       |
       v
For each item: getOrGenerateTaskWithMatching()
       |
       v
Return complete queue with tasks to renderer
```
