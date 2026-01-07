# GlassBadge Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/ui/GlassBadge.tsx`
> **Status**: Active

---

## Why This Exists

GlassBadge provides lightweight status indicators and categorical tags within the Liquid Glass design system. Language learning applications need to display mastery levels, item status, and linguistic categories at a glance - without creating visual clutter.

**User Need**: Learners need instant visual feedback about their progress. A vocabulary item's mastery stage should be recognizable without reading text. Due items should stand out from mastered ones.

**Technical Need**: Compact, semantically colored indicators that work in tight spaces (table cells, card headers, inline with text) while maintaining design system coherence.

---

## Key Concepts

### Lightweight Glass Pills
**Technical**: Badges use reduced backdrop-filter blur, smaller padding, and pill-shaped borders (border-radius: 9999px) to appear less prominent than cards while still part of the glass family.

**Plain English**: Badges are like tiny glass gems - they catch light and show status, but they don't demand attention the way a big glass card does. They're accent pieces, not centerpieces.

**Why It Matters**: Information density is high in learning apps (vocabulary lists, session summaries). Badges must convey status without competing with primary content.

### Mastery Stage Color Progression
**Technical**: Stages 0-4 map to a semantic color progression: neutral gray -> amber -> blue -> purple -> green. This progression reflects the learning journey from unknown to automatic.

**Plain English**:
- Gray (Unknown): "I've never seen this"
- Amber (Recognition): "I recognize this when I see it"
- Blue (Recall): "I can remember this with effort"
- Purple (Controlled): "I can use this but have to think"
- Green (Automatic): "I use this without thinking"

**Why It Matters**: The color journey mirrors the learning journey. Users can glance at a vocabulary list and instantly see their progress distribution - lots of amber means early stage, lots of green means mastery.

### Visual Icons for Mastery
**Technical**: Unicode circle fill characters (○, ◔, ◑, ◕, ●) represent mastery stages as a visual fill progression.

**Plain English**: The circle fills up as you learn - empty circle, quarter, half, three-quarters, full. Like a battery indicator, but for knowledge.

**Why It Matters**: Works cross-platform without icon library dependencies. Instantly understandable visual metaphor (empty to full = don't know to know).

---

## Design Decisions

### Why masteryStage Overrides variant
When both `masteryStage` and `variant` props are provided, mastery stage takes precedence because:
1. Mastery display is domain-specific and more specialized
2. Prevents accidental styling conflicts
3. Clear mental model: if you're showing mastery, that's THE variant

### Why Separate Convenience Components Exist
`MasteryBadge`, `StatusBadge`, and `ComponentBadge` are separate components rather than just examples because:
1. **Type safety**: `stage: 0 | 1 | 2 | 3 | 4` is more specific than `masteryStage?: number`
2. **Encapsulated logic**: Icon mapping, label text, color selection are bundled
3. **Consistent usage**: Developers can't accidentally create inconsistent mastery displays

### Why StatusBadge Has Fixed Status Options
The `status` prop accepts only `'new' | 'learning' | 'review' | 'due' | 'mastered'` because:
1. These are the FSRS algorithm's canonical states
2. Tight typing prevents typos and invalid states
3. Color/icon mapping is domain logic, not presentation choice

### Why ComponentBadge Uses Abbreviations
Linguistic components display as `PHON`, `MORPH`, `LEX`, `SYNT`, `PRAG` rather than full words because:
1. Space is limited (often in table cells or lists)
2. Abbreviations are standard in linguistics
3. Full labels available via title/tooltip if needed

---

## Integration Points

### Direct Dependencies (What This Needs)
- **React**: Core library
- **Tailwind CSS**: Sizing/padding utilities
- **Global CSS**: `.glass-badge`, `.glass-badge-primary`, `.glass-badge-success`, `.glass-badge-warning`, `.glass-badge-danger`, `.glass-badge-mastery-0` through `.glass-badge-mastery-4`, `.badge-icon`

### Upstream Consumers (What Uses This)
- **`src/renderer/pages/VocabularyPage.tsx`**: Displays mastery badges on vocabulary items
- **`src/renderer/components/goal/CorpusSourceSelector.tsx`**: Shows source type badges
- **`src/renderer/components/ui/index.ts`**: Re-exports for barrel import pattern

### Companion Components (Same File)
- **`MasteryBadge`**: Pre-configured for mastery stage display with icons and labels
- **`StatusBadge`**: Pre-configured for FSRS learning status display
- **`ComponentBadge`**: Pre-configured for linguistic component categories (PHON, MORPH, etc.)

### System Role
GlassBadge is a **display primitive** - it shows information but is not interactive. In the hierarchy:

```
Vocabulary/Session Views
    |
    +-- Item Cards/Rows
           |
           +-- GlassBadge / MasteryBadge / StatusBadge (this file)
                  |
                  +-- <span> with styled content
```

Badges appear in:
- **Vocabulary lists**: Show mastery stage per item
- **Session views**: Show item status (new, due, learning)
- **Goal cards**: Show linguistic component focus
- **Analytics**: Show distribution summaries

### Data Flow
```
Props (variant OR masteryStage, size, icon, children)
    |
    v
GlassBadge selects class set based on masteryStage or variant
    |
    v
Renders <span> with computed classes
    |
    v
Optionally renders icon (with aria-hidden for accessibility)
    |
    v
Renders children (text label)
    |
    v
CSS applies glass styling, colors, pill shape
```

### Mastery Stage Mapping
```
Stage | Label        | Icon | Color  | Meaning
------|--------------|------|--------|----------------------------------
  0   | Unknown      |  ○   | Gray   | Item never encountered
  1   | Recognition  |  ◔   | Amber  | Can recognize when shown
  2   | Recall       |  ◑   | Blue   | Can recall with effort
  3   | Controlled   |  ◕   | Purple | Can use with conscious thought
  4   | Automatic    |  ●   | Green  | Uses without thinking (mastered)
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing component
- **Why**: Fulfill documentation-specialist mandate for 1:1 shadow mapping
- **Impact**: Enables future maintainers to understand context without reading code
