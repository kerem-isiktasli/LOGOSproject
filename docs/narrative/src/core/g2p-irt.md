# G2P-IRT Integration Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/g2p-irt.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to solve a critical measurement problem in language learning: **how do you accurately assess pronunciation ability when the same word can be easy or hard depending on context?**

Consider the word "psychology." Its difficulty changes dramatically based on:
- **Modality**: Reading it silently (easy) vs. pronouncing it aloud (harder)
- **Task type**: Recognizing correct pronunciation (easier) vs. producing it (harder)
- **Time pressure**: Untimed accuracy (easier) vs. rapid fluency (harder)
- **Learner's native language**: Korean speakers struggle more with the initial "ps-" cluster than Spanish speakers
- **Phonological layer**: Letter-level decoding vs. syllable patterns vs. whole-word recognition

Standard Item Response Theory (IRT) treats difficulty as a fixed parameter. But pronunciation difficulty is **context-dependent**. A learner might have strong alphabetic decoding skills but weak syllable pattern recognition. Traditional IRT would give them one ability score that masks this nuance.

The G2P-IRT Integration module bridges **linguistic analysis** (G2P) with **psychometric measurement** (IRT) by implementing:

1. **Context-dependent difficulty parameters** - The same word has different IRT difficulty based on task context
2. **Multidimensional ability tracking** - Separate theta estimates for different skills (reading vs. speaking, alphabetic vs. word-level)
3. **L1-specific adjustments** - Native language transfer effects modify difficulty parameters
4. **Fisher Information-based selection** - Optimal item selection for efficient ability estimation

**Academic Foundations**:
- **Format-aware IRT (EDM 2022)**: Research showing task format affects item difficulty parameters, not just overall test design
- **Multidimensional IRT (MIRT)**: Psychometric models allowing multiple ability dimensions instead of a single theta
- **Ma, B. et al. (2025)**: Personalized Language Learning Using Spaced Repetition - connecting pronunciation learning with adaptive algorithms

**Business Need**: Without context-aware difficulty, LOGOS would present words that are too easy or too hard for specific modalities. A learner might excel at reading but struggle with speaking, yet receive the same word difficulty in both. This wastes practice time and frustrates learners.

**When Used**:
- During adaptive task selection to find optimal items for a learner's current ability
- When updating ability estimates after pronunciation practice
- When determining which phonological layer (alphabetic, syllable, word) to target instruction
- When calculating expected learning gains from potential practice items

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**From `src/core/irt.ts`:**
- `probability2PL()` - Calculates response probability using 2-Parameter Logistic model
- `estimateThetaEAP()` - Expected A Posteriori ability estimation (Bayesian approach)
- `fisherInformation()` - Quantifies how much information an item provides about ability

**From `src/core/g2p.ts`:**
- `G2PDifficulty` type - Contains pronunciation analysis (irregular patterns, syllable count, mispronunciation predictions)

**From `src/core/types.ts`:**
- `TaskType` - Types of learning tasks (recognition, production, timed)
- `TaskModality` - Input/output channels (visual, auditory, mixed)
- `ThetaEstimate` - Ability estimate with standard error
- `ItemParameter` - IRT parameters (discrimination, difficulty)

### Dependents (What Needs This)

- `src/main/services/task-generation.service.ts`: Uses `selectOptimalG2PItem()` to choose pronunciation tasks that maximize learning efficiency
- `src/main/services/scoring-update.service.ts`: Uses `updateG2PThetaProfile()` to adjust ability estimates after responses
- `src/scheduling/pronunciationScheduler.ts`: Uses `recommendG2PLayer()` to determine instruction level
- `src/analytics/phonologicalProgress.ts`: Uses `assessG2PReadiness()` to track learner progress across layers

### Data Flow

