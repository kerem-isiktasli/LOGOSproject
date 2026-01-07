# AI-Powered Onboarding Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/onboarding-ai.ts`
> **Status**: Active

---

## Context & Purpose

This module transforms the chaotic, personal, and often inarticulate way humans describe their language learning goals into structured, actionable learning plans. It exists because the gap between "I need to learn English for nursing in Canada" and a precisely configured learning system is enormous -- and bridging that gap traditionally requires either extensive questionnaires (exhausting for users) or human intervention (expensive and unscalable).

**Business Need**: Language learners arrive at LOGOS with goals in their heads, not spreadsheets. A Philippine-trained nurse targeting CELBAN certification thinks "I need to pass the nursing English exam in 6 months to work in Canada." She doesn't think "domain: medical, modality: [reading, listening, speaking, writing], benchmark: CELBAN, deadline: 2026-07-06." This module performs that translation automatically, minimizing the cognitive burden on users during their first interaction with the system.

**When Used**:
- During initial onboarding when a user describes their learning goal in free text
- When the system needs to generate clarifying questions for ambiguous goals
- When creating a structured onboarding flow with cognitive load management
- When suggesting corpus sources based on parsed goal specifications
- As an intermediate layer between raw user input and the database models (GoalSpec)

---

## Academic Foundations

### Cognitive Load Theory (Sweller, 1988)

**Technical**: Cognitive Load Theory distinguishes three types of cognitive load: intrinsic (inherent complexity), extraneous (caused by poor design), and germane (contributing to learning). The module minimizes extraneous load by reducing the number and complexity of decisions users must make during onboarding.

**Plain English**: Your brain has limited processing power. If we ask you 20 questions during onboarding, you'll be mentally exhausted before you even start learning. This module extracts as much as possible from a single free-text sentence, then only asks follow-up questions for genuinely missing information.

**Why We Use It**: First impressions matter. An exhausting onboarding process leads to abandonment. By parsing natural language goals intelligently, we reduce the "paperwork" users endure before reaching the actual learning experience.

### Hick's Law

**Technical**: Hick's Law states that decision time increases logarithmically with the number of choices: RT = a + b * log2(n+1). The module enforces a maximum of 4 choices per step to keep decision time manageable.

**Plain English**: When you're at a restaurant with a 50-page menu, ordering takes forever. When there are 4 options, you decide quickly. We apply the same principle: each onboarding step offers at most 4 choices, reducing decision paralysis.

**Why We Use It**: The constant `MAX_CHOICES_PER_STEP = 4` directly implements Hick's Law. The `estimateCognitiveLoad()` function uses `Math.log2(1 + numChoices)` to quantify how burdensome each step is, allowing the system to optimize the overall flow.

### Progressive Disclosure

**Technical**: Progressive disclosure is a UX pattern where information and options are revealed gradually, showing only what's relevant at each stage. The module implements this through conditional clarifying questions and step dependencies.

**Plain English**: We don't dump every possible option on you at once. First, tell us your goal. Then, if we couldn't figure out your domain, we ask. If we couldn't figure out your timeline, we ask. Each question builds on the previous answer.

**Why We Use It**: The `generateClarifyingQuestions()` function only generates questions for missing or low-confidence entities. If a user says "CELBAN exam in 3 months," we already know the domain (medical), benchmark (CELBAN), and timeline (3 months) -- so we skip those questions entirely.

---

## Key Types

### NaturalLanguageGoal

**What it represents**: The raw, unprocessed input from a user describing their learning objective.

```typescript
interface NaturalLanguageGoal {
  rawText: string;         // "I want to pass IELTS for medical school"
  userLanguage: string;    // UI language: "en", "pt", "ja"
  targetLanguage: string;  // Language being learned: "en"
}
```

**Plain English**: This is exactly what the user typed or spoke into the goal input field. No interpretation, no structure -- just their words in their language.

### ParsedGoal

**What it represents**: The structured interpretation of a user's natural language goal, ready for database storage and system configuration.

