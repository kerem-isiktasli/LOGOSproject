# index.ts - Feedback Components Barrel Export

## Why This Exists

User feedback mechanisms (toasts, confirmations, success animations) are cross-cutting concerns needed throughout the UI. This index centralizes all notification-related components so any page or feature can import a consistent feedback API without coupling to specific implementation details.

The Toast system in particular follows a provider/hook pattern that must be imported cohesively-splitting exports would break the context chain.

## Key Concepts

- **ToastProvider**: A React context provider that maintains the stack of active toast notifications. Must wrap the application root (typically inside `AppProvider`) to enable toast functionality everywhere.

- **useToast Hook**: Provides imperative access to toast operations (`show`, `dismiss`, `dismissAll`). Components call `useToast()` to push notifications onto the stack.

- **toast Utility**: A convenience object with static methods (`toast.success()`, `toast.error()`, `toast.info()`) for one-liner invocations outside React component scope (e.g., in async handlers).

- **Toast / ToastType Types**: Define the shape of a toast notification (message, type, duration) and the union of possible types (`success | error | warning | info`).

## Design Decisions

1. **Provider + Hook + Utility Triad**: Three export flavors (Provider for setup, hook for components, utility for imperative code) ensure the toast system is usable in any context while maintaining a single source of truth.

2. **Korean JSDoc**: The header comment (`사용자 피드백 컴포넌트 모음`) signals this module's purpose in the project's bilingual documentation style.

3. **Minimal Surface for Now**: Only Toast-related exports exist. As the feedback module grows (confirmations, modals, success animations), they will be added here following the same barrel pattern.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/App.tsx` | Wraps app tree in `<ToastProvider>` |
| Upstream | Any page/component | Calls `useToast()` or `toast.*` to display notifications |
| Downstream | (internal) | Toast likely uses `GlassCard` or similar for styling |
| Sibling | `renderer/components/ui/*` | May share button/icon primitives for dismiss actions |
| Sibling | `renderer/hooks/useLogos` | Mutation hooks may trigger toasts on success/error |
