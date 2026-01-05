# Prisma Database Seed Script

> **Last Updated**: 2026-01-04
> **Code Location**: `prisma/seed.ts`
> **Status**: Active
> **Run Command**: `npm run db:seed`

---

## Context & Purpose

This seed script exists to **bootstrap the LOGOS database with realistic test data** that represents a complete user learning journey. Rather than starting with an empty database during development or testing, this script creates a coherent dataset that exercises all the major data relationships in the system.

**Business Need**: Developers and testers need a working dataset to:
- Verify that the UI displays learning content correctly
- Test the adaptive learning algorithms (IRT, FSRS, PMI) with realistic data
- Debug issues without manually creating test records through the UI
- Demonstrate the application to stakeholders

**The Persona**: The seed data represents a specific, realistic user profile: **a Brazilian nurse preparing for the CELBAN exam** (Canadian English Language Benchmark Assessment for Nurses). This is not arbitrary - it represents LOGOS's primary target market: healthcare professionals who need domain-specific language certification to practice in English-speaking countries.

**When Used**:
- During initial development setup (`npm run db:seed`)
- After database migrations that reset data
- When resetting to a known good state during debugging
- In CI/CD pipelines for integration testing

---

## Data Structures Created

### 1. Test User (Brazilian Nurse Profile)

```
id: 'test-user-1'
nativeLanguage: 'pt-BR' (Brazilian Portuguese)
targetLanguage: 'en-US' (American English)
thetaGlobal: 0 (starting proficiency estimate)
theta[Phonology|Morphology|Lexical|Syntactic|Pragmatic]: 0
```

**Why These Values?**
- **pt-BR to en-US**: This language pair represents significant challenges in pronunciation (Portuguese has different vowel sounds), morphology (different verb conjugation systems), and pragmatics (cultural communication norms)
- **Theta = 0**: The IRT (Item Response Theory) scale centers at 0, representing average ability. A new user starts at the population mean until assessments refine their true ability estimate

### 2. CELBAN Goal Specification

```
id: 'celban-goal-1'
domain: 'medical'
modality: ['reading', 'listening']
genre: 'professional'
purpose: 'certification'
benchmark: 'CELBAN'
deadline: 120 days from now (4 months)
completionPercent: 0
isActive: true
```

**Why CELBAN?**
- The **CELBAN** (Canadian English Language Benchmark Assessment for Nurses) is a standardized test that internationally educated nurses must pass to work in Canada
- It tests language proficiency in healthcare contexts: understanding patient charts, communicating with medical teams, explaining procedures to patients
- The 4-month deadline is realistic for motivated learners preparing for this certification

### 3. Medical Vocabulary (20 Language Objects)

The script creates 20 carefully selected medical terms, each with a **five-element feature vector**:

| Feature | Description | Range | Example (auscultate) |
|---------|-------------|-------|---------------------|
| **frequency** | How common in medical English | 0-1 | 0.35 (rare) |
| **relationalDensity** | Hub score in word network | 0-1 | 0.41 (moderate) |
| **contextualContribution** | Domain specificity | 0-1 | 0.88 (highly medical) |
| **irtDifficulty** | Psychometric difficulty | -2 to +2 | 0.9 (challenging) |
| **definition** | Plain English meaning | text | "To listen to internal body sounds with a stethoscope" |

**Vocabulary Selection Rationale:**

The 20 terms span a difficulty gradient:

**Easier Terms (negative difficulty):**
- *symptom* (-0.7): High frequency, common in everyday speech
- *monitor* (-0.8): Dual-use word, familiar context
- *vital signs* (-0.6): Compound term but highly frequent

**Medium Terms (difficulty near 0):**
- *diagnosis* (-0.4): Common but slightly technical
- *acute* (0.0): Medical meaning differs from everyday use
- *prognosis* (0.2): Less common but guessable from context

