# OnboardingWizard

> **Last Updated**: 2026-01-04
> **Code Location**: `src/renderer/components/onboarding/OnboardingWizard.tsx`
> **Status**: Active

---

## Context & Purpose

The OnboardingWizard is the first meaningful interaction new users have with LOGOS. It transforms what could be an overwhelming setup process into a guided, step-by-step journey that collects all the information needed to create a personalized learning goal.

**Business Need**: Language learning applications fail when they present generic content. Users need personalized curricula tailored to their native language (which affects transfer patterns and common errors), their target domain (medical terminology vs. business vocabulary), and their specific purpose (certification exam vs. personal growth). This wizard captures all that context upfront, ensuring the learning experience is relevant from day one.

**When Used**:
- First-time application launch when no goals exist
- When a user explicitly requests to set up a new learning goal
- Can be skipped if the user wants to explore the interface first (via `onSkip` callback)

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `src/renderer/components/ui/GlassCard.tsx`: Container component providing the glassmorphism card styling that wraps the wizard content
- `src/renderer/components/ui/GlassButton.tsx`: Button component for navigation actions (Continue, Back, Skip, Start Learning)
- `src/renderer/components/ui/GlassInput.tsx`: Text/date input component used for benchmark exam name and deadline date entry
- `src/renderer/components/ui/GlassProgress.tsx`: Progress bar component showing wizard completion percentage

### Dependents (What Needs This)

- **Parent Page/Route Component** (likely `src/renderer/pages/Onboarding.tsx` or similar): Renders the OnboardingWizard and provides:
  - `onComplete`: Async callback that receives the `OnboardingData` object and creates the goal via IPC
  - `onSkip`: Optional callback to bypass onboarding and enter the main application

- **Goal Creation Flow**: The `onComplete` callback bridges to the goal system:
  - Calls `window.logos.goal.create()` or invokes IPC channel `goal:create`
  - Data is transformed from `OnboardingData` shape to `GoalCreateRequest` shape

### Data Flow

```
User selections (step by step)
    |
    v
OnboardingData state object (accumulated)
    |
    v
onComplete(data) callback invoked
    |
    v
IPC: goal:create channel
    |
    v
src/main/ipc/goal.ipc.ts: registerHandler('goal:create', ...)
    |
    v
src/main/db/repositories/goal.repository.ts: createGoal()
    |
    v
Prisma: GoalSpec table insert
    |
    v
Goal ID returned, user redirected to dashboard/first session
```

---

## Macroscale: System Integration

### Architectural Layer

This component sits at the **Presentation Layer** of the LOGOS three-tier architecture:

- **Layer 1: Presentation (UI)** - This wizard, React components, user interactions
- **Layer 2: Application Logic (Main Process)** - IPC handlers, goal creation business logic
- **Layer 3: Data Persistence (SQLite)** - GoalSpec table storage via Prisma ORM

The wizard is purely a data collection interface. It performs no business logic itself. All validation of domain values, modality arrays, and goal creation happens in the main process via IPC handlers.

### Big Picture Impact

The OnboardingWizard is the **genesis point** of the entire learning experience. Every subsequent LOGOS feature depends on having a properly configured goal:

| Feature | Dependency on Goal |
|---------|-------------------|
| Learning Sessions | Require `goalId` to fetch language objects |
| Queue Building | Uses `domain` and `modality` to prioritize items |
| IRT Difficulty Calibration | Tailored to user's native/target language pair |
| Content Generation (Claude) | Uses `domain` and `purpose` for context |
| Progress Analytics | Tracks completion against goal benchmarks |
| Deadline Tracking | Uses `deadline` field for pacing calculations |

**Without this wizard completing successfully, users cannot:**
- Start any learning sessions
- View any language objects
- Track any progress
- Receive any personalized content

### Critical Path Analysis

**Importance Level**: Critical (Blocker)

- **If this fails**: Users are stuck at the entry point with no way to create goals. The entire application becomes non-functional for new users.
- **Failure modes**:
  - UI rendering failure: User sees blank/broken page
  - State management error: Selections don't persist between steps
  - IPC failure on submit: Goal creation fails silently or with cryptic error
- **Backup mechanisms**:
  - `onSkip` allows exploration without completing onboarding
  - Goals can theoretically be created via developer tools / direct IPC calls (not user-friendly)

