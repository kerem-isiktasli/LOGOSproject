# Constraint Propagation Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/constraint-propagation.service.ts`
> **Status**: Active

---

## Context & Purpose

This service implements **cascading constraint resolution** for object selection during task composition. When a teacher (human or algorithm) selects one linguistic object to include in a task, that choice creates ripple effects throughout the available object pool. The Constraint Propagation Service calculates these ripples - determining what other objects become required, forbidden, preferred, or restricted as a consequence of the initial selection.

**Business Need**: Language is not a bag of independent parts. Selecting "passive voice" as a syntactic structure means you cannot use intransitive verbs. Choosing a formal register means slang vocabulary is inappropriate. A word spelled "knight" requires a specific pronunciation pattern. The system must understand these interdependencies to generate linguistically coherent tasks - otherwise learners would encounter impossible or nonsensical combinations.

**When Used**: During task composition, after Layer 1 (State + Priority Service) identifies *which* objects to practice, but before the task is fully assembled. Each time an object is assigned to a slot in the task template, this service propagates constraints to inform subsequent slot assignments.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/main/db/prisma.ts`: `getPrisma()` - Obtains database connection to query collocations and linguistic relationships stored in the database
- `src/core/types.ts`: Multiple type imports for constraint modeling:
  - `ComponentCode` - Identifies linguistic component types (LEX, MORPH, SYNT, PHON, PRAG)
  - `ConstraintType` - Enumerates relationship types (requires, excludes, prefers, enables, restricts_to, modifies)
  - `ConstraintEdge` - Single directed relationship in the constraint graph
  - `ConstraintCondition` - Conditional activation logic for edges
  - `ConstraintPropagation` - Complete result of propagation calculation
  - `LinguisticConstraintRule` - Pre-defined rules based on linguistic theory
  - `LINGUISTIC_CONSTRAINT_RULES` - The actual rule definitions for cross-component constraints
  - `ObjectSlot`, `FilledSlot` - Task template slot structures
  - `MasteryStage` - Learner progress indicators

### Dependents (What Needs This)

- **Task Generation Service** (`task-generation.service.ts`): Uses constraint propagation to ensure generated tasks respect linguistic coherence rules
- **Task Constraint Solver** (`src/core/tasks/task-constraint-solver.ts`): Orchestrates constraint solving across multiple slots
- **Content Generator** (future): Will use constraints to ensure AI-generated content respects linguistic relationships

### Data Flow

```
Object Selection (trigger)
        |
        v
buildConstraintGraph(goalId)  <- Collocations from DB + Linguistic Rules
        |
        v
ConstraintGraph with lookup indices
        |
        v
propagateConstraints(trigger, graph, availableObjects, currentAssignments, slots)
        |
        +---> applyObjectConstraints() - Direct object-to-object edges
        |
        +---> applyLinguisticRules() - Component-level rule predicates
        |
        +---> propagateFromRequired() - Recursive cascade from newly-required objects
        |
        v
