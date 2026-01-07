# Dynamic Corpus Sourcing Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/dynamic-corpus.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to bridge the gap between static vocabulary lists and the rich, living world of real language use. Language learning applications traditionally ship with pre-packaged word lists, but language itself evolves constantly across domains, registers, and contexts. The Dynamic Corpus module solves this fundamental limitation by enabling LOGOS to tap into external corpus APIs at runtime, extracting vocabulary that matches a learner's specific goals.

**Business/User Need**: A nurse preparing for the CELBAN exam needs medical terminology that appears in actual healthcare documentation, not generic word lists. A lawyer studying for immigration practice needs legal vocabulary weighted by real-world frequency in immigration law contexts. This module enables LOGOS to serve specialized learners by dynamically sourcing domain-relevant vocabulary rather than relying solely on one-size-fits-all static data.

**When Used**:
- When a new learning goal is created (to populate initial vocabulary)
- When a user requests vocabulary for a specific domain or context
- When the system needs to supplement existing vocabulary with corpus-validated items
- As a fallback data source when the main corpus pipeline service encounters API failures

---

## Academic Foundations

### Corpus Linguistics Principles

The module is grounded in established corpus linguistics research, implementing principles from:

**COCA (Corpus of Contemporary American English)**: The largest freely-available corpus of American English (1+ billion words), COCA provides frequency data across five genres: spoken, fiction, popular magazines, newspapers, and academic texts. This module's design mirrors COCA's genre-aware approach, allowing vocabulary extraction to be filtered by domain context.

**OPUS Parallel Corpus**: A multilingual parallel corpus project, OPUS provides aligned texts across many languages. The module's support for multiple languages and cross-linguistic analysis draws from OPUS's architecture.

**Sinclair's Corpus Linguistics (1991)**: John Sinclair's foundational work established that vocabulary selection should be *principled*, based on actual usage patterns rather than intuition. The module implements this by prioritizing frequency-weighted, domain-relevant vocabulary over arbitrary word lists.

**Collocation Analysis**: The `CollocationData` type and collocation extraction follow the tradition of measuring word association strength using metrics like Mutual Information (MI) and t-scores, pioneered by Church & Hanks (1990) and refined in subsequent corpus linguistics research.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

This module is designed to be **pure** (no external dependencies within the core layer), but it defines interfaces that the service layer implements:

- **None within core**: As a core module, it contains pure functions and type definitions only. All I/O operations are handled by consumers.

### Dependents (What Needs This)

- `src/main/services/corpus-sources/corpus-pipeline.service.ts`: The main orchestration service that uses these types and functions to coordinate vocabulary population across multiple sources
- `src/main/services/corpus-sources/registry.ts`: Extends the `CorpusSource` concept with additional source types and access methods
- `src/main/services/corpus-sources/filter.ts`: Uses domain and modality information to filter appropriate sources for a goal
- `src/main/services/pmi.service.ts`: Consumes `ExtractedItem` data to compute PMI (Pointwise Mutual Information) scores and collocations
- `src/core/priority.ts`: Uses frequency and domain relevance data from extracted items to compute learning priority scores
- `src/core/types.ts`: The `LanguageObject` type aligns with `ExtractedItem` through the `corpusItemToLanguageObject()` conversion function

### Data Flow

