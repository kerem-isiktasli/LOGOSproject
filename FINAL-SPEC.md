# LOGOS: Final Specification

## A Learning Control Engine for Language Usage Space Expansion

---

# Part 1: What LOGOS Is (For Humans)

## The Elevator Pitch

LOGOS is a desktop language learning application that asks you one question first: **"What do you actually need this language for?"**

Unlike Duolingo (gamified but generic) or textbooks (comprehensive but unfocused), LOGOS works backwards from your real-world goal. Whether you're a nurse preparing for a licensing exam, a lawyer reading international contracts, or a traveler wanting to navigate airports — LOGOS builds a learning path that teaches *exactly* what you need, in the order that matters most, at the pace your brain can handle.

## The Fundamental Shift

**Traditional view**: Language learning = accumulating vocabulary + grammar knowledge

**LOGOS view**: Language learning = **expanding your usage space** — the coordinates where you can actually use language effectively

This means LOGOS measures not "how much you know" but **"where can you now operate."**

---

## A Day in the Life: Maria's Story

**Maria** is a Brazilian nurse moving to Canada. She needs to pass the CELBAN (Canadian English Language Benchmark Assessment for Nurses) in 4 months.

### First Launch: The Goal Interview

When Maria opens LOGOS for the first time, she sees a friendly onboarding screen:

> "Welcome to LOGOS. Let's figure out exactly what you need."

She can either:
- **Click through dropdowns** (structured path): Domain → Medicine, Modality → Reading + Listening, Purpose → Certification, Benchmark → CELBAN
- **Type naturally**: "I'm a nurse from Brazil, I need to pass CELBAN in 4 months to work in Toronto"

Either way, LOGOS creates her **GoalSpec** — a precise blueprint that guides everything that follows.

### The Dashboard: Her Learning Command Center

Maria's dashboard shows:

```
┌─────────────────────────────────────────────────────────────┐
│  MARIA'S CELBAN PREPARATION                                 │
│  ═══════════════════════════════════════════════════════════│
│                                                             │
│  TODAY'S FOCUS                          MASTERY OVERVIEW    │
│  ┌─────────────────────┐                ┌────────────────┐  │
│  │ 📚 "Contraindication"│               │ ████████░░ 78% │  │
│  │ High priority: You'll │              │ Medical Terms  │  │
│  │ see this 47x in your  │              │                │  │
│  │ target texts          │              │ ██████░░░░ 62% │  │
│  └─────────────────────┘                │ Patient Comm.  │  │
│                                         │                │  │
│  LEARNING QUEUE (sorted by efficiency)  │ ████░░░░░░ 41% │  │
│  1. "administer" - hub word, unlocks 12 │ Procedures     │  │
│  2. "assess" - appears in 89% of docs   └────────────────┘  │
│  3. "bilateral" - coming up in tomorrow's test             │
│                                                             │
│  [Start Today's Session - 25 min]                          │
└─────────────────────────────────────────────────────────────┘
```

### A Training Session: The Gym

Maria clicks "Start Session." LOGOS presents exercises tailored to her current level:

**Exercise 1: Recognition** (she's never seen "contraindication")
> The nurse noted a **___** to penicillin in the patient's chart.
>
> A) contraindication  B) prescription  C) diagnosis  D) symptom

She picks A. Correct! The word moves from Stage 0 (Unknown) to Stage 1 (Recognition).

