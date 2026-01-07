# GlassInput Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/ui/GlassInput.tsx`
> **Status**: Active

---

## Why This Exists

GlassInput provides form inputs styled to match the Liquid Glass design system. Language learning applications require extensive text entry (vocabulary, translations, free-form answers), and standard inputs would visually clash with glass cards and buttons.

**User Need**: Learners need input fields that feel inviting rather than clinical. Traditional outlined inputs can feel like bureaucratic forms; glass inputs feel more like writing on a beautiful surface.

**Technical Need**: Consistent form styling with built-in label/helper/error patterns, accessibility attributes, and icon support - all aligned with the glass aesthetic.

---

## Key Concepts

### Recessed vs. Raised Glass
**Technical**: Inputs use inset box-shadows and inner glows on focus, contrasting with buttons/cards that use outset shadows and elevation.

**Plain English**: Buttons "pop up" from the surface like physical buttons. Inputs "sink into" the surface like engraved channels where you write. This visual metaphor instantly communicates: "buttons are for pressing, inputs are for typing."

**Why It Matters**: Reduces cognitive load by leveraging real-world mental models. Users don't need to be told which elements are interactive in which way.

### Focus States Without Harsh Outlines
**Technical**: Focus indication uses inner glow (box-shadow: inset) and subtle border color shift rather than browser default outline or thick borders.

**Plain English**: When you click into an input, it glows softly from within rather than getting a jarring colored border. Like a lamp turning on inside frosted glass.

**Why It Matters**: In language learning contexts, users spend extended time in focused input states. Harsh visual feedback becomes fatiguing; subtle glows remain comfortable.

### Error States That Don't Alarm
**Technical**: Error styling uses tinted glass (rose/red undertone) and text-danger color for helper text, rather than aggressive borders or icons.

**Plain English**: When you make a mistake, the input gently blushes red rather than screaming at you. The error message appears calmly below - not flashing or animated.

**Why It Matters**: Language learning involves constant mistakes - that's how learning works. Error states should inform, not punish. Alarming error UI creates anxiety and discourages experimentation.

### Automatic ID Generation
**Technical**: Uses React's `useId()` hook to generate unique IDs for label/input association when no explicit `id` prop is provided.

**Plain English**: Every input automatically gets a unique identifier that connects it to its label, so screen readers can announce "Name, text field" instead of just "text field."

**Why It Matters**: Accessibility compliance without requiring developers to manually create IDs for every input instance.

---

## Design Decisions

### Why Label/Helper/Error Are Props, Not Children
The component accepts `label`, `helperText`, and `error` as props rather than requiring composition because:
1. **Common pattern**: 90% of inputs need just these three text elements
2. **Accessibility**: Component handles `aria-describedby` wiring automatically
3. **Validation integration**: `error` prop drives both styling AND error message display
4. **Escape hatch**: Custom layouts can use the input directly without these props

### Why Size Omits HTML size Attribute
The `size` prop is typed separately from native HTML attributes (`Omit<..., 'size'>`) because:
1. HTML `size` attribute sets character width - rarely useful
2. Our `size` prop controls visual height/padding/font
3. Prevents confusion between two different "size" concepts

### Why fullWidth Defaults to true
Unlike buttons (which default to content width), inputs default to `fullWidth={true}` because:
1. Form layouts typically want inputs to fill available space
2. Mobile-first design favors full-width inputs
3. Explicit `fullWidth={false}` is the rare exception

### Why Icons Are Pointer-Events-None
Icon containers have `pointer-events-none` CSS because:
1. Icons are decorative, not interactive
2. Clicking the icon area should focus the input
3. Prevents accidental icon "selection" behavior

---

## Integration Points

### Direct Dependencies (What This Needs)
- **React**: Core library, `forwardRef`, `useId` hook
- **Tailwind CSS**: Sizing utilities, absolute positioning for icons
- **Global CSS**: `.glass-input`, `.glass-input-error`, `.glass-input-wrapper`, `.glass-input-label`, `.glass-input-helper`, `.text-danger`, `.text-muted`

### Upstream Consumers (What Uses This)
- **`src/renderer/pages/SettingsPage.tsx`**: User preference inputs
- **`src/renderer/components/session/TimedExercise.tsx`**: Answer submission input
- **`src/renderer/components/ui/index.ts`**: Re-exports for barrel import pattern

### Companion Components
- **`GlassTextarea`**: Multiline text input with identical styling patterns
- **`GlassSelect`**: Dropdown select with glass styling and chevron icon

### System Role
GlassInput is a **primitive form component**. In the hierarchy:

```
Forms (CreateGoalForm, SettingsPanel, LoginForm)
    |
    +-- Form Fields (labeled inputs, validation, submission)
           |
           +-- GlassInput / GlassTextarea / GlassSelect (this file)
                  |
                  +-- Native <input> / <textarea> / <select>
```

GlassInput family components are the **sole form primitives** in the design system. They handle:
- Visual consistency
- Accessibility (labels, ARIA attributes)
- Error state display
- Icon integration

If these components change, every form in the application is affected.

### Data Flow
```
Props (label, helperText, error, size, iconLeft/Right, value, onChange)
    |
    v
GlassInput generates unique ID (or uses provided id)
    |
    v
Renders wrapper div with conditional width
    |
    v
Renders label (if provided) linked to input via htmlFor
    |
    v
Renders input with computed classes and ARIA attributes
    |
    v
Renders helper/error text with aria-describedby linkage
    |
    v
User types -> onChange fires -> parent updates value prop -> re-render
```

### Accessibility Chain
```
<label htmlFor={inputId}>           <- Clicking label focuses input
    |
<input id={inputId}                 <- Screen reader announces label
       aria-invalid={hasError}      <- Announces "invalid entry"
       aria-describedby={helperId}  <- Announces helper/error text
    |
<p id={helperId}>                   <- Additional context for screen readers
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing component
- **Why**: Fulfill documentation-specialist mandate for 1:1 shadow mapping
- **Impact**: Enables future maintainers to understand context without reading code
