# Integrated Task Pipeline Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/integrated-task-pipeline.service.ts`
> **Status**: Active

---

## Context & Purpose

This service exists as the **central orchestrator** that unifies LOGOS's new flexible composition architecture with its existing task generation system. It solves the fundamental challenge of coordinating multiple sophisticated subsystems - economic optimization, constraint propagation, usage tracking, multi-layer evaluation, and calibration - into a coherent, production-ready pipeline.

**Business Need**: LOGOS requires intelligent task generation that considers multiple factors simultaneously: what the learner needs to practice (based on IRT ability estimates), how different learning objects relate to each other linguistically (constraints), where objects have already been practiced (usage space), and how to fairly evaluate responses that involve multiple linguistic components. Previously, these concerns were handled in isolation or not at all. This service weaves them together.

**When Used**:
- Every time the application needs to generate a learning task for the user
- Every time the user submits a response and needs evaluation/feedback
- When the system needs to decide what to present next in a learning session

**Why It Was Built**: The original `task-generation.service` handled single-object tasks well, but LOGOS evolved to support multi-object tasks where a single exercise might assess vocabulary, morphology, and syntax simultaneously. This required a pipeline that could:
1. Consider all candidate objects economically (not just the highest priority)
2. Respect linguistic constraints between components (e.g., passive voice requires transitive verbs)
3. Track where objects have been successfully used (context coverage)
4. Evaluate responses at multiple granularity levels
5. Update ability estimates for multiple components from a single response

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**Database Layer:**
- `src/main/db/prisma.ts`: getPrisma() - Provides database connection for user theta state retrieval

**Composition & Optimization:**
- `src/main/services/task-composition.service.ts`:
  - `composeTask()` - Creates optimal slot-filling assignments using knapsack-style optimization
  - `buildCandidatePool()` - Gathers all potential learning objects with economic value scores
  - `getTaskTemplate()` / `findSuitableTemplates()` - Retrieves task structure definitions
  - `TASK_TEMPLATES` - Registry of available task formats
  - `ObjectCandidate` type - Enriched candidate with mastery and economic data

**Constraint Management:**
- `src/main/services/constraint-propagation.service.ts`:
  - `buildConstraintGraph()` - Constructs the network of linguistic relationships for a goal
  - `propagateConstraints()` - Cascades selection effects (e.g., choosing "passive voice" restricts verb choices)
  - `applyConstraintPreferences()` - Applies soft preferences from collocations
  - `applyRestrictions()` - Enforces hard constraints
  - `validateAssignments()` - Confirms final slot assignments are valid
  - `ConstraintGraph` / `ObjectMetadata` types

**Usage Space Tracking:**
- `src/main/services/usage-space-tracking.service.ts`:
  - `recordUsageEvent()` - Logs that an object was used in a specific context
  - `getObjectUsageSpace()` - Retrieves the contexts where an object has been practiced
  - `calculateUsageSpaceProgress()` - Computes overall goal readiness based on coverage
  - `selectTaskContext()` - Chooses optimal context for next task (expansion vs. consolidation)
  - `getContextById()` / `STANDARD_CONTEXTS` - Context definitions based on CEFR domains

**Evaluation:**
- `src/main/services/multi-layer-evaluation.service.ts`:
  - `evaluateObject()` - Scores a single object's response
  - `evaluateBatch()` - Scores all objects in a multi-object task
  - `evaluationToThetaInput()` - Converts evaluation results to calibration input format
  - `ObjectEvaluationInput` / `ObjectEvaluationResult` / `BatchEvaluationResult` types

**Calibration:**
- `src/main/services/multi-object-calibration.service.ts`:
  - `processMultiObjectResponse()` - Updates theta estimates across all 5 linguistic components
  - `createMultiObjectTaskSpec()` - Builds the specification for multi-component calibration
  - `shouldUseMultiObjectProcessing()` - Determines if response warrants multi-object handling
  - `MultiObjectUserResponse` type

**Legacy Task Generation (Fallback):**
- `src/main/services/task-generation.service.ts`:
  - `generateTask()` - Original single-object task generation
  - `generateMultiObjectTask()` - Multi-object variant of legacy system
  - `GeneratedTask` / `LearningQueueItem` types

**Priority & Scheduling:**
- `src/main/services/state-priority.service.ts`:
  - `getLearningQueue()` - Gets prioritized list of what to practice next
  - `getNextLearningItem()` - Retrieves highest priority item for legacy fallback

### Dependents (What Needs This)

- **IPC Handlers** (`src/main/ipc/*.ipc.ts`): Will call `generateIntegratedTask()` when UI requests next task
- **Session Management**: Uses `processIntegratedResponse()` to handle learner submissions
- **Progress Dashboard**: May use `getPipelineStatus()` for debugging/analytics
- **Quick-start flows**: Can use `quickGenerateTask()` convenience wrapper

### Data Flow

