# Stage Thresholds Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/stage-thresholds.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to define and manage the **criteria for when learners advance through mastery stages** in LOGOS. It solves a critical challenge in adaptive learning: how do you decide when someone has truly "learned" something well enough to move to the next level?

**Business/User Need**: Language learners need to progress through skill levels (from "never seen this word" to "use it automatically like a native speaker") in a way that feels fair, is scientifically grounded, and adapts to their individual learning pace. Without proper thresholds, learners either advance too quickly (leading to forgotten knowledge) or too slowly (causing frustration and dropout).

**When Used**: This module is consulted every time a learner completes a practice task. The system checks if their performance metrics now meet the thresholds required to advance to the next mastery stage. It is also used during A/B testing to experiment with different threshold configurations to find optimal learning parameters.

---

## The Problem It Solves

Language mastery is not binary (you either know a word or you do not). LOGOS models proficiency as a 5-stage progression:

| Stage | Name | What It Means |
|-------|------|---------------|
| 0 | New/Unknown | Never encountered this item |
| 1 | Recognition | Can identify with hints/cues |
| 2 | Recall | Can remember with effort |
| 3 | Controlled Production | Can produce with focus |
| 4 | Automatic | Fluent, fast, cue-free access |

The challenge is: **what numbers define "good enough" to advance?** Should someone need 75% accuracy or 90%? Should they maintain that accuracy for 7 days or 30 days? This module provides configurable, validated answers to these questions.

---

## Core Concepts (Technical + Plain English)

### Stage Thresholds

**Technical**: A `StageThresholds` interface containing numeric parameters that define minimum performance requirements for each mastery stage transition.

**Plain English**: Think of stage thresholds like the requirements for earning a belt in martial arts. You need to demonstrate certain skills at certain consistency levels before you can advance. These thresholds define exactly what "demonstrate" and "consistency" mean in numbers.

**Why We Use It**: Without explicit thresholds, stage transitions would be arbitrary or inconsistent. Thresholds provide scientific rigor backed by skill acquisition research (Anderson, 1982; DeKeyser, 2007).

### Cue-Free vs Cue-Assisted Accuracy

**Technical**: Two separate accuracy metrics tracking performance without scaffolding (`cueFreeAccuracy`) versus performance with hints, partial answers, or contextual cues (`cueAssistedAccuracy`).

**Plain English**: Imagine learning to ride a bicycle. Cue-assisted accuracy is like riding with training wheels - you can do it with help. Cue-free accuracy is riding without any assistance. True mastery (Stage 4) requires high cue-free accuracy AND a small gap between the two scores, proving you do not depend on the training wheels anymore.

**Why We Use It**: The gap between these metrics reveals **scaffolding dependency** - whether learners can perform independently or still need help. Stage 4 (Automatic) specifically requires this gap to be below a threshold (default: 10%).

### Stability

**Technical**: A time-based metric measured in days, representing how long a learner has maintained performance above threshold levels.

**Plain English**: Like checking if a new employee can perform well not just on their first day, but consistently over weeks. Stability ensures knowledge is not fleeting.

**Why We Use It**: Memory research shows that short-term success does not guarantee long-term retention. Stability requirements (7 days for Stage 3, 30 days for Stage 4) ensure durable learning.

### A/B Testing Infrastructure

**Technical**: A system of `ABTest`, `ABTestGroup`, and `TestAssignment` types with deterministic user hashing for consistent group assignment and metrics collection for analysis.

**Plain English**: Like a pharmaceutical trial where some patients get the new medicine and others get a placebo, A/B testing lets LOGOS try different threshold configurations with different user groups to scientifically determine which thresholds produce the best learning outcomes.

**Why We Use It**: The "optimal" thresholds are not known with certainty. A/B testing enables empirical validation - does requiring 90% accuracy produce better 30-day retention than requiring 85%? This system lets us find out.

### Threshold Registry

**Technical**: A singleton class (`ThresholdRegistry`) that maintains a runtime cache of configurations, manages A/B test assignments, and logs stage transition events for metrics analysis.

**Plain English**: The registry is like a librarian who keeps track of all the different threshold "recipes," knows which users are in which experiment group, and writes down every time someone advances a level so researchers can analyze the data later.

**Why We Use It**: Centralizes threshold management, enabling runtime switching between configurations without code changes.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/core/types.ts`: `MasteryStage`, `StageThresholds`, `CueLevel` - The foundational type definitions this module builds upon. Provides the numeric stage type (0-4), the threshold interface structure, and cue level definitions.

### Dependents (What Needs This)

- **Scoring/Update Service** (`src/main/services/scoring-update.service.ts`): While this service currently defines its own local `STAGE_THRESHOLDS` constant, it implements stage transition logic that should ideally consume the configurable thresholds from this module. This represents a future integration point.

- **Learning Session Flow**: Any component that needs to check if a learner should advance stages will call `checkStageTransition()` from this module.

- **Analytics/Research Tools**: The transition logging and metrics functions (`logTransition`, `getTransitionMetrics`, `exportTransitionLog`) are designed for data export to research analysis pipelines.

### Data Flow

```
User completes task
       |
       v
Get user's threshold config (via thresholdRegistry.getConfigForUser)
       |
       v
