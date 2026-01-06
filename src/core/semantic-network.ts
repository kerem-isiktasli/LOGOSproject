/**
 * Semantic Network Module
 *
 * Implements synonym/paraphrase network model for language learning.
 * Based on WordNet lexical relations and distributional semantics.
 *
 * Academic References:
 * - Miller, G.A. (1995). WordNet: A Lexical Database for English. Communications of the ACM.
 * - Fellbaum, C. (1998). WordNet: An Electronic Lexical Database. MIT Press.
 * - Turney, P.D. & Pantel, P. (2010). From Frequency to Meaning: Vector Space Models of Semantics.
 * - Mikolov, T. et al. (2013). Distributed Representations of Words and Phrases. NIPS.
 *
 * Key concepts:
 * - Synsets: Sets of cognitive synonyms expressing a distinct concept
 * - Lexical relations: Hypernymy, hyponymy, meronymy, antonymy
 * - Semantic similarity: Distance in the lexical hierarchy
 * - Distributional similarity: Co-occurrence based similarity
 *
 * @module core/semantic-network
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Part of speech categories
 */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb';

/**
 * WordNet lexical relation types
 * Based on Miller (1995) and Fellbaum (1998)
 */
export type LexicalRelation =
  // Noun relations
  | 'hypernym'      // IS-A: chair -> furniture (more general)
  | 'hyponym'       // KIND-OF: furniture -> chair (more specific)
  | 'meronym'       // PART-OF: wheel -> car
  | 'holonym'       // HAS-PART: car -> wheel
  | 'instance_of'   // INSTANCE: Tokyo -> city
  | 'has_instance'  // HAS-INSTANCE: city -> Tokyo
  // Verb relations
  | 'entails'       // ENTAILS: snore -> sleep
  | 'causes'        // CAUSES: kill -> die
  | 'troponym'      // MANNER-OF: march -> walk
  // Adjective relations
  | 'similar_to'    // SIMILAR: happy -> joyful
  | 'also_see'      // SEE-ALSO: beautiful -> pretty
  | 'attribute'     // ATTRIBUTE: heavy -> weight
  | 'pertainym'     // PERTAINING: musical -> music
  // Cross-POS relations
  | 'derivation'    // DERIVED: happiness -> happy
  | 'antonym'       // OPPOSITE: good -> bad
  | 'synonym';      // SAME-MEANING: big -> large

/**
 * Paraphrase relation types
 * Based on PPDB (Paraphrase Database) classification
 */
export type ParaphraseType =
  | 'equivalent'    // Semantically equivalent (big -> large)
  | 'entailment'    // Forward entailment (animal -> dog)
  | 'reverse_entailment'  // Backward entailment (dog -> animal)
  | 'exclusion'     // Mutually exclusive (cat -> dog)
  | 'related'       // Semantically related but not equivalent
  | 'independent';  // Unrelated

/**
 * Synset (synonym set) - represents a distinct concept
 */
export interface Synset {
  /** Unique synset identifier (e.g., 'n01234567') */
  id: string;

  /** Part of speech */
  pos: PartOfSpeech;

  /** Member lemmas (words in this synset) */
  lemmas: string[];

  /** Gloss (definition) */
  definition: string;

  /** Example sentences */
  examples: string[];

  /** Lexical domain (e.g., 'noun.food', 'verb.motion') */
  domain: string;

  /** Frequency score (how common this sense is) */
  frequency: number;
}

/**
 * Lexical relation between synsets
 */
export interface SynsetRelation {
  /** Source synset ID */
  sourceId: string;

  /** Target synset ID */
  targetId: string;

  /** Relation type */
  relation: LexicalRelation;

  /** Confidence/strength of relation (0-1) */
  weight: number;
}

/**
 * Word sense with synset reference
 */
export interface WordSense {
  /** Word lemma */
  lemma: string;

  /** Synset this sense belongs to */
  synsetId: string;

  /** Sense number (1 = most common) */
  senseNumber: number;

  /** Frequency in corpus */
  frequency: number;

  /** Tag count (WordNet annotations) */
  tagCount: number;
}

