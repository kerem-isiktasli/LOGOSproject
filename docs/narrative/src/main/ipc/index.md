# index.ts — IPC Handler Registry and Orchestration

## Why This Exists

Electron applications have a fundamental architectural split: the main process (Node.js, full system access) and renderer processes (browser-like, sandboxed). IPC (Inter-Process Communication) bridges this gap. This index file serves as the single point of truth for registering all IPC handlers during application startup. Without centralized registration, handlers would be scattered, making it impossible to reason about the full API surface, ensure consistent initialization order, or cleanly tear down for testing.

## Key Concepts

- **Handler Registration**: Each domain module (goal, learning, session, claude, agent, sync, onboarding) exports a `register*Handlers()` function that sets up its IPC channels. The index orchestrates calling all of these in sequence.

- **Handler Unregistration**: The mirror operation for cleanup. Critical for testing (resetting state between tests) and potential hot-reloading scenarios. Each module also exports `unregister*Handlers()`.

- **Console Logging**: Registration emits `[IPC]` prefixed logs, creating an audit trail in the main process console. This aids debugging ("which handlers actually loaded?") and performance analysis ("which registration is slow?").

- **Re-exports**: Beyond orchestration, the index re-exports individual handler functions and the contracts module. This allows consumers to either import everything from `./ipc` or selectively import specific domains.

## Design Decisions

**Explicit Registration Order**: Handlers are registered in a specific sequence: goal, learning, session, claude, agent, sync, onboarding. While most handlers are independent, this ordering might matter if any handler depends on another being present (though current code doesn't show such dependencies). The ordering at least provides predictability.

**Synchronous Registration**: All registration is synchronous (no async/await). This simplifies reasoning - by the time `registerAllHandlers()` returns, everything is ready. If any handler needed async initialization, the pattern would need to change.

**Silent Failure Potential**: There's no try-catch around individual registrations. If `registerGoalHandlers()` throws, subsequent handlers won't register. This is fail-fast behavior - better to crash loudly than run with partial functionality.

**No Conditional Loading**: All handlers are always loaded. There's no feature-flagging or environment-based selection. This keeps the system predictable but means unused features still occupy memory.

**Export Everything Pattern**: The barrel re-export (`export * from './contracts'`) means consumers get contracts utilities through the index. This is convenient but creates tight coupling - changes to contracts ripple through all consumers.

## Integration Points

**Upstream Dependencies**:
- `./goal.ipc`: Goal management handlers
- `./learning.ipc`: Learning object and queue handlers
- `./session.ipc`: Session lifecycle and analytics handlers
- `./claude.ipc`: AI content generation handlers
- `./agent.ipc`: Agent coordination handlers
- `./sync.ipc`: Data synchronization handlers
- `./onboarding.ipc`: User onboarding flow handlers
- `./contracts`: Shared IPC utilities (re-exported)

**Downstream Consumers**:
- `src/main/index.ts` (or equivalent): Calls `registerAllHandlers()` during app startup
- Test files: May call `unregisterAllHandlers()` between test suites
- Any module needing individual handler access can import from here

**Lifecycle**:
```
App Start
    |
    v
registerAllHandlers()
    |
    +-> registerGoalHandlers()
    +-> registerLearningHandlers()
    +-> registerSessionHandlers()
    +-> registerClaudeHandlers()
    +-> registerAgentHandlers()
    +-> registerSyncHandlers()
    +-> registerOnboardingHandlers()
    |
    v
App Running (handlers active)
    |
    v
App Shutdown / Test Cleanup
    |
    v
unregisterAllHandlers()
```

**IPC Module Summary**:
| Module | Domain | Key Responsibilities |
|--------|--------|---------------------|
| goal | Learning Goals | CRUD, corpus sources, vocabulary population |
| learning | Language Objects | Object CRUD, queue building, task generation |
| session | Learning Sessions | Session lifecycle, response tracking, analytics |
| claude | AI Integration | Content generation, error analysis, hints |
| agent | Dev Agents | Trigger detection, bottleneck management |
| sync | Data Sync | Cloud/local synchronization |
| onboarding | New Users | Initial setup flows |
