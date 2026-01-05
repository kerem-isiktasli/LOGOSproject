# LOGOS Algorithmic Foundations

## Purpose

This document provides the **mathematical, statistical, computational, and linguistic depth** required to implement LOGOS. It fills gaps identified in GAPS-AND-CONNECTIONS.md with rigorous algorithmic specifications.

**Domain Coverage:**
- Item Response Theory (IRT) - Psychometrics
- Pointwise Mutual Information (PMI) - Corpus Linguistics
- Spaced Repetition Mathematics - Memory Science
- Database Schema Optimization - Data Engineering
- LLM Prompt Engineering - AI/ML
- Linguistic Feature Extraction - Computational Linguistics

---

# Part 1: Item Response Theory (IRT) Mathematics

## 1.1 The Core IRT Models

### 1PL Model (Rasch Model)

The simplest IRT model, assuming equal discrimination across items:

```
P(X = 1 | θ, b) = 1 / (1 + e^(-(θ - b)))
```

Where:
- `P(X = 1)` = Probability of correct response
- `θ` (theta) = Person ability parameter (logit scale, typically -3 to +3)
- `b` = Item difficulty parameter (logit scale)

**Use case in LOGOS**: Phonology component (discrimination relatively constant)

### 2PL Model (Two-Parameter Logistic)

Adds discrimination parameter:

```
P(X = 1 | θ, a, b) = 1 / (1 + e^(-a(θ - b)))
```

Where:
- `a` = Item discrimination (slope, typically 0.5 to 2.5)
- Higher `a` = item better differentiates between ability levels

**Use case in LOGOS**: Lexical, Syntactic components

### 3PL Model (Three-Parameter Logistic)

Adds guessing parameter:

```
P(X = 1 | θ, a, b, c) = c + (1 - c) / (1 + e^(-a(θ - b)))
```

Where:
- `c` = Guessing parameter (lower asymptote, typically 0 to 0.35)
- For 4-option MCQ, theoretical guessing = 0.25

**Use case in LOGOS**: Pragmatic component (guessing factor significant)

---

## 1.2 θ Estimation Algorithms

### Maximum Likelihood Estimation (MLE)

Find θ that maximizes the likelihood of observed responses:

```typescript
function estimateThetaMLE(
  responses: boolean[],
  items: ItemParameter[]
): { theta: number; se: number } {
  // Log-likelihood function
  const logLikelihood = (theta: number): number => {
    return responses.reduce((sum, correct, i) => {
      const p = probability2PL(theta, items[i].a, items[i].b);
      return sum + (correct ? Math.log(p) : Math.log(1 - p));
    }, 0);
  };

  // Newton-Raphson iteration
  let theta = 0;  // Initial estimate
  const MAX_ITER = 50;
  const TOLERANCE = 0.001;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // First derivative (score function)
    let L1 = 0;
    // Second derivative (Fisher information)
    let L2 = 0;

    for (let i = 0; i < responses.length; i++) {
      const { a, b } = items[i];
      const p = probability2PL(theta, a, b);
      const q = 1 - p;
      const u = responses[i] ? 1 : 0;

      L1 += a * (u - p);
      L2 -= a * a * p * q;
    }

    const delta = L1 / L2;
    theta -= delta;

    if (Math.abs(delta) < TOLERANCE) break;
  }

  // Standard error = 1 / sqrt(Fisher Information)
  const fisherInfo = items.reduce((sum, item) => {
    const p = probability2PL(theta, item.a, item.b);
    return sum + item.a * item.a * p * (1 - p);
  }, 0);

  return {
    theta,
    se: 1 / Math.sqrt(fisherInfo)
  };
}

function probability2PL(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}
```

### Expected A Posteriori (EAP) Estimation

Bayesian approach with prior distribution:

```typescript
function estimateThetaEAP(
  responses: boolean[],
  items: ItemParameter[],
  priorMean: number = 0,
  priorSD: number = 1,
  quadPoints: number = 41
): { theta: number; se: number } {
  // Gaussian quadrature points
  const points: number[] = [];
  const weights: number[] = [];

  for (let i = 0; i < quadPoints; i++) {
    const x = priorMean + priorSD * 4 * (i / (quadPoints - 1) - 0.5);
    points.push(x);
    // Normal distribution weight
    weights.push(Math.exp(-0.5 * Math.pow((x - priorMean) / priorSD, 2)));
  }

  // Compute likelihood at each quadrature point
  const likelihoods = points.map((theta, idx) => {
    const likelihood = responses.reduce((prod, correct, i) => {
      const p = probability2PL(theta, items[i].a, items[i].b);
      return prod * (correct ? p : (1 - p));
    }, 1);
    return likelihood * weights[idx];
  });

  const sumLikelihoods = likelihoods.reduce((a, b) => a + b, 0);

  // EAP = weighted mean
  const eap = points.reduce((sum, theta, i) =>
    sum + theta * likelihoods[i], 0) / sumLikelihoods;

  // Posterior variance
  const variance = points.reduce((sum, theta, i) =>
    sum + Math.pow(theta - eap, 2) * likelihoods[i], 0) / sumLikelihoods;

  return {
    theta: eap,
    se: Math.sqrt(variance)
  };
}
```

---

## 1.3 Adaptive Item Selection

### Fisher Information Maximization

Select next item that provides maximum information at current θ estimate:

```typescript
function selectNextItem(
  currentTheta: number,
  availableItems: ItemParameter[],
  usedItemIds: Set<string>
): ItemParameter {
  let bestItem: ItemParameter | null = null;
  let maxInfo = -Infinity;

  for (const item of availableItems) {
    if (usedItemIds.has(item.id)) continue;

    // Fisher Information for 2PL model
    const p = probability2PL(currentTheta, item.a, item.b);
    const q = 1 - p;
    const info = item.a * item.a * p * q;

    if (info > maxInfo) {
      maxInfo = info;
      bestItem = item;
    }
  }

  return bestItem!;
}
```

