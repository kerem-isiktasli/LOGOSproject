# Diagnostic Assessment Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/diagnostic-assessment.service.ts`
> **Status**: Active

---

## Context & Purpose

This service handles **initial ability estimation** for new users during the onboarding process. It answers the critical question: "Where should a new learner start?" Without this, LOGOS would either start everyone at the same level (frustrating for advanced learners, overwhelming for beginners) or require a lengthy placement test before any learning can begin.

**Business Need**: Users abandon applications that don't immediately feel personalized. A medical professional learning Korean for patient communication should not start with the same content as a tourist learning phrases for a vacation. This service bridges the gap between "we know nothing about this user" and "we can deliver personalized content" - often within seconds of account creation.

**When Used**:
- During onboarding wizard completion: Estimates initial theta from profile data
- During optional placement test: Refines estimates using actual response data
- After first few learning sessions: Updates theta estimates as real performance data accumulates
- When adding new learning goals: Recalibrates starting points for different domains

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`src/main/db/prisma.ts`**: `getPrisma()` - Provides database client for updating user theta values. The service writes estimated abilities directly to the user record.

### Dependents (What Needs This)

**IPC Layer:**
- `src/main/ipc/onboarding.ipc.ts`: The `onboarding:complete` handler calls `estimateInitialTheta()` to initialize user ability estimates. This is the primary consumer - every new user passes through this function.

**Database Layer:**
- `prisma.user` table: Receives theta updates via `updateUserTheta()`. Stores global and component-specific theta values.

### Data Flow

```
Onboarding Wizard
       |
       | User profile data:
       | - purpose (certification, professional, etc.)
       | - daily time commitment
       | - target domain
       | - selected modalities
       | - optional: self-assessed level
       v
+--------------------------------+
| estimateInitialTheta()         |
|   |                            |
|   +-- getPriorTheta()          |  Purpose + Domain -> Base estimate
|   +-- getTimeAdjustment()      |  Daily minutes -> Motivation signal
|   +-- getSelfAssessmentAdj()   |  User's self-rating -> Adjustment
|   +-- getDefaultComponentThetas()  Modality -> Component-specific
|   |                            |
|   v                            |
| [If placement test taken]      |
|   +-- estimateThetaFromResponses()  MLE estimation
|       +-- mleEstimate()        |     Newton-Raphson per component
|       +-- calculateStandardError()  Confidence interval
+--------------------------------+
       |
       v
ThetaEstimate object:
- thetaGlobal: -3 to +3
- thetaPhonology, thetaMorphology, etc.
- standardError: Confidence measure
- estimatedCEFR: A1-C2 mapping
- recommendedDifficulty: 0.1-0.9
       |
       v
User record updated in database
       |
       v
First session uses these estimates
for initial item selection
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits in the **Application Services Layer**, bridging user input (profile data) with the adaptive learning engine:

```
+-----------------------------------------------+
| Renderer: OnboardingWizard, PlacementTest     |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| IPC: onboarding.ipc.ts                        |
|      Validates input, orchestrates flow       |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Services: DIAGNOSTIC ASSESSMENT (THIS FILE)   |  <-- You are here
|           Bayesian prior + optional MLE       |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Core: irt.ts                                  |
| (provides IRT concepts, but this service      |
|  has its own simplified 2PL implementation)   |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Database: User.theta* fields                  |
+-----------------------------------------------+
```

### Big Picture Impact

This service is the **starting point for personalization**. It determines:

| Downstream System | How Diagnostic Assessment Affects It |
|-------------------|-------------------------------------|
| Task Generation | Initial difficulty band for first items |
| Item Selection | Which items are "too easy" or "too hard" |
| FSRS Scheduling | Initial stability estimates for spaced repetition |
| Progress Display | Baseline for measuring improvement |
| Content Selection | Which corpus sources to prioritize |

**Without This Service:**
- All users would start at theta = 0 (meaningless average)
- First sessions would be poorly calibrated (too hard for beginners, too easy for experts)
- Component-specific learning would be impossible (no phonology vs. syntax distinction)
- User frustration and abandonment would increase dramatically

### Critical Path Analysis

**Importance Level**: High (First Impression Critical)

**If this service fails:**
- Onboarding cannot complete successfully
- Users get generic, non-personalized starting points
- First learning sessions feel inappropriate

**If estimates are inaccurate:**
- First few sessions may be too easy/hard
- Self-correcting: Real performance data will update estimates within 10-20 responses
- Degraded but not catastrophic: LOGOS adapts quickly

**Failure Modes Handled:**
1. **Missing profile data**: Graceful defaults (purpose="personal", domain="general")
2. **Missing placement responses**: Falls back to profile-only estimation
3. **Extreme placement performance**: Theta clamped to [-4, 4] to prevent divergence
4. **Database write failure**: Service function completes; caller handles persistence errors

---

## Algorithm Explanations

### Prior Estimation (Bayesian Approach)

The service uses a **Bayesian prior** based on profile data before any test responses are available.

**What It Does**: Maps qualitative user information to a starting theta estimate.

**How It Works**:

```
Base Prior from Purpose:
  certification: +0.5   (aiming for exam, likely has foundation)
  professional:  +0.3   (working context, moderate baseline)
  academic:      +0.4   (studying formally, some foundation)
  immigration:   +0.2   (variable, conservative)
  personal:       0.0   (hobby, no strong prior)

