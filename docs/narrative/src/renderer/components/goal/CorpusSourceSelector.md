# Corpus Source Selector Component

> **Last Updated**: 2026-01-05
> **Code Location**: `src/renderer/components/goal/CorpusSourceSelector.tsx`
> **Status**: Active

---

## Context & Purpose

This component exists to solve a critical challenge in language learning: **selecting the right source materials for vocabulary extraction**. When a user creates a learning goal (such as "prepare for CELBAN nursing exam"), they need vocabulary drawn from relevant, high-quality sources. This component provides the interface for that selection process.

**Business Need**: Users learning a language for specific purposes (medical, legal, academic) need domain-specific vocabulary from authoritative sources. A nurse preparing for CELBAN needs medical terminology from Health Canada documents, not casual movie subtitles. This component ensures users get vocabulary that matches their actual learning goals.

**User Need**: Users need to understand which sources will provide their vocabulary, have control over the selection, and receive intelligent recommendations based on their goals. Without this transparency, users would have no insight into where their learning materials come from.

**When Used**:
- During the goal creation/setup flow, after defining domain, modality, and purpose
- When editing an existing goal to change vocabulary sources
- When repopulating a goal's vocabulary with different source materials

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**UI Components:**
- `src/renderer/components/ui/GlassCard.tsx`: Container component providing the frosted-glass aesthetic for source cards and categories
- `src/renderer/components/ui/GlassButton.tsx`: Action buttons for selection, population, and reset operations
- `src/renderer/components/ui/GlassBadge.tsx`: Visual indicators showing selection counts and recommendation scores

**Type Definitions:**
- `src/shared/types.ts`: Imports `CorpusSourceInfo` (defines source structure) and `RankedCorpusSource` (defines scored recommendations)

**Backend Services (via IPC):**
- `window.logos.corpus.listSources()`: Fetches all available corpus sources from the registry
- `window.logos.corpus.getRecommendedSources(goalId, nlDescription)`: Gets AI-ranked source recommendations based on goal parameters

### Dependents (What Needs This)

**Parent Components:**
- Goal creation/editing flows that need vocabulary source selection
- Onboarding wizard steps that configure learning materials

**Data Flow:**
```
Component Mount
    |
    v
[loadSources()]
    |
    +---> listSources() -----> Backend Registry --> All Available Sources
    |
    +---> getRecommendedSources() --> AI Ranking --> Scored Recommendations
    |
    v
[User sees recommended + all sources]
    |
    v
[User toggles selections]
    |
    v
onSourcesSelected(ids) -----> Parent Component (stores selection)
    |
    v
[User clicks "Populate Vocabulary"]
    |
    v
onPopulate(ids) -----> Parent --> IPC --> corpus-pipeline.service --> Database
```

---

## Macroscale: System Integration

### Architectural Layer

This component sits in the **Presentation Layer** of the LOGOS application architecture:

```
Layer 1: User Interface (This Component)
    - Displays source options with visual hierarchy
    - Handles user interactions (selection, expansion, population)
    - Shows loading/error states
    |
    v
Layer 2: IPC Bridge (window.logos.corpus)
    - Translates UI requests to backend calls
    - Handles async communication with main process
    |
    v
Layer 3: Main Process Services
    - corpus-sources/registry.ts: Source definitions
    - corpus-sources/filter.ts: Recommendation algorithm
    - corpus-sources/corpus-pipeline.service.ts: Extraction logic
    |
    v
Layer 4: Database (Prisma/SQLite)
    - LanguageObject table: Extracted vocabulary
    - GoalSpec table: Goal configuration
```

### Big Picture Impact

This component is the **gateway** between user intent and vocabulary population. It directly affects:

1. **Learning Quality**: Source selection determines vocabulary relevance. Medical students get medical vocabulary; business professionals get business terminology.

2. **User Trust**: By showing recommendations with scores and reasons, users understand why certain sources are suggested, building confidence in the system.

3. **Customization Power**: Users can override recommendations, mixing official exam materials with informal media sources based on their learning style.

4. **Vocabulary Pipeline Input**: The selected source IDs become the input for the entire corpus extraction pipeline, affecting thousands of vocabulary items.

### Critical Path Analysis

**Importance Level**: High (Feature-Critical)

**If This Component Fails:**
- Users cannot select vocabulary sources for their goals
- Goals would either have no vocabulary or only default vocabulary
- The personalization promise of domain-specific learning breaks down
- Users lose visibility into their learning material origins

**Graceful Degradation:**
- Loading states prevent interaction during data fetching
- Error states provide retry functionality
- Default selections ensure goals can proceed even without user customization
- "Reset to Recommended" allows recovery from poor manual selections

**Dependencies:**
- Requires backend corpus registry to be populated
- Requires IPC handlers to be registered
- Requires goal to exist before fetching recommendations

---

## Technical Concepts (Plain English)

### Corpus Source

**Technical**: A structured definition of a content repository from which vocabulary can be extracted, including metadata like type, domain, reliability score, and access method.

