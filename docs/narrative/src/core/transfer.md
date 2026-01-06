# L1-L2 Transfer Coefficient Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/transfer.ts`
> **Status**: Active

---

## Context & Purpose

This module implements the science of **crosslinguistic influence** - how a learner's native language (L1) affects their acquisition of a new language (L2). It exists because language learning is not a blank-slate process; learners carry mental patterns, sounds, and structures from their first language that can either help or hinder their progress.

**Business Need**: LOGOS serves learners from diverse linguistic backgrounds (Spanish speakers learning English, Japanese speakers learning English, etc.). Without accounting for L1 transfer effects, the system would treat all learners identically, missing crucial opportunities to:
- Leverage positive transfer (when L1 patterns help L2 learning)
- Anticipate negative transfer/interference (when L1 patterns cause errors)
- Personalize difficulty estimates for vocabulary and grammar

**When Used**:
- During priority calculation to adjust the "Cost" component of learning items
- When calibrating IRT difficulty for vocabulary based on cognate relationships
- When predicting phonological challenges for pronunciation training
- When the medical domain bonus needs to be applied (Romance language speakers benefit from Latin-derived medical terminology)

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

This module is intentionally **dependency-free** within the codebase - it contains pure functions with no imports from other LOGOS modules. This design choice ensures:
- The transfer calculations remain testable in isolation
- No circular dependency issues with other core modules
- Easy portability if transfer logic needs to be used elsewhere

**External Data**: The module embeds linguistic research data directly:
- `LANGUAGE_FAMILIES`: Maps ISO 639-1 language codes to family classifications
- `ENGLISH_TRANSFER_COEFFICIENTS`: Empirical transfer values for English as L2
- `MEDICAL_DOMAIN_TRANSFER`: Domain-specific cognate bonuses

### Dependents (What Needs This)

- `src/core/priority.ts`: Uses `calculateTransferGain()` to reduce the "Cost" denominator in the Priority = FRE / Cost formula. When transfer gain is high, learning cost decreases, boosting priority.

- `src/main/services/state-priority.service.ts`: Integrates transfer effects when building the learning queue, ensuring items with positive transfer are surfaced appropriately.

- `src/main/services/task-generation.service.ts`: Uses `getPhonologicalDifficultyBonus()` to adjust task difficulty for pronunciation-focused exercises.

- `src/core/content/content-generator.ts` (potential): Could use `isCognate()` to inform hint generation and explanation quality.

### Data Flow

```
User Profile (L1 language code)
    |
    v
getLanguageFamily(l1) --> LanguageFamily classification
    |
    v
getTransferCoefficients(l1, l2) --> TransferCoefficients object
    |                                  (6 linguistic dimensions)
    v
calculateTransferGain(l1, l2, objectType, domain)
    |
    v
Priority Calculation (reduces Cost) --> Learning Queue Order
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithm Layer** of LOGOS's three-tier architecture:

```
Layer 1: Renderer (React UI)
    |
    v
Layer 2: Main Process (IPC handlers, services)
    |
    v
Layer 3: Core Algorithms <-- You are here (src/core/transfer.ts)
    |
    v
Layer 4: Database (Prisma/SQLite)
```

Within the Core layer, transfer.ts connects to the **Priority System** subgraph:

```
[FRE Metrics] ----+
                  |
                  v
              priority.ts ---> Learning Queue
                  ^
                  |
