# Item Response Theory (IRT) Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/irt.ts`
> **Status**: Active

---

## Context & Purpose

This module implements **Item Response Theory** - the psychometric backbone of LOGOS's adaptive learning system. IRT allows LOGOS to estimate how skilled a learner is based on their response patterns, and to select items that will provide the most information about that skill level.

**Business Need**: Language learning platforms need to adapt to individual learners. Without IRT, a system either gives everyone the same items (ignoring skill differences) or relies on crude metrics like "percent correct" (which doesn't account for item difficulty). IRT solves this by placing both learner ability and item difficulty on the same scale, enabling precise matching of challenge level to current skill.

**When Used**:
- After every learner response: Theta (ability) is re-estimated
- When selecting the next item: Information maximization guides item choice
- During initial calibration: When establishing difficulty parameters for new vocabulary
- In analytics: To show learners their ability trajectory over time

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`src/core/types.ts`**:
  - `ItemParameter` - Properties of items (a, b, c parameters)
  - `ThetaEstimate` - Ability estimate with standard error
  - `ItemCalibrationResult` - Output of item calibration

### Dependents (What Needs This)

**Core Modules:**
- `src/core/g2p-irt.ts`: Applies IRT to grapheme-to-phoneme rules
- `src/core/priority.ts`: Uses theta estimates in priority calculations
- `src/core/task-matching.ts`: Uses theta for task suitability assessment
- `src/core/quadrature.ts`: Provides alternative EAP estimation method

**Service Layer:**
- `src/main/services/task-generation.service.ts`: Uses `selectNextItem()` for adaptive item selection
- `src/main/services/scoring-update.service.ts`: Uses `estimateThetaEAP()` after responses
- `src/main/services/state-priority.service.ts`: Uses theta in queue building

**Index Re-exports:**
- `src/core/index.ts`: Exports all IRT functions for easy importing

### Data Flow

```
Response recorded
       |
       v
[scoring-update.service.ts]
       |
       | responses[], items[]
       v
estimateThetaEAP() -----> New theta estimate
       |
       v
[selectNextItem()] -----> Next item to present
       |                         |
       v                         v
Update user theta       Display task to learner
in database
```

---

## Macroscale: System Integration

### Architectural Layer

This module is **pure algorithm code** at the core layer:

```
+-----------------------------------------------+
| Renderer: SessionView, QuestionCard           |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| IPC: session.ipc.ts, learning.ipc.ts          |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Services: scoring-update, task-generation     |
|           (orchestrates IRT usage)            |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Core: IRT MODULE (THIS FILE)                  |  <-- You are here
| Pure functions, no I/O, no side effects       |
+-----------------------------------------------+
```

### Big Picture Impact

IRT is the **personalization engine** of LOGOS. It enables:

| Feature | How IRT Enables It |
|---------|-------------------|
| Adaptive difficulty | Items selected at learner's ability level |
| Ability tracking | Theta estimates show progress over time |
| Efficient learning | Maximum information items minimize wasted practice |
| Fair assessment | Scores account for item difficulty |
| Calibration | New items get calibrated from learner responses |

**Without IRT:**
- All learners would get the same items regardless of skill
- Progress would be measured in raw accuracy (misleading)
- Difficult items would seem "bad" even when appropriate
- Easy items would inflate confidence artificially
- No principled way to select what to practice next

### Critical Path Analysis

**Importance Level**: Critical (Core Algorithm)

- **If probability functions have bugs**: All ability estimates become wrong
- **If estimation diverges**: Theta becomes infinite or NaN
- **If item selection is suboptimal**: Learning efficiency drops significantly

**Edge Cases Handled:**
- All-correct response patterns (would make MLE diverge to +infinity)
- All-incorrect response patterns (would make MLE diverge to -infinity)
- Zero Fisher Information (would cause division by zero)
- Empty response arrays (returns prior mean)

---

## Algorithm Explanations

### The Three IRT Models

LOGOS implements three IRT models of increasing complexity:

#### 1PL (Rasch Model)

```
P(correct) = 1 / (1 + e^(-(theta - b)))
```

**Plain English**: The probability of getting an item right depends only on how much harder (b) it is than your skill (theta). All items are assumed equally "sensitive" to skill differences.

**Used For**: Phonological items where discrimination is relatively uniform.

**Example**: If your theta is 0 (average) and item difficulty b is 0 (average), P = 0.5 (50% chance).

#### 2PL Model

```
P(correct) = 1 / (1 + e^(-a(theta - b)))
```

**Plain English**: Like 1PL, but items can have different "sharpness" (a). High-a items sharply distinguish skilled from unskilled learners; low-a items give similar results regardless of skill.

**Used For**: Lexical and syntactic items where discrimination varies.

**Why a Matters**:
- a = 2.0: Steep curve - small skill differences cause big probability changes
- a = 0.5: Gentle curve - even large skill differences show small probability changes

#### 3PL Model

```
P(correct) = c + (1-c) / (1 + e^(-a(theta - b)))
```

**Plain English**: Like 2PL, but accounts for guessing. Even someone with very low skill can sometimes guess correctly. The parameter c is the guessing floor.

**Used For**: Pragmatic items and multiple-choice questions where guessing is possible.

**Why c Matters**: On a 4-option MCQ, even random guessing gives 25% correct. The 3PL model doesn't penalize low-ability learners for lucky guesses.

### Theta Estimation Methods

#### Maximum Likelihood Estimation (MLE)

**What It Does**: Finds the theta value that makes the observed response pattern most probable.

**How It Works**:
1. Start with theta = 0
2. Compute the slope (gradient) of the likelihood function
3. Take a Newton-Raphson step in the direction of steeper likelihood
4. Repeat until convergence

**Strengths**:
- Unbiased estimate (on average, correct)
- Efficient (minimum variance among unbiased estimators)

**Weaknesses**:
- Diverges with extreme patterns (all correct or all incorrect)
- Requires multiple responses to be stable

**When to Use**: When you have 5+ responses with mixed outcomes.

#### Expected A Posteriori (EAP)

**What It Does**: Computes the mean of the posterior distribution of theta, given responses and a prior belief.

**How It Works**:
1. Define a prior distribution (typically normal, mean=0, SD=1)
2. Multiply prior by likelihood at many theta values (quadrature)
3. Normalize to get posterior distribution
4. Return the mean of the posterior

**Strengths**:
- Always finite (never diverges)
- Incorporates prior knowledge
- Stable with few responses

**Weaknesses**:
- Biased toward prior (shrinkage)
- More computationally intensive

**When to Use**: Always, especially early in learning or with extreme patterns. LOGOS uses EAP as the default.

### Item Selection Strategies

#### Fisher Information Maximization

**What It Does**: Selects the item that will reduce uncertainty about theta the most.

**How It Works**:
1. For each candidate item, compute Fisher Information at current theta
2. Fisher Info = a^2 * P * (1-P)
3. Select item with maximum information

**Plain English**: Pick the item where success is most uncertain (P near 0.5). That's where we learn the most about the learner's true ability.

**Information Maximization Curve**:
```
Information
     |
     |        *****
     |      **     **
     |    **         **
     |  **             **
     | *                 *
     |*                   *
     +-------------------------> Theta
        (at theta = b)
```

Maximum information occurs when theta = difficulty (b).

#### Kullback-Leibler Divergence Selection

**What It Does**: Like Fisher Information, but accounts for uncertainty in the current theta estimate.

**How It Works**:
1. Integrates KL divergence over the posterior distribution of theta
2. Accounts for the full uncertainty, not just point estimate
3. More robust when theta estimate has high standard error

**When to Use**: When SE of theta is high (early in learning, few responses).

### Item Calibration (EM Algorithm)

**What It Does**: Estimates item parameters (a, b) from a matrix of responses.

**How It Works**:
1. **E-step**: Estimate theta for each person given current item parameters
2. **M-step**: Update item parameters given theta estimates
3. Repeat until convergence

**Plain English**: We don't know people's abilities or items' difficulties. But if we knew abilities, we could estimate difficulties. And if we knew difficulties, we could estimate abilities. The EM algorithm bounces back and forth until both stabilize.

**Used For**: Calibrating new vocabulary items from pilot testing data.

---

## Technical Concepts (Plain English)

### Logit Scale

**Technical**: A logarithmic odds transformation where logit(p) = ln(p/(1-p)), mapping probabilities (0,1) to (-inf, +inf).

**Plain English**: Instead of saying "75% chance," we say logit = 1.1. Instead of "50%," we say logit = 0. The logit scale makes the math work nicely and gives us a natural way to compare abilities and difficulties.

**Why We Use It**: On the logit scale, differences are meaningful. Theta 1.0 vs 2.0 means the same skill gap as 2.0 vs 3.0. This wouldn't be true with raw probabilities (75% vs 88% is not the same gap as 88% vs 97%).

### Standard Error (SE)

**Technical**: The estimated standard deviation of the sampling distribution of the theta estimate.

**Plain English**: How confident we are in our estimate. SE = 0.3 means we're pretty sure (theta +/- 0.6 covers 95%). SE = 1.5 means we're very uncertain.

**Why We Use It**: SE tells us when to trust the estimate. Early in learning, SE is high - we need more data. After many responses, SE shrinks - we know the learner well.

### Discrimination (a Parameter)

**Technical**: The slope of the Item Characteristic Curve (ICC) at the inflection point, determining the relationship between ability and success probability.

**Plain English**: How "diagnostic" an item is. High-a items are like sharp diagnostic tests - they clearly separate skilled from unskilled. Low-a items are like noisy measurements - skill level barely affects the outcome.

**Why We Use It**: Some vocabulary words are very diagnostic of overall ability. Others are idiosyncratic (some advanced learners don't know them, some beginners do). The a parameter captures this.

### Guessing Parameter (c)

**Technical**: The lower asymptote of the ICC, representing the probability of correct response from an examinee with infinitely low ability.

**Plain English**: The floor for guessing. On a 4-option MCQ, even a complete beginner guesses correctly 25% of the time. The c parameter prevents the model from being fooled by lucky guesses.

**Why We Use It**: Without c, a lucky guess by a low-ability learner would artificially inflate their theta estimate.

---

## Implementation Notes

### Numerical Stability

The module includes several safeguards:

1. **Clamped parameters**: a is constrained to [0.2, 3.0], b to [-4.0, 4.0]
2. **Division guards**: L2 (Hessian) is checked for zero before division
3. **Likelihood floors**: Log-likelihood uses epsilon to avoid log(0)
4. **Convergence limits**: Maximum 50 iterations prevents infinite loops

### Performance Characteristics

| Function | Complexity | Typical Time |
|----------|------------|--------------|
| probability2PL | O(1) | < 1ms |
| estimateThetaMLE | O(n * iterations) | < 5ms for 50 items |
| estimateThetaEAP | O(n * quadPoints) | < 10ms with 41 points |
| selectNextItem | O(n) items | < 1ms |
| calibrateItems | O(n * m * iterations) | 100-500ms |

Where n = items, m = persons.

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created shadow documentation for irt.ts
- **Why**: Core algorithm requires comprehensive documentation for system understanding
- **Impact**: Enables developers and AI agents to understand IRT implementation

### Historical Implementation Notes

- 1PL, 2PL, 3PL probability functions are foundational
- Newton-Raphson MLE follows standard psychometric practice
- EAP with Gaussian quadrature follows Bock & Mislevy (1982)
- KL divergence selection follows Chang & Ying (1996)
- EM calibration follows Bock & Aitkin (1981)
