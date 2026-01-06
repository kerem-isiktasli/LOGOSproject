# Source Filter Engine

> **Last Updated**: 2026-01-05
> **Code Location**: `src/main/services/corpus-sources/filter.ts`
> **Status**: Active

---

## Context & Purpose

The Source Filter Engine is the **intelligent matchmaker** between learning goals and corpus sources. While the Corpus Source Registry catalogs all available sources, this module answers the critical question: "Given what this learner wants to achieve, which sources should we use and in what order?"

**Business/User Need**: A nurse preparing for the CELBAN exam should not receive vocabulary from random movie subtitles. They need content from Health Canada, PubMed, and official CELBAN materials. But beyond just filtering, they need these sources **ranked** - official exam materials first, then medical literature, then general health content. This module ensures learners get the most relevant content in the most useful order.

**When Used**:
- **During onboarding/goal setup**: When a user specifies their learning objective (domain, benchmark, modalities), this engine determines which sources to enable by default
- **During vocabulary extraction**: The ranked source list guides which corpuses to query first
- **During content generation**: Source rankings influence which contexts Claude uses for example sentences
- **During settings/preferences**: When validating user source selections, this engine warns about mismatches

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

- **`./registry.ts`**: The foundation - provides `CORPUS_SOURCES` constant, `getEnabledSources()`, `getSourcesByDomain()`, `getSourcesByBenchmark()`, `getSourcesByModality()` helper functions, and the `CorpusSource` and `SourceType` types. The filter engine operates on the data the registry provides.

### Dependents (What Needs This)

This module is **newly created** and designed for integration with:

- **Goal IPC Handlers** (`src/main/ipc/goal.ipc.ts`): When a goal is created, the system should call `getDefaultSourceIds()` to determine which sources to enable automatically
- **Vocabulary Extraction Pipeline** (planned): Will use `getRecommendedSources()` to prioritize corpus queries
- **Source Selection UI** (planned): Will display `RankedSource` results with `matchReasons` to explain why sources are recommended
- **Settings/Preferences UI** (planned): Will use `validateSourceSelection()` to show warnings when user selections don't align with their goal

### Data Flow

```
User creates goal (domain: medical, modality: [reading, speaking], benchmark: CELBAN)
    |
    v
Goal IPC handler calls getDefaultSourceIds(goalSpec)
    |
    v
Source Filter Engine:
  1. rankSourcesForGoal() scores all enabled sources
     - CELBAN Samples: 1.0 (benchmark match + domain match + all modalities)
     - Health Canada: 0.75 (domain match + benchmark tag)
     - PubMed: 0.70 (domain match)
     - Wikipedia: 0.35 (universal source, reliability bonus)
  2. Filters to sources with score > 0.3
  3. Returns source IDs for automatic enabling
    |
    v
Database stores goal with associated source preferences
    |
    v
Future vocabulary extraction queries sources in ranked order
```

---

## Macroscale: System Integration

### Architectural Layer

The Source Filter Engine sits in the **Service Layer** (Layer 2) of LOGOS's architecture, specifically within the Corpus Sources subsystem:

```
Layer 1: Renderer (React UI)
    |  - Goal Setup Wizard
    |  - Source Selection Component
    v  [IPC calls: goal:create, source:recommend]
Layer 2: Main Process Services  <-- Filter Engine lives here
    |     - corpus-sources/
    |         - registry.ts (data catalog)
    |         - filter.ts (intelligence layer) <-- YOU ARE HERE
    |     - goal.ipc.ts (uses filter for defaults)
    v  [Database queries]
Layer 3: Database (Prisma/SQLite)
        - GoalSpec (stores source preferences)
        - LanguageObject (tracks vocabulary provenance)
```

This module transforms **static source data** (from registry) into **dynamic, goal-aware recommendations**. It's the bridge between "what sources exist" and "what sources should this specific learner use."

### Big Picture Impact

The Source Filter Engine enables **intelligent source selection** - a critical component of LOGOS's personalization promise. Without it:

1. **Generic recommendations**: Every learner would see the same sources regardless of their goals
2. **Information overload**: Users would face 20+ sources without guidance on which matter for their objectives
3. **Misaligned vocabulary**: A TOEFL student might study CELBAN nursing vocabulary
4. **No quality control**: Low-relevance sources would be weighted equally with perfect matches
5. **Poor user experience**: Users would have to manually evaluate each source's relevance