[Transfer] -------+  (adjusts Cost factor)
```

### Big Picture Impact

The transfer module enables **personalized learning paths** based on linguistic background. This is one of LOGOS's differentiating features compared to generic language learning apps.

**Without this module**, the system would:
- Treat a Spanish speaker and a Japanese speaker identically when learning English
- Miss the opportunity to prioritize cognates for Romance language speakers
- Fail to warn about syntactic interference (SOV vs SVO word order conflicts)
- Over-estimate difficulty for items where positive transfer applies
- Under-estimate difficulty where negative transfer causes persistent errors

**System Dependencies**:
- **Priority Calculation**: The Cost factor in `Priority = FRE / Cost` directly incorporates transfer gain
- **IRT Difficulty Adjustment**: `calculateTransferAdjustedDifficulty()` modifies item difficulty parameters
- **Medical Domain Specialization**: Romance language speakers get a cognate bonus for Latin-derived medical terms, directly supporting the CELBAN (Canadian nursing certification) use case

### Critical Path Analysis

**Importance Level**: Medium-High

This module is not on the critical path for basic app functionality (LOGOS works without it), but it is essential for:
- Personalized learning efficiency (30-50% estimated impact on optimal item ordering)
- Medical domain effectiveness (40% cognate bonus for Romance speakers)
- Accurate difficulty prediction for diverse learner populations

**Failure Mode**: If this module fails or returns incorrect values:
- Learning priority would be suboptimal but not catastrophic
- Difficulty estimates would be less accurate
- The app would function, but learning efficiency would decrease

---

## Technical Concepts (Plain English)

### Transfer Coefficient

**Technical**: A numerical value between -1 and +1 representing the degree to which native language patterns transfer to target language learning. Positive values indicate facilitative transfer; negative values indicate interference.

**Plain English**: Think of it like learning to drive in a new country. If you learned in the UK (left-side driving) and move to the US (right-side), you have "negative transfer" - your old habits work against you. If you learned in Canada and move to the US, you have "positive transfer" - same side of the road, easy adjustment. The transfer coefficient measures how much your old language habits help or hurt with the new language.

**Why We Use It**: To predict which vocabulary, grammar patterns, and sounds will be easy or hard for specific learner populations, enabling smarter item prioritization.

### Language Family Classification

**Technical**: A taxonomic grouping of languages based on historical descent from common ancestors (e.g., Germanic, Romance, Slavic, Sino-Tibetan).

**Plain English**: Languages are like biological families - English, German, and Dutch are linguistic "siblings" descended from the same ancestor (Proto-Germanic). Spanish, French, and Italian are another sibling group (Romance languages from Latin). Knowing which "family" a language belongs to helps predict how similar its patterns are to other languages.

**Why We Use It**: Languages in the same family share vocabulary roots, grammar structures, and sound systems. This lets us estimate transfer effects even when we don't have specific research data for a particular language pair.

### Cognate

**Technical**: A word in two languages that shares a common etymological origin and often similar form, such as English "telephone" and Spanish "telefono".

**Plain English**: Cognates are "free vocabulary" - words that look or sound similar across languages because they share the same historical root. Spanish speakers learning English already know hundreds of words like "hospital", "doctor", "family" because they're nearly identical in both languages.

**Why We Use It**: The `isCognate()` function helps identify vocabulary that learners may already recognize, reducing the effective learning cost and enabling the system to prioritize truly new vocabulary over cognates.

### Phonological Transfer

**Technical**: The influence of native language sound inventory and phonotactic constraints on target language pronunciation.

**Plain English**: Your mouth is trained to make certain sounds from your native language. Japanese has no "L" vs "R" distinction, so Japanese speakers often struggle with this in English. German speakers are good at the "ch" sound because they have it in their language. Phonological transfer captures which sounds will be easy or hard based on what sounds your native language uses.

**Why We Use It**: To adjust difficulty scores for pronunciation tasks and predict common mispronunciation patterns.

### Syntactic Transfer

**Technical**: The influence of native language word order (e.g., Subject-Verb-Object vs Subject-Object-Verb) and grammatical structures on target language production.

**Plain English**: Languages put words in different orders. English uses Subject-Verb-Object ("I eat pizza"), while Japanese uses Subject-Object-Verb ("I pizza eat"). When learning a new language, your brain wants to use the word order it's used to, causing errors. Negative syntactic transfer means your native word order conflicts with the target language.

**Why We Use It**: To identify learners who will struggle with English word order (like Japanese and Korean speakers) and prioritize syntactic pattern practice for them.

### Logit Scale (for Transfer Modifier)

**Technical**: A mathematical scale where 0 represents average difficulty, positive values represent harder items, and negative values represent easier items. One logit unit represents a meaningful difference in difficulty.

**Plain English**: Instead of saying an item is "hard" or "easy" (subjective), we use a number scale centered on 0. A value of +1 means the item is one "difficulty unit" above average; -1 means one unit below. The transfer modifier adjusts this number up or down based on how much your native language helps or hurts.

**Why We Use It**: The transfer modifier (calculated as `-transfer * 0.5` logits) directly adjusts IRT difficulty parameters, integrating with the psychometric foundation of LOGOS.

### Medical Domain Transfer Bonus

**Technical**: An additional positive transfer coefficient applied to lexical items in the medical domain, reflecting the high proportion of Latin and Greek-derived terminology in medical English.

**Plain English**: Medical vocabulary is special because so much of it comes from Latin and Greek roots. Words like "cardiovascular", "hypertension", and "pulmonary" are nearly identical in English, Spanish, French, and Italian. Romance language speakers get a "head start" on medical vocabulary that speakers of Chinese or Arabic don't have.

**Why We Use It**: LOGOS specifically targets healthcare professionals (CELBAN certification). This bonus ensures Spanish, French, Portuguese, and Italian speakers are correctly prioritized toward learning truly unfamiliar medical terms rather than wasting time on cognates they already recognize.

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Initial narrative documentation for transfer module
- **Why**: Shadow documentation system implementation
- **Impact**: Enables understanding of L1-L2 transfer system for all team members

### Initial Implementation - Module Created
- **What Changed**: Created complete L1-L2 transfer coefficient system with:
  - Language family classification for 40+ languages
  - Six-dimension transfer coefficients (phonological, orthographic, morphological, lexical, syntactic, pragmatic)
  - English-specific transfer tables based on SLA research
  - Medical domain bonuses for Romance language speakers
  - Cognate detection heuristics
- **Why**: Personalized learning requires accounting for how native language affects L2 acquisition
- **Impact**: Enables differential treatment of learners from different linguistic backgrounds, improving learning efficiency by prioritizing items where transfer helps and scaffolding items where transfer interferes

---

## Academic Foundations

This module is grounded in peer-reviewed second language acquisition (SLA) research:

- **Jarvis, S. & Pavlenko, A. (2008)**: *Crosslinguistic Influence in Language and Cognition* - Theoretical framework for understanding transfer effects across linguistic domains
- **Ringbom, H. (2007)**: *Cross-linguistic Similarity in Foreign Language Learning* - Empirical data on cognate recognition and transfer facilitation
- **Odlin, T. (1989)**: *Language Transfer: Cross-linguistic influence in language learning* - Foundational text on negative and positive transfer phenomena

The coefficient values in `ENGLISH_TRANSFER_COEFFICIENTS` are empirically-derived estimates synthesized from this research literature, adapted for computational implementation.