**Challenging Terms (positive difficulty):**
- *auscultate* (0.9): Rare, Latin-derived, technical procedure
- *anaphylaxis* (1.2): Low frequency, Greek roots, critical to know
- *contraindication* (0.8): Abstract concept, compound word

**Computed Priority Formula:**
```
priority = frequency * relationalDensity * contextualContribution
```
This multiplicative formula ensures high-priority words are those that are both common AND well-connected AND domain-specific.

### 4. Mastery States (20 Records)

Each vocabulary item receives an initial mastery state:

```
stage: 0 (Unknown - never encountered)
fsrsDifficulty: 5 (neutral starting difficulty on FSRS 1-10 scale)
fsrsStability: 0 (no memory strength yet)
fsrsReps: 0 (no reviews completed)
fsrsLapses: 0 (no forgotten-then-relearned cycles)
fsrsState: 'new' (never scheduled)
cueFreeAccuracy: 0 (no cue-free responses yet)
cueAssistedAccuracy: 0 (no cue-assisted responses yet)
exposureCount: 0 (never seen)
priority: [copied from language object]
```

**Why Initialize to Zero?**

This represents a genuinely new learner who has never interacted with these items. The FSRS algorithm will begin tracking memory strength after the first review. Stage transitions (0→1→2→3→4) will occur as the learner demonstrates increasing mastery.

### 5. Collocations (9 Word Pairs with PMI Scores)

**Collocations** are word combinations that occur together more frequently than chance would predict. The seed creates 9 word pairs:

| Word 1 | Word 2 | PMI | Co-occurrence | Plain English |
|--------|--------|-----|---------------|---------------|
| vital | signs | 4.2 | 3,500 | Almost never appear separately in medical text |
| blood | pressure | 3.9 | 2,800 | Fixed medical phrase |
| heart | rate | 3.7 | 2,400 | Standard vital sign term |
| administer | medication | 2.8 | 1,250 | Common verb-noun pairing |
| chronic | pain | 2.6 | 1,800 | Frequent clinical descriptor |

**PMI (Pointwise Mutual Information)** quantifies how much more likely two words are to appear together than independently:
- PMI > 3: Nearly fixed phrase (vital signs, blood pressure)
- PMI 2-3: Strong collocation (administer medication)
- PMI < 2: Weak association

**Why This Matters for Learning:**

When a learner knows "vital" but not "signs," LOGOS can:
1. Predict they should learn "signs" soon (high PMI suggests co-learning benefit)
2. Generate tasks that present the collocation in context
3. Test productive knowledge: "Complete the phrase: vital ____"

**NPMI Calculation:**
```
npmi = pmi / Math.log(cooccurrence)
```
Normalized PMI accounts for frequency effects, making comparisons fairer across word pairs.

### 6. Sample Session with Theta Snapshot

```
Session:
  mode: 'learning'
  itemsPracticed: 0
  stageTransitions: 0
  fluencyTaskCount: 0
  versatilityTaskCount: 0

ThetaSnapshot:
  thetaGlobal: 0
  theta[all components]: 0
  seGlobal: 1.0 (high uncertainty)
```

**Why Create an Empty Session?**

This represents the user having opened the application but not yet started practicing. The theta snapshot captures the ability estimate at session start:
- **seGlobal = 1.0**: Standard error of 1.0 indicates high uncertainty about the user's true ability
- **theta = 0**: Prior estimate centered at population mean

As the user answers questions, IRT will update theta estimates and reduce the standard error.

---

## Microscale: Direct Relationships

### Dependencies (What This Script Needs)

- **`@prisma/client`**: The generated Prisma client for database operations
- **Database schema** (`prisma/schema.prisma`): Defines the tables and relationships
- **Environment variable** (`DATABASE_URL`): Points to the SQLite database file

### Files This Seeds

| Model | Count | Purpose |
|-------|-------|---------|
| User | 1 | Brazilian nurse preparing for CELBAN |
| GoalSpec | 1 | CELBAN certification with 4-month deadline |
| LanguageObject | 20 | Medical vocabulary with IRT parameters |
| MasteryState | 20 | Initial mastery tracking for each word |
| Collocation | 9 | PMI-weighted word pairs |
| Session | 1 | Empty learning session |
| ThetaSnapshot | 1 | Initial ability estimate |