**Task Generation Pipeline:**
```
Request comes in (userId, goalId, sessionId)
        |
        v
[1] Fetch user theta state from database
        |
        v
[2] Build candidate pool (all eligible objects with economic values)
        |
        v
[3] Build constraint graph (linguistic relationships)
        |
        v
[4] Get usage spaces for top candidates (where have they been practiced?)
        |
        v
[5] Find suitable task templates (what formats work for these components?)
        |
        v
[6] Select best template (score by candidate-slot match quality)
        |
        v
[7] Select usage context (expand to new contexts vs. consolidate?)
        |
        v
[8] Compose task with constraints (optimal slot filling)
        |
        v
[9] Build multi-object spec (for calibration system)
        |
        v
[10] Convert to GeneratedTask format (backward compatibility)
        |
        v
Return IntegratedTaskResult
```

**Response Processing Pipeline:**
```
Response comes in (task, response, timing, context)
        |
        v
[1] Build evaluation inputs from task slots
        |
        v
[2] Evaluate batch (multi-layer scoring for each object)
        |
        v
[3] Process through multi-object calibration (theta updates)
        |
        v
[4] Record usage events & detect expansions
        |
        v
[5] Generate enhanced feedback (include expansion celebrations)
        |
        v
Return IntegratedResponseResult
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits at the **Application Orchestration Layer** in LOGOS's architecture:

```
Layer 0: User Interface (React renderer)
         |
Layer 1: IPC Handlers (main process entry points)
         |
Layer 2: *** INTEGRATED TASK PIPELINE (this service) *** <-- Orchestrator
         |
         +---> task-composition.service (economic optimization)
         +---> constraint-propagation.service (linguistic rules)
         +---> usage-space-tracking.service (context coverage)
         +---> multi-layer-evaluation.service (response scoring)
         +---> multi-object-calibration.service (ability updates)
         +---> task-generation.service (legacy fallback)
         |
Layer 3: Core Algorithms (IRT, FSRS, PMI - pure functions)
         |
