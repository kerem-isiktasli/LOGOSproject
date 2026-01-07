# Learning Session E2E Tests

> **Last Updated**: 2026-01-06
> **Code Location**: `e2e/session.e2e.ts`
> **Status**: Active

---

## Context & Purpose

This end-to-end test file validates the complete learning session workflow in the LOGOS language learning application. It exists to ensure that the entire user journey through a learning session works correctly from start to finish, testing the integration between the Electron desktop application, the React frontend, and the backend session management system.

**Business Need**: LOGOS is a language learning platform where users engage in structured learning sessions. Each session involves selecting a learning goal, being presented with language tasks (vocabulary, grammar exercises, etc.), recording user responses, and tracking mastery progress. This E2E test suite ensures that this critical user flow remains functional as the codebase evolves, preventing regressions that would break the core learning experience.

**When Used**: These tests run during the continuous integration (CI) pipeline before deployments, and can be run locally by developers after making changes to session-related functionality. They are executed using Playwright's Electron testing capabilities, launching the actual desktop application in a test environment.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `e2e/electron.helper.ts`: `launchApp()`, `closeApp()`, `waitForAppReady()` - Provides utilities to launch the Electron application, obtain a Playwright page handle, and ensure the app is ready for testing
- `@playwright/test`: `test`, `expect` - The testing framework that provides test organization, assertions, and async test execution
- `window.logos` API (runtime): The preload script exposes the `logos` API object on the window, providing access to:
  - `logos.goal.list()` - Retrieves available learning goals
  - `logos.session.start()` - Initiates a new learning session
  - `logos.session.end()` - Terminates a learning session
  - `logos.session.recordResponse()` - Records user responses to tasks
  - `logos.session.getHistory()` - Retrieves past session data
  - `logos.queue.build()` - Builds the learning task queue
  - `logos.analytics.getProgress()` - Gets progress statistics
  - `logos.analytics.getSessionStats()` - Gets session-level statistics
  - `logos.analytics.getBottlenecks()` - Identifies learning bottlenecks

### Dependents (What Needs This)

- CI/CD Pipeline: Runs these tests to verify session functionality before deployments
- `package.json` scripts: The test script invokes Playwright to run this test file
- Developer workflow: Developers run these tests locally to validate session changes

### Data Flow

```
Test starts → launchApp() → Electron app boots with test database →
    → waitForAppReady() → React UI renders →
    → window.logos API available via preload script →
    → Test calls logos.goal.list() to get prerequisites →
    → Test calls logos.session.start() with goalId →
    → Session created in SQLite database →
    → Test calls logos.session.recordResponse() →
    → FSRS/IRT algorithms update mastery state →
    → Test calls logos.session.end() →
    → Session summary calculated and returned →
    → closeApp() → Test assertions verify expected outcomes
```

---

## Macroscale: System Integration

### Architectural Layer

This test file sits at the **Integration Testing Layer** of the LOGOS test pyramid:

```
Layer 4: E2E Tests (You are here)
    │    ↓ Tests full user flows
Layer 3: Integration Tests
    │    ↓ Tests IPC handlers + database
Layer 2: Unit Tests
    │    ↓ Tests core algorithms (FSRS, IRT)
Layer 1: Static Analysis
         ↓ TypeScript type checking
```

The session E2E tests exercise the complete stack:
- **Electron Main Process**: Database connections, IPC handlers, FSRS scheduling
- **Preload Script**: Exposes the `logos` API bridge
- **Renderer Process**: React UI rendering and user interactions
- **Core Algorithms**: FSRS spaced repetition, IRT ability estimation

### Big Picture Impact

The learning session is the **core value proposition** of LOGOS. This test file validates:

1. **Session Lifecycle**: Users can start, interact with, and complete learning sessions
2. **Response Recording**: The system accurately captures whether users answer correctly
3. **Progress Tracking**: Session statistics (accuracy, duration, items practiced) are correctly computed
4. **Analytics Integration**: Progress data feeds into analytics dashboards
5. **Error Resilience**: The app gracefully handles invalid inputs and network issues

**Downstream Dependencies**:
- The analytics dashboard relies on session data being recorded correctly
- The spaced repetition scheduling depends on response data being accurate
- User motivation features (streaks, progress indicators) depend on session completion
- Learning path adaptation uses session performance to adjust difficulty

### Critical Path Analysis

**Importance Level**: Critical

- **If these tests fail**: The core learning experience may be broken. Users might:
  - Be unable to start learning sessions
  - Lose their progress if responses are not recorded
  - See incorrect statistics in their dashboard
  - Experience crashes or hangs during study sessions

- **Failure Modes Tested**:
  - Invalid session IDs (tests graceful error handling)
  - Session timeouts (tests recovery after delays)
  - Network interruptions (tests offline support detection)
  - Missing prerequisites (tests skip behavior when no goals exist)

- **Test Coverage Strategy**: The tests use a "skip if not applicable" pattern, checking for goals before running session tests. This prevents false failures in empty database scenarios while still validating the happy path when data exists.

---

## Technical Concepts (Plain English)

### End-to-End (E2E) Testing

**Technical**: Automated tests that exercise the complete application stack from the user interface through to the database, validating that all layers work together correctly.

