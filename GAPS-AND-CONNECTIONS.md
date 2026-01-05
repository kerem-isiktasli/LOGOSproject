# LOGOS: Identified Gaps and Required Connections

## Purpose

This document tracks theoretical gaps, missing algorithmic connections, and areas requiring further development before or during implementation.

---

## Priority 1: High (Required for MVP)

### Gap 1.1: Threshold Detection Algorithm

**Problem**: How to automatically identify which sub-skill is the bottleneck blocking overall advancement.

**Example**: Maria scores 85% on vocabulary but only 30% on procedure verbs. Is "procedure verbs" a vocabulary problem, a morphology problem, or a syntactic problem?

**Current State**: Not specified in theory.

**Required**: Algorithm that:
1. Analyzes error patterns across component types
2. Identifies the minimal blocking skill
3. Generates targeted remediation tasks

**Connection Needed**:
```
Error Patterns → Component Analysis → Bottleneck ID → Task Generation
```

**Proposed Approach**: Track co-occurrence of errors. If errors on "administer," "catheterize," "assess" cluster together AND share morphological pattern (verb + medical suffix), flag morphology as bottleneck.

---

### Gap 1.2: Cue-Free Minimum Baseline

**Problem**: At what threshold is cue-free performance "usable without assistance"?

**Example**: Maria scores 75% cue-free on "contraindication." Is this good enough?

**Current State**: No threshold defined.

**Required**:
- Minimum acceptable cue-free accuracy per mastery stage
- Context-dependent thresholds (certification exam vs. casual use)

**Proposed Thresholds**:

| Stage | Minimum Cue-Free Accuracy | Rationale |
|-------|--------------------------|-----------|
| Stage 2 (Recall) | 60% | Can retrieve more often than not |
| Stage 3 (Controlled) | 75% | Reliable under effort |
| Stage 4 (Automatic) | 90% | Near-perfect under pressure |

---

### Gap 1.3: PMI → Difficulty Conversion

**Problem**: How to convert PMI scores to task difficulty estimates.

**Example**: PMI("administer", "medication") = 8.5. What difficulty should a fill-in-blank task for this pair be?

**Current State**: PMI defined theoretically, no mapping to difficulty.

**Required**: Function mapping PMI to expected difficulty:
```typescript
function pmiToDifficulty(pmi: number, taskType: TaskType): number {
  // High PMI = easier (more predictable)
  // Low PMI = harder (less predictable)
  const baseDifficulty = 1 - normalize(pmi, PMI_MIN, PMI_MAX);
  return adjustForTaskType(baseDifficulty, taskType);
}
```

---

## Priority 2: Medium (Required for Phase 2-3)

### Gap 2.1: Cross-Language Transfer Model

**Problem**: How L1 competencies affect L2 learning cost estimates.

**Example**: Maria's Portuguese L1 shares Romance roots with English medical terminology. How much does this reduce her learning cost for "contraindication"?

**Current State**: Cost formula mentions "TransferGain" but no calculation method.

**Required**: L1-L2 transfer coefficient matrix:
```typescript
interface TransferCoefficient {
  l1: Language;
  l2: Language;
  componentType: ComponentType;
  coefficient: number;  // 0 (no transfer) to 1 (full transfer)
}

// Example
{ l1: 'Portuguese', l2: 'English', componentType: 'Lexical', coefficient: 0.6 }
{ l1: 'Portuguese', l2: 'English', componentType: 'Phonological', coefficient: 0.3 }
```

---

### Gap 2.2: Fluency-Versatility Transition Logic

**Problem**: When should system shift emphasis from fluency to versatility?

**Current State**: Fixed ratios by level (80/20, 60/40, 40/60) mentioned but no trigger logic.

**Required**: Transition triggers:
```typescript
function shouldShiftToVersatility(state: UserState): boolean {
  // Trigger when:
  // 1. Head domain coverage > 80%
  // 2. Fluency speed metric > threshold
  // 3. Production tasks showing plateaued improvement
  return (
    state.headDomainCoverage > 0.8 &&
    state.fluencySpeedPercentile > 0.7 &&
    state.productionImprovementRate < 0.02
  );
}
```