**Key Features Enabled**:
- **Automatic source defaults**: New goals come pre-configured with optimal sources
- **Transparent recommendations**: `matchReasons` array explains why each source is recommended
- **Benchmark alignment**: Exam prep goals automatically prioritize official test materials
- **Multi-criteria ranking**: Combines domain, modality, reliability, and natural language analysis
- **Validation warnings**: Alerts users when their source choices may not serve their goals

### Critical Path Analysis

**Importance Level**: High (Core Personalization)

This is a **critical personalization component**:
- **If it fails**: Goals fall back to generic source lists, significantly degrading learning relevance
- **If rankings are wrong**: Learners waste time on irrelevant vocabulary (e.g., legal terminology for medical students)
- **If validation is skipped**: Users may not realize their source selections conflict with their goals

**Failure Modes**:
- Registry returns empty list: Filter returns empty results (graceful degradation)
- NL description parsing fails: Reverts to category-based matching only
- All scores below threshold: Fallback sources (user-upload, claude-generated) still recommended

**System Dependencies**:
- Vocabulary extraction quality depends on correct source ranking
- User trust depends on transparent, sensible recommendations
- Learning efficiency depends on serving domain-appropriate content first

---

## Technical Concepts (Plain English)

### Weighted Scoring System

**Technical**: A multi-factor scoring algorithm that combines domain matching (0.30 weight), benchmark alignment (0.35 weight), modality coverage (0.15 weight), reliability (0.10 weight), priority (0.10 weight), and natural language relevance (0.15 weight) into a normalized 0-1 score.

**Plain English**: Like a job applicant scoring system. Each source gets points for different qualifications: "Does it cover the right topic area?" (domain), "Is it specifically for this exam?" (benchmark), "Does it support the skills being practiced?" (modality). Sources with higher total points appear higher in recommendations.

**Why We Use It**: Different criteria matter in different proportions. A source being tagged for CELBAN (benchmark match, 0.35) is more valuable than having high reliability (0.10) when the user is specifically preparing for CELBAN. The weights encode this prioritization.

### Natural Language Relevance Analysis

**Technical**: The `calculateNLRelevance()` function performs keyword matching between a source's metadata (domains, modalities, benchmarks) and the user's free-text goal description, using domain-specific keyword dictionaries.

**Plain English**: When a user types "I want to prepare for my Canadian nursing license," the system looks for words like "nursing," "Canadian," "license" and boosts sources tagged with related keywords. It's like a basic search engine that understands synonyms and related terms within each domain.

**Why We Use It**: Users don't always select perfect form values. Their natural language description often contains valuable context ("I'm nervous about the speaking section" or "I work in a pediatric ward") that the categorical selections miss. NL analysis captures this additional signal.

### Domain Keyword Dictionaries

**Technical**: Hard-coded `Record<string, string[]>` mappings that associate each domain (medical, legal, business, etc.) with semantically related keywords for text matching.

**Plain English**: A lookup table that says "if the user mentions 'nurse', 'hospital', 'patient', or 'clinical', they probably care about the medical domain." This helps the system understand that someone who wrote "I want to work as a nurse in Toronto" is interested in medical content, even if they selected "general" in the domain dropdown.

**Why We Use It**: Natural language is messy - people describe their goals in many different ways. Keyword dictionaries help normalize varied descriptions into actionable filtering criteria.

### Source Ranking vs Source Filtering

**Technical**: `filterSources()` returns a boolean-filtered list (sources that meet criteria), while `rankSourcesForGoal()` returns all relevant sources with continuous scores for ordered selection.

**Plain English**: Filtering is like a bouncer checking IDs - you're either in or out. Ranking is like a talent competition where everyone gets a score and the best performers go first. The system uses filtering for hard constraints ("only show medical sources") and ranking for soft preferences ("show the most relevant sources first").

**Why We Use It**: Different use cases need different approaches. When extracting vocabulary, we want ranked sources (query the best first). When the user explicitly filters by type, we want binary filtering (show exactly what they asked for).

### Match Reasons Array

**Technical**: The `matchReasons: string[]` field in `RankedSource` provides human-readable explanations for why a source received its score, enabling transparent recommendations.

**Plain English**: Instead of just saying "Wikipedia: 0.45 score," the system explains "Wikipedia: matches domain: medical, supports: reading, general purpose source." This lets users understand why a source is recommended and builds trust in the system's suggestions.

**Why We Use It**: Black-box recommendations frustrate users. When the system says "we recommend Health Canada for your CELBAN prep because it contains official Canadian medical terminology," users understand and trust the recommendation.

