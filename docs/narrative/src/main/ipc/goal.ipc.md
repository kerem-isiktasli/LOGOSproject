# goal.ipc.ts — Learning Goal Management and Corpus Source Integration

## Why This Exists

Goals are the organizing principle of LOGOS. A goal defines what the learner wants to achieve: reading medical literature, writing business emails, understanding academic lectures, etc. This IPC module handles the full lifecycle of goals (CRUD operations) and crucially integrates with the corpus source system to populate goals with relevant vocabulary. Without goals, there's no context for what to learn; without corpus integration, there's no content to learn from. This module bridges intent (the goal) with material (the vocabulary).

## Key Concepts

- **GoalSpec**: The core entity combining domain (medical, legal, business, academic, general), modality (reading, listening, writing, speaking), genre (free text describing the type of content), and purpose (the learner's reason). Optional benchmark (e.g., "TOEFL 100") and deadline add concreteness.

- **Domain / Modality Type Guards**: Runtime validation ensuring only valid domain and modality values reach the database. This is defense-in-depth since TypeScript types don't survive the IPC boundary.

- **Corpus Sources**: External and internal sources of vocabulary (Wikipedia, academic corpora, user uploads). Each source has domains, modalities, reliability scores, and benchmark associations. The filtering system matches sources to goals.

- **Recommended Sources**: A scoring system that ranks corpus sources by how well they match a goal's characteristics. Sources covering the goal's domain score higher; those matching the modality score even higher.

- **Vocabulary Population Pipeline**: The multi-stage process of fetching from corpus sources, extracting vocabulary, calculating frequency/collocations, and inserting into the database as LanguageObjects.

## Design Decisions

**Multi-Modality as Array**: Unlike domain (single value), modality is stored as a JSON array. A goal can target multiple modalities (reading AND listening), reflecting real-world learning needs. This required special handling in `mapGoalToResponse` to parse the JSON string.

**Default User Creation**: Until authentication is implemented, a default user is created if none exists. This is a pragmatic shortcut that lets the app function in single-user mode while preserving the user-goal relationship in the schema.

**Source Validation Warnings**: When users manually select corpus sources, the system validates their selection and warns (but doesn't block) if choices seem suboptimal for the goal. This respects user autonomy while providing guidance.

**Dual Handler Registration**: Uses both `registerHandler` (static, core CRUD) and `registerDynamicHandler` (corpus operations). This suggests corpus features were added later or have different lifecycle requirements.

**Population Status Tracking**: Rather than fire-and-forget, vocabulary population reports status including sources used, counts, errors, and duration. This transparency helps users understand what content they're getting and debug failures.

**User Upload Processing**: Users can upload their own documents (with filename, content, mimeType). The system extracts vocabulary and inserts it as LanguageObjects with frequency data. This enables domain-specific learning from proprietary materials (e.g., company documentation).

## Integration Points

**Upstream Dependencies**:
- `./contracts`: IPC utilities, validation functions
- `../db/client`: Prisma database client
- `../../shared/types`: GoalSpec, Domain, Modality type definitions
- `../services/corpus-sources/filter`: Source recommendation and validation logic
- `../services/corpus-sources/registry`: Available source definitions
- `../services/corpus-sources/corpus-pipeline.service`: Population orchestration

**Database Tables Touched**:
- `GoalSpec`: Full CRUD operations
- `User`: Read (for userId), created if missing
- `LanguageObject`: Created during vocabulary population, counted for status

**Downstream Consumers**:
- Goal management UI (create, edit, delete, activate goals)
- Corpus source selection UI (recommended sources, manual selection)
- Vocabulary population progress indicators
- Session start (requires goals to have content)

**Handler Channels**:
| Channel | Purpose |
|---------|---------|
| `goal:create` | Create new learning goal |
| `goal:get` | Fetch single goal by ID |
| `goal:list` | List all goals with pagination |
| `goal:update` | Modify goal properties |
| `goal:delete` | Remove goal (cascades to related data) |
| `goal:set-active` | Toggle goal active status |
| `goal:list-sources` | Get all available corpus sources |
| `goal:get-recommended-sources` | Get sources ranked by goal fit |
| `goal:populate-vocabulary` | Trigger vocabulary extraction from sources |
| `goal:get-population-status` | Check vocabulary population progress |
| `goal:clear-vocabulary` | Remove vocabulary for repopulation |
| `goal:upload-corpus` | Process user-uploaded documents |
