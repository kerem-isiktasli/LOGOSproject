# Multi-Layer Evaluation Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/multi-layer-evaluation.service.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to solve a fundamental challenge in language learning assessment: how do you fairly evaluate a learner's response when "correctness" is not black-and-white? In real language use, answers can be partially correct, contextually appropriate but grammatically imperfect, or semantically accurate but stylistically inappropriate.

The Multi-Layer Evaluation Service implements **object-specific evaluation** with multiple scoring modes, allowing the LOGOS system to provide nuanced, educationally meaningful feedback rather than crude pass/fail judgments. This is critical for adaptive learning because oversimplified scoring would either frustrate learners with false negatives or mislead them with false positives.

**Business/User Need**: Learners need feedback that accurately reflects the quality of their responses across multiple dimensions (spelling, grammar, meaning, context). Without multi-layer evaluation, the system could not distinguish between a minor spelling error and a complete misunderstanding of the concept - both would appear as simply "wrong."

**When Used**:
- Every time a user submits a response to a learning task
- During batch evaluation of multiple responses at session end
- When converting evaluation results to theta (ability estimate) updates for the adaptive algorithm

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`src/core/types.ts`**: Imports foundational types that define the structure of evaluations:
  - `ComponentCode`: The five linguistic components (PHON, MORPH, LEX, SYNT, PRAG)
  - `EvaluationMode`: How to evaluate - binary, partial_credit, range_based, or rubric_based
  - `EvaluationLayer`: Structure for multi-layer scoring criteria
  - `AnswerRange`: Acceptable answer variants with fuzzy matching
  - `ObjectEvaluationConfig`: Per-object evaluation settings
  - `ObjectRubric`: Complex scoring rubric definitions
  - `ComponentEvaluation` / `MultiComponentEvaluation`: Evaluation result structures
  - `ObjectRole` / `ROLE_CONFIGS`: How objects function in tasks (assessment, practice, reinforcement, incidental)

### Dependents (What Needs This)

- **`src/main/services/multi-object-calibration.service.ts`**: Uses `evaluateObject()` and `evaluateBatch()` to score user responses before calculating theta updates. The calibration service handles the IRT-based ability estimation that happens after evaluation.

- **`src/main/services/scoring-update.service.ts`**: May use the evaluation functions for simpler single-object tasks, though it has its own evaluation logic for basic scenarios.

- **IPC handlers** (likely `learning.ipc.ts`): Frontend task submission flows through IPC to these evaluation functions.

### Data Flow

```
User submits response
    |
    v
ObjectEvaluationInput (objectId, response, expected, config)
    |
    v
evaluateObject() dispatches to appropriate mode:
    |---> evaluateBinary()         --> Simple correct/incorrect
    |---> evaluatePartialCredit()  --> Multi-layer scoring with weighted criteria
    |---> evaluateRangeBased()     --> Fuzzy matching against acceptable variants
    |---> evaluateRubricBased()    --> Complex holistic/analytic rubric scoring
    |
    v
ObjectEvaluationResult (score, correct, layerScores, feedback, errorType)
    |
    v
evaluationToThetaInput() --> Converts to theta contribution for ability updates
    |
    v
Multi-Object Calibration Service --> Updates user ability estimates
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits in **Layer 3 (Scoring + Update)** of the LOGOS three-layer learning pipeline:

```
Layer 1: State + Priority (what to teach next)
         |
         v
Layer 2: Task Generation (how to present it)
         |
         v
Layer 3: THIS MODULE - Scoring + Update (how did the learner do?)
         |
         v
