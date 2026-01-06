# Onboarding IPC Handlers Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/main/ipc/onboarding.ipc.ts`
> **Status**: Active

---

## Context & Purpose

This module serves as the backend controller for the user onboarding experience in LOGOS. It handles the critical first-time setup flow where new users configure their language learning goals and preferences. The module bridges the gap between the visual onboarding wizard (in the renderer process) and the database where user profiles and goals are persisted.

**Business Need**: Language learning is highly personal. A native English speaker learning Japanese for business purposes has fundamentally different needs than a Portuguese speaker learning English for medical certification. This module captures that personalization at the moment of first contact, ensuring every subsequent learning interaction is relevant and effective. Without proper onboarding, users would receive generic content that fails to address their specific challenges (like transfer errors from their native language) or goals (like passing a certification exam).

**When Used**:
- Application first launch to determine if onboarding is needed
- When a new user completes the onboarding wizard
- When a user chooses to skip onboarding (creates minimal profile)
- When resuming or editing an incomplete onboarding flow
- During application startup to route users appropriately (to onboarding vs. dashboard)

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`src/main/ipc/contracts.ts`**:
  - `registerDynamicHandler()` - Registers IPC handlers that the renderer process can invoke
  - `unregisterHandler()` - Cleans up handlers for testing or hot-reloading
  - `success()` / `error()` - Standard response wrappers ensuring consistent API contract

- **`src/main/db/client.ts`**:
  - `prisma` - The singleton Prisma client for database operations
  - Provides connection pooling and handles development hot-reload scenarios

- **`src/main/services/corpus-sources/corpus-pipeline.service.ts`**:
  - `populateVocabularyForGoal()` - Initiates background vocabulary population for the new goal
  - Called asynchronously to pre-load learning content while user enters the application

- **`prisma/schema.prisma`** (indirectly):
  - `User` model - Stores user profile with language preferences and theta ability estimates
  - `GoalSpec` model - Stores learning goal configuration (domain, modality, purpose, etc.)

### Dependents (What Needs This)

- **`src/main/ipc/index.ts`**: Should import and call `registerOnboardingHandlers()` during application initialization to make these handlers available

- **Renderer Process Components**:
  - `src/renderer/components/onboarding/OnboardingWizard.tsx` - Invokes `onboarding:complete` with collected user data
  - `src/renderer/pages/Onboarding.tsx` (or similar) - Invokes `onboarding:check-status` to determine routing
  - Application root/router - Uses `onboarding:check-status` to decide initial navigation

### Data Flow

```
Application Launch
        |
        v
Renderer calls ipcRenderer.invoke('onboarding:check-status')
        |
        v
[This Module] queries User table with goal count
        |
        +--- No user exists OR user has zero goals
        |           |
        |           v
        |    Returns { needsOnboarding: true }
        |           |
        |           v
        |    Renderer routes to OnboardingWizard
        |
        +--- User exists with goals
                    |
                    v
            Returns { needsOnboarding: false, userId: "..." }
                    |
                    v
            Renderer routes to Dashboard
```

```
User Completes Onboarding Wizard
        |
        v
Renderer calls ipcRenderer.invoke('onboarding:complete', OnboardingData)
        |
        v
[This Module] validates required fields
        |
        +--- Validation fails
        |           |
        |           v
        |    Returns error("Native and target languages are required")
        |
        +--- Validation passes
                    |
                    v
            Create or update User record (language preferences)
                    |
                    v
            Create GoalSpec record (domain, modality, purpose, etc.)
                    |
                    v
            Trigger populateVocabularyForGoal() in background
                    |
                    v
            Returns { userId, goalId, domain, modality, purpose, ... }
                    |
                    v
            Renderer navigates to Dashboard with new goal active
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at **Layer 2 (IPC Bridge)** of the LOGOS three-tier architecture:

```
+-------------------------------------------+
|  Layer 1: Renderer (React UI Components)  |
|  - OnboardingWizard.tsx                   |
|  - Language/Domain/Purpose selectors      |
|  - Progress indicators                    |
+-------------------------------------------+
                    |
                    | IPC Invoke/Handle
                    v