Domain Adjustment:
  medical/legal: +0.3   (specialized = higher if chosen)
  business/tech: +0.2   (professional domains)
  general:        0.0   (no adjustment)
  travel:        -0.2   (basic needs)

Time Commitment Adjustment:
  60+ minutes:   +0.2   (serious commitment)
  30-59 minutes: +0.1   (moderate)
  15-29 minutes:  0.0   (typical)
  < 15 minutes:  -0.1   (casual)

Self-Assessment Adjustment:
  advanced:      +0.5
  intermediate:   0.0
  beginner:      -0.5
```

**Plain English**: We make educated guesses based on what users tell us. Someone studying for a medical certification exam in Korean, planning to study 90 minutes daily and rating themselves as intermediate, probably knows more than a tourist wanting to learn travel phrases for 10 minutes a day who calls themselves a beginner.

### Component-Specific Theta Adjustment

Different modalities develop different linguistic components first:

```
Listening/Speaking focus:
  Phonology:    +0.1  (ear training develops faster)

Reading/Writing focus:
  Lexical:      +0.1  (vocabulary through text)
  Syntactic:    +0.1  (grammar through writing)

All learners:
  Pragmatics:   -0.2  (develops slower - cultural context)
```

**Plain English**: Someone learning through podcasts will develop their ear faster than their writing. Someone learning through books will develop vocabulary and grammar awareness faster than pronunciation. This adjustment ensures the first few sessions focus appropriately on each learner's likely strengths and weaknesses.

### Maximum Likelihood Estimation (MLE) from Placement Test

When a user completes placement test items, we use MLE to refine estimates.

**What It Does**: Finds the theta that makes the observed response pattern most likely.

**How It Works**:
1. Start at theta = 0
2. Calculate probability of each response under current theta
3. Compute gradient (first derivative of log-likelihood)
4. Compute curvature (second derivative / Fisher information)
5. Newton-Raphson update: theta = theta + gradient / |curvature|
6. Repeat until convergence (delta < 0.001) or max iterations

**2PL Probability Function**:
```
P(correct) = 1 / (1 + exp(-a * (theta - b)))

where:
  a = discrimination (fixed at 1.0 for simplicity, Rasch model)
  b = item difficulty
  theta = learner ability
```

**Plain English**: We ask: "Given this specific pattern of right and wrong answers, what ability level would make that pattern most likely?" We iteratively adjust our guess until it fits the data well.

### Standard Error Calculation

**What It Does**: Quantifies how confident we are in the theta estimate.

**How It Works**:
```
SE = 1 / sqrt(Fisher Information)