```
G2P Analysis (from g2p.ts)
    |
    v
g2pToIRTParameters() --> converts difficulty score to logit scale
    |                           |
    |                           v
    |                   sets layer thresholds
    |                   builds L1 adjustments from mispronunciation predictions
    |
    v
G2PIRTParameters (base difficulty + context adjustments)
    |
    +------------+------------+
    |            |            |
    v            v            v
Task Context   User Profile  Item Pool
(modality,     (theta per    (candidate
 task type,    dimension)    items)
 timing, L1)
    |            |            |
    v            v            v
getContextualDifficulty() --> effective b parameter
    |
    v
selectOptimalG2PItem() --> Fisher Information maximization
    |
    v
Optimal item selected for learner
    |
    v
User responds --> updateG2PThetaProfile()
    |
    v
Updated theta estimates per dimension
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at the **intersection of three systems** in LOGOS architecture:

```
Layer 1: User Interface (pronunciation exercises)
    |
Layer 2: Learning Engine (task selection, feedback)
    |
Layer 3: Adaptive Algorithms <-- G2P-IRT INTEGRATION LIVES HERE
    |       - Converts linguistic difficulty to psychometric parameters
    |       - Tracks multiple ability dimensions
    |       - Optimizes item selection
    |
    +-------+-------+
    |               |
    v               v
Layer 4a: G2P      Layer 4b: IRT
(Linguistic        (Psychometric
 Analysis)         Measurement)
    |               |
    v               v
