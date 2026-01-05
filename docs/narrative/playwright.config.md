# Playwright E2E Test Configuration

> **Last Updated**: 2026-01-05
> **Code Location**: `playwright.config.ts`
> **Status**: Active

---

## Context & Purpose

This configuration file defines how Playwright (the end-to-end testing framework) runs automated tests against the LOGOS Electron desktop application. While unit tests verify that individual functions work correctly in isolation, E2E tests verify that the entire application works correctly from a user's perspective - clicking buttons, filling forms, navigating between screens, and seeing expected results.

**Business Need**: LOGOS is a language learning application where user experience is paramount. Users must be able to launch the app, start learning sessions, see their progress, and interact with adaptive learning features smoothly. E2E tests catch integration bugs that unit tests miss - situations where individual components work fine alone but break when combined. Without E2E testing, a release could ship with a completely non-functional user flow that unit tests never detected.

**When Used**:
- Before releasing a new version to ensure all user journeys work correctly
- After significant UI changes to verify nothing broke
- During CI/CD pipelines for automated quality gates
- When diagnosing user-reported bugs that only occur in the complete application context

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)
- `@playwright/test`: Provides `defineConfig` and `devices` - the core testing framework and device simulation capabilities
- E2E test directory (`./e2e`): Where all E2E test files with the `.e2e.ts` extension live
- Built Electron application: The tests run against the compiled application, not source code

### Dependents (What Needs This)
- `package.json`: Would define scripts like `test:e2e` that invoke Playwright which reads this configuration
- All E2E test files in `e2e/**/*.e2e.ts`: These are discovered and executed based on the `testMatch` pattern
- CI/CD pipelines: Automated systems that run E2E tests and respect the `CI` environment variable settings

### Relationship to Other Test Configuration
- `vitest.config.ts`: Handles **unit tests** for isolated functions and algorithms
- `playwright.config.ts` (this file): Handles **E2E tests** for full application user journeys

These are complementary - unit tests are fast and granular, E2E tests are slower but catch integration issues.

### Data Flow
```
Developer/CI runs Playwright
    --> Playwright loads this config file
    --> Launches the Electron application
    --> Discovers tests matching **/*.e2e.ts pattern
    --> Runs tests sequentially (single worker)
    --> Captures screenshots/videos on failure
    --> Generates list and HTML reports
    --> Returns exit code for CI pass/fail
```

---

## Macroscale: System Integration

### Architectural Layer

This configuration sits in the **Quality Assurance Infrastructure Layer**, specifically at the highest level of the testing pyramid:

```
Testing Pyramid (LOGOS):
========================

        /\
       /  \
      /E2E \    <-- playwright.config.ts (YOU ARE HERE)
     /------\       Full application tests
    /        \
   /  Integ.  \     Service-level integration tests
  /------------\
 /              \
/   Unit Tests   \  <-- vitest.config.ts
/________________\      Core algorithm tests

Build Infrastructure:
- electron.vite.config.ts (builds the app E2E tests verify)
- vitest.config.ts (sibling - unit testing)
```

### Big Picture Impact

**This configuration enables verification that:**

1. **The Application Launches**: Electron starts without crashing, windows appear
2. **Navigation Works**: Users can move between screens (onboarding, learning, analytics)
3. **Learning Sessions Function**: Users can start sessions, answer questions, receive feedback
4. **Data Persists**: Progress is saved and displayed correctly across sessions
5. **UI Responds Correctly**: Buttons trigger expected actions, forms validate input

### Critical Path Analysis

**Importance Level**: High (Release Quality Gate)

- **If this fails**: E2E tests cannot run, eliminating the final quality check before releases
- **If misconfigured**: Tests might pass on broken builds (false confidence) or fail on working builds (deployment delays)
- **Failure impact**: A release with broken user flows could ship, damaging user trust and retention

### Why Electron-Specific Configuration?

Unlike web applications, Electron apps present unique testing challenges:

1. **Desktop Window Management**: Tests must launch and control a native window, not just a browser tab
2. **IPC Communication**: Many features require coordination between main and renderer processes
3. **Sequential Execution Required**: Electron's single-window nature means tests cannot run in parallel
4. **Longer Timeouts Needed**: Desktop app startup is slower than loading a web page

This is why the configuration specifies `workers: 1` and `fullyParallel: false` - attempting to run Electron tests in parallel would cause window conflicts and race conditions.

---

## Technical Concepts (Plain English)

### testDir: './e2e'
**Technical**: Specifies the root directory where Playwright will search for test files.

**Plain English**: "Look for tests in the `e2e` folder" - this keeps end-to-end tests separate from unit tests in `src/`, maintaining clear organizational boundaries.

**Why We Use It**: Separation of concerns. E2E tests have different dependencies, patterns, and execution characteristics than unit tests.

### fullyParallel: false
**Technical**: Disables Playwright's ability to run test files concurrently across multiple workers.

**Plain English**: "Run tests one at a time, not all at once." Like a single checkout lane at a store - slower, but orderly. For Electron apps, running tests in parallel would mean multiple app windows fighting for control.

**Why We Use It**: Electron desktop applications typically have one instance with one main window. Parallel tests would create chaos - multiple windows, conflicting state, impossible-to-reproduce failures.

### forbidOnly: !!process.env.CI
**Technical**: In CI environments, fails the test run if any test has `.only()` modifier (which limits execution to just that test).

