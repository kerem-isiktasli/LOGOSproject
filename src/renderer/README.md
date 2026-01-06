# Renderer Process (`src/renderer/`)

React-based user interface for LOGOS.

## Directory Structure

```
renderer/
├── App.tsx               # Root component, routing
├── main.tsx              # Entry point
├── index.html            # HTML template
│
├── pages/                # Route-level components
│   ├── DashboardPage.tsx
│   ├── SessionPage.tsx
│   ├── GoalsPage.tsx
│   ├── AnalyticsPage.tsx
│   └── SettingsPage.tsx
│
├── components/           # Reusable components
│   ├── ui/               # Design system primitives
│   ├── layout/           # App structure
│   ├── session/          # Training UI
│   ├── goal/             # Goal management
│   ├── analytics/        # Data visualization
│   └── onboarding/       # First-run experience
│
├── hooks/                # Custom React hooks
│   └── useLogos.ts       # IPC communication
│
├── context/              # React context
│   └── AppContext.tsx    # Global app state
│
├── styles/               # CSS files
│   ├── globals.css
│   ├── design-tokens.css
│   └── glass.css
│
├── lib/                  # Utilities (reserved)
└── assets/               # Static assets
    ├── logo.svg
    └── icon.svg
```

## Component Organization

### UI Components (`components/ui/`)

Glass-morphism design system primitives:

```tsx
import { GlassCard, GlassButton, GlassInput } from '@renderer/components/ui';

<GlassCard>
  <GlassInput placeholder="Enter text..." />
  <GlassButton onClick={handleClick}>Submit</GlassButton>
</GlassCard>
```

### Layout Components (`components/layout/`)

App structure components:

- `AppShell.tsx` - Main container with sidebar
- `Sidebar.tsx` - Navigation sidebar

### Feature Components

| Directory | Components |
|-----------|------------|
| `session/` | SessionView, QuestionCard, FeedbackCard, HintGauge, TimedExercise |
| `goal/` | CreateGoalForm, GoalCard, CorpusSourceSelector |
| `analytics/` | NetworkGraph, ProgressDashboard |
| `onboarding/` | OnboardingWizard |

## Data Fetching

Use the `useLogos()` hook for all IPC communication:

```tsx
import { useLogos } from '@renderer/hooks/useLogos';

function MyComponent() {
  const logos = useLogos();

  // Goal operations
  const goals = await logos.goal.list();
  const newGoal = await logos.goal.create({ ... });

  // Session operations
  const session = await logos.session.start(goalId, 'training');
  const result = await logos.session.recordResponse({ ... });

  // Analytics
  const progress = await logos.analytics.getProgress(goalId);
}
```

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| `DashboardPage` | `/` | Home, quick stats |
| `SessionPage` | `/session/:id` | Training interface |
| `GoalsPage` | `/goals` | Goal management |
| `AnalyticsPage` | `/analytics` | Progress visualization |
| `SettingsPage` | `/settings` | User preferences |

## Styling

The app uses a glass-morphism design system:

```css
/* design-tokens.css */
--glass-bg: rgba(255, 255, 255, 0.1);
--glass-border: rgba(255, 255, 255, 0.2);
--glass-blur: 10px;
```

## Adding a New Component

1. Create in appropriate `components/` subdirectory
2. Follow existing patterns (Glass design system)
3. Use `useLogos()` for data fetching
4. Keep components focused and reusable

## Adding a New Page

1. Create `src/renderer/pages/MyPage.tsx`
2. Add route in `App.tsx`
3. Add navigation link in `Sidebar.tsx`
