# CreateGoalForm Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/goal/CreateGoalForm.tsx`
> **Status**: Active

---

## Why This Exists

The CreateGoalForm component serves as the primary entry point for users to define their learning objectives within LOGOS. Language learning is inherently goal-directed, and without clear, well-structured goals, learners often lack the motivation and direction needed to persist through the challenges of acquiring a new language.

This component addresses a critical user experience problem: **decision fatigue**. When learners are presented with too many options at once, they become overwhelmed and may abandon the goal-setting process entirely. By breaking goal creation into a two-step wizard (domain/modality selection first, then details), the form guides users through a structured decision-making process that feels manageable rather than daunting.

**Business Need**: Users need to articulate their learning goals in a way that the system can use to personalize content delivery, track progress meaningfully, and align with external benchmarks (certification exams like CELBAN, IELTS, TOEFL).

**When Used**: This form appears when users click "Create New Goal" from the dashboard or goals list. It can also be invoked in edit mode to modify existing goals.

---

## Key Concepts

### Two-Step Wizard Pattern
**Technical**: A multi-step form pattern using React state (`step`) to conditionally render different form sections, reducing cognitive load by presenting choices sequentially.

**Plain English**: Like filling out a job application where you enter personal info on page one and work history on page two, rather than seeing everything on one overwhelming page.

**Why We Use It**: Research shows that breaking complex forms into steps increases completion rates by reducing perceived complexity.

### Domain and Modality Types
**Technical**: TypeScript union types (`Domain`, `Modality`) that constrain the valid values for learning focus areas, ensuring type safety throughout the application.

**Plain English**: The "domain" is the subject area (medical, legal, business) and "modality" is the skill type (reading, writing, listening, speaking). These are like categories in a library - every goal must fit into these predefined buckets.

**Why We Use It**: Strongly-typed domains enable the system to select appropriate content, apply relevant vocabulary frequency lists, and connect to domain-specific benchmarks.

### Visual Language Selection
**Technical**: Emoji-based visual selectors with toggle state management for both single-select (domain) and multi-select (modality) patterns.

**Plain English**: Instead of boring dropdown menus, users see colorful icons they can tap to select. It makes the experience feel more like a game than a form.

**Why We Use It**: Visual selection reduces cognitive load and creates an emotional connection to the goal-setting process.

### Benchmark Options
**Technical**: A predefined array of recognized language certification exams (CELBAN, IELTS, TOEFL, JLPT, etc.) that map to standardized scoring systems and content requirements.

**Plain English**: These are the official tests that prove your language ability to employers, universities, or immigration authorities. Selecting one tells the system what level you are aiming for.

**Why We Use It**: Alignment with recognized benchmarks provides external validation of progress and helps users prepare for real-world assessments.

---

## Design Decisions

### Inline CSS-in-JS Styling
The component uses inline `<style>` tags with CSS variables rather than external stylesheets or CSS modules. This decision:
- Keeps component styles co-located with their logic for easier maintenance
- Leverages the existing design system CSS variables (`--space-*`, `--radius-*`, etc.)
- Avoids stylesheet loading order issues in electron environments

### Modality Multi-Select with Minimum Constraint
Users must select at least one modality and cannot deselect all options. This prevents invalid goal states and ensures the system always has enough information to deliver appropriate content.

### Form Data Normalization on Submit
The `handleSubmit` function trims whitespace from text inputs and converts empty optional strings to `undefined`. This ensures clean data reaches the database layer without requiring backend validation for formatting issues.

### Preview Panel
A real-time preview of the goal appears at the bottom of Step 2. This follows the principle of **immediate feedback** - users can see exactly what their goal will look like before committing, reducing errors and increasing confidence.

### Error Clearing on Input
When a field with an error is modified, that specific error clears immediately. This provides responsive validation feedback without waiting for form submission.

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `../ui` (GlassCard, GlassButton, GlassInput, GlassTextarea, GlassSelect) | UI component library providing the glassmorphism design system elements |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Goal creation pages/modals | Renders this form with `onSubmit` and `onCancel` callbacks |
| Goal edit flows | Passes `initialValues` and `isEditing={true}` to enable edit mode |

### Data Flow
```
User Interaction (domain/modality selection)
    |
    v
React State (formData, step)
    |
    v
Form Validation (validate())
    |
    v
onSubmit Callback (CreateGoalFormData)
    |
    v
Parent Component / Goal Service
    |
    v
Database Persistence
```

### Type Exports
This component exports `CreateGoalFormData`, `Domain`, and `Modality` types that are likely consumed by:
- Goal service layer for data persistence
- GoalCard component for display
- Progress tracking systems for filtering

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain component architecture and design rationale
- **Impact**: Improves maintainability and onboarding for new developers