/**
 * Paraphrase pair with confidence scores
 */
export interface ParaphrasePair {
  /** First phrase/word */
  phrase1: string;

  /** Second phrase/word */
  phrase2: string;

  /** Paraphrase type */
  type: ParaphraseType;

  /** PPDB score (0-1, higher = more confident) */
  ppdbScore: number;

  /** Distributional similarity (cosine similarity of embeddings) */
  distribSimilarity: number;

  /** Context overlap score */
  contextOverlap: number;
}

/**
 * Semantic similarity result
 */
export interface SemanticSimilarity {
  /** First word */
  word1: string;

  /** Second word */
  word2: string;

  /** Path-based similarity (Wu-Palmer) */
  pathSimilarity: number;

  /** Information content similarity (Lin) */
  icSimilarity: number;

  /** Distributional similarity */
  distribSimilarity: number;

  /** Combined similarity score */
  combinedScore: number;
}

/**
 * Word family (morphologically related words)
 */
export interface WordFamily {
  /** Base/root word */
  baseWord: string;

  /** Family members with relation types */
  members: {
    word: string;
    relation: 'inflection' | 'derivation' | 'compound';
    pos: PartOfSpeech;
  }[];
}

/**
 * Semantic field (lexical field)
 */
export interface SemanticField {
  /** Field name (e.g., 'cooking', 'emotions') */
  name: string;

  /** Core vocabulary in this field */
  coreWords: string[];

  /** Extended vocabulary */
  extendedWords: string[];

  /** Related fields */
  relatedFields: string[];

  /** Domain association */
  domains: string[];
}

/**
 * Node in semantic network
 */
export interface SemanticNode {
  /** Node ID (word or synset ID) */
  id: string;

  /** Node type */
  type: 'word' | 'synset' | 'phrase';

  /** Label for display */
  label: string;

  /** Part of speech */
  pos?: PartOfSpeech;

  /** Centrality score (how connected in network) */
  centrality: number;

  /** Frequency in corpus */
  frequency: number;
}

/**
 * Edge in semantic network
 */
export interface SemanticEdge {
  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Relation type */
  relation: LexicalRelation | ParaphraseType;

  /** Edge weight/strength */
  weight: number;
}

/**
 * Semantic network structure
 */
export interface SemanticNetwork {
  /** Nodes in the network */
  nodes: SemanticNode[];

  /** Edges (relations) */
  edges: SemanticEdge[];

  /** Network statistics */
  stats: {
    nodeCount: number;
    edgeCount: number;
    averageDegree: number;
    density: number;
  };
}

// =============================================================================
// Lexical Relation Data
// =============================================================================

/**
 * Common English synonym groups
 * Organized by semantic domain
 */
export const SYNONYM_GROUPS: Record<string, string[][]> = {
  size: [
    ['big', 'large', 'huge', 'enormous', 'massive', 'gigantic'],
    ['small', 'little', 'tiny', 'minute', 'miniature'],
    ['tall', 'high', 'lofty', 'towering'],
    ['short', 'low', 'squat'],
  ],
  emotion: [
    ['happy', 'joyful', 'cheerful', 'glad', 'delighted', 'pleased'],
    ['sad', 'unhappy', 'sorrowful', 'melancholy', 'dejected'],
    ['angry', 'furious', 'mad', 'irate', 'enraged'],
    ['afraid', 'scared', 'frightened', 'terrified', 'fearful'],
    ['surprised', 'astonished', 'amazed', 'shocked', 'startled'],
  ],
  movement: [
    ['walk', 'stroll', 'amble', 'saunter', 'wander'],
    ['run', 'sprint', 'dash', 'race', 'jog'],
    ['jump', 'leap', 'hop', 'bound', 'spring'],
  ],
  speech: [
    ['say', 'tell', 'speak', 'utter', 'state'],
    ['ask', 'inquire', 'question', 'query'],
    ['answer', 'reply', 'respond', 'retort'],
    ['shout', 'yell', 'scream', 'cry', 'exclaim'],
    ['whisper', 'murmur', 'mutter', 'mumble'],
  ],
  cognition: [
    ['think', 'believe', 'consider', 'suppose', 'assume'],
    ['know', 'understand', 'comprehend', 'grasp', 'realize'],
    ['remember', 'recall', 'recollect', 'reminisce'],
    ['forget', 'overlook', 'neglect', 'ignore'],
  ],
  quality: [
    ['good', 'excellent', 'great', 'fine', 'superb'],
    ['bad', 'poor', 'terrible', 'awful', 'dreadful'],
    ['important', 'significant', 'crucial', 'vital', 'essential'],
    ['difficult', 'hard', 'challenging', 'tough', 'demanding'],
    ['easy', 'simple', 'straightforward', 'effortless'],
  ],
  quantity: [
    ['many', 'numerous', 'several', 'various', 'multiple'],
    ['few', 'scarce', 'rare', 'limited'],
    ['all', 'every', 'each', 'entire', 'whole'],
    ['some', 'certain', 'particular', 'specific'],
  ],
  time: [
    ['fast', 'quick', 'rapid', 'swift', 'speedy'],
    ['slow', 'gradual', 'leisurely', 'unhurried'],
    ['begin', 'start', 'commence', 'initiate'],
    ['end', 'finish', 'conclude', 'terminate', 'complete'],
  ],
};

