# LOGOS - Adaptive Language Learning System

LOGOS is an Electron-based desktop application for adaptive language learning that combines Item Response Theory (IRT), Free Spaced Repetition Scheduler (FSRS-4), and Pointwise Mutual Information (PMI) algorithms with Claude AI integration.

## Features

- **Adaptive Learning Pipeline**: 3-layer architecture for personalized learning
  - Layer 1: State + Priority (FRE-based queue management)
  - Layer 2: Task Generation (z(w) vector matching)
  - Layer 3: Scoring + Update (IRT theta estimation, FSRS scheduling)

- **Multi-Component Tracking**: Separate ability estimation for:
  - Phonology (pronunciation, sound patterns)
  - Morphology (word formation, affixes)
  - Lexical (vocabulary knowledge)
  - Syntactic (grammar structures)
  - Pragmatic (register, context)

- **Intelligent Content Generation**: Claude AI integration for:
  - Vocabulary extraction from corpus sources
  - Task and exercise generation
  - Error analysis and feedback

- **Offline-First Design**: Full functionality without internet, with sync when online

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/logos.git
cd logos

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development mode
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="your-api-key-here"
NODE_ENV="development"
```

## Architecture

```
src/
├── core/              # Pure algorithms (zero I/O)
│   ├── irt.ts         # Item Response Theory
│   ├── fsrs.ts        # Spaced Repetition Scheduler
│   ├── pmi.ts         # Pointwise Mutual Information
│   ├── priority.ts    # FRE-based queue ordering
│   ├── bottleneck.ts  # Error cascade detection
│   ├── morphology.ts  # Morphological analysis
│   ├── g2p.ts         # Grapheme-to-phoneme
│   ├── syntactic.ts   # Grammar patterns
│   └── task-matching.ts # z(w) vector task matching
├── main/              # Electron main process
│   ├── services/      # Business logic layer
│   ├── ipc/           # IPC handlers
│   └── db/            # Prisma client & repositories
├── renderer/          # React UI
│   ├── pages/         # Route-level components
│   ├── components/    # Reusable UI components
│   ├── hooks/         # Custom React hooks
│   └── context/       # React context providers
└── shared/            # Shared types and utilities
```

## Available Scripts

```bash
# Development
npm run dev              # Start in development mode
npm run build            # Build for production
npm run build:strict     # Build with type checking

# Testing
npm run test             # Run unit tests
npm run test:coverage    # Run tests with coverage
npm run test:e2e         # Run end-to-end tests

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting
npm run typecheck        # TypeScript type checking

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio

# Distribution
npm run dist             # Build and package
npm run dist:win         # Package for Windows
npm run dist:mac         # Package for macOS
npm run dist:linux       # Package for Linux
```

## Core Algorithms

### Item Response Theory (IRT)

LOGOS uses 2PL IRT for ability estimation:

```typescript
import { estimateThetaEAP, probability2PL } from '@core/irt';

// Estimate ability from response pattern
const { theta, se } = estimateThetaEAP(responses, items);

// Calculate probability of correct response
const p = probability2PL(theta, item.a, item.b);
```

### FSRS-4 Scheduler

Implements the Free Spaced Repetition Scheduler for optimal review timing:

```typescript
import { scheduleFSRS, gradeFSRS } from '@core/fsrs';

// Schedule next review
const schedule = scheduleFSRS(card, grade, now);

// Grade: 1=Again, 2=Hard, 3=Good, 4=Easy
```

### z(w) Task Matching

Matches word characteristics to optimal task types:

```typescript
import { recommendTask, extractZVector } from '@core/task-matching';

const zVector = extractZVector(languageObject);
const recommendation = recommendTask({
  content: word,
  zVector,
  masteryStage: 2,
  cueFreeAccuracy: 0.7,
  exposureCount: 5,
});
```

## Database Schema

Key models in `prisma/schema.prisma`:

- **User**: Profile and theta values
- **GoalSpec**: Learning goals with domain, modality, benchmark
- **LanguageObject**: Atomic learning units with z(w) vectors
- **MasteryState**: FSRS state and accuracy tracking
- **Session**: Training sessions with responses
- **Response**: Individual answer records

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- TypeScript with strict mode
- ESLint + Prettier for formatting
- Pure functions in `src/core/` (no side effects)
- Services handle I/O in `src/main/services/`

## Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [Development Protocol](./DEVELOPMENT-PROTOCOL.md)
- [Algorithmic Foundations](./ALGORITHMIC-FOUNDATIONS.md)
- [Theoretical Foundations](./THEORETICAL-FOUNDATIONS.md)

## License

MIT License - see [LICENSE](./LICENSE) for details.
