# Vitest Configuration

> **Last Updated**: 2026-01-04
> **Code Location**: `vitest.config.ts`
> **Status**: Active

---

## Context & Purpose

This configuration file defines how Vitest (the testing framework) runs automated tests across the LOGOS application. It solves the critical need for reliable, fast, and consistent test execution that verifies the core algorithms and business logic work correctly.

**Business Need**: LOGOS uses sophisticated adaptive learning algorithms (IRT, FSRS, PMI) that must produce mathematically correct results. Without automated testing, any code change could silently break the learning algorithms, leading to incorrect difficulty assessments or scheduling - which would degrade the entire user learning experience.

**When Used**:
- Every time a developer runs `npm test` or `npm run test:coverage`
- During continuous integration (CI) pipelines
- When developers want to verify their changes haven't broken existing functionality

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)
- `vitest/config`: defineConfig() - Provides type-safe configuration structure for Vitest
- `path` (Node.js built-in): path.resolve() - Constructs absolute paths for module aliases

### Dependents (What Needs This)
- `package.json`: Scripts `test` and `test:coverage` invoke Vitest which reads this configuration
- All test files in `src/**/*.{test,spec}.{ts,tsx}`: These are discovered and executed based on the `include` pattern
- Test files currently discovered:
  - `src/core/__tests__/irt.test.ts` - Item Response Theory algorithm tests
  - `src/core/__tests__/fsrs.test.ts` - Free Spaced Repetition Scheduler tests
  - `src/core/__tests__/pmi.test.ts` - Pointwise Mutual Information tests
  - `src/core/__tests__/priority.test.ts` - Priority calculation tests
  - `src/core/__tests__/bottleneck.test.ts` - Bottleneck detection tests
  - `src/core/__tests__/g2p.test.ts` - Grapheme-to-phoneme conversion tests
  - `src/core/__tests__/morphology.test.ts` - Morphological analysis tests

### Configuration Relationships
- `tsconfig.json`: The path aliases defined here (`@`, `@core`, `@main`, `@renderer`, `@shared`) mirror those in TypeScript config to ensure tests can import modules the same way as production code

### Data Flow
```
Developer runs `npm test`
    --> Vitest loads this config file
    --> Discovers test files matching include patterns
    --> Excludes node_modules, dist, .git
    --> Sets up Node.js environment
    --> Resolves import aliases during test execution
    --> Runs tests with 10-second timeout
    --> Reports results (and coverage if requested)
```

---

## Macroscale: System Integration

### Architectural Layer
This configuration sits in the **Development Infrastructure Layer** of the LOGOS architecture:

```
User-Facing Layers:
  - Layer 1: Renderer (React UI)
  - Layer 2: Main Process (Electron IPC, Services)
  - Layer 3: Core Algorithms (IRT, FSRS, PMI)
  - Layer 4: Database (Prisma + SQLite)

Development Infrastructure:
  - **Vitest Config** (YOU ARE HERE) - Test execution
  - TypeScript Config - Type checking
  - ESLint Config - Code quality
  - Electron-Vite Config - Build tooling
```

### Big Picture Impact
This configuration is the **quality gate** for the entire codebase. It ensures:

1. **Algorithm Correctness**: The core learning algorithms (IRT for ability estimation, FSRS for scheduling, PMI for collocation detection) are mathematically verified
2. **Regression Prevention**: Changes to any part of the system are validated against existing behavior
3. **Developer Confidence**: Engineers can refactor code knowing tests will catch breaking changes

### Critical Path Analysis
**Importance Level**: High (Development Infrastructure)

- **If this fails**: Tests cannot run, breaking the feedback loop developers rely on
- **If misconfigured**: Tests might pass incorrectly (false positives) or fail to find bugs (false negatives)
- **Coverage scope**: Specifically targets `src/core/**/*.ts` - the algorithm layer - because errors there have the highest user impact

**Why Core-Only Coverage?**
The coverage configuration deliberately focuses on `src/core/**/*.ts` because:
- Core algorithms are pure functions with deterministic outputs - ideal for unit testing
- UI components (renderer) are better tested with integration/E2E tests
- Service layer (main) involves side effects that require mocking