### Kullback-Leibler Information

Better for multiple θ dimensions:

```typescript
function selectItemKL(
  thetaEstimate: number,
  thetaSE: number,
  availableItems: ItemParameter[]
): ItemParameter {
  // Integrate KL divergence over posterior distribution
  const quadPoints = 21;
  let bestItem: ItemParameter | null = null;
  let maxKL = -Infinity;

  for (const item of availableItems) {
    let klSum = 0;

    for (let i = 0; i < quadPoints; i++) {
      const theta = thetaEstimate + thetaSE * 3 * (i / (quadPoints - 1) - 0.5);
      const weight = Math.exp(-0.5 * Math.pow((theta - thetaEstimate) / thetaSE, 2));

      const p = probability2PL(theta, item.a, item.b);
      const pEst = probability2PL(thetaEstimate, item.a, item.b);

      // KL divergence
      const kl = p * Math.log(p / pEst) + (1 - p) * Math.log((1 - p) / (1 - pEst));
      klSum += kl * weight;
    }

    if (klSum > maxKL) {
      maxKL = klSum;
      bestItem = item;
    }
  }

  return bestItem!;
}
```

---

## 1.4 Item Parameter Estimation

Initial item parameters from pilot data using Marginal Maximum Likelihood:

```typescript
interface ItemCalibrationResult {
  a: number;  // Discrimination
  b: number;  // Difficulty
  se_a: number;
  se_b: number;
}

// Simplified EM algorithm for 2PL calibration
function calibrateItems(
  responseMatrix: boolean[][],  // [person][item]
  maxIter: number = 100
): ItemCalibrationResult[] {
  const nPersons = responseMatrix.length;
  const nItems = responseMatrix[0].length;

  // Initial estimates
  const params: ItemCalibrationResult[] = Array(nItems).fill(null).map(() => ({
    a: 1.0,
    b: 0.0,
    se_a: 0,
    se_b: 0
  }));

  // E-step: Estimate θ for each person given current item params
  // M-step: Estimate item params given θ distribution

  for (let iter = 0; iter < maxIter; iter++) {
    // E-step: EAP for each person
    const thetas = responseMatrix.map(responses =>
      estimateThetaEAP(responses, params.map((p, i) => ({ id: String(i), ...p }))).theta
    );

    // M-step: Update item parameters via gradient descent
    for (let j = 0; j < nItems; j++) {
      let sumGradA = 0, sumGradB = 0;
      let sumHessAA = 0, sumHessBB = 0;

      for (let i = 0; i < nPersons; i++) {
        const theta = thetas[i];
        const { a, b } = params[j];
        const p = probability2PL(theta, a, b);
        const u = responseMatrix[i][j] ? 1 : 0;

        // Gradients
        sumGradA += (u - p) * (theta - b);
        sumGradB += (u - p) * (-a);

        // Hessian (diagonal approximation)
        sumHessAA -= p * (1 - p) * Math.pow(theta - b, 2);
        sumHessBB -= p * (1 - p) * a * a;
      }

      // Newton-Raphson update
      params[j].a -= sumGradA / (sumHessAA - 0.01);  // Regularization
      params[j].b -= sumGradB / (sumHessBB - 0.01);

      // Constrain parameters
      params[j].a = Math.max(0.2, Math.min(3.0, params[j].a));
      params[j].b = Math.max(-4.0, Math.min(4.0, params[j].b));
    }
  }

  return params;
}
```

---

# Part 2: PMI and Corpus Statistics

## 2.1 PMI Computation

### Exact PMI Formula

```
PMI(w₁, w₂) = log₂ [ P(w₁, w₂) / (P(w₁) × P(w₂)) ]
            = log₂ [ C(w₁, w₂) × N / (C(w₁) × C(w₂)) ]
```

Where:
- `C(w₁, w₂)` = Co-occurrence count within window
- `C(w)` = Total occurrences of word
- `N` = Total word count in corpus

### Implementation

```typescript
interface PMIResult {
  word1: string;
  word2: string;
  pmi: number;
  npmi: number;      // Normalized PMI [-1, 1]
  cooccurrence: number;
  significance: number;  // Log-likelihood ratio
}

class PMICalculator {
  private wordCounts: Map<string, number> = new Map();
  private pairCounts: Map<string, number> = new Map();
  private totalWords: number = 0;
  private windowSize: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
  }

  indexCorpus(tokens: string[]): void {
    this.totalWords = tokens.length;

    // Count single words
    for (const token of tokens) {
      this.wordCounts.set(token, (this.wordCounts.get(token) || 0) + 1);
    }

    // Count co-occurrences within window
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < Math.min(i + this.windowSize, tokens.length); j++) {
        const pair = this.pairKey(tokens[i], tokens[j]);
        this.pairCounts.set(pair, (this.pairCounts.get(pair) || 0) + 1);
      }
    }
  }

  computePMI(word1: string, word2: string): PMIResult | null {
    const c1 = this.wordCounts.get(word1) || 0;
    const c2 = this.wordCounts.get(word2) || 0;
    const c12 = this.pairCounts.get(this.pairKey(word1, word2)) || 0;

    if (c1 === 0 || c2 === 0 || c12 === 0) return null;

    const N = this.totalWords;
    const expectedCooccurrence = (c1 * c2) / N;

    // PMI
    const pmi = Math.log2(c12 / expectedCooccurrence);

    // Normalized PMI (bounded [-1, 1])
    const npmi = pmi / (-Math.log2(c12 / N));

    // Log-likelihood ratio for significance
    const llr = this.logLikelihoodRatio(c1, c2, c12, N);

    return {
      word1,
      word2,
      pmi,
      npmi,
      cooccurrence: c12,
      significance: llr
    };
  }

  private pairKey(w1: string, w2: string): string {
    return w1 < w2 ? `${w1}|${w2}` : `${w2}|${w1}`;
  }

  private logLikelihoodRatio(c1: number, c2: number, c12: number, N: number): number {
    // Dunning's log-likelihood ratio
    const c1NotC2 = c1 - c12;
    const c2NotC1 = c2 - c12;
    const neither = N - c1 - c2 + c12;

    const H = (k: number, n: number, p: number): number => {
      if (k === 0 || k === n) return 0;
      return k * Math.log(p) + (n - k) * Math.log(1 - p);
    };

    const p = c2 / N;
    const p1 = c12 / c1;
    const p2 = c2NotC1 / (N - c1);

    return 2 * (
      H(c12, c1, p1) + H(c2NotC1, N - c1, p2) -
      H(c12, c1, p) - H(c2NotC1, N - c1, p)
    );
  }

  // Extract top collocations for a word
  getCollocations(word: string, topK: number = 20): PMIResult[] {
    const results: PMIResult[] = [];

    for (const [pair, _] of this.pairCounts) {
      const [w1, w2] = pair.split('|');
      if (w1 === word || w2 === word) {
        const other = w1 === word ? w2 : w1;
        const pmi = this.computePMI(word, other);
        if (pmi && pmi.significance > 3.84) {  // p < 0.05
          results.push(pmi);
        }
      }
    }

    return results
      .sort((a, b) => b.pmi - a.pmi)
      .slice(0, topK);
  }
}
```

