# GlassCard Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/ui/GlassCard.tsx`
> **Status**: Active

---

## Why This Exists

GlassCard serves as the foundational container component in LOGOS's visual hierarchy. It exists because language learning applications need to present information in digestible, visually distinct chunks without overwhelming the learner. Traditional solid-background cards create visual heaviness; GlassCard solves this by using Apple's "Liquid Glass" aesthetic - translucent surfaces that float above content and create natural depth hierarchy.

**User Need**: Learners benefit from clear visual separation between different learning contexts (vocabulary cards, session summaries, goal trackers) while maintaining a cohesive, modern interface that feels lightweight despite containing complex information.

**Technical Need**: The application requires a flexible container that supports headers, footers, various padding configurations, and semantic color variants without duplicating styling logic across dozens of components.

---

## Key Concepts

### Liquid Glass Aesthetic
**Technical**: A design system using backdrop-filter blur, semi-transparent backgrounds, and subtle border highlights to create surfaces that appear to float above underlying content.

**Plain English**: Like looking through frosted glass - you can sense what's behind it without seeing details. This creates a layered feeling where important content "floats" above background elements, naturally drawing the eye.

**Why It Matters**: Reduces visual fatigue during extended learning sessions by avoiding harsh contrasts and solid blocks of color.

### Variant System
**Technical**: A discriminated union of styling presets (`default`, `light`, `frosted`, `primary`, `success`, `warning`, `danger`) that map to CSS class combinations.

**Plain English**: Pre-built color themes that give cards instant meaning. A green "success" card signals achievement; a red "danger" card signals something needs attention - like traffic lights for your interface.

**Why It Matters**: Enables semantic communication without requiring explicit labels. A mastery achievement card can be green; a due-for-review card can be amber.

### forwardRef Pattern
**Technical**: React's ref forwarding mechanism (`forwardRef`) that allows parent components to obtain a reference to the underlying DOM element.

**Plain English**: Lets parent components "reach through" GlassCard to touch the actual HTML element underneath - useful for animations, focus management, or measuring dimensions.

**Why It Matters**: Required for integration with animation libraries (Framer Motion), focus management systems, and DOM measurements without breaking the component abstraction.

---

## Design Decisions

### Why Header/Footer Are Optional Props, Not Composition
The card accepts `header` and `footer` as props rather than requiring composition (`<GlassCard><Header/><Body/><Footer/></GlassCard>`). This decision prioritizes:
1. **Common case simplicity**: Most cards just need a title string and content
2. **Consistent spacing**: Internal CSS handles header/body/footer gaps uniformly
3. **Flexibility escape hatch**: Complex layouts can pass ReactNode to header/footer

The companion components (`GlassCardHeader`, `GlassCardBody`, `GlassCardFooter`) exist for cases requiring custom internal structure.

### Why Interactive Is Separate From onClick
The `interactive` prop controls visual feedback (hover states) independently from click handling. This separation exists because:
1. Cards may be clickable but shouldn't show hover states (accessibility contexts)
2. Cards may show hover states for preview without being fully clickable yet
3. Loading states need to suppress interaction visually while maintaining handler attachment

### Why Loading Uses animate-pulse
Loading state uses Tailwind's `animate-pulse` rather than a skeleton or spinner because:
1. Cards retain their shape during loading, preventing layout shift
2. Pulse animation is subtle - appropriate for "refreshing" not "initial load"
3. Content remains visible but visually muted, indicating staleness

---

## Integration Points

### Direct Dependencies (What This Needs)
- **React**: Core library, specifically `forwardRef` for ref forwarding
- **Tailwind CSS**: Utility classes for layout (`p-3`, `p-6`, `p-8`)
- **Global CSS** (`glass.css` or similar): `.glass-card`, `.glass-light`, `.glass-frosted`, variant classes, `.glass-card-header`, `.glass-card-title`, `.glass-card-body`, `.glass-card-footer`

### Upstream Consumers (What Uses This)
- **`src/renderer/pages/AnalyticsPage.tsx`**: Wraps analytics dashboard sections
- **`src/renderer/pages/SettingsPage.tsx`**: Contains settings panels
- **`src/renderer/pages/VocabularyPage.tsx`**: Displays vocabulary item cards
- **`src/renderer/components/error/ErrorBoundary.tsx`**: Wraps error display UI
- **`src/renderer/components/goal/CorpusSourceSelector.tsx`**: Contains corpus selection UI
- **`src/renderer/components/session/TimedExercise.tsx`**: Wraps exercise content
- **`src/renderer/components/ui/index.ts`**: Re-exports for barrel import pattern

### System Role
GlassCard is a **primitive component** - the lowest-level container in the UI hierarchy. It sits at the foundation of the component pyramid:

```
Application Shell (AppShell)
    |
    +-- Pages (DashboardPage, SettingsPage, etc.)
           |
           +-- Feature Components (GoalCard, SessionView, etc.)
                  |
                  +-- GlassCard (this component)
                         |
                         +-- Content (text, inputs, badges, etc.)
```

If GlassCard fails or changes its API, virtually every page in the application would be affected. It is a **critical path component** for visual rendering.

### Data Flow
```
Props (variant, header, footer, padding, interactive, loading)
    |
    v
GlassCard renders <div> with computed classes
    |
    v
Children rendered inside .glass-card-body
    |
    v
CSS (glass.css) applies blur, transparency, borders
    |
    v
Browser composites glass effect over underlying content
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing component
- **Why**: Fulfill documentation-specialist mandate for 1:1 shadow mapping
- **Impact**: Enables future maintainers to understand context without reading code