Layer 4: Database Repositories & Prisma
```

This service acts as the **facade** that shields upper layers from the complexity of coordinating six specialized services. The UI and IPC handlers only need to know about `generateIntegratedTask()` and `processIntegratedResponse()` - two clean entry points.

### Big Picture Impact

**Critical Role**: This is the **primary path** for all learning task generation in the new architecture. Without it:
- Tasks would be generated without considering linguistic constraints (impossible combinations could occur)
- Usage space tracking would be disconnected from task selection (no intelligent context expansion)
- Multi-object tasks couldn't be properly evaluated (partial credit would be broken)
- Theta updates would use outdated single-object calibration (less accurate ability estimation)

**What This Enables**:
1. **Intelligent Task Composition**: Tasks that combine objects synergistically (e.g., practicing a new word in a sentence pattern the learner already knows)
2. **Linguistic Validity**: Constraints ensure generated tasks are grammatically/semantically coherent
3. **Coverage-Aware Learning**: System actively pushes learners to use objects in new contexts, not just memorize in isolation
4. **Multi-Dimensional Progress**: A single task updates ability estimates across multiple linguistic components simultaneously
5. **Graceful Degradation**: Legacy fallback ensures the system always produces *something*, even if composition fails

### Critical Path Analysis

**Importance Level**: Critical (Primary Path)

**If This Fails**:
- Primary failure mode: No tasks generated -> learning session cannot proceed
- Mitigation: `allowLegacyFallback: true` enables graceful degradation to old task-generation
- Worst case: User sees error message and cannot continue practicing

**Dependencies That Could Cause Failure**:
- Database unavailable -> Cannot fetch theta state or candidates
- No candidates in pool -> Triggers legacy fallback
- No suitable templates -> Triggers legacy fallback
- Composition algorithm fails -> Triggers legacy fallback

**Recovery Strategy**: The service is designed with defense-in-depth. At each potential failure point, it either recovers internally or falls back to the proven legacy system. The `usedLegacyFallback` flag in results allows monitoring of how often the new system succeeds vs. falls back.

---

## Technical Concepts (Plain English)

### Candidate Pool Building

**Technical**: Economic optimization that evaluates all potential learning objects by computing their marginal learning value (expected theta gain weighted by priority) minus cognitive cost (load contribution based on difficulty and discrimination).

**Plain English**: Imagine you're packing for a trip with limited suitcase space. Each item has both a "usefulness score" and a "weight cost." The candidate pool builder looks at everything you *could* pack and calculates the "usefulness per pound" for each item. This lets the composition service pick the items that give you the most value for the space they take.

**Why We Use It**: Without economic scoring, the system would just grab the highest-priority items, which might all be very difficult and overwhelm the learner. Economic optimization balances what's most important with what's cognitively feasible.

### Constraint Graph

**Technical**: A directed graph where nodes represent linguistic objects and edges represent constraint relationships (requires, prefers, restricts, enables, excludes) between them, based on collocations, morphological patterns, and cross-component linguistic rules.

**Plain English**: Languages have rules about what goes together. If you're teaching the passive voice ("The ball was thrown"), you can't use an intransitive verb like "sleep" - it grammatically requires a verb that can take an object. The constraint graph is like a relationship map showing which words/patterns are compatible, preferred, or forbidden with each other.

**Why We Use It**: Ensures generated tasks are linguistically valid. Without it, the system might create nonsensical combinations like "The arrival was slept" that would confuse learners.

### Usage Space

**Technical**: A multi-dimensional representation of the contexts (domain x register x modality x genre) where a learner has demonstrated successful use of a language object, enabling transfer-of-learning tracking and coverage-based curriculum planning.

**Plain English**: Knowing a word in a classroom flashcard drill doesn't mean you can use it in a professional email or casual conversation. Usage space tracks *where* you've successfully used each word - have you only ever seen it in reading exercises, or have you also produced it in writing? Have you used it in formal contexts, informal contexts, or both?

**Why We Use It**: Real language mastery means being able to use words/patterns across many situations. Usage space tracking pushes the curriculum to expand where learners practice, not just repeat the same context endlessly.

### Multi-Layer Evaluation

**Technical**: Polytomous scoring that evaluates responses across multiple criteria (form accuracy, semantic appropriateness, contextual fit, etc.) with weighted partial credit, producing granular feedback that feeds into IRT-based ability estimation.

**Plain English**: Instead of just "right or wrong," multi-layer evaluation is like a teacher with a rubric. Maybe you spelled the word correctly but used it in the wrong context - you get partial credit for spelling but lose points for usage. Each layer (spelling, meaning, grammar, context) is scored separately, so feedback can tell you exactly what to work on.

**Why We Use It**: Binary scoring (correct/incorrect) loses information. If a learner always gets the meaning right but misspells words, that's valuable signal. Multi-layer evaluation captures this nuance and produces more accurate ability estimates.

### Multi-Object Calibration

**Technical**: Simultaneous theta updates for all five linguistic components (phonology, morphology, lexical, syntactic, pragmatic) based on a Q-matrix that specifies each object's loading on each component, using compensatory MIRT models to handle partial success patterns.

**Plain English**: A single language task often involves multiple skills - understanding the vocabulary, applying the right grammar, choosing appropriate formality. Multi-object calibration is like a coach who watches one performance and updates their assessment of your strength, flexibility, speed, and coordination all at once, based on what the exercise required.

**Why We Use It**: Traditional single-ability IRT would need many separate tasks to update each component. Multi-object calibration extracts maximum signal from each task, making learning more efficient and estimates more accurate.

### Legacy Fallback

**Technical**: Graceful degradation path that invokes the original task-generation.service when the integrated pipeline cannot produce a valid composed task, ensuring system availability while logging fallback occurrences for monitoring.

**Plain English**: The new composition system is sophisticated but can fail if no suitable templates exist, candidates are exhausted, or constraints are too restrictive. Legacy fallback is like having a backup generator - if the main power fails, the lights still stay on using the old reliable system. The system notes when this happens so developers can investigate why the new path didn't work.

**Why We Use It**: User experience must never completely break. Having a proven fallback ensures learners can always continue practicing, even if the fancy new features hit an edge case. It also makes the new system safer to deploy - issues cause degraded experience, not total failure.

---

## Key Interfaces

### IntegratedTaskRequest
The input for task generation - specifies the session, goal, user, and any preferences (task types, optimization settings, whether to prefer expanding to new contexts, and whether legacy fallback is allowed).

### IntegratedTaskResult
The output of task generation - contains the generated task (in either new ComposedTask or legacy GeneratedTask format), the multi-object specification for calibration, constraint propagation details, selected usage context, fallback status, and performance metadata.

### IntegratedResponseRequest
The input for response processing - contains the original task, user's response text, timing information, hint usage, cue level, and usage context.

### IntegratedResponseResult
The output of response processing - contains evaluation results (aggregate and per-object), calibration outcomes (theta updates), detected usage space expansions, updated coverage metrics, and enhanced feedback text.

---

## Change History

### 2026-01-06 - Initial Implementation
- **What Changed**: Created integrated pipeline service bridging all new composition components
- **Why**: Needed unified orchestration for economic optimization, constraint propagation, usage tracking, multi-layer evaluation, and calibration
- **Impact**: Establishes primary path for intelligent task generation; legacy system becomes fallback

### Design Decisions Captured:
1. **Defensive fallback approach**: Every potential failure triggers legacy fallback rather than error
2. **Top-20 candidate limit for usage space**: Performance optimization - checking all candidates would be too slow
3. **Template scoring by candidate match**: Better templates are those that match available candidates, not abstract "best" templates
4. **Expansion celebrations in feedback**: Usage space growth deserves positive reinforcement to encourage learner confidence
