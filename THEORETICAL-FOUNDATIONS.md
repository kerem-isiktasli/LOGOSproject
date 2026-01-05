# LOGOS Theoretical Foundations

## Immutable Conceptual Bedrock

This document establishes the **immutable conceptual foundation** that must remain unshaken for any subsequent designs, algorithms, or modules. It is not a feature list or implementation plan, but the theoretical framework governing all LOGOS development.

**Document Hierarchy:**
- This document: WHY (theoretical justification)
- FINAL-SPEC.md: WHAT (functional specification)
- DEVELOPMENT-PROTOCOL.md: HOW (implementation rules)
- REFERENCE-IMPLEMENTATIONS.md: WITH WHAT (verified code sources)

---

# Part 1: Core Identity

## 1.1 What LOGOS Is

LOGOS is neither a test-prep tool, thematic textbook, nor simple AI tutor. It is a **learning control engine that real-time estimates a user's language usage space and designs problems to expand it most efficiently**.

### The Fundamental Redefinition

Traditional view: Language learning = accumulation of vocabulary + grammar + phonology + discourse knowledge

**LOGOS view**: Language learning = **expansion of usage space enabling interpretation and production**

This extends beyond the traditional four functional domains (listening, reading, writing, speaking), delving into the cognitive systems each domain mobilizes:

| Domain | Cognitive Systems Mobilized |
|--------|----------------------------|
| Listening | Speech recognition, phoneme discrimination, short-term auditory memory |
| Reading | Visual decoding, orthographic parsing, inference generation |
| Writing | Real-time composition, motor planning, self-monitoring |
| Speaking | Articulatory planning, prosodic control, real-time retrieval |

### Usage Space Definition

The 'usage space' refers to coordinates across:
- **Specific purposes** (certification, professional communication, academic writing)
- **Specific contexts** (hospital, courtroom, classroom)
- **Specific formats** (reports, conversations, presentations)
- **Specific domains** (medical, legal, technical)

**Learning objective shifts** from "how much knowledge acquired" to **"to what extent can it be applied"**.

**Evaluation shifts** from accuracy rates to **coordinates of achievable usage scopes**.

---

## 1.2 Ontological Redefinition of Language Components

In LOGOS, language components are not traditional subfields (vocabulary, grammar) but **minimal units satisfying three conditions**:

1. **Independent evaluability** of proficiency
2. **Combinability** with other components
3. **Responsibility for specific cognitive loads** in interpretation/production tasks

### The Five Component Types

| Component | Definition | Key Properties |
|-----------|------------|----------------|
| **Phonology-Orthography** | Sound-grapheme mapping, syllable structure, positional constraints | G2P rules, spelling patterns, phonotactics |
| **Morphology** | Affixation, derivation/inflection, morphological inference | Root identification, affix productivity |
| **Lexical** | Semantic scope, collocational affordances, domain usage | Multi-dimensional vectors (see 2.2) |
| **Syntactic-Structural** | Sentence architecture, argument relations, information packaging | Dependency distance, clause embedding |
| **Semantic-Pragmatic-Discourse** | Purposes, formats, audience assumptions, statistical patterns | Register, genre conventions, discourse markers |

### Component Relations

Components connect not through knowledge inclusion hierarchies but via **combinatorial relations of co-invoked cognitive procedures**.

> Key insight: When you process a sentence, you don't activate "vocabulary knowledge" then "grammar knowledge" sequentially. You invoke multiple cognitive procedures simultaneously that span components.

---

# Part 2: Foundational Constructs

## 2.1 The Zipf/FRE Value Axis

All learning objects are positioned on a **Zipf/FRE axis**:

```
Priority = (w_F × F + w_R × R + w_E × E) / Cost
```

| Metric | Full Name | Definition |
|--------|-----------|------------|
| **F** | Frequency | Real-world usage frequency in target corpus |
| **R** | Relational Density | Density of combinations with other components (hub score) |
| **E** | Contextual Contribution | Contribution to context-purpose achievement |

### Three Domains on the Axis

```
HEAD ←──────────────────────────────────────────────────────→ TAIL
High F, High R                                          Low F, Specialized
Core fluency                                            Precision/nuance

┌─────────────┬─────────────────────┬─────────────────────────┐
│    HEAD     │        BODY         │          TAIL           │
│  Domain     │       Domain        │         Domain          │
├─────────────┼─────────────────────┼─────────────────────────┤
│ High-freq   │ Structural hubs     │ Low-freq but pivotal    │
│ High-transfer│ Bridge words       │ Domain-specific         │
│ Core vocab  │ Grammatical anchors │ Technical terms         │
│ ~2000 words │ ~5000 words         │ Goal-dependent          │
└─────────────┴─────────────────────┴─────────────────────────┘
```

