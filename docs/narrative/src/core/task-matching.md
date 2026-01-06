# Task Matching Module (z(w) Vector System)

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/task-matching.ts`
> **Status**: Active

---

## Context & Purpose

This module implements a sophisticated algorithm for matching vocabulary words to optimal practice task types based on each word's linguistic characteristics. It solves the problem of "one-size-fits-all" language learning by recognizing that different words benefit from different types of practice.

**Business/User Need**: When a learner practices vocabulary, they should not just do generic flashcard drills. A word with complex pronunciation needs listening/dictation practice. A word with rich collocations needs context exercises. A word with many related forms needs word-family exercises. This personalization dramatically improves learning efficiency and retention.

**When Used**: This module is invoked every time the system needs to decide what type of exercise to present for a vocabulary item. It is called by the task generation service during learning sessions to select the most pedagogically appropriate task format for each word.

**Academic Foundation**: The approach is grounded in vocabulary acquisition research by Nation (2001), Laufer & Nation (2012), and Schmitt (2010), which establish that different vocabulary knowledge dimensions (form, meaning, use) require different instructional approaches.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/core/types.ts`: Imports type definitions including:
  - `TaskType` - The 15 different task types (recognition, recall_cued, collocation, etc.)
  - `TaskFormat` - Presentation formats (mcq, fill_blank, free_response, etc.)
  - `TaskModality` - Input/output channels (visual, auditory, mixed)
  - `MasteryStage` - Learner's current proficiency level (0-4)
  - `LanguageObjectType` - Classification of vocabulary items (LEX, MWE, TERM, etc.)

### Dependents (What Needs This)

- `src/main/services/task-generation.service.ts`: The primary consumer - uses this module to determine which task type to generate for each vocabulary item
- Future integration: Session orchestration will use batch recommendations to build varied practice sessions
- Future integration: Content generation pipeline will use modality preferences for audio/visual content creation

### Data Flow

