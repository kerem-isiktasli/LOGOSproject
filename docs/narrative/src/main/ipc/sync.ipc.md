# Sync IPC Handlers Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/main/ipc/sync.ipc.ts`
> **Status**: Active

---

## Context & Purpose

This module serves as the communication bridge between the user interface (renderer process) and the offline synchronization system in the Electron main process. It exists to give users visibility and control over what happens when their internet connection is unstable or unavailable.

**Business Need**: Language learning requires interaction with the Claude AI for generating exercises, analyzing errors, and providing hints. When users are offline (traveling, poor connection, etc.), their learning requests must be queued and processed later. This module exposes that queuing system to the UI so users can:
- See if they're online or offline
- Know how many pending operations are waiting
- Manually trigger synchronization when back online
- Manage failed operations (retry or clear them)

**When Used**:
- When the application starts and needs to check connectivity status
- When users open a sync/connectivity status panel in the UI
- When users manually request a sync operation
- When the UI needs to display queue statistics (pending tasks, failed items)
- When testing offline behavior with manual online/offline overrides

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`src/main/ipc/contracts.ts`**:
  - `registerDynamicHandler()` - Registers IPC handlers that the renderer can invoke
  - `unregisterHandler()` - Cleans up handlers during shutdown
  - `success()` / `error()` - Standard response wrappers for consistent API responses
  - `CHANNELS` - Predefined channel constants (`SYNC_STATUS`, `SYNC_FORCE`, `OFFLINE_QUEUE_SIZE`)

- **`src/main/services/offline-queue.service.ts`**:
  - `getOfflineQueueService()` - Gets the singleton queue manager instance
  - `OfflineQueueStats` type - Statistics about queue items by status

### Dependents (What Needs This)

- **`src/main/ipc/index.ts`**: Should import and register these handlers during app initialization (Note: Currently not included in the index file - this appears to be a gap)
- **Renderer Process (UI)**: Any React component that displays connectivity status or sync controls will invoke these handlers via Electron's IPC

### Data Flow

```
User clicks "Check Status" in UI
        |
        v
Renderer Process calls ipcRenderer.invoke('sync:status')
        |
        v
[This Module] receives request via registerDynamicHandler
        |
        v
Calls OfflineQueueService.getStats() and getOnlineStatus()
        |
        v
Returns { online, pendingItems, processingItems, failedItems, lastSync }
        |
        v
UI displays connectivity indicator and queue counts
```

```
User clicks "Sync Now" button
        |
        v
Renderer calls ipcRenderer.invoke('sync:force')
        |
        v
[This Module] checks connectivity via queueService.checkConnectivity()
        |
        +--- If offline: Returns error "Cannot sync: No connectivity"
        |
        +--- If online: Calls queueService.processQueue()
                |
                v
        Queue processes pending items (Claude API calls)
                |
                v
        Returns { processed, remaining, failed } counts
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at **Layer 2 (IPC Bridge)** of the LOGOS three-tier architecture:

```
+-------------------------------------------+
|  Layer 1: Renderer (React UI Components)  |
|  - Sync status indicators                 |
|  - "Sync Now" buttons                     |
|  - Queue management panels                |
+-------------------------------------------+
                    |
                    | IPC Invoke/Handle
                    v
+-------------------------------------------+
|  Layer 2: IPC Bridge (THIS MODULE)        |  <-- You are here
|  - sync:status                            |
|  - sync:force                             |
|  - offline:queue-size                     |
|  - sync:queue-stats                       |
|  - sync:clear-completed                   |
|  - sync:retry-failed                      |
|  - sync:set-online                        |
|  - sync:check-connectivity                |
+-------------------------------------------+
                    |
                    | Service Calls
                    v