```typescript
interface ParsedGoal {
  domain: string;              // "medical", "business", "academic", "general"
  modalities: GoalModality[];  // ["reading", "listening", "speaking", "writing"]
  genre: string;               // "clinical", "research", "nursing"
  purpose: string;             // "certification:IELTS", "professional", "personal"
  benchmark?: string;          // "IELTS", "CELBAN", "TOEFL"
  deadline?: Date;             // When the user needs to achieve the goal
  confidence: number;          // 0-1: How certain is the parsing?
  extractedEntities: ExtractedEntity[];  // What was found and where
  originalText: string;        // Preserved for reference/debugging
}
```

**Plain English**: This is the "translated" version of the user's goal. "I need to pass CELBAN for nursing in Canada by June" becomes: domain=medical, benchmark=CELBAN, purpose=certification:CELBAN, deadline=2026-06-01. The confidence score tells us how sure we are about this interpretation.

### OnboardingStep

**What it represents**: A single interaction point in the onboarding wizard, with metadata about its cognitive demands and dependencies.

```typescript
interface OnboardingStep {
  id: string;                    // "clarify_domain", "target_language"
  type: 'choice' | 'text' | 'confirmation' | 'assessment';
  content: StepContent;          // Question, options, examples
  cognitiveLoad: CognitiveLoadLevel;  // "low", "medium", "high"
  required: boolean;             // Must complete to proceed?
  dependsOn?: string[];          // Steps that must complete first
}
```

**Plain English**: Each step is like a page in a wizard. It knows what question to ask, what kind of answer to expect (multiple choice? free text?), how mentally demanding it is, and whether you can skip it.

### OnboardingFlow

**What it represents**: The complete orchestration of all onboarding steps, tracking progress and collecting responses.

```typescript
interface OnboardingFlow {
  id: string;                           // Unique flow identifier
  steps: OnboardingStep[];              // All steps in order
  currentStep: number;                  // Where the user is now
  responses: Record<string, string | string[]>;  // Collected answers
  estimatedTime: number;                // Total seconds expected
  overallLoad: CognitiveLoadLevel;      // Aggregate cognitive demand
}
```

**Plain English**: This is the "game state" of onboarding. It knows all the steps, where you are, what you've answered so far, and how long the whole process should take.

---

## Core Functions

### parseNaturalLanguageGoal(input: NaturalLanguageGoal): ParsedGoal

**What it does**: Takes a user's free-form goal description and extracts structured information using pattern matching and keyword recognition.

**Processing Pipeline**:
1. Normalize text to lowercase for matching
2. Extract domain from domain keywords (medical, legal, business, academic, general)
3. Extract benchmark from exam keywords (CELBAN, IELTS, TOEFL, etc.)
4. Extract modalities from skill keywords (reading, writing, listening, speaking)
5. Extract deadline from temporal patterns (in 3 months, by June, next year)
6. Infer domain from benchmark if not directly mentioned
7. Infer genre based on domain and text context
8. Infer purpose from context patterns
9. Calculate confidence from extracted entities

**Plain English**: It reads what you wrote and tries to understand what you mean. "Pass CELBAN next year" becomes a structured goal with domain=medical (because CELBAN is a medical exam), benchmark=CELBAN, and deadline=January 2027.

**Important Behaviors**:
- If no modalities are mentioned, defaults to ALL modalities (reading, listening, speaking, writing)
- If benchmark mentions a domain but no domain keywords are found, domain is inferred from benchmark
- Confidence increases with more extracted entities (coverage bonus)
- Original text is always preserved for reference

### generateClarifyingQuestions(parsed: ParsedGoal): OnboardingStep[]

**What it does**: Examines a parsed goal and generates additional questions only for missing or uncertain information.

**Decision Logic**:
- If domain confidence < 0.7 OR no domain entity found: Ask about field/domain
- If all 4 modalities are present (meaning none were specified): Ask about skill focus
- If no deadline exists: Optionally ask about timeline

