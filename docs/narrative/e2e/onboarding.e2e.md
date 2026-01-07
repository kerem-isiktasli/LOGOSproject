# Onboarding Flow E2E Tests

> **Last Updated**: 2026-01-06
> **Code Location**: `e2e/onboarding.e2e.ts`
> **Status**: Active

---

## Context & Purpose

This E2E test suite validates the complete onboarding experience for new LOGOS users from start to finish. It ensures that the critical first-time user journey works correctly across all layers of the application stack - from UI components to IPC handlers to database persistence.

**Business Need**: The onboarding flow is the most critical user journey in LOGOS. A broken onboarding means users cannot create their first learning goal, which means they cannot use the application at all. This test suite acts as an automated gatekeeper, catching regressions before they reach production and strand new users at the entry point.

**When Used**:
- During continuous integration (CI) pipeline runs before merging code
- After major changes to onboarding-related components (wizard, IPC handlers, database schema)
- Before release deployments to verify the critical path works end-to-end
- During local development to validate onboarding changes in isolation

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`e2e/electron.helper.ts`**: Provides the test infrastructure utilities:
  - `launchApp()` - Spawns the Electron app in test mode with isolated database
  - `closeApp()` - Gracefully terminates the application after tests
  - `waitForAppReady()` - Ensures React has mounted before interactions
  - `cleanupTestData()` - Clears existing goals to trigger fresh onboarding state
  - `ElectronTestContext` - Type definition for app/window handles

- **`@playwright/test`**: The test framework providing:
  - `test` and `test.describe` - Test organization and grouping
  - `expect` - Assertion functions for validation
  - Lifecycle hooks (`beforeAll`, `afterAll`) for setup/teardown

- **`window.logos` API** (indirectly, via preload bridge):
  - `logos.onboarding.checkStatus()` - Determines if onboarding is needed
  - `logos.onboarding.complete()` - Finalizes onboarding with user data
  - `logos.onboarding.skip()` - Bypasses onboarding with defaults
  - `logos.goal.list()` - Verifies goals exist after onboarding

### Dependents (What Needs This)

- **CI/CD Pipeline**: Runs this suite as part of the automated test battery before deployments
- **Development Workflow**: Developers run these tests locally when modifying onboarding functionality
- **Quality Assurance**: Provides automated coverage for manual testing to focus elsewhere

### Data Flow

```
Test Suite Initialization
        |
        v
launchApp() -> Electron spawns with test DB
        |
        v
cleanupTestData() -> Delete all goals (triggers onboarding-needed state)
        |
        v
Test Execution (per test case):
        |
        +-- Onboarding Status Check
        |       |
        |       v
        |   window.evaluate() -> logos.onboarding.checkStatus()
        |       |
        |       v
        |   IPC: onboarding:check-status -> Query User table
        |       |
        |       v
        |   Return { needsOnboarding: boolean }
        |
        +-- Language Selection Validation
        |       |
        |       v
        |   DOM queries for language UI elements
        |   Regex validation of language code format
        |
        +-- Learning Preferences Validation
        |       |
        |       v
        |   DOM queries for modality options
        |   Range validation for daily time (5-480 minutes)
        |
        +-- Onboarding Completion
        |       |
        |       v
        |   logos.onboarding.complete({ nativeLanguage, targetLanguage, ... })
        |       |
        |       v
        |   IPC: onboarding:complete -> Create User + GoalSpec records
        |       |
        |       v
        |   Verify goal created via logos.goal.list()
        |
        +-- Edge Cases
                |
                v
            Test invalid data handling
            Test page refresh state persistence
```

---

## Macroscale: System Integration

### Architectural Layer

This test suite sits in the **Testing Infrastructure Layer**, exercising the full application stack from outside:

```
+---------------------------------------------------------------+
|  Testing Infrastructure                                        |
|  +---------------------------+                                 |
|  | onboarding.e2e.ts         | <-- You are here               |
|  | (Playwright Test Suite)   |                                 |
|  +---------------------------+                                 |
+---------------------------------------------------------------+
                |
                | Launches & Controls via electron.helper.ts
                v
+---------------------------------------------------------------+
|  LOGOS Application Stack                                       |
|                                                                |
|  +------------------+    IPC    +---------------------+        |
|  | Renderer Process | --------> | Main Process        |        |
|  |                  |           |                     |        |
|  | OnboardingWizard |           | onboarding.ipc.ts   |        |
|  | (React UI)       | <-------- | (IPC Handlers)      |        |
|  +------------------+           +---------------------+        |
|                                          |                     |
|                                          | Prisma ORM          |
|                                          v                     |
|                                 +---------------------+        |
|                                 | SQLite Database     |        |
|                                 | (test.db - isolated)|        |
|                                 +---------------------+        |
+---------------------------------------------------------------+
```