## 2.2 PMI to Difficulty Mapping

```typescript
interface DifficultyMapping {
  baseDifficulty: number;  // IRT b parameter
  taskModifier: Record<TaskType, number>;
}

function pmiToDifficulty(
  pmi: number,
  npmi: number,
  taskType: TaskType
): number {
  // PMI typically ranges from -2 to +10 for meaningful pairs
  // Higher PMI = more predictable = easier

  // Normalize to [0, 1] where 1 = hardest
  const PMI_MIN = -2;
  const PMI_MAX = 10;
  const normalizedDifficulty = 1 - (pmi - PMI_MIN) / (PMI_MAX - PMI_MIN);

  // Clamp to valid range
  const baseDifficulty = Math.max(0, Math.min(1, normalizedDifficulty));

  // Convert to IRT logit scale [-3, +3]
  const logitDifficulty = (baseDifficulty - 0.5) * 6;

  // Task type modifiers
  const modifiers: Record<TaskType, number> = {
    'recognition': -0.5,      // Easier: just recognize
    'recall_cued': 0,         // Baseline
    'recall_free': +0.5,      // Harder: no cues
    'production': +1.0,       // Hardest: generate
    'timed': +0.3             // Added time pressure
  };

  return logitDifficulty + (modifiers[taskType] || 0);
}
```

---

# Part 3: Spaced Repetition Mathematics

## 3.1 FSRS Core Algorithm

Based on ts-fsrs, the Free Spaced Repetition Scheduler:

```typescript
interface FSRSCard {
  difficulty: number;      // D ∈ [1, 10]
  stability: number;       // S (days until 90% retention)
  retrievability: number;  // R = e^(-t/S)
  lastReview: Date;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
}

interface FSRSParameters {
  requestRetention: number;  // Target retention rate (default: 0.9)
  maximumInterval: number;   // Max days between reviews
  w: number[];               // 17 weight parameters
}

const DEFAULT_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8,        // Initial stability by rating
  4.93, 0.94, 0.86, 0.01,    // Difficulty modifiers
  1.49, 0.14, 0.94,          // Stability modifiers
  2.18, 0.05, 0.34, 1.26,    // Success/fail modifiers
  0.29, 2.61                  // Additional
];

class FSRS {
  private params: FSRSParameters;

  constructor(params?: Partial<FSRSParameters>) {
    this.params = {
      requestRetention: 0.9,
      maximumInterval: 36500,
      w: DEFAULT_WEIGHTS,
      ...params
    };
  }

  // Calculate retrievability (probability of recall)
  retrievability(card: FSRSCard, now: Date): number {
    const elapsedDays = this.daysSince(card.lastReview, now);
    return Math.exp(-elapsedDays / card.stability);
  }

  // Schedule next review
  schedule(card: FSRSCard, rating: 1 | 2 | 3 | 4, now: Date): FSRSCard {
    const newCard = { ...card };

    if (card.state === 'new') {
      // First review - initialize stability
      newCard.stability = this.initialStability(rating);
      newCard.difficulty = this.initialDifficulty(rating);
    } else {
      // Update based on response
      const retrievability = this.retrievability(card, now);
      newCard.difficulty = this.nextDifficulty(card.difficulty, rating);
      newCard.stability = this.nextStability(
        card.stability,
        card.difficulty,
        retrievability,
        rating
      );
    }

    // Calculate next interval
    const interval = this.nextInterval(newCard.stability);
    newCard.lastReview = now;
    newCard.reps += 1;

    if (rating === 1) {
      newCard.lapses += 1;
      newCard.state = 'relearning';
    } else {
      newCard.state = 'review';
    }

    return newCard;
  }

  private initialStability(rating: 1 | 2 | 3 | 4): number {
    return this.params.w[rating - 1];
  }

  private initialDifficulty(rating: 1 | 2 | 3 | 4): number {
    return Math.min(10, Math.max(1,
      this.params.w[4] - (rating - 3) * this.params.w[5]
    ));
  }

  private nextDifficulty(d: number, rating: 1 | 2 | 3 | 4): number {
    const deltaDifficulty = -this.params.w[6] * (rating - 3);
    return Math.min(10, Math.max(1, d + deltaDifficulty));
  }

  private nextStability(
    s: number,
    d: number,
    r: number,
    rating: 1 | 2 | 3 | 4
  ): number {
    if (rating === 1) {
      // Failed - stability decreases
      return this.params.w[11] *
        Math.pow(d, -this.params.w[12]) *
        Math.pow(s + 1, this.params.w[13]) - 1;
    }

    // Success - stability increases
    const hardPenalty = rating === 2 ? this.params.w[15] : 1;
    const easyBonus = rating === 4 ? this.params.w[16] : 1;

    return s * (
      1 +
      Math.exp(this.params.w[8]) *
      (11 - d) *
      Math.pow(s, -this.params.w[9]) *
      (Math.exp((1 - r) * this.params.w[10]) - 1) *
      hardPenalty *
      easyBonus
    );
  }

  private nextInterval(stability: number): number {
    // Interval where retention = requestRetention
    const interval = stability * Math.log(this.params.requestRetention) / Math.log(0.9);
    return Math.min(this.params.maximumInterval, Math.max(1, Math.round(interval)));
  }

  private daysSince(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  }
}
```