### Data Flow

```
Script executes
        |
        v
Prisma Client connects to SQLite
        |
        v
User created with 'upsert' (idempotent)
        |
        v
Goal created linked to User
        |
        v
20 LanguageObjects created linked to Goal
        |
        |---> objectMap tracks id mappings
        |
        v
20 MasteryStates created linked to LanguageObjects
        |
        v
9 Collocations created using objectMap lookups
        |
        v
Session created linked to User and Goal
        |
        v
ThetaSnapshot created linked to Session
        |
        v
Summary logged, Prisma disconnects
```

---

## Macroscale: System Integration

### Architectural Role

The seed script sits in the **Development Infrastructure Layer** of LOGOS:

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Renderer (React UI)                        │
├─────────────────────────────────────────────────────┤
│ Layer 2: Main Process (Electron IPC, Services)      │
├─────────────────────────────────────────────────────┤
│ Layer 3: Data Access (Prisma, Repositories)         │
├─────────────────────────────────────────────────────┤
│ Layer 4: Database (SQLite)                          │
├─────────────────────────────────────────────────────┤
│ Development Infrastructure ← [SEED SCRIPT HERE]    │
│ (Migrations, Seeds, Build Tools)                    │
└─────────────────────────────────────────────────────┘
```

While not part of the runtime application, the seed script is **essential infrastructure** that makes development possible.

### Big Picture Impact

**Without the seed script:**
- Developers must manually create test data through the UI (slow, error-prone)
- Integration tests have no baseline data to test against
- Demo environments start empty, requiring setup for every presentation
- Algorithm debugging is difficult without realistic data distributions

**With the seed script:**
- One command creates a complete, realistic dataset
- All team members work with identical test data (reproducible)
- Algorithms can be tested against the specific difficulty distribution
- PMI calculations have actual collocation data to process

### How Seeded Data Exercises the System

| System Component | How Seed Data Tests It |
|------------------|----------------------|
| **IRT Engine** | Vocabulary with difficulty range -0.8 to +1.2 tests full scale |
| **FSRS Scheduler** | New cards test initial scheduling logic |
| **PMI Analyzer** | Collocations with PMI 2.1-4.2 test recommendation system |
| **Stage System** | Stage 0 items test promotion criteria |
| **Goal Progress** | 0% completion tests progress calculation |
| **Session Analytics** | Empty session tests edge case handling |

### Critical Path Analysis

**Importance Level**: Development-Critical (not Runtime-Critical)

- **If seed fails**: Development environment has no test data; manual setup required
- **If seed creates bad data**: Algorithms may appear broken when working correctly
- **If seed is out of sync with schema**: Script crashes, blocking onboarding

**Recovery Strategy**: The script uses `upsert` operations, making it **idempotent** (safe to run multiple times). Running the seed twice will not duplicate data.

---

## Technical Concepts (Plain English)

### Upsert Pattern

**Technical**: A database operation that inserts a new record if it doesn't exist, or does nothing (or updates) if it does exist. Prisma's `upsert` takes `where` (find criteria), `create` (if not found), and `update` (if found) clauses.

**Plain English**: Like checking into a hotel. If you're a new guest, they create a reservation. If you already have one, they just look it up. You never accidentally get two rooms for the same stay.

**Why We Use It**: Allows the seed script to be run multiple times without creating duplicate records. The first run creates data; subsequent runs are no-ops.

### PMI (Pointwise Mutual Information)

**Technical**: A measure from information theory that quantifies how much more (or less) likely two events are to co-occur than if they were independent. Formula: `PMI(x,y) = log(P(x,y) / (P(x) * P(y)))`

**Plain English**: If "blood" and "pressure" appear together way more often than random chance would predict (given how common each word is individually), they have high PMI. It's like noticing that two students always sit together in class - probably not coincidence.

**Why We Use It**: Collocations (word pairs) with high PMI are important to learn together. A learner who knows "blood" should prioritize learning "pressure" because they'll encounter "blood pressure" constantly in medical texts.

### IRT Difficulty Scale

**Technical**: In Item Response Theory, difficulty (b parameter) is measured on a logit scale typically ranging from -3 to +3, centered at 0 (average difficulty). A learner with ability theta = b has a 50% probability of answering correctly.

**Plain English**: Like ski slope ratings. A "0" difficulty word is a blue square - challenging for beginners, easy for experts. A "+1.2" word like "anaphylaxis" is a black diamond - only advanced learners handle it consistently.

**Why We Use It**: The difficulty gradient (-0.8 to +1.2 in seed data) tests the IRT engine's ability to select appropriately challenging items for learners at different ability levels.

### Theta (Ability Estimate)

**Technical**: The latent trait parameter in IRT representing a learner's underlying proficiency. Updated after each response using Bayesian inference. Standard error (SE) decreases as more responses are observed.

**Plain English**: Your "true skill" at medical English. We can't observe it directly, but we estimate it based on which questions you answer correctly. The more questions you answer, the more confident we become in the estimate.

**Why We Use It**: Theta = 0 with SE = 1.0 represents maximum uncertainty - we're assuming the user is average until they prove otherwise. This prior gets refined quickly during the first learning session.

### Idempotent Operations

**Technical**: Operations that produce the same result regardless of how many times they are executed. `f(f(x)) = f(x)`.

**Plain English**: Like pressing an elevator button multiple times - it doesn't call multiple elevators, it just registers that you want to go up. The seed script works the same way: running it 5 times creates the same data as running it once.

**Why We Use It**: Prevents "seed pollution" where re-running the script accidentally creates duplicate users, goals, or vocabulary items. Safe to run during debugging without cleanup.

---

## The Seeded Vocabulary Set

For reference, here are the 20 medical terms created by the seed:

| Term | Difficulty | Frequency | Definition |
|------|------------|-----------|------------|
| administer | -0.5 | 0.89 | To give medication or treatment to a patient |
| assess | -0.3 | 0.91 | To evaluate or judge the condition of a patient |
| contraindication | 0.8 | 0.67 | A condition that makes a treatment inadvisable |
| bilateral | 0.3 | 0.58 | Affecting both sides of the body |
| catheterize | 0.6 | 0.42 | To insert a catheter into the body |
| auscultate | 0.9 | 0.35 | To listen to internal body sounds with a stethoscope |
| prognosis | 0.2 | 0.71 | The likely course of a disease or condition |
| symptom | -0.7 | 0.94 | A physical or mental sign of a condition |
| diagnosis | -0.4 | 0.92 | Identification of a disease from symptoms |
| prescription | -0.2 | 0.88 | A written order for medication |
| triage | 0.5 | 0.65 | Sorting patients by urgency of treatment |
| vital signs | -0.6 | 0.93 | Basic body measurements like pulse and temperature |
| edema | 0.4 | 0.54 | Swelling caused by fluid accumulation |
| hemorrhage | 0.7 | 0.48 | Severe bleeding |
| anaphylaxis | 1.2 | 0.31 | Severe allergic reaction |
| intubate | 0.8 | 0.38 | To insert a tube into the airway |
| monitor | -0.8 | 0.95 | To observe and track patient condition |
| discharge | -0.1 | 0.82 | To release a patient from care |
| chronic | 0.1 | 0.79 | Long-lasting or recurring condition |
| acute | 0.0 | 0.81 | Sudden and severe condition |

---

## Change History

### 2026-01-04 - Documentation Created
- **What Changed**: Initial narrative documentation for Prisma seed script
- **Why**: Establish shadow documentation explaining data seeding strategy
- **Impact**: Future developers understand the purpose and structure of test data

---

*This documentation mirrors: `prisma/seed.ts`*
