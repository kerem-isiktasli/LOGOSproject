# Electron Test Helper Module

> **Last Updated**: 2026-01-05
> **Code Location**: `e2e/electron.helper.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to bridge the gap between Playwright (a browser automation framework) and Electron (a desktop application framework). Standard Playwright is designed for testing web applications in browsers, but LOGOS is an Electron desktop application - which means it needs special handling to launch, control, and interact with during automated testing.

**Business Need**: Quality assurance for a language learning application is critical. Users trust the app with their learning progress, vocabulary data, and study schedules. Automated end-to-end testing ensures that the application works correctly from a user's perspective - clicking buttons, filling forms, navigating between screens - before any code reaches production.

**When Used**: This helper is invoked at the start of every E2E test suite. It launches the LOGOS application in a controlled test environment, provides utilities for common testing operations, and ensures clean shutdown after tests complete.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `playwright` (external package): Provides the `_electron` launcher and `Page`/`ElectronApplication` types - the core infrastructure for automating Electron apps
- `path` (Node.js built-in): Constructs cross-platform file paths to locate the compiled application entry point
- `out/main/index.js`: The compiled Electron main process entry point - this is what gets launched when tests run

### Dependents (What Needs This)

- **E2E test files** (planned/future): All E2E test specs will import `launchApp()`, `closeApp()`, and other utilities from this module
- **CI/CD pipeline**: Automated testing workflows will invoke this module to run full application tests before deployment

### Data Flow

```
Test Suite Starts
       |
       v
launchApp() called
       |
       v
electron.launch() spawns LOGOS app with test environment variables
       |
       v
App opens first window (BrowserWindow via src/main/index.ts)
       |
       v
waitForLoadState('domcontentloaded') ensures UI is ready
       |
       v
Tests execute using Page object to interact with UI
       |
       v
cleanupTestData() removes test artifacts from database
       |
       v
closeApp() terminates the Electron process
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Testing Infrastructure Layer**, which exists parallel to but outside of the main application architecture:

```
+--------------------------------------------------+
|  Testing Infrastructure (You Are Here)           |
|  +-----------------+  +------------------------+ |
|  | electron.helper |->| Playwright Test Runner | |
|  +-----------------+  +------------------------+ |
+--------------------------------------------------+
          |
          | Launches & Controls
          v
+--------------------------------------------------+
|  LOGOS Application                               |
|  +------------+  +-------------+  +-----------+  |
|  | Main       |->| Preload     |->| Renderer  |  |
|  | Process    |  | Bridge      |  | (React)   |  |
|  +------------+  +-------------+  +-----------+  |
+--------------------------------------------------+
```

The helper acts as a **test harness** - it wraps the entire LOGOS application and provides controlled access for automated testing.

### Big Picture Impact

This module is foundational to LOGOS's testing strategy. It enables:

- **Regression Testing**: Automatically verify that new code changes don't break existing features
- **User Journey Validation**: Test complete workflows like "create a goal, add vocabulary, study a session"
- **Cross-Platform Confidence**: Ensure the Electron app works correctly on Windows, macOS, and Linux
- **Continuous Integration**: Block deployments if critical user flows are broken

**Dependencies**: The entire E2E test suite depends on this module functioning correctly. Without it, there is no automated way to test the full application stack from the user's perspective.

### Critical Path Analysis

**Importance Level**: High (for development workflow)

- **If this fails**: E2E tests cannot run, CI/CD pipeline blocks, team loses confidence in automated testing
- **Failure mode**: Tests hang, crash, or produce false positives/negatives
- **Backup**: Manual testing (slow, expensive, error-prone)

---

## Technical Concepts (Plain English)

### Electron Launch Context

**Technical**: An `ElectronApplication` instance combined with a `Page` object that represents the first browser window opened by the Electron app.

**Plain English**: Think of it like a remote control for the LOGOS app. The `app` is the remote for the whole application (can close it, access system features), while the `window` is the remote for what you see on screen (can click buttons, fill text fields, read displayed text).