---

### Gap 2.3: Genre Distribution Modeling

**Problem**: Need comprehensive probability distributions for pragmatic evaluation.

**Example**: What's the expected distribution of discourse markers in a "nursing handoff report"?

**Current State**: Pragmatics defined as "statistical formal space" but no actual distributions.

**Required**: Genre templates with feature distributions:
```typescript
interface GenreDistribution {
  genre: string;
  features: {
    discourseMarkers: ProbabilityVector;
    registerLevel: ProbabilityVector;
    sentenceComplexity: ProbabilityVector;
    technicalTermDensity: number;
  };
  acceptableDeviation: number;  // KL divergence threshold
}
```

**Acquisition Method**: Extract from corpus analysis during goal processing (Claude API task).

---

### Gap 2.4: Scaffolding Removal Schedule

**Problem**: Optimal schedule for reducing cue assistance over time.

**Current State**: Scaffolding gap tracked but no removal strategy.

**Required**: Progressive cue reduction algorithm:
```typescript
function determineCueLevel(object: LanguageObject, history: ResponseHistory): CueLevel {
  const gap = history.cueAssistedAccuracy - history.cueFreeAccuracy;
  const attempts = history.cueFreeAttempts;

  if (gap < 0.1 && attempts > 3) return CueLevel.NONE;
  if (gap < 0.2 && attempts > 2) return CueLevel.MINIMAL;
  if (gap < 0.3) return CueLevel.MODERATE;
  return CueLevel.FULL;
}
```

---

## Priority 3: Low (Phase 4 or Post-MVP)

### Gap 3.1: Multi-Modal Integration

**Problem**: How to combine text/audio/video in single coherent tasks.

**Current State**: Modalities listed separately.

**Required for Phase 4**: Multi-modal task templates.

---

### Gap 3.2: Transfer Decay Modeling

**Problem**: How quickly transfer effects diminish without reinforcement.

**Current State**: No decay model for transfer.

**Required**: Decay function for transfer gains:
```typescript
function transferDecay(initialGain: number, daysSinceReinforcement: number): number {
  // Exponential decay with slower rate than item-specific memory
  return initialGain * Math.exp(-daysSinceReinforcement / TRANSFER_HALFLIFE);
}
```

---

### Gap 3.3: IRT Model Selection per Component

**Problem**: Should different component types use different IRT models (1PL, 2PL, 3PL)?

**Current State**: Generic IRT mentioned.

**Proposed Resolution**:
| Component | IRT Model | Rationale |
|-----------|-----------|-----------|
| Phonology | 1PL | Discrimination relatively constant |
| Lexical | 2PL | Items vary in discrimination |
| Syntactic | 2PL | Structure complexity varies |
| Pragmatic | 3PL | Guessing factor significant |

---

## Required Connections (Cross-Document Links)

### Connection A: PMI Computation → Task Generation

**From**: THEORETICAL-FOUNDATIONS.md (Section 2.1)
**To**: Task generation algorithm

**Missing Link**: How Claude API extracts PMI values from corpus.

**Proposed Implementation**:
```typescript
// Prompt template for PMI extraction
const pmiPrompt = `
Analyze the following text and identify word pairs with high co-occurrence.
For each pair, estimate PMI on a scale of 0-10 where:
- 0-2: Words rarely appear together
- 3-5: Moderate co-occurrence
- 6-8: Frequently co-occur
- 9-10: Almost always co-occur (collocations/idioms)

Return as JSON: { pairs: [{ word1, word2, pmi, context }] }
`;
```

---

### Connection B: θ Estimation → Learning Queue

**From**: THEORETICAL-FOUNDATIONS.md (Section 2.3)
**To**: Priority queue sorting

**Missing Link**: Real-time priority adjustment when θ changes.

