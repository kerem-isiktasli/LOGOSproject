# Pragmatics Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/pragmatics.ts`
> **Status**: Active

---

## Context & Purpose

The Pragmatics module implements **pragmatic competence analysis** for language learning. Pragmatics is often called the "hidden curriculum" of language learning because it governs not just *what* is grammatically correct, but *what is socially appropriate* in a given context.

**Business Need**: Language learners frequently make pragmatic errors that native speakers find jarring or inappropriate, even when their grammar is technically correct. A learner might say "Give me water" (grammatically correct) to a professor when "Would you mind if I had some water?" would be contextually appropriate. This module enables LOGOS to detect, analyze, and teach these subtle social dimensions of language use.

**When Used**:
- When assessing if learner-generated text matches the intended social context
- When generating content that must fit a specific register (formal, casual, etc.)
- When evaluating speech acts (requests, apologies, complaints) for cultural appropriateness
- When calculating the **PRAG score** in the z(w) vector used for task matching
- When determining which vocabulary items require register-sensitive practice

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

This module is **pure** - it has no external dependencies. It implements all analysis algorithms using only built-in TypeScript/JavaScript features. This is by design, following the LOGOS core module architecture principle that core algorithms must be pure functions with no side effects.

### Dependents (What Needs This)

- **`src/core/task-matching.ts`**: Uses the **pragmatic score** (PRAG) from this module as part of the z(w) vector to determine which task types are most appropriate for words with high register sensitivity. Words with high pragmatic scores get matched to "Register shift" and "Context-appropriate use" exercises.

- **`src/core/state/component-object-state.ts`**: Tracks pragmatics as one of five **LanguageComponent** types (`'pragmatic'`), managing exposure history and cognitive induction metrics for pragmatic competence.

- **`src/core/register/register-calculator.ts`**: A sibling module that provides more detailed register profiling. While pragmatics.ts handles broad speech act and politeness analysis, register-calculator.ts handles fine-grained word-level register appropriateness.

- **`src/core/index.ts`**: Exports this module's functions for use throughout the application (though not yet explicitly listed - this may be a gap).

- **`src/main/ipc/claude.ipc.ts`**: May use pragmatic analysis for AI-generated content validation.

### Data Flow

```
User text input
      |
      v
+---------------------+
| analyzeRegister()   | --> Register scores (frozen, formal, consultative, casual, intimate)
+---------------------+
      |
      v
+---------------------+
| detectSpeechAct()   | --> Speech act category (assertive, directive, commissive, etc.)
+---------------------+
      |
      v
+---------------------+
| analyzePoliteness() | --> Politeness strategy (bald_on_record, negative_politeness, etc.)
+---------------------+
      |
      v
+-------------------------------+
| assessPragmaticAppropriateness() | --> Overall assessment with scores and recommendations
+-------------------------------+
      |
      v
+-----------------------------+
| generatePragmaticProfile()  | --> Complete pragmatic profile for a word/phrase
+-----------------------------+
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Algorithms Layer** of the LOGOS architecture:

```
Layer 1: Renderer (React UI)
    |
    v
Layer 2: Main Process (IPC Handlers, Services)
    |
    v
Layer 3: Core Algorithms <-- pragmatics.ts lives here
    |
    v
