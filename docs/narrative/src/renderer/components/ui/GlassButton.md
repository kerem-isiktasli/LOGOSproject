# GlassButton Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/ui/GlassButton.tsx`
> **Status**: Active

---

## Why This Exists

GlassButton provides interactive action triggers that visually harmonize with the Liquid Glass design system. Standard HTML buttons or generic UI library buttons would clash with GlassCard's translucent aesthetic, breaking visual cohesion.

**User Need**: Language learners need clear, inviting call-to-action elements that encourage engagement without creating anxiety. Traditional bold, high-contrast buttons can feel aggressive in an educational context.

**Technical Need**: The application requires buttons with consistent sizing, loading states, icon support, and semantic color variants that integrate seamlessly with the glass design language.

---

## Key Concepts

### Tactile Feedback Through Elevation
**Technical**: CSS hover/active states that modify box-shadow, transform, and opacity properties to simulate physical button depression.

**Plain English**: When you hover over or click a glass button, it subtly "lifts" or "presses" like a real button would. This gives your brain the satisfaction of physical interaction, even though it's just pixels.

**Why It Matters**: Microinteractions like these make the interface feel responsive and alive, increasing user confidence that their actions are registered.

### Variant Semantic Colors
**Technical**: `default` (neutral glass), `primary` (brand/action blue), `success` (confirmation green), `danger` (destructive red), `ghost` (transparent, minimal visual weight).

**Plain English**: The button's color tells you what kind of action it represents before you even read the label. Blue means "do this main thing," red means "be careful," ghost means "this is secondary."

**Why It Matters**: Reduces cognitive load by encoding action importance in color. Users can scan a form and instantly identify the primary action.

### Loading State Stability
**Technical**: When `loading={true}`, the button displays a spinner but maintains its exact dimensions using CSS min-width/height preservation.

**Plain English**: The button doesn't jump around or change size when it's loading. It stays put, swapping its label for a spinner, so the page doesn't shift unexpectedly.

**Why It Matters**: Layout stability during async operations prevents "button moved while I was clicking" frustration and maintains visual grounding.

### Icon Slots (Left/Right)
**Technical**: Optional `iconLeft` and `iconRight` props accept ReactNode for positioning icons relative to button text.

**Plain English**: You can put little pictures (icons) before or after the button's words. A "Save" button might have a disk icon on the left; a "Next" button might have an arrow on the right.

**Why It Matters**: Icons accelerate recognition - users can find buttons faster by scanning for familiar shapes rather than reading text.

---

## Design Decisions

### Why forwardRef Is Used
The component uses React's `forwardRef` to expose the underlying `<button>` element. This enables:
1. **Focus management**: Parent forms can programmatically focus the submit button
2. **Animation libraries**: Framer Motion can animate the actual DOM node
3. **Tooltip integration**: Tooltip libraries often need direct element references

### Why iconOnly Is Explicit
Rather than inferring icon-only mode from absence of children, the `iconOnly` prop is explicit because:
1. Buttons might have whitespace-only children (edge case)
2. Explicit intent makes code review clearer
3. TypeScript can provide better autocomplete hints

### Why GlassButtonGroup Exists
Grouping related buttons (Save/Cancel, Yes/No) requires consistent spacing and orientation. A dedicated group component:
1. Encapsulates gap sizing decisions
2. Supports horizontal/vertical layouts
3. Prevents ad-hoc flexbox wrappers proliferating across the codebase

### Why LoadingSpinner Is Internal
The spinner component is defined inside the file rather than imported because:
1. It's tightly coupled to button sizing (sm/md/lg maps)
2. External spinners might not match glass aesthetic
3. Reduces external dependencies for a self-contained component

---

## Integration Points

### Direct Dependencies (What This Needs)
- **React**: Core library, `forwardRef` for ref forwarding
- **Tailwind CSS**: Utility classes for sizing, width, opacity, cursor states
- **Global CSS**: `.glass-button`, `.glass-button-primary`, `.glass-button-success`, `.glass-button-danger`, `.glass-button-ghost`, `.glass-button-sm`, `.glass-button-lg`, `.glass-button-icon`, `.button-icon-left`, `.button-icon-right`

### Upstream Consumers (What Uses This)
- **`src/renderer/pages/AnalyticsPage.tsx`**: Action buttons in analytics dashboard
- **`src/renderer/pages/SettingsPage.tsx`**: Save/reset settings buttons
- **`src/renderer/pages/VocabularyPage.tsx`**: Vocabulary management actions
- **`src/renderer/components/error/ErrorBoundary.tsx`**: "Retry" button in error UI
- **`src/renderer/components/goal/CorpusSourceSelector.tsx`**: Corpus selection actions
- **`src/renderer/components/session/TimedExercise.tsx`**: Submit/skip exercise buttons
- **`src/renderer/components/ui/index.ts`**: Re-exports for barrel import pattern

### Companion Components
- **`GlassButtonGroup`**: Container for related button groups with controlled spacing
- **`GlassIconButton`**: Convenience wrapper that pre-sets `iconOnly={true}`

### System Role
GlassButton is a **primitive interaction component**. In the hierarchy:

```
Page Actions (Submit Form, Navigate, Delete Item)
    |
    +-- Feature Components (forms, dialogs, cards)
           |
           +-- GlassButton (this component)
                  |
                  +-- Native <button> element
```

GlassButton is the **sole button primitive** in the design system. If it changes, every interactive element in the application is affected. It must remain:
- Accessible (keyboard navigation, ARIA attributes)
- Stable (consistent API)
- Performant (no unnecessary re-renders)

### Data Flow
```
Props (variant, size, loading, iconLeft/Right, disabled, onClick)
    |
    v
GlassButton computes class string from variant/size/state
    |
    v
Renders <button> with computed classes
    |
    v
If loading: render LoadingSpinner
If not loading: render icons + children
    |
    v
CSS applies glass styling, hover/active states
    |
    v
User interaction triggers onClick (if not disabled/loading)
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing component
- **Why**: Fulfill documentation-specialist mandate for 1:1 shadow mapping
- **Impact**: Enables future maintainers to understand context without reading code
