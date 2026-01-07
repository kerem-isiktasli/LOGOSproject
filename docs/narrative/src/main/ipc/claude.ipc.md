# claude.ipc.ts — Claude AI Integration for Content Generation and Error Analysis

## Why This Exists

LOGOS is an adaptive language learning platform, and Claude AI serves as the intelligent content engine. This IPC module bridges the renderer's need for dynamic, context-aware learning materials with Claude's generative capabilities. It handles three core AI functions: generating exercises/explanations/examples tailored to the learner's level, analyzing errors to identify linguistic component weaknesses, and providing progressive hints. Without this layer, the application would be limited to static content, losing the personalization that makes adaptive learning effective.

## Key Concepts

- **ContentRequest**: Specifies what type of content to generate (`exercise`, `explanation`, `example`), the target content, both languages involved, optional context, and difficulty level. The difficulty maps to mastery stages (0-4), allowing Claude to calibrate complexity.

- **ErrorAnalysisRequest**: When a learner makes a mistake, this captures their response versus the expected response, enabling Claude to classify the error by linguistic component (PHON, MORPH, LEX, SYNT, PRAG) and provide targeted feedback.

- **HintRequest**: Implements a 3-level hint system where level 1 gives minimal guidance, level 2 provides more structure, and level 3 essentially reveals the answer. The `previousHints` array ensures hints build on each other rather than repeating.

- **ComponentErrorStats**: Aggregates error patterns per linguistic component per user per goal. This enables the bottleneck detection system to identify which aspects of language the learner struggles with most.

- **Error Rate Calculation**: Recent errors (7-day window) divided by total responses gives a rolling error rate that drives recommendations. The recency weighting prevents ancient errors from skewing current assessments.

## Design Decisions

**Component-Based Error Taxonomy**: Rather than generic "wrong/right", errors are classified by linguistic component (Phonology, Morphology, Lexical, Syntactic, Pragmatic). This aligns with second language acquisition research (Nation, 2001) and enables targeted remediation. The `getComponentRecommendation` function maps error rates to actionable advice.

**Recommendation Tiering**: Low (<20%), medium (20-50%), and high (>50%) error rates yield different recommendations. For example, a high lexical error rate suggests "Focus on high-frequency words" while low suggests "Expand into specialized domains". This graduated response prevents over-intervention.

**Storing Analysis in Database**: When a `responseId` is provided, error analyses are persisted. This creates a longitudinal record for ML analysis and enables the analytics dashboards to show trends. The trade-off is storage cost, but learning insights justify it.

**Dynamic Handler Registration**: Uses `registerDynamicHandler` (from contracts) rather than static registration, suggesting these handlers might be conditionally loaded or have lifecycle requirements different from core handlers.

**Confidence Scaling**: Bottleneck confidence increases with more data points (`0.5 + totalErrors * 0.01`, capped at 0.95). This models epistemic uncertainty - with few data points, we're less confident in our bottleneck identification.

## Integration Points

**Upstream Dependencies**:
- `./contracts`: IPC utilities including `registerDynamicHandler`, validation helpers
- `../db/client`: Prisma client for database operations
- `../services/claude.service`: The actual Claude API integration, abstracted from IPC concerns

**Database Tables Touched**:
- `LanguageObject`: Fetched to get content, goal context, and mastery state
- `GoalSpec` + `User`: Joined to get target/native languages for Claude prompts
- `ErrorAnalysis`: Created when errors are analyzed (with responseId)
- `ComponentErrorStats`: Upserted to maintain per-component error aggregates
- `Response`: Counted for error rate calculations

**Downstream Consumers**:
- Session UI components that display generated exercises
- Error feedback modals that show explanations and corrections
- Analytics dashboards showing learning bottlenecks
- Hint system UI that progressively reveals assistance

**Handler Channels**:
| Channel | Purpose |
|---------|---------|
| `claude:generateContent` | Creates exercises, explanations, or examples for a learning object |
| `claude:analyzeError` | Classifies an error and stores analysis |
| `claude:getBottlenecks` | Returns ranked linguistic components by error rate |
| `claude:getHint` | Provides level-appropriate hints for stuck learners |