## 3.2 Integration with LOGOS Mastery Stages

```typescript
interface MasteryState {
  stage: 0 | 1 | 2 | 3 | 4;
  fsrsCard: FSRSCard;
  cueFreeAccuracy: number;
  cueAssistedAccuracy: number;
  exposureCount: number;
}

function updateMastery(
  state: MasteryState,
  response: {
    correct: boolean;
    cueLevel: 0 | 1 | 2 | 3;  // 0 = cue-free
    responseTimeMs: number;
  },
  fsrs: FSRS,
  now: Date
): MasteryState {
  const newState = { ...state };

  // Convert response to FSRS rating
  let rating: 1 | 2 | 3 | 4;
  if (!response.correct) {
    rating = 1;  // Again
  } else if (response.cueLevel > 0) {
    rating = 2;  // Hard (needed cues)
  } else if (response.responseTimeMs > 5000) {
    rating = 3;  // Good (slow but correct)
  } else {
    rating = 4;  // Easy (fast and correct)
  }

  // Update FSRS card
  newState.fsrsCard = fsrs.schedule(state.fsrsCard, rating, now);
  newState.exposureCount += 1;

  // Update accuracy tracking
  if (response.cueLevel === 0) {
    const weight = 1 / (newState.exposureCount * 0.3 + 1);  // Recency weighting
    newState.cueFreeAccuracy = (1 - weight) * state.cueFreeAccuracy +
      weight * (response.correct ? 1 : 0);
  } else {
    newState.cueAssistedAccuracy = (1 - 0.2) * state.cueAssistedAccuracy +
      0.2 * (response.correct ? 1 : 0);
  }

  // Stage transitions
  newState.stage = determineStage(newState);

  return newState;
}

function determineStage(state: MasteryState): 0 | 1 | 2 | 3 | 4 {
  if (state.exposureCount === 0) return 0;

  const gap = state.cueAssistedAccuracy - state.cueFreeAccuracy;
  const stability = state.fsrsCard.stability;

  // Stage 4: Automatic (high accuracy, high stability, low gap)
  if (state.cueFreeAccuracy >= 0.9 && stability > 30 && gap < 0.1) {
    return 4;
  }

  // Stage 3: Controlled Production (good cue-free performance)
  if (state.cueFreeAccuracy >= 0.75 && stability > 7) {
    return 3;
  }

  // Stage 2: Recall (moderate cue-free, better with cues)
  if (state.cueFreeAccuracy >= 0.6 || state.cueAssistedAccuracy >= 0.8) {
    return 2;
  }

  // Stage 1: Recognition (any success)
  if (state.cueAssistedAccuracy >= 0.5) {
    return 1;
  }

  return 0;
}
```

---

# Part 4: Database Schema Optimization

## 4.1 Complete Prisma Schema

