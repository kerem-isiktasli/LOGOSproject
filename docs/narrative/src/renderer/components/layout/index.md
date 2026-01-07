# index.ts - Layout Components Barrel Export

## Why This Exists

Layout components define the structural chrome of the LOGOS application-the persistent shell, header, sidebar, and content containers that remain consistent across pages. This index consolidates all layout primitives so pages can compose their structure from a single import.

Centralizing layout exports also enforces visual consistency; developers import from here rather than reinventing navigation patterns.

## Key Concepts

- **AppShell**: The top-level layout wrapper providing the overall page structure (header, sidebar slot, main content area). Manages responsive behavior and sidebar collapse state.

- **AppHeader**: The fixed header bar containing branding, global actions, and user controls. Extracted as a standalone component for testability.

- **ContentContainer**: A standardized wrapper for page content ensuring consistent padding, max-width, and scroll behavior.

- **useAppShell Hook**: Provides context access to shell state (sidebar open/closed, current route). Components within the shell can respond to layout changes.

- **Sidebar**: The navigation drawer listing primary routes (Dashboard, Goals, Session, Analytics). Accepts `NavItem[]` for dynamic menu generation.

## Design Decisions

1. **Compound Component Pattern**: `AppShell`, `AppHeader`, `ContentContainer` are designed to compose together. `AppShell` renders slots for header and sidebar while `ContentContainer` handles the body.

2. **Hook for State Access**: Rather than prop-drilling layout state, `useAppShell` exposes context. This decouples deeply nested components from the shell's implementation.

3. **NavItem Type Export**: The `NavItem` type is exported explicitly so external configuration (e.g., route definitions) can provide typed menu structures.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/App.tsx` | Wraps the entire router in `<AppShell>` |
| Upstream | `renderer/pages/*` | Each page is rendered inside `<ContentContainer>` |
| Downstream | `renderer/components/ui/*` | Sidebar and Header use GlassButton, Logo, etc. |
| Downstream | `renderer/context/AppContext` | May share global state for auth/user info displayed in header |
| Sibling | `renderer/hooks/useLogos` | Shell may invoke hooks for user data or notifications |