**Plain English**: During development, you might use `.only()` to focus on a single test. This setting ensures you can't accidentally commit that and skip all other tests in CI. The `!!` converts the CI environment variable to a boolean.

**Why We Use It**: Safety net against human error. It's easy to forget to remove `.only()` before committing, which would give false confidence (CI "passes" with only one test running).

### retries: process.env.CI ? 2 : 0
**Technical**: In CI, automatically retry failed tests up to 2 times before marking them as failures. Locally, no retries.

**Plain English**: "In automated pipelines, give flaky tests a second (and third) chance. When developers run tests locally, fail immediately so they see the problem right away."

**Why We Use It**: E2E tests can be flaky due to timing issues, network hiccups, or system load. Retries reduce false negatives in CI without hiding real bugs from developers.

### workers: 1
**Technical**: Limits Playwright to a single worker process for executing tests.

**Plain English**: "Only one test runs at a time, period." Even stricter than `fullyParallel: false` - this ensures there's only one Playwright process, which means only one Electron app instance.

**Why We Use It**: Electron constraint. The application manages its own state, windows, and database. Multiple instances would corrupt state and produce meaningless test results.

### reporter: [['list'], ['html', { open: 'never' }]]
**Technical**: Configures two report formats: real-time list output to terminal, and an HTML report file that doesn't auto-open.

**Plain English**:
- `list`: Shows test results as they run in your terminal - immediate feedback
- `html`: Creates a detailed report webpage you can browse later, but doesn't interrupt you by opening it automatically

**Why We Use It**: Different needs at different times. List format is great for watching progress; HTML is great for investigating failures with screenshots and traces.

### timeout: 60000 (60 seconds)
**Technical**: Maximum time (in milliseconds) any single test can run before being terminated as a timeout failure.

**Plain English**: "If a test takes more than 60 seconds, something is wrong - kill it." Like a shot clock in basketball. E2E tests involve app startup, which is slower than unit tests, but 60 seconds is still generous.

**Why We Use It**: Electron app startup can take several seconds, and some tests may wait for animations or async operations. 60 seconds accommodates this while still catching hung tests.

### expect.timeout: 10000 (10 seconds)
**Technical**: Maximum time for individual assertions (expect statements) to resolve before failing.

**Plain English**: "When checking if something appeared on screen, wait up to 10 seconds before giving up." This is per-assertion, separate from the overall test timeout.

**Why We Use It**: UI elements may take time to render due to async data loading or animations. 10 seconds is patient but not absurdly long.

### trace: 'on-first-retry'
**Technical**: Records a detailed execution trace only when a test fails and is retried.

**Plain English**: A trace is like a black box flight recorder - it captures every action, screenshot, and network request. Generating traces for every test would be wasteful, so we only capture them when something goes wrong and needs investigation.

**Why We Use It**: Debugging efficiency. When a test fails, the trace provides a step-by-step replay showing exactly what happened.

### screenshot: 'only-on-failure'
**Technical**: Automatically captures a screenshot of the application window only when a test fails.

**Plain English**: "Take a photo of the crime scene." When things go wrong, you want to see what the screen looked like at that moment.

**Why We Use It**: Failure investigation. A screenshot often immediately reveals the problem (error dialog, wrong page, missing element).

### video: 'retain-on-failure'
**Technical**: Records video of the entire test execution but only saves it if the test fails.

**Plain English**: Like security camera footage that auto-deletes unless an incident occurs. Videos are large files, so we only keep the ones that might help debug failures.

**Why We Use It**: For complex failures, screenshots show the end state but videos show how we got there - invaluable for reproducing timing-related bugs.

### projects: [{ name: 'electron', testMatch: '**/*.e2e.ts' }]
**Technical**: Defines a single test project named "electron" that runs all files matching the `.e2e.ts` pattern.

**Plain English**: A "project" in Playwright can represent different browsers or configurations. LOGOS has just one: Electron. The pattern `**/*.e2e.ts` means "any file ending in `.e2e.ts` in any subdirectory."

**Why We Use It**: Keeps configuration simple while allowing future expansion. If mobile or web versions are added, they would become additional projects with different configurations.

---

## Configuration Decisions & Rationale

### Why Separate E2E from Unit Tests?

| Aspect | Unit Tests (Vitest) | E2E Tests (Playwright) |
|--------|--------------------|-----------------------|
| What they test | Individual functions | Complete user journeys |
| Speed | Milliseconds per test | Seconds per test |
| Dependencies | None (pure logic) | Built application, OS |
| Parallelism | Yes (isolated) | No (shared app state) |
| Location | `src/**/*.test.ts` | `e2e/**/*.e2e.ts` |

Keeping them separate allows each to use optimal configuration without compromise.

### Why Such Long Timeouts?

Unlike unit tests (10 second timeout), E2E tests allow 60 seconds because:
1. **App startup time**: Electron initialization takes 2-5 seconds
2. **Database initialization**: Prisma/SQLite setup on first run
3. **UI rendering**: React component hydration and data loading
4. **Animation completion**: Waiting for transitions to finish

### Why Record Videos/Screenshots Only on Failure?

Storage and performance. A single video file can be 10-50MB. Running 50 tests would generate gigabytes of video. By only retaining failure evidence, we get the debugging benefits without the storage explosion.

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for playwright.config.ts
- **Why**: Establish shadow documentation explaining E2E testing infrastructure
- **Impact**: Future developers can understand why Electron E2E testing is configured differently from typical web testing