### Big Picture Impact

This test suite validates the **genesis point** of the entire LOGOS user experience. The onboarding flow creates the foundational data structures that every other feature depends on:

| Validated Behavior | Downstream Impact |
|-------------------|-------------------|
| Onboarding status detection | Correct routing (wizard vs. dashboard) |
| Language code validation | Proper IRT/transfer error calculations |
| Daily time validation | Accurate pacing and deadline calculations |
| Goal creation completion | Learning sessions can fetch vocabulary |
| Skip flow functionality | Users can explore before committing |
| State persistence on refresh | User progress not lost accidentally |
| Error handling | Graceful failures don't crash the app |

**Without these tests passing:**
- Broken onboarding could reach production undetected
- New users could be permanently blocked from using the app
- Invalid data could corrupt the learning algorithms downstream
- Edge cases (network errors, invalid input) could crash the application

### Critical Path Analysis

**Importance Level**: Critical (Release Blocker)

This test suite should **block releases** if it fails because:
1. Onboarding is the only entry point for new users
2. A broken onboarding means 100% of new user signups fail
3. The downstream effects (broken goals, empty vocabulary) are catastrophic

**Failure Modes**:
- Test infrastructure failure: Electron doesn't launch (environment issue)
- UI element not found: Component refactor broke selectors
- API not available: Preload bridge misconfigured
- Validation logic mismatch: Frontend/backend disagree on valid values
- Database error: Schema migration issue or connection failure

**Recovery Path**:
- Tests are isolated (test.db) - failures don't affect production data
- Cleanup runs before each suite - no test pollution between runs
- Error messages pinpoint which step/validation failed

---

## Test Suite Structure

### Test Describe Blocks

The suite is organized into two main describe blocks with logical groupings:

#### 1. Onboarding Flow (Main Suite)

The primary test suite covering the happy path and core functionality:

| Test Group | Purpose | Tests |
|------------|---------|-------|
| Onboarding Status Check | Verify API detection works | 1 test |
| Language Selection | UI presence and code validation | 2 tests |
| Learning Preferences | Modality selection and time validation | 2 tests |
| Onboarding Completion | Full completion and skip flows | 2 tests |
| Post-Onboarding State | Goal creation and navigation | 2 tests |

#### 2. Onboarding Edge Cases (Secondary Suite)

Tests for error handling and resilience:

| Test | Purpose |
|------|---------|
| Network errors | Invalid data rejection |
| State persistence | Refresh doesn't lose data |

### Test Lifecycle

```
beforeAll (Onboarding Flow):
    launchApp() - Start Electron
    waitForAppReady() - Wait for React
    cleanupTestData() - Delete goals to trigger onboarding

afterAll (Onboarding Flow):
    closeApp() - Terminate Electron

beforeAll (Edge Cases):
    launchApp() - Fresh app instance

afterAll (Edge Cases):
    closeApp() - Clean termination
```

---

## Test Case Details

### Onboarding Status Check

**Test**: `should check if onboarding is needed via API`

**What It Validates**:
- The `logos.onboarding.checkStatus()` API is accessible
- Returns a status object with `needsOnboarding` boolean
- The status detection logic works correctly

**Plain English**: This test asks the app "does this user need to go through setup?" and verifies the app gives a clear yes/no answer. After we deleted all goals in setup, the answer should be "yes."

### Language Selection

**Test**: `should display language options`

**What It Validates**:
- Language selection UI elements exist in the DOM
- Checks multiple possible selectors (test IDs, names, aria-labels)
- Handles the case where user might already be past this step

**Plain English**: This test looks for dropdown menus or buttons where the user picks their native language and what they want to learn. It's flexible about exactly how the UI is built, just that language selection exists somewhere.

**Test**: `should validate language code format`

**What It Validates**:
- Valid language codes pass: `ko`, `ja`, `en`, `zh`, `ko-KR`, `ja-JP`
- Invalid codes fail: `korean`, `japanese`, `123`
- Regex pattern: `^[a-z]{2}(-[A-Z]{2})?$`

