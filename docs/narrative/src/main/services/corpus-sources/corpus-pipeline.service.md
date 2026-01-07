# Corpus Pipeline Service - Vocabulary Population Orchestrator

> **Last Updated**: 2026-01-06
> **Code Location**: `src/main/services/corpus-sources/corpus-pipeline.service.ts`
> **Status**: Active

---

## Why This Exists

When a user creates a learning goal like "IELTS academic vocabulary" or "medical English for nursing," they need hundreds of relevant vocabulary items to study. Manually entering vocabulary is impractical. This service solves the **vocabulary cold-start problem** by automatically populating goals with domain-relevant learning content from multiple sources.

The corpus pipeline orchestrates a complex workflow:
1. Determining which sources to query (Wikipedia, Wiktionary, PubMed, or Claude AI)
2. Fetching content from each source
3. Extracting vocabulary items with frequency analysis
4. Generating multi-component learning objects (morphological, phonological, syntactic, pragmatic)
5. Computing difficulty metrics (IRT, relational density)
6. Inserting into database with mastery state initialization

**Business Impact**: Users can start learning immediately after creating a goal. A "medical vocabulary" goal can be populated with 500 relevant terms in under a minute, each with calculated difficulty and linguistic metadata.

---

## Key Concepts

### Multi-Source Vocabulary Aggregation

**Technical Definition**: The pipeline queries multiple corpus sources in parallel, each returning vocabulary items in a common format. Sources include live APIs (Wikipedia, Wiktionary, PubMed), Claude AI generation, and user-uploaded documents.

**Plain English**: Like a research team gathering information from libraries, online databases, subject experts, and your own notes - then compiling it all into one organized study guide.

### Vocabulary Item Types

**Technical Definition**: Each vocabulary item has a type indicating its linguistic component:
- `LEX`: Core vocabulary (words and phrases)
- `MORPH`: Morphological patterns (prefixes, suffixes, root analysis)
- `G2P`: Grapheme-to-phoneme (pronunciation/spelling relationships)
- `SYNT`: Syntactic patterns (grammar structures)
- `PRAG`: Pragmatic expressions (register, speech acts, discourse markers)

**Plain English**: Learning a word isn't just about definition. You need to know how to pronounce it, how it changes form, how to use it in sentences, and when it's appropriate. Each type focuses on a different aspect of word knowledge.

### Claude AI Fallback

**Technical Definition**: When direct API access fails or isn't available for a source, the pipeline falls back to Claude AI to generate vocabulary that would be found in that source type. This ensures population succeeds even with API failures.

**Plain English**: If the library is closed, you ask a knowledgeable friend to recommend books. Claude acts as this fallback - when Wikipedia API fails, Claude generates Wikipedia-style vocabulary.

### Multi-Component Object Generation

**Technical Definition**: After populating base LEX items, the pipeline can generate derived MORPH, G2P, SYNT, and PRAG objects using linguistic analysis modules (morphology, g2p, syntactic, pragmatics from `src/core/`).

**Plain English**: Starting with the word "recommendation," the system automatically creates related learning items: "re- + commend + -ation" (morphology), pronunciation patterns (phonology), "I would recommend..." (pragmatics), etc.

### Deduplication and Frequency Ranking

**Technical Definition**: Vocabulary from multiple sources is deduplicated by content (keeping highest-frequency version) and sorted by frequency. This prevents the same word appearing multiple times and prioritizes common vocabulary.

**Plain English**: If three sources all mention "diagnosis," we keep one copy and note it's very common. If one source mentions an obscure term, it gets lower priority.

---

## Design Decisions

### Why Multiple Access Methods?

Different sources require different access patterns:
- **API**: Wikipedia, Wiktionary, PubMed have public REST APIs
- **Claude**: AI generation for sources without APIs or when APIs fail
- **Upload**: User documents need text extraction (PDF, DOCX, RTF, HTML)
- **Static**: Exam materials (IELTS, TOEFL word lists) are pre-curated

**Trade-off**: Complexity in the pipeline vs. comprehensive source coverage.

### Why Generate Fallback Vocabulary?

The `generateFallbackVocabulary()` function returns 10 basic academic words when all other methods fail.

**Reason**: Users should never see an empty goal after population. Even if all sources fail, they get a minimal starting set. Better user experience than error messages.

### Why Extract Multi-Component Objects Separately?

MORPH, G2P, SYNT, and PRAG generation are separate functions called after LEX population, not inline.