**Plain English**: After trying to understand your goal, if we're not sure about something important, we ask. But only about the things we couldn't figure out. If you mentioned "TOEFL," we already know it's academic -- no need to ask.

**Cognitive Load Awareness**:
- Domain question: `cognitiveLoad: 'low'` (4 simple choices)
- Modality question: `cognitiveLoad: 'medium'` (multi-select)
- Timeline question: `cognitiveLoad: 'low'` (4 simple choices, not required)

### createOnboardingFlow(userLanguage: string): OnboardingFlow

**What it does**: Generates the complete, default onboarding wizard structure with all steps, dependencies, and cognitive load estimates.

**Default Flow Structure**:
1. **target_language** (choice, required, low load): What language to learn
2. **goal_text** (text, required, medium load): Free-form goal description
3. **confirm_goal** (confirmation, required, low load): Review parsed interpretation
4. **initial_assessment** (assessment, optional, high load): Quick skill check

**Plain English**: This creates the "template" for onboarding. Every new user goes through: pick a language, describe your goal, confirm we understood it correctly, and optionally take a quick test to see where you're starting from.

**Design Decisions**:
- Free text input comes early to leverage natural language parsing
- Confirmation step depends on goal_text (must parse before confirming)
- Assessment is optional because it has high cognitive load
- Total estimated time: calculated per step type (choice=10s, text=30s, confirmation=15s, assessment=120s)

---

## Entity Extraction System

### How Domain Extraction Works

**Keyword Dictionary Approach**: The module maintains a `DOMAIN_KEYWORDS` map associating domains with their characteristic vocabulary.

```
medical: ["medical", "medicine", "doctor", "nurse", "CELBAN", "NCLEX", ...]
legal: ["legal", "law", "lawyer", "attorney", "court", ...]
business: ["business", "corporate", "finance", "MBA", ...]
academic: ["academic", "university", "IELTS", "TOEFL", ...]
general: ["daily", "everyday", "travel", "conversation", ...]
```

**Plain English**: We have a vocabulary list for each domain. If your goal contains any word from the "medical" list, we tag your domain as medical. First match wins, so the keyword order matters.

**Extraction Details**:
- Returns domain string plus ExtractedEntity with confidence 0.8
- Includes character span [start, end] for potential highlighting
- Processes domain keywords before benchmark keywords

### How Benchmark Extraction Works

**Exam-Aware Recognition**: The `BENCHMARK_KEYWORDS` map links exam names to their canonical form and associated domain.

```
celban -> { domain: 'medical', name: 'CELBAN' }
ielts  -> { domain: 'academic', name: 'IELTS' }
toeic  -> { domain: 'business', name: 'TOEIC' }
oet    -> { domain: 'medical', name: 'OET' }
```

**Plain English**: When you mention a specific exam, we recognize it and know what domain it belongs to. Mentioning "CELBAN" tells us both your target exam AND that you're in the medical field.

**Extraction Details**:
- Returns benchmark name, inferred domain, and ExtractedEntity with confidence 0.95 (high because exam names are unambiguous)
- Lowercase matching for case-insensitivity
- Benchmark domain overrides missing direct domain extraction

### How Modality Extraction Works

**Skill Keyword Mapping**: The `MODALITY_KEYWORDS` map associates each language skill with its related vocabulary.

```
reading:   ["read", "comprehension", "article", "book", "text"]
listening: ["listen", "audio", "podcast", "conversation"]
speaking:  ["speak", "talk", "pronunciation", "oral"]
writing:   ["write", "essay", "report", "email"]
```

**Plain English**: We detect which skills you care about based on action words. "I need to improve my speaking and listening" gets tagged with those two modalities.

