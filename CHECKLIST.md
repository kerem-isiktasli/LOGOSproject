# LOGOS Development Checklist

> **Real-time progress tracker** - Update checkboxes as work completes
>
> Last Updated: 2026-01-04

---

## Phase 1: Foundation
*Get the app running with basic structure*

### 1.1 Project Setup
- [ ] **Create project directory structure** - Folders for main, renderer, core, shared
- [ ] **Initialize from Electron+React template** - Clone guasam/electron-react-app as base
- [ ] **Configure TypeScript strict mode** - Catch errors at compile time
- [ ] **Set up ESLint + Prettier** - Consistent code style across all files
- [ ] **Initialize Git repository** - Version control from day one
- [ ] **Create .env.example** - Template for API keys (never commit real keys)

### 1.2 Database Layer
- [ ] **Install Prisma + better-sqlite3** - Database ORM and SQLite driver
- [ ] **Create schema.prisma** - Copy from ALGORITHMIC-FOUNDATIONS.md Part 4
- [ ] **Run initial migration** - Generate database tables
- [ ] **Test CRUD operations** - Verify data persists across app restarts
- [ ] **Add seed data script** - Sample goals and language objects for testing

### 1.3 Core Algorithms (Pure TypeScript)
- [ ] **Create /src/core/types.ts** - Shared type definitions
- [ ] **Implement irt.ts** - θ estimation, probability functions (Part 1)
- [ ] **Implement pmi.ts** - PMI calculation, difficulty mapping (Part 2)
- [ ] **Implement fsrs.ts** - Spaced repetition scheduling (Part 3)
- [ ] **Implement priority.ts** - FRE calculation, queue sorting
- [ ] **Implement bottleneck.ts** - Error pattern analysis (Part 7)
- [ ] **Write unit tests for each** - 100% coverage on pure functions

### 1.4 IPC Bridge
- [ ] **Define IPC contracts** - Typed message interfaces in /src/shared/
- [ ] **Create goal.ipc.ts** - Goal CRUD handlers
- [ ] **Create learning.ipc.ts** - Queue and task handlers
- [ ] **Create session.ipc.ts** - Session tracking handlers
- [ ] **Test IPC round-trip** - Renderer calls main, gets response

### 1.5 Claude API Integration
- [ ] **Install @anthropic-ai/sdk** - Official TypeScript SDK
- [ ] **Create claude.service.ts** - API wrapper with retry logic
- [ ] **Implement offline fallback** - Cache and template tasks when offline
- [ ] **Test vocabulary extraction** - Send sample text, get structured response
- [ ] **Test task generation** - Request task for sample word

**CHECKPOINT 1: App launches, database works, algorithms run, Claude responds**

---

## Phase 2: Core Data Layer
*Store and retrieve all learning data correctly*

### 2.1 Goal Management
- [ ] **Create goal from user input** - Parse natural language or dropdown selection
- [ ] **Store GoalSpec in database** - All goal dimensions saved
- [ ] **Extract vocabulary from goal** - Claude analyzes domain corpus
- [ ] **Generate LanguageObjects** - Create items with F, R, E metrics
- [ ] **Calculate initial priorities** - Sort learning queue

### 2.2 Mastery State Tracking
- [ ] **Initialize MasteryState for each object** - Stage 0, empty FSRS card
- [ ] **Update state on response** - Stage transitions, accuracy tracking
- [ ] **Track cue-free vs cue-assisted** - Separate accuracy metrics
- [ ] **Calculate scaffolding gap** - Difference between assisted/free
- [ ] **Schedule next reviews** - FSRS determines intervals

### 2.3 Session Recording
- [ ] **Start session with mode** - Learning, Training, or Evaluation
- [ ] **Log each response** - Task type, correct/incorrect, time, cue level
- [ ] **Apply θ rules by mode** - Freeze, soft-track, or IRT-update
- [ ] **End session with summary** - Items practiced, transitions, bottlenecks
- [ ] **Store θ snapshots** - History of ability estimates

### 2.4 Collocation Storage
- [ ] **Store PMI pairs** - Word relationships with significance
- [ ] **Query collocations by word** - Get related words for task generation
- [ ] **Update on new content** - Recalculate when corpus expands

**CHECKPOINT 2: Data persists correctly, learning queue sorts by priority**

---

## Phase 3: Learning Engine
*The 3-layer pipeline that makes LOGOS intelligent*

### 3.1 Layer 1: State + Priority
- [ ] **Analyze user θ state** - Current ability estimates per component
- [ ] **Apply FRE formula** - Weight frequency, relations, context
- [ ] **Calculate cost adjustments** - Factor in L1 transfer, exposure
- [ ] **Sort learning queue** - Highest priority items first
- [ ] **Detect bottlenecks** - Identify weak component types

### 3.2 Layer 2: Task Generation
- [ ] **Select target object** - Pop from priority queue
- [ ] **Choose task format** - Based on mastery stage (MCQ→Fill→Production)
- [ ] **Select modality** - Visual, auditory, or mixed
- [ ] **Generate content via Claude** - Or use cached/template fallback
- [ ] **Apply cue level** - Full, moderate, minimal, or none

### 3.3 Layer 3: Scoring + Update
- [ ] **Capture user response** - Answer, time, whether hints used
- [ ] **Evaluate correctness** - Claude or pattern matching
- [ ] **Update mastery state** - Stage, accuracy, FSRS card
- [ ] **Recalculate priority** - Object may move in queue
- [ ] **Log for analytics** - All data for later analysis

