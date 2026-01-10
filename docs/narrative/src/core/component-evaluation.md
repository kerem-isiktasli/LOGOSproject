# Component Evaluation Profiles Module

> **Last Updated**: 2026-01-08
> **Code Location**: `src/core/component-evaluation.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to provide differentiated evaluation criteria for each of the five linguistic components in the LOGOS system. Language learning is not monolithic - a learner might excel at vocabulary while struggling with grammar, or have strong pronunciation but weak pragmatic awareness. This module enables the system to evaluate, score, and provide targeted feedback at the component level rather than treating language proficiency as a single dimension.

**Business Need**: Learners need specific, actionable feedback about which aspects of language they should focus on. A generic "70% correct" score tells them nothing about whether to study vocabulary, grammar, or pronunciation. This module powers the diagnostic feedback that helps learners understand their strengths and weaknesses across different language dimensions.

**User Need**: When a learner makes an error, they need to know not just that they were wrong, but WHY they were wrong and WHAT specifically to practice. A vocabulary error ("wrong word") requires different remediation than a grammar error ("wrong form") even if both produce incorrect responses.

**When Used**:
- After every learner response during practice sessions
- When generating feedback messages to display to users
- During stage progression checks to determine if mastery has increased
- When detecting bottlenecks and cascade effects across components
- When selecting optimal tasks based on component weaknesses

---

## Theoretical Framework

This module is grounded in three foundational theories from applied linguistics and second language acquisition research.

### Multicomponent Models of Language (Levelt, 1989)

**Technical**: Levelt's speech production model proposes that language processing involves distinct, modular components that operate in sequence: conceptualization, formulation (lexical selection, grammatical encoding, phonological encoding), and articulation.

**Plain English**: Language isn't one skill but many skills working together like an assembly line. You first think of what you want to say, then find the words for it, then arrange them grammatically, then figure out how to pronounce them, then actually speak. Problems at any stage affect everything downstream.

**Why This Matters**: The LOGOS five-component model (LEX, MORPH, G2P, SYN, PRAG) maps directly to Levelt's stages. Evaluating each component separately allows the system to identify which "stage" of the assembly line is causing problems.

### Error Analysis (Corder, 1967)

**Technical**: Corder's framework distinguishes between errors (systematic deviations reflecting incomplete knowledge) and mistakes (random performance slips). Errors reveal the learner's underlying interlanguage system and should guide instruction.

**Plain English**: There's a difference between "I don't know this rule" and "I know it but messed up this time." Consistent patterns of errors tell you what the learner hasn't learned yet, while random mistakes just happen to everyone. Teachers should focus on the systematic errors because those show what needs to be taught.

**Why This Matters**: The ErrorCategory system in this module classifies errors by type, severity, and required remediation. This enables the system to distinguish systematic gaps from occasional slips and recommend appropriate practice.

### Interlanguage Theory (Selinker, 1972)

**Technical**: Interlanguage theory posits that learners develop a systematic linguistic system that is neither their native language nor the target language, but a transitional system with its own internal logic. This interlanguage evolves through stages toward target-like production.

**Plain English**: Learners don't go directly from "not knowing" to "knowing" a language. They build their own temporary version of the language that makes sense to them, which gradually gets closer to how native speakers talk. Each stage is logical even if it's not correct yet.

**Why This Matters**: The MasteryStage system (0-4) reflects interlanguage development. The stage progression criteria in this module operationalize how learners move from one interlanguage stage to the next, with different evaluation standards at each stage.

---

## The Five Component Profiles

### LEX (Lexical/Vocabulary)

**What It Evaluates**: Knowledge of individual words and multi-word expressions, including meaning, form, and appropriate use.

**Evaluation Criteria**:
| Criterion | Weight | Critical | Stage Required |
|-----------|--------|----------|----------------|
| Meaning Accuracy | 40% | Yes | 0 (New) |
| Form Accuracy | 25% | No | 1 (Recognition) |
| Collocation Use | 20% | No | 2 (Recall) |
| Register Appropriateness | 15% | No | 3 (Controlled) |

**Why This Weighting**: Meaning is weighted highest and marked critical because knowing what a word means is foundational - without correct meaning, everything else is irrelevant. Form (spelling/pronunciation) comes next, then the more advanced skills of collocation and register that only matter once basics are established.

**Error Types**:
- **Wrong Meaning** (severity: 1.0): Using "sensible" to mean "sensitive" - causes cascade effects because downstream components process the wrong concept
- **Spelling Error** (severity: 0.4): Writing "recieve" instead of "receive" - minor, doesn't usually impede communication
- **Collocation Error** (severity: 0.5): Saying "do a decision" instead of "make a decision" - marks speech as non-native but is understandable
- **Register Mismatch** (severity: 0.3): Using "awesome" in formal academic writing - contextually inappropriate but semantically correct

**Automaticity Threshold**: 1200ms - Vocabulary access should become rapid with mastery; slower responses indicate words aren't fully proceduralized.

### MORPH (Morphology)

**What It Evaluates**: Knowledge of word formation including prefixes, suffixes, inflections, and derivational patterns.

**Evaluation Criteria**:
| Criterion | Weight | Critical | Stage Required |
|-----------|--------|----------|----------------|
| Affix Recognition | 30% | No | 0 (New) |
| Derivation Accuracy | 35% | Yes | 1 (Recognition) |
| Inflection Accuracy | 25% | Yes | 1 (Recognition) |
| Productive Use | 10% | No | 3 (Controlled) |

**Why This Weighting**: Both derivation and inflection are marked critical because morphological errors directly affect meaning (verb tense, noun number) and are highly noticeable to native speakers. Productive use (applying patterns to new words) is weighted low because it's an advanced skill.

**Error Types**:
- **Wrong Affix** (severity: 0.7): Using "unsad" instead of recognizing that "un-" doesn't attach to "sad" - shows incomplete knowledge of affix constraints
- **Inflection Error** (severity: 0.6): Saying "goed" instead of "went" - very common developmental error
- **Overregularization** (severity: 0.5): Saying "childs" instead of "children" - applying regular rules to irregular forms, shows the rule is learned but exceptions aren't yet

**Automaticity Threshold**: 1500ms - Morphological processing should become automatic; learners shouldn't have to consciously think about verb endings.

### G2P (Grapheme-to-Phoneme / Pronunciation)

**What It Evaluates**: Mapping from written form to spoken form, including individual sounds, stress patterns, and connected speech phenomena.

**Evaluation Criteria**:
| Criterion | Weight | Critical | Stage Required |
|-----------|--------|----------|----------------|
| Phoneme Accuracy | 40% | Yes | 0 (New) |
| Stress Pattern | 25% | No | 1 (Recognition) |
| Intonation | 20% | No | 2 (Recall) |
| Connected Speech | 15% | No | 3 (Controlled) |

**Why This Weighting**: Individual phoneme accuracy is critical because many phoneme contrasts distinguish meaning (ship/ sheep, bit/beat). Stress and intonation are important but errors rarely cause complete misunderstanding. Connected speech features (linking, reduction) are advanced fluency markers.

**Error Types**:
- **Phoneme Substitution** (severity: 0.7): Pronouncing /th/ as /s/ in "think" - can cause confusion between words, causes cascade effects
- **Stress Error** (severity: 0.5): Stressing "PHOtograph" instead of "phoTOgraph" - noticeable but usually doesn't impede comprehension
- **Vowel Error** (severity: 0.6): Confusing /i/ and /ee/ in "ship" vs "sheep" - can cause word confusion

**Automaticity Threshold**: 1000ms - Pronunciation should be nearly instantaneous; hesitation indicates the G2P mapping isn't proceduralized.

### SYN (Syntactic / Grammar)

**What It Evaluates**: Knowledge of grammatical structures including word order, agreement, tense, and complex sentence construction.

**Evaluation Criteria**:
| Criterion | Weight | Critical | Stage Required |
|-----------|--------|----------|----------------|
| Structure Accuracy | 40% | Yes | 0 (New) |
| Agreement | 25% | Yes | 1 (Recognition) |
| Word Order | 20% | No | 1 (Recognition) |
| Syntactic Complexity | 15% | No | 3 (Controlled) |

**Why This Weighting**: Both structure and agreement are marked critical because errors in these areas fundamentally disrupt sentence comprehension. "He go store yesterday" is understandable but clearly non-native. Word order errors can range from minor to severe depending on language.

**Error Types**:
- **Word Order Error** (severity: 0.7): "I yesterday went" instead of "I went yesterday" - can cause confusion, especially in complex sentences; causes cascade effects
- **Agreement Error** (severity: 0.6): "He go" instead of "He goes" - very common L2 error, highly noticeable
- **Tense Error** (severity: 0.65): "I will went" instead of "I will go" - indicates incomplete tense system knowledge
- **Missing Element** (severity: 0.5): "I have car" omitting the article - common for speakers of article-less L1s

**Automaticity Threshold**: 2000ms - Grammar processing is complex; even native speakers need more time for syntactic operations than lexical access.

### PRAG (Pragmatics)

**What It Evaluates**: Appropriate language use in context, including register, politeness, speech acts, and cultural conventions.

**Evaluation Criteria**:
| Criterion | Weight | Critical | Stage Required |
|-----------|--------|----------|----------------|
| Contextual Appropriateness | 35% | Yes | 0 (New) |
| Register Accuracy | 25% | No | 1 (Recognition) |
| Speech Act Realization | 25% | No | 2 (Recall) |
| Cultural Awareness | 15% | No | 3 (Controlled) |

**Why This Weighting**: Contextual appropriateness is critical because pragmatic failure can have serious social consequences - being accidentally rude, overly familiar, or inappropriately formal damages relationships. Speech acts and register are important but can often be compensated for.

**Error Types**:
- **Register Error** (severity: 0.6): Using "gonna" in a business email - contextually inappropriate, marks speaker as unaware of conventions
- **Politeness Error** (severity: 0.7): Being too direct in a request - can damage relationships, culturally sensitive
- **Speech Act Failure** (severity: 0.8): An apology that isn't perceived as an apology - causes communication breakdown, triggers cascade effects

**Automaticity Threshold**: 3000ms - Pragmatic judgments require considering context, relationship, and social factors; this naturally takes longer than lower-level processes.

---

## Microscale: Direct Relationships

### Dependencies (What This Module Needs)

- `src/core/types.ts`: ComponentType, MasteryStage
  - Provides the fundamental type definitions for the five components and the five mastery stages
  - Without these types, the profiles couldn't specify which component they evaluate or which stage criteria apply at

### Dependents (What Needs This Module)

- **Task Generation System**: Uses component profiles to select appropriate task types for each component's primary and secondary task associations
- **Feedback Generation**: Uses error categories and their remediation suggestions to generate actionable feedback messages
- **Response Evaluation Pipeline**: Calls `evaluateResponse()` to score learner responses against component-specific criteria
- **Stage Progression System**: Calls `checkStageProgression()` to determine when learners advance to higher mastery stages
- **Bottleneck Detection**: Calls `evaluateMultiComponent()` to detect cascade effects and identify primary bottleneck components
- **Learning Queue Prioritization**: Uses component evaluation results to adjust item priorities based on component-level performance

### Data Flow

```
Learner Response
      |
      v
