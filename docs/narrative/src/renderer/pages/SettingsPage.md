# SettingsPage

> **Last Updated**: 2026-01-05
> **Code Location**: `src/renderer/pages/SettingsPage.tsx`
> **Status**: Active

---

## Context & Purpose

This module serves as the central hub for user customization within the LOGOS language learning application. It exists because effective learning is deeply personal - what works for one learner may frustrate another. The SettingsPage empowers users to tailor their learning experience to match their goals, preferences, and daily routines.

**Business Need**: Users need control over how the application behaves to maintain long-term engagement. Without personalization, a one-size-fits-all approach leads to user frustration and abandonment. Research shows that learners who can customize their study sessions are significantly more likely to maintain consistent practice habits.

**When Used**:
- During initial application setup (first-time users configuring their experience)
- When users want to adjust their daily learning goals (increasing or decreasing commitment)
- When notification or sound preferences need updating
- When switching between light/dark themes or following system preferences
- When users want to export their learning data for backup or analysis
- When resetting preferences to factory defaults after experimentation

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**UI Components:**
- `src/renderer/components/ui/GlassCard.tsx`: `GlassCard` - Provides the translucent card containers that group related settings into visually cohesive sections (Learning Preferences, Notifications, Appearance, etc.)
- `src/renderer/components/ui/GlassButton.tsx`: `GlassButton` - Renders all interactive buttons including "Save Changes", data management actions, and "Reset to Defaults"
- `src/renderer/components/ui/GlassInput.tsx`: `GlassInput` - Imported but not currently used (reserved for potential future text input settings)

**Type Definitions:**
- `src/shared/types.ts`: `UserSettings` - TypeScript interface defining the shape of user preferences including `dailyGoalMinutes`, `sessionLength`, `notificationsEnabled`, `soundEnabled`, `theme`, and `targetRetention`

**React Hooks:**
- `React.useEffect`: Loads saved settings from the main process when the component mounts
- `React.useState`: Manages local settings state, loading indicators, save status, and change tracking
- `React.useCallback`: Memoizes the `updateSetting` function to prevent unnecessary re-renders

**IPC Bridge (Electron Preload API):**
- `window.logos.profile.getSettings()`: Fetches current user settings from the main process database
- `window.logos.profile.updateSettings()`: Persists modified settings back to the database

### Dependents (What Needs This)

**Navigation/Routing:**
- The application router (likely in `App.tsx` or a dedicated router file) imports and renders this page when users navigate to the settings route
- Navigation components reference the settings path to enable menu-based access

**Global State:**
- Settings changes (particularly `theme`) affect the entire application's appearance
- `notificationsEnabled` affects whether the notification service sends reminders
- `soundEnabled` controls audio feedback throughout learning sessions
- `sessionLength` and `dailyGoalMinutes` influence session planning in other parts of the application

### Data Flow

```
Component Mount
       |
       v
useEffect triggers loadSettings()
       |
       v
window.logos.profile.getSettings() --IPC--> Main Process --Prisma--> SQLite
       |
       v
Settings loaded into local state
       |
       v
User modifies a setting (slider, toggle, dropdown)
       |
       v
updateSetting() updates local state + sets hasChanges = true
       |
       v
User clicks "Save Changes" button
       |
       v
saveSettings() called
       |
       v
window.logos.profile.updateSettings(settings) --IPC--> Main Process --Prisma--> SQLite
       |
       v
Success: hasChanges = false, success message shown for 3 seconds
Error: Error message displayed
```

---

## Macroscale: System Integration

### Architectural Layer

This component sits in the **Presentation Layer** of the LOGOS three-tier architecture:

```
[Presentation Layer] - React UI Components
         |
    SettingsPage.tsx  <-- You are here
         |
    Uses GlassCard, GlassButton (UI primitives)
         |
         v (IPC via contextBridge)
[Application Layer] - Main Process Services
         |
    Profile IPC handlers
         |
         v
[Data Layer] - Prisma ORM
         |
    User/Settings database tables
```

The SettingsPage is a **leaf node** in the component tree - it consumes data but does not provide data to child pages. However, its outputs (saved settings) propagate globally throughout the application.

### Big Picture Impact

The SettingsPage enables the entire personalization system of LOGOS:

1. **Learning Algorithm Calibration**: The `targetRetention` setting (70-99%) directly feeds into the FSRS (Free Spaced Repetition Scheduler) algorithm. Higher retention targets mean more frequent reviews; lower targets allow more aggressive spacing.

2. **Session Management**: `dailyGoalMinutes` and `sessionLength` determine how the session orchestrator plans learning queues. A 30-minute daily goal with 20-minute sessions means roughly 1.5 sessions per day.

3. **User Experience**: `notificationsEnabled` and `soundEnabled` control the sensory feedback loop. Some users need reminders; others find them intrusive. Some learn better with audio reinforcement; others prefer silence.

4. **Accessibility**: The `theme` setting (light/dark/system) ensures the application is comfortable to use across different lighting conditions and user preferences.

5. **Data Portability**: The Data Management section (Export/Import/Reset) enables users to back up their learning progress, migrate between devices, or start fresh.

### Critical Path Analysis

**Importance Level**: Medium-High

