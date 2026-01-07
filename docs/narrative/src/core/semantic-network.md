# Semantic Network Module

> **Last Updated**: 2026-01-06
> **Code Location**: `src/core/semantic-network.ts`
> **Status**: Active

---

## Context & Purpose

This module implements a **semantic network model** for vocabulary relationships. It provides the linguistic knowledge that makes LOGOS understand how words relate to each other - through synonymy, antonymy, hypernymy (category relationships), and collocations.

**Business Need**: Language learning isn't just about memorizing isolated words. Learners need to understand how words connect - that "big" and "large" mean similar things, that "hot" is the opposite of "cold," that "dog" is a type of "animal." This semantic knowledge helps learners:
- Choose the right word for context (synonyms aren't always interchangeable)
- Understand meaning relationships (knowing "vehicle" helps with "car," "bus," "truck")
- Avoid confusion (antonyms, similar spellings)
- Build natural-sounding expressions (collocations)

**When Used**:
- Task generation: Creating exercises that test semantic knowledge
- Distractor selection: Choosing wrong answers that test real distinctions
- Vocabulary expansion: Suggesting related words to learn next
- Difficulty calculation: Words with more connections are easier to learn
- Network visualization: Showing learners how vocabulary connects

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

This module is **self-contained** with no external dependencies. It includes:
- Built-in lexical data (synonym groups, antonym pairs, hypernym hierarchies)
- Type definitions within the file

### Dependents (What Needs This)

**Core Modules:**
- `src/core/priority.ts`: Uses relational density in FRE calculations
- `src/core/tasks/distractor-generator.ts`: Uses synonyms/antonyms for distractors
- `src/core/content/content-generator.ts`: Uses semantic fields for context

**Service Layer:**
- `src/main/services/pmi.service.ts`: Supplements PMI with semantic relations
- `src/main/services/task-generation.service.ts`: Uses semantic data in task creation

**Renderer:**
- `src/renderer/components/analytics/NetworkGraph.tsx`: Visualizes semantic networks

### Data Flow

```
User is learning word "happy"
            |
            v
findSynonyms("happy")  -----> ["joyful", "cheerful", "glad", "delighted"]
            |
            v
findAntonyms("happy")  -----> ["sad", "unhappy"]
            |
            v
buildSemanticNetwork("happy", depth=2)
            |
            v
+-------------------------------------------------------+
|  Network visualization with:                           |
|  - Center: "happy"                                    |
|  - Connected: synonyms, antonyms                      |
|  - Extended: related words at depth 2                 |
+-------------------------------------------------------+
```

---

## Macroscale: System Integration

### Architectural Layer

This module sits at the **Core Algorithm** layer alongside IRT, FSRS, and PMI:

```
+-----------------------------------------------+
| Renderer: NetworkGraph visualization          |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Services: Task generation, PMI analysis       |
+-----------------------------------------------+
                    |
                    v
+-----------------------------------------------+
| Core Algorithms:                              |
|   IRT    FSRS    PMI    SEMANTIC-NETWORK      |  <-- You are here
|                          (THIS MODULE)        |
+-----------------------------------------------+
```

### Big Picture Impact

The semantic network provides **linguistic intelligence** to LOGOS:

| Feature | How Semantic Network Enables It |
|---------|--------------------------------|
| Distractor generation | Semantically related wrong answers test real knowledge |
| Vocabulary expansion | "You know X, so learn Y next" recommendations |
| Difficulty estimation | Network position affects learning difficulty |
| Context generation | Semantic fields provide natural context |
| Error analysis | Confusing synonyms reveals understanding gaps |

**Without Semantic Network:**
- Distractors would be random (not testing real distinctions)
- Vocabulary learning would be isolated (no connections)
- No principled way to suggest what to learn next
- Network visualizations would be impossible
- Difficulty would ignore semantic relationships

### Critical Path Analysis

**Importance Level**: High (Linguistic Foundation)

- **If synonym data is wrong**: Learners get incorrect semantic information
- **If antonym data is incomplete**: Important contrasts are missed
- **If hierarchies are incorrect**: Category relationships mislead learners

**Data Quality**: The built-in data covers common English vocabulary. For domain-specific vocabulary (medical, legal), additional sources may be needed.

---

## Lexical Relation Types

### Synonymy (Same Meaning)

**Definition**: Words with similar meanings that can sometimes substitute for each other.

**Data Structure**: `SYNONYM_GROUPS` organizes synonyms by semantic domain:
```typescript
{
  emotion: [
    ['happy', 'joyful', 'cheerful', 'glad', 'delighted', 'pleased'],
    ['sad', 'unhappy', 'sorrowful', 'melancholy', 'dejected'],
    // ...
  ],
  // ...
}
```

**Key Insight**: Synonyms are not perfectly interchangeable. "Big" and "large" are synonyms, but "big sister" is not "large sister." The groupings show semantic closeness, not substitutability.

### Antonymy (Opposite Meaning)

**Definition**: Words with opposite meanings along some dimension.

**Data Structure**: `ANTONYM_PAIRS` as tuples:
```typescript
[
  ['good', 'bad'],
  ['hot', 'cold'],
  ['up', 'down'],
  // ...
]
```

**Key Insight**: Antonyms come in types:
- **Gradable**: hot-cold (degrees on a scale)
- **Complementary**: dead-alive (no middle ground)
- **Relational**: buy-sell (opposite roles)

### Hypernymy/Hyponymy (Category Relations)

**Definition**: Hypernym = more general category ("animal"). Hyponym = more specific type ("dog").

**Data Structure**: `HYPERNYM_HIERARCHIES` as tree structures:
```typescript
[
  ['animal', ['dog', 'cat', 'bird', 'fish', ...]],
  ['dog', ['poodle', 'bulldog', 'labrador', ...]],
  // ...
]
```

**Key Insight**: This creates inheritance. If you know "dog," you already know some properties of "animal." This enables transfer learning.

### Collocations (Word Partnerships)

**Definition**: Words that frequently appear together in natural language.

**Data Structure**: `COLLOCATIONS` maps verbs to typical noun partners:
```typescript
{
  make: ['decision', 'mistake', 'progress', 'effort', ...],
  take: ['time', 'action', 'place', 'risk', ...],
  // ...
}
```

**Key Insight**: "Make a decision" is natural; "do a decision" is not. Native speakers know collocations intuitively; learners must acquire them explicitly.

---

## Core Functions

### Lookup Functions

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `findSynonyms(word)` | "happy" | ["joyful", "cheerful", ...] | Find words with similar meaning |
| `findAntonyms(word)` | "hot" | ["cold"] | Find words with opposite meaning |
| `findHypernyms(word)` | "dog" | ["animal"] | Find category (more general) |
| `findHyponyms(word)` | "animal" | ["dog", "cat", ...] | Find types (more specific) |
| `findCollocations(word)` | "make" | ["decision", "mistake", ...] | Find typical partners |

### Analysis Functions

#### `calculateSemanticSimilarity(word1, word2)`

Computes how similar two words are using multiple measures:

```typescript
{
  word1: "happy",
  word2: "joyful",
  pathSimilarity: 0.9,      // Based on synonym/hierarchy distance
  icSimilarity: 0.81,       // Based on information content
  distribSimilarity: 0.77,  // Based on co-occurrence
  combinedScore: 0.83       // Weighted average
}
```

**Plain English**: This combines multiple ways of measuring similarity. "Happy" and "joyful" are similar because they're synonyms (high path similarity), they mean similar things (high IC), and they appear in similar contexts (high distributional similarity).

#### `buildSemanticNetwork(word, depth)`

Constructs a graph of related words:

```typescript
{
  nodes: [
    { id: "happy", type: "word", centrality: 1.0 },
    { id: "joyful", type: "word", centrality: 0.5 },
    { id: "sad", type: "word", centrality: 0.5 },
    // ...
  ],
  edges: [
    { source: "happy", target: "joyful", relation: "synonym" },
    { source: "happy", target: "sad", relation: "antonym" },
    // ...
  ],
  stats: { nodeCount: 15, edgeCount: 20, averageDegree: 2.67, density: 0.1 }
}
```

**Plain English**: Starting from a word, explore outward through all relationships. Depth=1 gets immediate neighbors. Depth=2 gets neighbors of neighbors. The result is a mini-network centered on the target word.

#### `calculateNetworkBasedDifficulty(word)`

Estimates how hard a word is to learn based on its network position:

```typescript
{
  difficulty: 0.45,  // 0-1 scale
  factors: {
    synonymDensity: 0.6,    // More synonyms = easier (more learning hooks)
    hierarchyDepth: 0.3,    // Deeper = harder (more specific)
    polysemy: 0.2,          // Multiple meanings = harder
    abstractness: 0.5       // Abstract = harder than concrete
  }
}
```

**Plain English**: Words are easier to learn if they have many synonyms (multiple ways to understand them), are not too deep in hierarchies (not too specialized), have single meanings (not confusing), and are concrete (easy to visualize).

### Learning Support Functions

#### `suggestVocabularyExpansion(knownWords, count)`

Suggests what to learn next based on current vocabulary:

```typescript
suggestVocabularyExpansion(['happy', 'big', 'run'], 5)
// Returns:
[
  { word: 'joyful', reason: 'Synonym of "happy" - expands expression variety', priority: 0.8 },
  { word: 'sad', reason: 'Opposite of "happy" - builds contrast understanding', priority: 0.7 },
  { word: 'large', reason: 'Synonym of "big" - expands expression variety', priority: 0.8 },
  // ...
]
```

**Plain English**: If you know "happy," learning "joyful" is efficient (they reinforce each other). Learning "sad" builds contrast understanding. The suggestions are prioritized by how valuable they are given what you already know.

#### `findBridgeWords(domain1Words, domain2Words)`

Finds words that connect two semantic domains:

```typescript
findBridgeWords(['patient', 'diagnosis'], ['data', 'analysis'])
// Returns words that appear in both medical and data analysis contexts
```

**Plain English**: Some words belong to multiple domains. "Analysis" connects medicine and data science. "Treatment" connects medicine and psychology. Bridge words help learners transfer knowledge between domains.

---

## Technical Concepts (Plain English)

### Synset (Synonym Set)

**Technical**: A set of lexical items (lemmas) that represent the same underlying concept, as organized in WordNet.

**Plain English**: A group of words that mean the same thing. The synset for "happiness" includes "felicity," "joy," and other words representing that concept. Each synset captures one meaning - words with multiple meanings belong to multiple synsets.

**Why We Use It**: Synsets help us distinguish word senses. "Bank" (financial) and "bank" (river) are different synsets. This prevents conflating unrelated meanings.

### Hypernym / Hyponym

**Technical**: In the IS-A hierarchy, a hypernym is a more general term and a hyponym is a more specific term. "Dog" IS-A "animal" (animal = hypernym, dog = hyponym).

**Plain English**: Like a family tree for categories. "Animal" is the parent, "dog" is the child. Knowing the parent helps understand the child (dogs have animal properties) and vice versa (if you know dogs, you know something about animals).

**Why We Use It**: Category relationships enable transfer. Learning "vehicle" makes "car," "bus," "truck" easier because they share properties.

### Collocation

**Technical**: A sequence of words that co-occur more frequently than would be expected by chance, often forming a semi-fixed expression.

**Plain English**: Word partnerships that "sound right" to native speakers. "Heavy rain" (natural), not "strong rain" (unnatural). "Make a decision" (natural), not "do a decision" (unnatural).

**Why We Use It**: Collocations are crucial for fluency. Learners who use correct collocations sound natural; those who don't sound foreign even with perfect grammar.

### Semantic Similarity

**Technical**: A measure of how close two words are in meaning, computed from their positions in the lexical hierarchy, information content, and/or distributional patterns.

**Plain English**: A number (0-1) saying how similar two words are. "Big" and "large" = 0.9 (very similar). "Big" and "small" = 0.3 (related but opposite). "Big" and "democracy" = 0.1 (unrelated).

**Why We Use It**: Similarity helps with distractor selection (similar-but-wrong answers), synonym suggestions, and vocabulary organization.

### Network Centrality

**Technical**: A measure of a node's importance in a graph, based on the number and quality of its connections.

**Plain English**: How "central" a word is in the vocabulary network. High-centrality words like "good," "make," "have" connect to many others. Low-centrality words like "quixotic" are more isolated.

**Why We Use It**: Central words are often high-value learning targets (they unlock understanding of many related words).

---

## Data Coverage

### Synonym Groups

| Domain | Groups | Total Words |
|--------|--------|-------------|
| Size | 4 groups | ~20 words |
| Emotion | 5 groups | ~30 words |
| Movement | 3 groups | ~15 words |
| Speech | 5 groups | ~25 words |
| Cognition | 4 groups | ~20 words |
| Quality | 5 groups | ~25 words |
| Quantity | 4 groups | ~20 words |
| Time | 4 groups | ~20 words |

### Antonym Pairs

- 50+ common antonym pairs
- Covering adjectives, verbs, and some nouns
- Both gradable and complementary antonyms

### Hypernym Hierarchies

- 20+ hierarchies
- Covering concrete nouns (animals, vehicles, food)
- 5-10 hyponyms per hypernym

### Collocations

- 10 high-frequency verbs
- 10 collocates per verb
- Focus on learner-problematic combinations

---

## Limitations and Future Work

### Current Limitations

1. **English only**: No multilingual support
2. **General vocabulary**: Domain-specific terms need additional sources
3. **Static data**: No learning or adaptation
4. **Shallow hierarchies**: Only 2 levels in most cases
5. **No sense disambiguation**: Polysemous words treated as single units

### Potential Extensions

1. **WordNet integration**: Full lexical database coverage
2. **Domain vocabularies**: Medical, legal, technical subsets
3. **Embedding-based similarity**: Neural word embeddings for broader coverage
4. **Multilingual networks**: L1-L2 mappings for transfer
5. **Dynamic expansion**: Learn new relationships from user data

---

## Change History

### 2026-01-06 - Initial Documentation

- **What Changed**: Created shadow documentation for semantic-network.ts
- **Why**: Linguistic module requires documentation for understanding vocabulary relationships
- **Impact**: Enables developers and AI agents to understand semantic network implementation

### Academic References

- Miller, G.A. (1995). WordNet: A Lexical Database for English
- Fellbaum, C. (1998). WordNet: An Electronic Lexical Database
- Turney, P.D. & Pantel, P. (2010). From Frequency to Meaning
- Mikolov, T. et al. (2013). Distributed Representations of Words and Phrases
