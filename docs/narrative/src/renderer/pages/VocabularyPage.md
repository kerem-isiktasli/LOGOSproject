# VocabularyPage

> **Last Updated**: 2026-01-05
> **Code Location**: `src/renderer/pages/VocabularyPage.tsx`
> **Status**: Active

---

## Context & Purpose

The VocabularyPage serves as the comprehensive vocabulary browser within the LOGOS language learning application. It provides users with a detailed view of all language objects (words, phrases, morphemes, etc.) associated with their active learning goal, enabling deep introspection into their vocabulary acquisition journey.

**Business Need**: Language learners need a way to review, search, and understand their entire vocabulary corpus beyond just flashcard-style practice sessions. This page addresses the "vocabulary explorer" use case where users want to:
- See an overview of all vocabulary items they are learning
- Filter and search for specific items by type or mastery stage
- Understand the linguistic complexity of individual items through the z(w) vector visualization
- Track their mastery progress for each vocabulary item

**When Used**: This page is accessed when a user navigates to "Vocabulary" in the sidebar navigation. It requires an active learning goal to be selected - without one, the page displays a helpful prompt to select or create a goal first.

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**React Core**:
- `React, useEffect, useState, useCallback`: Standard React hooks for state management and lifecycle handling

**UI Components**:
- `../components/ui/GlassCard`: The translucent card container using Apple's Liquid Glass aesthetic - provides visual hierarchy and groups related information
- `../components/ui/GlassButton`: Interactive button component for navigation actions (e.g., "Go Back" when no goal selected)
- `../components/ui/GlassBadge`: Small colored labels displaying categorical information like component type (Lexical, Morphology, etc.) and mastery stage
- `../components/ui/GlassProgress`: Progress bar component visualizing mastery accuracy percentages

**Backend Services (via Electron IPC)**:
- `window.logos.goal.getLanguageObjects()`: Fetches all language objects for a given goal with optional collocation data. This is the primary data source for the vocabulary list.

### Dependents (What Needs This)

**Application Router**:
- `../App.tsx`: The main application component renders VocabularyPage when `currentPage === 'vocabulary'`. It passes `goalId` (from `activeGoal?.id`) and an `onNavigateBack` callback.

### Data Flow

```
User navigates to Vocabulary tab
        |
        v
VocabularyPage mounts with goalId prop
        |
        v
useEffect triggers loadVocabulary()
        |
        v
IPC call: window.logos.goal.getLanguageObjects(goalId, {limit: 500, includeCollocations: true})
        |
        v
Main process queries SQLite via Prisma (LanguageObject table)
        |
        v
Response returns array of LanguageObjectDetail objects
        |
        v
Component calculates aggregate stats (by type, by stage, averages)
        |
        v
UI renders: stats summary cards, filterable/sortable list, detail panel
        |
        v
User clicks item --> selectedObject state updates --> detail panel shows z(w) vector, mastery state, IRT params, collocations
```

---

## Macroscale: System Integration

### Architectural Layer

This component sits in the **Presentation Layer** of the LOGOS three-tier architecture:

- **Layer 1 (Presentation)**: VocabularyPage - React component handling user interactions and data visualization
- **Layer 2 (Application Logic)**: Goal IPC handlers, state-priority service - processes requests and manages learning state
- **Layer 3 (Data)**: SQLite database via Prisma - stores LanguageObject records with all metadata

### Big Picture Impact

VocabularyPage is part of the **Learner Insight System**, enabling users to understand their learning at a granular level. While SessionPage focuses on active practice and DashboardPage provides overview metrics, VocabularyPage offers **deep vocabulary introspection**.

**What This Enables**:
1. **Self-Directed Learning**: Users can identify weak areas by filtering for specific mastery stages or component types
2. **Transparency in AI Decisions**: The z(w) vector visualization explains WHY certain items have higher priority - users see the frequency, relational density, and linguistic complexity scores
3. **IRT Parameter Visibility**: Displaying the difficulty parameter (b) and priority percentage helps users understand the adaptive algorithm's reasoning
4. **Collocation Awareness**: Showing PMI-based collocations helps users understand word relationships, supporting deeper vocabulary acquisition

**System Dependencies**:
- **Goal System**: VocabularyPage requires an active goal - no goal means no vocabulary to display
- **Corpus Pipeline**: The vocabulary displayed here originates from corpus population (via corpus-pipeline.service)
- **State Management**: Mastery states shown come from the state-priority system that tracks learning progress
- **IRT System**: Difficulty parameters displayed are calculated by the IRT module (src/core/irt.ts)
- **PMI System**: Collocations are computed by the PMI module (src/core/pmi.ts)

### Critical Path Analysis

**Importance Level**: Medium-High

VocabularyPage is not on the critical learning path (users can learn without ever visiting it), but it serves essential functions:

- **If this fails**: Users lose visibility into their vocabulary corpus and cannot perform targeted review or self-assessment
- **Failure mode**: Without this page, users are limited to whatever the adaptive algorithm selects - they lose agency in exploring their learning material
- **Backup**: Users could access raw data through system export, but would lose all visualization and filtering capabilities

---

