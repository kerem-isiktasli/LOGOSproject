# GlassProgress Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/ui/GlassProgress.tsx`
> **Status**: Active

---

## Why This Exists

GlassProgress provides visual progress indicators within the Liquid Glass design system. Language learning is inherently about progression - through sessions, through mastery stages, through learning goals. Standard progress bars would break the glass aesthetic; these components maintain visual harmony while clearly communicating advancement.

**User Need**: Learners are motivated by visible progress. Seeing a bar fill up, watching mastery stages complete, tracking session advancement - these visual cues provide dopamine hits that reinforce learning behavior.

**Technical Need**: Multiple progress visualization patterns (linear bars, circular indicators, segmented mastery stages, dual-metric session trackers) unified under consistent styling and API conventions.

---

## Key Concepts

### Progress as Journey, Not Destination
**Technical**: Progress bars use gradient fills and subtle glow effects rather than solid colors, with smooth CSS transitions during value changes.

**Plain English**: The bar doesn't just show "you're at 60%." The gradient and glow make it feel alive, like water filling a glass tube. You're not just AT a number - you're ON a journey.

**Why It Matters**: Gamification research shows that dynamic, animated progress creates emotional engagement. Static indicators feel like spreadsheet data; animated gradients feel like achievement.

### Mastery Gradient
**Technical**: The `mastery` variant uses a four-color gradient (`from-amber-500 via-blue-500 via-purple-500 to-green-500`) that maps to the mastery stage color progression.

**Plain English**: As the bar fills, it shifts through the mastery colors - amber to blue to purple to green. The color at the fill point tells you which stage you've reached.

**Why It Matters**: A single progress bar can communicate both "how much" (bar length) and "what stage" (current color) simultaneously. Information density without complexity.

### Circular Progress for Compact Display
**Technical**: `CircularProgress` uses SVG stroke-dasharray/offset animation on a circular path to create ring-style progress indicators.

**Plain English**: A ring that fills clockwise, with a glowing effect on the progress edge. Perfect for dashboard widgets where vertical space is limited.

**Why It Matters**: Dashboard layouts need compact indicators. Linear bars waste space; circular indicators fit in square widget containers.

### Segmented Mastery Visualization
**Technical**: `MasteryProgress` divides progress into 5 discrete segments (one per mastery stage), each segment filling with its stage color when reached.

**Plain English**: Five boxes in a row, each representing a mastery stage. As you progress, boxes light up in their stage colors - like unlocking achievement badges.

**Why It Matters**: Mastery isn't continuous - it's staged. Segmented display reinforces the "level-up" mental model rather than smooth progression.

---

## Design Decisions

### Why Variants Use Gradients, Not Solid Colors
Gradients (`from-X to-Y`) instead of solid fills because:
1. Gradients reinforce the glass/liquid aesthetic
2. Direction suggests forward momentum
3. Visual interest without additional elements
4. Subtle depth perception

### Why max Defaults to 100
The `max` prop defaults to 100 rather than requiring explicit setting because:
1. Percentage-based progress (0-100) is the common mental model
2. Reduces boilerplate in typical usage
3. Custom max available for edge cases (10-item sessions, etc.)

### Why CircularProgress Uses SVG, Not CSS
The circular progress uses SVG circles rather than CSS conic-gradient because:
1. SVG stroke-dasharray enables smooth animation
2. Consistent rendering across browsers
3. Drop-shadow filter for glow effect
4. Easier to center content inside the ring

### Why MasteryProgress Is Segmented, Not Continuous
Five discrete segments rather than a single gradient bar because:
1. Mastery stages ARE discrete (you're at stage 2, not stage 2.5)
2. Reinforces "level up" achievement mental model
3. Each segment can have independent color/animation
4. Clearer visual distinction between stages

### Why SessionProgress Shows Dual Metrics
The `SessionProgress` component displays both item progress and time progress because:
1. Learning sessions have both goals: complete items AND stay within time
2. Dual progress helps users pace themselves
3. Time running ahead of items = "slow down"; items ahead of time = "good pace"
4. Common enough pattern to warrant dedicated component

---

## Integration Points

### Direct Dependencies (What This Needs)
- **React**: Core library
- **Tailwind CSS**: Height utilities, gradient colors, gap utilities, flexbox
- **CSS Variables**: `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-neutral-*` for theme-aware coloring
- **Global CSS**: `.glass-progress`, `.glass-progress-bar`, `.glass-progress-wrapper`, `.mastery-progress`, `.session-progress`

### Upstream Consumers (What Uses This)
- **`src/renderer/pages/VocabularyPage.tsx`**: Mastery progress visualization
- **`src/renderer/components/ui/index.ts`**: Re-exports for barrel import pattern
- **Session components**: Session progress tracking during learning

### Component Family (Same File)
- **`GlassProgress`**: Standard linear progress bar
- **`CircularProgress`**: Ring-style progress indicator
- **`MasteryProgress`**: Segmented mastery stage visualization
- **`SessionProgress`**: Dual-metric session tracker (items + time)

### System Role
GlassProgress family components are **visualization primitives**. In the hierarchy:

```
Dashboard/Analytics Views
    |
    +-- Widget Cards (mastery overview, session summary)
           |
           +-- GlassProgress / CircularProgress / MasteryProgress
                  |
                  +-- <div> progress track + <div> progress fill
                  |   OR <svg> circular path
```

Progress components appear in:
- **Dashboard widgets**: Overall mastery percentage
- **Vocabulary item cards**: Individual item mastery stage
- **Session views**: Current session progress (items + time)
- **Goal tracking**: Goal completion visualization
- **Analytics**: Historical progress trends

### Data Flow
```
Props (value, max, variant, size, animated, showLabel)
    |
    v
Component calculates percentage: (value / max) * 100
    |
    v
Percentage clamped to 0-100 range
    |
    v
Renders track element (background)
    |
    v
Renders fill element with width/dashoffset based on percentage
    |
    v
CSS transitions animate changes over 500ms
    |
    v
If showLabel: renders percentage text
```

### Accessibility Implementation
```
<div role="progressbar"
     aria-valuenow={value}        <- Current value for screen readers
     aria-valuemin={0}            <- Minimum possible value
     aria-valuemax={max}          <- Maximum possible value
     aria-label={label}>          <- Descriptive text
```

### Variant Color Mapping
```
Variant   | Gradient                              | Use Case
----------|---------------------------------------|---------------------------
default   | neutral-400 -> neutral-500            | Generic progress
primary   | blue-500 -> blue-600                  | Standard learning progress
success   | green-500 -> green-600                | Completed/mastered items
warning   | amber-500 -> amber-600                | Approaching time limit
danger    | red-500 -> red-600                    | Overdue/failed items
mastery   | amber -> blue -> purple -> green      | Full mastery journey
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing component
- **Why**: Fulfill documentation-specialist mandate for 1:1 shadow mapping
- **Impact**: Enables future maintainers to understand context without reading code