**Learning prioritization** is determined not by "difficulty/ease" but by **transfer effects and usage space expansion magnitude**.

---

## 2.2 Words as Multi-Dimensional Vectors

Words are defined not as memorizable items but as **multi-dimensional vectors**:

```typescript
interface LanguageObjectVector {
  // Form Layer
  phonological: {
    phonemes: string[];
    syllableStructure: string;
    stress: number[];
  };
  orthographic: {
    graphemes: string;
    spellingPatterns: string[];
    g2pExceptions: boolean;
  };

  // Structure Layer
  morphological: {
    root: string;
    prefixes: Affix[];
    suffixes: Affix[];
    inflectionParadigm: string;
  };
  syntactic: {
    partOfSpeech: string;
    subcategorization: string[];  // [+transitive], [+ditransitive]
    argumentStructure: string;
  };

  // Meaning Layer
  semantic: {
    semanticField: string;
    abstractionLevel: number;     // 1 (concrete) to 10 (abstract)
    polysemyIndex: number;        // Number of distinct senses
  };
  pragmatic: {
    register: 'formal' | 'neutral' | 'informal';
    domainSpecificity: number;    // 0 (general) to 1 (specialized)
    collocationalProfile: PMIPair[];
  };
}

interface PMIPair {
  coword: string;
  pmi: number;                    // Pointwise Mutual Information
  direction: 'left' | 'right' | 'both';
}
```

### Vector Attributes vs. User Abilities

**Critical distinction:**
- **Vector attributes** = Properties of the language object itself (immutable per corpus)
- **θ parameters** = User's proficiency state for that vector dimension (mutable per learner)

Problem design selects which **vector dimensions to spotlight**, while assessment measures **θ on those dimensions**.

---

## 2.3 The θ (Theta) Concept: Strict Separation

θ represents a statistical variable indicating the **user's proficiency state**, distinct from content or problem attributes.

### Design Principles

| Phase | θ Treatment | Rationale |
|-------|-------------|-----------|
| **Learning** | No immediate θ updates | Allow trial-and-error without judgment anxiety |
| **Training** | Soft θ tracking (internal only) | Adjust difficulty without formal assessment |
| **Evaluation** | Precise IRT-based θ estimation | Maximum discrimination with minimal items |

### Why This Separation Matters

1. **Psychological safety**: Learners can experiment freely during training
2. **Statistical validity**: θ estimation requires controlled conditions
3. **Computational efficiency**: Reduces unnecessary IRT calculations
4. **API cost control**: Limits expensive Claude calls to evaluation phases

### Multi-Dimensional θ (Future State)

```typescript
interface UserProficiencyState {
  // Global estimate
  θ_global: number;              // Overall proficiency (-3 to +3 logits)

  // Component-specific (Phase 2+)
  θ_phonological: number;        // Sound-letter mapping
  θ_morphological: number;       // Word structure recognition
  θ_lexical: number;             // Vocabulary breadth/depth
  θ_syntactic: number;           // Sentence complexity tolerance
  θ_pragmatic: number;           // Context-appropriate selection

  // Confidence intervals
  se_θ: Record<string, number>;  // Standard error per dimension
}
```

---

## 2.4 Fluency vs. Versatility: Dual Engine Architecture

LOGOS distinctly separates two cognitive training modes:

### Fluency Engine

**Goal**: Automate background procedures in high-frequency patterns, reducing cognitive energy.

**Mechanism**: Powered by high-PMI network automation.

```
PMI(W₁, W₂) = log₂ [ P(W₁, W₂) / (P(W₁) × P(W₂)) ]
```

| Characteristic | Description |
|----------------|-------------|
| Target | Head/Body domain items |
| Task type | Time-pressured recall, pattern completion |
| Success metric | Speed + accuracy on high-PMI combinations |
| Coverage | ~80% of actual language use |

### Versatility Engine

**Goal**: Expand application scope across broader usage spaces.

**Mechanism**: Powered by self-construction of low-PMI combinations.

| Characteristic | Description |
|----------------|-------------|
| Target | Body/Tail domain items |
| Task type | Creative production, novel combination |
| Success metric | Grammatical validity + semantic coherence |
| Coverage | Nuance, creativity, specialized expression |

### Why Separate Training

Fluency and Versatility involve **conflicting cognitive strategies**:

| Fluency | Versatility |
|---------|-------------|
| Pattern matching | Pattern breaking |
| Speed prioritized | Deliberation required |
| Automatic retrieval | Conscious construction |
| Risk-averse | Risk-tolerant |

An **adaptive task engine** balances them per learner level:
- Beginners: 80% Fluency / 20% Versatility
- Intermediate: 60% Fluency / 40% Versatility
- Advanced: 40% Fluency / 60% Versatility

---

## 2.5 Cue-Free vs. Cue-Assisted: Cognitive Scaffolding

Outputs from learners are differentiated based on cognitive scaffolding presence:

| Mode | Examples | What It Measures |
|------|----------|------------------|
| **Cue-Free** | Blank input, no hints | True retrieval, combinatorial ability |
| **Cue-Assisted** | Autocomplete, word banks, example sentences | Pattern recognition, short-term performance |

### The Scaffolding Gap

The **gap between cue-assisted and cue-free performance** is a key proficiency indicator:

```typescript
interface ScaffoldingAnalysis {
  objectId: string;
  cueAssistedAccuracy: number;    // e.g., 0.85
  cueFreeAccuracy: number;        // e.g., 0.45
  scaffoldingGap: number;         // 0.40 (high = scaffolding dependent)
  recommendation: 'more_practice' | 'ready_for_advancement';
}
```

**High gap** → Item is scaffolding-dependent; needs more practice before cue removal
**Low gap** → Item is internalized; ready for advancement

---

## 2.6 Pragmatics as Statistical Formal Space

Pragmatics is not a set of rules but a **statistical formal space**:

| Traditional View | LOGOS View |
|------------------|------------|
| "Reports must have introduction, body, conclusion" | "Reports typically exhibit this distribution of discourse markers" |
| "Formal register requires these forms" | "Formal register has this probability distribution over lexical choices" |
| Rule compliance | Positional placement on distributions |

### Properties of Pragmatic Space

1. **Clear centers** but **loose boundaries**
2. **Permits free combinations** of other components
3. **Genre-specific probability distributions**

### Evaluation Approach

Not: "Did you follow the rule?"
But: "Where does your output fall on the distribution?"

```typescript
interface PragmaticEvaluation {
  genre: string;                  // 'medical_report', 'casual_email'
  expectedDistribution: number[]; // Probability vector over features
  actualDistribution: number[];   // Learner's output features
  divergence: number;             // KL divergence from expected
  withinAcceptable: boolean;      // < threshold
}
```

---

# Part 3: The Problem Generation Pipeline

## 3.1 Pipeline Overview

The core of LOGOS is not a curriculum but a **learning control pipeline**. Problems are generated through sequential layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: STATE ANALYSIS                  │
│  User θ + goal-based distance calculation                   │
│  Input: User profile, GoalSpec, activity logs               │
│  Output: Component priority vector                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: FRE PRIORITIZATION              │
│  Zipf/FRE-based component ranking                           │
│  Input: Target corpus, priority vector                      │
│  Output: Ranked learning objects                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 3: VECTOR SELECTION                │
│  Choose which vector dimensions to spotlight                │
│  Input: Learning object, current θ, target benchmark        │
│  Output: Vector dimension focus                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 4: TRANSFER CALCULATION            │
│  Co-invocation effects of simultaneous components           │
│  Input: Target component, co-occurring components           │
│  Output: Adjusted spotlight intensities                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 5: MODALITY & FORMAT               │
│  Combine channels, interpretation/production, formats       │
│  Input: Spotlight config, available content                 │
│  Output: Problem specification                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 6: SCORING STRATEGY                │
│  Determine logging and progress tracking method             │
│  Input: Problem type, evaluation criteria                   │
│  Output: Scoring rubric, logging config                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 7: IRT APPLICATION                 │
│  (Evaluation phase only) Precise θ estimation               │
│  Input: Response data, item parameters                      │
│  Output: Updated θ estimates with confidence                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3.2 Layer Details

### Layer 1: State Analysis

```typescript
interface StateAnalysis {
  currentθ: UserProficiencyState;
  goalSpec: GoalSpec;
  componentDistances: Map<ComponentType, number>;  // Distance to goal θ
  cognitiveLevarageAreas: ComponentType[];         // Max improvement potential
}
```

**Key operation**: Compute distances between target θ and current θ per component, identifying areas with **maximal cognitive leverage**.

### Layer 2: FRE Prioritization

Not "what to learn" but **"which components induce the most cognitive procedure reuse"**.

```typescript
function prioritize(objects: LanguageObject[], state: StateAnalysis): RankedObject[] {
  return objects
    .map(obj => ({
      object: obj,
      priority: computeFRE(obj, state) / computeCost(obj, state)
    }))
    .sort((a, b) => b.priority - a.priority);
}
```

