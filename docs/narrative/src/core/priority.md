# Priority Calculation Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/priority.ts`
> **Status**: Active

---

## Why This Exists

The Priority module answers the fundamental question of adaptive learning: **"What should the learner study next?"** Without principled prioritization, learners either waste time on material they already know or struggle with content far beyond their level. This module implements the FRE (Frequency, Relational density, contextual contribution) priority system, which balances what's most useful to learn (high frequency, high connectivity) against what's feasible to learn (accounting for difficulty, transfer from L1, and learner ability).

The core insight is that priority is a ratio: **Value / Cost**. High-value items that are easy to learn get scheduled first; low-value items that are hard can wait.

---

## Key Concepts

- **FRE Metrics**: Three dimensions of vocabulary value:
  - **F (Frequency)**: How often the word appears in target texts (coverage value)
  - **R (Relational Density)**: How connected the word is to other vocabulary (hub words)
  - **E (Contextual Contribution)**: How important the word is for understanding meaning

- **Cost Factors**: What makes learning harder or easier:
  - **Base Difficulty**: IRT-derived difficulty on logit scale
  - **Transfer Gain**: Benefit from L1-L2 similarity (cognates, shared structures)
  - **Exposure Need**: Gap between learner ability and item difficulty

- **Urgency**: Spaced repetition integration - items become urgent as they approach or pass their review date

- **Enhanced Priority**: Extended model incorporating:
  - Pragmatic complexity (register, politeness)
  - Morphological complexity (word forms, inflections)
  - Phonological difficulty (pronunciation challenges)
  - Domain relevance (medical English, business English)

---

## Design Decisions

### Priority = FRE / Cost

The formula `Priority = (w_F * F + w_R * R + w_E * E) / Cost` elegantly balances value against effort. High-frequency words with many connections that are relatively easy to learn (due to L1 transfer or matching the learner's level) rise to the top. This prevents the system from either drilling only easy words (low learning gain) or only hard words (frustration and inefficiency).

### Adaptive Weight Adjustment by Level

Beginners get `{f: 0.5, r: 0.25, e: 0.25}` - heavily weighted toward frequency because vocabulary coverage is the bottleneck. Advanced learners get `{f: 0.3, r: 0.3, e: 0.4}` - more weight on contextual nuance because they already have core vocabulary.

### Urgency Multiplication, Not Addition

Final score is `Priority * (1 + Urgency)` rather than `Priority + Urgency`. This ensures that a high-priority item that's overdue dominates, but a low-priority item that's slightly overdue doesn't jump ahead of high-priority new items. The multiplicative relationship preserves relative priorities while boosting overdue items.

### Domain Boost as Multiplier

When a user focuses on a domain (e.g., medical English), items with high domain relevance get up to 50% priority boost. This is a multiplier, not an override, so domain-relevant items still compete on merit rather than being arbitrarily promoted.

### Transfer Gain as Cost Reduction

L1-L2 transfer (cognates, similar grammar) reduces learning cost rather than increasing priority directly. This reflects the reality that similar items are *easier* to learn, not inherently more *valuable*. A Korean cognate with English might be easy to learn, but that doesn't make it more important than a high-frequency non-cognate.

---

## Integration Points

### Dependencies (What This Needs)

- **`./pragmatics`**: `calculatePragmaticDifficulty()`, `PragmaticProfile` - for pragmatic complexity scoring
- **`./transfer`**: `calculateTransferGain()`, `getTransferCoefficients()` - for L1-L2 transfer benefit calculation

### Dependents (What Needs This)

- **`src/main/services/state-priority.service.ts`**: Builds learning queues using `buildLearningQueue()` and `buildEnhancedLearningQueue()`
- **`src/main/services/session.service.ts`**: Uses `getSessionItems()` to construct practice sessions
- **`src/core/index.ts`**: Re-exports all priority functions for convenient importing

### Data Flow

```
User State (theta, weights, L1)
         |
         v
Language Objects (with FRE metrics, IRT difficulty)
         |
         +---> computeFRE() --> Weighted value score
         |
         +---> estimateCostFactors() --> Base difficulty, transfer, exposure need
         |          |
         |          +---> computeCost() --> Cost denominator
         |
         +---> computePriority() --> FRE / Cost
                   |
                   v
Mastery Map (next review dates, stages)
         |
         +---> computeUrgency() --> Overdue multiplier
         |
         +---> computeFinalScore() --> Priority * (1 + Urgency)
                   |
                   v
buildLearningQueue() --> Sorted QueueItem[] (highest first)
         |
         v
getSessionItems() --> Balanced session with due + new items
```

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `computeFRE(metrics, weights)` | Weighted sum of F, R, E values |
| `computeCost(factors)` | Base - Transfer + Exposure need |
| `computePriority(object, userState)` | Full priority calculation (FRE / Cost) |
| `computeUrgency(nextReview, now)` | Spaced repetition urgency (0 to 3) |
| `buildLearningQueue(objects, userState, masteryMap, now)` | Full queue sorted by final score |
| `getSessionItems(queue, size, newRatio)` | Balanced session extraction |
| `computeEnhancedPriority(object, userState, config)` | Full priority with pragmatics & complexity |

---

## Technical Concepts (Plain English)

### FRE (Frequency, Relational, contextual contribution)

**Technical**: A weighted linear combination of three normalized vocabulary metrics: corpus frequency, network centrality (via PMI-derived connections), and contextual importance (via TF-IDF or similar).

**Plain English**: FRE answers "How useful is this word?" Frequency tells us how often it appears (common words are more useful). Relational density tells us how connected it is (hub words unlock understanding of related words). Contextual contribution tells us how much meaning it carries (content words matter more than function words for comprehension).

### Transfer Gain

**Technical**: A coefficient derived from L1-L2 linguistic distance for specific features (phonological, morphological, lexical), representing the learning cost reduction from native language knowledge.

**Plain English**: If you speak Spanish and you're learning English, "hospital" is almost free to learn (it's nearly identical). If you speak Korean, it's much harder (no cognate). Transfer gain captures how much your native language helps with each specific item.