ConstraintPropagation Result
(required, excluded, restrictions, preferences, modifications)
```

---

## Macroscale: System Integration

### Architectural Layer

This service operates at the **Constraint Resolution Layer** within the Task Composition subsystem:

- **Layer 1**: State + Priority (what to learn) - Selects target objects based on learner need
- **Layer 2a**: Constraint Propagation - **This module** - Ensures selections are linguistically coherent
- **Layer 2b**: Task Generation - Assembles coherent objects into interactive tasks
- **Layer 3**: Response Processing - Evaluates learner performance

The Constraint Propagation Service acts as a **linguistic coherence filter** between object selection and task assembly.

### Big Picture Impact

This service is the **guardian of linguistic validity** in LOGOS. Without it:

- Tasks could present impossible combinations (passive voice with intransitive verbs)
- Register mismatches would confuse learners (formal structure + slang vocabulary)
- Morphological inconsistencies would appear (plural subject + singular verb)
- Phonological mappings would be incorrect (wrong pronunciation for spelling)
- Collocational preferences would be ignored (missing "bread and butter" style fluency patterns)

This service enables:
- **Linguistic Coherence**: Every generated task respects grammatical, phonological, and pragmatic rules
- **Cascading Selection**: One choice intelligently constrains subsequent choices
- **Soft Preferences**: PMI-weighted collocations naturally emerge in tasks (fluency training)
- **Hard Constraints**: Impossible combinations are prevented (grammaticality)
- **Cross-Component Awareness**: The system understands how syntax affects morphology, how lexicon affects phonology, etc.

### Critical Path Analysis

**Importance Level**: High

This is a **quality gate** in the task composition path. The system can technically generate tasks without it (by ignoring constraints), but those tasks would be linguistically flawed:

1. If constraint graph building fails: Tasks lose coherence but can still generate (degraded quality)
2. If propagation fails: Specific constraint effects are missed (graceful degradation per-constraint)
3. If validation fails: Invalid combinations reach the learner (pedagogically harmful)

**Failure Modes**:
- Database unavailable for collocations: Falls back to linguistic rules only (reduced but functional)
- Invalid constraint rule: Specific rule skipped, others continue (isolated failure)
- Circular constraint dependency: Prevented by `processed` set tracking (cycle-proof design)

---

## Technical Concepts (Plain English)

### Constraint Graph

**Technical**: A directed graph data structure (`ConstraintGraph`) where nodes represent linguistic objects (words, morphemes, syntactic patterns, etc.) and edges represent constraints between them. Indexed by source, target, and component pair for O(1) lookup.

**Plain English**: Imagine a web connecting all the pieces of language in the system. Each thread in the web says "if you pick this piece, here is what happens to that piece." Some threads are red (forbidden combinations), some green (required combinations), some yellow (preferred combinations). The constraint graph is this entire web, organized so the system can quickly find all threads attached to any piece.

**Why We Use It**: Finding constraints during task assembly must be fast. Building indices upfront (by source, by target, by component pair) means constraint lookup is instant rather than requiring a search through all constraints.

### Hard vs. Soft Constraints

**Technical**: Constraints are typed as `requires`, `excludes` (hard) versus `prefers`, `enables` (soft). Hard constraints produce binary outcomes (must include / cannot include). Soft constraints adjust economic values (preference weights) without forcing outcomes.

**Plain English**:
- **Hard constraints** are like grammar rules: "Passive voice REQUIRES a transitive verb" - there is no negotiation.
- **Soft constraints** are like style preferences: "The word 'bread' PREFERS 'butter' as a companion" - you can ignore it, but native speakers would find it more natural together.

**Why We Use It**: Language has both absolute rules (grammaticality) and statistical tendencies (fluency patterns). Modeling both allows the system to enforce correctness while still producing natural-sounding combinations.

### Constraint Propagation (Cascading)

**Technical**: When an object is selected, `propagateConstraints()` iteratively applies all outgoing constraints from that object, then recursively propagates from any newly-required objects until no new constraints trigger. A `processed` set prevents infinite loops.

**Plain English**: Like dominoes falling. You push one domino (select "passive voice"), which knocks over another (requires transitive verb), which knocks over another (requires past participle form), and so on until no more dominoes fall. The system tracks which dominoes have already fallen so they do not keep triggering each other forever.

**Why We Use It**: Linguistic constraints form chains. A single choice at the syntactic level can cascade through morphology, lexicon, and phonology. The system must follow these chains to their conclusion.

### Linguistic Constraint Rules

**Technical**: Pre-defined rules (`LINGUISTIC_CONSTRAINT_RULES`) encoding relationships between component types (SYNT, MORPH, LEX, PHON, PRAG). Each rule specifies source/target components, constraint type, and a predicate type that determines how to evaluate the constraint.

**Plain English**: These are the "laws of language" encoded in the system. They express knowledge like:
- "Syntactic patterns restrict which morphological forms are valid" (SYNT -> MORPH)
- "Words require specific pronunciation patterns" (LEX -> PHON)
- "Formal contexts restrict vocabulary to formal register" (PRAG -> LEX)

Each rule is a general principle; the predicates (syntactic_agreement, phonological_compatibility, etc.) contain the specific logic to apply that principle.

**Why We Use It**: Rather than storing millions of specific object-to-object constraints, the system uses general linguistic rules that apply across the entire object pool. This is both more efficient and more extensible - add new words and they automatically inherit the rule-based constraints.

### Predicate Types

**Technical**: Functions that evaluate whether a constraint applies between a source object and target objects, returning filtered lists or null. Six types: `syntactic_agreement`, `phonological_compatibility`, `morphological_derivation`, `collocation`, `register_consistency`, `semantic_coherence`.

**Plain English**:
- **Syntactic Agreement**: Does the verb form match what the sentence structure requires? (passive needs past participle)
- **Phonological Compatibility**: Does the pronunciation pattern match the word? (silent 'k' in "knight")
- **Morphological Derivation**: Are these words from the same family? (happy -> unhappy -> happiness)
- **Collocation**: Do these words naturally go together? (strong tea, not powerful tea)
- **Register Consistency**: Does this vocabulary match the formality level? (utilize in formal, use in casual)
- **Semantic Coherence**: Does this meaning fit the context? (future implementation)

**Why We Use It**: Different constraint types require different evaluation logic. A predicate system keeps the main propagation algorithm clean while allowing specialized logic for each relationship type.

### Register Hierarchy

**Technical**: A five-level hierarchy (`frozen`, `formal`, `consultative`, `casual`, `intimate`) with numeric ranks 5-1. Register compatibility is defined as being within one level of each other.

**Plain English**: Language formality runs from "legal contracts" (frozen) through "business meetings" (formal) to "chatting with friends" (casual) to "inside jokes with family" (intimate). Words have a natural home in this spectrum. "Utilize" lives in formal territory; "use" is neutral; "gonna" is casual. The system ensures tasks do not mix incompatible levels - you would not write "The defendant gonna provide testimony."

**Why We Use It**: Register mismatch is jarring to native speakers and confusing to learners. Enforcing register consistency within tasks teaches appropriate usage in context.

### PMI-Based Collocation Strength

**Technical**: Collocation constraints derive their `strength` (0-1) from PMI/NPMI scores. The `normalizeCollocationStrength()` function maps raw PMI (-infinity to +infinity) and NPMI (-1 to +1) to a 0-1 range using domain-specific normalization.

**Plain English**: Some word pairs are strongly attracted (bread-butter: very high PMI), others weakly (bread-fork: low PMI), others repel (bread-quantum: essentially zero). The system converts these statistical attraction scores into preference weights, so strongly-attracted pairs are more likely to appear together in tasks.

**Why We Use It**: Fluent language use means knowing which words "like" each other. Training with high-PMI pairs builds this intuition. The strength value lets the system balance collocational preference against other factors.

---

## Function Reference

### Graph Building

| Function | Purpose |
|----------|---------|
| `buildConstraintGraph(goalId)` | Constructs constraint graph from database collocations and linguistic rules, returns indexed structure |
| `normalizeCollocationStrength(score)` | Converts raw PMI/NPMI to 0-1 range for constraint strength |

### Constraint Propagation

| Function | Purpose |
|----------|---------|
| `propagateConstraints(trigger, graph, available, current, slots)` | Main propagation entry point - calculates all cascading effects of a selection |
| `applyObjectConstraints(source, graph, context)` | Applies direct object-to-object constraints from graph edges |
| `applyLinguisticRules(source, graph, context, slots)` | Applies component-level linguistic rules based on source object type |
| `propagateFromRequired(graph, context, slots)` | Recursively propagates constraints from newly-required objects |

### Predicate Evaluation

| Function | Purpose |
|----------|---------|
| `applyLinguisticPredicate(source, rule, targets)` | Routes to specific predicate function based on rule type |
| `applySyntacticAgreement(source, targets, rule)` | Evaluates syntactic pattern requirements (passive voice, plurality, etc.) |
| `applyPhonologicalCompatibility(source, targets, rule)` | Filters targets to matching pronunciation patterns |
| `applyMorphologicalDerivation(source, targets, rule)` | Filters targets to same morphological family (shared root) |
| `applyRegisterConsistency(source, targets, rule)` | Filters targets to compatible formality levels |
| `evaluateCondition(condition, object)` | Evaluates conditional constraint activation |
| `isRegisterCompatible(source, target)` | Checks if two registers are within one level of each other |

### Utility

| Function | Purpose |
|----------|---------|
| `mapTypeToComponent(type)` | Converts object type string to ComponentCode enum |

### Validation

| Function | Purpose |
|----------|---------|
| `validateAssignments(assignments, graph)` | Post-hoc validation that all hard constraints are satisfied |

### Selection Support

| Function | Purpose |
|----------|---------|
| `applyConstraintPreferences(baseValues, propagation)` | Adjusts economic values with preference bonuses and exclusion penalties |
| `applyRestrictions(candidates, slotId, propagation)` | Filters candidate pool to allowed objects for a specific slot |

---

## Exported Types

| Type | Purpose |
|------|---------|
| `ObjectMetadata` | Object information needed for constraint checking (id, type, content, properties) |
| `ConstraintGraph` | Complete constraint network with edges and lookup indices |

---

## Configuration Notes

The service uses pre-defined constants and rules from `src/core/types.ts`:

- **LINGUISTIC_CONSTRAINT_RULES**: Array of 7+ rules covering major cross-component relationships
- **Register hierarchy**: 5-level formality scale with adjacency-based compatibility
- **PMI normalization**: Sigmoid for raw PMI, linear shift for NPMI

No runtime configuration is required - constraint behavior is determined by the rule definitions and database content.

---

## Design Decisions

### Why Graph-Based Rather Than Rule Engine?

A graph structure with indexed lookups was chosen over a general rule engine because:
1. **Performance**: O(1) edge lookup vs. O(n) rule scanning
2. **Transparency**: Edges can be visualized and debugged
3. **Hybrid approach**: Linguistic rules generate edges at query time, not stored redundantly

### Why Recursive Propagation?

Iterative propagation (breadth-first) would also work, but recursive approach was chosen because:
1. **Depth tracking**: Natural call stack traces propagation path
2. **Early termination**: `processed` set stops cycles immediately
3. **Code clarity**: Matches mental model of "cascading effects"

### Why Separate Hard/Soft Constraint Handling?

Hard constraints (`requires`, `excludes`) and soft constraints (`prefers`) are processed differently:
- Hard: Binary include/exclude decisions
- Soft: Additive adjustments to economic values

This separation allows the task composition system to enforce hard constraints absolutely while still optimizing for soft preferences.

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created narrative documentation for constraint propagation service
- **Why**: Project requires shadow documentation for all code files per CLAUDE.md guidelines
- **Impact**: Enables understanding of the constraint system for non-technical stakeholders and future maintainers

### [Original Implementation Date] - Service Creation
- **What Changed**: Implemented cascading constraint resolution for task composition
- **Why**: Tasks must respect linguistic coherence rules to be pedagogically valid
- **Impact**: Enables linguistically-valid task generation with automatic constraint enforcement
