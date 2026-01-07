# Usage Space Tracking Service

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/usage-space-tracking.service.ts`
> **Status**: Active

---

## Context & Purpose

This module tracks the "usage space" of language objects - the specific contexts in which a learner has successfully demonstrated their knowledge. It exists because **knowing a word in one context does not guarantee knowing it in all contexts**.

**The Core Problem It Solves**:

When a learner knows the word "administer" in a casual conversation, can they also use it correctly in a formal medical report? Traditional vocabulary tracking answers only "Does the learner know this word?" but LOGOS asks the deeper question: "In which contexts can the learner *actually use* this word?"

**Business/User Need**:

Language learners preparing for domain-specific certifications (like CELBAN for nurses) need to prove competency not just in general vocabulary, but specifically in the professional contexts they will encounter. A nurse must be able to use medical terminology in patient consultations, chart documentation, and colleague handoffs - three very different contexts. This service tracks progress across all target contexts and identifies gaps before the learner reaches their certification exam.

**When Used**:

1. **After every task completion**: `recordUsageEvent()` is called to log whether the learner successfully used a word/pattern in a specific context
2. **When generating new tasks**: `selectTaskContext()` chooses which context to practice next based on coverage gaps
3. **When displaying goal progress**: `calculateUsageSpaceProgress()` computes overall readiness across all target contexts
4. **When the learner retrieves their profile**: `getObjectUsageSpace()` provides detailed context coverage for any language object

---

## Theoretical Foundation

This service implements three foundational cognitive science principles:

### Transfer of Learning (Thorndike, 1901; Singley & Anderson, 1989)

**Technical**: Skills learned in one context transfer to similar contexts based on shared "identical elements" between the learning and application environments.

**Plain English**: If you learn to ride a bicycle, you can probably ride a similar bicycle, but riding a unicycle requires additional learning because it shares fewer elements. Similarly, using "administer medication" in a patient context transfers more easily to "administer treatment" than to "administer a company."

**Why We Use It**: The service calculates **context similarity** based on shared features (domain, register, modality). High similarity between contexts means successful usage in one predicts readiness for the other.

### Situated Learning (Lave & Wenger, 1991)

**Technical**: Knowledge is fundamentally tied to the activity, context, and culture in which it was learned and used.

**Plain English**: Learning medical terminology from flashcards in a quiet room is different from using that terminology while standing at a hospital bed. The context is part of the knowledge itself, not just a backdrop.

**Why We Use It**: Rather than treating "known" as binary, the service tracks *where* knowledge has been demonstrated. A word isn't truly learned until it's been successfully used in all relevant target contexts.

### Context-Dependent Memory (Godden & Baddeley, 1975)

**Technical**: Memory retrieval is enhanced when the retrieval context matches the encoding context.

**Plain English**: In the famous underwater study, divers who learned words underwater recalled them better underwater than on land. Your brain links memories to where they were formed.

**Why We Use It**: By tracking which contexts a learner has practiced in, the system can deliberately expose them to new contexts while their knowledge is still fresh from similar contexts, maximizing transfer.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/main/db/prisma.ts`: `getPrisma()` - Retrieves the database client for querying language objects and goals
- `src/core/types.ts`: Type definitions including:
  - `ComponentCode` - The five linguistic components (PHON, MORPH, LEX, SYNT, PRAG)
  - `UsageContext` - Structure for domain/register/modality combinations
  - `ObjectUsageSpace` - Tracks successful and attempted contexts per object
  - `UsageSpaceExpansion` - Records when an object is first used successfully in a new context
  - `UsageSpaceProgress` - Aggregated progress metrics for a goal
  - `TaskType` - Types of learning tasks (production, recall, etc.)

### Dependents (What Needs This)

- `src/main/services/task-composition.service.ts`:
  - Imports `selectTaskContext()` to choose appropriate context when composing multi-object tasks
  - Imports `getObjectUsageSpace()` to retrieve current coverage when calculating economic value of objects
  - Imports `UsageEvent` type for recording usage after task completion

