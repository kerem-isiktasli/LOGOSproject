# AppShell Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/layout/AppShell.tsx`
> **Status**: Active

---

## Why This Exists

The AppShell is the foundational structural container for the entire LOGOS application interface. It exists because desktop learning applications require a consistent, distraction-free environment where users can focus on their language learning tasks while still having access to navigation and system controls when needed.

**Business Need**: Users learning a new language need an interface that can adapt between navigation mode (finding content, managing goals) and focus mode (concentrated learning sessions). The AppShell provides this flexibility through collapsible sidebar and focus mode features.

**User Problem Solved**: Without a unified shell component, the application would have inconsistent layouts across different views, jarring transitions, and no centralized way to manage UI state like theme preferences or sidebar visibility.

**When Used**: The AppShell wraps every view in the application. It renders immediately on application startup and persists throughout the user's session. Every other component exists within its content area.

---

## Key Concepts

### Layout State Management via React Context

The AppShell uses **React Context** (a mechanism for sharing state across deeply nested components without prop drilling) to provide layout controls throughout the application. This means any child component can access sidebar state, focus mode, or theme settings without receiving them as props through every intermediate component.

The `useAppShell` hook exposes:
- `sidebarCollapsed` / `toggleSidebar` - Expand/collapse navigation
- `focusMode` / `toggleFocusMode` - Hide all chrome for distraction-free learning
- `theme` / `setTheme` - Light, dark, or system preference

### Focus Mode Philosophy

Focus mode is not just hiding UI elements - it represents a cognitive shift. When enabled:
- Sidebar slides completely off-screen
- Header disappears
- Only the learning content remains

This aligns with research on learning environments showing reduced visual clutter improves retention and reduces cognitive load.

### Glass Surfaces as Visual Layers

The component implements what the codebase calls "Liquid Glass" aesthetic. The sidebar floats as a semi-transparent frosted panel, visually separating navigation from content. This creates depth hierarchy without harsh borders, making the interface feel modern and reducing visual fatigue during long study sessions.

---

## Design Decisions

### Fixed Sidebar vs. Inline

**Decision**: Sidebar uses `position: fixed` rather than being part of the document flow.

**Rationale**: A fixed sidebar:
1. Maintains consistent navigation access regardless of scroll position
2. Allows the main content to scroll independently
3. Enables smooth collapse/expand transitions without reflowing document

**Trade-off Accepted**: The main content area must account for sidebar width via `margin-left`, requiring CSS coordination between components.

### Theme Applied to Document Root

**Decision**: Theme changes set `data-theme` attribute on `document.documentElement` rather than on a React element.

**Rationale**: CSS custom properties (design tokens) for colors need to cascade from the root. By setting the theme at the document level, all components automatically inherit the correct color values without needing to pass theme through React context.

### System Theme Detection

**Decision**: When theme is set to "system", the component listens to `prefers-color-scheme` media query.

**Rationale**: Modern users expect applications to respect their OS-level dark mode settings. This provides seamless integration with Windows/macOS appearance settings.

### Separate Header Component

**Decision**: `AppHeader` is exported as a separate component rather than built into AppShell.

**Rationale**: Different views may need different header content (breadcrumbs in library, progress in sessions, etc.). By making the header slot-based, views control their own header while AppShell provides consistent positioning.

---

## Integration Points

### Components That Provide Content to AppShell

| Slot | Typically Receives | Examples |
|------|-------------------|----------|
| `sidebar` | Sidebar component | Goal selector, navigation items |
| `header` | AppHeader with custom content | Breadcrumbs, session timer, user actions |
| `children` | Current view | SessionView, LibraryView, DashboardView |

### Components That Consume AppShell Context

Any component can call `useAppShell()` to access shell state:

- **Sidebar.tsx**: Reads `sidebarCollapsed` to adjust its own layout
- **Session components**: May toggle `focusMode` during active learning
- **Settings views**: May call `setTheme` when user changes preferences
- **Mobile navigation**: May call `setSidebarCollapsed(false)` to open sidebar overlay

### CSS Custom Properties Required

The component depends on these CSS variables being defined:
- `--sidebar-width` / `--sidebar-collapsed-width`
- `--header-height`
- `--z-fixed` / `--z-sticky`
- `--duration-300` / `--ease-glass`
- `--space-*` (spacing scale)
- `--radius-2xl`

These should be defined in the global stylesheet or design system.

### Data Attributes for Styling Hooks

The component sets these data attributes for external CSS targeting:
- `data-sidebar-collapsed="true|false"` on `.app-shell`
- `data-theme="light|dark"` on `documentElement`
- `data-focus-mode="true|false"` on `documentElement`

### Child Components

AppShell exports these additional components:
- `AppHeader` - Three-column header layout (left, center, right)
- `ContentContainer` - Constrained-width content wrapper with max-width options