```
Word's linguistic data (frequency, morphology, phonology, etc.)
    |
    v
extractZVector() - Normalize raw metrics to 0-1 scale
    |
    v
ZVector: { frequency, relationalDensity, domainRelevance, morphological, phonological, pragmatic }
    |
    v
calculateTaskSuitability() - Apply affinity matrix against user's mastery stage
    |
    v
TaskSuitabilityMap: { recognition: 0.7, collocation: 0.95, word_formation: 0.3, ... }
    |
    v
recommendTask() - Select highest-scoring task with format/modality
    |
    v
TaskRecommendation: { taskType, taskFormat, modality, suitability, reason, alternatives }
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithms Layer** (Layer 1) of LOGOS's three-tier architecture:

- **Layer 3**: UI/Renderer (displays tasks to user)
- **Layer 2**: Services/IPC (task-generation.service.ts orchestrates task creation)
- **Layer 1**: Core Algorithms (this module - pure computation, no I/O)

This is a pure computational module with no database access or external dependencies. It receives data, performs calculations, and returns results. This design ensures:
- Testability (easy to unit test with mock data)
- Portability (could run in browser or server)
- Predictability (same inputs always produce same outputs)

### Big Picture Impact

The z(w) vector task matching system is central to LOGOS's **adaptive learning philosophy**. It enables:

1. **Personalized Learning Paths**: Each word gets the practice type it needs, not generic drills
2. **Efficient Time Use**: Learners spend time on practice that addresses actual knowledge gaps
3. **Natural Progression**: As mastery increases, task types automatically shift from recognition to production
4. **Engagement**: Variety in task types prevents boredom and maintains motivation

**System Dependencies**:
- **Upstream**: Requires accurate z(w) vector data from vocabulary enrichment pipeline (frequency, morphology, etc.)
- **Downstream**: Task generation service cannot select optimal tasks without these recommendations
- **Parallel**: Works alongside FSRS scheduling (which decides WHEN to practice) and IRT (which measures ability)

### Critical Path Analysis

**Importance Level**: High

- **If this fails**: The system falls back to generic task selection, losing the personalization advantage. Learning efficiency drops, but the app remains functional.
- **Failure mode**: Most likely failure is missing z(w) data for new words - handled by defaulting all scores to 0.5 (neutral).
- **Graceful degradation**: If recommendations fail, `recommendTask()` returns a safe default (recognition task with MCQ format).

---

## Technical Concepts (Plain English)

### z(w) Vector

**Technical**: A six-dimensional vector representing a word's linguistic characteristics: Frequency (F), Relational density (R), Domain relevance (D), Morphological complexity (M), Phonological difficulty (P), and Pragmatic sensitivity (PRAG). Each dimension is normalized to a 0-1 scale.

**Plain English**: Think of it as a "personality profile" for each word. Just like people have different strengths and weaknesses, words have different learning challenges. One word might be common but hard to pronounce (high F, high P). Another might be rare but easy to spell (low F, low P). The z(w) vector captures these six key dimensions that determine HOW a word should be practiced.

**Why We Use It**: Instead of treating all words the same, we can match practice activities to each word's specific challenges.

### Task Affinity Matrix

**Technical**: A weighted mapping from z(w) components to task types, where each cell indicates how much a particular task type benefits from high values in that z(w) dimension. Example: `collocation` task has 0.95 affinity to `relationalDensity` because words with many natural word partners benefit most from collocation practice.

**Plain English**: Like a matchmaking table. If a word is "great at making friends with other words" (high relational density), the table says "this word should do collocation exercises." If a word is "hard to pronounce" (high phonological difficulty), the table says "this word needs pronunciation practice."

**Why We Use It**: It encodes expert linguistic knowledge about which practice types work best for which types of words.

### Mastery Stage Constraints

**Technical**: A mapping from mastery stages (0-4) to available task types, implementing the pedagogical principle that learners must recognize before they can recall, and recall before they can produce.

**Plain English**: Like learning to drive - you cannot start with highway merging. First you learn to recognize traffic signs (stage 0-1), then parallel parking in a quiet lot (stage 2-3), then highway driving (stage 4). Similarly, a Stage 0 learner can only do recognition tasks (multiple choice), while a Stage 4 learner can do register shifting and rapid response.

**Why We Use It**: Prevents frustration from tasks that are too advanced and boredom from tasks that are too easy.

### Batch Recommendation with Variety Enforcement

**Technical**: The `recommendTaskBatch()` function generates recommendations for multiple words while tracking task type counts and substituting alternatives when a type appears too frequently (configurable via `maxPerType` parameter).

**Plain English**: Like a restaurant that will not serve you the same dish three times in a row even if you keep ordering it. If the algorithm keeps recommending "collocation" tasks, it will eventually switch to the next-best task type to keep practice varied and engaging.

**Why We Use It**: Monotonous practice leads to disengagement. Variety maintains attention and exercises multiple cognitive pathways.

### Dominant Component Detection

**Technical**: The `getDominantComponent()` function identifies which z(w) dimension has the highest value for a word, used to determine primary modality and generate human-readable recommendation reasons.

**Plain English**: Finding the "main challenge" of a word. If phonological score is highest, the word's main challenge is pronunciation. This guides decisions like "should this word be practiced with audio or text?"

**Why We Use It**: Allows the system to explain its recommendations in terms of the word's primary characteristic.

---

## Key Functions Explained

### `calculateTaskSuitability(zVector, masteryStage)`

**What it does**: Takes a word's z(w) profile and the learner's current mastery stage, returns scores for all 15 task types indicating how suitable each is.

**Algorithm**:
1. For each task type, multiply each z(w) component by its affinity score
2. Sum these weighted values
3. Normalize by total affinity weight
4. Apply a 90% penalty if the task is not available at the learner's mastery stage

**Output example**:
```
{ recognition: 0.52, recall_cued: 0.48, collocation: 0.81, word_formation: 0.22, ... }
```

### `recommendTask(profile)`

**What it does**: Given a complete word profile, returns the single best task recommendation with format, modality, and explanation.

**Decision process**:
1. Calculate suitability scores for all task types
2. Filter out tasks with scores below 0.1 (essentially unavailable)
3. Select the highest-scoring task
4. Choose modality based on dominant z(w) component
5. Generate human-readable reason
6. Package with alternatives (2nd, 3rd, 4th best options)

### `extractZVector(object, targetDomain?)`

**What it does**: Converts raw database fields into a normalized z(w) vector. Handles missing data by defaulting to 0.5 (neutral).

**Normalization**: All input metrics should already be 0-1 normalized. Domain relevance is extracted from a JSON distribution object if provided.

---

## Design Decisions & Rationale

### Why Six Dimensions?

The z(w) vector dimensions were chosen based on established vocabulary acquisition research:
- **Frequency**: High-frequency words need automaticity; low-frequency words need explicit teaching
- **Relational Density**: Words that collocate richly need contextual practice
- **Domain Relevance**: Technical terms need domain-specific contexts
- **Morphological**: Words with many forms (run, ran, running) need word-family practice
- **Phonological**: Words with difficult sounds need pronunciation focus
- **Pragmatic**: Register-sensitive words need appropriateness practice

### Why 0-1 Normalization?

Normalizing all dimensions to the same scale allows:
- Fair comparison across dimensions
- Simple weighted averaging in the affinity matrix
- Consistent interpretation (0.8 is "high" in any dimension)

### Why Default to 0.5?

When data is missing, 0.5 (neutral) is safer than 0 (absence) because:
- It does not artificially suppress any task type
- It allows the non-missing data to drive recommendations
- It avoids bias toward tasks that correlate with frequently-missing metrics

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for task-matching module
- **Why**: Part of shadow documentation initiative for all core algorithms
- **Impact**: Enables non-technical stakeholders to understand the personalization system

### [Date TBD] - Module Creation
- **What Changed**: Implemented z(w) vector task matching system
- **Why**: Enable personalized task selection based on word characteristics
- **Impact**: Core differentiator for LOGOS's adaptive learning approach

---

## References

- Nation, I.S.P. (2001). *Learning Vocabulary in Another Language*. Cambridge University Press.
- Laufer, B. & Nation, P. (2012). Vocabulary. In Gass & Mackey (Eds.), *The Routledge Handbook of Second Language Acquisition*.
- Schmitt, N. (2010). *Researching Vocabulary: A Vocabulary Research Manual*. Palgrave Macmillan.