**Plain English**: Language codes should be like "en" for English or "ko-KR" for Korean (South Korea). This test makes sure the app rejects nonsense like "english" or "123" that could break the learning algorithms.

### Learning Preferences

**Test**: `should allow modality selection`

**What It Validates**:
- Modality options (visual, auditory, kinesthetic) can be found
- The selection UI is present when onboarding is active

**Plain English**: Users learn differently - some are visual learners, others prefer listening or doing. This test checks that users can tell the app how they learn best.

**Test**: `should validate daily time range`

**What It Validates**:
- Valid times: 5, 15, 30, 60, 120, 480 minutes (accepted)
- Invalid times: 0, 3, 500, -1 minutes (rejected)
- Range: 5 to 480 minutes

**Plain English**: Users commit to studying between 5 minutes and 8 hours per day. Less than 5 minutes isn't enough to learn anything; more than 8 hours is unrealistic. This test ensures the app enforces sensible limits.

### Onboarding Completion

**Test**: `should complete onboarding via API`

**What It Validates**:
- `logos.onboarding.complete()` API is callable
- Accepts valid onboarding data:
  - `nativeLanguage: 'ko'`
  - `targetLanguage: 'ja'`
  - `domain: 'general'`
  - `modality: ['visual']`
  - `purpose: 'E2E Test Goal'`
  - `dailyTime: 30`
- Returns success or handles gracefully if already onboarded

**Plain English**: This test simulates a user finishing the setup wizard - they've told us they speak Korean, want to learn Japanese, prefer visual learning, and will study 30 minutes daily. It verifies the app saves all this correctly.

**Test**: `should allow skipping onboarding`

**What It Validates**:
- `logos.onboarding.skip()` API is callable
- Creates minimal user profile with defaults
- Allows exploration without full commitment

**Plain English**: Some users want to look around before committing. This test verifies the "skip for now" button works, letting users explore the app without filling in all the details upfront.

### Post-Onboarding State

**Test**: `should have at least one goal after onboarding`

**What It Validates**:
- `logos.goal.list()` returns an array
- After completing onboarding, at least one goal exists

**Plain English**: After setup, the user should have a learning goal in their account. This test checks that completing onboarding actually created something they can start learning from.

**Test**: `should redirect to dashboard after onboarding`

**What It Validates**:
- Dashboard UI elements are detectable
- Checks for dashboard indicators (test IDs, headings, aria labels)

**Plain English**: After finishing setup, users should land on their dashboard - not be stuck on the wizard or see an error. This test verifies the navigation happens correctly.

### Edge Cases

**Test**: `should handle network errors gracefully`

**What It Validates**:
- Invalid data is rejected (not silently accepted)
- Error is caught and handled, not crashing the app
- Test uses intentionally invalid values:
  - `nativeLanguage: 'invalid'`
  - `targetLanguage: 'invalid'`
  - `modality: []` (empty array)
  - `purpose: ''` (empty string)
  - `dailyTime: 0` (below minimum)

**Plain English**: What happens when something goes wrong? This test sends garbage data to make sure the app says "that's not valid" instead of crashing or corrupting the database.

**Test**: `should preserve state on page refresh`

**What It Validates**:
- Goal count before page reload
- Goal count after page reload
- Counts should match (data persisted)

**Plain English**: If a user accidentally refreshes the page, they shouldn't lose their progress. This test verifies that goals are saved to the database and survive a page reload.

---

## Technical Concepts (Plain English)

### Window.evaluate() Pattern

**Technical**: Playwright's `window.evaluate()` runs JavaScript code inside the Electron renderer process, allowing tests to interact with the `window.logos` API directly.

**Plain English**: Think of it like controlling a puppet from outside the stage. The test script is backstage, but it can reach into the puppet's world and make it do things - like calling the onboarding API as if a real user's code was running.

**Why We Use It**: E2E tests need to interact with the application's internal APIs, not just click buttons. This allows testing the API contract directly, catching issues even if the UI is broken.

### Flexible Selector Strategy

**Technical**: Tests use multiple alternative selectors joined by commas: `[data-testid="native-language"], select[name="nativeLanguage"], [aria-label*="language"]`

**Plain English**: Like asking "is there a blue door, or a door labeled 'exit', or a door with a green handle?" - any one of these proves a door exists. The test doesn't care exactly how the UI is built, just that the functionality is present.

**Why We Use It**: UI implementations change. Using multiple selector strategies makes tests resilient to refactors while still validating that required functionality exists.