/**
 * Common English antonym pairs
 */
export const ANTONYM_PAIRS: [string, string][] = [
  ['good', 'bad'],
  ['big', 'small'],
  ['hot', 'cold'],
  ['fast', 'slow'],
  ['high', 'low'],
  ['long', 'short'],
  ['old', 'young'],
  ['old', 'new'],
  ['open', 'closed'],
  ['light', 'dark'],
  ['light', 'heavy'],
  ['hard', 'soft'],
  ['hard', 'easy'],
  ['happy', 'sad'],
  ['love', 'hate'],
  ['up', 'down'],
  ['in', 'out'],
  ['before', 'after'],
  ['begin', 'end'],
  ['come', 'go'],
  ['give', 'take'],
  ['buy', 'sell'],
  ['win', 'lose'],
  ['true', 'false'],
  ['right', 'wrong'],
  ['right', 'left'],
  ['alive', 'dead'],
  ['rich', 'poor'],
  ['strong', 'weak'],
  ['success', 'failure'],
  ['increase', 'decrease'],
  ['accept', 'reject'],
  ['allow', 'forbid'],
  ['appear', 'disappear'],
  ['arrive', 'depart'],
  ['attack', 'defend'],
  ['create', 'destroy'],
  ['enter', 'exit'],
  ['include', 'exclude'],
  ['maximum', 'minimum'],
  ['positive', 'negative'],
  ['public', 'private'],
  ['question', 'answer'],
  ['remember', 'forget'],
  ['simple', 'complex'],
  ['specific', 'general'],
  ['temporary', 'permanent'],
  ['visible', 'invisible'],
  ['voluntary', 'compulsory'],
];

/**
 * Common hypernym-hyponym hierarchies
 * Format: [hypernym, [hyponyms...]]
 */