+-------------------------------------------+
|  Layer 3: Business Logic Services         |
|  - OfflineQueueService (queue management) |
|  - ClaudeService (AI API calls)           |
|  - Database (SQLite via Prisma)           |
+-------------------------------------------+
```

### Big Picture Impact

This module is part of the **Offline-First Architecture** that makes LOGOS usable without constant internet access. It enables:

1. **Graceful Degradation**: Users can continue learning even when offline. Their interactions are queued and processed later.

2. **User Transparency**: Instead of mysterious failures, users see exactly what's pending and what's failed.

3. **User Control**: Manual sync triggers and retry mechanisms give users agency over their data synchronization.

4. **Developer Testing**: The `sync:set-online` handler allows developers to simulate offline conditions without actually disconnecting.

**System Dependencies**:
- The entire Claude AI integration relies on this sync system for resilience
- Session recording and error analysis can queue requests here when offline
- Task generation can pre-queue items for later processing

### Critical Path Analysis

**Importance Level**: Medium-High

- **If this module fails**: Users lose visibility into sync status. Queue operations still work (OfflineQueueService handles that), but users can't monitor or control them. The UI may show stale or no connectivity information.

- **Failure modes**:
  - If handlers aren't registered: UI gets no response when checking sync status
  - If OfflineQueueService fails: Handlers return error messages to UI
  - If connectivity check hangs: Force sync may timeout

- **Graceful degradation**: The OfflineQueueService has its own periodic processing, so even if this IPC layer fails, queued items will eventually process when connectivity returns.

---

## Technical Concepts (Plain English)

### IPC (Inter-Process Communication)
**Technical**: Electron's mechanism for the renderer process (web page) to communicate with the main process (Node.js backend). Uses channel-based message passing with `ipcMain.handle()` and `ipcRenderer.invoke()`.

**Plain English**: Think of it like a restaurant where the dining room (UI) and kitchen (main process) are completely separate. IPC is the waiter who takes orders from the dining room to the kitchen and brings back the food.

**Why We Use It**: Electron security model requires this separation. The UI can't directly access the file system, database, or make API calls - it must ask the main process to do these things.

### Dynamic Handler Registration
**Technical**: Using `registerDynamicHandler()` instead of the type-safe `registerHandler()` for channels not defined in `IPCHandlerMap`.

**Plain English**: Some IPC channels are "pre-registered" with strict type checking (like forms that only accept specific inputs). Dynamic handlers are more flexible - they accept any input format but trade off compile-time safety for runtime flexibility.

**Why We Use It**: The sync handlers were added later and use string-based channel names (`'sync:queue-stats'`) rather than being part of the original typed contract. This allows faster iteration but should eventually be moved to typed contracts.

### Channel Tracking for Cleanup
**Technical**: The `registeredChannels` array tracks which IPC handlers this module has registered, enabling `unregisterSyncHandlers()` to cleanly remove them all during shutdown or testing.

**Plain English**: Like keeping a guest list at a party - when it's time to clean up, you know exactly who needs to leave. Without this list, you'd have "orphaned" handlers that might cause conflicts on restart.

**Why We Use It**: Proper cleanup prevents memory leaks and handler conflicts during hot-reloading in development or when running tests.

### Singleton Service Pattern
**Technical**: `getOfflineQueueService()` returns a single shared instance of the queue service, ensuring all handlers operate on the same queue state.

**Plain English**: Like having one shared calendar for an entire office rather than everyone keeping their own separate calendars. Everyone sees the same information and changes are immediately visible to all.

**Why We Use It**: Queue state (pending items, processing items) must be consistent across all handlers. Multiple instances would lead to race conditions and inconsistent data.

---

## Handler Reference

| Channel | Purpose | Input | Output |
|---------|---------|-------|--------|
| `sync:status` | Get current sync state | None | `{ online, pendingItems, processingItems, failedItems, lastSync }` |
| `sync:force` | Trigger immediate sync | None | `{ processed, remaining, failed }` |
| `offline:queue-size` | Get pending count only | None | `{ count }` |
| `sync:queue-stats` | Get detailed statistics | None | `OfflineQueueStats` object |
| `sync:clear-completed` | Remove old completed items | `{ olderThanHours?: number }` | `{ cleared }` |
| `sync:retry-failed` | Retry all failed items | None | `{ retried }` |
| `sync:set-online` | Manual online/offline toggle | `{ online: boolean }` | `{ online }` |
| `sync:check-connectivity` | Ping Claude API | None | `{ online }` |

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for sync.ipc.ts
- **Why**: Shadow documentation required for all code files per project guidelines
- **Impact**: Improves understanding for future developers working on offline/sync features

### Initial Implementation
- **What Changed**: Created sync IPC handlers for offline queue management
- **Why**: Users need visibility and control over sync operations when connectivity is unstable
- **Impact**: Enables offline-first architecture with user transparency

---

## Notes & Observations

### Integration Gap
The `sync.ipc.ts` module is not currently imported in `src/main/ipc/index.ts`. This means the handlers may not be registered during application startup. This should be verified and corrected if needed.

### TODO in Code
The `SYNC_STATUS` handler has a TODO comment: `// TODO: Track actual last sync time`. Currently it returns `new Date().toISOString()` which is the current time, not the actual last successful sync. This should be tracked in the OfflineQueueService for accurate reporting.

### Testing Support
The `sync:set-online` handler is explicitly documented as "for testing or user override" - this is a developer experience feature that allows simulating offline conditions without network manipulation.