### Layer 3: Vector Selection

Determine **which vector combinations to spotlight** for transitioning from current to next benchmarks.

```typescript
interface VectorSpotlight {
  primary: VectorDimension[];     // Main focus
  secondary: VectorDimension[];   // Background reinforcement
  exclude: VectorDimension[];     // Avoid overwhelming
}
```

### Layer 4: Transfer Calculation

Calculate **transfer/reinforcement effects** of components co-invoked during task execution.

```typescript
interface TransferEffect {
  targetComponent: ComponentType;
  coInvokedComponents: ComponentType[];
  transferMultiplier: number;       // > 1 = positive transfer
  interferenceRisk: number;         // > 0 = potential confusion
}
```

### Layer 5: Modality & Format

Combine along these dimensions:

| Dimension | Options |
|-----------|---------|
| Channel | Auditory, Visual, Mixed |
| Direction | Interpretation, Production |
| Format | Multiple choice, Fill-blank, Free response, Transformation |
| Length | Word, Phrase, Sentence, Paragraph, Discourse |
| Context | Isolated, Contextual, Integrated |

### Layer 6: Scoring Strategy

Different task types require different scoring:

| Task Type | Scoring Method |
|-----------|----------------|
| Recognition | Binary (correct/incorrect) |
| Recall | Partial credit per element |
| Production | Rubric-based (grammar, meaning, pragmatics) |
| Timed | Speed + accuracy composite |

### Layer 7: IRT Application

**Only in evaluation phase**:

```typescript
interface IRTEvaluation {
  responses: Response[];
  itemParameters: ItemParameter[];  // difficulty, discrimination, guessing
  estimatedθ: number;
  standardError: number;
  nextItemSelection: 'fisher_information' | 'kullback_leibler';
}
```

---

## 3.3 Learning → Training → Evaluation Stage Separation

| Stage | θ Treatment | Purpose | Task Design |
|-------|-------------|---------|-------------|
| **Learning** | Suspended | Concept introduction | Exposure, explanation, examples |
| **Training** | Soft tracking | Procedure stabilization | Practice with feedback, trial-error |
| **Evaluation** | IRT estimation | Precise measurement | Optimized for discrimination |

A single task can dual-role by combining **simple exposure with active cognitive manipulation**.

---

# Part 4: Internal vs. External Logic Separation

## 4.1 The MCP Architecture Principle

Core implementation strategy separates:

| Logic Type | Definition | Examples |
|------------|------------|----------|
| **Internal** | Mathematically/statistically self-contained | θ estimation, FRE computation, problem space generation, difficulty functions |
| **External (MCP)** | Content requiring external resources | Corpora, media, real content, Claude API |

### Interface Requirements

Each logic must be:
1. **Refined independently** (can improve without affecting other)
2. **Equipped with clear interfaces** (typed contracts)
3. **Integrated via signal flows** (not tight coupling)

```typescript
// Internal logic: pure functions, no external dependencies
function computePriority(object: LanguageObject, state: UserState): number {
  // Pure computation
}

// External logic: clearly marked, async, fallback-equipped
async function generateTaskContent(spec: TaskSpec): Promise<TaskContent> {
  // Claude API call with caching, retry, offline fallback
}
```

---

# Part 5: Statistical Evaluation Design

## 5.1 Transfer Effect Analysis

### Example 1: Morphological Affixation Training

**Claim**: Training on affixation stabilizes novel word inference abilities.

**Mechanism**:
1. Learn prefix "pre-" means "before" in known words (preview, prepare)
2. Encounter unknown "premonition"
3. Morphological inference procedure activates
4. Meaning partially predicted without explicit learning

**Measurement**:
```typescript
interface TransferMeasurement {
  trainedAffixes: string[];
  novelWordsWithAffixes: string[];
  inferenceAccuracyBefore: number;
  inferenceAccuracyAfter: number;
  transferGain: number;
}
```

### Example 2: Phoneme-Grapheme Training

**Claim**: G2P training reduces cognitive load in subsequent lexical/syntactic learning.

**Mechanism**:
1. Automate sound-letter correspondences
2. Orthographic parsing becomes unconscious
3. Freed cognitive resources available for higher-level processing
4. Vocabulary acquisition rate increases

**Measurement**: Compare vocabulary acquisition rate pre/post G2P mastery.

### Example 3: Syntactic-Domain Structure Pre-automation

**Claim**: Pre-automating genre-specific structures provides cognitive slack for semantic-pragmatic reasoning.