## Technical Concepts (Plain English)

### z(w) Vector Visualization

**Technical**: A multi-dimensional representation of a language object's characteristics including frequency, relational density, morphological score, phonological difficulty, syntactic complexity, and pragmatic score. Each dimension is normalized to [0,1].

**Plain English**: Think of it like a "linguistic fingerprint" for each word. Just as fingerprints have ridges of different heights, each word has different characteristics that affect how hard it is to learn. The horizontal bars show these characteristics - longer bars mean higher values. A word with high frequency (commonly used) but low syntactic complexity (simple grammar) will look different from a rare technical term with complex grammar patterns.

**Why We Use It**: The z(w) vector is central to LOGOS's priority calculation. By showing it to users, we make the "black box" of adaptive learning transparent - users can see exactly why the system considers certain words more important or difficult.

### IRT Difficulty Parameter (b)

**Technical**: The item difficulty parameter from Item Response Theory (specifically 2PL or 3PL models), representing the ability level at which a learner has a 50% probability of correctly responding to this item.

**Plain English**: Imagine a difficulty slider from -3 to +3. A word at -2 is relatively easy - most learners get it right. A word at +2 is quite hard - only advanced learners consistently get it right. The b parameter positions each vocabulary item on this difficulty scale based on how learners actually perform.

**Why We Use It**: IRT allows LOGOS to match items to learner ability. Showing the b parameter helps users understand why they see certain items - items near their current ability level maximize learning efficiency.

### PMI (Pointwise Mutual Information) for Collocations

**Technical**: A measure of association between two words, calculated as log(P(x,y) / (P(x) * P(y))). Higher PMI indicates words that appear together more often than would be expected by chance.

**Plain English**: PMI finds "word buddies" - pairs of words that like to hang out together. When you see "make" appearing with "decision" far more than random chance would predict, PMI captures that relationship. The collocations section shows which words are linguistic partners of the selected vocabulary item.

**Why We Use It**: Learning words in isolation is less effective than learning their natural partners. Showing collocations helps users internalize authentic language patterns, not just individual definitions.

### Mastery Stages (0-4)

**Technical**: A 5-stage model tracking progression from unknown (0) through recognition (1), recall (2), controlled production (3), to automatic production (4). Transitions are determined by accuracy thresholds in cue-free vs cue-assisted conditions.

**Plain English**: Like learning to drive, vocabulary mastery has stages:
- Stage 0 (Unknown): Never seen this word before
- Stage 1 (Recognition): "I've seen this!" - can recognize it when shown
- Stage 2 (Recall): Can remember the meaning when prompted
- Stage 3 (Controlled): Can use it correctly with some effort/thinking
- Stage 4 (Automatic): Uses it naturally without conscious effort

**Why We Use It**: The stage system guides practice intensity. New items get frequent exposure; mastered items are reviewed less often. The badges showing each item's stage help users see their progress distribution.

### Component Types (LEX, MORPH, G2P, SYNT, PRAG)

**Technical**: Categorization of language objects by linguistic component - Lexical (vocabulary items), Morphological (word formation patterns), Grapheme-to-Phoneme (pronunciation), Syntactic (grammar structures), and Pragmatic (contextual usage).

**Plain English**: Language has different "layers" - like an onion. LEX is the basic vocabulary layer. MORPH deals with word parts (prefixes, suffixes). G2P is about pronunciation. SYNT is grammar. PRAG is about when and where to use language appropriately. Each component requires different learning approaches.

**Why We Use It**: LOGOS tracks mastery separately for each component type because a learner might know a word's meaning (LEX) but struggle with its pronunciation (G2P). The filter by component type helps users focus on specific linguistic weaknesses.

---

## Change History

### 2026-01-05 - Initial Documentation
- **What Changed**: Created narrative documentation for VocabularyPage
- **Why**: Shadow Map methodology requires 1:1 documentation for all code files
- **Impact**: Developers and maintainers can now understand the WHY behind this component's design

---

## Interface Contracts

### Props Interface

```
VocabularyPageProps {
  goalId?: string       - UUID of the active learning goal (undefined shows "no goal" state)
  onNavigateBack?()     - Callback to return to previous page
}
```

### Internal State

| State Variable | Type | Purpose |
|---------------|------|---------|
| `objects` | LanguageObjectDetail[] | Full list of vocabulary items from backend |
| `selectedObject` | LanguageObjectDetail | Currently selected item for detail panel |
| `stats` | VocabularyStats | Aggregated counts and averages |
| `isLoading` | boolean | Loading spinner display |
| `searchTerm` | string | Text filter for content search |
| `typeFilter` | string | Component type filter (LEX/MORPH/etc.) |
| `stageFilter` | number | Mastery stage filter (0-4) |
| `sortBy` | 'priority' | 'frequency' | 'content' | Sort order selection |

### Key Render States

1. **No Goal Selected**: Shows GlassCard with message and optional "Go Back" button
2. **Loading**: Shows spinner animation while fetching data
3. **Empty Results**: Shows message when filters produce no matches
4. **Normal**: Shows stats grid, filter controls, vocabulary list, and optional detail panel