**Extraction Details**:
- Returns array of modalities (can match multiple)
- Avoids duplicates within same modality
- Confidence 0.85 for each detected modality
- Empty result means "all modalities" (user didn't specify preference)

### How Deadline Extraction Works

**Temporal Pattern Matching**: The `DEADLINE_PATTERNS` array contains regex patterns for various deadline expressions.

Supported patterns:
- "in X months/weeks/years" -> Relative from today
- "within X months/weeks/years" -> Same as "in"
- "by [Month] [Year]" -> Specific month
- "X months/weeks/years from now/later" -> Relative phrasing
- "next month/year" -> Calendar-relative

**Plain English**: We understand many ways people express deadlines: "in 6 months," "by September 2026," "next year," etc. We convert all of these into a specific Date.

**Extraction Details**:
- Returns Date object plus ExtractedEntity with confidence 0.75 (moderate because natural language dates can be ambiguous)
- Falls back to null if no pattern matches
- `parseDeadlineMatch()` handles the conversion logic

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

This module is intentionally **pure** -- it has NO external dependencies. All functionality is self-contained using:
- Built-in TypeScript/JavaScript features
- Internally defined type interfaces
- Internal constant dictionaries (DOMAIN_KEYWORDS, BENCHMARK_KEYWORDS, etc.)
- Internal helper functions

**Design Rationale**: As a `src/core` module, it must remain pure and dependency-free to ensure testability, portability, and clear architectural boundaries.

### Dependents (What Needs This)

- **`src/main/ipc/onboarding.ipc.ts`**: The IPC handler for onboarding completion could use this module to parse free-text goals before storing them as GoalSpec records. Currently, the IPC handler receives pre-structured data; this module could pre-process raw input.

- **`src/renderer/components/onboarding/*`** (potential): UI components could invoke this module (via IPC) to provide real-time parsing feedback as users type their goals, showing extracted entities and confidence levels.

- **Future LLM Integration**: The module is designed as a fallback/baseline. Production systems could enhance `parseNaturalLanguageGoal()` with LLM-based parsing while keeping this deterministic version as a fast, privacy-preserving alternative.

### Data Flow

```
User types: "I need to pass CELBAN for nursing work in 6 months"
                              |
                              v
              +-------------------------------+
              | parseNaturalLanguageGoal()    |
              +-------------------------------+
                              |
        +---------------------+----------------------+
        |                     |                      |
        v                     v                      v
extractDomain()     extractBenchmark()     extractModalities()
  |                       |                        |
  | "nursing" -> medical  | "CELBAN" found         | No keywords found
  |                       | domain: medical        | -> default all 4
  v                       v                        v
        +---------------------+----------------------+
                              |
                              v
                    extractDeadline()
                              |
                    "6 months" -> Date
                              v
              +-------------------------------+
              | Assemble ParsedGoal           |
              | - domain: medical             |
              | - benchmark: CELBAN           |
              | - modalities: all 4           |
              | - deadline: +6 months         |
              | - confidence: 0.85            |
              +-------------------------------+
                              |
                              v
              generateClarifyingQuestions()
                              |
              Only asks about modalities
              (domain and deadline were found)
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at **Layer 0 (Pure Core)** of the LOGOS architecture:

```
+---------------------------------------------------+
|  Layer 3: Renderer (React UI)                      |
|  - OnboardingWizard.tsx                            |
|  - GoalInputField.tsx                              |
+---------------------------------------------------+
                         |
                         | IPC Invoke
                         v
+---------------------------------------------------+
|  Layer 2: IPC Bridge (Main Process)                |
|  - onboarding.ipc.ts                               |
|  - goal.ipc.ts                                     |
+---------------------------------------------------+
                         |
                         | Function calls
                         v
+---------------------------------------------------+
|  Layer 1: Services (Business Logic)                |
|  - corpus-pipeline.service.ts                      |
|  - goal.service.ts                                 |
+---------------------------------------------------+
                         |
                         | Pure function calls
                         v
+---------------------------------------------------+
|  Layer 0: Pure Core (THIS MODULE)                  |  <-- You are here
|  - onboarding-ai.ts                                |
|  - irt.ts, fsrs.ts, pmi.ts                         |
|  - NO dependencies, NO side effects               |
+---------------------------------------------------+
```

### Big Picture Impact

The onboarding-ai module is the **cognitive translator** between human intent and machine understanding. It enables:

| Capability | How This Module Contributes |
|------------|----------------------------|
| **Natural Language Onboarding** | Users describe goals in their own words instead of filling forms |
| **Smart Defaults** | System infers domain/modality from context, reducing questions |
| **Exam-Aware Configuration** | Benchmark keywords automatically configure domain and purpose |
| **Deadline-Driven Pacing** | Extracted deadlines feed into daily learning target calculations |
| **Corpus Sourcing** | `suggestCorpusSourcing()` recommends vocabulary sources based on goal |
| **Cognitive Load Management** | Flow construction follows UX research principles |
| **Confidence Transparency** | System knows when it's uncertain and asks clarifying questions |

### System Dependencies

**Without this module**:
- Users would need lengthy questionnaires to configure goals
- No natural language understanding for goal descriptions
- No intelligent clarifying question generation
- No cognitive load estimation for UX optimization
- No structured pathway from free text to GoalSpec

**Integration Points**:
- Output `ParsedGoal` maps directly to database `GoalSpec` model fields
- `CorpusSourcingPlan` informs `corpus-pipeline.service.ts` decisions
- `OnboardingFlow` structure aligns with renderer wizard components
- Confidence scores can trigger additional UI clarification steps

---

## Additional Exported Functions

### suggestCorpusSourcing(goal: ParsedGoal): CorpusSourcingPlan

**What it does**: Given a parsed goal, recommends appropriate corpus sources, vocabulary focus areas, content types, and initial vocabulary counts.

**Domain-Specific Recommendations**:
| Domain | Sources | Focus | Initial Vocab |
|--------|---------|-------|---------------|
| medical | embedded_medical, opus | medical terminology, patient communication | 800 |
| business | embedded_business, coca | business terminology, negotiations | 600 |
| academic | embedded_academic, coca, bnc | academic vocabulary, research writing | 700 |
| legal | embedded_legal, opus | legal terminology, contract language | 600 |
| general | coca, opus | general vocabulary, everyday communication | 500 |

**Plain English**: Once we know what you're learning English for, we can recommend the right sources of learning material. A medical student needs clinical case studies; a business professional needs email templates and meeting transcripts.

### estimateCognitiveLoad(step: OnboardingStep): number

**What it does**: Calculates a 0-1 cognitive load score for a single onboarding step based on type, choices, and requirements.

**Load Calculation**:
- Choice: `log2(1 + numChoices) / log2(1 + MAX_CHOICES)` (Hick's Law)
- Text: 0.6 (free text requires significant mental effort)
- Confirmation: 0.3 (just reviewing, low demand)
- Assessment: 0.9 (active testing, high demand)
- +0.1 if step is required (adds pressure)

**Plain English**: This puts a number on "how hard is this step." A simple 2-option choice is easy (low score). Writing a free-form description is harder (medium score). Taking a test is demanding (high score).

### validateParsedGoal(goal: ParsedGoal): ValidationResult

**What it does**: Checks whether a parsed goal has sufficient information to proceed, identifying missing fields and providing suggestions.

**Validation Criteria**:
- Domain must be specified (not just 'general') if confidence < 0.5
- At least one modality must be present
- Purpose adds value but isn't strictly required

**Plain English**: After parsing, we double-check that we have enough information to create a meaningful learning plan. If something critical is missing, we flag it and suggest how to fix it.

### updateGoalWithClarifications(goal: ParsedGoal, clarifications: Record<string, string | string[]>): ParsedGoal

**What it does**: Merges user's clarification responses into an existing parsed goal, updating fields and boosting confidence.

**Plain English**: After asking follow-up questions, we incorporate the answers into the goal. If you told us your domain is "medical" when we asked, we update the goal with that information and increase our confidence score.

### createGoalFromResponses(responses: Record<string, string | string[]>): ParsedGoal

**What it does**: Assembles a complete ParsedGoal from collected onboarding wizard responses, parsing free text and applying clarifications.

**Plain English**: Takes all the answers you provided during onboarding and builds the final, complete goal structure that gets saved to the database.

---

## Technical Concepts (Plain English)

### Entity Extraction with Confidence Scores

**Technical**: Each extracted piece of information (domain, benchmark, modality, deadline) is assigned a confidence value between 0 and 1, representing the system's certainty in the extraction.

**Plain English**: When we pull information from your text, we also track how sure we are. Recognizing "CELBAN" is very certain (0.95) because it's an exact match. Detecting domain from general keywords is less certain (0.8) because words can be ambiguous.

**Why We Use It**: Confidence scores drive the clarification system. Low confidence triggers follow-up questions; high confidence lets us skip unnecessary questions.

### Span Tracking for Extracted Entities

**Technical**: Each `ExtractedEntity` includes a `span: [number, number]` tuple indicating the character positions in the original text where the entity was found.

**Plain English**: We remember exactly WHERE in your text we found each piece of information. "CELBAN" might be at characters 15-21. This could enable visual highlighting in the UI showing what we understood.

**Why We Use It**: Transparency and debugging. Users (and developers) can see exactly what triggered each extraction.

### Default-to-All Modality Strategy

**Technical**: When no modality keywords are detected in the input, the parser returns all four modalities rather than none.

**Plain English**: If you don't tell us which skills to focus on, we assume you want to learn all of them: reading, writing, listening, and speaking. This is a safe default that we can narrow down with clarifying questions.

**Why We Use It**: Maximizes coverage by default. Users who have specific preferences will mention them; users who don't get comprehensive learning.

### Step Dependencies in Onboarding Flows

**Technical**: The `dependsOn` field in `OnboardingStep` creates a directed acyclic graph (DAG) of step execution order, ensuring prerequisites are completed before dependent steps.

**Plain English**: Some steps can't happen until others are done. You can't confirm your parsed goal until you've actually typed your goal. The "confirmation" step depends on the "goal_text" step.

**Why We Use It**: Prevents logical errors in wizard flow. The UI can use dependencies to determine valid navigation and enable/disable steps.

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created comprehensive narrative documentation for onboarding-ai.ts
- **Why**: Shadow documentation required for all core modules per CLAUDE.md specifications
- **Impact**: Provides context for developers, AI agents, and future maintainers working on the onboarding system

### Initial Implementation (prior to documentation)
- **What Changed**: Complete AI-powered onboarding module with NLP parsing, cognitive load estimation, and flow management
- **Why**: Enable natural language goal input instead of lengthy questionnaires
- **Impact**: Reduces user friction during onboarding while capturing structured goal specifications

---

## Notes & Observations

### Production Enhancement Path

The current implementation uses keyword/regex pattern matching. In production, this could be enhanced with:
- LLM-based parsing for more nuanced understanding
- Multilingual goal parsing (currently English-focused keywords)
- Learning from corrections (when users fix misparses)

The module's structure anticipates this: `parseNaturalLanguageGoal` could be swapped with an LLM-powered version while maintaining the same interface.

### Not Yet Exported from Core Index

As of the current `src/core/index.ts`, this module is NOT exported through the central core barrel file. It exists as a standalone module that may need explicit import:

```typescript
import { parseNaturalLanguageGoal } from '@core/onboarding-ai';
// Rather than: import { parseNaturalLanguageGoal } from '@core';
```

Consider adding exports to `src/core/index.ts` if this module becomes widely used.

### Benchmark Coverage

The `BENCHMARK_KEYWORDS` dictionary currently covers:
- Medical: CELBAN, NCLEX, USMLE, OET
- Academic: IELTS, TOEFL, GRE
- Business: TOEIC, GMAT
- General: CELPIP

Other common exams (Cambridge, Duolingo, PTE) could be added based on user demand.

### Language Pair Implications

This module parses goals but doesn't explicitly handle L1-L2 transfer considerations. The parsed goal feeds into other systems (like `transfer.ts`) that handle language pair-specific adjustments.