### Data Flow

```
Task Completion
      |
      v
recordUsageEvent()
      |
      +--> Check if new context
      |
      +--> Update successful/attempted contexts
      |
      +--> Recalculate coverage ratio
      |
      +--> Identify expansion candidates
      |
      +--> If expansion occurred, record event
      |
      v
Return: { recorded, expansion, newCoverage }
```

```
Task Generation
      |
      v
selectTaskContext()
      |
      +--> Filter contexts applicable to task type
      |
      +--> Score each context by:
      |    - Is it a target context?
      |    - Is it already mastered?
      |    - Is learner ready for expansion?
      |
      v
Return: Optimal UsageContext
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits in the **Application Services Layer** of LOGOS's three-tier architecture:

- **Layer 1: Renderer Process** (React UI)
  - Displays coverage progress visualizations
  - Shows context-specific readiness indicators
- **Layer 2: Main Process Services** (This module)
  - Tracks usage space state
  - Calculates expansion readiness
  - Selects task contexts
- **Layer 3: Database** (Prisma/SQLite)
  - Stores language objects and their relationships
  - Persists usage history (via placeholder functions)

### Big Picture Impact

This module is the **coverage tracking engine** that transforms LOGOS from a simple flashcard app into a context-aware learning system. It enables:

1. **Targeted Practice**: Instead of random vocabulary review, learners practice specifically in contexts where they have gaps
2. **Real Readiness Assessment**: Progress toward goals is measured by actual demonstrated ability across relevant contexts, not just raw vocabulary counts
3. **Efficient Expansion**: The system knows when a learner is ready to try a word in a new context (based on success in similar contexts) versus when more practice is needed
4. **Certification Preparation**: For domain-specific tests like CELBAN, the service ensures coverage of all required professional contexts

### System Dependencies

**Importance Level**: High (Core Feature)

The usage space tracking concept is fundamental to LOGOS's differentiated value proposition. Without it:

- **Task composition** would select contexts randomly, reducing learning efficiency
- **Goal progress** would revert to simple mastery counts, missing context-specific gaps
- **Expansion detection** would not exist - the system couldn't celebrate or track contextual growth
- **Certification readiness** would be a guess rather than a measured state

**Failure Mode**: If this service fails:
- Tasks still generate but with suboptimal context selection
- Progress displays show overall mastery but not context coverage
- Learners may have false confidence about readiness for specific contexts

---

## Technical Concepts (Plain English)

### Usage Context

**Technical**: A combination of domain (medical, academic, personal), register (formal, informal, technical), and modality (spoken, written) that defines a specific communication situation.

**Plain English**: Think of it as an "environment" for language use. "Chatting with friends" is one context; "writing a medical chart" is another. The same word ("critical") might be used differently in each.

**Why We Use It**: By defining discrete contexts, we can track and measure coverage across them, ensuring learners can use language in all situations they'll encounter.

### Coverage Ratio

**Technical**: The proportion of target contexts in which a language object has been successfully used, calculated as `successfulContexts.filter(inTargetSet).length / targetContexts.length`.

**Plain English**: If you need to know a word in 4 different contexts for your goal, and you've demonstrated it successfully in 2, your coverage ratio is 50%. The service tracks this per-object and aggregates it per-component and per-goal.

**Why We Use It**: Coverage ratio is the key metric that answers "How ready is this learner for their goal?" It goes beyond simple "know/don't know" to measure practical, contextualized competency.

### Expansion Event

**Technical**: A recorded occurrence when a language object is successfully used (score >= 0.6) in a context where it has never been successfully used before.

**Plain English**: The moment of "level up" - when a learner proves they can use a word in a new situation. Like unlocking a new area in a game, expansion events mark genuine growth in contextual ability.

**Why We Use It**: Expansion events are milestones worth celebrating and tracking. They show the learner's "vocabulary frontier" is expanding, not just deepening.

### Context Similarity

**Technical**: A Jaccard-like coefficient measuring the proportion of shared features (domain, register, modality) between two contexts, used to predict transfer readiness.

**Plain English**: How "alike" are two contexts? Medical-written-technical and medical-written-formal share more features than medical-written-technical and personal-spoken-informal. Higher similarity means skills transfer more easily.

**Why We Use It**: When deciding if a learner is ready to try a new context, the system checks: "Have they succeeded in similar contexts?" High similarity to successful contexts predicts higher readiness for the new one.

### Expansion Candidates

**Technical**: Target contexts not yet mastered, ranked by readiness score (based on similarity to successful contexts and prior attempt performance).

**Plain English**: A prioritized list of "next contexts to try" for each language object. The system ranks them by how likely the learner is to succeed, so we challenge them optimally - not too easy (boring) and not too hard (frustrating).

**Why We Use It**: Drives intelligent task context selection. Instead of randomly picking contexts, the system chooses ones where the learner is primed for success but still growing.

### CEFR-Based Domains

**Technical**: The service's standard contexts are based on the Common European Framework of Reference for Languages, which defines personal, professional, academic, and public domains.

**Plain English**: CEFR is the international standard for describing language ability. By aligning contexts with CEFR domains, LOGOS's progress tracking maps to recognized benchmarks that employers and institutions understand.

**Why We Use It**: Provides a principled, research-backed organization of contexts rather than ad-hoc categories. Makes LOGOS's progress metrics meaningful in academic and professional settings.

---

## Key Functions Overview

### recordUsageEvent(event: UsageEvent)

Records when a learner uses a language object in a task. Determines if this is a new context, updates the usage space, recalculates coverage, and detects expansion events. Returns whether an expansion occurred and the new coverage ratio.

### getObjectUsageSpace(objectId: string)

Retrieves the complete usage space for a language object, including successful contexts, attempted contexts, target contexts (based on the learner's goal domain), current coverage ratio, and expansion candidates ranked by readiness.

### calculateUsageSpaceProgress(goalId: string)

Computes aggregate progress across all language objects for a goal. Groups coverage by linguistic component, identifies critical gaps (objects with <50% coverage), calculates overall weighted readiness, and generates prioritized recommendations for focus areas.

### selectTaskContext(usageSpaces: ObjectUsageSpace[], taskType: TaskType, preferExpansion: boolean)

Chooses the optimal context for a task. Filters contexts applicable to the task type, then scores each by target relevance, mastery status, and expansion readiness. When `preferExpansion` is true, prioritizes contexts where the learner is ready to expand.

---

## Standard Contexts Reference

The service defines 10 pre-built contexts organized by CEFR domains:

| Context ID | Name | Domain | Register | Modality |
|------------|------|--------|----------|----------|
| personal-spoken-informal | Casual Conversation | personal | informal | spoken |
| personal-written-informal | Personal Messages | personal | informal | written |
| professional-spoken-formal | Professional Meetings | professional | formal | spoken |
| professional-written-formal | Business Correspondence | professional | formal | written |
| professional-written-technical | Technical Documentation | professional | technical | written |
| medical-spoken-consultative | Patient Interaction | medical | consultative | spoken |
| medical-written-technical | Medical Documentation | medical | technical | written |
| medical-spoken-collegial | Colleague Communication | medical | consultative | spoken |
| academic-written-formal | Academic Writing | academic | formal | written |
| academic-spoken-formal | Academic Presentation | academic | formal | spoken |

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created narrative documentation following Shadow Map methodology
- **Why**: Established foundational documentation for the usage space tracking system
- **Impact**: Enables future developers to understand the why, not just the what, of context-aware learning tracking

### Initial Implementation (Prior)

- **What Changed**: Created usage space tracking service with core functions
- **Why**: LOGOS needed a way to track not just *if* words are known, but *where* they can be used
- **Impact**: Enables context-aware task selection, coverage-based progress tracking, and expansion detection - differentiating LOGOS from simple flashcard systems
