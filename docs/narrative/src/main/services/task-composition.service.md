# Task Composition Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/task-composition.service.ts`
> **Status**: Active
> **Phase**: Economic Optimization for Flexible Task Assembly

---

## Context & Purpose

This service is the **economic optimizer for learning task assembly**. It answers a deceptively complex question: *"Given a template with empty slots and a pool of vocabulary/patterns, which specific objects should fill each slot to maximize learning value while keeping cognitive load manageable?"*

The Task Composition Service exists because effective language learning tasks are not random combinations of words. A well-designed task should:

1. **Target the right objects** - items the learner needs to practice, not already-mastered or too-difficult ones
2. **Combine synergistic objects** - collocations that naturally go together ("make a decision", not "do a decision")
3. **Balance cognitive load** - not so many difficult items that the learner is overwhelmed
4. **Assign appropriate roles** - some objects are being tested, others provide supporting context

**Business Need**: Without intelligent composition, tasks would either be too easy (wasting time), too hard (causing frustration), or miss opportunities for synergistic learning (vocabulary that belongs together taught separately). This service ensures every task is an optimized learning opportunity.

**When Used**:
- When generating a new learning task from a template
- When the session manager requests the next practice item
- When composing multi-object tasks that require several vocabulary items working together
- When balancing assessment items with contextual/reinforcement items

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

| File | Import | Purpose |
|------|--------|---------|
| `src/main/db/prisma.ts` | `getPrisma()` | Database connection for fetching language objects and collocations |
| `src/core/types.ts` | Multiple types | `ObjectRole`, `ObjectSlot`, `TaskTemplate`, `ComposedTask`, `FilledSlot`, `ObjectEconomicValue`, `CompositionOptimizationConfig`, `MasteryStage`, etc. |
| `src/core/types.ts` | `ROLE_CONFIGS` | Configuration for how each role (assessment, practice, reinforcement, incidental) affects learning metrics |
| `src/core/types.ts` | `COGNITIVE_PROCESS_MULTIPLIERS` | Difficulty multipliers for different cognitive processes (recognition, recall, production, etc.) |
| `src/core/types.ts` | `DEFAULT_COMPOSITION_CONFIG` | Default optimization parameters (max cognitive load, synergy weight, etc.) |
| `src/main/services/state-priority.service.ts` | `calculateEffectivePriority`, `calculateUrgencyScore` | Priority and urgency calculations for candidate scoring |

### Dependents (What Needs This)

| Consumer | Function Used | Purpose |
|----------|---------------|---------|
| Task Generation Service | `composeTask()` | Creates optimized tasks from templates |
| Session Manager | `buildCandidatePool()`, `composeTask()` | Builds and fills task slots for learning sessions |
| Learning IPC Handlers | `getTaskTemplate()`, `findSuitableTemplates()` | Template selection for task generation |
| Adaptive Algorithm Layer | `calculateObjectEconomicValue()` | Economic valuation for learning object selection |

### Data Flow

```
Session requests new task
        |
        v
buildCandidatePool() -----> Fetches objects + mastery + collocations from DB
        |
        v
For each candidate object:
        |
        +---> calculateObjectEconomicValue() -----> Learning value, cognitive cost, synergy map
        |
        v
composeTask() receives template + candidates
        |
        v
Phase 1: Fill required slots
        |
        +---> findBestAssignment() -----> Score each candidate for each slot
        |                                  (value, cost, synergy, urgency)
        |
        +---> satisfiesSlotConstraints() --> Filter by mastery stage, automaticity, relations
        |
        +---> applyAssignment() -----> Update state, mark object used
        |
        v
Phase 2: Fill optional slots (if cognitive budget allows)
        |
        v
Phase 3: Calculate synergy bonus
        |
        v
createCompositionResult() -----> ComposedTask with filled slots, rubric, expected answers
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits at the **Task Assembly Layer** of the LOGOS learning pipeline, bridging state analysis and content presentation:

```
Layer 4: Content Presentation (Renderer shows task to user)
              ^
              |  "Here's a composed task with 3 vocabulary items"
              |