```prisma
// schema.prisma for LOGOS

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ========== USER & GOALS ==========

model User {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Profile
  nativeLanguage String
  targetLanguage String

  // Global θ estimates
  thetaGlobal     Float    @default(0)
  thetaPhonology  Float    @default(0)
  thetaMorphology Float    @default(0)
  thetaLexical    Float    @default(0)
  thetaSyntactic  Float    @default(0)
  thetaPragmatic  Float    @default(0)

  goals    GoalSpec[]
  sessions Session[]
}

model GoalSpec {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Goal dimensions
  domain    String   // 'medical', 'legal', 'business'
  modality  String[] // ['reading', 'listening', 'writing', 'speaking']
  genre     String   // 'report', 'conversation', 'presentation'
  purpose   String   // 'certification', 'professional', 'academic'
  benchmark String?  // 'CELBAN', 'IELTS', 'TOEFL'
  deadline  DateTime?

  // Progress
  completionPercent Float @default(0)
  isActive          Boolean @default(true)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  languageObjects LanguageObject[]
  sessions        Session[]

  @@index([userId, isActive])
}

// ========== LANGUAGE OBJECTS ==========

model LanguageObject {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Type classification
  type String // 'LEX', 'MORPH', 'G2P', 'SYNT', 'PRAG'

  // Content
  content     String  // The actual word/pattern/rule
  contentJson Json?   // Full vector representation

  // FRE Metrics (computed from corpus)
  frequency            Float // F: 0-1 normalized
  relationalDensity    Float // R: hub score
  contextualContribution Float // E: meaning importance

  // Computed priority (denormalized for query speed)
  priority Float @default(0)

  // IRT parameters
  irtDifficulty      Float @default(0)
  irtDiscrimination  Float @default(1)

  goalId String
  goal   GoalSpec @relation(fields: [goalId], references: [id], onDelete: Cascade)

  masteryState MasteryState?
  responses    Response[]
  collocations Collocation[] @relation("word1")
  collocatedBy Collocation[] @relation("word2")

  @@index([goalId, type])
  @@index([goalId, priority(sort: Desc)])
}

model Collocation {
  id String @id @default(uuid())

  word1Id String
  word1   LanguageObject @relation("word1", fields: [word1Id], references: [id], onDelete: Cascade)

  word2Id String
  word2   LanguageObject @relation("word2", fields: [word2Id], references: [id], onDelete: Cascade)

  // PMI statistics
  pmi          Float
  npmi         Float
  cooccurrence Int
  significance Float

  @@unique([word1Id, word2Id])
  @@index([word1Id])
  @@index([word2Id])
}

// ========== MASTERY STATE ==========

model MasteryState {
  id String @id @default(uuid())

  // Current stage (0-4)
  stage Int @default(0)

  // FSRS parameters
  fsrsDifficulty   Float    @default(5)
  fsrsStability    Float    @default(0)
  fsrsLastReview   DateTime?
  fsrsReps         Int      @default(0)
  fsrsLapses       Int      @default(0)
  fsrsState        String   @default("new")

  // Accuracy tracking
  cueFreeAccuracy    Float @default(0)
  cueAssistedAccuracy Float @default(0)
  exposureCount      Int   @default(0)

  // Scheduling
  nextReview DateTime?
  priority   Float    @default(0)

  objectId String         @unique
  object   LanguageObject @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@index([nextReview])
  @@index([priority(sort: Desc)])
}

// ========== SESSIONS & RESPONSES ==========

model Session {
  id        String   @id @default(uuid())
  startedAt DateTime @default(now())
  endedAt   DateTime?

  // Session type
  mode String // 'learning', 'training', 'evaluation'

  // Metrics
  itemsPracticed    Int @default(0)
  stageTransitions  Int @default(0)
  fluencyTaskCount  Int @default(0)
  versatilityTaskCount Int @default(0)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  goalId String
  goal   GoalSpec @relation(fields: [goalId], references: [id], onDelete: Cascade)

  responses Response[]
  thetaSnapshots ThetaSnapshot[]

  @@index([userId, startedAt(sort: Desc)])
}

model Response {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Task metadata
  taskType   String  // 'recognition', 'recall', 'production', 'timed'
  taskFormat String  // 'mcq', 'fill_blank', 'free_response'
  modality   String  // 'visual', 'auditory', 'mixed'

  // Response data
  correct       Boolean
  responseTimeMs Int
  cueLevel      Int     @default(0) // 0 = cue-free, 1-3 = assisted

  // Raw response (for analysis)
  responseContent String?
  expectedContent String?

  // IRT scoring (evaluation mode only)
  irtThetaContribution Float?

  sessionId String
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  objectId String
  object   LanguageObject @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([objectId, createdAt(sort: Desc)])
}

model ThetaSnapshot {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // θ values at this point
  thetaGlobal     Float
  thetaPhonology  Float
  thetaMorphology Float
  thetaLexical    Float
  thetaSyntactic  Float
  thetaPragmatic  Float

  // Standard errors
  seGlobal Float

  sessionId String
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

// ========== CACHED CONTENT ==========

model CachedTask {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  expiresAt DateTime

  objectId  String
  taskType  String
  taskFormat String

  // Cached Claude-generated content
  taskContent Json

  @@unique([objectId, taskType, taskFormat])
  @@index([expiresAt])
}
```

## 4.2 Optimized Queries

```typescript
// Get learning queue (top priority items due for review)
async function getLearningQueue(
  db: PrismaClient,
  goalId: string,
  limit: number = 20
): Promise<LearningQueueItem[]> {
  const now = new Date();

  return db.$queryRaw`
    SELECT
      lo.id,
      lo.content,
      lo.type,
      lo.priority,
      ms.stage,
      ms.nextReview,
      ms.cueFreeAccuracy,
      ms.cueAssistedAccuracy,
      CASE
        WHEN ms.nextReview IS NULL THEN 1
        WHEN ms.nextReview <= ${now} THEN 2
        ELSE 3
      END as urgency
    FROM LanguageObject lo
    LEFT JOIN MasteryState ms ON ms.objectId = lo.id
    WHERE lo.goalId = ${goalId}
    ORDER BY
      urgency ASC,
      ms.stage ASC,
      lo.priority DESC
    LIMIT ${limit}
  `;
}

// Bottleneck detection query
async function detectBottleneck(
  db: PrismaClient,
  userId: string,
  windowDays: number = 14
): Promise<BottleneckAnalysis> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const errorsByType = await db.$queryRaw`
    SELECT
      lo.type,
      COUNT(*) as totalResponses,
      SUM(CASE WHEN r.correct = 0 THEN 1 ELSE 0 END) as errors,
      AVG(CASE WHEN r.correct = 0 THEN 1.0 ELSE 0.0 END) as errorRate
    FROM Response r
    JOIN LanguageObject lo ON lo.id = r.objectId
    JOIN Session s ON s.id = r.sessionId
    WHERE s.userId = ${userId}
      AND r.createdAt >= ${since}
    GROUP BY lo.type
    HAVING COUNT(*) >= 5
    ORDER BY errorRate DESC
  `;

  return analyzeBottleneck(errorsByType);
}
```

---

# Part 5: LLM Prompt Engineering

## 5.1 Structured Extraction Prompts

### Vocabulary Extraction

```typescript
const VOCABULARY_EXTRACTION_PROMPT = `
You are a computational linguist extracting vocabulary from domain-specific text.

For each significant word/phrase, provide:
1. content: The word or multi-word expression
2. type: LEX (single word), MWE (multi-word expression), TERM (technical term)
3. pos: Part of speech (NOUN, VERB, ADJ, ADV, etc.)
4. frequency_estimate: 1-10 (10 = extremely common in this domain)
5. register: formal/neutral/informal
6. domain_specificity: 0-1 (1 = highly specialized)
7. morphological_root: Base form if inflected
8. collocations: Top 3 words that frequently appear with this word

Return as JSON array. Only include words with domain_specificity > 0.3 or frequency_estimate > 7.

Text to analyze:
"""
{TEXT}
"""
`;

interface ClaudeVocabularyResponse {
  content: string;
  type: 'LEX' | 'MWE' | 'TERM';
  pos: string;
  frequency_estimate: number;
  register: 'formal' | 'neutral' | 'informal';
  domain_specificity: number;
  morphological_root: string;
  collocations: string[];
}
```

### Task Generation