Layer 5: Core Data (vocabulary, learner profiles)
```

The G2P-IRT module is a **bridge module** that translates between linguistic and psychometric domains. G2P analysis tells us "this word has irregular patterns and silent letters." IRT tells us "this learner has ability theta = 0.5." The G2P-IRT module answers: "Given this learner's abilities and this word's patterns, what's the probability of correct pronunciation in a speaking task?"

### Big Picture Impact

**1. Personalized Difficulty Calibration**

Without this module, LOGOS would use static difficulty values. With it, the same word can have dramatically different effective difficulties:

| Word | Reading Task | Speaking Task | Speaking (Timed) | Korean L1 Speaker |
|------|--------------|---------------|------------------|-------------------|
| "psychology" | b = 0.2 | b = 0.8 | b = 1.1 | b = 1.3 |

This enables precise matching of task difficulty to learner ability across all contexts.

**2. Hierarchical Skill Diagnosis**

The three-layer model (alphabetic, syllable, word) reveals where a learner is struggling:

- **Alphabetic issues**: Learner hasn't mastered basic grapheme-phoneme correspondences
- **Syllable issues**: Learner can decode letters but struggles with syllable patterns
- **Word issues**: Learner knows patterns but can't recognize whole words fluently

This diagnosis drives instruction to the appropriate level rather than presenting advanced words to learners who need basic decoding practice.

**3. Efficient Ability Estimation**

Fisher Information-based item selection means fewer practice items are needed to accurately estimate ability. Instead of random practice, each item is chosen to maximize information gain, reducing wasted time on items that are too easy or too hard.

**4. L1-Aware Adaptation**

Transfer issues from a learner's native language are built into the difficulty model. A Korean speaker practicing English will automatically receive easier items involving sounds that exist in Korean, and appropriately challenging items for sounds that don't (like /f/, /v/, /th/).

### Critical Path Analysis

**Importance Level**: High (Adaptive Pronunciation System)

- **If this fails**: Pronunciation tasks fall back to static difficulty values. Multidimensional ability tracking is lost - learners get one combined theta instead of separate reading/speaking/layer estimates. Item selection becomes random instead of optimized.

- **Graceful degradation**: All functions return sensible defaults when profiles or parameters are missing. A new user gets a zero-initialized profile that updates with responses. Missing L1 adjustments default to zero (no adjustment).

- **Performance consideration**: Fisher Information calculation requires iterating through candidate items. For large item pools (1000+ items), consider pre-filtering candidates by approximate difficulty range before optimization.

---

## Technical Concepts (Plain English)

### Context-Dependent Difficulty Parameters

**Technical**: Item difficulty parameters in IRT that vary as a function of task format, modality, timing constraints, and learner characteristics, implemented as additive adjustments to a base difficulty value on the logit scale.

**Plain English**: Imagine a word is like a mountain. Its "height" (difficulty) isn't fixed - it depends on how you're climbing. Walking up a trail (reading) is easier than rock climbing (speaking). Adding a time limit makes it even harder. And if you're carrying equipment you're not used to (unfamiliar L1 sounds), it's harder still. This module calculates the "effective height" by adding up all these factors.

**Why We Use It**: One difficulty number per word isn't enough. "Psychology" is trivially easy to read silently but challenging to pronounce correctly under time pressure. Without context adjustments, we'd either bore learners with easy tasks or frustrate them with impossible ones.

### Multidimensional IRT (MIRT)

**Technical**: Extension of unidimensional Item Response Theory that estimates separate ability parameters (thetas) for different skill dimensions, allowing items to load differently on each dimension.

**Plain English**: Instead of saying "your pronunciation ability is 7 out of 10," we say "your reading-pronunciation is 8, your speaking-pronunciation is 5, your alphabetic decoding is 9, your syllable recognition is 6, and your whole-word fluency is 4." This detailed profile shows where you're strong and where you need practice.

**Why We Use It**: Pronunciation isn't one skill - it's many related skills. Someone might excel at decoding individual letters but struggle with syllable stress patterns. A single theta would hide this distinction.

### G2P Layer Hierarchy (Alphabetic, Syllable, Word)

**Technical**: A developmental model of reading acquisition where learners progress through stages of grapheme-phoneme mapping precision, from individual letter decoding (alphabetic) to syllable pattern recognition to whole-word orthographic representations.

**Plain English**: Learning to pronounce words is like learning to read music:
- **Alphabetic stage**: You can identify individual notes (letters = sounds)
- **Syllable stage**: You recognize common note patterns and chords (letter combinations = sound patterns)
- **Word stage**: You sight-read entire phrases without thinking about individual notes (whole words = automatic pronunciation)

Most adult language learners need work at the syllable and word levels, but some benefit from alphabetic review.

**Why We Use It**: Teaching word-level fluency to someone who hasn't mastered syllable patterns is like teaching guitar chords to someone who can't tune the instrument. The layer hierarchy ensures instruction matches the learner's current level.

### Fisher Information-Based Item Selection

**Technical**: An adaptive testing strategy that selects the next item to maximize the Fisher Information function evaluated at the current ability estimate, thereby minimizing the standard error of the theta estimate with the fewest possible items.

**Plain English**: Imagine you're trying to figure out how tall someone is without a tape measure. You could ask "Are you taller than 5 feet?" If yes, "Taller than 6 feet?" If no, "Taller than 5'6"?" Each question cuts the uncertainty in half. Fisher Information tells us which question (which practice item) will cut the uncertainty the most based on what we already know about the person.

**Why We Use It**: Efficient assessment means faster learning. If we already know a learner is intermediate level, showing them beginner words teaches us nothing about their ability. Fisher Information maximization ensures every practice item provides maximum diagnostic value.

### L1-Specific Difficulty Adjustments

**Technical**: Additive modifications to item difficulty parameters based on contrastive phonological analysis between the learner's native language (L1) and target language (L2), reflecting predicted transfer interference.

**Plain English**: Your first language creates "pronunciation habits" that help or hurt with new sounds. Japanese speakers naturally struggle with "r" vs "l" because Japanese has neither - they have a sound in between. Korean speakers struggle with "f" sounds because Korean doesn't have them. We predict these struggles and adjust word difficulty accordingly - words with "f" are harder for Korean speakers than for Spanish speakers.

**Why We Use It**: Treating all learners the same ignores a major factor in pronunciation difficulty. L1 adjustments let LOGOS provide equally appropriate challenge regardless of linguistic background.

### Theta Estimation via EAP-like Updates

**Technical**: Incremental ability estimation using weighted prediction error updates that approximate Expected A Posteriori estimation, allowing online learning without full posterior computation after each response.

**Plain English**: After you try to pronounce a word, we update our estimate of your ability. If you got it right and it was hard, your score goes up a lot. If you got it wrong and it was easy, your score goes down. This is like how a coach updates their assessment of an athlete - one missed easy shot is concerning, one missed hard shot is expected.

**Why We Use It**: Full Bayesian estimation after every response is computationally expensive. These lightweight updates provide good approximations while keeping the system responsive.

---

## Key Data Structures

### G2PIRTParameters

The core structure combining G2P linguistic analysis with IRT psychometric parameters:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique item identifier |
| `content` | string | The word or pattern |
| `baseDifficulty` | number | IRT b parameter on logit scale |
| `discrimination` | number | IRT a parameter (how well item differentiates abilities) |
| `guessing` | number | IRT c parameter (for MCQ tasks) |
| `contextAdjustments` | object | Modifiers by modality, task type, timing, layer |
| `layerThresholds` | object | Minimum theta required at each G2P layer |
| `l1Adjustments` | Record | Language-specific difficulty modifiers |
| `g2pAnalysis` | G2PDifficulty | Original linguistic analysis |

### G2PThetaProfile

Multidimensional ability profile tracking separate thetas:

**Overall:**
- `thetaPhonological` - Global phonological ability

**By Layer:**
- `thetaAlphabetic` - Letter-sound correspondence
- `thetaSyllable` - Syllable pattern recognition
- `thetaWord` - Whole-word recognition

**By Modality:**
- `thetaReading` - Visual/silent pronunciation
- `thetaListening` - Auditory comprehension
- `thetaSpeaking` - Oral production
- `thetaWriting` - Spelling production

Each theta has an associated standard error that decreases with more responses.

### DEFAULT_CONTEXT_ADJUSTMENTS

Empirically-derived difficulty modifiers:

| Context | Adjustment | Rationale |
|---------|------------|-----------|
| **Modality** | | |
| Reading | +0.0 | Baseline |
| Listening | +0.3 | Auditory processing adds load |
| Speaking | +0.6 | Production is harder than reception |
| Writing | +0.4 | Spelling production moderately harder |
| **Task Type** | | |
| Recognition | +0.0 | Baseline |
| Production | +0.5 | Generating is harder than selecting |
| **Timing** | | |
| Untimed | +0.0 | Baseline |
| Timed | +0.3 | Time pressure adds difficulty |
| **Layer** | | |
| Alphabetic | +0.0 | Baseline (simplest level) |
| Syllable | +0.2 | Pattern complexity |
| Word | +0.4 | Full integration required |

### L1_DIFFICULTY_ADJUSTMENTS

Language-specific transfer difficulties:

| L1 | Pattern | Adjustment | Reason |
|----|---------|------------|--------|
| Korean | th_sound | +0.5 | /th/ not in Korean inventory |
| Korean | r_l_distinction | +0.4 | Allophonic, not phonemic |
| Korean | final_consonant_clusters | +0.3 | Korean syllables end simply |
| Japanese | r_l_distinction | +0.5 | Merged in Japanese |
| Japanese | v_b_distinction | +0.3 | /v/ not in Japanese |
| Chinese | final_consonants | +0.4 | Mandarin allows few final C |
| Chinese | consonant_clusters | +0.4 | Clusters rare in Mandarin |
| Spanish | short_long_vowels | +0.3 | Spanish lacks length contrast |
| Spanish | initial_s_clusters | +0.3 | Spanish requires epenthetic vowel |

---

## Algorithm Details

### Difficulty Conversion (G2P to IRT)

The `g2pToIRTParameters()` function transforms G2P difficulty (0-1 scale) to IRT logit scale:

1. **Clamp** difficulty to [0.01, 0.99] to avoid infinity
2. **Logit transform**: `b = ln(difficulty / (1 - difficulty))`
3. **Set layer thresholds**:
   - Alphabetic: `baseDifficulty - 1.0`
   - Syllable: `baseDifficulty - 0.5` (+ adjustment for syllable count)
   - Word: `baseDifficulty` (+ adjustment for irregular patterns)
4. **Build L1 adjustments** from mispronunciation predictions

### Contextual Difficulty Calculation

The `getContextualDifficulty()` function computes effective difficulty:

```
effective_b = base_b
            + modality_adjustment
            + task_type_adjustment
            + timing_adjustment
            + layer_adjustment (if specified)
            + l1_adjustment (if applicable)
