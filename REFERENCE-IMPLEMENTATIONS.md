# LOGOS Reference Implementations

## Verified GitHub/Official Sources for Each Component

Every component in LOGOS will be built following these proven implementations.

---

## 1. Electron + React + TypeScript

### Primary Reference: [electron-react-app (guasam)](https://github.com/guasam/electron-react-app)
**Why this one:** Modern stack with exactly what we need:
- Electron + React + TypeScript
- **ShadcnUI + TailwindCSS** (matches our UI benchmarks!)
- Vite for fast builds
- Type-safe IPC with Zod validation
- 2025 active maintenance

### Backup Reference: [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- 16,000+ stars
- Battle-tested, used in production
- Electron-builder for packaging

### Official Documentation
- [Electron Boilerplates Guide](https://www.electronjs.org/docs/latest/tutorial/boilerplates-and-clis)
- [Electron Forge](https://www.electronforge.io/) (official tooling)

### What We'll Use From These:
```
├── Project structure (main/renderer split)
├── IPC communication patterns
├── Electron-builder config for .exe packaging
├── Vite integration for React
└── TypeScript configuration
```

---

## 2. Spaced Repetition: FSRS Algorithm

### Primary Reference: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (TYPESCRIPT - USE THIS!)
**Why:** Official TypeScript implementation - NO PORTING NEEDED!
- Native TypeScript, works directly in Electron
- Supports ESM, CommonJS, and UMD
- Same algorithm as Anki (millions of users)
- Backed by academic research
- npm: `npm install ts-fsrs`

### Installation:
```bash
npm install ts-fsrs
# For high-performance optimization tasks:
npm install @open-spaced-repetition/binding
```

### Python Reference (for algorithm verification): [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs)

### Organization: [Open Spaced Repetition](https://github.com/open-spaced-repetition)
Complete ecosystem:
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) - **TypeScript (USE THIS)**
- [fsrs-optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer) - Parameter tuning
- [fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs) - Rust (high performance)

### Documentation: [ts-fsrs Docs](https://open-spaced-repetition.github.io/ts-fsrs/)

### What We'll Use (NO PORTING NEEDED):
```typescript
// FSRS Core Concepts (from py-fsrs)
interface Card {
  difficulty: number;      // D ∈ [1, 10]
  stability: number;       // S (days until 90% retention)
  retrievability: number;  // R = e^(-t/S)
  lastReview: Date;
  scheduledDays: number;
}

interface Rating {
  Again = 1,   // Complete failure
  Hard = 2,    // Significant difficulty
  Good = 3,    // Correct with effort
  Easy = 4     // Effortless recall
}
```

---

## 3. Item Response Theory (IRT)

### Primary Reference: [py-irt](https://github.com/nd-ball/py-irt)
**Why:** Scalable IRT with GPU support
- Supports 1PL, 2PL, 4PL models
- Bayesian inference (uncertainty quantification)
- Built on PyTorch/Pyro
- [Academic paper](https://arxiv.org/abs/2203.01282)

### Alternative: [GIRTH](https://github.com/eribean/girth)
- Maximum Likelihood Estimation
- Synthetic data generation (useful for testing)
- Supports MIRT (multidimensional)

### For Adaptive Testing: [CAT4AI](https://github.com/bigdata-ustc/CAT4AI)
- Item selection algorithms
- Ability estimation
- Test termination rules

### What We'll Implement:
```python
# 2PL Model (Two-Parameter Logistic)
# P(correct | θ, a, b) = 1 / (1 + exp(-a(θ - b)))
# θ = person ability
# a = item discrimination
# b = item difficulty

class IRTEngine:
    def estimate_ability(self, responses: List[Response]) -> float:
        """Maximum Likelihood Estimation of user ability"""
        pass

    def select_next_item(self, ability: float, available: List[Item]) -> Item:
        """Fisher Information-based item selection"""
        pass

    def update_difficulty(self, item: Item, responses: List[Response]):
        """Bayesian update of item parameters"""
        pass
```

---

## 4. Anthropic Claude API

### Official TypeScript SDK: [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) (USE THIS!)
**npm:** `npm install @anthropic-ai/sdk`

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Can be omitted if env var set
});