```
User creates learning goal
    |
    v
Goal specification (domain, modality, benchmark)
    |
    v
[queryCorpus] --> Check cache --> If cached, return immediately
    |                                   |
    | (cache miss)                      |
    v                                   |
[getAvailableSources] --> Filter sources by domain/language
    |
    v
[querySource] --> Dispatch by source type (API/embedded/file)
    |
    +--> API sources: [queryAPISource] --> HTTP requests --> Parse response
    |
    +--> Embedded sources: [queryEmbeddedCorpus] --> Filter static data
    |
    v
[CorpusResult] with ExtractedItems
    |
    v
Cache result --> Return to caller
    |
    v
[corpusItemToLanguageObject] --> Convert to LOGOS internal format
    |
    v
Store in database via corpus-pipeline.service
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits in the **Core Layer** of LOGOS's three-tier architecture:

- **Layer 1 (Renderer)**: UI components display vocabulary and learning content
- **Layer 2 (Core)**: **This module** - Pure algorithms and type definitions for corpus interaction
- **Layer 3 (Main/Services)**: `corpus-pipeline.service.ts` orchestrates actual API calls and database operations

The module follows LOGOS's strict separation of concerns: core modules contain only pure functions with no side effects or I/O. The actual API calls, caching persistence, and database writes are delegated to the service layer.

### Big Picture Impact

**Vocabulary Population Pipeline**: This module is the **conceptual foundation** for how LOGOS understands and sources vocabulary. Without it, LOGOS would be limited to static, pre-packaged word lists that cannot adapt to individual learner goals.

**Domain-Specific Learning**: The module enables LOGOS's core value proposition for professional language learners (nurses, lawyers, engineers) by allowing vocabulary to be filtered by domain (medical, legal, technical) with appropriate frequency and difficulty weighting.

**Graceful Degradation**: The embedded vocabulary fallback (the `EMBEDDED_VOCABULARY` constant) ensures the system never returns empty results, even when external APIs are unavailable. This is critical for offline use and API rate limiting scenarios.

### System Dependencies

**Importance Level**: High (Infrastructure)

This is a **foundational component** that enables the goal-based learning paradigm:

1. **Goal Creation Flow**: When a user creates a new learning goal, the corpus pipeline service uses these functions to populate initial vocabulary
2. **Priority Calculation**: The FRE (Frequency, Relational, Contextual) metrics that drive learning queue ordering depend on frequency and domain relevance data sourced through this module
3. **IRT Calibration**: Item difficulty parameters (`irtDifficulty`) are estimated from frequency and domain data, which feeds into the adaptive testing system

**If this fails**:
- New goals would have no vocabulary to populate
- Priority calculations would lack frequency data
- The system would fall back to embedded data (limited but functional)

---

## Key Types Explained

### CorpusSource

**Technical**: An interface defining the configuration for an external corpus provider, including connection details, supported domains/languages, rate limits, and availability status.

**Plain English**: Think of this as an "address card" for a vocabulary source. Just as you might have contact information for different libraries (hours, location, what books they have), a `CorpusSource` describes how to reach a vocabulary provider, what languages and domains it covers, and whether it's currently open for business.

**Why We Use It**: LOGOS needs to query multiple vocabulary sources (COCA, OPUS, embedded data) and select the best one for each learning goal. This type standardizes how we describe and compare sources.

```typescript
interface CorpusSource {
  id: string;                    // Unique identifier ("coca", "opus", "embedded_medical")
  name: string;                  // Human-readable ("Corpus of Contemporary American English")
  type: 'api' | 'file' | 'embedded';  // How to access it
  baseUrl?: string;              // For API sources
  domains: string[];             // What subjects it covers
  languages: string[];           // What languages it supports
  rateLimit?: number;            // API throttling (requests per minute)
  isAvailable: boolean;          // Currently working?
  requiresAuth: boolean;         // Needs API key?
  priority: number;              // Higher = preferred when multiple match
}
```

### CorpusQuery

**Technical**: A structured query object specifying the criteria for vocabulary extraction, including domain, difficulty bounds, target count, language, part-of-speech filters, and exclusion lists.

**Plain English**: This is your "shopping list" for vocabulary. Instead of wandering through a dictionary randomly, you specify exactly what you need: "Give me 50 medical nouns and verbs in English, excluding words I already know, that aren't too difficult for my level."

**Why We Use It**: Structured queries enable consistent, reproducible vocabulary extraction and support caching (identical queries return cached results).

```typescript
interface CorpusQuery {
  domain: string;              // Target subject area ("medical", "legal")
  genre?: string;              // Optional sub-category ("nursing", "contracts")
  minFrequency?: number;       // Only high-frequency words (0-1 scale)
  maxDifficulty?: number;      // Cap on complexity
  targetCount: number;         // How many items to return
  language: string;            // Target language code
  posFilter?: string[];        // Part of speech filter (["noun", "verb"])
  excludeIds?: string[];       // Skip already-known items
  keywords?: string[];         // Search terms for filtering
}
```

### ExtractedItem

**Technical**: A vocabulary item extracted from a corpus source, enriched with frequency statistics, domain relevance scores, usage contexts, and collocation data.

**Plain English**: This is a "vocabulary card" that comes back from our search. It's not just the word itself, but everything useful we learned about it: how common it is, how relevant it is to the domain, example sentences showing it in context, and words that often appear alongside it.

**Why We Use It**: Raw words are not enough for effective language learning. LOGOS needs frequency data for priority calculation, contexts for task generation, and collocations for relationship mapping.

```typescript
interface ExtractedItem {
  content: string;             // The word or phrase itself
  frequency: number;           // How common (0=rare, 1=very common)
  domainRelevance: number;     // How specific to the domain (0-1)
  domain: string;              // Which domain it came from
  pos?: string;                // Part of speech (noun, verb, etc.)
  contexts: string[];          // Example sentences
  collocations: CollocationData[];  // Words that co-occur
  estimatedDifficulty: number; // Learning difficulty estimate (0-1)
  sourceId: string;            // Which corpus provided this
  rawFrequency?: number;       // Absolute count (if available)
}
```

### CorpusResult

**Technical**: The complete result package from a corpus query, containing the source metadata, extracted items, and query performance statistics.

**Plain English**: This is the "receipt" for your vocabulary order. It tells you which source filled your request, what items you got, how long it took, and whether the results came from cache (fast) or a fresh query (slow).

**Why We Use It**: Beyond the vocabulary items themselves, we need metadata for debugging, cache management, and source quality assessment.

```typescript
interface CorpusResult {
  source: CorpusSource;        // Which source provided this
  items: ExtractedItem[];      // The vocabulary items
  metadata: {
    queryTime: number;         // How long the query took (ms)
    totalAvailable: number;    // Total items before filtering
    domainCoverage: number;    // How well we covered the domain (0-1)
    fromCache: boolean;        // Was this a cache hit?
    cacheExpiry?: Date;        // When cache expires
  };
}
```

---

## Core Functions Explained

### queryCorpus

**Technical**: The primary entry point for corpus queries. Implements cache-first retrieval with fallback through multiple sources ordered by priority.

**Plain English**: This is the "front desk" function that handles all vocabulary requests. It first checks if we've answered this exact question recently (cache). If not, it goes through available sources in order of preference until it finds vocabulary that matches your criteria.

**Why We Use It**: Centralizes query logic, ensures caching is always applied, and implements the fallback chain automatically.

**Behavior**:
1. Check cache for identical query
2. If cache miss, identify available sources for the domain
3. Query sources in priority order until targetCount is reached
4. Cache successful results
5. If all sources fail, fall back to embedded vocabulary

### extractDomainVocabulary

**Technical**: A higher-level function that extracts vocabulary appropriate for a learner's current ability level (theta), applying difficulty filtering and optional collocation focusing.

**Plain English**: This is the "personalized shopping assistant" that knows your learning level. Instead of just getting any medical vocabulary, it gets medical vocabulary that's appropriately challenging for *you* specifically, based on your current ability estimate.

**Why We Use It**: Bridges the gap between raw corpus data and pedagogically appropriate content by filtering for difficulty and deduplicating across sources.

**Parameters**:
- `domain`: Target domain ("medical", "legal", etc.)
- `targetCount`: Number of items needed
- `userLevel`: Learner's current theta (ability) estimate
- `options`: Exclude known items, focus on collocations, etc.

### getDomainVocabularyStats

**Technical**: Computes aggregate statistics about a domain's vocabulary profile, including frequency distribution, average word length, and technical term ratio.

**Plain English**: This is the "inventory report" for a domain. It tells you how much vocabulary exists, how it's distributed by frequency (lots of common words? lots of rare technical terms?), and how "specialized" the domain is overall.

**Why We Use It**: Enables gap analysis (what percentage of the domain does the learner know?) and helps calibrate learning goals.

---

## Caching Strategy

### In-Memory Cache

The module implements a simple but effective in-memory cache via the `CorpusCache` class:

**TTL (Time-To-Live)**: 1 hour default (`DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000`)

**Plain English**: Once we fetch vocabulary for a specific query, we remember the answer for one hour. If someone asks the same question within that hour, we give them the saved answer instantly instead of querying external APIs again.

**Max Size**: 100 entries (`MAX_CACHE_SIZE = 100`)

**Plain English**: We only remember the last 100 queries. This prevents memory from growing unbounded. When we run out of space, we throw away the oldest cached answer.

**Eviction Policy**: Oldest-first (FIFO)

**Query Hashing**: Queries are serialized to JSON for cache key generation. Only semantically relevant fields are hashed (domain, genre, minFrequency, maxDifficulty, targetCount, language, posFilter, keywords).

**Cache-Aware Results**: When returning cached data, the `metadata.fromCache` flag is set to `true` and `metadata.cacheExpiry` indicates when the cached data will expire.

### Why Caching Matters

External corpus APIs have rate limits (e.g., OPUS: 60 requests/minute). Without caching:
- Repeated goal creation for the same domain would hammer APIs
- UI refreshes might trigger redundant queries
- Rate limit exhaustion would degrade user experience

With caching:
- Identical queries return instantly from memory
- API quota is preserved for genuinely new queries
- System remains responsive even during heavy use

---

## Fallback Mechanisms

### Fallback Chain

The module implements a robust fallback strategy:

1. **Primary**: External API sources (COCA, BNC, OPUS)
2. **Secondary**: Embedded vocabulary data (`EMBEDDED_VOCABULARY`)
3. **Tertiary**: Generic general vocabulary (if domain-specific embedded data is missing)

### Embedded Vocabulary

The `EMBEDDED_VOCABULARY` constant contains curated vocabulary for key domains:

- **Medical**: diagnosis, prognosis, symptom, administer, contraindication, etc.
- **Business**: leverage, stakeholder, synergy, benchmark, scalable
- **Academic**: hypothesis, methodology, empirical, paradigm, discourse
- **Legal**: jurisdiction, plaintiff, liability, stipulate
- **General**: significant, establish, fundamental

**Plain English**: Think of embedded vocabulary as the "emergency backup dictionary" that ships with LOGOS. Even if the internet is down or all APIs are broken, learners can still access essential domain vocabulary.

### When Fallbacks Trigger

1. **API unavailable**: Source marked as `isAvailable: false` or API returns error
2. **Rate limit exceeded**: Too many requests, API refuses connection
3. **Empty results**: API returns no items matching query criteria
4. **Network failure**: HTTP request fails entirely

---

## Conversion Function: corpusItemToLanguageObject

This function bridges corpus data to LOGOS's internal data model.

**What it does**:
- Converts `ExtractedItem` (corpus format) to `LanguageObject` (LOGOS format)
- Calculates relational density from collocation strength
- Converts 0-1 difficulty to IRT scale (-3 to +3)
- Computes priority score from frequency, domain relevance, and difficulty

**Plain English**: Corpus data comes in "raw" format with frequency percentages and domain scores. LOGOS's learning algorithms need data in a specific format with IRT difficulty parameters and priority scores. This function is the "translator" between the two formats.

**Conversion Details**:

| Corpus Field | LOGOS Field | Transformation |
|--------------|-------------|----------------|
| `estimatedDifficulty` | `irtDifficulty` | `(difficulty - 0.5) * 6` maps 0-1 to -3 to +3 |
| `collocations[].strength` | `relationalDensity` | Sum of strengths / 5, capped at 1.0 |
| `domainRelevance` | `contextualContribution` | Direct mapping |
| Combined | `priority` | `F * 0.4 + R * 0.4 + (1-D) * 0.2` |

---

## Integration with Corpus Pipeline Service

The `corpus-pipeline.service.ts` in the service layer is the primary consumer of this module. The relationship is:

### This Module (Core) Provides:
- Type definitions (`CorpusSource`, `CorpusQuery`, `ExtractedItem`, `CorpusResult`)
- Pure functions (`queryCorpus`, `extractDomainVocabulary`, `getDomainVocabularyStats`)
- Embedded fallback data
- Conversion utilities (`corpusItemToLanguageObject`)

### Pipeline Service (Service Layer) Handles:
- Actual HTTP requests to external APIs
- Database operations (insert vocabulary, store collocations)
- Goal specification parsing
- User upload processing
- Claude AI integration for vocabulary generation
- PMI computation coordination

### Why This Separation?

LOGOS follows a strict architectural principle: **Core modules are pure**. They contain no I/O operations, no database calls, no HTTP requests. This enables:

1. **Testability**: Core functions can be unit tested without mocking network or database
2. **Portability**: Core algorithms could theoretically run in any JavaScript environment
3. **Predictability**: Same inputs always produce same outputs (referential transparency)

The service layer acts as the "adapter" between pure algorithms and the messy reality of external systems.

---

## Change History

### 2026-01-06 - Documentation Created
- **What Changed**: Initial narrative documentation for dynamic-corpus module
- **Why**: Support Shadow Map documentation methodology for codebase understanding
- **Impact**: Enables developers to understand corpus integration architecture

### Initial Implementation
- **What Changed**: Created dynamic corpus sourcing module with:
  - Multi-source corpus query interface
  - In-memory caching with TTL
  - Embedded vocabulary fallback
  - Domain-specific vocabulary extraction
  - IRT difficulty conversion
- **Why**: Enable goal-based, domain-specific vocabulary population for LOGOS
- **Impact**: Foundation for personalized, corpus-validated language learning content

---

## References

- Sinclair, J. (1991). *Corpus, Concordance, Collocation*. Oxford University Press.
- Church, K., & Hanks, P. (1990). Word association norms, mutual information, and lexicography. *Computational Linguistics*, 16(1), 22-29.
- Davies, M. (2008-). The Corpus of Contemporary American English (COCA). Available online at https://www.english-corpora.org/coca/
- OPUS Project. Open Parallel Corpus. Available at https://opus.nlpl.eu/