=====> Task Composition Layer (THIS SERVICE) <=====
              ^
              |  "Optimal objects: word1 (assessment), word2 (practice), word3 (incidental)"
              |
Layer 2: State + Priority (User's mastery state, due items, bottlenecks)
              ^
              |  "User theta, priority scores, synergy relationships"
              |
Layer 1: Database (Language objects, collocations, mastery states)
```

The Task Composition Service transforms **raw learning potential** (priority scores, synergy data, mastery states) into **actionable learning tasks** (specific word assignments with roles and rubrics).

### Big Picture Impact

This service enables the core value proposition of LOGOS - **intelligent task construction**:

1. **Multi-Object Learning**: Unlike simple flashcard apps that show one word at a time, LOGOS tasks can include multiple related objects. The composition service ensures these combinations make pedagogical sense.

2. **Role-Based Learning**: Objects play different roles in the same task. The target vocabulary might be under "assessment" (full evaluation), while supporting context words are "incidental" (just exposure). This mimics natural language learning where you learn some words explicitly and absorb others from context.

3. **Synergy Exploitation**: When "strong" and "coffee" have high collocation scores, the service can place them in the same task, reinforcing their natural co-occurrence. Learning vocabulary in natural combinations accelerates acquisition.

4. **Cognitive Load Management**: By tracking cognitive cost and enforcing budget limits (default: Miller's 7 plus/minus 2), the service prevents overwhelming learners with too many difficult items at once.

5. **Economic Optimization**: Every object has a value (learning benefit) and cost (cognitive burden). The service maximizes the value-to-cost ratio, ensuring efficient use of learning time.

**What Would Break Without This Service**:
- Tasks would contain random vocabulary combinations (pedagogically ineffective)
- Collocations would be learned separately (missing natural co-occurrence patterns)
- Cognitive overload would occur (too many hard items at once)
- Role assignment would be arbitrary (everything treated as assessment = exhausting)
- Synergy opportunities would be missed (related words scattered across sessions)

### Critical Path Analysis

**Importance Level**: High (Core Learning Experience)

This is a **critical path** component for task generation. Every multi-object task flows through this service:

```
Template Selection --> composeTask() --> Present to User
                           ^
                           |
                    (This Service)
```

**Failure Modes**:
- If no candidates satisfy slot constraints: Returns partial result with `success: false` (graceful degradation)
- If cognitive budget exhausted: Fills required slots only, skips optional (reduced but functional)
- If synergy data missing: Proceeds without synergy bonus (slightly suboptimal composition)
- If database unavailable: `buildCandidatePool()` throws (session cannot start)

**Redundancy**: The service uses extensive defensive defaults:
- Missing mastery data defaults to stage 0 with neutral metrics
- Missing synergy maps default to empty (no bonus, no penalty)
- Configuration merges with `DEFAULT_COMPOSITION_CONFIG` for missing parameters

---

## Technical Concepts (Plain English)

### ObjectSlot

**Technical**: A position in a task template that can be filled by any qualifying language object based on component type, role, constraints, and weight contribution.

**Plain English**: Think of a task template as a Mad Libs page with blanks. Each blank (slot) says "put a noun here" or "put a verb here." But instead of just parts of speech, slots specify: "put a vocabulary word here that the learner is actively learning, which has a collocation relationship with the word in slot 1." The composition service fills these blanks optimally.

**Why We Use It**: Separating the task structure (template) from the specific content (objects) allows infinite task variety from finite templates. The same "write a sentence using ___" template can target thousands of different vocabulary items based on what each learner needs.

### ObjectRole

**Technical**: A categorical designation (`assessment`, `practice`, `reinforcement`, `incidental`) that determines how an object's inclusion in a task affects theta updates, mastery tracking, FSRS scheduling, and accuracy measurement.

**Plain English**: Not all vocabulary in a task is being "tested." Some words are the star of the show (assessment - we're checking if you know this), some are supporting actors (practice - you're learning this but with less pressure), some are background extras (reinforcement - you should recognize this), and some are just props (incidental - we're not checking, just exposing you to it). Each role has different consequences for your learning record.

**Why We Use It**: Natural language use involves words at different levels of consciousness. When reading a sentence, you might focus on learning one new word while familiar words provide context. The role system mimics this natural gradient rather than treating every word as equally important.

### Economic Value

**Technical**: A composite metric (`ObjectEconomicValue`) combining learning value (benefit of practicing this object), cognitive cost (mental load of processing it), synergy potential (bonus from combining with related objects), role affinity (suitability for each role type), urgency (time-sensitive priority), and exposure balance (modality coverage).

**Plain English**: Every vocabulary item has a "price" (how hard it is to learn) and a "reward" (how much learning it helps you). Some items are like buying vegetables at a farmer's market - high reward (nutritious), reasonable price (not too hard). Others are like overpriced convenience store snacks - high price (difficult), low reward (you already know it). The economic value helps pick the best "purchases" for your learning budget.

**Why We Use It**: Learning time is finite and precious. Economic optimization ensures every minute spent learning delivers maximum progress. Instead of random selection, we make smart tradeoffs: a slightly harder word might be worth including if it has synergy with others in the task.

### Synergy Bonus

**Technical**: An additive value bonus calculated from pairwise synergy scores (typically PMI/NPMI from collocation data) between objects assigned to the same task, weighted by the configuration's `synergyWeight` parameter.

**Plain English**: Some words just belong together. "Make a decision" is natural; "do a decision" is not. When the system can put "make" and "decision" in the same task, there's a synergy bonus because learning them together reinforces their natural partnership. It's like buying items on sale as a bundle rather than separately.

**Why We Use It**: Collocations are one of the hardest aspects of language to master. Native speakers intuitively know which words go together; learners must explicitly learn these patterns. By exploiting synergy, the composition service teaches words in their natural combinations, accelerating collocation acquisition.

### Greedy Optimization

**Technical**: An algorithmic approach that fills slots sequentially, choosing the locally optimal candidate for each slot considering current assignments, rather than exploring all possible combinations (which would be computationally infeasible).

**Plain English**: Imagine filling seats at a dinner party. You could try every possible seating arrangement (millions of combinations), or you could seat guests one by one, picking the best available person for each seat given who's already seated. Greedy optimization does the latter - fast and usually produces excellent results even if not mathematically perfect.

**Why We Use It**: With hundreds of candidate objects and multiple slots, evaluating every possible combination would take too long. Greedy optimization runs in milliseconds while still producing high-quality compositions. The slight theoretical sub-optimality is a worthwhile tradeoff for practical usability.

### Cognitive Load Budget

**Technical**: A configurable maximum (`maxCognitiveLoad`, default: 7) representing the total cognitive cost allowed in a single task, based on Cognitive Load Theory (Sweller, 1988) and Miller's capacity limit.

**Plain English**: Your brain can only juggle so many difficult things at once - roughly 7 items. If a task has 3 very hard words plus complex grammar plus unfamiliar context, you're overloaded and learn nothing. The cognitive budget is like a shopping cart size limit - you can only fit so much difficulty in one task before it becomes counterproductive.

**Why We Use It**: More is not always better in learning. Without a cognitive budget, the optimizer might pack tasks with high-value but high-cost items, overwhelming learners. The budget ensures tasks remain achievable, following the "desirable difficulty" principle (Bjork, 1994) - challenging but not impossible.

### Role Affinity

**Technical**: A mapping (`roleAffinity: Record<ObjectRole, number>`) indicating how suitable an object is for each role based on its mastery stage and automaticity level. High-mastery objects suit `incidental` roles; actively-learning objects suit `assessment` or `practice` roles.

**Plain English**: A word you mastered years ago shouldn't be the star of the show - it should be a background extra (incidental). A word you're currently struggling with should get the spotlight (assessment). Role affinity scores each word for each possible role, like casting actors for parts they're suited for.

**Why We Use It**: Miscast objects waste learning opportunity. Testing a mastered word is pointless; exposing a brand-new word incidentally is insufficient. Role affinity ensures objects are assigned to roles where they'll produce maximum learning benefit.

---

## Algorithm Details

### Economic Value Calculation

The `calculateObjectEconomicValue()` function computes a multi-dimensional value for each candidate:

```
Learning Value =
    masteryFactor * 0.3 +      // Lower mastery = higher value
    reviewUrgency * 0.3 +      // Overdue = higher value
    priorityFactor * 0.25 +    // High priority = higher value
    frequencyValue * 0.15      // Common words = higher value

Cognitive Cost =
    difficultyFactor * 0.4 +   // Higher IRT difficulty = higher cost
    familiarityFactor * 0.3 +  // Less exposure = higher cost
    automaticityCost * 0.3     // Lower automaticity = higher cost
```

### Mastery Learning Factor

Objects at different mastery stages have different learning value:

| Stage | Name | Factor | Rationale |
|-------|------|--------|-----------|
| 0 | Unknown | 1.0 | Maximum value - needs learning |
| 1 | Recognized | 0.9 | High value - just starting |
| 2 | Familiar | 0.7 | Good value - active learning |
| 3 | Learned | 0.5 | Moderate value - consolidating |
| 4 | Known | 0.3 | Low value - mostly automatic |
| 5 | Mastered | 0.15 | Very low - maintenance only |
| 6 | Automatized | 0.05 | Minimal - fully automatic |

### Role Affinity Calculation

Based on mastery stage and automaticity:

```
Assessment affinity:
  stage <= 3: 0.8   // Good for active evaluation
  stage <= 4: 0.5   // Moderate
  stage >= 5: 0.2   // Not recommended

Practice affinity:
  stage <= 4: 0.9   // Good for practice
  stage >= 5: 0.4   // Can still benefit

Reinforcement affinity:
  stage 3-5: 0.8    // Ideal for reinforcement
  others: 0.3       // Less suitable

Incidental affinity:
  automaticity > 0.7: 0.9   // Ideal as context
  automaticity > 0.4: 0.5   // Acceptable
  automaticity <= 0.4: 0.2  // Not recommended
```

### Slot Assignment Scoring

The `findBestAssignment()` function scores each candidate for each slot:

```
effectiveValue =
    learningValue * slot.weight * roleConfig.thetaMultiplier * roleAffinity[slot.role]

effectiveCost =
    cognitiveCost * cognitiveProcessMultiplier * slot.weight

synergyPotential =
    sum(synergy with each existing assignment) * synergyWeight

score =
    effectiveValue +
    synergyPotential +
    urgency * urgencyWeight +
    exposureBalance * exposureBalanceWeight -
    effectiveCost * 0.5  // Cost penalty
```

### Composition Algorithm (3 Phases)

**Phase 1: Required Slots**
```
for each required slot:
    find best candidate that:
        - is not already used
        - satisfies slot constraints
        - has highest combined score
    if no valid candidate: return partial failure
    apply assignment
```

**Phase 2: Optional Slots**
```
for each optional slot:
    if cognitive budget exhausted: stop
    find best candidate
    if (totalCost + newCost <= maxCognitiveLoad):
        apply assignment
    else:
        add to excludedObjects (reason: cognitive_overload)
```

**Phase 3: Synergy Finalization**
```
calculate pairwise synergy between all assigned objects
apply synergy bonus to total value
```

---

## Task Templates

The service includes example templates demonstrating flexible slot composition:

### vocab-recognition-basic
- Single slot for LEX component
- Role: assessment
- Simple MCQ format

### sentence-writing-multi
- 4 slots with cascading dependencies:
  1. **target-vocab** (LEX, assessment, weight 0.4) - required
  2. **required-grammar** (SYNT, practice, weight 0.3) - required, minMasteryStage: 2
  3. **collocation-word** (LEX, reinforcement, weight 0.2) - optional, must relate to target-vocab
  4. **context-vocab** (LEX, incidental, weight 0.1) - optional, minAutomaticity: 0.6

### discourse-completion
- Pragmatics-focused
- 3 slots for PRAG, LEX/PRAG, and LEX components
- Conjunctive interaction model (must get pragmatics right)

---

## Change History

### 2026-01-06 - Initial Implementation
- **What Changed**: Created Task Composition Service with economic optimization framework
- **Why**: Enable intelligent multi-object task assembly that maximizes learning value while respecting cognitive constraints
- **Impact**: Tasks can now include multiple objects with synergy, role differentiation, and cognitive load balancing

### Key Design Decisions

1. **Greedy over Exhaustive**: Chose greedy optimization for speed. With 100 candidates and 4 slots, exhaustive search would be O(100^4) = 100 million combinations. Greedy runs in O(slots x candidates).

2. **Role Gradient**: Replaced binary `isPrimaryTarget` with four-level role system. This better models the reality of language use where attention is distributed across words.

3. **Economic Framing**: Used economic terminology (value, cost, budget) to make optimization intuitive. Learning is a resource allocation problem.

4. **Synergy as Bonus**: Made synergy additive rather than multiplicative. This prevents synergy from dominating other factors while still rewarding good combinations.

5. **Constraint-First Filtering**: Check constraints before scoring. This reduces computation by eliminating invalid candidates early.

---

## Testing Considerations

### Unit Test Scenarios

1. **calculateObjectEconomicValue**: Test with various mastery stages, urgency levels, and synergy maps
2. **satisfiesSlotConstraints**: Test all constraint types (mastery, automaticity, relatedToSlot, domains)
3. **calculateSynergyBonus**: Test pairwise synergy calculation with known values
4. **findBestAssignment**: Test candidate scoring with controlled inputs

### Integration Test Scenarios

1. **composeTask with full candidate pool**: Verify all slots filled correctly
2. **composeTask with insufficient candidates**: Verify graceful partial failure
3. **buildCandidatePool**: Verify database queries and synergy map construction
4. **Cognitive budget enforcement**: Verify optional slots skipped when budget exceeded

### Edge Cases

- No candidates satisfy required slot constraints (should return failure)
- All candidates are already used (slot should remain unfilled if optional)
- Zero synergy between all candidates (should still compose without bonus)
- Single-slot template (degenerate case, should work)
- All candidates have identical scores (tie-breaking by first-found)

---

## Related Documentation

- `docs/narrative/src/main/services/state-priority.service.md` - Priority and urgency calculations
- `docs/narrative/src/main/services/scoring-update.service.md` - How responses update mastery
- `docs/narrative/src/main/services/task-generation.service.md` - Task content generation
- `docs/narrative/src/core/types.md` - Type definitions for slots, roles, templates
- `docs/narrative/src/main/services/pmi.service.md` - PMI/NPMI calculations for synergy
- `ALGORITHMIC-FOUNDATIONS.md` - Theoretical basis for economic optimization

---

## References

The economic optimization approach is grounded in:

- **Cognitive Load Theory** (Sweller, 1988): Justifies cognitive budget limits
- **Desirable Difficulties** (Bjork, 1994): Informs the value/cost tradeoff
- **Knapsack Optimization**: Algorithmic inspiration for value/weight selection
- **Collocation Theory** (Sinclair, 1991): Justifies synergy bonus for co-occurring words
- **Zone of Proximal Development** (Vygotsky, 1978): Guides role affinity based on mastery
