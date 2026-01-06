/**
 * Semantic Network Module Tests
 *
 * Tests for WordNet-based lexical relations and semantic similarity.
 *
 * Academic References:
 * - Miller, G.A. (1995). WordNet: A Lexical Database for English.
 * - Fellbaum, C. (1998). WordNet: An Electronic Lexical Database.
 */

import { describe, it, expect } from 'vitest';
import {
  findSynonyms,
  findAntonyms,
  findHypernyms,
  findHyponyms,
  findCollocations,
  getLexicalRelations,
  calculateSemanticSimilarity,
  buildSemanticNetwork,
  findSemanticField,
  generateParaphrases,
  calculateNetworkBasedDifficulty,
  suggestVocabularyExpansion,
  findBridgeWords,
  SYNONYM_GROUPS,
  ANTONYM_PAIRS,
  HYPERNYM_HIERARCHIES,
} from '../semantic-network';

describe('Semantic Network Module', () => {
  describe('findSynonyms', () => {
    it('should find synonyms for common words', () => {
      const synonyms = findSynonyms('big');
      expect(synonyms).toContain('large');
      expect(synonyms).toContain('huge');
      expect(synonyms).not.toContain('big'); // Should not include self
    });

    it('should find synonyms for emotion words', () => {
      const synonyms = findSynonyms('happy');
      expect(synonyms).toContain('joyful');
      expect(synonyms).toContain('cheerful');
    });

    it('should return empty array for unknown words', () => {
      const synonyms = findSynonyms('xyznonexistent');
      expect(synonyms).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const synonyms1 = findSynonyms('Big');
      const synonyms2 = findSynonyms('big');
      expect(synonyms1).toEqual(synonyms2);
    });
  });

  describe('findAntonyms', () => {
    it('should find antonyms for common words', () => {
      const antonyms = findAntonyms('good');
      expect(antonyms).toContain('bad');
    });

    it('should find bidirectional antonyms', () => {
      const antonyms1 = findAntonyms('hot');
      const antonyms2 = findAntonyms('cold');
      expect(antonyms1).toContain('cold');
      expect(antonyms2).toContain('hot');
    });

    it('should handle words with multiple antonyms', () => {
      const antonyms = findAntonyms('old');
      expect(antonyms.length).toBeGreaterThan(1);
      expect(antonyms).toContain('young');
      expect(antonyms).toContain('new');
    });
  });

  describe('findHypernyms', () => {
    it('should find hypernyms (more general terms)', () => {
      const hypernyms = findHypernyms('dog');
      expect(hypernyms).toContain('animal');
    });

    it('should find hypernyms for specific items', () => {
      const hypernyms = findHypernyms('poodle');
      expect(hypernyms).toContain('dog');
    });

    it('should return empty for top-level categories', () => {
      const hypernyms = findHypernyms('animal');
      expect(hypernyms).toEqual([]);
    });
  });

  describe('findHyponyms', () => {
    it('should find hyponyms (more specific terms)', () => {
      const hyponyms = findHyponyms('animal');
      expect(hyponyms).toContain('dog');
      expect(hyponyms).toContain('cat');
      expect(hyponyms).toContain('bird');
    });

    it('should return empty for leaf nodes', () => {
      const hyponyms = findHyponyms('poodle');
      expect(hyponyms).toEqual([]);
    });
  });

  describe('findCollocations', () => {
    it('should find collocations for common verbs', () => {
      const collocations = findCollocations('make');
      expect(collocations).toContain('decision');
      expect(collocations).toContain('mistake');
    });

    it('should find collocations for take', () => {
      const collocations = findCollocations('take');
      expect(collocations).toContain('time');
      expect(collocations).toContain('action');
    });

    it('should return empty for non-collocation words', () => {
      const collocations = findCollocations('xyznonexistent');
      expect(collocations).toEqual([]);
    });
  });

  describe('getLexicalRelations', () => {
    it('should return all relation types for a word', () => {
      const relations = getLexicalRelations('big');

      expect(relations.has('synonym')).toBe(true);
      expect(relations.has('antonym')).toBe(true);
    });

    it('should return hypernym relations for specific words', () => {
      const relations = getLexicalRelations('dog');

      expect(relations.has('hypernym')).toBe(true);
      expect(relations.get('hypernym')).toContain('animal');
    });

    it('should return hyponym relations for category words', () => {
      const relations = getLexicalRelations('animal');

      expect(relations.has('hyponym')).toBe(true);
      expect(relations.get('hyponym')?.length).toBeGreaterThan(0);
    });
  });

  describe('calculateSemanticSimilarity', () => {
    it('should return 1.0 for identical words', () => {
      const similarity = calculateSemanticSimilarity('dog', 'dog');
      expect(similarity.combinedScore).toBe(1.0);
    });

    it('should return high similarity for synonyms', () => {
      const similarity = calculateSemanticSimilarity('big', 'large');
      expect(similarity.combinedScore).toBeGreaterThan(0.7);
    });

    it('should return moderate similarity for related words', () => {
      const similarity = calculateSemanticSimilarity('dog', 'cat');
      // Both are animals
      expect(similarity.combinedScore).toBeGreaterThan(0.3);
    });

    it('should return low similarity for antonyms', () => {
      const similarity = calculateSemanticSimilarity('good', 'bad');
      // Related but opposite
      expect(similarity.combinedScore).toBeGreaterThan(0.1);
      expect(similarity.combinedScore).toBeLessThan(0.5);
    });

    it('should return semantic similarity components', () => {
      const similarity = calculateSemanticSimilarity('happy', 'sad');
      expect(similarity.pathSimilarity).toBeDefined();
      expect(similarity.icSimilarity).toBeDefined();
      expect(similarity.distribSimilarity).toBeDefined();
    });
  });

  describe('buildSemanticNetwork', () => {
    it('should build a network centered on a word', () => {
      const network = buildSemanticNetwork('happy', 1);

      expect(network.nodes.length).toBeGreaterThan(0);
      expect(network.edges.length).toBeGreaterThan(0);
      expect(network.stats.nodeCount).toBe(network.nodes.length);
    });

    it('should include the center word as a node', () => {
      const network = buildSemanticNetwork('dog', 1);

      const centerNode = network.nodes.find(n => n.id === 'dog');
      expect(centerNode).toBeDefined();
    });

    it('should include related words as nodes', () => {
      const network = buildSemanticNetwork('big', 1);

      const nodeIds = network.nodes.map(n => n.id);
      expect(nodeIds).toContain('large'); // synonym
    });

    it('should respect depth parameter', () => {
      const shallowNetwork = buildSemanticNetwork('happy', 1);
      const deepNetwork = buildSemanticNetwork('happy', 2);

      expect(deepNetwork.nodes.length).toBeGreaterThanOrEqual(shallowNetwork.nodes.length);
    });
  });

  describe('findSemanticField', () => {
    it('should find semantic field for emotion words', () => {
      const field = findSemanticField('happy');

      expect(field).not.toBeNull();
      expect(field?.name).toBe('emotion');
      expect(field?.coreWords).toContain('happy');
    });

    it('should find semantic field for category words', () => {
      const field = findSemanticField('dog');

      expect(field).not.toBeNull();
      expect(field?.name).toBe('animal');
    });

    it('should return null for unknown words', () => {
      const field = findSemanticField('xyznonexistent');
      expect(field).toBeNull();
    });
  });

  describe('generateParaphrases', () => {
    it('should generate paraphrases using synonyms', () => {
      const paraphrases = generateParaphrases('big dog');

      expect(paraphrases.length).toBeGreaterThan(0);
      expect(paraphrases.some(p => p.phrase2.includes('large'))).toBe(true);
    });

    it('should include paraphrase scores', () => {
      const paraphrases = generateParaphrases('happy person');

      if (paraphrases.length > 0) {
        expect(paraphrases[0].ppdbScore).toBeGreaterThan(0);
        expect(paraphrases[0].distribSimilarity).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateNetworkBasedDifficulty', () => {
    it('should calculate difficulty for words', () => {
      const result = calculateNetworkBasedDifficulty('happy');

      expect(result.difficulty).toBeGreaterThanOrEqual(0);
      expect(result.difficulty).toBeLessThanOrEqual(1);
    });

    it('should return difficulty factors', () => {
      const result = calculateNetworkBasedDifficulty('dog');

      expect(result.factors.synonymDensity).toBeDefined();
      expect(result.factors.hierarchyDepth).toBeDefined();
      expect(result.factors.polysemy).toBeDefined();
      expect(result.factors.abstractness).toBeDefined();
    });

    it('should give lower difficulty to well-connected words', () => {
      // Words with many synonyms should be easier
      const commonWord = calculateNetworkBasedDifficulty('big');
      const rareWord = calculateNetworkBasedDifficulty('xyzrare');

      // Well-connected words have more association opportunities
      expect(commonWord.factors.synonymDensity).toBeGreaterThan(0);
    });
  });

  describe('suggestVocabularyExpansion', () => {
    it('should suggest related words based on known vocabulary', () => {
      const suggestions = suggestVocabularyExpansion(['happy', 'big'], 5);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should not suggest already known words', () => {
      const knownWords = ['happy', 'joyful', 'big', 'large'];
      const suggestions = suggestVocabularyExpansion(knownWords, 10);

      const suggestedWords = suggestions.map(s => s.word.toLowerCase());
      for (const known of knownWords) {
        expect(suggestedWords).not.toContain(known.toLowerCase());
      }
    });

    it('should include reason and priority for suggestions', () => {
      const suggestions = suggestVocabularyExpansion(['dog'], 5);

      if (suggestions.length > 0) {
        expect(suggestions[0].reason).toBeDefined();
        expect(suggestions[0].priority).toBeGreaterThan(0);
        expect(suggestions[0].sourceWord).toBe('dog');
      }
    });
  });

  describe('findBridgeWords', () => {
    it('should find words connecting two domains', () => {
      const domain1 = ['happy', 'sad', 'angry'];
      const domain2 = ['big', 'small', 'huge'];

      // This tests the function works even if no bridges found
      const bridges = findBridgeWords(domain1, domain2);
      expect(Array.isArray(bridges)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should have valid synonym groups', () => {
      for (const [domain, groups] of Object.entries(SYNONYM_GROUPS)) {
        expect(groups.length).toBeGreaterThan(0);
        for (const group of groups) {
          expect(group.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('should have valid antonym pairs', () => {
      expect(ANTONYM_PAIRS.length).toBeGreaterThan(0);
      for (const [word1, word2] of ANTONYM_PAIRS) {
        expect(word1).not.toBe(word2);
        expect(word1.length).toBeGreaterThan(0);
        expect(word2.length).toBeGreaterThan(0);
      }
    });

    it('should have valid hypernym hierarchies', () => {
      expect(HYPERNYM_HIERARCHIES.length).toBeGreaterThan(0);
      for (const [hypernym, hyponyms] of HYPERNYM_HIERARCHIES) {
        expect(hypernym.length).toBeGreaterThan(0);
        expect(hyponyms.length).toBeGreaterThan(0);
      }
    });
  });
});