```typescript
const TASK_GENERATION_PROMPT = `
Generate a language learning task for the following parameters:

Target word: {WORD}
Target stage: {STAGE} (1=Recognition, 2=Recall, 3=Production, 4=Automatic)
Task format: {FORMAT}
Domain context: {DOMAIN}
User proficiency: {THETA} (logit scale, 0 = average)

Requirements:
- Stage 1: Multiple choice with 4 options, 1 correct
- Stage 2: Fill-in-blank with partial cue (first letter or root)
- Stage 3: Open production prompt with clear context
- Stage 4: Time-pressured rapid response

Ensure distractors for MCQ are plausible but clearly wrong.
Context should be authentic to the domain.

Return JSON:
{
  "prompt": "The task prompt shown to user",
  "correctAnswer": "Expected correct response",
  "distractors": ["wrong option 1", "wrong option 2", "wrong option 3"],
  "hints": ["hint level 1", "hint level 2", "hint level 3"],
  "context": "Background context for the task",
  "explanation": "Why this answer is correct"
}
`;
```

### Response Evaluation

```typescript
const RESPONSE_EVALUATION_PROMPT = `
Evaluate the learner's response against the expected answer.

Task: {TASK_PROMPT}
Expected: {EXPECTED_ANSWER}
Learner response: {USER_RESPONSE}
Task type: {TASK_TYPE}

Evaluate on these dimensions (0-1 scale each):
1. grammatical_accuracy: Correct grammar, spelling, morphology
2. semantic_accuracy: Meaning matches expected
3. pragmatic_appropriateness: Register and context fit
4. lexical_precision: Word choice quality

Return JSON:
{
  "overall_correct": boolean,
  "scores": {
    "grammatical_accuracy": 0-1,
    "semantic_accuracy": 0-1,
    "pragmatic_appropriateness": 0-1,
    "lexical_precision": 0-1
  },
  "errors": [
    {
      "type": "grammar|spelling|vocabulary|register|meaning",
      "location": "the problematic part",
      "correction": "suggested fix",
      "explanation": "why it's wrong"
    }
  ],
  "feedback": "Constructive feedback for learner"
}
`;
```

## 5.2 Claude API Integration Pattern

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxRetries: number;
  baseDelay: number;
}

class ClaudeService {
  private client: Anthropic;
  private config: ClaudeConfig;
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  constructor(config: Partial<ClaudeConfig> = {}) {
    this.config = {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-sonnet-4-5-20250929',
      maxRetries: 3,
      baseDelay: 1000,
      ...config
    };
    this.client = new Anthropic({ apiKey: this.config.apiKey });
  }

