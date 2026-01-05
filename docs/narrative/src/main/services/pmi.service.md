# PMI Service (Pointwise Mutual Information)

> **Last Updated**: 2026-01-05
> **Code Location**: `src/main/services/pmi.service.ts`
> **Status**: Active

---

## Context & Purpose

This service exists to bridge the gap between raw statistical corpus analysis and practical language learning difficulty estimation. While the pure PMI calculator in `core/pmi.ts` handles the mathematics of word co-occurrence, the PMI Service wraps that functionality with goal-specific caching, database persistence, and integration with the LOGOS adaptive learning system.

**Business Need**: Language learners need content prioritized by difficulty. Some words are harder to learn because they appear in unpredictable contexts (low PMI), while others are easier because they consistently appear with familiar partners (high PMI). This service quantifies that difficulty and feeds it into the priority calculation system (FRE formula) so the learning queue presents items in optimal order.

**When Used**:
- When populating a new learning goal's corpus for the first time
- When calculating priority scores for language objects in the learning queue
- When the FRE (Frequency-Relational-contextual) priority formula needs the "R" (Relational Density) component
- When batch-updating IRT difficulty parameters after corpus changes
- When persisting collocation relationships to the database for fast lookup during learning sessions

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/main/db/prisma.ts`: `getPrisma()` - Provides database client for querying and updating language objects and collocations
- `src/core/pmi.ts`: `PMICalculator`, `pmiToDifficulty()`, `frequencyToDifficulty()`, `TaskType`, `PMIResult` - The pure mathematical engine for PMI computation; this service wraps it with caching and persistence

### Dependents (What Needs This)

- `src/main/services/state-priority.service.ts`: Uses `getRelationalDensity()` to compute the "R" component of the FRE priority formula
- `src/main/ipc/learning.ipc.ts`: May call `updateIRTDifficulties()` after corpus population to set initial difficulty parameters
- `src/main/services/task-generation.service.ts`: Uses collocation data to generate fluency tasks (high-PMI pairs) and versatility tasks (low-PMI pairs)
- `src/main/db/repositories/collocation.repository.ts`: Works alongside this service; the service writes collocations, the repository provides specialized query patterns

### Data Flow

```
Goal Corpus (Language Objects)
        |
        v
getCalculatorForGoal() -- builds token array from content
        |
        v
PMICalculator.indexCorpus() -- computes word frequencies + co-occurrences
        |
        v
Cache stores calculator (30 min TTL)
        |
        +---> getWordDifficulty() --> difficulty for single word
        |
        +---> getCollocations() --> top-K word pairs with PMI scores
        |
        +---> getRelationalDensity() --> hub score normalized 0-1
        |
        +---> updateIRTDifficulties() --> batch update to database
        |
        +---> storeCollocations() --> persist to Collocation table
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits in the **Application Services Layer** of LOGOS's three-tier architecture:

- **Layer 1**: Renderer (React UI) - displays learning tasks and priority queue
- **Layer 2**: This service (PMI Service) - computes linguistic difficulty metrics
- **Layer 3**: Database (Prisma/SQLite) - stores language objects and collocations

The PMI Service bridges the pure algorithmic layer (`core/pmi.ts`) with the persistence layer. It is responsible for:
1. **Caching**: Maintaining in-memory PMI calculators per goal to avoid recomputing corpus statistics
2. **Orchestration**: Coordinating between pure calculation and database updates
3. **Normalization**: Converting raw PMI values into IRT-compatible difficulty parameters

### Big Picture Impact

The PMI Service is a **critical dependency** for the adaptive difficulty system. It enables:

1. **Priority Calculation (FRE Formula)**: The relational density "R" component comes from `getRelationalDensity()`. Without this, priority scores would only consider frequency, missing the linguistic insight that well-connected words (appearing with predictable partners) are easier to learn.

2. **IRT Difficulty Estimation**: Initial IRT difficulty parameters (the "b" in Item Response Theory) are bootstrapped from PMI analysis via `updateIRTDifficulties()`. This cold-starts the adaptive system before real user responses are collected.

3. **Fluency vs. Versatility Task Selection**: High-PMI pairs become fluency tasks (practicing common collocations like "take medication"), while low-PMI pairs become versatility tasks (practicing unusual combinations to build flexibility).

4. **Collocation Network Visualization**: Stored collocations power the relationship graph that shows learners how words connect to each other.

### Critical Path Analysis

**Importance Level**: High

- **If this service fails**: Priority calculations fall back to frequency-only, losing the relational density component. IRT difficulties remain at default (0), making the adaptive algorithm less accurate until real responses calibrate it.
- **Failure mode**: Graceful degradation - functions return sensible defaults (empty collocations, frequency-based difficulty) rather than throwing errors.
- **Performance concern**: Calculator construction can be slow for large corpora. The 30-minute cache mitigates this, but `clearCalculatorCache()` should be called after corpus updates to ensure fresh data.

---

## Technical Concepts (Plain English)

### Pointwise Mutual Information (PMI)

**Technical**: PMI measures the association strength between two words by comparing their observed co-occurrence probability to what we would expect if they were independent: `PMI(w1, w2) = log2[P(w1,w2) / (P(w1) * P(w2))]`. Positive values indicate words appear together more than chance; negative values indicate they avoid each other.

**Plain English**: Imagine you hear the word "take" - how surprised would you be if the next word is "medication" versus "elephant"? PMI quantifies that surprise. High PMI means the pair is predictable (low surprise), low PMI means it is unexpected (high surprise). In language learning, predictable pairs are easier to remember because they reinforce each other.

**Why We Use It**: PMI gives us a principled way to estimate difficulty before a learner even attempts an item. Words that appear in predictable contexts have "training wheels" - the context helps recall. Words that appear in unpredictable contexts require more cognitive effort.