```

All adjustments are additive on the logit scale. A +0.5 adjustment roughly doubles the odds of failure.

### Theta Selection for Context

The `selectThetaForContext()` function combines multiple theta estimates:

1. Start with overall phonological theta (100%)
2. Weight toward modality-specific theta (40%)
3. Weight toward layer-specific theta (30%, if layer specified)

This produces a blended estimate appropriate for the specific task context.

### Profile Update Algorithm

The `updateG2PThetaProfile()` function uses error-driven learning:

1. Compute expected probability of correct response
2. Calculate prediction error: `error = actual - expected`
3. Update relevant thetas: `theta_new = theta_old + learning_rate * error * discrimination`
4. Update overall phonological theta as weighted average
5. Reduce standard errors based on response count

The learning rate (0.1) balances responsiveness with stability.

### Optimal Item Selection

The `selectOptimalG2PItem()` function maximizes Fisher Information:

1. Compute context-appropriate theta for the learner
2. For each candidate item:
   - Calculate context-adjusted difficulty
   - Compute Fisher Information: `I = a^2 * P * (1-P)`
3. Select item with maximum information

Information is maximized when item difficulty matches learner ability (P = 0.5).

---

## Usage Patterns

### Initializing a New User

```typescript
const profile = createInitialG2PThetaProfile(userId);
// All thetas start at 0, all SEs start at 1.5 (high uncertainty)
```

### Converting G2P Analysis to IRT Parameters

```typescript
const g2pAnalysis = analyzeG2PDifficulty('psychology', 'medical');
const irtParams = g2pToIRTParameters(g2pAnalysis, 1.2); // discrimination = 1.2
```

### Selecting Optimal Practice Item

```typescript
const context: G2PTaskContext = {
  modality: 'speaking',
  taskType: 'production',
  isTimed: true,
  targetLayer: 'word',
  userL1: 'korean'
};

