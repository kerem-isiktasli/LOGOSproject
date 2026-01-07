# GoalCard Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/goal/GoalCard.tsx`
> **Status**: Active

---

## Why This Exists

The GoalCard component provides the visual representation of a learning goal throughout the LOGOS application. Goals are the central organizing principle of the learning experience - they define what users are working toward, how progress is measured, and what content gets surfaced.

This component exists because **goals need to feel tangible**. Unlike abstract progress percentages or database records, a well-designed card gives users something they can see, touch (click), and emotionally connect with. The philosophy driving this design is that learning objectives should feel like real objects in the user's digital space.

**Business Need**: Users need to quickly identify, compare, and select their learning goals. The card format provides a scannable, visually rich representation that communicates status at a glance while inviting deeper interaction.

**When Used**:
- Dashboard view (showing all active goals)
- Goal selection interface (choosing which goal to study)
- Progress reports (detailed view of goal statistics)

---

## Key Concepts

### Variant-Based Rendering
**Technical**: The component accepts a `variant` prop (`'default' | 'compact' | 'expanded'`) that conditionally renders entirely different layouts using early returns.

**Plain English**: The same goal data can be displayed as a small thumbnail, a medium summary card, or a full detailed view - like how a photo can appear as an icon, a preview, or a full-screen image.

**Why We Use It**: Different contexts require different information density. A dashboard might show compact cards for many goals, while a detail page shows one expanded card with all statistics.

### Mastery Percentage Calculation
**Technical**: `masteryPercentage = (stats.masteredCount / Math.max(stats.totalObjects, 1)) * 100` - divides mastered items by total items, guarding against division by zero.

**Plain English**: This shows what percentage of vocabulary words in this goal the user has fully learned. If you have 100 words and mastered 25, you see "25%".

**Why We Use It**: A single percentage provides an intuitive summary of progress that users can understand instantly, even though the underlying FSRS algorithm is far more complex.

### Domain Icon Mapping
**Technical**: A `Record<Domain, string>` lookup table that maps each domain type to a visual emoji icon.

**Plain English**: Medical goals get a hospital icon, legal goals get a scales of justice icon, etc. It is a quick visual shorthand so users do not have to read labels.

**Why We Use It**: Icons are processed faster than text. Users can scan a list of goals and identify categories without reading.

### Interactive Card States
**Technical**: The GlassCard receives `interactive={true}` which applies hover states and cursor styles. Selected state changes the card variant to `'primary'`.

**Plain English**: Cards respond visually when you hover over them and look different when selected, like buttons that light up when touched.

**Why We Use It**: Interactive feedback communicates affordance (that something is clickable) and state (which goal is currently selected).

---

## Design Decisions

### Three Layout Variants
Rather than one flexible layout with many configuration options, this component provides three distinct layouts:

1. **Compact**: Minimal footprint for lists and sidebars - shows icon, title, and small progress circle
2. **Default**: Balanced for dashboard grids - adds modality tags and mastery progress bar
3. **Expanded**: Full detail for focus views - includes all statistics, action buttons, and detailed breakdowns

This approach is more maintainable than a single layout with 15 props because each variant is self-contained and easy to reason about.

### Statistics Display Pattern
The expanded variant uses a 2x2 grid of "stat-item" boxes showing:
- Total Items
- Mastered Count
- Due Today
- Day Streak

These four metrics were chosen because they answer the core questions users have: "How big is this goal?", "How far have I come?", "What should I do today?", and "Am I being consistent?"

### Active/Inactive Badge
Goals can be marked inactive (paused). Rather than hiding inactive goals or using opacity, an explicit "Inactive" badge is shown. This prevents confusion about why certain goals are not generating due items.

### Circular Progress with Label
The `CircularProgress` component renders both a visual ring and numeric percentage. This dual encoding (visual + text) accommodates both visual thinkers who prefer the graphic and precise thinkers who want exact numbers.

### GoalList as Companion Component
The file also exports `GoalList`, a wrapper component that renders multiple `GoalCard` instances with:
- Grid or list layout options
- Selection state management
- "Create New Goal" placeholder card

This co-location follows the pattern of exporting related components together for convenient imports.

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `../ui` (GlassCard, GlassButton, MasteryProgress, CircularProgress, GlassBadge) | UI components for card structure, buttons, and progress visualization |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Dashboard page | Renders goal cards in a grid layout |
| Goal selection modal | Shows compact variant for quick picking |
| Goal detail page | Shows expanded variant with all statistics |
| GoalList component | Internal usage for rendering multiple cards |

### Data Flow
```
GoalData (from parent/store)
    |
    v
GoalCard (presentation)
    |
    +--> onClick: Parent handles goal selection
    |
    +--> onEdit: Parent opens edit form
    |
    +--> onDelete: Parent shows confirmation dialog
```

### Type Contracts
The `GoalData` interface defines the shape of goal information:
- `id`, `domain`, `modality`, `genre`, `purpose`: Core goal definition
- `benchmark`, `deadline`: Optional targeting
- `completionPercent`, `isActive`: Status indicators
- `stats`: Nested object with detailed progress metrics

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain component architecture, variant system, and integration patterns
- **Impact**: Provides clarity on how goal visualization works throughout the app
