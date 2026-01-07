# traditional-task-types.ts — The 30-Task Taxonomy

## Why This Exists

Language learning research has identified distinct exercise types that target different cognitive processes and linguistic components. Rather than inventing task formats ad-hoc, this module codifies 30 traditional task types from language pedagogy literature, each annotated with metadata enabling algorithmic selection: which mastery stages it suits, what cognitive load it imposes, whether it requires production or just recognition.

This taxonomy is the vocabulary the system uses to talk about "what kind of exercise should we give next?"

## Key Concepts

- **TaskCategory**: Six categories organizing the 30 types:
  - `receptive` (5 types): Comprehension without production (reading, listening)
  - `productive` (5 types): Creating language output (writing, speaking)
  - `transformative` (7 types): Converting between forms (translation, paraphrasing)
  - `fill_in` (4 types): Gap completion (cloze, word bank)
  - `interactive` (4 types): Dialogue and response (Q&A, role play)
  - `analytical` (5 types): Metalinguistic analysis (error correction, grammar ID)

- **CognitiveProcess**: Eight processes from Bloom's taxonomy adapted for language:
  - `recognition`, `recall` (lower order)
  - `comprehension`, `application` (mid order)
  - `analysis`, `synthesis`, `evaluation` (higher order)
  - `automatization` (fluency-specific)

- **TraditionalTaskTypeMeta**: Rich metadata per task type including:
  - `masteryRange`: Which stages (0-4) this task suits
  - `cognitiveLoad`: Mental effort required (1-5)
  - `scaffoldingLevel`: How much support typically needed (0-3)
  - `needsDistractors`: Whether MCQ-style wrong options required
  - `requiresProduction`: Receptive vs. productive distinction

- **Feature Vector Task Selection (z(w) matching)**: Advanced selection using the object's linguistic feature vector to match task types. High morphological score suggests word-formation tasks; high phonological score suggests dictation.

## Design Decisions

**Fixed 30-Type Library**: Rather than allowing arbitrary task definitions, the library is closed. This enables the system to reason about task properties (e.g., "all productive tasks") and ensures consistent metadata across the codebase.

**Mastery Range as Gate**: Each task type has a minimum and maximum mastery stage. This prevents giving essay-writing to beginners or word-bank exercises to advanced learners. The constraint solver uses this for hard filtering.

**Cognitive Load Separation from Difficulty**: A task can be cognitively demanding (debate response: load 5) but have low difficulty content, or be simple in format (word bank: load 2) but hard vocabulary. These dimensions are tracked separately.

**Base Difficulty vs. Item Difficulty**: `baseDifficulty` is the task format's inherent challenge. Actual difficulty also depends on selected content. A dictation task (base 3) with rare vocabulary becomes harder than a dictation with common words.

**Scaffolding Levels**:
- 0 = No scaffolding (free production)
- 1 = Light scaffolding (prompts, examples)
- 2 = Medium scaffolding (partial structure provided)
- 3 = Heavy scaffolding (word bank, first letters given)

This guides adaptive difficulty adjustment beyond just content selection.

**z(w) Feature Vector Integration**: The `getTasksForFeatureVector()` function implements a secondary selection path. When a word's linguistic features are known (morphological complexity, phonological difficulty, collocational strength, domain specialization), the system can recommend task types that exercise those specific features. This goes beyond traditional mastery-based selection.

## Integration Points

- **ComponentType** (`src/core/types.ts`): The `primaryComponents` field lists which linguistic components (phonological, morphological, lexical, syntactic, pragmatic) each task type exercises. Used by the constraint solver for component-focused practice.

- **TaskModality** (`src/core/types.ts`): Supported modalities (text, audio) determine rendering requirements. Listening comprehension requires audio playback; dictation requires audio input.

- **PedagogicalIntent** (`src/core/content/pedagogical-intent.ts`): The `intents` field maps task types to pedagogical goals (introduce_new, reinforce_known, test_comprehension, elicit_production, etc.).

- **FeatureVector** (`src/core/state/component-object-state.ts`): The z(w) vector (F, R, D, M, P components) enables feature-driven task selection via `getTasksForFeatureVector()`.

- **Task Constraint Solver** (`task-constraint-solver.ts`): Uses `masteryRange` and `typicalItemCount` as defaults when selecting objects for a task type.

- **Distractor Generator** (`distractor-generator.ts`): The `needsDistractors` flag indicates which task types require the distractor generator to be invoked.

- **Helper Functions**: Utility functions (`getTaskTypesByCategory`, `getTaskTypesForStage`, `getTaskTypesForComponent`, etc.) enable filtering the task library by any metadata dimension. `selectOptimalTaskType()` combines all factors for intelligent task selection.