**Proposed Implementation**:
```typescript
// After θ update, recalculate priorities for affected items
async function onThetaUpdate(newTheta: ThetaState) {
  const affectedObjects = await db.languageObjects.findMany({
    where: { goalId: newTheta.goalId }
  });

  for (const obj of affectedObjects) {
    const newPriority = computePriority(obj, newTheta);
    await db.masteryStates.update({
      where: { objectId: obj.id },
      data: { priority: newPriority }
    });
  }

  await rebuildLearningQueue(newTheta.goalId);
}
```

---

### Connection C: Scaffolding Gap → Training Mode

**From**: THEORETICAL-FOUNDATIONS.md (Section 2.5)
**To**: Task type selection

**Missing Link**: Automatic mode switching based on gap size.

**Proposed Implementation**:
```typescript
function selectTrainingMode(object: LanguageObject, gap: number): TrainingMode {
  if (gap > 0.4) return TrainingMode.FLUENCY_FOCUS;  // Need more automation
  if (gap > 0.2) return TrainingMode.BALANCED;
  return TrainingMode.VERSATILITY_FOCUS;  // Ready for creative extension
}
```

---

### Connection D: Genre Distributions → Claude Prompts

**From**: THEORETICAL-FOUNDATIONS.md (Section 2.6)
**To**: Content generation prompts

**Missing Link**: Template library for genre-appropriate content generation.

**Proposed Implementation**: Genre-specific prompt templates:
```typescript
const genrePrompts: Record<string, string> = {
  'medical_report': `Generate a nursing progress note using SOAP format...`,
  'patient_handoff': `Generate a shift handoff report following SBAR...`,
  'casual_conversation': `Generate a dialogue between colleagues...`,
};
```

---

## Implementation Tracking

| Gap ID | Description | Priority | Phase | Status | Reference |
|--------|-------------|----------|-------|--------|-----------|
| 1.1 | Threshold Detection | High | 1 | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 7 |
| 1.2 | Cue-Free Baseline | High | 1 | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 3.2 |
| 1.3 | PMI → Difficulty | High | 1 | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 2.2 |
| 2.1 | L1-L2 Transfer | Medium | 2 | Proposed | Requires language-pair data collection |
| 2.2 | Fluency-Versatility Transition | Medium | 2 | Proposed | See Gap 2.2 above |
| 2.3 | Genre Distributions | Medium | 3 | Proposed | LLM extraction during goal setup |
| 2.4 | Scaffolding Removal | Medium | 2 | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 3.2 |
| 3.1 | Multi-Modal Integration | Low | 4 | Not Started | Phase 4 feature |
| 3.2 | Transfer Decay | Low | 4 | Proposed | See Gap 3.2 above |
| 3.3 | IRT Model Selection | Low | 4 | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 1.1 |

## Connection Implementation Tracking

| Connection | From → To | Status | Reference |
|------------|-----------|--------|-----------|
| A | PMI → Task Generation | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 2, Part 5 |
| B | θ Estimation → Learning Queue | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 1.2, Part 4.2 |
| C | Scaffolding Gap → Training Mode | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 3.2 |
| D | Genre Distributions → Claude Prompts | **COMPLETE** | ALGORITHMIC-FOUNDATIONS.md Part 5.1 |

---

## Remaining Implementation Tasks

### Phase 1 MVP - All Core Algorithms Complete ✓
- IRT mathematics (1PL, 2PL, 3PL models)
- θ estimation (MLE, EAP)
- PMI computation and difficulty mapping
- FSRS spaced repetition integration
- Database schema with optimized queries
- LLM prompt templates
- Bottleneck detection algorithm

### Phase 2-3 - Requires Data Collection
- L1-L2 transfer coefficients (requires multi-language user data)
- Genre distribution extraction (requires corpus analysis pipeline)
- Fluency-versatility transition tuning (requires user behavior data)

### Phase 4 - Future Enhancement
- Multi-modal task integration
- Transfer decay modeling
- Advanced IRT calibration with live data

---

*Document Version: 1.1*
*Updated: 2026-01-04*
*Purpose: Track implementation gaps and required algorithmic connections*
*Related: ALGORITHMIC-FOUNDATIONS.md provides complete implementations*