### 3.4 Fluency vs Versatility Balance
- [ ] **Track ratio per session** - How much of each type
- [ ] **Adjust based on progress** - More fluency early, more versatility later
- [ ] **Generate fluency tasks** - High-PMI combinations, speed-focused
- [ ] **Generate versatility tasks** - Low-PMI combinations, creative extension

**CHECKPOINT 3: Learning queue makes sense, tasks match user level, progress tracked**

---

## Phase 4: User Interface
*Make it usable and beautiful*

### 4.1 Navigation Shell
- [ ] **Create App.tsx with router** - Page navigation structure
- [ ] **Build sidebar navigation** - Links to all main views
- [ ] **Implement useIPC hook** - Bridge to main process
- [ ] **Add loading states** - Skeleton screens while data loads
- [ ] **Add error boundaries** - Graceful failure handling

### 4.2 Onboarding Wizard
- [ ] **Welcome screen** - Explain what LOGOS does
- [ ] **Goal input** - Natural language or structured dropdowns
- [ ] **Initial assessment option** - Quick test to estimate starting θ
- [ ] **Confirmation screen** - Show generated goal, allow edits
- [ ] **Transition to dashboard** - First-time user flow complete

### 4.3 Dashboard
- [ ] **Today's focus card** - Top priority item with context
- [ ] **Learning queue preview** - Next 5-10 items
- [ ] **Mastery overview chart** - Progress by component type
- [ ] **Session history** - Recent sessions with summaries
- [ ] **Start session button** - Clear call to action

### 4.4 Training Gym
- [ ] **Task display area** - Shows current exercise
- [ ] **Input methods** - MCQ buttons, text input, voice (later)
- [ ] **Hint system** - Progressive reveals with liquid gauge
- [ ] **Feedback display** - Correct/incorrect with explanation
- [ ] **Session progress bar** - Items completed / total

### 4.5 Network View
- [ ] **Force-directed graph** - Words as nodes, relations as edges
- [ ] **Node sizing by priority** - Bigger = more important
- [ ] **Color by mastery stage** - Visual progress indicator
- [ ] **Click to inspect** - Show word details, related items
- [ ] **Filter controls** - By component type, stage, domain

### 4.6 Analytics
- [ ] **Progress over time chart** - θ estimates by date
- [ ] **Session statistics** - Duration, accuracy, transitions
- [ ] **Bottleneck visualization** - Which skills need work
- [ ] **Fluency/versatility ratio** - Balance indicator
- [ ] **Export data option** - JSON backup

### 4.7 Settings
- [ ] **API key management** - Secure storage, validation
- [ ] **Session preferences** - Duration, difficulty, modality
- [ ] **Notification settings** - Review reminders
- [ ] **Data management** - Backup, restore, clear
- [ ] **About/help** - Version, links, feedback

**CHECKPOINT 4: Full user flow works, app is usable end-to-end**

---

## Phase 5: Polish & Package
*Make it production-ready*

### 5.1 Performance
- [ ] **Profile render performance** - Fix any slow components
- [ ] **Optimize database queries** - Add indexes where needed
- [ ] **Implement content caching** - Reduce Claude API calls
- [ ] **Lazy load heavy components** - Network graph, charts

### 5.2 Error Handling
- [ ] **Global error boundary** - Catch and display errors gracefully
- [ ] **Offline mode indicators** - Show when Claude unavailable
- [ ] **Database recovery** - Handle corruption gracefully
- [ ] **Logging system** - Capture errors for debugging

### 5.3 Testing
- [ ] **Unit tests passing** - All core algorithms
- [ ] **Integration tests** - IPC handlers + database
- [ ] **E2E tests** - Full user flows with Playwright
- [ ] **Manual testing checklist** - QA all features

### 5.4 Packaging
- [ ] **Configure electron-builder** - Windows installer settings
- [ ] **Build production bundle** - Optimized, minified
- [ ] **Test on clean machine** - Fresh Windows install
- [ ] **Create installer (.exe)** - Ready to distribute
- [ ] **Document installation steps** - For users

### 5.5 Documentation
- [ ] **User guide** - How to use LOGOS
- [ ] **Developer docs** - How to contribute
- [ ] **API documentation** - For future extensions

**CHECKPOINT 5: App is production-ready, installer works on clean machine**

---

## Progress Summary

| Phase | Status | Items Done | Total |
|-------|--------|------------|-------|
| Phase 1: Foundation | ⬜ Not Started | 0 | 27 |
| Phase 2: Core Data | ⬜ Not Started | 0 | 19 |
| Phase 3: Learning Engine | ⬜ Not Started | 0 | 19 |
| Phase 4: User Interface | ⬜ Not Started | 0 | 32 |
| Phase 5: Polish & Package | ⬜ Not Started | 0 | 18 |
| **TOTAL** | **⬜ 0%** | **0** | **115** |

---

## Quick Reference

### Key Files to Create First
1. `/src/core/types.ts` - All shared types
2. `/prisma/schema.prisma` - Database schema
3. `/src/main/index.ts` - Electron entry
4. `/src/renderer/App.tsx` - React entry

### Commands You'll Use
```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Package installer
npm run package
```

### When Stuck, Check
1. ALGORITHMIC-FOUNDATIONS.md - For math/code
2. REFERENCE-IMPLEMENTATIONS.md - For npm packages
3. AGENT-MANIFEST.md - For coordination rules
4. DEVELOPMENT-PROTOCOL.md - For process rules

---

*Checklist Version: 1.0*
*Created: 2026-01-04*
*Total Items: 115*
*Update this file as you complete each item*