### Validation Warnings

**Technical**: The `validateSourceSelection()` function cross-references user-selected sources against the goal-based ranking to identify potential mismatches (low relevance scores, disabled sources, unknown IDs).

**Plain English**: A safety check that says "Hey, you're studying for a medical exam but you've enabled movie subtitles and disabled Health Canada - are you sure?" It doesn't prevent the user from proceeding, but makes sure they make informed choices.

**Why We Use It**: Users sometimes make contradictory selections (enabling irrelevant sources, disabling crucial ones). Validation catches these and provides helpful warnings without being restrictive.

---

## Function Reference

### Core Filtering

#### `filterSources(filter: SourceFilter): CorpusSource[]`

**Purpose**: Basic criteria-based filtering for sources.

**Parameters** (all optional):
- `domains: string[]` - Only sources covering these domains
- `modalities: string[]` - Only sources supporting these skills
- `benchmarks: string[]` - Only sources aligned with these exams
- `types: SourceType[]` - Only specific source types (government, academic, etc.)
- `minReliability: number` - Minimum reliability score threshold
- `maxSources: number` - Limit result count

**Returns**: Filtered array of `CorpusSource`, sorted by priority (highest first).

**Use Case**: When the user explicitly requests "show me only academic sources" or when applying hard constraints before ranking.

### Goal-Based Ranking

#### `rankSourcesForGoal(goal: GoalSpec, nlDescription?: string): RankedSource[]`

**Purpose**: The core ranking algorithm - scores all enabled sources against a learning goal.

**Scoring Weights**:
| Factor | Weight | Description |
|--------|--------|-------------|
| Domain match | 0.30 | Source covers goal's domain |
| Benchmark match | 0.35 | Source aligned with target exam |
| Modality match | 0.15 | Source supports goal's skill modalities |
| Reliability | 0.10 | Source's trustworthiness score |
| Priority | 0.10 | Source's inherent preference ranking |
| NL keywords | 0.15 | Natural language description analysis |

**Returns**: Array of `RankedSource` (source + score + matchReasons), filtered to score > 0.1, sorted by score descending.

**Use Case**: Primary recommendation engine - called when setting up goals, suggesting sources, or prioritizing vocabulary extraction.

### Specialized Filters

#### `getSourcesForBenchmark(benchmark: string): RankedSource[]`

**Purpose**: Optimized ranking when the benchmark is the primary selection criterion.

**Scoring Logic**:
- Direct benchmark match: 1.0 (official test materials)
- Exam-type sources: 0.5 (general test prep value)
- Academic sources for academic tests (TOEFL/IELTS): 0.4
- Encyclopedia sources: 0.2 (background reference)

**Use Case**: When user explicitly selects a benchmark first in the onboarding wizard.

#### `getSourcesForDomain(domain: string): RankedSource[]`

**Purpose**: Ranking prioritizing domain specialization.

**Scoring Logic**:
- Direct domain match: 0.8 + (reliability * 0.2)
- Universal sources (domain: '*'): 0.3 + (reliability * 0.1)

**Use Case**: Domain-first selection, general vocabulary building for a field.

#### `getSourcesForModalities(modalities: string[]): RankedSource[]`

**Purpose**: Finding sources that support specific skill practice.

**Scoring Logic**:
- Coverage ratio: (matched modalities / requested modalities) * 0.7
- Reliability bonus: reliability * 0.3

**Use Case**: Skill-focused learning ("I want to practice speaking and listening").

### Selection Helpers

#### `getRecommendedSources(goal: GoalSpec, nlDescription?: string, maxSources?: number): RankedSource[]`

**Purpose**: Convenience wrapper returning top N sources for a goal.

**Default**: Returns top 5 sources.

**Use Case**: Quick recommendation for UI display or automatic configuration.

#### `getDefaultSourceIds(goal: GoalSpec): string[]`

**Purpose**: Returns source IDs that should be enabled by default for a new goal.

**Logic**:
1. Always includes 'user-upload' and 'claude-generated' (fallback sources)
2. Adds all sources with ranking score > 0.3 (moderately relevant or better)
3. Returns up to 10 recommended sources

**Use Case**: Called when creating a new goal to populate default source preferences.

#### `validateSourceSelection(goal: GoalSpec, selectedSourceIds: string[]): { valid: boolean; warnings: string[] }`

**Purpose**: Checks if user's source selections align with their goal.

**Validation Checks**:
- Unknown source ID: "Unknown source: xyz"
- Disabled source: "Source 'Name' is disabled"
- Low relevance (< 20%): "Source 'Name' has low relevance (15%) for your goal"

