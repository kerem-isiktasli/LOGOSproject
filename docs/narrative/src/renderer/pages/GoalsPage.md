# GoalsPage

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/pages/GoalsPage.tsx`
> **Status**: Active

---

## Why This Exists

The GoalsPage is the **gateway to intentional language learning** within LOGOS. Without clearly defined goals, learners drift aimlessly through vocabulary lists without direction or purpose. This page exists because effective language acquisition requires explicit goal-setting - the learner must consciously decide what language they want to learn, why, and to what level.

A goal in LOGOS is not just a label - it is a container that organizes all learning activity. Every vocabulary item, every mastery score, every study session belongs to a specific goal. The GoalsPage is where users create these containers, select which one to focus on, and manage their learning portfolio.

**The core user stories this enables:**
- "As a new user, I want to create a learning goal so I can start studying German"
- "As a multi-language learner, I want to switch between my French and Japanese goals"
- "As someone abandoning a goal, I want to delete my Spanish goal and its associated data"

Without this page, users would have no way to initialize the learning system or manage multiple concurrent language learning efforts.

---

## Key Concepts

### Active Goal Selection

LOGOS supports multiple learning goals but focuses on **one active goal at a time**. The active goal determines which vocabulary queue appears in sessions, which progress statistics display on the dashboard, and which mastery data feeds into analytics.

Think of it like having multiple notebooks for different subjects - you can only write in one at a time. The active goal is the notebook currently open on your desk.

The `activeGoalId` state is stored in the global `AppContext` and persists across page navigation, ensuring continuity as users move between Dashboard, Session, and Goals pages.

### Goal Lifecycle: Create, Select, Delete

Goals follow a simple lifecycle:

1. **Creation**: User provides target language, native language, name, and optional description. The system creates database records and initializes empty mastery structures.

2. **Selection**: User clicks a goal card to make it active. This updates global state and redirects learning activity to that goal's content.

3. **Deletion**: User confirms destructive action. All associated data (vocabulary items, mastery records, session history) is permanently removed. The system handles orphaned active goal references gracefully.

### Auto-Selection After Creation

When a user creates a new goal, the system automatically selects it as the active goal. This removes friction from the onboarding flow - users don't need to manually select the goal they just created.

### Modal Form Pattern

The CreateGoalForm appears as a modal overlay rather than a separate page. This keeps users oriented within the GoalsPage context and allows quick creation without navigation disruption. The modal uses a translucent backdrop that blocks interaction with underlying content.

---

## Design Decisions

### Grid Layout for Goal Cards

Goals display in a vertical grid (`grid gap-4`) rather than a carousel or list. This decision prioritizes scanability - users can see all their goals at once without scrolling horizontally. Language learners often have 2-5 concurrent goals; a vertical stack handles this range elegantly.

### Confirmation Dialog for Deletion

Goal deletion triggers a native browser `confirm()` dialog. This was a deliberate choice over a custom modal because:
1. Destructive actions should feel serious and interrupt workflow
2. Native dialogs are immediately recognizable as "warning: danger ahead"
3. Implementation simplicity - no additional modal state to manage

Future iterations may replace this with a custom confirmation component that matches the Liquid Glass design language.

### Loading State with Pulsing Icon

During goal loading, a pulsing target emoji (goal symbol) provides visual feedback. This matches the Dashboard loading pattern and creates consistency across pages. The animation (`animate-pulse`) signals activity without specificity about duration.

### Empty State Call-to-Action

When no goals exist, the page displays an encouraging empty state with a large star emoji and "Create Your First Goal" button. This guides new users toward the primary action without overwhelming them with options.

### Tips Section for Existing Users

After goals exist, a "Tips" card appears with advice about focus, daily review, and content diversity. This educates users about best practices without blocking their workflow - the tips are secondary to the goal list, placed below it.

---

## Integration Points

### Dependencies (What This Needs)

| Module | Import | Purpose |
|--------|--------|---------|
| `../context` | `useApp` | Access `activeGoalId`, `setActiveGoal`, `refreshGoals` from global state |
| `../hooks` | `useGoals` | Fetch list of goals via IPC |
| `../hooks` | `useCreateGoal` | Create new goal via IPC |
| `../hooks` | `useDeleteGoal` | Delete goal via IPC |
| `../components/goal` | `GoalCard`, `CreateGoalForm` | UI components for goal display and creation |
| `../components/ui` | `GlassCard`, `GlassButton` | Design system primitives |

### IPC Channels (Main Process Communication)

The hooks abstract these IPC calls:
- `window.logos.goal.list()` - Fetches all goals for current user
- `window.logos.goal.create(data)` - Creates new goal with language pair
- `window.logos.goal.delete(id)` - Removes goal and cascades deletion

### Dependents (What Needs This)

- **App Router**: Navigates to GoalsPage, typically at route `/goals`
- **DashboardPage**: Links to GoalsPage when no active goal exists ("Create Your First Goal")
- **Navigation Component**: Provides persistent access to Goals from sidebar

### Data Flow

```
User clicks "New Goal" button
       |
       v
setShowCreateForm(true) --> Modal renders CreateGoalForm
       |
       v
User fills form and submits
       |
       v
handleCreateGoal(data) --> useCreateGoal.execute(data) --> IPC --> Main Process
       |
       v
Main Process creates DB records --> Returns new goal object
       |
       v
setShowCreateForm(false) + refreshGoals() --> Re-fetch goal list
       |
       v
setActiveGoal(newGoal.id) --> Update global context
       |
       v
onSelectGoal?.(newGoal.id) --> Parent callback (navigation trigger)
```

### Props Interface

```typescript
interface GoalsPageProps {
  onNavigateBack?: () => void;    // Return to previous page (Dashboard)
  onSelectGoal?: (goalId: string) => void;  // Callback when goal selected/created
}
```

These optional callbacks enable the parent router or layout to respond to goal selection events, typically triggering navigation to the Dashboard or Session page.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial shadow documentation for GoalsPage
- **Why**: Fulfill documentation-specialist requirements for narrative explanation
- **Impact**: Future developers understand goal management architecture

### Initial Implementation
- **What Changed**: Created goal management page with CRUD operations
- **Why**: Users need to create and manage language learning goals
- **Impact**: Enables multi-goal support and intentional learning direction