Layer 4: Database (Prisma/SQLite)
```

The Core layer is characterized by:
- **Pure functions** with no side effects or I/O
- **Self-contained algorithms** with no external dependencies
- **Stateless operations** that can be tested deterministically

### Big Picture Impact

This module is part of the **Semantic-Pragmatic-Discourse Component** described in LOGOS's theoretical foundations. It enables:

1. **Usage Space Expansion**: LOGOS's core mission is to expand a learner's "usage space" - the contexts and situations where they can effectively communicate. Pragmatic competence is essential for navigating professional, academic, and social contexts appropriately.

2. **z(w) Vector Computation**: Every word in LOGOS has a z(w) vector with six dimensions: Frequency, Relational density, Domain relevance, Morphological complexity, Phonological difficulty, and **Pragmatic sensitivity**. This module computes the PRAG dimension.

3. **Task Type Selection**: Words with high pragmatic scores (register-sensitive expressions like "I was wondering if you might..." vs "Gimme that") get matched to specialized tasks that practice contextual appropriateness.

4. **Content Generation Validation**: When generating learning content for specific domains (medical SOAP notes, legal contracts, academic abstracts), this module validates that the register matches the target genre.

5. **Error Analysis**: When learners make pragmatic errors, this module identifies *what kind* of error (register mismatch, politeness violation, speech act failure) and provides targeted recommendations.

### Critical Path Analysis

**Importance Level**: High

This module is not on the critical startup path, but it is essential for:
- Accurate z(w) vector computation (affects task selection quality)
- Domain-specific content appropriateness (medical, legal, business English)
- Learner progress beyond intermediate levels (pragmatic competence distinguishes B2+ learners)

**If this fails**: Task selection would lack pragmatic intelligence, potentially assigning inappropriate exercise types to register-sensitive vocabulary. Content generation might produce text that is grammatically correct but socially inappropriate for the target context.

---

## Technical Concepts (Plain English)

### Register
**Technical**: A variety of language defined by use in social situations, characterized by specific linguistic features (vocabulary, grammar, tone) appropriate to particular contexts.

**Plain English**: The "dress code" of language. Just as you wouldn't wear a swimsuit to a job interview or a tuxedo to the beach, you wouldn't say "gonna" in a legal document or "notwithstanding the aforementioned" in a text to a friend. Register is knowing which words "fit" which situations.

**The Five Registers**:
| Register | Context | Example |
|----------|---------|---------|
| Frozen | Legal documents, religious texts | "We the People hereby establish..." |
| Formal | Academic papers, professional reports | "This study demonstrates that..." |
| Consultative | Doctor-patient, teacher-student | "I'd recommend considering..." |
| Casual | Friends, colleagues | "Yeah, sounds good to me" |
| Intimate | Family, close friends | "C'mon, you know what I mean" |

**Why We Use It**: Non-native speakers often default to one register regardless of context. A learner might be overly formal with friends (seeming cold) or too casual with superiors (seeming disrespectful). LOGOS must detect and train appropriate register shifting.

### Speech Acts
**Technical**: Utterances that perform an action (requesting, promising, apologizing) beyond simply conveying information. Based on philosopher John Searle's (1979) taxonomy.

**Plain English**: The *job* a sentence is doing beyond its literal meaning. "It's cold in here" might be a statement (assertive), or it might actually be a request to close the window (indirect directive). "I'll be there at 5" might be a prediction or a promise - the difference matters.

**The Five Categories**:
| Category | What It Does | Examples |
|----------|--------------|----------|
| Assertive | States facts | "The report is complete" |
| Directive | Gets someone to do something | "Could you review this?" |
| Commissive | Commits the speaker | "I promise to finish by Friday" |
| Expressive | Expresses feelings | "Thank you for your help" |
| Declarative | Changes reality by saying | "I now pronounce you..." |

**Why We Use It**: Speech act recognition is crucial for understanding *intent*. A learner must recognize that "I was wondering if you might..." is a request, not an expression of curiosity. Different cultures have different conventions for performing the same speech acts.

### Politeness Strategies (Brown & Levinson's Framework)
**Technical**: Systematic linguistic strategies for managing "face" (the public self-image everyone wants to maintain) in social interactions.

**Plain English**: Every request you make is potentially annoying to someone - you're asking them to use their time/energy for your benefit. Politeness strategies are the different ways we "soften the blow":

| Strategy | Approach | Example |
|----------|----------|---------|
| Bald on-record | Direct, no softening | "Give me the report" |
| Positive politeness | Appeal to friendship | "Hey buddy, could you grab that report?" |
| Negative politeness | Acknowledge imposition | "I'm so sorry to bother you, but if it's not too much trouble..." |
| Off-record | Hints instead of requests | "I noticed the report wasn't on my desk" (implies: please put it there) |
| Don't do FTA | Avoid the request entirely | Say nothing, do it yourself |

**Why We Use It**: Different contexts require different politeness levels. Asking a close colleague to pass the salt? Bald on-record is fine. Asking your CEO for a raise? Negative politeness with extensive hedging. This module calculates the **expected politeness level** for a context and flags mismatches.

### Face-Threatening Acts (FTAs)
**Technical**: Actions that inherently threaten someone's positive face (desire to be liked) or negative face (desire for autonomy and freedom from imposition).

**Plain English**: Some things are just uncomfortable to say. Asking for a favor imposes on someone's time (threatens their negative face). Criticizing someone's work challenges their self-image (threatens their positive face). Apologizing admits you did something wrong (threatens your own positive face).

**The Four Directions**:
- Speaker's positive face: "I was wrong" (admitting error)
- Speaker's negative face: "I'd love to help" (accepting obligation)
- Hearer's positive face: "This isn't your best work" (criticism)
- Hearer's negative face: "Can you stay late?" (imposition)

**Why We Use It**: Learners must understand that some speech acts are inherently "risky" and require more careful linguistic packaging. A refusal or complaint requires more politeness than a thank-you.

### Cultural Context Sensitivity
**Technical**: The recognition that pragmatic norms vary significantly across cultural groups, affecting acceptable register, directness, and politeness conventions.

**Plain English**: What's polite in New York might be rude in Tokyo. American English tends toward more direct communication; Japanese tends toward more indirect hints and deference. Using "bald on-record" style in an East Asian business context may be perceived as rude, even if the grammar is perfect.

**Why We Use It**: LOGOS serves learners from diverse L1 backgrounds entering diverse L2 contexts. A Japanese businessperson learning English for London needs different pragmatic training than a German engineer learning English for California. This module flags potential cultural mismatches.

---

## Algorithm Details

### Register Analysis

The `analyzeRegister()` function uses a **marker-based scoring system**:

1. **Vocabulary markers**: Each register has characteristic words (frozen: "hereby", "whereas"; casual: "gonna", "stuff"). Finding these markers increases the register score.

2. **Contraction detection**: Contractions (don't, can't, I'm) are rare in frozen/formal registers but common in casual/intimate registers.

3. **Passive voice frequency**: Higher passive voice usage correlates with frozen/formal registers (academic writing, legal documents).

4. **First-person pronoun density**: High first-person usage correlates with casual/intimate registers; low usage correlates with formal/frozen.

The scores are normalized so the dominant register gets score 1.0 and others are proportionally lower.

### Speech Act Detection

The `detectSpeechAct()` function uses **pattern matching** against known speech act formulas:

- Requests: "Could you...", "Would you mind...", "I was wondering if..."
- Apologies: "I'm sorry", "I apologize", "Forgive me"
- Promises: "I promise", "I will", "You have my word"

This is a heuristic approach. Production systems might use machine learning classifiers, but the pattern-based approach provides interpretable results suitable for educational feedback.

### Pragmatic Difficulty Calculation

The `calculatePragmaticDifficulty()` function estimates how hard a word/expression is to use pragmatically correctly:

- **Low register flexibility** = harder (must be used in specific contexts only)
- **High cultural sensitivity** = harder (varies by cultural context)
- **Face-threatening speech acts** (refusals, complaints) = harder
- **Indirect politeness strategies** (off-record hints) = harder

This difficulty score feeds into the z(w) vector's PRAG dimension and influences task selection.

---

## Academic Foundations

This module implements concepts from:

- **Brown, P. & Levinson, S.C. (1987)**. *Politeness: Some Universals in Language Usage*. The foundational text on politeness theory and face-threatening acts.

- **Bardovi-Harlig, K. (2013)**. *Developing L2 Pragmatics*. Language Learning. Research on how second language learners develop pragmatic competence.

- **Kasper, G. & Rose, K.R. (2002)**. *Pragmatic Development in a Second Language*. Key work on L2 pragmatic acquisition.

- **Taguchi, N. (2015)**. *Instructed pragmatics at a glance*. Language Teaching. Contemporary research on teaching pragmatics effectively.

- **Searle, J. (1979)**. *Expression and Meaning: Studies in the Theory of Speech Acts*. The taxonomy of speech act categories used in this module.

- **Biber, D. (1988)**. *Variation across Speech and Writing*. The register analysis framework underlying the five-level register model.

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Created narrative documentation for pragmatics module
- **Why**: Shadow documentation requirement for all code files
- **Impact**: Improves maintainability and onboarding for new developers

### Initial Implementation
- **What Changed**: Created comprehensive pragmatics analysis module with register detection, speech act analysis, politeness strategy assessment, and pragmatic difficulty calculation
- **Why**: LOGOS requires pragmatic competence analysis for its five-component language model
- **Impact**: Enables register-appropriate content generation and pragmatic error detection