**Reason**:
1. LEX population must complete first (derived objects reference base words)
2. Multi-component generation is computationally expensive (morphological analysis, etc.)
3. Allows incremental population - users can start learning LEX immediately while other types generate

### Why Store Metadata as JSON Strings?

Morphological analysis, phonological difficulty, and pragmatic profiles are stored as JSON strings in the `metadata` column rather than separate columns.

**Reason**: Schema flexibility. Different object types need different metadata. JSON allows heterogeneous storage without schema migration for every new linguistic feature.

### Why Initialize MasteryState During Insert?

When inserting vocabulary, the pipeline also creates initial `MasteryState` records for each item.

**Reason**: Prevents null-checking everywhere. Every learning object has a mastery state from creation. The FSRS algorithm expects initialized values.

---

## Integration Points

### Source Fetching Functions

| Source | Function | Method |
|--------|----------|--------|
| Wikipedia | `fetchFromWikipedia()` | Search API + content extraction |
| Simple Wikipedia | `fetchFromWikipedia()` | Same as Wikipedia with simpler content |
| Wiktionary | `fetchFromWiktionary()` | Category members API |
| PubMed | `fetchFromPubMed()` | eSearch + eFetch for abstracts |
| Claude AI | `generateVocabularyWithClaude()` | Prompt-based generation |
| User uploads | `processUserUploads()` | Text extraction + tokenization |

### Linguistic Analysis Integration

| Module | Import | Usage |
|--------|--------|-------|
| `src/core/morphology` | `analyzeMorphology`, `computeMorphologicalScore` | MORPH object generation |
| `src/core/g2p` | `analyzeG2PDifficulty`, `computePhonologicalDifficulty` | G2P object generation |
| `src/core/syntactic` | `analyzeSyntacticComplexity`, `analyzeClauseStructure` | SYNT object generation |
| `src/core/pragmatics` | `generatePragmaticProfile`, `getDomainStatistics` | PRAG object generation |

### Upstream Dependencies

| Module | Import | Purpose |
|--------|--------|---------|
| `../../db/prisma` | `getPrisma` | Database access for insert/query |
| `./filter` | `getDefaultSourceIds`, `GoalSpec` | Source selection based on goal |
| `./registry` | `getSourceById`, `CorpusSource` | Source metadata lookup |
| `../pmi.service` | `updateIRTDifficulties`, `storeCollocations`, `clearCalculatorCache` | Post-population metric computation |
| `../claude.service` | `getClaudeService` | AI vocabulary generation |

### Downstream Consumers

| Consumer | Usage |
|----------|-------|
| `src/main/ipc/goal.ipc.ts` | `goal:populate-vocabulary` handler calls `populateVocabularyForGoal` |
| `src/main/ipc/goal.ipc.ts` | `goal:upload-corpus` handler calls `processUserUploads` |
| `src/main/ipc/goal.ipc.ts` | `goal:get-population-status` handler calls `getPopulationStatus` |
| `src/main/ipc/goal.ipc.ts` | `goal:clear-vocabulary` handler calls `clearVocabulary` |

### Data Flow

```
[User creates goal with domain/benchmark]
              |
              v
[populateVocabularyForGoal(goalId, options)]
              |
              v
[Get goal spec from database]
              |
              v
[Determine source IDs (selected or default)]
              |
              v
+---------+---------+---------+
|         |         |         |
v         v         v         v
[Wikipedia] [Wiktionary] [PubMed] [Claude]
    |          |          |         |
    +-----+----+-----+----+----+----+
          |               |
          v               v
[Aggregate vocabulary items]
          |
          v
[Deduplicate by content]
          |
          v
[Insert into LanguageObject table]
          |
          v
[Create MasteryState for each object]
          |
          v
[Update relational densities (PMI)]
          |
          v
[Update IRT difficulties]
          |
          v
[Store collocations]
          |
          v
[Return PopulationResult]
```

### Critical Path Status

**Severity**: HIGH

If this service fails:
- **Empty goals**: Users cannot populate vocabulary automatically
- **Manual entry only**: Severely degraded UX requiring item-by-item addition
- **Broken onboarding**: New users get stuck at goal creation

**Mitigation**:
- Fallback vocabulary ensures minimum population
- Claude fallback when APIs fail
- Partial success possible (some sources succeed, others fail)
- Errors collected and returned in `PopulationResult.errors`

---

## Change History

| Date | Change | Reason | Impact |
|------|--------|--------|--------|
| 2026-01-06 | Shadow documentation created | Establish narrative context for corpus pipeline | Developers understand vocabulary population flow |