Fisher Information = sum of (a^2 * P * (1-P)) for all items
```

**Plain English**: If we asked questions where the learner had 50-50 chance (P near 0.5), we learned a lot. If we asked questions that were too easy (P near 1.0) or too hard (P near 0.0), we learned almost nothing. Standard error reflects how informative our questions were.

**Practical Interpretation**:
- SE < 0.3: High confidence (many informative items)
- SE = 0.5: Moderate confidence (typical for short placement test)
- SE > 1.0: Low confidence (few items or extreme responses)

### CEFR Level Mapping

**What It Does**: Translates theta to a familiar proficiency scale (A1-C2).

**Theta to CEFR Mapping**:
```
theta < -1.5  -> A1 (Beginner)
-1.5 to -0.5  -> A2 (Elementary)
-0.5 to +0.5  -> B1 (Intermediate)
+0.5 to +1.5  -> B2 (Upper Intermediate)
+1.5 to +2.5  -> C1 (Advanced)
theta > +2.5  -> C2 (Mastery)
```

**Plain English**: The Common European Framework of Reference (CEFR) is the international standard for language proficiency. Mapping theta to CEFR lets us show users a familiar level and helps select appropriate content from level-tagged corpora.

---

## Technical Concepts (Plain English)

### Theta

**Technical**: The latent ability parameter in IRT, typically scaled to have mean 0 and standard deviation 1 in the population.

**Plain English**: A number representing how skilled the learner is. Think of it like a standardized test score. Zero means average; positive means above average; negative means below average. A theta of +2.0 means the learner is in roughly the top 2% of the population for that skill.

**Why We Use It**: Theta lets us compare abilities and difficulties on the same scale. If an item has difficulty b = 1.5 and a learner has theta = 1.5, they have a 50% chance of getting it right. This direct comparability makes adaptive item selection possible.

### Prior vs. Posterior

**Technical**: In Bayesian statistics, the prior is the belief before seeing data; the posterior is the updated belief after incorporating data.

**Plain English**: The prior is our educated guess about a new user's ability based on their profile. The posterior is our refined estimate after they actually answer questions. The placement test converts prior (guess) into posterior (evidence-based estimate).

**Why We Use It**: Priors let us start personalization immediately. Posteriors get more accurate with more data. The Bayesian framework naturally combines both.

### Newton-Raphson Iteration

**Technical**: A root-finding algorithm that uses the function's derivative to iteratively approach the maximum of the likelihood function.

**Plain English**: Imagine you're blindfolded on a hill trying to find the peak. You feel the slope (gradient) and steepness (curvature) under your feet. You take a step in the uphill direction, with step size proportional to slope/curvature. Repeat until you stop moving (found the peak).

**Why We Use It**: Newton-Raphson finds the maximum likelihood theta quickly (usually 5-10 iterations) compared to simpler methods that might take hundreds of steps.

### Guessing Parameter (Implicit c = 0)

**Technical**: The 3PL model includes a guessing parameter c representing the lower asymptote. This service uses 2PL (c = 0 implicitly).

**Plain English**: We assume no guessing floor. This is appropriate for placement tests where items are open-response or carefully designed MCQs. For production items with obvious guessing potential (4-choice MCQ), the core IRT module can use 3PL.

**Why c = 0 Here**: Placement test items are selected for diagnostic value, not typical learning. We want pure ability signal without guessing noise.

---

## Placement Item Generation

### Purpose

Generate a set of calibrated items that efficiently diagnose ability across all five linguistic components.

### Strategy

```
For each component (PHON, MORPH, LEX, SYNT, PRAG):
  Generate itemCount items (default: 3)
  Spread difficulties around target theta
    - If targeting B1 (theta = 0): items at -1.5, 0, +1.5
    - This ensures at least one item at appropriate level
  Shuffle all items for mixed presentation
```

**Plain English**: We don't know where the learner is, so we cast a wide net. Some items will be too easy, some too hard, but at least one will be "just right" and maximally informative.

### Item Banks

The service includes sample items for each component at different difficulties:

- **PHON**: Silent letters, phoneme counting
- **MORPH**: Root word identification, morpheme counting
- **LEX**: Synonyms, vocabulary definitions
- **SYNT**: Verb form completion, agreement
- **PRAG**: Appropriate register selection

These are placeholder items. Production systems would draw from a calibrated item bank with known difficulty parameters.

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created shadow documentation for diagnostic-assessment.service.ts
- **Why**: Service is critical for user onboarding and first-session personalization
- **Impact**: Enables understanding of initial ability estimation process

### Implementation Notes

- Service implements its own 2PL probability function (simplified from core IRT module)
- Uses Newton-Raphson MLE following standard psychometric practice
- Prior estimation based on domain-specific research on learner populations
- CEFR mapping based on empirical cutpoints from language testing research
- Component-specific adjustments based on skill acquisition order research