export const HYPERNYM_HIERARCHIES: [string, string[]][] = [
  ['animal', ['dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'pig', 'sheep', 'lion', 'tiger']],
  ['dog', ['poodle', 'bulldog', 'labrador', 'beagle', 'terrier', 'collie', 'spaniel']],
  ['bird', ['eagle', 'sparrow', 'robin', 'crow', 'owl', 'parrot', 'penguin', 'swan']],
  ['vehicle', ['car', 'bus', 'truck', 'motorcycle', 'bicycle', 'train', 'plane', 'ship', 'boat']],
  ['car', ['sedan', 'coupe', 'SUV', 'hatchback', 'convertible', 'limousine']],
  ['furniture', ['table', 'chair', 'sofa', 'bed', 'desk', 'cabinet', 'shelf', 'wardrobe']],
  ['fruit', ['apple', 'banana', 'orange', 'grape', 'mango', 'strawberry', 'watermelon']],
  ['vegetable', ['carrot', 'potato', 'tomato', 'onion', 'broccoli', 'spinach', 'cabbage']],
  ['food', ['bread', 'rice', 'pasta', 'meat', 'cheese', 'soup', 'salad', 'sandwich']],
  ['drink', ['water', 'juice', 'coffee', 'tea', 'milk', 'soda', 'wine', 'beer']],
  ['color', ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'gray']],
  ['tool', ['hammer', 'screwdriver', 'wrench', 'saw', 'drill', 'pliers', 'knife']],
  ['clothing', ['shirt', 'pants', 'dress', 'skirt', 'jacket', 'coat', 'shoes', 'hat', 'socks']],
  ['building', ['house', 'apartment', 'office', 'school', 'hospital', 'church', 'factory', 'hotel']],
  ['profession', ['doctor', 'teacher', 'lawyer', 'engineer', 'nurse', 'chef', 'artist', 'writer']],
  ['emotion', ['happiness', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'love', 'hate']],
  ['sport', ['soccer', 'basketball', 'tennis', 'golf', 'swimming', 'running', 'cycling', 'skiing']],
  ['music', ['rock', 'jazz', 'classical', 'pop', 'hip-hop', 'country', 'blues', 'electronic']],
  ['weather', ['rain', 'snow', 'wind', 'sun', 'cloud', 'fog', 'storm', 'thunder']],
  ['body_part', ['head', 'arm', 'leg', 'hand', 'foot', 'eye', 'ear', 'nose', 'mouth', 'heart']],
];

/**
 * Common collocations with verb-noun patterns
 */
export const COLLOCATIONS: Record<string, string[]> = {
  make: ['decision', 'mistake', 'progress', 'effort', 'difference', 'money', 'sense', 'time', 'appointment', 'bed'],
  take: ['time', 'action', 'place', 'risk', 'chance', 'break', 'photo', 'advice', 'medicine', 'responsibility'],
  have: ['time', 'fun', 'problem', 'experience', 'opportunity', 'meeting', 'conversation', 'doubt', 'effect', 'impact'],
  do: ['homework', 'research', 'business', 'damage', 'favor', 'job', 'exercise', 'dishes', 'laundry', 'work'],
  give: ['advice', 'information', 'permission', 'support', 'speech', 'presentation', 'example', 'priority', 'birth', 'way'],
  get: ['job', 'idea', 'impression', 'chance', 'permission', 'result', 'information', 'attention', 'experience', 'access'],
  pay: ['attention', 'visit', 'compliment', 'tribute', 'respect', 'bill', 'price', 'fine', 'debt', 'wages'],
  come: ['true', 'close', 'first', 'last', 'clean', 'forward', 'alive', 'undone', 'apart', 'naturally'],
  keep: ['promise', 'secret', 'record', 'pace', 'track', 'control', 'balance', 'calm', 'quiet', 'company'],
  break: ['news', 'record', 'promise', 'law', 'rule', 'silence', 'ice', 'ground', 'habit', 'heart'],
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Find synonyms for a word
 */
export function findSynonyms(word: string): string[] {
  const lowerWord = word.toLowerCase();
  const synonyms: Set<string> = new Set();

  for (const groups of Object.values(SYNONYM_GROUPS)) {
    for (const group of groups) {
      if (group.includes(lowerWord)) {
        group.forEach(syn => {
          if (syn !== lowerWord) synonyms.add(syn);
        });
      }
    }
  }

  return Array.from(synonyms);
}

/**
 * Find antonyms for a word
 */
export function findAntonyms(word: string): string[] {
  const lowerWord = word.toLowerCase();
  const antonyms: Set<string> = new Set();

  for (const [word1, word2] of ANTONYM_PAIRS) {
    if (word1 === lowerWord) antonyms.add(word2);
    if (word2 === lowerWord) antonyms.add(word1);
  }

  return Array.from(antonyms);
}

/**
 * Find hypernyms (more general terms) for a word
 */
export function findHypernyms(word: string): string[] {
  const lowerWord = word.toLowerCase();
  const hypernyms: string[] = [];

  for (const [hypernym, hyponyms] of HYPERNYM_HIERARCHIES) {
    if (hyponyms.map(h => h.toLowerCase()).includes(lowerWord)) {
      hypernyms.push(hypernym);
    }
  }

  return hypernyms;
}

/**
 * Find hyponyms (more specific terms) for a word
 */
export function findHyponyms(word: string): string[] {
  const lowerWord = word.toLowerCase();

  for (const [hypernym, hyponyms] of HYPERNYM_HIERARCHIES) {
    if (hypernym.toLowerCase() === lowerWord) {
      return [...hyponyms];
    }
  }

  return [];
}

/**
 * Find collocations for a word
 */
export function findCollocations(word: string): string[] {
  const lowerWord = word.toLowerCase();
  return COLLOCATIONS[lowerWord] || [];
}

/**
 * Calculate semantic similarity between two words
 * Uses multiple measures combined
 */
export function calculateSemanticSimilarity(word1: string, word2: string): SemanticSimilarity {
  const lower1 = word1.toLowerCase();
  const lower2 = word2.toLowerCase();

  // Same word
  if (lower1 === lower2) {
    return {
      word1,
      word2,
      pathSimilarity: 1.0,
      icSimilarity: 1.0,
      distribSimilarity: 1.0,
      combinedScore: 1.0,
    };
  }

  // Check if synonyms (high similarity)
  const synonyms1 = findSynonyms(lower1);
  const isSynonym = synonyms1.includes(lower2);

  // Check if antonyms (semantic relation but opposite meaning)
  const antonyms1 = findAntonyms(lower1);
  const isAntonym = antonyms1.includes(lower2);

  // Check hypernym/hyponym relation
  const hypernyms1 = findHypernyms(lower1);
  const hyponyms1 = findHyponyms(lower1);
  const isHierarchyRelated = hypernyms1.includes(lower2) || hyponyms1.includes(lower2);

  // Calculate path similarity (based on hierarchy distance)
  let pathSimilarity = 0;
  if (isSynonym) {
    pathSimilarity = 0.9;
  } else if (isHierarchyRelated) {
    pathSimilarity = 0.7;
  } else if (isAntonym) {
    pathSimilarity = 0.3; // Related but opposite
  } else {
    // Check if they share a common hypernym
    const hypernyms2 = findHypernyms(lower2);
    const commonHypernyms = hypernyms1.filter(h => hypernyms2.includes(h));
    if (commonHypernyms.length > 0) {
      pathSimilarity = 0.5;
    } else {
      pathSimilarity = 0.1;
    }
  }

  // IC (Information Content) similarity approximation
  // Based on how specific the shared concept is
  let icSimilarity = pathSimilarity * 0.9;

  // Distributional similarity placeholder
  // In a real implementation, this would use word embeddings
  let distribSimilarity = pathSimilarity * 0.85;

  // Combined score
  const combinedScore = (pathSimilarity * 0.4 + icSimilarity * 0.3 + distribSimilarity * 0.3);

  return {
    word1,
    word2,
    pathSimilarity,
    icSimilarity,
    distribSimilarity,
    combinedScore,
  };
}

/**
 * Get all lexical relations for a word
 */
export function getLexicalRelations(word: string): Map<LexicalRelation, string[]> {
  const relations = new Map<LexicalRelation, string[]>();

  const synonyms = findSynonyms(word);
  if (synonyms.length > 0) relations.set('synonym', synonyms);

  const antonyms = findAntonyms(word);
  if (antonyms.length > 0) relations.set('antonym', antonyms);

  const hypernyms = findHypernyms(word);
  if (hypernyms.length > 0) relations.set('hypernym', hypernyms);

  const hyponyms = findHyponyms(word);
  if (hyponyms.length > 0) relations.set('hyponym', hyponyms);

  return relations;
}

/**
 * Build a semantic network centered on a word
 */
export function buildSemanticNetwork(
  centerWord: string,
  depth: number = 2
): SemanticNetwork {
  const nodes: Map<string, SemanticNode> = new Map();
  const edges: SemanticEdge[] = [];
  const visited: Set<string> = new Set();

  function addNode(word: string, dist: number): void {
    if (!nodes.has(word)) {
      nodes.set(word, {
        id: word,
        type: 'word',
        label: word,
        centrality: 1 / (dist + 1),
        frequency: 1.0 - (dist * 0.2),
      });
    }
  }

  function explore(word: string, currentDepth: number): void {
    if (currentDepth > depth || visited.has(word)) return;
    visited.add(word);
    addNode(word, currentDepth);

    const relations = getLexicalRelations(word);

    for (const [relationType, relatedWords] of relations) {
      for (const related of relatedWords.slice(0, 5)) { // Limit to 5 per relation
        addNode(related, currentDepth + 1);

        edges.push({
          source: word,
          target: related,
          relation: relationType,
          weight: 1 / (currentDepth + 1),
        });

        if (currentDepth + 1 < depth) {
          explore(related, currentDepth + 1);
        }
      }
    }
  }

  explore(centerWord, 0);

  const nodeArray = Array.from(nodes.values());
  const nodeCount = nodeArray.length;
  const edgeCount = edges.length;
  const averageDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;
  const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

  return {
    nodes: nodeArray,
    edges,
    stats: {
      nodeCount,
      edgeCount,
      averageDegree,
      density,
    },
  };
}

/**
 * Find the semantic field for a word
 */
export function findSemanticField(word: string): SemanticField | null {
  const lowerWord = word.toLowerCase();

  // Check which synonym group contains this word
  for (const [fieldName, groups] of Object.entries(SYNONYM_GROUPS)) {
    for (const group of groups) {
      if (group.includes(lowerWord)) {
        const allFieldWords = groups.flat();
        return {
          name: fieldName,
          coreWords: group,
          extendedWords: allFieldWords.filter(w => !group.includes(w)),
          relatedFields: [],
          domains: ['general'],
        };
      }
    }
  }

  // Check hypernym hierarchies
  for (const [hypernym, hyponyms] of HYPERNYM_HIERARCHIES) {
    if (hypernym === lowerWord || hyponyms.map(h => h.toLowerCase()).includes(lowerWord)) {
      return {
        name: hypernym,
        coreWords: hyponyms.slice(0, 5),
        extendedWords: hyponyms.slice(5),
        relatedFields: findHypernyms(hypernym),
        domains: ['general'],
      };
    }
  }

  return null;
}

/**
 * Generate paraphrase suggestions for a phrase
 */
export function generateParaphrases(phrase: string): ParaphrasePair[] {
  const words = phrase.toLowerCase().split(/\s+/);
  const paraphrases: ParaphrasePair[] = [];

  // Single word paraphrases using synonyms
  for (const word of words) {
    const synonyms = findSynonyms(word);
    for (const syn of synonyms.slice(0, 3)) {
      const newPhrase = phrase.toLowerCase().replace(word, syn);
      if (newPhrase !== phrase.toLowerCase()) {
        paraphrases.push({
          phrase1: phrase,
          phrase2: newPhrase,
          type: 'equivalent',
          ppdbScore: 0.8,
          distribSimilarity: 0.85,
          contextOverlap: 0.9,
        });
      }
    }
  }

  return paraphrases;
}

/**
 * Calculate difficulty of learning a word based on its semantic network position
 * Words with more connections (higher degree) are generally easier to learn
 * because they have more association opportunities
 */
export function calculateNetworkBasedDifficulty(word: string): {
  difficulty: number;
  factors: {
    synonymDensity: number;
    hierarchyDepth: number;
    polysemy: number;
    abstractness: number;
  };
} {
  const synonyms = findSynonyms(word);
  const antonyms = findAntonyms(word);
  const hypernyms = findHypernyms(word);
  const hyponyms = findHyponyms(word);

  // Synonym density: more synonyms = more association opportunities = easier
  const synonymDensity = Math.min(1, synonyms.length / 10);

  // Hierarchy depth: deeper in hierarchy = more specific = potentially harder
  const hierarchyDepth = hypernyms.length > 0 ? 0.3 + (0.1 * hypernyms.length) : 0.5;

  // Polysemy: words in multiple synonym groups are harder (multiple meanings)
  let synGroupCount = 0;
  for (const groups of Object.values(SYNONYM_GROUPS)) {
    for (const group of groups) {
      if (group.includes(word.toLowerCase())) synGroupCount++;
    }
  }
  const polysemy = Math.min(1, synGroupCount / 5);

  // Abstractness: words with many hyponyms (concrete categories) are easier
  const abstractness = hyponyms.length > 0 ? 0.3 : 0.7;

  // Calculate overall difficulty
  // Lower synonym density = harder
  // Higher polysemy = harder
  // Higher abstractness = harder
  const difficulty = (
    (1 - synonymDensity) * 0.3 +
    hierarchyDepth * 0.2 +
    polysemy * 0.25 +
    abstractness * 0.25
  );

  return {
    difficulty: Math.min(1, Math.max(0, difficulty)),
    factors: {
      synonymDensity,
      hierarchyDepth,
      polysemy,
      abstractness,
    },
  };
}

/**
 * Get vocabulary expansion suggestions based on semantic network
 * Suggests words to learn next based on current known words
 */
export function suggestVocabularyExpansion(
  knownWords: string[],
  targetCount: number = 10
): {
  word: string;
  reason: string;
  relation: LexicalRelation;
  sourceWord: string;
  priority: number;
}[] {
  const suggestions: Map<string, {
    word: string;
    reason: string;
    relation: LexicalRelation;
    sourceWord: string;
    priority: number;
  }> = new Map();

  const knownSet = new Set(knownWords.map(w => w.toLowerCase()));

  for (const known of knownWords) {
    const relations = getLexicalRelations(known);

    for (const [relType, related] of relations) {
      for (const word of related) {
        if (!knownSet.has(word.toLowerCase()) && !suggestions.has(word)) {
          let reason = '';
          let priority = 0.5;

          switch (relType) {
            case 'synonym':
              reason = `Synonym of "${known}" - expands expression variety`;
              priority = 0.8;
              break;
            case 'antonym':
              reason = `Opposite of "${known}" - builds contrast understanding`;
              priority = 0.7;
              break;
            case 'hypernym':
              reason = `Category for "${known}" - builds conceptual hierarchy`;
              priority = 0.6;
              break;
            case 'hyponym':
              reason = `Specific type of "${known}" - builds vocabulary depth`;
              priority = 0.65;
              break;
            default:
              reason = `Related to "${known}"`;
              priority = 0.4;
          }

          suggestions.set(word, {
            word,
            reason,
            relation: relType,
            sourceWord: known,
            priority,
          });
        }
      }
    }
  }

  return Array.from(suggestions.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, targetCount);
}

/**
 * Find words that bridge between two semantic domains
 * Useful for teaching vocabulary connections
 */
export function findBridgeWords(domain1Words: string[], domain2Words: string[]): string[] {
  const bridges: Set<string> = new Set();

  for (const word1 of domain1Words) {
    const relations1 = getLexicalRelations(word1);
    const related1 = new Set<string>();

    for (const words of relations1.values()) {
      words.forEach(w => related1.add(w.toLowerCase()));
    }

    for (const word2 of domain2Words) {
      const relations2 = getLexicalRelations(word2);

      for (const words of relations2.values()) {
        for (const w of words) {
          if (related1.has(w.toLowerCase())) {
            bridges.add(w);
          }
        }
      }
    }
  }

  return Array.from(bridges);
}

// =============================================================================
// Exports
// =============================================================================

export default {
  // Lookup functions
  findSynonyms,
  findAntonyms,
  findHypernyms,
  findHyponyms,
  findCollocations,
  getLexicalRelations,

  // Analysis functions
  calculateSemanticSimilarity,
  buildSemanticNetwork,
  findSemanticField,
  generateParaphrases,
  calculateNetworkBasedDifficulty,

  // Learning support functions
  suggestVocabularyExpansion,
  findBridgeWords,

  // Data exports
  SYNONYM_GROUPS,
  ANTONYM_PAIRS,
  HYPERNYM_HIERARCHIES,
  COLLOCATIONS,
};