### Urgency

**Technical**: A time-based multiplier that increases as items approach or exceed their scheduled review date, following spaced repetition principles.

**Plain English**: Urgency is the "use it or lose it" factor. An item scheduled for review yesterday is urgent - if you don't practice it soon, you'll forget it and waste the previous learning. Items not yet due have zero urgency because there's no forgetting risk yet.

### Queue Building

**Technical**: An algorithm that sorts vocabulary items by final score (priority times urgency multiplier), then extracts a balanced session with a configurable ratio of due items to new items.

**Plain English**: The queue is your optimized study list. It puts the most valuable, most urgent items at the top. But it also balances review (don't forget what you learned) with new learning (keep making progress). A typical session might be 70% review, 30% new items.

---

## Usage Examples

### Basic Priority Calculation

```typescript
import { computePriority, DEFAULT_PRIORITY_WEIGHTS } from './priority';

const word = {
  id: 'medication-001',
  content: 'medication',
  type: 'lexical',
  frequency: 0.8,           // High frequency in medical corpus
  relationalDensity: 0.7,   // Strong collocations with many terms
  contextualContribution: 0.6, // Important for meaning
  irtDifficulty: 0.5,       // Moderate difficulty
};

const userState = {
  theta: 0.3,               // Slightly above average ability
  weights: DEFAULT_PRIORITY_WEIGHTS,
  l1Language: 'ko',         // Korean speaker
};

const priority = computePriority(word, userState);
// Returns ~2.1 (high priority - valuable and learnable)
```

### Building a Learning Queue

```typescript
import { buildLearningQueue, getSessionItems } from './priority';

const queue = buildLearningQueue(
  allVocabulary,
  userState,
  masteryMap,
  new Date()
);

// Get 20 items for a session (70% due, 30% new)
const sessionItems = getSessionItems(queue, 20, 0.3);
```

### Enhanced Priority with Pragmatics

```typescript
import { computeEnhancedPriority, DEFAULT_ENHANCED_CONFIG } from './priority';

const config = {
  ...DEFAULT_ENHANCED_CONFIG,
  focusDomain: 'medical',
  pragmaticPenalty: true,
};

const result = computeEnhancedPriority(extendedWord, userState, config);
// result.priority: final score
// result.breakdown: detailed cost breakdown
```

---

## Change History

### 2026-01-06 - Documentation Created

- **What Changed**: Created shadow documentation for priority.ts
- **Why**: Core algorithm requires narrative explanation for system understanding
- **Impact**: Enables developers and AI agents to understand prioritization logic

### Historical Implementation Notes

- FRE formula derived from vocabulary acquisition research
- Transfer coefficients use real L1-L2 distance data
- Urgency curve calibrated to match FSRS forgetting curves
- Enhanced priority added pragmatics integration after initial release

---

*This documentation mirrors: `src/core/priority.ts`*
