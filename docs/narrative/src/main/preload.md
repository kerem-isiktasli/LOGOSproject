# Preload Script - Secure API Bridge

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/preload.ts`
> **Status**: Active

---

## Why This Exists

Electron's security model enforces strict separation between the main process (which has full Node.js access) and renderer process (which runs untrusted web content). The preload script is the **controlled gateway** between these two worlds - it runs in a privileged context and can expose specific, safe functionality to the renderer via Electron's `contextBridge`.

This file exists to solve the fundamental question: **How can the React UI call backend services without compromising security?**

The answer is the `window.logos` API - a carefully designed interface that exposes exactly the functionality the UI needs (goal management, session control, analytics, Claude AI integration) while preventing any direct access to Node.js, the filesystem, or raw IPC channels.

**Business Impact**: Users get a fully-featured learning application with AI assistance, progress tracking, and offline support - all without security risks that would come from giving the UI direct system access.

---

## Key Concepts

### contextBridge and exposeInMainWorld

**Technical Definition**: Electron's `contextBridge.exposeInMainWorld()` creates a bridge that safely exposes objects to the renderer's global `window` object. The exposed API runs in an isolated context, preventing renderer code from accessing the preload script's Node.js environment.

**Plain English**: Imagine a hotel concierge desk. Guests (renderer) can request services through the desk (contextBridge), and the concierge (preload) has keys to various rooms (IPC handlers). But guests never get the master key - they can only make specific requests that the concierge fulfills.

### IPC Invoke Pattern

**Technical Definition**: `ipcRenderer.invoke()` is an async request-response pattern that sends a message to the main process and awaits a response. Unlike `send/on`, it returns a Promise and guarantees a response.

**Plain English**: Like ordering food at a restaurant. You (renderer) place an order (invoke), the kitchen (main process) prepares it, and a waiter brings it back (Promise resolves). You don't need to track order numbers or worry about responses getting lost.

### Type-Safe Wrapper Pattern

**Technical Definition**: The `invoke<T>()` helper function wraps `ipcRenderer.invoke()` with standardized error handling - checking `response.success` and throwing typed errors for failures.

**Plain English**: Every order comes back in a standard box. You open it, check if it says "success" or "error" on the label, and either enjoy the contents or read the error message. No surprise formats.

### LogosAPI Interface

**Technical Definition**: A TypeScript interface (defined in `src/shared/types.ts`) that provides compile-time type safety for all exposed API methods. The preload implements this interface exactly.

**Plain English**: A detailed menu that tells both the kitchen and the customers exactly what dishes are available, what ingredients each has, and what the final dish looks like. No ordering things that don't exist.

---

## Design Decisions

### Why Organize by Domain (goal, session, queue, etc.)?

The API is organized into logical domains (goal, object, session, queue, mastery, analytics, profile, claude, corpus, sync, onboarding, app) rather than technical categories. This makes the API intuitive for UI developers who think in terms of user features, not implementation details.

**Alternative Considered**: Flat API with prefixed method names (`createGoal`, `deleteGoal`). Rejected because nested objects provide clearer organization and IDE autocomplete.

### Why Translate API Shape?

Many methods translate between the UI's expected API shape and the IPC handler's expected shape. For example, `session.start()` receives `sessionType` but sends `mode` to the handler.

**Reason**: UI layer and IPC layer evolved separately. Rather than force breaking changes on either side, the preload acts as an adapter layer, translating between the two contracts.

### Why Implement Fallbacks in Profile Methods?

Profile API methods include `.catch()` handlers that return default values if the IPC call fails. This is unique among the API domains.

**Reason**: Profile handlers may not exist in early development or minimal deployments. Graceful fallbacks ensure the UI can always render a default user experience rather than crashing on missing handlers.

### Why getCurrent Uses Session List?

The `session.getCurrent()` method fetches the session list and finds the active one, rather than calling a dedicated "get current session" handler.

**Reason**: The handler API was designed around session IDs, not "find active session for goal." Rather than add new handler complexity, the preload composes existing handlers to provide the needed functionality.

### Why Build Queue Stats from Object List?

`mastery.getStats()` fetches all objects and computes distribution/retention locally rather than having a dedicated stats handler.

**Reason**: Keeps the handler layer focused on data retrieval. Aggregation logic in the preload is acceptable for moderate dataset sizes (under 1000 items) and keeps the handler API simpler.

---

## Integration Points

### IPC Channel Mapping

The preload exposes high-level methods that map to specific IPC channels:

| API Domain | Methods | IPC Channels Used |
|------------|---------|-------------------|
| `goal` | create, get, list, update, delete | `goal:create`, `goal:get`, `goal:list`, `goal:update`, `goal:delete` |
| `object` | create, get, list, update, delete, import | `object:create`, `object:get`, `object:list`, `object:update`, `object:delete`, `object:import` |
| `session` | start, end, getCurrent, recordResponse, getHistory | `session:start`, `session:end`, `session:get-state`, `session:submit-response`, `session:list` |
| `queue` | build, getNext, refresh | `queue:get`, `queue:refresh` |
| `mastery` | get, getStats | `object:get-mastery`, `object:list` |
| `analytics` | getProgress, getBottlenecks, getSessionStats | `analytics:get-progress`, `analytics:get-bottlenecks`, `analytics:get-history` |
| `claude` | generateContent, analyzeError, getHint, getBottlenecks | `claude:generateContent`, `claude:analyzeError`, `claude:getHint`, `claude:getBottlenecks` |
| `corpus` | listSources, getRecommendedSources, populateVocabulary, getPopulationStatus, clearVocabulary, uploadDocuments | `goal:list-sources`, `goal:get-recommended-sources`, `goal:populate-vocabulary`, `goal:get-population-status`, `goal:clear-vocabulary`, `goal:upload-corpus` |
| `sync` | getStatus, forceSync, getQueueSize, getQueueStats, clearCompleted, retryFailed, setOnline, checkConnectivity | `sync:status`, `sync:force`, `offline:queue-size`, `sync:queue-stats`, `sync:clear-completed`, `sync:retry-failed`, `sync:set-online`, `sync:check-connectivity` |
| `onboarding` | checkStatus, complete, skip, getUser | `onboarding:check-status`, `onboarding:complete`, `onboarding:skip`, `onboarding:get-user` |
| `app` | getVersion, getPlatform | `app:getVersion`, `process.platform` |

### Upstream Dependencies

| Module | Import | Purpose |
|--------|--------|---------|
| `electron` | `contextBridge, ipcRenderer` | Core Electron APIs for secure bridge and IPC |
| `../shared/types` | `LogosAPI` | TypeScript interface defining the complete API shape |

### Downstream Consumers

| Consumer | Usage |
|----------|-------|
| All React components | Access `window.logos` for data operations |
| `useLogos` hook | Provides React-friendly wrapper around `window.logos` |
| `src/renderer/context/*` | Context providers that use `window.logos` for state management |

### Security Boundary

```
[Renderer Process]                 [Main Process]
       |                                  |
  React UI                           IPC Handlers
       |                                  |
       v                                  v
window.logos.goal.create()  --(invoke)--> goal:create handler
       |                                  |
       | (isolated context)               | (full Node.js access)
       |                                  |
  contextBridge                      Database, Claude API,
  (safe exposure)                    File System access
```

### Critical Path Status

**Severity**: HIGH

If this file fails:
- **No API access**: React UI cannot communicate with backend
- **Blank functionality**: All buttons, forms, and displays fail
- **No learning**: Sessions, responses, progress - all inaccessible

**Mitigation**: Profile methods have fallbacks; other failures are fatal and require app restart.

---

## Change History

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-01-06 | Shadow documentation created | Establish narrative context for preload security bridge | Developers understand API structure and security model |
