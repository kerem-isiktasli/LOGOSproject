# pedagogical-intent.ts — Educational purpose definitions for content generation

## Why This Exists

Learning content is not interchangeable; a flashcard for vocabulary introduction serves a different purpose than a timed recall drill. Without explicit pedagogical intent modeling, content generation would be disconnected from learning science. This module defines the educational purposes (intents) that drive content structure, difficulty, and assessment criteria. It bridges learning theory (Bloom's taxonomy, mastery stages, cognitive load) with practical content generation decisions.

## Key Concepts

- **PedagogicalIntent**: A union type of nine distinct educational purposes:
  - `introduce_new`: First exposure to new vocabulary/concepts
  - `reinforce_known`: Practice already-encountered material
  - `test_comprehension`: Verify receptive understanding
  - `elicit_production`: Require active language output
  - `contextual_usage`: Demonstrate natural usage patterns
  - `error_detection`: Train error awareness and correction
  - `metalinguistic`: Explicit grammar/structure awareness
  - `fluency_building`: Build speed and automaticity
  - `transfer_testing`: Apply known patterns to new cases

- **LearningPhase**: Six phases aligned with Bloom's taxonomy (recognition, recall, application, analysis, synthesis, evaluation) that describe the cognitive level of learner engagement.

- **DifficultyConstraints**: Numeric bounds on content difficulty including min/max difficulty (0-1), target learner theta (ability estimate), and tolerance for deviation from optimal.

- **ScaffoldingConfig**: Support structure configuration including level (0-3), available cue types, auto-reveal delay, and maximum hints before answer reveal.

- **CueType**: Eight types of learning scaffolds (first_letter, word_length, translation, morpheme_breakdown, pronunciation, example_sentence, semantic_field, collocations) that can be progressively revealed.

- **PedagogicalIntentMeta**: Rich metadata for each intent including applicable phases, mastery stage range, cognitive load (1-5), production requirement, time pressure recommendation, and typical scaffolding level.

- **PEDAGOGICAL_INTENTS constant**: A comprehensive lookup table mapping each PedagogicalIntent to its PedagogicalIntentMeta, serving as the authoritative source for intent properties.

## Design Decisions

**Intent as driver of content structure**: Rather than treating pedagogical purpose as metadata, intents are first-class drivers that determine content format, difficulty targeting, scaffolding availability, and assessment criteria. This ensures pedagogy drives technology rather than the reverse.

**Bloom's taxonomy alignment**: Learning phases map to established educational theory, enabling LOGOS to leverage decades of research on cognitive skill development and assessment design.

**Mastery stage boundaries**: Each intent specifies min/max mastery stages (0-4), preventing inappropriate tasks (e.g., no production tasks for stage 0 items, no introduction for mastered items).

**Cognitive load quantification**: The 1-5 cognitive load scale enables load balancing across learning sessions, preventing learner fatigue from too many high-load tasks.

**Time pressure as explicit property**: Fluency-building tasks are explicitly marked for time pressure, enabling UI components to add timers and the scoring system to factor in response speed.

**Scaffolding level defaults**: Each intent has a default scaffolding level (0-3), ensuring appropriate support is available for challenging tasks while avoiding over-scaffolding for fluency drills.

**Helper functions for common queries**: Functions like `getIntentsForStage()`, `getIntentsForPhase()`, `requiresProduction()`, and `getScaffoldingLevel()` encapsulate common lookups, reducing duplication and potential errors in consuming code.

**Optimal intent selection algorithm**: The `selectOptimalIntent()` function implements a pedagogically-informed selection strategy that considers mastery stage, scaffolding gaps, and recent intent history to avoid repetition and maintain engagement.

**IRT-inspired success probability**: The `calculateExpectedSuccess()` function uses an IRT-like model adjusted for cognitive load, production requirement, and time pressure to estimate learner success probability. This enables adaptive difficulty targeting.

## Integration Points

**Consumed by:**
- `./content-spec`: Imports PedagogicalIntent, DifficultyConstraints, ScaffoldingConfig, and LearningPhase as core spec components
- `./content-generator`: Uses PEDAGOGICAL_INTENTS for prompt construction and metadata calculation
- `./content-validator`: Uses PEDAGOGICAL_INTENTS to verify content aligns with intent requirements
- Task selection engine: Uses helper functions to select appropriate intents based on learner state
- Scheduling algorithms: Uses success probability calculations for spaced repetition integration

**Data flow:**
```
Learner state (mastery stage, theta, recent history)
     |
     v
selectOptimalIntent() ---> PedagogicalIntent
     |
     v
PEDAGOGICAL_INTENTS[intent] ---> PedagogicalIntentMeta
     |
     v
calculateExpectedSuccess() ---> success probability
     |
     v
ContentSpec construction (uses intent + meta)
     |
     v
Content generation (uses intent for prompt/template selection)
     |
     v
Content validation (verifies intent alignment)
```

**Relationship to learning theory:**
```
Bloom's Taxonomy          LOGOS LearningPhase        Example Intents
-----------------         -------------------        ---------------
Knowledge                 recognition                introduce_new
Comprehension             recall                     reinforce_known, test_comprehension
Application               application                contextual_usage, fluency_building
Analysis                  analysis                   error_detection, metalinguistic
Synthesis                 synthesis                  elicit_production, transfer_testing
Evaluation                evaluation                 error_detection
```