  async query<T>(
    prompt: string,
    options: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      cacheKey?: string;
      cacheTTL?: number;
    } = {}
  ): Promise<T> {
    // Check cache
    if (options.cacheKey) {
      const cached = this.cache.get(options.cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.value as T;
      }
    }

    // Retry with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const message = await this.client.messages.create({
          model: this.config.model,
          max_tokens: options.maxTokens || 1024,
          system: options.systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        });

        const content = message.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type');
        }

        // Parse JSON response
        const result = JSON.parse(content.text) as T;

        // Cache result
        if (options.cacheKey) {
          this.cache.set(options.cacheKey, {
            value: result,
            expiry: Date.now() + (options.cacheTTL || 3600000)
          });
        }

        return result;
      } catch (error: any) {
        lastError = error;

        if (error.status === 429) {
          // Rate limited
          await this.sleep(this.config.baseDelay * Math.pow(2, attempt));
          continue;
        }

        if (error.status >= 500) {
          // Server error
          await this.sleep(this.config.baseDelay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

# Part 6: Linguistic Feature Extraction

## 6.1 Morphological Analysis

```typescript
interface MorphologicalAnalysis {
  root: string;
  prefixes: Affix[];
  suffixes: Affix[];
  inflection: string;
  derivationType: 'simple' | 'derived' | 'compound';
}

interface Affix {
  form: string;
  type: 'prefix' | 'suffix' | 'infix';
  meaning: string;
  productivity: number;  // How freely it combines
}

// Common English affixes for medical domain
const MEDICAL_AFFIXES: Record<string, Affix> = {
  'pre-': { form: 'pre-', type: 'prefix', meaning: 'before', productivity: 0.8 },
  'post-': { form: 'post-', type: 'prefix', meaning: 'after', productivity: 0.8 },
  'anti-': { form: 'anti-', type: 'prefix', meaning: 'against', productivity: 0.9 },
  'contra-': { form: 'contra-', type: 'prefix', meaning: 'against', productivity: 0.6 },
  '-tion': { form: '-tion', type: 'suffix', meaning: 'action/process', productivity: 0.9 },
  '-ize': { form: '-ize', type: 'suffix', meaning: 'to make', productivity: 0.8 },
  '-itis': { form: '-itis', type: 'suffix', meaning: 'inflammation', productivity: 0.7 },
  '-ectomy': { form: '-ectomy', type: 'suffix', meaning: 'surgical removal', productivity: 0.6 },
};

function analyzeMorphology(word: string): MorphologicalAnalysis {
  const result: MorphologicalAnalysis = {
    root: word,
    prefixes: [],
    suffixes: [],
    inflection: 'base',
    derivationType: 'simple'
  };

  let remaining = word.toLowerCase();

  // Check prefixes
  for (const [form, affix] of Object.entries(MEDICAL_AFFIXES)) {
    if (affix.type === 'prefix' && remaining.startsWith(form.replace('-', ''))) {
      result.prefixes.push(affix);
      remaining = remaining.slice(form.length - 1);
      result.derivationType = 'derived';
    }
  }

  // Check suffixes
  for (const [form, affix] of Object.entries(MEDICAL_AFFIXES)) {
    if (affix.type === 'suffix' && remaining.endsWith(form.replace('-', ''))) {
      result.suffixes.push(affix);
      remaining = remaining.slice(0, -(form.length - 1));
      result.derivationType = 'derived';
    }
  }

  result.root = remaining;

  // Check inflection (simplified)
  if (word.endsWith('ed')) result.inflection = 'past';
  else if (word.endsWith('ing')) result.inflection = 'progressive';
  else if (word.endsWith('s') && !word.endsWith('ss')) result.inflection = 'plural/3sg';

  return result;
}
```

## 6.2 Syntactic Complexity Metrics

```typescript
interface SyntacticComplexity {
  sentenceLength: number;
  dependencyDepth: number;      // Max depth of dependency tree
  clauseCount: number;          // Number of clauses
  subordinationIndex: number;   // Subordinate clauses / total clauses
  passiveRatio: number;         // Passive constructions / total verbs
  nominalRatio: number;         // Nouns / (nouns + verbs)
  averageDependencyDistance: number;  // Mean distance between head and dependent
}

// Simplified syntactic analysis (full version would use Claude or spaCy)
function estimateSyntacticComplexity(sentence: string): SyntacticComplexity {
  const words = sentence.split(/\s+/);
  const length = words.length;

  // Heuristic estimates
  const clauses = (sentence.match(/[,;:]|\b(that|which|who|when|where|because|although|if)\b/gi) || []).length + 1;
  const subordinators = (sentence.match(/\b(that|which|who|when|where|because|although|if|while|unless)\b/gi) || []).length;
  const passives = (sentence.match(/\b(is|are|was|were|been|being)\s+\w+ed\b/gi) || []).length;
  const nouns = (sentence.match(/\b\w+(tion|ment|ness|ity|ism|er|or)\b/gi) || []).length;
  const verbs = (sentence.match(/\b(is|are|was|were|have|has|had|do|does|did|\w+ed|\w+ing)\b/gi) || []).length;

  return {
    sentenceLength: length,
    dependencyDepth: Math.ceil(Math.log2(length + 1)),  // Estimate
    clauseCount: clauses,
    subordinationIndex: subordinators / Math.max(clauses, 1),
    passiveRatio: passives / Math.max(verbs, 1),
    nominalRatio: nouns / Math.max(nouns + verbs, 1),
    averageDependencyDistance: length / (clauses * 2)  // Rough estimate
  };
}

// Target complexity by CEFR level
const COMPLEXITY_TARGETS: Record<string, SyntacticComplexity> = {
  'A1': { sentenceLength: 8, dependencyDepth: 2, clauseCount: 1, subordinationIndex: 0, passiveRatio: 0, nominalRatio: 0.4, averageDependencyDistance: 2 },
  'A2': { sentenceLength: 12, dependencyDepth: 3, clauseCount: 1.5, subordinationIndex: 0.1, passiveRatio: 0.05, nominalRatio: 0.45, averageDependencyDistance: 3 },
  'B1': { sentenceLength: 15, dependencyDepth: 4, clauseCount: 2, subordinationIndex: 0.2, passiveRatio: 0.1, nominalRatio: 0.5, averageDependencyDistance: 4 },
  'B2': { sentenceLength: 20, dependencyDepth: 5, clauseCount: 2.5, subordinationIndex: 0.3, passiveRatio: 0.15, nominalRatio: 0.55, averageDependencyDistance: 5 },
  'C1': { sentenceLength: 25, dependencyDepth: 6, clauseCount: 3, subordinationIndex: 0.4, passiveRatio: 0.2, nominalRatio: 0.6, averageDependencyDistance: 6 },
};
```

## 6.3 G2P (Grapheme-to-Phoneme) Rules

```typescript
interface G2PRule {
  pattern: RegExp;
  phoneme: string;
  context: 'initial' | 'medial' | 'final' | 'any';
  exceptions: string[];
}

// Simplified English G2P rules
const ENGLISH_G2P_RULES: G2PRule[] = [
  // Vowels
  { pattern: /a(?=[^aeiou][aeiou])/, phoneme: '/eɪ/', context: 'any', exceptions: ['have', 'are'] },
  { pattern: /ee/, phoneme: '/iː/', context: 'any', exceptions: [] },
  { pattern: /ea(?=[^r])/, phoneme: '/iː/', context: 'any', exceptions: ['bread', 'head'] },
  { pattern: /oo/, phoneme: '/uː/', context: 'any', exceptions: ['book', 'look', 'good'] },

  // Consonants
  { pattern: /ph/, phoneme: '/f/', context: 'any', exceptions: [] },
  { pattern: /gh(?=[^aeiou]|$)/, phoneme: '', context: 'any', exceptions: [] },
  { pattern: /kn(?=[aeiou])/, phoneme: '/n/', context: 'initial', exceptions: [] },
  { pattern: /tion/, phoneme: '/ʃən/', context: 'final', exceptions: ['question'] },

  // Medical domain specifics
  { pattern: /psych/, phoneme: '/saɪk/', context: 'initial', exceptions: [] },
  { pattern: /pneu/, phoneme: '/njuː/', context: 'initial', exceptions: [] },
];

interface G2PDifficulty {
  word: string;
  irregularPatterns: string[];
  difficultyScore: number;  // 0-1
  potentialMispronunciations: string[];
}

function analyzeG2PDifficulty(word: string): G2PDifficulty {
  const irregularPatterns: string[] = [];
  let difficultyScore = 0;

  // Check for exception words
  for (const rule of ENGLISH_G2P_RULES) {
    if (rule.exceptions.includes(word.toLowerCase())) {
      irregularPatterns.push(`Exception to ${rule.pattern.source} → ${rule.phoneme}`);
      difficultyScore += 0.2;
    }
  }

  // Check for silent letters
  if (/\b[kgpw]n/.test(word)) {
    irregularPatterns.push('Silent initial consonant');
    difficultyScore += 0.15;
  }

  // Check for unpredictable vowels
  if (/[aeiou]{2}/.test(word)) {
    irregularPatterns.push('Vowel digraph');
    difficultyScore += 0.1;
  }

  return {
    word,
    irregularPatterns,
    difficultyScore: Math.min(1, difficultyScore),
    potentialMispronunciations: generateMispronunciations(word)
  };
}

function generateMispronunciations(word: string): string[] {
  // Common L1-influenced mispronunciations
  const mispronunciations: string[] = [];

  // Spanish speakers
  if (/^sp|^st/.test(word)) {
    mispronunciations.push(`/es${word.slice(1)}/`);  // "especial" for "special"
  }

  // Stress errors
  if (word.length > 6) {
    mispronunciations.push('Wrong syllable stress');
  }

  return mispronunciations;
}
```

---

# Part 7: Threshold Detection Algorithm

## 7.1 Bottleneck Identification

```typescript
interface BottleneckAnalysis {
  primaryBottleneck: ComponentType | null;
  confidence: number;
  evidence: BottleneckEvidence[];
  recommendation: string;
}

interface BottleneckEvidence {
  componentType: ComponentType;
  errorRate: number;
  errorPatterns: string[];
  cooccurringErrors: ComponentType[];
  improvement: number;  // Recent trend
}

async function detectBottleneck(
  db: PrismaClient,
  userId: string,
  goalId: string
): Promise<BottleneckAnalysis> {
  // Get recent responses with error analysis
  const recentResponses = await db.response.findMany({
    where: {
      session: { userId, goalId },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
    },
    include: {
      object: true
    }
  });

  if (recentResponses.length < 20) {
    return {
      primaryBottleneck: null,
      confidence: 0,
      evidence: [],
      recommendation: 'Need more data for bottleneck detection'
    };
  }

  // Group errors by component type
  const errorsByType = new Map<ComponentType, Response[]>();
  for (const r of recentResponses) {
    if (!r.correct) {
      const type = r.object.type as ComponentType;
      const existing = errorsByType.get(type) || [];
      existing.push(r);
      errorsByType.set(type, existing);
    }
  }

  // Calculate error rates
  const typeStats = new Map<ComponentType, { errors: number; total: number }>();
  for (const r of recentResponses) {
    const type = r.object.type as ComponentType;
    const stat = typeStats.get(type) || { errors: 0, total: 0 };
    stat.total++;
    if (!r.correct) stat.errors++;
    typeStats.set(type, stat);
  }

  // Find highest error rate component
  let maxErrorRate = 0;
  let bottleneck: ComponentType | null = null;
  const evidence: BottleneckEvidence[] = [];

  for (const [type, stat] of typeStats) {
    const errorRate = stat.errors / stat.total;
    evidence.push({
      componentType: type,
      errorRate,
      errorPatterns: analyzeErrorPatterns(errorsByType.get(type) || []),
      cooccurringErrors: findCooccurringErrors(type, recentResponses),
      improvement: calculateImprovementTrend(type, recentResponses)
    });

    if (errorRate > maxErrorRate && stat.total >= 5) {
      maxErrorRate = errorRate;
      bottleneck = type;
    }
  }

  // Check for cascading errors (e.g., morphology errors causing lexical errors)
  const cascadeAnalysis = analyzeCascadingErrors(evidence);

  return {
    primaryBottleneck: cascadeAnalysis.rootCause || bottleneck,
    confidence: calculateConfidence(evidence, recentResponses.length),
    evidence: evidence.sort((a, b) => b.errorRate - a.errorRate),
    recommendation: generateRecommendation(cascadeAnalysis.rootCause || bottleneck, evidence)
  };
}

function analyzeErrorPatterns(errors: Response[]): string[] {
  // Cluster errors by similarity
  const patterns: Map<string, number> = new Map();

  for (const error of errors) {
    // Extract pattern from error content
    const pattern = extractErrorPattern(error);
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
  }

  return Array.from(patterns.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => `${pattern} (${count}x)`);
}

function findCooccurringErrors(
  targetType: ComponentType,
  responses: Response[]
): ComponentType[] {
  // Find other component types that tend to have errors in the same session
  const sessionErrors = new Map<string, Set<ComponentType>>();

  for (const r of responses) {
    if (!r.correct) {
      const errors = sessionErrors.get(r.sessionId) || new Set();
      errors.add(r.object.type as ComponentType);
      sessionErrors.set(r.sessionId, errors);
    }
  }

  const cooccurrence = new Map<ComponentType, number>();
  for (const errors of sessionErrors.values()) {
    if (errors.has(targetType)) {
      for (const type of errors) {
        if (type !== targetType) {
          cooccurrence.set(type, (cooccurrence.get(type) || 0) + 1);
        }
      }
    }
  }

  return Array.from(cooccurrence.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([type, _]) => type);
}

interface CascadeAnalysis {
  rootCause: ComponentType | null;
  cascadeChain: ComponentType[];
  confidence: number;
}

function analyzeCascadingErrors(evidence: BottleneckEvidence[]): CascadeAnalysis {
  // Define theoretical cascade relationships
  // Phonology → Morphology → Lexical → Syntactic → Pragmatic
  const cascadeOrder: ComponentType[] = ['PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG'];

  // Find earliest component with high error rate
  for (const type of cascadeOrder) {
    const ev = evidence.find(e => e.componentType === type);
    if (ev && ev.errorRate > 0.3) {
      // Check if downstream components also have errors
      const downstreamErrors = cascadeOrder
        .slice(cascadeOrder.indexOf(type) + 1)
        .filter(t => evidence.find(e => e.componentType === t)?.errorRate > 0.2);

      if (downstreamErrors.length > 0) {
        return {
          rootCause: type,
          cascadeChain: [type, ...downstreamErrors],
          confidence: 0.7
        };
      }
    }
  }

  return { rootCause: null, cascadeChain: [], confidence: 0 };
}
```

---

*Document Version: 1.0*
*Created: 2026-01-04*
*Purpose: Algorithmic depth for LOGOS implementation*
*Domains: IRT, PMI, Spaced Repetition, Database, LLM, Linguistics*
