# Electron-Vite Build Configuration

> **Last Updated**: 2026-01-05
> **Code Location**: `electron.vite.config.ts`
> **Status**: Active

---

## Context & Purpose

This configuration file is the **build orchestrator** for the entire LOGOS desktop application. It tells electron-vite how to compile and bundle three fundamentally different types of code that must work together: the main process (backend), the preload script (security bridge), and the renderer (frontend UI).

**Business Need**: LOGOS is a language learning desktop application built with Electron. Desktop apps using Electron have a unique challenge - they need to run Node.js backend code AND browser-based React UI simultaneously, with a secure bridge between them. This configuration ensures all three pieces compile correctly and can find each other at runtime.

**When Used**: Every time a developer runs `npm run dev` (development mode), `npm run build` (production build), or `npm run preview` (preview production build), this configuration file is read and executed by electron-vite to coordinate the entire build process.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- `electron-vite`: The build tool that reads and executes this configuration - provides `defineConfig` function and `externalizeDepsPlugin`
- `@vitejs/plugin-react`: Vite plugin that enables React JSX compilation and Fast Refresh for the renderer process
- `path` (Node.js): Used for `resolve()` to create absolute paths for entry points and aliases

### Entry Points (What This Configures)

- **Main Process Entry**: `src/main/index.ts` - The Electron main process that creates windows, handles IPC, and manages app lifecycle
- **Preload Script Entry**: `src/main/preload.ts` - The security bridge that exposes a safe API from main to renderer via contextBridge
- **Renderer Entry**: `src/renderer/index.html` - The HTML file that bootstraps the React application

### Path Aliases Defined

| Alias | Target Directory | Used In |
|-------|------------------|---------|
| `@core` | `src/core` | Main process, Renderer |
| `@main` | `src/main` | Main process only |
| `@shared` | `src/shared` | Main process, Renderer |
| `@renderer` | `src/renderer` | Renderer only |

### Files That Depend On This

- `package.json`: Scripts like `dev`, `build`, `preview` invoke electron-vite which reads this config
- Every TypeScript file using path aliases (`@core`, `@main`, `@shared`, `@renderer`) relies on the alias definitions here
- The entire build pipeline - without this config, nothing compiles

---

## Macroscale: System Integration

### Architectural Role

This configuration sits at the **Build Infrastructure Layer** - it's not part of the application itself, but rather the foundation that makes the application possible.

```
Application Architecture:
==========================
[Build Layer]     <-- electron.vite.config.ts (YOU ARE HERE)
      |
      v
[Main Process]    <-- src/main/index.ts (Node.js/Electron)
      |
      v (IPC Bridge)
[Preload Script]  <-- src/main/preload.ts (Security sandbox)
      |
      v (contextBridge)
[Renderer]        <-- src/renderer/ (React/Browser)
```

### Big Picture Impact

**Without this configuration, the LOGOS application cannot:**
- Compile TypeScript to JavaScript
- Bundle dependencies for distribution
- Run in development mode with hot reload
- Create production builds for distribution

This is a **foundation-level** configuration. It's the blueprint that tells the build system how to construct the entire application from source code.

### The Three-Process Architecture

LOGOS, like all Electron apps, runs three distinct JavaScript contexts that this config orchestrates:

1. **Main Process** (Node.js environment)
   - Full access to Node.js APIs, file system, native modules
   - Manages windows, menus, system tray, app lifecycle
   - Handles database operations via Prisma/better-sqlite3
   - Configured in the `main:` section

2. **Preload Script** (Sandboxed bridge)
   - Runs before renderer loads, in isolated context
   - Only way to safely expose main process functionality to renderer
   - Uses `contextBridge.exposeInMainWorld()` to create the `window.logos` API
   - Configured in the `preload:` section

3. **Renderer Process** (Browser environment)
   - Standard web environment - no Node.js access (for security)
   - Runs React application for UI
   - Communicates with main process only through preload API
   - Configured in the `renderer:` section

### Critical Configuration Decisions

**externalizeDepsPlugin() for Main and Preload**:
This plugin tells Vite "don't bundle node_modules - leave them external". This is essential because:
- Native modules like `better-sqlite3` can't be bundled
- Electron itself shouldn't be bundled into the app
- Keeps main process builds fast and compatible with Node.js

**React plugin for Renderer only**:
Only the renderer needs React compilation - the main process and preload are pure Node.js/Electron code.

**Separate resolve.alias configs**:
Main process can't use `@renderer` paths, and renderer can't use `@main` paths. This enforces architectural boundaries at the build level.

---

## Technical Concepts (Plain English)

### defineConfig()
**Technical**: A helper function from electron-vite that provides TypeScript type checking and autocomplete for the configuration object.

**Plain English**: Like a form with pre-defined fields - it knows what options are valid and helps you fill them in correctly. If you make a typo, TypeScript will warn you.

**Why We Use It**: Prevents configuration errors and makes the config self-documenting through types.

### externalizeDepsPlugin()
**Technical**: A Vite plugin that marks all dependencies from node_modules as external, preventing them from being bundled into the output.

**Plain English**: Imagine packing for a trip - this plugin says "don't put the hotel furniture in your suitcase, it'll be there when you arrive." Node modules will be available in the Electron environment, so there's no need to pack them into the bundle.

**Why We Use It**: Native Node.js modules (like better-sqlite3) can't be bundled by Vite. They need to remain as separate files that Node.js loads at runtime.

### rollupOptions.input
**Technical**: Configuration passed to Rollup (the bundler Vite uses internally) specifying which file(s) are the entry points for the build.

**Plain English**: Telling the build system "start here" - like marking the beginning of a maze. The bundler follows all imports from these files to determine what needs to be included.

**Why We Use It**: Each process (main, preload, renderer) has its own entry point because they're completely separate programs that happen to work together.

### resolve.alias
**Technical**: Path mapping that transforms import paths at build time. When code says `import x from '@core/something'`, the bundler rewrites it to the actual file path.

**Plain English**: Like setting up shortcuts on your phone - instead of typing the full address every time, you just type the nickname. `@core` is easier than `../../core` and doesn't break when files move.

**Why We Use It**:
- Cleaner imports (`@core/fsrs` instead of `../../../core/fsrs`)
- Imports don't break when file structure changes
- Enforces architectural boundaries (renderer can't accidentally import from `@main`)

### Preload Script
**Technical**: A script that runs in an isolated context before web content loads, with access to a limited set of Node.js/Electron APIs through contextIsolation.

**Plain English**: Like a secure embassy between two countries. The main process (Node.js) has full power but is dangerous to expose directly. The renderer (browser) is safe but limited. The preload script acts as a controlled checkpoint where specific, safe operations are allowed through.

**Why We Use It**: Security. Without preload isolation, a cross-site scripting (XSS) vulnerability in the renderer could give attackers full access to the user's computer through Node.js APIs.

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for existing configuration
- **Why**: Enable team understanding of build architecture
- **Impact**: Developers can now understand why the build is structured this way

### Initial Implementation (Project Setup)
- **What Changed**: Created three-process Electron-Vite configuration with path aliases
- **Why**: LOGOS requires a desktop application with secure IPC communication and React UI
- **Impact**: Established the build foundation for the entire application