### Normalized PMI (NPMI)

**Technical**: NPMI scales PMI to the range [-1, +1] by dividing by the negative log of the joint probability: `NPMI = PMI / -log2(P(w1,w2))`. This makes scores comparable across corpora of different sizes.

**Plain English**: Raw PMI values depend on corpus size - a huge corpus might have PMI values from -5 to +15, while a small corpus might only span -2 to +5. NPMI acts like converting temperatures to Celsius: it puts everything on the same scale so we can compare apples to apples.

**Why We Use It**: When combining PMI data with other metrics (frequency, IRT difficulty), normalized values prevent corpus size from skewing results.

### Hub Score (Relational Density)

**Technical**: The hub score sums the positive PMI values for all significant collocates of a word, then normalizes to [0, 1] by dividing by an empirically chosen maximum (50).

**Plain English**: Some words are "social butterflies" - they have many strong connections to other words ("take" connects strongly to "medication," "break," "time," "care"). Other words are "loners" with few connections. The hub score measures how connected a word is in the vocabulary network. Highly connected words tend to be easier to learn because they are reinforced from many directions.

**Why We Use It**: The FRE priority formula uses relational density as the "R" component. Words with high hub scores get priority because learning them unlocks understanding of many related phrases.

### Log-Likelihood Ratio (Significance)

**Technical**: Dunning's G-test (log-likelihood ratio) tests whether the observed co-occurrence frequency differs significantly from the expected frequency under independence. Values above 3.84 indicate p < 0.05 significance.

**Plain English**: Just because two words appear together once in a corpus does not mean they are truly associated - it could be coincidence. The significance test asks: "If these words had nothing to do with each other, how likely is it we would see them together this often?" High significance means the relationship is real, not noise.

**Why We Use It**: The service filters collocations by significance (default threshold: 3.84) to avoid storing spurious pairs. This keeps the collocation database clean and ensures fluency tasks use genuinely common phrases.

### IRT Difficulty Parameter (b)

**Technical**: In Item Response Theory, the difficulty parameter "b" represents the ability level at which a learner has a 50% chance of answering correctly. On a logit scale, typical values range from -3 (very easy) to +3 (very hard).

**Plain English**: If you are learning Japanese and the word "sushi" has difficulty -2, that means even a beginner (low ability) can probably get it right. But "tsundoku" (buying books and not reading them) might have difficulty +2, requiring advanced ability to reliably recall.

**Why We Use It**: The PMI-to-difficulty conversion (`pmiToDifficulty()`) bootstraps IRT parameters for new items before real responses calibrate them. High PMI (predictable context) maps to lower difficulty; low PMI (unpredictable context) maps to higher difficulty.

### Calculator Cache

**Technical**: An in-memory `Map<string, { calculator: PMICalculator, lastUpdated: Date }>` stores one PMI calculator per goal, evicted after 30 minutes (CACHE_TTL_MS).

**Plain English**: Building a PMI calculator requires scanning every word in a goal's corpus and counting all pairs - expensive for large vocabularies. The cache is like keeping your tools on the workbench instead of walking to the shed every time. After 30 minutes, we assume the corpus might have changed, so we rebuild fresh.

**Why We Use It**: Without caching, every call to `getWordDifficulty()` or `getCollocations()` would re-scan the entire corpus. The cache makes repeated lookups instant.

---

## Key Functions Reference

### getWordDifficulty(goalId, word, taskType)

Returns a `WordDifficultyResult` containing:
- `difficulty`: IRT difficulty on logit scale (-3 to +3)
- `frequency`: Normalized frequency from the language object (0-1)
- `hasCollocations`: Whether PMI data was available for this word
- `pmiBasedDifficulty`: The PMI-derived difficulty, or null if falling back to frequency

Uses PMI-based difficulty when collocations exist; falls back to frequency-based difficulty otherwise. Task type modifiers adjust the result (recognition is easier, production is harder).

### getCollocations(goalId, word, topK)

Returns a `CollocationResult` containing:
- `collocations`: Array of PMI results (word pairs, scores, significance)
- `hubScore`: Sum of positive PMI values (raw, not normalized)

Used by task generation to find fluency practice pairs.

### getRelationalDensity(goalId, word)

Returns normalized hub score (0-1) for use in the FRE priority formula. Fetches top 20 collocations internally and normalizes the sum.

### updateIRTDifficulties(goalId)

Batch operation that updates the `irtDifficulty` field on all language objects in a goal. Called after corpus population to bootstrap the adaptive system. Returns count of updated objects.

### updateRelationalDensities(goalId)

Batch operation that updates the `relationalDensity` field on all language objects. Called after corpus changes to refresh the "R" component of priority scores. Returns count of updated objects.

### storeCollocations(goalId, minSignificance)

Persists significant collocations to the `Collocation` table for fast database lookup. Uses upsert to update existing pairs. Default significance threshold is 3.84 (p < 0.05). Returns count of stored collocations.

### clearCalculatorCache(goalId) / clearAllCalculatorCaches()

Invalidates cached calculators. Call after corpus changes (adding/removing language objects) to ensure fresh PMI computation on next request.

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for PMI service
- **Why**: Support Shadow Map documentation methodology for codebase understanding
- **Impact**: Developers can understand the service's role without reading implementation details

### Initial Implementation
- **What Changed**: Created PMI service wrapping core PMI calculator with goal-specific caching
- **Why**: The learning system needs difficulty estimation before user responses are collected; PMI provides a principled way to estimate difficulty from corpus statistics
- **Impact**: Enables the FRE priority formula to include relational density, improves cold-start IRT accuracy, powers fluency/versatility task selection
