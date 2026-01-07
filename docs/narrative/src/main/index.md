# Main Process Entry Point

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/index.ts`
> **Status**: Active

---

## Why This Exists

The LOGOS application requires a central orchestrator to bootstrap the entire desktop application. As an Electron app, it operates in a dual-process architecture where the main process controls system-level operations (database access, file system, native APIs) while the renderer process displays the user interface. This file is the **genesis point** - the very first code executed when a user launches LOGOS.

Without this entry point, there would be no application. It performs four critical bootstrapping tasks in a precise sequence:

1. **Environment Configuration**: Sets up database connection strings for production deployments
2. **Database Initialization**: Ensures Prisma/SQLite is ready before any UI attempts data access
3. **IPC Registration**: Establishes all communication channels between main and renderer processes
4. **Window Creation**: Creates the visible application window with security-hardened configuration

**Business Impact**: Users expect instant, reliable launches. This file ensures the app starts correctly every time, handling platform-specific quirks (Windows installers, macOS dock behavior) transparently.

---

## Key Concepts

### Electron Multi-Process Architecture

**Technical Definition**: Electron applications run in multiple processes - a main process (Node.js runtime) that has full system access, and renderer processes (Chromium instances) that display web content with restricted privileges.

**Plain English**: Think of a restaurant - the kitchen (main process) has access to knives, fire, and the walk-in freezer (dangerous tools). The dining room (renderer) is where customers sit - they can see a nice menu and eat food, but cannot access the kitchen directly. Orders (IPC messages) pass through a service window.

### Context Isolation

**Technical Definition**: A security feature that creates a separate JavaScript context for the preload script, preventing renderer code from directly accessing Node.js APIs even if `nodeIntegration` were enabled.

**Plain English**: Like a bank teller window with bulletproof glass. The teller (preload script) can pass specific items through a small opening (contextBridge), but the customer (renderer) cannot reach through to grab the cash directly.

### Database URL Configuration

**Technical Definition**: The code dynamically constructs `DATABASE_URL` using Electron's `app.getPath('userData')` to ensure the SQLite database is stored in the appropriate platform-specific user data directory.

**Plain English**: Just like how documents save to "My Documents" on Windows or "Documents" on macOS, this ensures LOGOS's learning data saves to the correct platform-specific folder that persists across app updates.

### Squirrel Startup Handling

**Technical Definition**: Windows installers using Squirrel framework launch the app briefly during install/uninstall to handle shortcut creation. The `electron-squirrel-startup` module detects these scenarios and exits early.

**Plain English**: When installing software on Windows, you sometimes see the app flash briefly on screen. This is the installer asking the app to create Start Menu shortcuts. This code says "if we're being launched by the installer, just do the shortcut work and exit - don't show the full learning interface."

---

## Design Decisions

### Why Initialize Database Before IPC Handlers?

The database must be ready before registering IPC handlers because many handlers immediately perform database queries. If the order were reversed, the first IPC call from the renderer could fail with "database not initialized" errors.

**Alternative Considered**: Lazy initialization on first database access. Rejected because it would introduce race conditions and make error handling more complex.

### Why Disable Sandbox Mode?

The `sandbox: false` setting is required for preload script compatibility. While sandboxing provides additional security isolation, it restricts what the preload script can do, and LOGOS needs the preload to access certain Electron APIs.

**Trade-off**: Slightly reduced security isolation in exchange for full preload functionality. Mitigated by context isolation and strict navigation restrictions.

### Why Hidden Title Bar on macOS?

The `titleBarStyle: 'hiddenInset'` with custom `trafficLightPosition` creates a modern, native-feeling interface where the window controls are integrated into the app's custom header. This matches contemporary macOS application design patterns.

### Why Restrict Navigation?

The `will-navigate` event handler blocks navigation to any URL outside localhost (development) or file:// (production). This is defense-in-depth: even if future code accidentally rendered untrusted content with a navigation link, the app would refuse to navigate.

---

## Integration Points

### Upstream Dependencies

| Module | Import | Purpose |
|--------|--------|---------|
| `electron` | `app, BrowserWindow, shell` | Core Electron APIs for lifecycle, windowing, external link handling |
| `path` | Node.js built-in | Cross-platform path construction for preload script location |
| `./ipc` | `registerAllHandlers` | Registers all 50+ IPC channel handlers for main-renderer communication |
| `./db/client` | `initDatabase` | Initializes Prisma client and ensures SQLite database exists |

### Downstream Consumers

| Consumer | Relationship |
|----------|--------------|
| `src/main/preload.ts` | Loaded via `webPreferences.preload` - provides secure API bridge to renderer |
| `src/renderer/*` | Entire React application runs inside the created BrowserWindow |
| Electron runtime | Treats this as entry point via `package.json` main field |

### Lifecycle Event Flow

```
[App Launch]
     |
     v
[electron-squirrel-startup?] --yes--> [Create shortcuts, exit]
     |no
     v
[app.whenReady()]
     |
     v
[initDatabase()] --> Prisma connects, migrations run
     |
     v
[registerAllHandlers()] --> 50+ IPC channels become available
     |
     v
[new BrowserWindow()] --> Window created with security config
     |
     v
[loadURL / loadFile] --> React app loads
     |
     v
[User interacts] <--> [IPC messages] <--> [Main process handlers]
```

### Critical Path Status

**Severity**: CRITICAL

If this file fails:
- **No window**: Users see nothing; app appears to not launch
- **No database**: All learning progress, goals, sessions inaccessible
- **No IPC**: All UI buttons/interactions fail silently
- **No recovery**: Production has no fallback; restart is only option

---

## Change History

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-01-06 | Shadow documentation created | Establish narrative context for main process | Developers understand bootstrap sequence |