**If this fails:**
- Users cannot customize their experience (frustration, potential churn)
- Default settings may not match user needs (ineffective learning)
- No way to export learning data (data lock-in concerns)
- Theme cannot be changed (accessibility issues)

**Failure Modes:**
- IPC failure: Settings won't load or save (shows loading spinner indefinitely or error message)
- Database corruption: Settings reset to defaults unexpectedly
- Type mismatch: Invalid settings values could break other components

**Fallback Behavior:**
- Default settings are hardcoded in the component (dailyGoalMinutes: 30, sessionLength: 20, etc.)
- If loading fails, the component still renders with defaults
- If saving fails, users see an error message and can retry

---

## Technical Concepts (Plain English)

### Local Sub-Components (Section, Toggle, Slider, Select)

**Technical**: The file defines four internal React functional components (`Section`, `Toggle`, `Slider`, `Select`) that are not exported. These are composition patterns that encapsulate repeated UI structures.

**Plain English**: Think of these like reusable paragraph templates in a document. Instead of copying and pasting the same HTML structure for every toggle switch, we define it once and just fill in the blanks (label, description, checked state) each time. This keeps the main component clean and reduces bugs.

**Why We Use It**: The Settings page has many similar controls (multiple toggles, multiple sliders). Without these sub-components, the JSX would be hundreds of lines of repetitive code.

### ARIA Switch Role (Toggle Button)

**Technical**: The toggle buttons use `role="switch"` and `aria-checked={checked}` to communicate their state to assistive technologies.

**Plain English**: For users who navigate with screen readers, a regular button just says "button." The switch role tells the screen reader "this is an on/off toggle, and it's currently ON" - like the accessibility equivalent of seeing the blue/gray color.

**Why We Use It**: Accessibility compliance and inclusive design. Approximately 15% of the global population has some form of disability, and many rely on assistive technologies.

### Controlled Components (State-Driven Inputs)

**Technical**: All inputs (sliders, toggles, selects) are controlled components where the value comes from React state and changes flow through event handlers that call `setState`.

**Plain English**: Instead of letting the browser remember what value a slider is set to, React keeps track of it. When you drag a slider, it tells React "the user wants this to be 45," React updates its memory, and then the slider shows 45. This roundabout approach ensures React always knows the exact state of every input.

**Why We Use It**: This pattern is essential for form validation, undo functionality, and ensuring the UI always reflects the true application state. It also enables the "hasChanges" tracking that enables/disables the Save button.

### Optimistic UI Update with Deferred Persistence

**Technical**: Settings changes are immediately reflected in local state (optimistic update) but only persisted to the database when the user clicks "Save Changes" (deferred persistence).

**Plain English**: When you flip a toggle, you see it change instantly without waiting for the database. But if you close the page without saving, your changes are lost. This is like editing a document - you see your changes immediately, but they're not saved until you hit Ctrl+S.

**Why We Use It**: Instant feedback feels responsive and modern. Batching saves into a single action reduces database writes and gives users explicit control over when changes become permanent.

### useCallback Memoization

**Technical**: The `updateSetting` function is wrapped in `useCallback` with an empty dependency array to maintain referential equality across renders.

**Plain English**: Every time a React component re-renders, it creates new versions of all its functions. The Toggle and Slider components receive `onChange` as a prop. If that function is "new" every time, those components think something changed and re-render unnecessarily. `useCallback` says "keep using the same function instance" to prevent this cascade.

**Why We Use It**: Performance optimization. With many interactive controls on the page, preventing unnecessary re-renders keeps the UI smooth.

---

## Implementation Notes

### Default Settings Values

The component defines hardcoded defaults that are used both as initial state and for the "Reset to Defaults" feature:

| Setting | Default | Purpose |
|---------|---------|---------|
| dailyGoalMinutes | 30 | Moderate daily commitment |
| sessionLength | 20 | Optimal focus duration before fatigue |
| notificationsEnabled | true | Encourage consistent practice |
| soundEnabled | true | Audio feedback for correct/incorrect |
| theme | 'system' | Respect OS preferences |
| targetRetention | 0.9 (90%) | Balance between retention and efficiency |

### Settings Sections Organization

1. **Learning Preferences**: Algorithm-affecting parameters (daily goal, session length, target retention)
2. **Notifications**: User interruption preferences
3. **Appearance**: Visual customization
4. **Data Management**: Import/Export/Reset actions
5. **About**: Application information and credits

This organization follows the principle of progressive disclosure - most frequently changed settings appear first.

### Placeholder Functionality

The Data Management buttons (Export Data, Import Data, Reset Progress) are currently UI placeholders. The `GlassButton` elements exist but their `onClick` handlers are not implemented. These will connect to `window.logos` IPC methods when the data portability feature is complete.

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Initial narrative documentation for SettingsPage
- **Why**: Shadow documentation requirement for all code files
- **Impact**: Enables future developers to understand the WHY behind this component

### Initial Implementation
- **What Changed**: Created comprehensive settings page with Learning Preferences, Notifications, Appearance, Data Management, and About sections
- **Why**: Users need control over their learning experience for long-term engagement
- **Impact**: Enables personalization across the entire LOGOS application