**Mechanism**:
1. Medical report structure becomes automatic (SOAP: Subjective, Objective, Assessment, Plan)
2. Working memory freed from structural planning
3. More resources available for content accuracy and nuance

**Measurement**: Compare content quality scores at matched structural complexity.

---

## 5.2 Problem Type Variables vs. Generation Variables

### Conceptual Separation

| Category | Definition | Examples |
|----------|------------|----------|
| **Problem Type Variables** | Inherent to problem format | Multiple choice vs. free response, interpretation vs. production, scoring method |
| **Generation Variables** | Combinable across pipeline | Target component, vector spotlight, difficulty, context, modality |

### Integration Strategy

```typescript
interface ProblemSpecification {
  // Generation variables (from pipeline)
  targetComponent: ComponentType;
  vectorSpotlight: VectorSpotlight;
  difficultyTarget: number;
  contextRichness: 'isolated' | 'contextual' | 'integrated';
  modality: 'auditory' | 'visual' | 'mixed';

  // Problem type variables (format selection)
  taskFormat: 'recognition' | 'recall' | 'production' | 'transformation';
  responseMode: 'selection' | 'construction';
  scoringMethod: 'binary' | 'partial' | 'rubric';
  timeConstraint: number | null;
}
```

**Design principle**: Generation variables select WHAT to test; problem type variables select HOW to test it.

---

# Part 6: Identified Gaps and Future Considerations

## 6.1 Blank Spots Requiring Further Development

| Gap | Description | Priority |
|-----|-------------|----------|
| **Threshold Detection Algorithm** | Automatic identification of bottleneck sub-skills blocking advancement | High |
| **Cross-Language Transfer Model** | How L1 competencies affect L2 learning cost estimates | Medium |
| **Semantic Stretch Criteria** | Among low-PMI combinations, what qualifies as "creative but permissible"? | Medium |
| **Cue-Free Minimum Baseline** | At what threshold is cue-free performance "usable without assistance"? | High |
| **Genre Distribution Modeling** | Comprehensive probability distributions for pragmatic evaluation | Medium |
| **Multi-Modal Integration** | How to combine text/audio/video in single coherent tasks | Low (Phase 2+) |

## 6.2 Open Research Questions

1. **IRT Model Selection**: 1PL vs 2PL vs 3PL for different component types?
2. **Transfer Decay**: How quickly do transfer effects diminish without reinforcement?
3. **Fluency-Versatility Transition**: When should system shift emphasis?
4. **Scaffolding Removal Timing**: Optimal schedule for reducing cue assistance?

## 6.3 Connections to Strengthen

| From | To | Connection Needed |
|------|------|-------------------|
| PMI computation | Task generation | Algorithm for converting PMI scores to difficulty estimates |
| θ estimation | Learning queue | Real-time priority adjustment based on θ changes |
| Scaffolding gap | Training mode | Automatic mode switching based on gap size |
| Genre distributions | Claude prompts | Template library for genre-appropriate content generation |

---

# Part 7: Mapping to Implementation

## 7.1 MVP Implementation Mapping

| Theoretical Concept | MVP Implementation | Full Implementation |
|---------------------|-------------------|---------------------|
| θ parameters | Single mastery stage (0-4) | Multi-dimensional IRT |
| FRE prioritization | (F + R + C) / Cost formula | Dynamic weight adjustment |
| Fluency engine | High-frequency task selection | PMI-based recall chains |
| Versatility engine | Production tasks at Stage 3-4 | Explicit low-PMI challenges |
| Cue-free separation | hint_level in responses | Differential analysis dashboard |
| Vector spotlighting | Fixed component selection | Dynamic vector weighting |
| Pipeline layers | Simplified 3-layer | Full 7-layer |
| IRT evaluation | Basic difficulty adjustment | Fisher Information item selection |
| Transfer calculation | Manual rules | Learned transfer coefficients |
| Pragmatic evaluation | Claude-based scoring | Distribution-based placement |

## 7.2 Phase Alignment

| Phase | Theoretical Features Activated |
|-------|------------------------------|
| **Phase 1** | Basic state tracking, simplified FRE, single θ |
| **Phase 2** | Component-specific tracking, modality profiles |
| **Phase 3** | Transfer calculations, scaffolding gap analysis |
| **Phase 4** | Full pipeline, IRT evaluation, pragmatic distributions |

---

*Document Version: 2.0*
*Source: Unified theoretical framework consolidation*
*Status: IMMUTABLE CONCEPTUAL FOUNDATION*
*All designs, algorithms, and modules must align with this framework*
