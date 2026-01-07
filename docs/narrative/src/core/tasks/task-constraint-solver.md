# task-constraint-solver.ts — Matching Objects to Tasks

## Why This Exists

A task generator needs to select *which* vocabulary items appear in each exercise. This selection cannot be random: it must consider the learner's current mastery level, the task's difficulty requirements, domain relevance, and whether items are due for review. The constraint solver transforms these competing requirements into a ranked selection of optimal objects.

This is the bridge between "what the learner needs to practice" and "what content fits that need."

## Key Concepts

- **ObjectSelectionConstraints**: The full specification of what we need:
  - Task type and pedagogical intent
  - Difficulty bounds with tolerance
  - Component focus (phonological, lexical, etc.)
  - Mastery stage range (e.g., stages 1-3 only)
  - Required domains (medical, business, etc.)
  - Collocation requirements (must include word pairs that go together)
  - Exclusion list (avoid recently used items)
  - Min/max object counts

- **ScoredObject**: Each candidate receives a composite score (0-100) with breakdown:
  - `difficultyFit` (0-25): How well object difficulty matches target
  - `componentMatch` (0-20): Whether object exercises the target component
  - `masteryFit` (0-25): Alignment with learner's mastery stage
  - `domainFit` (0-15): Overlap with required domains
  - `recencyScore` (0-10): Preference for recent/not-recent items
  - `dueScore` (0-5): Bonus for items due for spaced repetition review

- **Hard vs Soft Constraints**: Hard constraints (mastery range, domains) cause immediate rejection. Soft constraints (difficulty fit, recency) affect scoring but do not disqualify.

- **CollocationPair**: Represents word pairs that naturally occur together (e.g., "make decision"), indexed by PMI (pointwise mutual information) strength.

## Design Decisions

**Two-Pass Filtering**: First pass applies hard constraints for immediate rejection with specific reasons (useful for debugging content gaps). Second pass scores remaining candidates on soft constraints. This separation keeps the scoring math clean.

**Weighted Scoring Formula**: Difficulty and mastery fit dominate (25 points each) because matching learner level is paramount. Component match gets 20 points since linguistic focus matters for targeted practice. Domain fit gets 15 points for contextualization. Recency and due-ness are minor tie-breakers.

**Object Difficulty Estimation**: When objects lack explicit difficulty ratings, the solver estimates from properties: word length, frequency (inverse relationship), phonological complexity, morphological regularity. This heuristic allows the system to work with minimal metadata.

**Collocation Preservation**: When `requireCollocations` is true, the solver ensures selected objects include at least one natural word pair. This supports tasks like collocation judgment or gap-fill where word relationships matter.

**Bidirectional Collocation Index**: Collocations are stored both ways (A->B and B->A) so lookup works regardless of which word in a pair is selected first.

## Integration Points

- **TraditionalTaskType** (`traditional-task-types.ts`): Each task type specifies `masteryRange` and `typicalItemCount` which become default constraints if not overridden.

- **PedagogicalIntent** (`src/core/content/pedagogical-intent.ts`): The intent (introduce, reinforce, test) influences which constraints apply. Introduction tasks might prefer lower difficulty; testing tasks might require specific mastery stages.

- **MasteryStage** (`src/core/types.ts`): The 0-4 stage system (new -> mastered) determines which tasks are appropriate and which objects should be selected.

- **DifficultyConstraints** (`src/core/content/pedagogical-intent.ts`): Specifies min/max difficulty, target theta (IRT ability estimate), and tolerance for how far from target is acceptable.

- **Spaced Repetition System**: The `nextReview` date on mastery states enables `preferDue` mode, integrating with FSRS scheduling to prioritize items ready for review.

- **Task Generation**: Factory function `selectObjectsForTask()` provides a simple entry point for common cases. The `TaskConstraintSolver` class allows more complex multi-query scenarios.
