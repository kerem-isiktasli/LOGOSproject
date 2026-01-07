# index.ts - Session Components Barrel Export

## Why This Exists

The learning session is the core interaction loop in LOGOS-where users actively practice and receive feedback. This index aggregates the "Training Gym" components that orchestrate question presentation, response capture, and feedback delivery.

Centralizing session exports ensures that the complex session state machine and its UI pieces remain cohesive and importable from a single location.

## Key Concepts

- **SessionView**: The orchestrator component managing session lifecycle (start, present item, capture response, show feedback, advance, end). Accepts `SessionConfig` to customize behavior and emits events via `SessionState` and `SessionStats`.

- **SessionTask**: Represents a single practice item within a session, including the prompt, expected response, and scaffolding options.

- **SessionItem / SessionState / SessionStats Types**: Define the shape of individual items, the current session state machine position, and aggregated statistics (correct count, time spent, etc.).

- **FeedbackCard**: Displays post-response feedback (correct/incorrect, explanation, hints). Uses `FeedbackData` to render contextual guidance.

- **QuestionCard**: Renders the active learning prompt with input field, cue controls, and timer. Accepts `LearningItem` describing what to display.

## Design Decisions

1. **View + Card Separation**: `SessionView` handles state orchestration while `QuestionCard` and `FeedbackCard` handle presentation. This separation allows swapping card designs without rewriting session logic.

2. **Rich Type Exports**: Six distinct type exports (`SessionViewProps`, `SessionTask`, `SessionConfig`, `SessionItem`, `SessionState`, `SessionStats`) reflect the complexity of session management. Explicit typing prevents runtime surprises.

3. **Training Gym Metaphor**: The JSDoc describes components as forming the "Training Gym experience", aligning code terminology with product language for easier cross-functional communication.

## Integration Points

| Direction | Module | Relationship |
|-----------|--------|--------------|
| Upstream | `renderer/pages/SessionPage` | Renders `<SessionView>` as the main content |
| Downstream | `renderer/hooks/useLogos` | `useSession`, `useQueue`, `useNextItem`, `useRecordResponse` drive session data |
| Downstream | `main/ipc/session.ipc` | IPC handlers for session start/end/record |
| Downstream | `core/fsrs`, `core/irt` | Algorithms update mastery after response recording |
| Sibling | `renderer/components/ui/GlassProgress` | `SessionProgress` shows session advancement |
| Sibling | `renderer/components/feedback/Toast` | May surface success toasts on session completion |