---

## Step Flow Architecture

### The Seven Steps

The wizard implements a **linear state machine** with seven discrete steps:

| Step Index | Step Key | Purpose | Required Data |
|------------|----------|---------|---------------|
| 0 | `welcome` | Introduce LOGOS features and philosophy | None (informational) |
| 1 | `native` | Capture user's native language | `nativeLanguage` |
| 2 | `target` | Capture target learning language | `targetLanguage` |
| 3 | `domain` | Select focus area (medical, business, etc.) | `domain` |
| 4 | `purpose` | Select learning purpose and skill modalities | `purpose`, `modality[]` |
| 5 | `schedule` | Configure daily time commitment and deadlines | `dailyTime`, optional `benchmark`, `deadline` |
| 6 | `confirm` | Review all selections before submission | None (review only) |

### Step Validation Rules

Each step enforces validation before allowing progression:

```
welcome    -> Always valid (informational step)
native     -> Valid when nativeLanguage is non-empty
target     -> Valid when targetLanguage is non-empty
domain     -> Valid when domain is selected (has default: 'general')
purpose    -> Valid when purpose selected AND modality array has 1+ items
schedule   -> Valid when dailyTime >= 5 minutes
confirm    -> Always valid (review step)
```

The `canProceed()` function implements this logic, disabling the "Continue" button until requirements are met.

---

## Data Structures

### OnboardingData Interface

The wizard accumulates user selections into a single state object:

```typescript
interface OnboardingData {
  nativeLanguage: string;    // e.g., 'en-US', 'pt-BR'
  targetLanguage: string;    // e.g., 'es-ES', 'ja-JP'
  domain: string;            // 'general' | 'medical' | 'business' | 'legal' | 'academic' | 'technology' | 'travel'
  modality: string[];        // ['reading', 'writing', 'listening', 'speaking'] - at least one required
  purpose: string;           // 'certification' | 'professional' | 'academic' | 'immigration' | 'personal'
  benchmark?: string;        // Optional: specific exam name like 'CELBAN', 'IELTS', 'TOEFL'
  deadline?: string;         // Optional: ISO date string for target completion
  dailyTime: number;         // Minutes per day committed (5-60, default: 15)
}
```

### Transformation to GoalCreateRequest

When `onComplete` is called, the parent component transforms `OnboardingData` to match the IPC contract:

| OnboardingData Field | GoalCreateRequest Field | Notes |
|---------------------|------------------------|-------|
| `domain` | `domain` | Direct mapping |
| `modality` | `modality` | Direct mapping (array) |
| `purpose` | `purpose` | Direct mapping |
| `purpose` | `genre` | May use purpose or derive from context |
| `benchmark` | `benchmark` | Optional, passed through |
| `deadline` | `deadline` | Optional, converted to ISO string |

**Note**: The `nativeLanguage`, `targetLanguage`, and `dailyTime` fields are captured but their persistence location depends on user profile settings vs. goal-specific storage. The current goal schema stores domain/modality/purpose but language pair may be stored at user level.

### Static Configuration Data

The wizard defines four constant arrays that populate selection options:

**LANGUAGES** (14 options)
- Locale codes with regional variants (e.g., 'en-US' vs 'en-GB', 'es-ES' vs 'es-MX')
- Display includes flag emoji and full name
- Target language selection filters out the chosen native language

**DOMAINS** (7 options)
- General, Medical/Healthcare, Business, Legal, Academic, Technology, Travel
- Each has icon, name, and description
- Controls vocabulary prioritization and content generation context

**PURPOSES** (5 options)
- Certification Exam, Professional Development, Academic Studies, Immigration, Personal Growth
- Affects pacing, benchmark tracking, and urgency calculations

**MODALITIES** (4 options)
- Reading, Writing, Listening, Speaking
- Multi-select (at least one required)
- Drives task type generation and skill balancing

---

## Technical Concepts (Plain English)

### State Machine Navigation

**Technical**: The component implements a finite state machine using React's `useState` hook where each step is a discrete state, and transitions are controlled by the `goNext()` and `goBack()` callbacks.

**Plain English**: Think of the wizard like filling out a multi-page form where you can go forward and backward. The "step" variable is like knowing which page you're on, and the buttons move you between pages. You can't skip ahead, and going back keeps your previous answers.