+-------------------------------------------+
|  Layer 2: IPC Bridge (THIS MODULE)        |  <-- You are here
|  - onboarding:check-status                |
|  - onboarding:complete                    |
|  - onboarding:skip                        |
|  - onboarding:get-user                    |
+-------------------------------------------+
                    |
                    | Database & Service Calls
                    v
+-------------------------------------------+
|  Layer 3: Business Logic & Data           |
|  - Prisma ORM (User, GoalSpec tables)     |
|  - Corpus Pipeline Service                |
|  - PMI Service (vocabulary metrics)       |
+-------------------------------------------+
```

### Big Picture Impact

The onboarding IPC module is the **genesis point** for the entire user experience. It creates the foundational data structures that every other system depends on:

| System | Dependency on Onboarding |
|--------|--------------------------|
| Learning Sessions | Require a `goalId` to fetch relevant language objects |
| Queue Building | Uses `domain` and `modality` to prioritize and filter items |
| IRT Difficulty Calibration | Uses native/target language pair to predict transfer errors |
| Claude Content Generation | Uses `domain`, `purpose`, and `benchmark` for contextual prompts |
| Progress Analytics | Tracks completion against goal specifications |
| Deadline Pacing | Uses `deadline` to calculate daily learning targets |
| Vocabulary Population | Uses goal specifications to select appropriate corpus sources |

**Without successful onboarding:**
- No User record exists (or has incomplete preferences)
- No GoalSpec exists to organize learning content
- No vocabulary is populated (empty learning queue)
- The application cannot provide any personalized learning experience

### Critical Path Analysis

**Importance Level**: Critical (Application Blocker)

- **If `onboarding:check-status` fails**: Application cannot determine initial routing. Users may be stuck on a loading screen or incorrectly routed.

- **If `onboarding:complete` fails**: Users complete the wizard but their data isn't saved. They may be forced to repeat onboarding or encounter errors when trying to start learning.

- **If vocabulary population fails**: The error is caught and logged but doesn't block the user. However, the learning queue will be empty until vocabulary is manually added or repopulated.

**Failure Modes**:
- Database connection failure: All handlers return errors
- Validation errors: Specific error messages guide user to fix input
- Background vocabulary population failure: Logged but non-blocking

**Graceful Degradation**:
- `onboarding:skip` provides an escape hatch for users who want to explore first
- Vocabulary population is fire-and-forget; the user can start using the app while it runs
- The skip flow creates a minimal user with sensible defaults (`en-US` for both languages)

---

## Handler Reference

| Channel | Purpose | Input | Output |
|---------|---------|-------|--------|
| `onboarding:check-status` | Determine if onboarding is needed | None | `OnboardingStatus` object |
| `onboarding:complete` | Finalize onboarding and create goal | `OnboardingData` | Created user and goal IDs with confirmation |
| `onboarding:skip` | Bypass onboarding with defaults | None | Minimal user ID with skip confirmation |
| `onboarding:get-user` | Retrieve user for resume/edit | None | User profile with active goal info or null |

### Handler Details

#### `onboarding:check-status`

Checks whether the current user needs to go through onboarding. Returns a comprehensive status object:

```typescript
interface OnboardingStatus {
  needsOnboarding: boolean;  // True if no user OR user has no goals
  hasUser: boolean;          // True if any user record exists
  hasGoals: boolean;         // True if user has at least one goal
  userId?: string;           // User ID if user exists
}
```

**Logic**: `needsOnboarding = !user || user._count.goals === 0`

This means onboarding is needed in two scenarios:
1. Fresh installation with no user
2. User exists but has no goals (possibly from previous incomplete setup)

#### `onboarding:complete`

The primary handler that processes the completed onboarding wizard. Performs:

1. **Validation**: Checks that all required fields are present (nativeLanguage, targetLanguage, domain, modality[], purpose)
2. **User Creation/Update**: Creates a new user or updates existing user with language preferences
3. **Goal Creation**: Creates a new GoalSpec with all collected parameters
4. **Vocabulary Initialization**: Triggers async vocabulary population based on goal

**Input Schema** (`OnboardingData`):
```typescript
{
  nativeLanguage: string;    // Required: e.g., 'en-US'
  targetLanguage: string;    // Required: e.g., 'ja-JP'
  domain: string;            // Required: e.g., 'medical'
  modality: string[];        // Required: e.g., ['reading', 'listening']
  purpose: string;           // Required: e.g., 'certification'
  benchmark?: string;        // Optional: e.g., 'CELBAN'
  deadline?: string;         // Optional: ISO date string
  dailyTime: number;         // Minutes per day commitment
}
```

#### `onboarding:skip`

Creates a minimal user profile with default values, allowing users to explore the application without completing full onboarding.

**Defaults Applied**:
- `nativeLanguage`: `'en-US'`
- `targetLanguage`: `'en-US'`
- All theta values: `0` (neutral ability estimate)

**Important**: Skipping creates a user but NO goal. The user will still need to create a goal before they can start learning sessions.

#### `onboarding:get-user`

Retrieves the current user profile along with their most recent active goal. Useful for:
- Resuming incomplete onboarding
- Editing existing preferences
- Pre-populating forms with current values

---

## Helper Functions

### `getDefaultGenre(domain, purpose)`

**Purpose**: Derives an appropriate genre/writing style based on the user's domain and purpose selections.

**Plain English**: When a user says they're learning medical English for certification purposes, we don't just teach them medical words - we teach them in the style of clinical documentation they'll encounter on exams. This function maps that intent.

**Domain-Purpose Matrix**:
| Domain | Certification | Professional | Academic | Default |
|--------|--------------|--------------|----------|---------|
| medical | clinical documentation | patient communication | medical research | healthcare terminology |
| legal | legal documentation | client communication | legal research | legal terminology |
| business | business communication | professional correspondence | business analysis | business terminology |
| academic | academic writing | scholarly communication | research papers | academic discourse |
| technology | technical documentation | technical communication | technical research | technical terminology |
| travel | - | - | - | travel communication |
| general | - | - | - | everyday communication |

### `getInitialVocabSize(dailyTime, purpose)`

**Purpose**: Calculates how many vocabulary items to initially populate based on user commitment and urgency.

**Plain English**: If a user commits to 30 minutes daily for a certification exam, they need more vocabulary faster than someone doing 10 minutes for personal enjoyment. This function estimates a 4-week vocabulary target.

**Calculation**:
```
wordsPerSession = dailyTime * 3  (estimate: 3 words learned per minute with review)
initialDays = 28                  (4 weeks of content)
multiplier = purposeMultipliers[purpose]  (1.5 for certification, 1.0 for personal)