Back to Layer 1 (updated abilities inform next item selection)
```

The evaluation service is the critical feedback mechanism that closes the learning loop. Without accurate evaluation, the adaptive algorithm cannot properly estimate learner ability, leading to tasks that are too easy or too hard.

### Big Picture Impact

The Multi-Layer Evaluation Service enables:

1. **Adaptive Difficulty**: By providing nuanced scores (not just correct/incorrect), the system can make fine-grained adjustments to theta estimates, leading to better task targeting.

2. **Component-Specific Learning**: Different linguistic components (vocabulary, grammar, pronunciation, etc.) can be evaluated independently, enabling the system to identify and address specific weaknesses.

3. **Meaningful Feedback**: Learners receive explanations of what they got right, what needs work, and specific error types - not just "wrong, try again."

4. **Academic Rigor**: The scoring models are based on established psychometric frameworks:
   - **Generalized Partial Credit Model** (Muraki, 1992) - for polytomous (multi-level) scoring
   - **Many-Facet Rasch Measurement** (Linacre, 1989) - for rubric-based evaluation with multiple raters/criteria

### Critical Path Analysis

**Importance Level**: Critical

- **If this fails**: All response scoring breaks. The system cannot provide feedback to learners or update ability estimates. The entire adaptive learning loop stops functioning.

- **Failure mode**: Learning stagnates because the system cannot distinguish between good and bad responses. Users would see no progress or wildly inaccurate progress.

- **No fallback**: This is a core service with no redundant alternative. The binary evaluation provides a minimal fallback if other modes fail.

---

## Technical Concepts (Plain English)

### Generalized Partial Credit Model (GPCM)

**Technical**: A psychometric model (Muraki, 1992) that extends Item Response Theory to handle items with more than two score categories. It models the probability of achieving each successive score level based on learner ability and item-specific step difficulties.

**Plain English**: Instead of grading a test question as simply "right" or "wrong," this is like grading an essay where you might get 0, 1, 2, or 3 points depending on how close you got. The model mathematically accounts for the fact that getting from 0 to 1 point might require different skills than getting from 2 to 3 points.

**Why We Use It**: Language learning responses often have degrees of correctness. Saying "I goed to the store" shows understanding of past tense even though the form is wrong - that deserves partial credit compared to "I go to the store."

### Many-Facet Rasch Measurement (MFRM)

**Technical**: A psychometric framework (Linacre, 1989) for analyzing assessments with multiple facets that affect scores, such as different raters, criteria, or task types. It separates the contribution of each facet to enable fair comparison.

**Plain English**: Imagine judging a figure skating competition where different judges have different standards, some routines are harder than others, and you're scoring multiple elements (jumps, spins, artistry). MFRM is like a mathematical referee that adjusts everyone's scores so they can be fairly compared despite all these differences.

**Why We Use It**: Our rubric-based evaluation considers multiple criteria (form accuracy, contextual appropriateness, semantic accuracy) that each contribute differently to the final score. MFRM provides the theoretical foundation for combining these fairly.

### Levenshtein Distance

**Technical**: An algorithm that measures the minimum number of single-character edits (insertions, deletions, substitutions) required to transform one string into another. Used to calculate string similarity.

**Plain English**: If you typed "recieve" instead of "receive," the Levenshtein distance is 2 (swap 'i' and 'e', or delete 'i' and insert 'i' elsewhere). It counts how many typos or changes separate two words.

**Why We Use It**: We use this to detect "close" answers. If someone types 95% of the letters correctly, that is likely a minor spelling error rather than a complete misunderstanding. The system converts Levenshtein distance to a similarity percentage for partial credit scoring.

### Evaluation Layers

**Technical**: A multi-dimensional scoring approach where each response is scored on multiple independent criteria (layers), each with its own weight. The final score is a weighted combination of layer scores.

**Plain English**: Like grading a presentation on Content (50%), Delivery (30%), and Visual Aids (20%) separately, then combining them. You might have great content but poor delivery - the layers let us see and address each aspect independently.

**Why We Use It**: Language responses have multiple quality dimensions. A vocabulary response might have correct meaning but wrong spelling, or correct form but inappropriate register. Layers let us identify exactly what needs work.

### Fuzzy Matching (Range-Based Evaluation)

**Technical**: An evaluation approach that accepts a range of responses as correct, using exact matches, acceptable variants, regex pattern matching, and semantic similarity thresholds.

**Plain English**: Instead of requiring "happy" as the only correct answer, we might accept "happy" (exact), "glad" (synonym), "joyful" (variant), and even "content" if it's close enough semantically. It's like a teacher who accepts multiple valid answers, not just the one in the answer key.

**Why We Use It**: Language is inherently flexible - there are often multiple ways to express the same meaning. Rigid single-answer evaluation would penalize valid creative responses and frustrate learners.

### Error Type Classification

**Technical**: Categorization of incorrect responses into types (omission, substitution, addition, ordering, form, usage) based on analysis of how the response differs from the expected answer.

**Plain English**: Instead of just saying "wrong," we identify what kind of mistake was made. Did the learner leave something out (omission)? Use the wrong word entirely (substitution)? Get the word order jumbled (ordering)? Use the right word but wrong form, like "runned" instead of "ran" (form)?

**Why We Use It**: Different error types require different remediation. A form error suggests the learner knows the word but needs morphology practice. A substitution suggests they may not know the word at all. This classification drives targeted feedback and future task selection.

### Default Evaluation Layers by Component

**Technical**: Pre-configured layer definitions for each of the five linguistic component types (LEX, MORPH, SYNT, PRAG, PHON), providing sensible default multi-layer scoring when no custom configuration is specified.

**Plain English**: Each type of language knowledge is evaluated on the dimensions that matter most for that type. Vocabulary (LEX) is judged on spelling, meaning, and context fit. Grammar (SYNT) is judged on structure, agreement, and word order. Pronunciation (PHON) is judged on accuracy and intelligibility.

**Default Layers by Component**:

| Component | Layer 1 (Primary) | Layer 2 | Layer 3 |
|-----------|-------------------|---------|---------|
| **LEX** (Vocabulary) | Semantic Accuracy (50%) | Spelling (30%) | Contextual Appropriateness (20%) |
| **MORPH** (Word Forms) | Form Accuracy (60%) | Spelling (40%) | - |
| **SYNT** (Grammar) | Structure (50%) | Agreement (30%) | Word Order (20%) |
| **PRAG** (Usage) | Appropriateness (40%) | Register (30%) | Politeness (30%) |
| **PHON** (Pronunciation) | Accuracy (70%) | Intelligibility (30%) | - |

**Why We Use It**: Provides sensible out-of-the-box evaluation without requiring custom configuration for every object. Task designers can override with custom layers when needed.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial Shadow Map documentation created
- **Why**: To provide narrative explanation of this critical service for development team
- **Impact**: Enables better understanding and maintenance of the evaluation system

### Initial Implementation
- **What Changed**: Created multi-layer evaluation service with four scoring modes
- **Why**: Need for nuanced evaluation that goes beyond simple correct/incorrect
- **Impact**: Enables partial credit, contextual evaluation, and meaningful feedback throughout the learning system

---

## Key Functions Reference

### `evaluateObject(input: ObjectEvaluationInput): ObjectEvaluationResult`
The main entry point. Dispatches to the appropriate evaluation mode based on configuration.

### `evaluateBatch(inputs: ObjectEvaluationInput[], config): BatchEvaluationResult`
Evaluates multiple objects in a single task, calculating weighted composite scores and aggregated feedback.

### `evaluationToThetaInput(result, role, weight): ThetaContributionInput`
Bridges evaluation results to the theta (ability) update system. Applies role-based adjustments so that assessment objects contribute more to ability estimates than incidental exposure objects.

### `getDefaultLayers(componentType: ComponentCode): EvaluationLayer[]`
Returns the default multi-layer evaluation configuration for a given linguistic component type.

---

## Academic Foundations

This service is grounded in established psychometric research:

- **Masters, G.N. (1982)**. A Rasch model for partial credit scoring. *Psychometrika, 47*(2), 149-174.
- **Muraki, E. (1992)**. A generalized partial credit model: Application of an EM algorithm. *Applied Psychological Measurement, 16*(2), 159-176.
- **Linacre, J.M. (1989)**. *Many-Facet Rasch Measurement*. MESA Press.

These models ensure that the evaluation scoring is not arbitrary but follows principled psychometric frameworks validated in educational assessment research.