**Why We Use It**: Linear wizards reduce cognitive load. Users focus on one decision at a time instead of being overwhelmed by a complex form with 10+ fields.

### Controlled Components with Derived State

**Technical**: Each selection button updates the `data` state object via `updateData()`, and the selected state is derived by comparing `data.field === optionValue`. This is the "single source of truth" pattern.

**Plain English**: When you click a language button, it doesn't turn green on its own. Instead, it updates a central "answer sheet" and then all buttons check that answer sheet to decide if they should look selected. This ensures the visual state always matches the actual data.

**Why We Use It**: Prevents UI bugs where a button looks selected but the data wasn't actually saved. What you see is guaranteed to be what gets submitted.

### Progress Calculation

**Technical**: `progress = (currentIndex / (steps.length - 1)) * 100` calculates percentage completion, where the welcome step is index 0 and confirm step is the final state.

**Plain English**: The progress bar fills up evenly as you complete each step. If there are 7 steps (indices 0-6), completing step 3 means you're 50% done (3/6 = 0.5 = 50%).

**Why We Use It**: Provides users with a sense of accomplishment and sets expectations for how much remains. Research shows progress indicators increase form completion rates.

### Async Completion Handler

**Technical**: `handleComplete()` sets a loading state, awaits the `onComplete(data)` promise, and handles success/failure. The loading state prevents double-submission and shows visual feedback.

**Plain English**: When you click "Start Learning", the button changes to "Creating..." and becomes disabled. This prevents you from accidentally clicking it twice (which could create duplicate goals). The button stays disabled until the goal is successfully created in the database.

**Why We Use It**: Network operations and database writes can fail or be slow. Users need feedback that something is happening, and the system needs protection against duplicate submissions.

---

## Integration with Goal System

### The Goal Creation Bridge

The OnboardingWizard doesn't directly create goals. Instead, it delegates to its parent via the `onComplete` callback. This separation of concerns means:

1. **Wizard responsibility**: Collect and validate user input
2. **Parent responsibility**: Transform data and invoke IPC
3. **Main process responsibility**: Business logic, database operations

This pattern allows the wizard to be:
- Tested in isolation with mock callbacks
- Reused in different contexts (new user vs. adding another goal)
- Decoupled from IPC implementation details

### Goal Creation via IPC

When `onComplete(data)` is called, the typical flow in the parent component:

```
const handleOnboardingComplete = async (data: OnboardingData) => {
  await window.logos.goal.create({
    domain: data.domain,
    modality: data.modality,
    genre: data.purpose,  // or derive appropriately
    purpose: data.purpose,
    benchmark: data.benchmark,
    deadline: data.deadline,
  });

  // Store user preferences
  await window.logos.profile.updateSettings({
    dailyGoalMinutes: data.dailyTime,
    // nativeLanguage and targetLanguage may be stored here
  });

  // Navigate to dashboard
  navigate('/dashboard');
};
```

### Database Schema Alignment

The `GoalSpec` table (managed via Prisma) stores:

| Column | Type | From OnboardingData |
|--------|------|---------------------|
| `id` | UUID | Auto-generated |
| `userId` | UUID | From authenticated user (or default user) |
| `domain` | String | `data.domain` |
| `modality` | String (JSON) | `JSON.stringify(data.modality)` |
| `genre` | String | Derived from purpose/domain |
| `purpose` | String | `data.purpose` |
| `benchmark` | String? | `data.benchmark` |
| `deadline` | DateTime? | `data.deadline` parsed |
| `completionPercent` | Float | Initialized to 0 |
| `isActive` | Boolean | Initialized to true |

---

## Change History

### 2026-01-04 - Initial Documentation
- **What Changed**: Created narrative documentation for OnboardingWizard component
- **Why**: Shadow documentation required for all code files per CLAUDE.md specifications
- **Impact**: Provides context for future developers and AI agents working on onboarding flow

### Initial Implementation (prior to documentation)
- **What Changed**: Multi-step wizard with 7 steps, glassmorphism UI, language/domain/purpose selection
- **Why**: New users need guided setup to create personalized learning goals
- **Impact**: Enables the entire LOGOS learning experience by capturing essential user preferences