---

## Technical Concepts (Plain English)

### globals: true
**Technical**: Injects Vitest's test functions (`describe`, `it`, `expect`) into the global scope without explicit imports.

**Plain English**: Instead of writing `import { describe, it, expect } from 'vitest'` at the top of every test file, these functions are automatically available everywhere - like how `console.log` is always available without importing it.

**Why We Use It**: Reduces boilerplate in test files, making them cleaner and faster to write.

### environment: 'node'
**Technical**: Configures the test runtime to use a Node.js environment rather than a browser-like environment (jsdom).

**Plain English**: Tests run as if they're executing on a server (Node.js) rather than in a web browser. This is appropriate because the core algorithms don't need browser features like `window` or `document`.

**Why We Use It**: The core algorithms are pure TypeScript/JavaScript logic - they calculate numbers and transform data. They don't touch the DOM or browser APIs.

### coverage.provider: 'v8'
**Technical**: Uses the V8 JavaScript engine's built-in code coverage capabilities to track which lines of code are executed during tests.

**Plain English**: Like a highlighter that marks every line of code your tests actually run. V8 is the engine that powers Node.js and Chrome, so it can track coverage natively without additional tools.

**Why We Use It**: V8 coverage is fast and accurate because it's built into the JavaScript engine itself, rather than being bolted on top.

### coverage.reporter: ['text', 'json', 'html']
**Technical**: Generates coverage reports in three formats: terminal output, machine-readable JSON, and browsable HTML.

**Plain English**:
- `text`: Shows coverage summary right in your terminal when tests finish
- `json`: Creates data that CI systems can parse to track coverage over time
- `html`: Generates a mini-website you can open to see exactly which lines are covered (green) or missed (red)

**Why We Use It**: Different audiences need different formats - developers want terminal output, CI wants JSON, code reviewers want HTML visualization.

### Path Aliases (@, @core, @main, @renderer, @shared)
**Technical**: Configures module resolution to map shorthand paths to absolute directory locations.

**Plain English**: Instead of writing messy relative imports like `../../../core/fsrs`, you can write clean imports like `@core/fsrs`. It's like setting up speed dial on your phone - `@core` always means "go to the src/core folder."

**Why We Use It**:
1. Makes imports readable and consistent
2. Prevents "import hell" when files are nested deeply
3. Mirrors the TypeScript config so imports work the same in tests and production

### testTimeout / hookTimeout: 10000
**Technical**: Sets maximum execution time (in milliseconds) for individual tests and setup/teardown hooks.

**Plain English**: If any single test takes longer than 10 seconds, Vitest considers it "stuck" and fails it. This prevents tests from hanging forever if something goes wrong.

**Why We Use It**: The core algorithms should compute results in milliseconds. A 10-second timeout is generous but catches infinite loops or unresolved promises.

---

## Configuration Decisions & Rationale

### Why Exclude Coverage for Test Files?
```typescript
exclude: [
  'src/core/**/*.test.ts',
  'src/core/**/*.spec.ts',
  'src/core/types.ts',
]
```
- **Test files**: Measuring coverage of test code itself is meaningless - tests are the measuring stick, not what's being measured
- **types.ts**: Type definition files have no runtime code to cover - they're compile-time only

### Why Include Pattern Uses Both .test and .spec?
```typescript
include: ['src/**/*.{test,spec}.{ts,tsx}']
```
Different developers have different naming preferences. Supporting both conventions:
- `.test.ts` - Common in Jest/Vitest ecosystems
- `.spec.ts` - Common in Jasmine/Angular ecosystems

This flexibility prevents naming convention debates and welcomes contributors from various backgrounds.

---

## Change History

### 2026-01-04 - Initial Documentation
- **What Changed**: Created narrative documentation for vitest.config.ts
- **Why**: Establish shadow documentation explaining the testing infrastructure
- **Impact**: Future developers can understand testing setup without reverse-engineering the config