**Plain English**: Like a restaurant health inspector who orders a meal and eats it to verify the entire experience works - from the menu, to the kitchen, to the table service. E2E tests do the same for software, clicking buttons and checking that the right things happen all the way through.

**Why We Use It**: Unit tests verify individual pieces work; E2E tests verify they work together. A kitchen might have perfect ingredients (passing unit tests) but still serve terrible meals if the chef cannot cook them together (failing E2E tests).

### Playwright with Electron

**Technical**: Playwright is a browser automation framework extended to control Electron applications, allowing tests to interact with the native desktop app's renderer process via a Page API.

**Plain English**: Like having a robot that can click buttons and type in your desktop app, then read what appears on screen. Playwright is that robot, and it speaks Electron's language.

**Why We Use It**: LOGOS is a desktop app (not a website), so we need a testing tool that understands Electron's architecture - two processes (main and renderer) communicating via IPC.

### ElectronTestContext

**Technical**: A TypeScript interface bundling the Electron application instance (`app`) and the first browser window's Page handle (`window`) for use in tests.

**Plain English**: A container that holds both the "app controller" (can close the app, access main process) and the "screen controller" (can click buttons, read text). Tests need both to fully exercise the application.

**Why We Use It**: Keeps test code clean by passing one object instead of two separate references around.

### window.logos API (Preload Bridge)

**Technical**: An API object exposed on the renderer's `window` global by Electron's preload script, providing async methods that invoke IPC handlers in the main process.

**Plain English**: A "messenger" object that the webpage (React UI) can use to talk to the backend (Electron main process). When you call `logos.session.start()`, the messenger sends a message to the backend, waits for a reply, and returns the result.

**Why We Use It**: Electron security requires separating the webpage (untrusted) from the backend (trusted). The preload bridge is the secure communication channel.

### Session Modes: Learning, Training, Evaluation

**Technical**: Three distinct session types that affect how the IRT theta parameter is updated:
- Learning: Theta frozen (no ability updates)
- Training: Soft-tracked (weighted updates at 50%)
- Evaluation: Full IRT updates

**Plain English**: Like the difference between practice and a graded exam:
- **Learning**: Just practicing, no pressure. Your "score" (theta) does not change.
- **Training**: Practice with light consequences. Your score changes, but only by half.
- **Evaluation**: The real test. Your score fully reflects your performance.

**Why We Use It**: Allows users to practice without anxiety about hurting their statistics, while still providing accurate ability measurement when needed.

### FSRS (Free Spaced Repetition Scheduler)

**Technical**: An algorithm that schedules when to next review an item based on the user's response quality, using parameters like stability (how well-learned) and difficulty.

**Plain English**: Like a smart flashcard system that knows exactly when you are about to forget something, and shows it to you just before that happens. If you remember easily, it waits longer before showing it again. If you struggle, it shows it sooner.

**Why We Use It**: Maximizes learning efficiency by optimizing review timing based on memory science.

### IRT (Item Response Theory) Calibration

**Technical**: A psychometric framework that estimates user ability (theta) and item parameters (difficulty, discrimination) from response patterns using maximum likelihood estimation.

**Plain English**: A statistical method borrowed from standardized testing (SAT, GRE) that figures out:
1. How hard each vocabulary word is (item difficulty)
2. How good the user is at the language (user ability)
3. How much each question tells us about the user's ability (discrimination)

**Why We Use It**: Enables adaptive learning that adjusts to each user's level, presenting tasks that are challenging but not frustrating.

### Graceful Error Handling

**Technical**: The application catching and recovering from error conditions (invalid inputs, network failures, database errors) instead of crashing, while providing meaningful feedback to the user.

**Plain English**: Like a waiter who, when the kitchen runs out of an ingredient, apologizes and suggests an alternative instead of walking away mid-sentence. The app should never just "freeze" or show cryptic error messages.

**Why We Use It**: Users lose trust in applications that crash. Graceful handling maintains user confidence and prevents data loss.

---

## Test Structure Overview

### Test Suites

| Suite | Purpose |
|-------|---------|
| `Session Prerequisites` | Verifies goals and queue are available before session tests |
| `Session Lifecycle` | Tests starting and ending sessions via the API |
| `Response Recording` | Validates correct/incorrect response recording |
| `Session History` | Tests retrieval of past session data |
| `Analytics Integration` | Validates progress, statistics, and bottleneck APIs |
| `Session UI Interactions` | Tests UI element presence (buttons, keyboard support) |
| `Session Error Handling` | Tests graceful handling of invalid inputs and timeouts |

### Test Pattern: Conditional Skipping

Many tests follow this pattern:

```typescript
if (goals.length === 0) {
  return { skipped: true, reason: 'No goals available' };
}
```

**Why**: E2E tests run against a real (but isolated) database. If no goals exist, session tests cannot run meaningfully. Instead of failing, they skip and report why, allowing the test suite to pass while indicating the untested scenario.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Created narrative documentation for session.e2e.ts
- **Why**: Shadow documentation required for all code files per project standards
- **Impact**: Improves maintainability and onboarding for developers working on session testing

### Initial Implementation
- **What Changed**: Created comprehensive E2E test suite for learning sessions
- **Why**: Ensure the core learning flow works end-to-end before deployments
- **Impact**: Prevents regressions in session lifecycle, response recording, and analytics
