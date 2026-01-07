# session.ipc.ts — Session Lifecycle, Response Processing, and Analytics

## Why This Exists

Sessions are where learning actually happens. A session represents a contiguous learning activity: starting study, responding to tasks, receiving feedback, and concluding with a summary. This IPC module orchestrates the entire session lifecycle, processes each learner response through multiple adaptive algorithms (FSRS for scheduling, IRT for ability estimation, bottleneck analysis for weakness detection), and provides analytics endpoints. It's the most complex IPC module because learning is the core domain, and this is where the algorithms converge.

## Key Concepts

- **Session Modes**: `learning` (mixed new + review), `training` (focused practice), `evaluation` (testing without affecting scheduling). Mode affects how responses are processed and what statistics are tracked.

- **FSRS (Free Spaced Repetition Scheduler)**: The spaced repetition algorithm determining when to review items. Each response updates stability and difficulty parameters, which then compute the next optimal review date. A singleton FSRS instance ensures consistent behavior.

- **IRT (Item Response Theory)**: Statistical model for learner ability (theta) and item difficulty. After sufficient responses (10+), theta is re-estimated using Maximum Likelihood Estimation. Component-specific thetas (phonology, morphology, lexical, syntactic, pragmatic) enable fine-grained proficiency tracking.

- **Response Timing Analysis**: Response time isn't just logged - it's analyzed. Fast correct responses suggest automaticity (fluent knowledge); slow responses suggest effortful retrieval; too-fast might indicate guessing. This affects the FSRS rating.

- **Stage Transitions**: Mastery stages (0=new, 1=learning, 2=familiar, 3=mastered, 4=burned) transition based on accuracy thresholds and FSRS stability. Stage transitions are counted per session as a progress metric.

- **IRT Calibration**: At session end (if configured), item parameters are recalibrated using all accumulated responses. This improves difficulty estimates over time using Expectation-Maximization.

## Design Decisions

**Timing-Aware Ratings**: Standard FSRS uses just correct/incorrect. LOGOS enhances this by factoring response time into the rating. A quick correct answer gets a higher rating than a slow correct answer. This better models "knowing" vs "barely remembering".

**Singleton FSRS Instance**: Creating FSRS is cheap, but using a singleton ensures any internal state (if future versions have it) is consistent and avoids repeated initialization.

**Automatic Previous Session Termination**: When starting a new session for a goal, any existing active session is automatically ended. This prevents orphaned sessions from accumulating, though it might surprise users who expect to resume.

**Korean Error Message**: The "no content" error is in Korean ("학습 콘텐츠가 아직 준비되지 않았습니다"), suggesting the primary user base. This should probably be internationalized.

**Component Theta Separation**: Rather than one global ability estimate, LOGOS maintains separate theta values for each linguistic component. A learner might be theta=1.5 for lexical but theta=-0.5 for syntactic. This enables more targeted content selection.

**Bottleneck Analysis Integration**: On errors, ComponentErrorStats are updated, feeding into the learning bottleneck detection system. The `analytics:get-bottlenecks` handler runs the full bottleneck analysis algorithm.

**IRT Calibration Safeguards**: Calibration requires minimum items (10), responses per item (5), and sessions (3). Standard errors must be reasonable (<1.0). These thresholds prevent garbage estimates from insufficient data.

## Integration Points

**Upstream Dependencies**:
- `./contracts`: IPC utilities, validation
- `../db/client`: Prisma database operations
- `../../core/fsrs`: FSRS algorithm (schedule, ratings, card creation)
- `../../core/bottleneck`: Bottleneck analysis algorithm
- `../../core/irt`: IRT theta estimation and item calibration
- `../../core/priority`: Priority and urgency computation
- `../../core/response-timing`: Response time analysis and classification

**Database Tables Touched**:
- `Session`: Created, updated, queried with response counts
- `Response`: Created for each submission, queried for analytics
- `MasteryState`: Created/updated with FSRS parameters
- `LanguageObject`: Read for content, updated for priority and IRT parameters
- `User`: Read/updated for theta values
- `ComponentErrorStats`: Upserted on errors

**Downstream Consumers**:
- Session UI (start, submit responses, see next task, end)
- Analytics dashboards (progress, bottlenecks, history)
- Session history views

**Handler Channels**:
| Channel | Purpose |
|---------|---------|
| `session:start` | Begin new learning session, get first task |
| `session:end` | Conclude session, run calibration, get stats |
| `session:get-state` | Check current session status |
| `session:submit-response` | Process learner response (the core learning loop) |
| `session:list` | List past sessions for a goal |
| `session:get-next-task` | Get next item to study |
| `session:get-summary` | Get detailed session statistics |
| `analytics:get-progress` | Overall goal progress (stage distribution) |
| `analytics:get-bottlenecks` | Component-level weakness analysis |
| `analytics:get-history` | Session history with streaks and averages |

**Response Processing Pipeline**:
```
submit-response received
        |
        v
Analyze response timing -> classification, automaticity detection
        |
        v
Calculate timing-aware FSRS rating
        |
        v
Create/update MasteryState with FSRS parameters
        |
        v
Determine stage transition (0->1->2->3->4)
        |
        v
Update user theta via IRT (if enough responses)
        |
        v
Update priority for the learning object
        |
        v
Update ComponentErrorStats (if error)
        |
        v
Return mastery update, stage change, timing analysis
```

**IRT Calibration (End of Session)**:
```
Session ends with autoCalibrate=true
        |
        v
Fetch all responses for goal
        |
        v
Check thresholds (items, responses, respondents)
        |
        v
Build response matrix (sessions x items)
        |
        v
Run calibrateItems() EM algorithm
        |
        v
Update LanguageObject.irtDifficulty and irtDiscrimination
```