targetVocabSize = wordsPerSession * initialDays * multiplier
```

**Purpose Multipliers**:
| Purpose | Multiplier | Rationale |
|---------|------------|-----------|
| certification | 1.5 | Exam prep requires broader vocabulary |
| immigration | 1.4 | Official contexts need comprehensive language |
| academic | 1.3 | Research/writing needs specialized terms |
| professional | 1.2 | Work contexts need domain coverage |
| personal | 1.0 | Baseline, relaxed pace |

---

## Technical Concepts (Plain English)

### First-User Assumption

**Technical**: The module uses `findFirst()` without a user ID, assuming a single-user desktop application model.

**Plain English**: LOGOS is designed for personal use on your own computer. Instead of having login systems with multiple accounts, it assumes "the user" is whoever is using this computer. When we look for the user, we just grab the first (and usually only) user record.

**Why We Use It**: Simplifies the architecture for a desktop application. No need for authentication, sessions, or user switching. The complexity of multi-user support would distract from the core language learning mission.

### Background Vocabulary Population

**Technical**: The `populateVocabularyForGoal()` call is made without `await`, allowing the main flow to return immediately while vocabulary population runs asynchronously. Errors are caught and logged but don't affect the response.

**Plain English**: Creating vocabulary for a new goal can take several seconds (querying corpus sources, computing metrics). Instead of making the user wait staring at a spinner, we start that work in the background and let them explore the app immediately. If something goes wrong, we log it for developers but don't crash the user's experience.

**Why We Use It**: Better perceived performance. Users can start interacting with LOGOS right away while content loads. The learning queue will populate progressively.

### Validation Before Database Operations

**Technical**: Required fields are validated with explicit error messages before any database calls are made.

**Plain English**: Before we try to save anything, we check that you've filled in all the essential information. If something's missing, we tell you exactly what it is ("Native and target languages are required") rather than letting the database throw a cryptic error.

**Why We Use It**: User-friendly error handling. Database constraint violations produce technical messages that confuse users. Explicit validation produces actionable guidance.

### Upsert Pattern for User Record

**Technical**: The completion handler uses a `findFirst` + conditional `update`/`create` pattern rather than `upsert` to handle existing vs. new users.

**Plain English**: If you've already started using LOGOS and come back to onboarding (maybe to add a new language), we don't create a duplicate account. We find your existing profile and update it with the new language preferences while keeping all your learning history intact.

**Why We Use It**: Data integrity. Users shouldn't lose their theta ability estimates or session history just because they're adding a new learning goal.

---

## Data Type Definitions

### OnboardingData (Input)

The data structure received from the onboarding wizard:

```typescript
interface OnboardingData {
  nativeLanguage: string;   // Locale code: 'en-US', 'pt-BR', 'ja-JP'
  targetLanguage: string;   // Locale code for language being learned
  domain: string;           // Focus area: 'medical', 'legal', 'business', etc.
  modality: string[];       // Skills: ['reading', 'writing', 'listening', 'speaking']
  purpose: string;          // Goal type: 'certification', 'professional', etc.
  benchmark?: string;       // Specific exam: 'CELBAN', 'IELTS', 'TOEFL'
  deadline?: string;        // Target date: ISO 8601 format
  dailyTime: number;        // Commitment: minutes per day (5-60)
}
```

### OnboardingStatus (Output)

The status structure returned by the check handler:

```typescript
interface OnboardingStatus {
  needsOnboarding: boolean; // Should user be routed to wizard?
  hasUser: boolean;         // Does any user record exist?
  hasGoals: boolean;        // Does user have learning goals?
  userId?: string;          // User ID if exists
}
```

---

## Database Impact

### User Table Effects

When `onboarding:complete` runs:
- **New user**: Creates record with language preferences, all theta values at 0
- **Existing user**: Updates `nativeLanguage` and `targetLanguage` only

### GoalSpec Table Effects

Creates a new goal with:
- `domain`: Lowercased from input
- `modality`: JSON stringified array (lowercased)
- `genre`: Derived from `getDefaultGenre()`
- `purpose`: From input
- `benchmark`: Optional, trimmed
- `deadline`: Optional, parsed as Date
- `completionPercent`: 0 (just starting)
- `isActive`: true (new goal is active by default)

### Cascade Effects

After goal creation:
1. `populateVocabularyForGoal()` creates `LanguageObject` records
2. PMI service computes `Collocation` records and updates metrics
3. IRT service calculates initial difficulty estimates

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for onboarding.ipc.ts
- **Why**: Shadow documentation required for all code files per project CLAUDE.md specifications
- **Impact**: Provides context for future developers and AI agents working on onboarding flow

### Initial Implementation (prior to documentation)
- **What Changed**: Four IPC handlers for onboarding flow management
- **Why**: New users need guided setup to create personalized learning goals
- **Impact**: Enables the entire LOGOS learning experience by capturing essential user preferences and bootstrapping the first learning goal

---

## Notes & Observations

### Single-User Assumption

The module uses `findFirst()` for user queries, assuming a single-user desktop application. If LOGOS ever supports multiple user profiles on one machine, this would need refactoring to accept user identification.

### Vocabulary Population is Fire-and-Forget

The `populateVocabularyForGoal()` call doesn't block the response. While this improves perceived performance, it means:
- The learning queue may be empty immediately after onboarding
- Users might need to wait or refresh before seeing vocabulary
- Population errors are only visible in logs, not to users

Consider adding a status endpoint or notification system for population progress in future iterations.

### Language Storage Location

Both `nativeLanguage` and `targetLanguage` are stored on the User model, not the GoalSpec. This means:
- Language pair is shared across all goals for a user
- Changing onboarding would affect all existing goals
- To support multiple language pairs, architecture would need revision

### Genre Derivation

The `getDefaultGenre()` function hardcodes genre mappings. As the application grows, this might need:
- Database-driven genre configuration
- User customization options
- More granular genre options within domains