**Plain English**: Think of corpus sources as different libraries you could visit to find words. Health Canada is like a medical library - very trustworthy for nursing terms. Wikipedia is like a general encyclopedia - good breadth but less specialized. Movie subtitles are like overhearing conversations - great for casual speech but less formal.

**Why We Use It**: Different learning goals need different "libraries." A nurse needs medical terminology; a business student needs corporate vocabulary. By categorizing sources, we can match them to goals intelligently.

---

### Ranked Source Recommendations

**Technical**: An algorithm that scores corpus sources against goal parameters (domain, modality, benchmark) and returns them sorted by relevance with explanatory reasons.

**Plain English**: Like a librarian who looks at what you're studying and says "For your nursing exam, I'd recommend the Health Canada archives (95% match) and PubMed articles (85% match) because they contain the medical terminology you'll encounter."

**Why We Use It**: Users shouldn't have to manually evaluate 20+ sources. The system suggests the best matches, saving time and improving learning outcomes.

---

### Source Category Accordion

**Technical**: A collapsible UI pattern that groups sources by type (Government, Academic, Media, etc.) with toggle states managed by React useState, allowing users to expand one category at a time.

**Plain English**: Like file folders in a cabinet - you see the folder labels (Government, Academic, Media) and can open one at a time to see the sources inside. This prevents overwhelm when there are many sources.

**Why We Use It**: With 15-20+ sources, showing everything at once would be overwhelming. Grouping by category helps users find relevant sources quickly.

---

### Checkbox Selection with Set State

**Technical**: Selection state maintained as a JavaScript Set of source IDs, providing O(1) lookup for selection status and preventing duplicate entries.

**Plain English**: Like a shopping cart where you can add or remove items. The system remembers which sources you've selected regardless of which category folder they're in.

**Why We Use It**: Users might select sources from multiple categories. A Set data structure efficiently tracks what's selected across the entire interface.

---

### Vocabulary Population (Async Operation)

**Technical**: An asynchronous operation that triggers the corpus pipeline service to extract vocabulary from selected sources, insert it into the database, and associate it with the goal.

**Plain English**: Once you've chosen your "libraries," this is like telling the system "Go to these libraries, find all the important vocabulary words, and bring them back for my study materials." It takes time, so the button shows a spinner.

**Why We Use It**: Extracting vocabulary from multiple sources is computationally intensive and involves database operations. Running it asynchronously prevents the UI from freezing.

---

### Default Pre-Selection

**Technical**: Initial checkbox state populated from `defaultSourceIds` returned by the recommendation API, ensuring recommended sources are pre-selected on component mount.

**Plain English**: When you arrive, the best sources for your goal are already checked. Like a helpful assistant who says "Based on your nursing exam goal, I've already selected these medical sources for you. Feel free to add or remove any."

**Why We Use It**: Most users will accept recommendations. Pre-selecting defaults reduces friction while still allowing customization.

---

## UI/UX Design Decisions

### Why Two-Section Layout (Recommended + Categories)

The component displays recommended sources prominently at the top, then all sources organized by category below. This design:

1. **Prioritizes Relevance**: Users see the best matches immediately
2. **Enables Discovery**: Users can explore other options if recommendations don't fit
3. **Reduces Decision Fatigue**: Recommendations guide users who are unsure

### Why Expandable Categories

Collapsing categories by default:

1. **Reduces Visual Noise**: 20+ sources shown simultaneously would overwhelm
2. **Encourages Exploration**: Users can drill into categories that interest them
3. **Maintains Context**: Category headers show selection counts even when collapsed

### Why Show Match Percentages

Displaying "95% match" scores:

1. **Builds Trust**: Users understand why sources are recommended
2. **Enables Informed Decisions**: Users can weigh relevance vs. personal preference
3. **Differentiates Options**: Helps users choose between similar sources

---

## State Management Breakdown

| State Variable | Purpose | Type |
|----------------|---------|------|
| `allSources` | All available corpus sources from registry | `CorpusSourceInfo[]` |
| `recommended` | AI-ranked sources with scores and reasons | `RankedCorpusSource[]` |
| `defaultIds` | Pre-selected source IDs from recommendations | `string[]` |
| `selectedIds` | Currently selected source IDs (user-controlled) | `Set<string>` |
| `isLoading` | Loading state during initial data fetch | `boolean` |
| `isPopulating` | Loading state during vocabulary population | `boolean` |
| `error` | Error message if data fetch fails | `string \| null` |
| `expandedCategory` | Currently expanded category accordion | `string \| null` |

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for existing component
- **Why**: Shadow documentation initiative for codebase comprehension
- **Impact**: Developers can now understand component purpose without reading implementation

### [Component Creation Date] - Initial Implementation
- **What Changed**: Created CorpusSourceSelector component
- **Why**: Users needed visibility and control over vocabulary source selection for their learning goals
- **Impact**: Enabled personalized vocabulary extraction based on user-selected authoritative sources