evaluateResponse(component, criterionScores, responseTimeMs, stage)
      |
      +---> Profile lookup via COMPONENT_PROFILES[component]
      |
      +---> Calculate weighted score from applicable criteria
      |           (only criteria where minStage <= learner's stage)
      |
      +---> Check for critical failures (score < 0.4 on critical criteria)
      |
      +---> Detect errors via criterion-to-error mapping
      |
      +---> Generate feedback (positive for high scores, improvement for low)
      |
      +---> Identify focus areas (prioritize critical low scores)
      |
      +---> Check automaticity (responseTime < automaticityThreshold)
      |
      v
ComponentEvaluationResult
      |
      +---> overallScore: weighted average
      +---> passed: score >= 0.6 AND no critical failures
      +---> errorsDetected: matched error categories
      +---> feedback: array of feedback strings
      +---> focusAreas: prioritized improvement targets
      +---> isAutomatic: whether response was fast enough
      +---> confidence: proportion of criteria evaluated
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithm Layer** of the LOGOS three-tier architecture:

```
[Renderer Layer - React UI]
         |
         | (IPC calls)
         v
[Main Process Layer - Electron]
         |
         | (imports)
         v
[Core Algorithm Layer] <-- component-evaluation.ts IS HERE
         |
         | (database operations)
         v
[Persistence Layer - SQLite]
```

**Position in Processing Pipeline**:
```
Task Presentation --> Response Capture --> EVALUATION --> Feedback Display
                                               ^
                                               |
                                    This module provides the
                                    scoring and classification
```

### Big Picture Impact

This module is a **diagnostic hub** that enables the entire personalized learning approach:

1. **Differentiated Instruction**: Without component-specific evaluation, the system couldn't distinguish "needs vocabulary work" from "needs grammar work." All learners would get generic practice.

2. **Cascade Detection**: The multi-component evaluation identifies when errors in one component (e.g., wrong word) cause failures in another (e.g., sentence doesn't make sense). This is critical for addressing root causes rather than symptoms.

3. **Stage Progression**: The stage criteria operationalize interlanguage development. Without them, the system couldn't determine when learners are ready for more advanced material.

4. **Task Selection**: The profile's `primaryTaskTypes` and `secondaryTaskTypes` inform task generation about which task types best assess each component.

5. **Response Time Standards**: The `responseTimeTargets` and `automaticityThreshold` values enable fluency assessment - distinguishing effortful knowledge from automatic skill.

### System Dependencies

**If this module fails**, the following capabilities are lost:
- Cannot generate component-specific feedback (falls back to generic "correct/incorrect")
- Cannot detect cascade effects between components
- Cannot determine stage progression readiness
- Cannot identify bottleneck components
- Task selection loses component-appropriateness information

**Critical Path**: This is a **high-importance, medium-criticality** module. The system can function without it (basic correct/incorrect evaluation), but loses its core differentiating capability of component-level diagnosis.

---

## Key Types (Plain English Glossary)

### EvaluationCriterion

**Technical**: A weighted evaluation dimension with a scoring rubric that specifies point values for different performance levels.

**Plain English**: One specific thing to check when grading, like "Did they spell it right?" Each criterion has a name, a weight showing how important it is, and a rubric saying what counts as excellent/good/poor.

**Why It Exists**: Different aspects of language matter differently. Knowing the meaning of a word matters more than spelling it perfectly, so meaning gets a higher weight.

### ErrorCategory

**Technical**: A classification of error type with associated severity, cascade potential, and remediation guidance.

**Plain English**: A label for what went wrong, like "Collocation Error" or "Wrong Tense." Each error type has a seriousness rating and advice for how to fix it.

**Why It Exists**: Not all errors are equal. Some cause cascade effects (wrong word choice affects the whole sentence), others are minor. The system needs to prioritize addressing serious errors.

### ComponentEvaluationProfile

**Technical**: A complete specification for evaluating one linguistic component, including criteria, error categories, task mappings, response time targets, and stage progression requirements.

**Plain English**: Everything the system needs to know to grade one aspect of language. It's like a complete grading guide for a specific skill.

**Why It Exists**: Each component (vocabulary, grammar, pronunciation, etc.) needs its own evaluation approach. You can't grade pronunciation the same way you grade grammar.

### StageRequirement

**Technical**: Threshold values for accuracy, trial count, stability, and automatization that must be met to advance to the next mastery stage.

**Plain English**: The checklist of requirements to "level up" in a skill. You need a certain accuracy, a certain number of successful tries, and the skill needs to be stable over time.

**Why It Exists**: Progression should be evidence-based, not arbitrary. These requirements ensure learners have genuinely mastered a stage before facing harder material.

### ComponentEvaluationResult

**Technical**: The output of single-component evaluation containing scores, detected errors, pass/fail status, feedback, focus areas, and automaticity assessment.

**Plain English**: The complete report card for one response on one component. It tells you the score, what went wrong, whether you passed, what to work on, and whether you answered fast enough to show real fluency.

**Why It Exists**: The evaluation function needs to return structured data that other parts of the system can use for feedback, scheduling, and progress tracking.

### MultiComponentEvaluationResult

**Technical**: Aggregated evaluation across multiple components with cascade effect detection and bottleneck identification.

**Plain English**: A combined report when a task tests multiple skills at once. It shows how each skill scored, whether problems in one skill caused problems in others, and which skill is holding you back the most.

**Why It Exists**: Real language use involves multiple components simultaneously. A sentence requires vocabulary AND grammar AND pronunciation. This type captures the interactions between components.

### CascadeEffect

**Technical**: A detected propagation of error from a source component to an affected component, with quantified impact.

**Plain English**: When a mistake in one area causes problems in another area. Like if you used the wrong word and that made your whole sentence confusing - the vocabulary error "cascaded" into a comprehension problem.

**Why It Exists**: To help learners focus on root causes rather than symptoms. If grammar errors are caused by vocabulary gaps, fixing vocabulary will fix both problems.

---

## Key Functions

### evaluateResponse()

**Purpose**: Evaluates a single response against one component's criteria and returns a detailed result.

**When Called**: After every learner response, for each component being assessed.

**Logic Summary**:
1. Look up the component's profile
2. Filter criteria to only those applicable at the learner's current stage
3. Calculate weighted average score from criterion scores
4. Check for critical criterion failures (score < 0.4 on critical criteria)
5. Determine pass/fail (score >= 0.6 AND no critical failures)
6. Detect errors by mapping low-scoring criteria to error categories
7. Generate positive and improvement feedback
8. Identify priority focus areas
9. Check if response time indicates automaticity
10. Calculate confidence based on how many criteria were evaluated

**Return Value**: Complete ComponentEvaluationResult with all diagnostic information.

### checkStageProgression()

**Purpose**: Determines if a learner meets the requirements to advance to the next mastery stage.

**When Called**: After accumulating sufficient response data, typically at session end or after milestone completions.

**Logic Summary**:
1. If already at stage 4 (maximum), return false
2. Look up the requirements for the next stage
3. Check accuracy >= minAccuracy
4. Check successfulTrials >= minSuccessfulTrials
5. Check stability >= requiredStability (days)
6. Check automatization >= requiredAutomatization
7. Return true only if ALL requirements are met

**Design Rationale**: Stage progression requires multiple evidence types to prevent premature advancement. A learner might score high accuracy on a single day but lack the stability and automaticity that indicate true mastery.

### evaluateMultiComponent()

**Purpose**: Evaluates responses across multiple components simultaneously, detecting interactions and cascade effects.

**When Called**: For tasks that test multiple components (e.g., a sentence production task involves LEX + SYN + PRAG).

**Logic Summary**:
1. Evaluate each component individually using evaluateResponse()
2. Scan for cascade effects:
   - For each component with cascade-causing errors
   - Check if other components scored low
   - Record the cascade relationship and impact
3. Calculate overall score as average of component scores
4. Identify bottleneck (lowest-scoring component if below 0.6)
5. Generate integrated feedback considering all components and cascades

**Cascade Detection Logic**: If Component A has an error marked `causesCascade: true` AND Component B scored below 0.7, the system infers that A's error may have affected B. This is a heuristic but captures the common pattern where upstream errors cause downstream failures.

---

## Response Time Targets by Stage

Each component has stage-specific response time expectations that reflect the development from effortful processing to automatic skill.

| Stage | LEX (ms) | MORPH (ms) | G2P (ms) | SYN (ms) | PRAG (ms) |
|-------|----------|------------|----------|----------|-----------|
| 0 (New) | 5000-10000 | 6000-12000 | 4000-8000 | 8000-15000 | 10000-20000 |
| 1 (Recognition) | 3000-6000 | 4000-8000 | 2500-5000 | 5000-10000 | 7000-14000 |
| 2 (Recall) | 2000-4000 | 2500-5000 | 1800-3500 | 3500-7000 | 5000-10000 |
| 3 (Controlled) | 1500-3000 | 1800-3500 | 1200-2500 | 2500-5000 | 3500-7000 |
| 4 (Automatic) | 1000-2000 | 1200-2500 | 800-1800 | 1800-3500 | 2500-5000 |

**Pattern**:
- Pragmatics always slowest (most complex processing)
- Pronunciation always fastest (direct mapping)
- Grammar in the middle (structural processing)
- All components get faster with higher stages

**Automaticity Thresholds** (response time below which processing is considered automatic):
- LEX: 1200ms
- MORPH: 1500ms
- G2P: 1000ms
- SYN: 2000ms
- PRAG: 3000ms

---

## Stage Progression Criteria

Requirements increase progressively across stages, reflecting the increasing standards for true mastery.

### Example: LEX (Vocabulary) Progression

| To Reach Stage | Accuracy | Trials | Error Rate | Stability | Automatization |
|----------------|----------|--------|------------|-----------|----------------|
| 1 (Recognition) | 40% | 3 | 60% | 1 day | 0% |
| 2 (Recall) | 60% | 5 | 40% | 3 days | 20% |
| 3 (Controlled) | 75% | 8 | 25% | 7 days | 40% |
| 4 (Automatic) | 95% | 20 | 5% | 30 days | 85% |

**Interpretation**: To be considered "Automatic" (stage 4) in vocabulary, a learner must:
- Achieve 95% accuracy on this word
- Have at least 20 successful recalls
- Make errors less than 5% of the time
- Maintain this performance stably for 30 days
- Respond automatically (fast) 85% of the time

### Cross-Component Comparison

Pragmatics has the most lenient progression criteria (harder to evaluate, more subjective), while Vocabulary has the strictest (clearest right/wrong answers, most data available).

---

## Memory Safety

The module implements safeguards against unbounded data growth:

- `MAX_ERROR_CATEGORIES = 50`: Limits error categories returned per profile
- `MAX_CRITERIA = 20`: Limits evaluation criteria per profile (though current profiles use 4)
- Arrays are sliced to maximum limits before returning
- Feedback arrays capped at 5 items
- Focus areas capped at 3 items

**Rationale**: In a long-running application, unbounded arrays could grow indefinitely. These limits ensure predictable memory usage while still providing sufficient diagnostic detail.

---

## Integration Patterns

### Pattern 1: Simple Response Evaluation

```
Input: criterion scores for one component
     |
     v
evaluateResponse(component, scores, time, stage)
     |
     v
Output: ComponentEvaluationResult
     |
     v
Display: feedback[] to user
         focusAreas[] to learning queue
         passed to progress tracking
```

### Pattern 2: Multi-Component Task Evaluation

```
Input: criterion scores for multiple components
     |
     v
evaluateMultiComponent(componentScores, responseTimes, stages)
     |
     +---> For each component: evaluateResponse()
     |
     +---> Detect cascade effects between components
     |
     +---> Identify bottleneck component
     |
     v
Output: MultiComponentEvaluationResult
     |
     v
Use: bottleneckComponent to focus practice
     cascadeEffects to identify root causes
     integratedFeedback to display to user
```

### Pattern 3: Stage Progression Check

```
Input: accumulated performance data
     |
     v
checkStageProgression(profile, currentStage, accuracy, trials, stability, automatization)
     |
     v
Output: boolean (ready to advance?)
     |
     v
If true: Update MasteryState.stage
         Unlock harder tasks
         Adjust scheduling parameters
```

---

## Change History

### 2026-01-08 - Documentation Created
- **What Changed**: Created narrative documentation for component-evaluation.ts
- **Why**: To provide context, theoretical grounding, and plain-language explanations for maintainers and stakeholders
- **Impact**: Improves understanding of the evaluation system's design rationale

### Initial Implementation
- **What Changed**: Created five component profiles with evaluation criteria, error categories, and stage progression requirements
- **Why**: To enable differentiated instruction based on component-specific assessment
- **Impact**: Enables the core LOGOS value proposition of personalized, component-aware language learning