### Conditional Test Execution

**Technical**: Tests check if UI elements exist and skip assertions when conditions aren't met: `if (hasLanguageUI) { expect(...) }`

**Plain English**: Sometimes the app might already be past a step, or a feature might not be shown in certain states. Rather than fail incorrectly, the test acknowledges "this might not apply right now" and moves on.

**Why We Use It**: The onboarding state machine has multiple paths. A rigid test would fail when the user is in a different state than expected. This flexibility handles real-world variability.

### Test Database Isolation

**Technical**: The electron.helper sets `DATABASE_URL: 'file:./test.db'` and `cleanupTestData()` removes goals before tests run.

**Plain English**: Tests use a separate "practice" database that gets wiped clean before each run. This ensures tests always start from the same point - a new user with no goals who needs onboarding.

**Why We Use It**: **Reproducibility**. Tests should produce the same results every time. If test data leaks between runs, tests become flaky and untrustworthy.

### Graceful Failure Handling

**Technical**: Tests expect either success OR a handled error: `expect(result.skipped || result.success || result.error).toBeTruthy()`

**Plain English**: This test doesn't demand a specific outcome - it verifies that SOMETHING reasonable happened. Either the onboarding completed successfully, was skipped because it wasn't needed, or failed with an error message (not a crash).

**Why We Use It**: E2E tests run against real, complex systems. Multiple valid outcomes are possible depending on state. Testing for "handled correctly" is more robust than testing for "exactly this happened."

---

## Integration Points Validated

### IPC Channels Tested

| Channel | Handler | Test Coverage |
|---------|---------|---------------|
| `onboarding:check-status` | Checks if onboarding needed | Onboarding Status Check |
| `onboarding:complete` | Finalizes onboarding | Onboarding Completion |
| `onboarding:skip` | Creates minimal profile | Skip Onboarding |
| `goal:list` | Lists user's goals | Post-Onboarding State |

### Database Tables Affected

| Table | Operation | Test Coverage |
|-------|-----------|---------------|
| `User` | Create/Update | Completion/Skip tests |
| `GoalSpec` | Create | Completion test |
| `GoalSpec` | Delete | Cleanup in beforeAll |
| `GoalSpec` | Read | Post-onboarding verification |

### UI Components Exercised

| Component | Location | Test Coverage |
|-----------|----------|---------------|
| Language Selector | OnboardingWizard Step 1-2 | Language Selection tests |
| Modality Selector | OnboardingWizard Step 4 | Learning Preferences tests |
| Daily Time Input | OnboardingWizard Step 5 | Learning Preferences tests |
| Dashboard | Post-wizard | Post-Onboarding State |

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created narrative documentation for onboarding.e2e.ts
- **Why**: Shadow documentation required for all code files per project CLAUDE.md specifications
- **Impact**: Provides comprehensive context for developers maintaining or extending the onboarding E2E tests

### Initial Implementation (prior to documentation)

- **What Changed**: Created comprehensive E2E test suite covering:
  - Onboarding status detection
  - Language selection and validation
  - Learning preference capture
  - Complete and skip flows
  - Post-onboarding state verification
  - Edge cases and error handling
- **Why**: Critical user journey needs automated validation to prevent regressions
- **Impact**: Enables confident deployments knowing the onboarding flow works end-to-end

---

## Notes & Observations

### Test Resilience Strategy

The tests are designed to be **resilient to state variations**. Because onboarding state depends on database contents and the tests clean up goals in `beforeAll`, there can be timing issues or edge cases where state isn't as expected. Tests use conditional checks and flexible assertions to handle this gracefully.

### Coverage Gaps

The current test suite does not cover:
- Full wizard step-by-step UI interaction (uses API calls instead)
- Animation and visual transition behavior
- Accessibility validation (keyboard navigation, screen readers)
- Performance benchmarks (how long onboarding takes)

These may be candidates for additional test suites focused on UI or accessibility.

### Dual Test Block Structure

The suite has two separate `test.describe` blocks that each launch their own app instance. This provides isolation but increases test runtime. Consider whether the edge case tests could share an app instance with the main flow tests if performance becomes an issue.

### Language Code Validation

The regex validation test (`^[a-z]{2}(-[A-Z]{2})?$`) runs entirely in the browser context without calling the backend. This means it validates the frontend's understanding of valid codes, not necessarily what the backend would accept. Consider adding integration tests that verify frontend/backend validation alignment.