[A/B test check: is user in an experiment? → assign to group → get group's config]
       |
       v
checkStageTransition(currentStage, metrics, config)
       |
       v
Compare metrics against config.thresholds
       |
       v
Return: { newStage, transitioned, reason }
       |
       v
[If transitioned: logTransition() for metrics collection]
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithm Layer** of LOGOS's three-tier architecture:

- **Layer 1 (Presentation)**: React UI components that display mastery stages and progress bars
- **Layer 2 (Core Algorithms)**: **This module** - Pure logic for determining stage transitions
- **Layer 3 (Data/Services)**: Database repositories that persist mastery states, Electron IPC handlers

The module is **framework-agnostic** - it contains no Electron, React, or database code. It exports pure functions that can be called from any context.

### Big Picture Impact

The stage threshold system is fundamental to LOGOS's **adaptive learning engine**. It determines:

1. **Learning Pace**: Stricter thresholds = slower but more thorough progression. Lenient thresholds = faster but potentially shallower learning.

2. **User Experience**: Stage transitions are "achievement moments" that provide psychological rewards. Thresholds that are too hard cause frustration; too easy causes disengagement.

3. **Scientific Validity**: LOGOS claims to be research-backed. The A/B testing infrastructure allows empirical validation of learning outcomes, enabling publication-quality research.

4. **Personalization**: Different configurations (conservative, aggressive, research) allow tailoring to different user needs and contexts.

### Critical Path Analysis

**Importance Level**: High

**If This Fails**:
- Stage transitions become impossible or random
- Users cannot progress through mastery stages
- A/B tests produce invalid data
- Learning progression metrics become meaningless

**Failure Modes**:
- Invalid thresholds (e.g., Stage 3 requirements higher than Stage 4) - Prevented by `validateThresholds()`
- A/B test group proportions do not sum to 1 - Prevented by validation in `registerABTest()`
- User assigned to non-existent configuration - Prevented by config existence checks

**Recovery**:
- Falls back to built-in 'default' configuration if custom config is invalid
- Maintains 10,000-event log limit to prevent memory exhaustion

---

## Pre-Defined Configurations

The module provides four built-in threshold configurations, each designed for different learning contexts:

### Default Configuration
The production standard, balancing rigor with achievability. Based on skill acquisition theory (Anderson, Segalowitz).

| Parameter | Value | Meaning |
|-----------|-------|---------|
| stage4CueFreeAccuracy | 90% | Must get 9/10 correct without help |
| stage4Stability | 30 days | Must maintain performance for a month |
| stage4MaxGap | 10% | Cue-assisted can only be 10% better than cue-free |

### Conservative Configuration
For users who want thorough mastery before advancement (e.g., medical professionals learning terminology).

- Stage 4 accuracy: 95%
- Stage 4 stability: 45 days
- All thresholds raised by ~10%

### Aggressive Configuration
For quick learners or time-pressured contexts (e.g., tourist learning survival phrases).

- Stage 4 accuracy: 85%
- Stage 4 stability: 21 days
- All thresholds lowered to enable faster progression

### Research Configuration
Strictest criteria for academic studies where statistical validity is paramount.

- Stage 4 accuracy: 95%
- Stage 4 stability: 60 days
- Ensures clear separation between mastery stages for research analysis

---

## Key Functions Explained

### checkStageTransition()

**What it does**: Given a learner's current stage and performance metrics, determines if they should advance (or remain at their current stage).

**How it works**:
1. Retrieves thresholds for the current stage
2. For each stage transition (0→1, 1→2, 2→3, 3→4), checks specific criteria:
   - Stage 0→1: Can recognize with cues (50% cue-assisted accuracy)
   - Stage 1→2: Starting to recall without cues (60% cue-free OR 80% cue-assisted)
   - Stage 2→3: Consistent cue-free performance (75% cue-free + 7-day stability)
   - Stage 3→4: True mastery (90% cue-free + 30-day stability + <10% scaffolding gap)
3. Returns the new stage and a human-readable reason for the decision

### calculateStageProgress()

**What it does**: Shows how far a learner is toward the next stage transition.

**Plain English**: Like a progress bar that fills up as you get closer to the next level. Also lists specific "blockers" - the requirements you have not met yet.

### getRecommendedCueLevel()

**What it does**: Suggests how much scaffolding/help to provide based on the gap between cue-free and cue-assisted accuracy.

**Plain English**: If someone does much better with hints than without, the system recommends giving more hints. As the gap closes, hints are progressively removed (like taking off training wheels gradually).

---

## Academic Foundations

This module's design is grounded in peer-reviewed research:

- **Anderson, J.R. (1982)**: Acquisition of cognitive skill - Framework for skill stages from declarative to procedural knowledge

- **DeKeyser, R.M. (2007)**: Skill acquisition theory - Application to second language learning, supporting the 5-stage mastery model

- **Segalowitz, N. (2010)**: Cognitive Bases of Second Language Fluency - Research on automaticity and the importance of measuring cue-free performance

The stability requirements and accuracy thresholds are empirically calibrated based on memory research showing that spaced repetition over weeks (not days) produces durable retention.

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Initial narrative documentation
- **Why**: Shadow documentation system implementation
- **Impact**: Enables understanding of module purpose for new developers and non-technical stakeholders

### Initial Implementation
- **What Changed**: Complete module with threshold configurations, A/B testing infrastructure, registry pattern, and transition logic
- **Why**: Support configurable, empirically-validated mastery stage progression
- **Impact**: Enables the entire adaptive learning system to make scientifically-grounded decisions about learner advancement