const result = selectOptimalG2PItem(candidateItems, userProfile, context);
// result.item = best item for this learner in this context
// result.information = expected information gain
```

### Updating Profile After Response

```typescript
const response: G2PResponse = {
  itemId: 'word_123',
  correct: true,
  responseTimeMs: 2500,
  context: taskContext,
  itemParams: itemIRTParams
};

const updatedProfile = updateG2PThetaProfile(userProfile, response);
```

### Assessing Readiness for a Word

```typescript
const readiness = assessG2PReadiness(userProfile, wordParams);
// readiness.ready: boolean - can attempt word level?
// readiness.recommendedLayer: 'alphabetic' | 'syllable' | 'word'
// readiness.confidenceLevel: 'low' | 'medium' | 'high'
```

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Created comprehensive narrative documentation for G2P-IRT integration module
- **Why**: Enable team understanding of context-aware pronunciation difficulty measurement
- **Impact**: Improves maintainability and supports onboarding for adaptive pronunciation features

### Module Creation - Initial Implementation
- **What Changed**: Implemented complete G2P-IRT integration with context-dependent difficulty, multidimensional theta tracking, L1 adjustments, and Fisher Information-based item selection
- **Why**: Standard IRT couldn't capture the context-dependent nature of pronunciation difficulty; needed to bridge linguistic analysis with psychometric measurement
- **Impact**: Enables truly adaptive pronunciation practice that adjusts to task type, modality, timing, learner background, and phonological development level