**Exercise 2: Cued Recall** (she's seen "administer" before)
> Complete: The physician ordered the nurse to a_______ the medication.

She types "administer." Correct! Moving toward Stage 2 (Recall).

**Exercise 3: Production** (she's practiced "bilateral" multiple times)
> Write a sentence using "bilateral" in a nursing context.

She writes: "The patient presented with bilateral swelling in the lower extremities."

LOGOS analyzes: correct usage, appropriate context, proper grammar. Stage 3 achieved.

### The Adaptive Hint System

When Maria hesitates on "contraindication," a liquid gauge appears:

```
[░░░░░░░░░░] Thinking...
[████░░░░░░] Here's the first letter: C
[████████░░] "Contra-" means "against"
[██████████] It's something that goes against a treatment
```

The longer she thinks, the more help appears — but using hints affects her mastery score.

**Why this matters**: LOGOS tracks "cue-assisted" vs "cue-free" performance separately. Maria might score 85% with hints but only 45% without — that **scaffolding gap** tells LOGOS she needs more practice before the knowledge is truly internalized.

### The Lexical Network: Seeing Connections

Maria opens the Network view and sees "administer" in a web of relationships:

```
                    ┌──────────┐
                    │ MEDICAL  │
                    │ CONTEXT  │
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────┴────┐     ┌─────┴─────┐    ┌─────┴─────┐
   │ inject  │     │ ADMINISTER│    │ prescribe │
   └─────────┘     └─────┬─────┘    └───────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
      ┌────┴────┐  ┌─────┴─────┐  ┌────┴────┐
      │ dosage  │  │ medication│  │ patient │
      └─────────┘  └───────────┘  └─────────┘
```

She sees why LOGOS prioritized "administer" — it's a **hub word** connected to 12 other terms she needs.

### End of Session: The Summary

```
┌─────────────────────────────────────────────────────────────┐
│  SESSION COMPLETE                                           │
│  ═══════════════════════════════════════════════════════════│
│                                                             │
│  ⏱  Duration: 27 minutes                                   │
│  📝 Items practiced: 18                                     │
│  ✓  Mastery transitions: 4 words advanced                  │
│  ⚠  Bottleneck detected: Procedure verbs (42% accuracy)    │
│  📊 Session type: 70% Fluency / 30% Versatility            │
│                                                             │
│  NEXT SESSION PREVIEW:                                      │
│  - Review: "contraindication" (due for spaced repetition)  │
│  - New: "catheterize" (high frequency in CELBAN)           │
│  - Focus area: Procedure verbs (addressing bottleneck)     │
│                                                             │
│  [View Detailed Analytics]  [Schedule Next Session]         │
└─────────────────────────────────────────────────────────────┘
```

### Four Months Later

Maria opens her analytics:

```
CELBAN READINESS: 94%

Vocabulary Coverage: 97% of CELBAN corpus
Reading Comprehension: Stage 4 (Automatic)
Listening: Stage 3 (Controlled Production)
Speaking: Stage 3 (Controlled Production)
Writing: Stage 2 (Recall)

Recommended: 2 more weeks focusing on Writing production
```

She passes the CELBAN with a score of 10/12 on her first attempt.

---

# Part 2: How LOGOS Works (Technical Flow)

## The Core Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                               │
│         "I need to pass CELBAN in 4 months"                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GOALSPEC CREATION                           │
│  Domain: Medicine, Modality: Reading+Listening, Purpose: Cert  │
│  Benchmark: CELBAN, Deadline: 4 months, Stakes: High           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CORPUS SELECTION                             │
│  Cloud NLP API queries for CELBAN-relevant texts               │
│  Sources: Medical journals, nursing guidelines, CELBAN samples │
│  Result: 2M tokens of domain-specific English                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LANGUAGE OBJECT EXTRACTION                    │
│  LEX: 3,847 vocabulary items (words, phrases, medical terms)   │
│  MORPH: 156 morphological patterns (-tion, -ize, pre-, post-) │
│  G2P: 89 spelling-pronunciation rules                          │
│  SYNT: 234 grammar constructions (passive voice, conditionals) │
│  PRAG: 45 discourse patterns (patient handoff, charting)       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    METRIC COMPUTATION                           │
│  For each object, calculate:                                   │
│  F = Frequency (how often in target texts)                     │
│  R = Relational Density (hub score, connections)               │
│  E = Contextual Contribution (meaning importance)              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRIORITY CALCULATION                         │
│                                                                 │
│  Priority = (w_F × F + w_R × R + w_E × E) / Cost               │
│                                                                 │
│  Cost = BaseDifficulty - TransferGain + ExposureNeed           │
│  (adjusted for Maria's Portuguese L1 and current state)        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEARNING QUEUE                               │
│  Sorted list: highest (importance/cost) ratio first            │
│  1. administer (F=0.89, R=0.76, C=0.82, Cost=0.3) → Score=8.2 │
│  2. assess (F=0.91, R=0.68, C=0.79, Cost=0.35) → Score=6.8    │
│  3. contraindication (F=0.67, R=0.45, C=0.91, Cost=0.6) → 3.4 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TASK GENERATION                              │
│  Based on current mastery stage:                               │
│  Stage 0→1: Multiple choice (recognition)                      │
│  Stage 1→2: Cloze/fill-in-blank (cued recall)                  │
│  Stage 2→3: Free production (controlled)                       │
│  Stage 3→4: Timed exercises (automaticity)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                             │
│  Maria completes exercises, LOGOS records:                     │
│  - Accuracy (correct/incorrect)                                │
│  - Response time (latency)                                     │
│  - Hint usage                                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STATE UPDATE                                 │
│  IRT-based difficulty adjustment                               │
│  Mastery stage transitions                                     │
│  Spaced repetition scheduling                                  │
│  Priority queue re-sorting                                     │
└─────────────────────────┴───────────────────────────────────────┘
                          │
                          ▼
                    [LOOP BACK TO TASK GENERATION]
```

---

# Part 3: The Five Mastery Stages

LOGOS doesn't treat knowledge as "known" or "unknown." Instead, every item progresses through five stages:

| Stage | Name | What It Means | How LOGOS Tests It |
|-------|------|---------------|-------------------|
| 0 | **Unknown** | Never encountered | N/A - introduce with flashcard |
| 1 | **Recognition** | Can identify when seen | Multiple choice: "Which means X?" |
| 2 | **Recall** | Can retrieve when cued | Fill-in-blank: "The nurse a_____ed the dose" |
| 3 | **Controlled Production** | Can use with effort | Write a sentence using this word |
| 4 | **Automaticity** | Can use fluently, fast | Timed production under pressure |

**Decay Model**: Knowledge decays over time. Stage 4 might drop to Stage 3 after 2 weeks without practice. LOGOS schedules reviews to prevent this.

---

# Part 4: Technical Architecture

## Desktop Application (Electron)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                       │
│  - Window management                                           │
│  - Local SQLite database                                       │
│  - File system access                                          │
│  - IPC communication                                           │
└─────────────────────────────────────────────────────────────────┘
        │                                              │
        ▼                                              ▼
┌───────────────────┐                    ┌───────────────────────┐
│  RENDERER PROCESS │                    │   CLOUD NLP SERVICE   │
│  (React Frontend) │◄──── Internet ────►│   (API Backend)       │
│  - Dashboard UI   │                    │   - Corpus analysis   │
│  - Training gym   │                    │   - Object extraction │
│  - Network graph  │                    │   - Task generation   │
│  - Analytics      │                    │   - Content queries   │
└───────────────────┘                    └───────────────────────┘
```

## Data Flow

```
LOCAL (Offline Capable)          CLOUD (Requires Internet)
─────────────────────────        ─────────────────────────
• User profile                   • Initial corpus processing
• GoalSpec                       • Language object extraction
• Learning history               • Content generation
• Mastery states                 • Metric computation
• Session records                • Task template expansion
• Spaced repetition queue        • Advanced NLP analysis
```

## Database Schema (SQLite)

```sql
-- Core user goal
CREATE TABLE goal_specs (
  id TEXT PRIMARY KEY,
  domain TEXT,           -- Medicine, Law, Business...
  modality TEXT,         -- Reading, Writing, Speaking, Listening
  genre TEXT,            -- Regulatory, Procedural, Conversational...
  purpose TEXT,          -- Certification, Professional, Academic...
  benchmark TEXT,        -- CELBAN, IELTS, TOEFL...
  deadline DATE,
  created_at TIMESTAMP
);

-- Language objects (vocabulary, grammar, etc.)
CREATE TABLE language_objects (
  id TEXT PRIMARY KEY,
  type TEXT,             -- LEX, MORPH, G2P, SYNT, PRAG
  content TEXT,          -- The actual word/pattern/rule
  frequency REAL,        -- F metric
  relational_density REAL, -- R metric
  contextual_contrib REAL, -- C metric
  goal_id TEXT REFERENCES goal_specs(id)
);

-- User mastery state per object
CREATE TABLE mastery_states (
  object_id TEXT REFERENCES language_objects(id),
  stage INTEGER,         -- 0-4
  confidence REAL,       -- 0-1
  last_exposure TIMESTAMP,
  exposure_count INTEGER,
  decay_rate REAL,
  next_review TIMESTAMP
);

-- Session history
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  items_practiced INTEGER,
  stage_transitions INTEGER
);

-- Individual responses
CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  object_id TEXT REFERENCES language_objects(id),
  task_type TEXT,        -- recognition, recall, production, timed
  correct BOOLEAN,
  response_time_ms INTEGER,
  hint_level INTEGER
);
```

---

# Part 5: Agent Orchestration for Development

Building LOGOS will activate your specialized agents:

| Agent | Role in LOGOS Development |
|-------|--------------------------|
| **frontend-specialist** | React UI: Dashboard, Training Gym, Network Graph, Onboarding |
| **api-specialist** | FastAPI backend: NLP orchestration, content generation endpoints |
| **database-specialist** | SQLite schema, migrations, query optimization |
| **documentation-specialist** | Shadow documentation for every code file |
| **security-specialist** | API key protection, input validation, data privacy |
| **debug-git-specialist** | Clean commit history, debugging workflows |
| **mcp-specialist** | External service integration (NLP APIs) |
| **meta-agent-builder** | Create additional agents if needed |
| **agent-optimizer** | Ensure agents work efficiently together |

## Development Phases with Agent Activation

```
PHASE 1: Foundation
├── database-specialist → Create SQLite schemas
├── api-specialist → Basic FastAPI structure
├── frontend-specialist → Electron + React scaffold
├── documentation-specialist → Initial docs structure
└── security-specialist → Secure credential storage

PHASE 2: Core Engine
├── api-specialist → NLP integration endpoints
├── database-specialist → Object storage, mastery tracking
├── mcp-specialist → Cloud NLP service connection
└── documentation-specialist → API documentation

PHASE 3: Learning System
├── frontend-specialist → Training gym UI
├── api-specialist → Task generation logic
├── database-specialist → Spaced repetition queries
└── documentation-specialist → User guides

PHASE 4: Polish & Package
├── frontend-specialist → Analytics, Network graph
├── debug-git-specialist → Clean release commits
├── security-specialist → Final security audit
└── documentation-specialist → Complete all shadow docs
```

---

# Part 6: Key Differentiators

## What Makes LOGOS Different

| Feature | Duolingo | Anki | Textbooks | LOGOS |
|---------|----------|------|-----------|-------|
| Goal-driven | ❌ Generic | ❌ User creates | ❌ Author decides | ✅ Your goal |
| Adaptive difficulty | ⚠️ Basic | ❌ Manual | ❌ Fixed | ✅ IRT-based |
| Mastery stages | ❌ Binary | ❌ Binary | ❌ None | ✅ 5 stages |
| Priority ranking | ❌ Arbitrary | ❌ User decides | ❌ Sequential | ✅ F×R×C/Cost |
| Domain-specific | ❌ General | ⚠️ If you build it | ⚠️ Limited topics | ✅ Any domain |
| Offline capable | ⚠️ Limited | ✅ Full | ✅ Full | ✅ Full |
| Spaced repetition | ⚠️ Hidden | ✅ Core feature | ❌ None | ✅ Integrated |

---

# Part 7: Success Criteria

LOGOS is successful when:

1. **Goal Completion**: Users achieve their stated language goals (pass exams, perform job tasks)
2. **Efficiency**: Users spend less time reaching proficiency than alternatives
3. **Retention**: Knowledge persists (Stage 4 items stay at Stage 4)
4. **Engagement**: Users complete sessions without abandonment
5. **Accuracy**: Priority predictions match actual learning outcomes

---

# Appendix: Glossary

| Term | Definition |
|------|------------|
| **GoalSpec** | The structured representation of a user's language learning goal |
| **Language Object** | Any learnable unit: word, phrase, pattern, rule, or structure |
| **Usage Space** | The coordinates (purpose, context, format, domain) where language can be effectively used |
| **F (Frequency)** | How often an object appears in goal-relevant texts |
| **R (Relational Density)** | How connected an object is to other language knowledge |
| **E (Contextual Contribution)** | How much meaning depends on knowing this object |
| **Cost** | Estimated effort for this user to learn this object |
| **Priority** | (F + R + E) / Cost — determines learning order |
| **θ (Theta)** | Statistical variable representing user's proficiency state |
| **IRT** | Item Response Theory — psychometric model for adaptive testing |
| **Mastery Stage** | 0-4 scale from Unknown to Automatic |
| **Spaced Repetition** | Scheduling reviews at optimal intervals to prevent forgetting |
| **Fluency Engine** | Training mode for automating high-frequency patterns (high-PMI combinations) |
| **Versatility Engine** | Training mode for creative extension with low-frequency combinations |
| **Scaffolding Gap** | Difference between cue-assisted and cue-free performance |
| **PMI** | Pointwise Mutual Information — measures word co-occurrence strength |

---

---

# Appendix: Related Documents

| Document | Purpose |
|----------|---------|
| **DEVELOPMENT-PROTOCOL.md** | Build rules, architecture, agent coordination |
| **REFERENCE-IMPLEMENTATIONS.md** | GitHub sources, npm packages, verified code |
| **THEORETICAL-FOUNDATIONS.md** | Academic grounding, future enhancement concepts |
| **ALGORITHMIC-FOUNDATIONS.md** | Complete mathematical/statistical implementations (IRT, PMI, FSRS, LLM prompts) |
| **GAPS-AND-CONNECTIONS.md** | Implementation gaps tracking, connection status |
| **AGENT-MANIFEST.md** | Agent coordination, coherence rules, bottleneck detection |

---

*Document Version: 1.2*
*Updated: 2026-01-04*
*For: LOGOS Desktop Application Development*
*Aligned with: THEORETICAL-FOUNDATIONS.md v2.0, ALGORITHMIC-FOUNDATIONS.md v1.0*