const message = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Extract vocabulary from this text...' }],
});
```

### Electron Integration Note:
- SDK runs in **main process** (Node.js context)
- Use IPC to communicate results to renderer process
- Never expose API key to renderer process

### Python SDK (for reference): [anthropic-sdk-python](https://github.com/anthropics/anthropic-sdk-python)

### Official Resources:
- [Claude Quickstarts](https://github.com/anthropics/claude-quickstarts) - Deployable examples
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook) - Patterns & recipes
- [Build with Claude Academy](https://www.anthropic.com/learn/build-with-claude)
- [Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

### Best Practices (from Anthropic):
1. Store API key in environment variable
2. Use streaming for long responses
3. Implement retry logic with exponential backoff
4. Cache responses when appropriate
5. Use tool_use for structured extraction

### What We'll Use Claude For:
```typescript
// LOGOS Claude Integration Points
const claudeTasks = {
  // Goal parsing (Channel B)
  parseNaturalLanguageGoal: async (userInput: string) => GoalSpec,

  // Content analysis
  extractLanguageObjects: async (text: string) => LanguageObject[],

  // Task generation
  generateExercise: async (object: LanguageObject, stage: number) => Task,

  // Feedback
  evaluateResponse: async (task: Task, response: string) => Feedback,
}
```

---

## 5. SQLite + Electron Storage

### Primary Reference: [electron-sqlite-demo](https://github.com/trulysinclair/electron-sqlite-demo)
**Why:** Exact stack we need - Electron + better-sqlite3 + Prisma

### Stack:
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Synchronous, fast SQLite
- [Prisma](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/sqlite) - Type-safe ORM
- [@prisma/adapter-better-sqlite3](https://www.prisma.io/docs/orm/overview/databases/sqlite) - Driver adapter

### Installation:
```bash
npm install better-sqlite3
npm install @prisma/client @prisma/adapter-better-sqlite3
npm install prisma --save-dev
```

### Electron Best Practices (from [Prisma Discussion #7889](https://github.com/prisma/prisma/discussions/7889)):
1. Store DB in `process.resourcesPath` (platform-specific)
2. Run Prisma on **main process** only
3. Use IPC to communicate with renderer
4. Include migration file in build
5. Copy base DB at first launch

### Schema Example:
```prisma
// schema.prisma for LOGOS

datasource db {
  provider = "sqlite"
  url      = "file:./logos.db"
}

generator client {
  provider = "prisma-client-js"
}

model GoalSpec {
  id        String   @id @default(uuid())
  domain    String
  modality  String
  genre     String
  purpose   String
  benchmark String?
  deadline  DateTime?
  createdAt DateTime @default(now())

  languageObjects LanguageObject[]
  sessions        Session[]
}

model LanguageObject {
  id                 String  @id @default(uuid())
  type               String  // LEX, MORPH, G2P, SYNT, PRAG
  content            String
  frequency          Float
  relationalDensity  Float
  contextualContrib  Float

  goalId    String
  goal      GoalSpec @relation(fields: [goalId], references: [id])

  masteryStates MasteryState[]
  responses     Response[]
}

model MasteryState {
  id            String   @id @default(uuid())
  stage         Int      @default(0)  // 0-4
  confidence    Float    @default(0)
  lastExposure  DateTime?
  exposureCount Int      @default(0)
  nextReview    DateTime?

  objectId String
  object   LanguageObject @relation(fields: [objectId], references: [id])
}

model Session {
  id              String   @id @default(uuid())
  startedAt       DateTime @default(now())
  endedAt         DateTime?
  itemsPracticed  Int      @default(0)
  transitions     Int      @default(0)

  goalId    String
  goal      GoalSpec @relation(fields: [goalId], references: [id])

  responses Response[]
}

