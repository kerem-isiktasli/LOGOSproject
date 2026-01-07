# Main Entry Point

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/main.tsx`
> **Status**: Active

---

## Why This Exists

The main.tsx file is the **bootstrap entry point** for the React renderer process. It's the first JavaScript that runs in the browser window context, responsible for finding the DOM root element and mounting the React application.

**Business Need**: Every React application needs a single entry point that bridges the HTML document and the React component tree. This file is that bridge - it's referenced by the HTML file and kicks off the entire UI.

**When Used**:
- Once, at application startup
- Referenced by Electron's renderer process HTML file
- Vite (or webpack) uses this as the entry point for bundling

---

## Key Concepts

### createRoot API (React 18+)
**Technical**: Uses React 18's `createRoot` API instead of the legacy `ReactDOM.render`. This enables concurrent features like automatic batching and transitions.

**Plain English**: Like upgrading from a single-lane road to a multi-lane highway - React 18's new rendering engine can handle more work in parallel and prioritize important updates.

**Why We Use It**:
- React 18 is the current version
- Enables future use of concurrent features (Suspense, transitions)
- Better performance through automatic batching

### StrictMode Wrapper
**Technical**: Wraps the App in `React.StrictMode`, which intentionally double-invokes certain functions during development to detect side effects and deprecation warnings.

**Plain English**: Like a driving instructor who makes you parallel park twice to ensure you really know how - catches mistakes early by running things twice.

**Why We Use It**:
- Catches accidental side effects
- Highlights legacy lifecycle usage
- Prepares codebase for concurrent features
- Only active in development (no production overhead)

### Root Element Guard
**Technical**: Throws an explicit error if `document.getElementById('root')` returns null, preventing silent failures.

**Plain English**: Like checking that the restaurant actually exists before telling everyone to meet there - if the root element is missing, we fail loudly rather than silently.

**Why We Use It**: A missing root element would cause React to silently fail or throw a confusing error. This guard provides a clear, actionable error message.

### Hot Module Replacement (HMR)
**Technical**: Checks for `import.meta.hot` (Vite's HMR API) and accepts module updates to enable instant refresh during development without losing application state.

**Plain English**: Like changing a car's tire while it's driving - code updates are swapped in without restarting the whole application.

**Why We Use It**:
- Faster development feedback loop
- Preserves React state during code changes
- Vite provides this capability out of the box

---

## Design Decisions

### Why Minimal Entry Point
The file is intentionally tiny (about 20 lines) because:
- Single responsibility: just mount React
- All app logic belongs in App.tsx and below
- Easy to understand at a glance
- Standard pattern across React projects

### Why Not Import Providers Here
Providers (ErrorBoundary, AppProvider, etc.) are composed in App.tsx rather than main.tsx because:
- Keeps entry point minimal
- App.tsx is the logical place for provider composition
- Easier testing of App.tsx (can test provider setup)
- Entry point focuses only on DOM bridging

### Why Throw on Missing Root
Could have used optional chaining or default behavior, but throwing because:
- Missing root is a configuration error, not a runtime condition
- Developers need to know immediately
- The app cannot function without it
- Clear error message aids debugging

### Why Global CSS Import Here
`./styles/globals.css` is imported here (the entry point) because:
- Ensures styles load before any component renders
- Single import point for global styles
- Convention in React/Vite projects

---

## Integration Points

### Dependencies (What This Needs)
- `react`: Core React library
- `react-dom/client`: `createRoot` for React 18 rendering
- `./App`: The root React component
- `./styles/globals.css`: Global stylesheet

### Dependents (What Needs This)
- `index.html`: References this file as the module entry point
- Vite/build system: Uses this as the renderer entry point
- Electron main process: Loads the window that runs this code

### File Relationships
```
index.html
    │
    └─ <script type="module" src="./main.tsx">
         │
         └─ main.tsx (this file)
              │
              ├─ imports globals.css (side effect)
              │
              └─ renders <App /> into #root
                   │
                   └─ App.tsx (provider composition, routing)
```

### Build Pipeline Position
```
Source Files
    │
    ├─ main.tsx (entry point) <- YOU ARE HERE
    │    │
    │    └─ imports App.tsx, which imports everything else
    │
    ▼
Vite/Bundler
    │
    └─ Outputs bundled JS/CSS
         │
         └─ Loaded by Electron renderer window
```

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation for existing main.tsx entry point
- **Why**: Part of systematic documentation effort for core application architecture
- **Impact**: Completes documentation of the renderer entry chain (main.tsx -> App.tsx -> pages)