**Returns**: Object with `valid` (true if no warnings) and `warnings` array.

**Use Case**: Called before saving goal settings, displays warnings to user.

---

## Type Definitions

### SourceFilter
```typescript
interface SourceFilter {
  domains?: string[];      // Filter by topic areas
  modalities?: string[];   // Filter by skill types
  benchmarks?: string[];   // Filter by exam alignment
  types?: SourceType[];    // Filter by source category
  minReliability?: number; // Minimum trust threshold
  maxSources?: number;     // Limit results
}
```

### RankedSource
```typescript
interface RankedSource {
  source: CorpusSource;    // The full source object
  score: number;           // Relevance score (0-1)
  matchReasons: string[];  // Human-readable explanations
}
```

### GoalSpec (for this module)
```typescript
interface GoalSpec {
  domain: string;          // Primary learning domain
  modality: string;        // JSON string of modality array
  genre: string;           // Writing/communication style
  purpose: string;         // Why the user is learning
  benchmark?: string;      // Target assessment (if any)
}
```

---

## Scoring Examples

### Example 1: CELBAN Nursing Student

**Goal**: domain=medical, modality=["reading","speaking"], benchmark=CELBAN

| Source | Domain | Benchmark | Modality | Reliability | Priority | Total |
|--------|--------|-----------|----------|-------------|----------|-------|
| CELBAN Samples | 0.30 | 0.35 | 0.15 | 0.10 | 0.10 | **1.00** |
| Health Canada | 0.30 | 0.00 | 0.075 | 0.095 | 0.09 | **0.56** |
| PubMed | 0.30 | 0.00 | 0.075 | 0.095 | 0.085 | **0.56** |
| Wikipedia | 0.15 | 0.00 | 0.075 | 0.085 | 0.07 | **0.38** |
| TED Talks | 0.00 | 0.00 | 0.15 | 0.09 | 0.08 | **0.32** |

CELBAN Samples scores highest because it matches benchmark (0.35) + domain (0.30) + all modalities (0.15).

### Example 2: IELTS Academic English

**Goal**: domain=academic, modality=["reading","writing","listening","speaking"], benchmark=IELTS

| Source | Domain | Benchmark | Modality | Reliability | Priority | Total |
|--------|--------|-----------|----------|-------------|----------|-------|
| IELTS Practice | 0.30 | 0.35 | 0.15 | 0.095 | 0.10 | **1.00** |
| arXiv | 0.30 | 0.00 | 0.0375 | 0.09 | 0.075 | **0.50** |
| COCA | 0.15 | 0.00 | 0.15 | 0.095 | 0.085 | **0.48** |
| TED Talks | 0.30 | 0.00 | 0.075 | 0.09 | 0.08 | **0.55** |

IELTS Practice materials dominate, with TED Talks strong for academic/speaking practice.

---

## Change History

### 2026-01-05 - Initial Implementation
- **What Changed**: Created Source Filter Engine with multi-factor ranking, specialized filters, and validation
- **Why**: LOGOS needs intelligent source selection to deliver personalized vocabulary aligned with user goals
- **Impact**: Enables goal-aware source recommendations, transparent match reasoning, and source validation warnings

---

## Design Decisions & Rationale

### Why Weighted Scoring vs Simple Filtering?

Simple boolean filtering ("show only CELBAN sources") misses valuable secondary sources. A PubMed article about nursing procedures is highly relevant for a CELBAN student even though it's not explicitly tagged as CELBAN material. Weighted scoring captures these nuances.

### Why Include Natural Language Analysis?

Form-based goal specification is limited. Users often have important context in their natural language descriptions that doesn't fit into dropdowns. NL analysis extracts additional signal without requiring complex UI.

### Why Return matchReasons?

Recommendations without explanations feel arbitrary. By showing "Matches domain: medical, aligned with CELBAN," users understand and trust the system. This transparency also helps when debugging why certain sources rank unexpectedly.

### Why Default to Including Claude-Generated and User Uploads?

These are "always available" fallback sources. Even if no corpus sources match a niche goal, Claude can generate relevant examples and users can upload their own materials. Including them by default ensures the system never returns an empty source list.

### Why 0.3 Threshold for Default Sources?

Empirically tuned to include "moderately relevant" sources while excluding clearly mismatched ones. Sources with < 30% relevance typically lack meaningful overlap with the goal (e.g., legal documents for medical students).