**Why We Use It**: We need both levels of control - sometimes tests need to interact with the UI, other times they need to control the application lifecycle itself.

### Test Database Isolation

**Technical**: The helper sets `DATABASE_URL: 'file:./test.db'` to use a separate SQLite database file during tests.

**Plain English**: Like having a practice whiteboard that's separate from the real presentation board. Tests can create goals, add vocabulary, and make changes without affecting any real user data. After tests, this practice board can be erased completely.

**Why We Use It**: Tests must be **isolated** - they should never affect production data, and running tests multiple times should produce consistent results. Using a separate database ensures tests don't interfere with real user data.

### Environment Variable Injection

**Technical**: Passing `NODE_ENV: 'test'` through Electron's launch environment, merged with `process.env`.

**Plain English**: Like putting on a "test mode" sticker on the application. When the app sees this sticker, it knows it's being tested and may behave slightly differently (disable analytics, skip intro animations, use test API keys).

**Why We Use It**: The application may need to behave differently during testing - shorter timeouts, mock external services, disable rate limiting - and this environment flag enables that conditional behavior.

### Data-TestId Selectors

**Technical**: Using `[data-testid="app-root"]` selectors to find elements instead of CSS classes or text content.

**Plain English**: Like putting permanent name tags on UI elements that never change, even if the visual design changes. CSS classes might change when we redesign the UI, but test IDs remain stable because their only purpose is to help tests find elements.

**Why We Use It**: Creates **stable selectors** that don't break when the UI team changes styling. The contract between code and tests is explicit: "this element will always have this test ID."

### Wait for Load State

**Technical**: `window.waitForLoadState('domcontentloaded')` pauses test execution until the DOM is fully parsed and ready.

**Plain English**: Like waiting for a webpage to finish loading before trying to click anything. The helper ensures the app is actually ready before tests start interacting with it, preventing "element not found" errors from tests that run too fast.

**Why We Use It**: Electron apps have a startup sequence - launch process, create window, load HTML, run JavaScript, render React. Tests need to wait for this sequence to complete before they can reliably interact with the UI.

### LOGOS API Bridge Check

**Technical**: The `isLogosAPIAvailable()` function checks if `window.logos` is defined in the renderer context.

**Plain English**: Like checking if the phone line is connected before trying to make a call. The `window.logos` object is how the UI talks to the database and backend logic. If it's not there, nothing will work.

**Why We Use It**: The preload script injects the `logos` API into the renderer. This check verifies that the secure bridge between frontend and backend is established before tests try to use it.

---

## Key Functions Explained

### launchApp()

**Purpose**: Start the LOGOS application fresh for a test suite

**Returns**: An `ElectronTestContext` containing both the app controller and the window page object

**Key Detail**: Sets up the test environment with isolated database and test mode flag

### closeApp(context)

**Purpose**: Gracefully shut down the Electron application after tests complete

**Key Detail**: Ensures no zombie processes are left running after test suite finishes

### waitForAppReady(window)

**Purpose**: Wait for React to mount and the application to be fully interactive

**Key Detail**: Uses a 30-second timeout - generous enough for slow CI machines, fast enough to fail quickly if something is genuinely broken

### navigateTo(window, route)

**Purpose**: Programmatically navigate to different pages/routes in the app without clicking through menus

**Key Detail**: Uses React Router's history API directly, simulating navigation without UI interaction

### createTestGoal(window, name, targetLanguage, nativeLanguage)

**Purpose**: Create a learning goal through the UI as a test user would

**Key Detail**: Interacts with form elements using test IDs, providing a reusable "test fixture" for any test that needs a goal to exist

### cleanupTestData(window)

**Purpose**: Delete all test data from the database to ensure clean state between tests

**Key Detail**: Uses the `window.logos` API directly from the renderer context to perform bulk deletion

---

## Change History

### 2026-01-05 - Initial Implementation

- **What Changed**: Created the Electron test helper with core utilities (launch, close, navigation, goal creation, cleanup)
- **Why**: Enable E2E testing of the LOGOS Electron application using Playwright
- **Impact**: Establishes the foundation for the entire E2E test suite
