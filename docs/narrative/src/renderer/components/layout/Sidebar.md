# Sidebar Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/layout/Sidebar.tsx`
> **Status**: Active

---

## Why This Exists

The Sidebar provides the primary navigation structure for LOGOS, with a critical addition: **goal context awareness**. Unlike generic application sidebars, this component understands that language learners work toward specific goals (e.g., "Achieve JLPT N3 in Japanese") and all navigation should happen within that context.

**Business Need**: Users may have multiple learning goals across different languages. The sidebar provides quick switching between goals while maintaining clear context about which goal is currently active, preventing accidental mixing of study materials.

**User Problem Solved**: Learners often lose track of what they were studying, especially when returning after a break. The sidebar's goal selector immediately shows "You are studying Japanese - JLPT N3" so users always know their context.

**When Used**: The Sidebar renders as the `sidebar` prop of AppShell. It appears on all non-focus-mode screens and collapses to icon-only view on narrower displays or when user prefers more content space.

---

## Key Concepts

### Goal-Centric Navigation

The component features a prominent **Goal Selector** at the top that shows:
- Current target language (displayed as a badge, e.g., "JP", "ES", "FR")
- Current goal name (e.g., "JLPT N3 Prep")
- Dropdown to switch between user's goals or create new ones

This design ensures users never navigate blindly - they always know which learning goal context they're operating within.

### Collapsed State Intelligence

When the sidebar collapses (user choice or responsive breakpoint):
- **Icons remain visible** for quick access to main sections
- **Goal badge** (language code) stays visible as context reminder
- **Labels and text** disappear to save space
- **Tooltips** should appear on hover (implementer's responsibility)

This allows power users to maximize content area while maintaining navigation capability.

### Inner Glow Active States

**Design Philosophy Note**: Rather than using solid background colors for the active navigation item (which can feel harsh), this component uses `box-shadow: var(--shadow-inner-glow)` to create a soft, luminous effect. This aligns with the "Liquid Glass" aesthetic where states are indicated through light and translucency rather than heavy fills.

### Nested Navigation Support

Navigation items (`NavItem`) can have `children`, creating expandable sections. When expanded:
- Chevron rotates to indicate state
- Nested items appear with a left border for visual hierarchy
- Nested items are hidden when sidebar is collapsed (no room for hierarchy)

---

## Design Decisions

### State Consumed from AppShell Context

**Decision**: Sidebar reads `sidebarCollapsed` from `useAppShell()` rather than receiving it as a prop.

**Rationale**: This creates a single source of truth for sidebar state. Any component anywhere in the app can toggle the sidebar, and Sidebar will respond. This is crucial for responsive design where viewport changes might trigger collapse.

**Trade-off**: Sidebar cannot be used outside an AppShell context. The `useAppShell()` hook will throw if called without the provider.

### Inline SVG Icons

**Decision**: Icons like `ChevronIcon` and `MenuIcon` are defined inline as functional components rather than imported from an icon library.

**Rationale**:
1. Keeps the component self-contained for easier understanding
2. Avoids external dependency for simple shapes
3. Allows precise control over stroke width and styling

**Trade-off**: More verbose than `<Icon name="chevron" />` pattern. If icon library is later adopted, these should be replaced.

### Goal Dropdown as Local State

**Decision**: The goal selector dropdown open/closed state is managed locally (`useState`) rather than in context.

**Rationale**: This is transient UI state that doesn't affect other components. No other component needs to know if the goal dropdown is open.

### Dual Navigation Lists (Primary + Secondary)

**Decision**: Props accept both `navItems` (primary) and `secondaryItems` (utility/settings).

**Rationale**: Common pattern where main navigation (Dashboard, Library, Sessions) is visually separated from utility actions (Settings, Help, Logout). Secondary items appear at bottom with a border separator.

---

## Integration Points

### Parent Component

**AppShell** renders Sidebar in its `sidebar` slot:
```tsx
<AppShell sidebar={<Sidebar navItems={...} activeGoal={...} />}>
```

### Context Dependency

Sidebar requires being rendered within `AppShellContext.Provider`. It accesses:
- `sidebarCollapsed` - To adjust its own layout
- `toggleSidebar` - To wire up the collapse button

### Callback Props for External Control

The Sidebar doesn't manage goals itself; it receives callbacks:

| Prop | Purpose | Typical Handler |
|------|---------|-----------------|
| `onGoalChange(goalId)` | User selected different goal | Update app-level goal state, refetch data |
| `onCreateGoal()` | User clicked "New Goal" | Open goal creation modal/wizard |
| `onUserAction(action)` | Profile/settings/logout clicked | Route to settings, trigger auth flow |

### UI Component Dependencies

The Sidebar imports from `../ui`:
- `GlassButton` - Used for standard buttons
- `GlassIconButton` - Used for the collapse toggle (icon-only button)

These must be available and styled appropriately.

### CSS Custom Properties Required

The component relies on:
- `--space-*` - Spacing scale (2, 3, 4, 6, etc.)
- `--radius-*` - Border radius tokens (md, lg, xl, 2xl, full)
- `--glass-border`, `--glass-tint-light` - Glass effect colors
- `--color-primary`, `--color-neutral-*` - Color palette
- `--color-danger` - For badge backgrounds (notifications)
- `--font-*` - Typography weights (medium, semibold, bold)
- `--text-*` - Typography sizes (xs, sm, xl)
- `--duration-*` - Animation durations
- `--ease-out` - Easing function
- `--shadow-inner-glow` - Active state effect

### NavItem Interface

Components providing navigation items must match this interface:
```typescript
interface NavItem {
  id: string;          // Unique identifier
  label: string;       // Display text
  icon: ReactNode;     // Icon component/element
  href?: string;       // For link navigation
  onClick?: () => void; // For action navigation
  active?: boolean;    // Currently selected
  badge?: string | number; // Notification count
  children?: NavItem[]; // Nested items
}
```