model Response {
  id            String   @id @default(uuid())
  taskType      String
  correct       Boolean
  responseTimeMs Int
  hintLevel     Int      @default(0)
  createdAt     DateTime @default(now())

  sessionId String
  session   Session @relation(fields: [sessionId], references: [id])

  objectId String
  object   LanguageObject @relation(fields: [objectId], references: [id])
}
```

---

## 6. UI Components

### Already Benchmarked (from our extraction):
Located at: `C:\Users\USER\Development\ui-benchmark-extractor\benchmarks\logos-v2\`

### Primary Libraries:
- [shadcn/ui](https://ui.shadcn.com/) - Component system
- [Radix Primitives](https://www.radix-ui.com/) - Accessible primitives
- [Tremor](https://tremor.so/) - Charts & dashboards
- [TailwindCSS](https://tailwindcss.com/) - Styling

### For Network Graph:
- [react-force-graph](https://github.com/vasturiano/react-force-graph) - 3D/2D force-directed
- [Nivo](https://nivo.rocks/network/) - Network visualization (benchmarked)

### For Charts:
- [Recharts](https://recharts.org/) - React charts
- [shadcn/charts](https://ui.shadcn.com/charts) - Pre-styled chart components

---

## 7. NLP Utilities (TypeScript)

### For Text Processing:
- [compromise](https://github.com/spencermountain/compromise) - Lightweight NLP
- [natural](https://github.com/NaturalNode/natural) - Tokenization, stemming

### We'll Use Claude API For Heavy Lifting:
- Entity extraction
- Dependency parsing
- Semantic analysis
- Content generation

Local processing only for:
- Tokenization
- Basic string operations
- Caching

---

## Summary: Reference → LOGOS Component Map

| LOGOS Component | Primary Reference | Language | Verified |
|-----------------|-------------------|----------|----------|
| Desktop shell | guasam/electron-react-app | TypeScript | ⬜ |
| Packaging | electron-builder | Config | ⬜ |
| Database | Prisma + better-sqlite3 | TypeScript | ⬜ |
| Spaced Repetition | **ts-fsrs** (native!) | TypeScript | ⬜ |
| IRT Engine | py-irt → port to TS | TypeScript | ⬜ |
| Claude Integration | **@anthropic-ai/sdk** | TypeScript | ⬜ |
| UI Components | shadcn/ui | TypeScript | ⬜ |
| Charts | Tremor + Recharts | TypeScript | ⬜ |
| Network Graph | react-force-graph | TypeScript | ⬜ |

### Key Insight: Almost Everything is Native TypeScript!
- **ts-fsrs** - No porting needed
- **@anthropic-ai/sdk** - No porting needed
- **Prisma** - Native TypeScript
- Only IRT needs porting from Python

---

## Sources

### Electron + React
- [electron-react-app](https://github.com/guasam/electron-react-app)
- [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- [Electron Forge vs Boilerplate Comparison](https://blog.logrocket.com/electron-forge-vs-electron-react-boilerplate/)

### Spaced Repetition
- [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs)
- [FSRS on PyPI](https://pypi.org/project/fsrs/)
- [awesome-fsrs](https://open-spaced-repetition.github.io/awesome-fsrs/)

### Item Response Theory
- [py-irt Paper](https://arxiv.org/abs/2203.01282)
- [GIRTH](https://github.com/eribean/girth)
- [CAT4AI](https://github.com/bigdata-ustc/CAT4AI)

### Anthropic Claude
- [anthropic-sdk-python](https://github.com/anthropics/anthropic-sdk-python)
- [claude-quickstarts](https://github.com/anthropics/claude-quickstarts)
- [Claude API Guide 2025](https://collabnix.com/claude-api-integration-guide-2025-complete-developer-tutorial-with-code-examples/)

### SQLite + Electron
- [electron-sqlite-demo](https://github.com/trulysinclair/electron-sqlite-demo)
- [Prisma SQLite Docs](https://www.prisma.io/docs/orm/overview/databases/sqlite)
- [Electron Integration Discussion](https://github.com/prisma/prisma/discussions/7889)

---

*Research completed: 2026-01-04*
*All implementations will reference these sources*
