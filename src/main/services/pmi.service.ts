/**
 * PMI Service (Pointwise Mutual Information)
 *
 * Provides corpus-based difficulty estimation and collocation analysis.
 * Wraps the pure PMI calculator from core/pmi.ts with goal-specific caching.
 */

import { getPrisma } from '../db/prisma';
import { PMICalculator, pmiToDifficulty, frequencyToDifficulty, type TaskType, type PMIResult } from '../../core/pmi';

// =============================================================================
// Types
// =============================================================================

export interface WordDifficultyResult {
  word: string;
  difficulty: number;        // IRT difficulty (-3 to +3)
  frequency: number;         // Normalized frequency (0-1)
  hasCollocations: boolean;  // Whether PMI data is available
  pmiBasedDifficulty: number | null;  // Difficulty from PMI if available
}

export interface CollocationResult {
  word: string;
  collocations: PMIResult[];
  hubScore: number;          // How connected this word is
}

// =============================================================================
// PMI Calculator Cache
// =============================================================================

const calculatorCache = new Map<string, {
  calculator: PMICalculator;
  lastUpdated: Date;
}>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a PMI calculator for a goal.
 * Builds from language objects if not cached.
 */
async function getCalculatorForGoal(goalId: string): Promise<PMICalculator | null> {
  const cached = calculatorCache.get(goalId);
  const now = new Date();

  // Return cached if still valid
  if (cached && (now.getTime() - cached.lastUpdated.getTime()) < CACHE_TTL_MS) {
    return cached.calculator;
  }

  const db = getPrisma();

  // Get all language objects for this goal to build corpus
  const objects = await db.languageObject.findMany({
    where: { goalId },
    select: { content: true, type: true },
  });

  if (objects.length === 0) {
    return null;
  }

  // Build a corpus from content
  const tokens: string[] = [];
  for (const obj of objects) {
    // Tokenize content (simple whitespace split for now)
    const words = obj.content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    tokens.push(...words);
  }

  if (tokens.length === 0) {
    return null;
  }

  // Create and index PMI calculator
  const calculator = new PMICalculator(5); // Window size 5
  calculator.indexCorpus(tokens);

  // Cache it
  calculatorCache.set(goalId, {
    calculator,
    lastUpdated: now,
  });

  return calculator;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get difficulty estimation for a word based on PMI and frequency.
 */
export async function getWordDifficulty(
  goalId: string,
  word: string,
  taskType: TaskType = 'recall_cued'
): Promise<WordDifficultyResult> {
  const db = getPrisma();

  // Get the language object for frequency
  const object = await db.languageObject.findFirst({
    where: {
      goalId,
      content: { contains: word },
    },
    select: { frequency: true },
  });

  const frequency = object?.frequency ?? 0.5;

  // Try to get PMI-based difficulty
  const calculator = await getCalculatorForGoal(goalId);
  let pmiDifficulty: number | null = null;
  let hasCollocations = false;

  if (calculator) {
    const collocations = calculator.getCollocations(word, 1);
    hasCollocations = collocations.length > 0;

    if (collocations.length > 0) {
      const topCollocation = collocations[0];
      pmiDifficulty = pmiToDifficulty(topCollocation.pmi, topCollocation.npmi, taskType);
    }
  }

  // Use PMI difficulty if available, otherwise fall back to frequency
  const difficulty = pmiDifficulty !== null
    ? pmiDifficulty
    : frequencyToDifficulty(frequency, taskType);

  return {
    word,
    difficulty,
    frequency,
    hasCollocations,
    pmiBasedDifficulty: pmiDifficulty,
  };
}

/**
 * Get collocations for a word from the goal's corpus.
 */
export async function getCollocations(
  goalId: string,
  word: string,
  topK: number = 10
): Promise<CollocationResult> {
  const calculator = await getCalculatorForGoal(goalId);

  if (!calculator) {
    return {
      word,
      collocations: [],
      hubScore: 0,
    };
  }

  const collocations = calculator.getCollocations(word, topK);

  // Hub score is the sum of PMI values (higher = more connected)
  const hubScore = collocations.reduce((sum, c) => sum + Math.max(0, c.pmi), 0);

  return {
    word,
    collocations,
    hubScore,
  };
}

/**
 * Calculate relational density (hub score) for a word.
 * Used in the FRE priority formula.
 */
export async function getRelationalDensity(
  goalId: string,
  word: string
): Promise<number> {
  const result = await getCollocations(goalId, word, 20);

  // Normalize hub score to 0-1 range
  // Typical hub scores range from 0 to ~50 for well-connected words
  return Math.min(1, result.hubScore / 50);
}

/**
 * Update IRT difficulty parameters for language objects in a goal.
 * Should be called after corpus is populated.
 */
export async function updateIRTDifficulties(goalId: string): Promise<number> {
  const db = getPrisma();

  const objects = await db.languageObject.findMany({
    where: { goalId },
    select: { id: true, content: true, type: true, frequency: true },
  });

  if (objects.length === 0) {
    return 0;
  }

  const calculator = await getCalculatorForGoal(goalId);
  let updatedCount = 0;

  for (const obj of objects) {
    // Get difficulty based on PMI if available
    const words = obj.content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const mainWord = words[0];

    let difficulty: number;

    if (calculator && mainWord) {
      const collocations = calculator.getCollocations(mainWord, 1);
      if (collocations.length > 0) {
        const top = collocations[0];
        difficulty = pmiToDifficulty(top.pmi, top.npmi, 'recall_cued');
      } else {
        difficulty = frequencyToDifficulty(obj.frequency, 'recall_cued');
      }
    } else {
      difficulty = frequencyToDifficulty(obj.frequency, 'recall_cued');
    }

    await db.languageObject.update({
      where: { id: obj.id },
      data: { irtDifficulty: difficulty },
    });

    updatedCount++;
  }

  return updatedCount;
}

/**
 * Update relational density for language objects in a goal.
 */
export async function updateRelationalDensities(goalId: string): Promise<number> {
  const db = getPrisma();

  const objects = await db.languageObject.findMany({
    where: { goalId },
    select: { id: true, content: true },
  });

  if (objects.length === 0) {
    return 0;
  }

  let updatedCount = 0;

  for (const obj of objects) {
    const words = obj.content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const mainWord = words[0];

    if (mainWord) {
      const density = await getRelationalDensity(goalId, mainWord);

      await db.languageObject.update({
        where: { id: obj.id },
        data: { relationalDensity: density },
      });

      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Store collocations in the database for fast lookup.
 */
export async function storeCollocations(
  goalId: string,
  minSignificance: number = 3.84 // p < 0.05
): Promise<number> {
  const db = getPrisma();

  // Get all language objects
  const objects = await db.languageObject.findMany({
    where: { goalId },
    select: { id: true, content: true },
  });

  if (objects.length === 0) {
    return 0;
  }

  // Build word to object ID mapping
  const wordToObjectId = new Map<string, string>();
  for (const obj of objects) {
    const mainWord = obj.content.toLowerCase().split(/\s+/)[0];
    if (mainWord) {
      wordToObjectId.set(mainWord, obj.id);
    }
  }

  const calculator = await getCalculatorForGoal(goalId);
  if (!calculator) {
    return 0;
  }

  let storedCount = 0;

  // For each word, get collocations and store
  for (const [word, objectId] of wordToObjectId) {
    const collocations = calculator.getCollocations(word, 20);

    for (const coll of collocations) {
      if (coll.significance < minSignificance) continue;

      const otherWord = coll.word1 === word ? coll.word2 : coll.word1;
      const otherObjectId = wordToObjectId.get(otherWord);

      if (!otherObjectId || otherObjectId === objectId) continue;

      // Upsert collocation (avoid duplicates)
      try {
        await db.collocation.upsert({
          where: {
            word1Id_word2Id: {
              word1Id: objectId < otherObjectId ? objectId : otherObjectId,
              word2Id: objectId < otherObjectId ? otherObjectId : objectId,
            },
          },
          create: {
            word1Id: objectId < otherObjectId ? objectId : otherObjectId,
            word2Id: objectId < otherObjectId ? otherObjectId : objectId,
            pmi: coll.pmi,
            npmi: coll.npmi,
            cooccurrence: coll.cooccurrence,
            significance: coll.significance,
          },
          update: {
            pmi: coll.pmi,
            npmi: coll.npmi,
            cooccurrence: coll.cooccurrence,
            significance: coll.significance,
          },
        });
        storedCount++;
      } catch {
        // Skip if error (likely concurrent insert)
      }
    }
  }

  return storedCount;
}

/**
 * Clear the calculator cache for a goal.
 * Call after corpus changes.
 */
export function clearCalculatorCache(goalId: string): void {
  calculatorCache.delete(goalId);
}

/**
 * Clear all calculator caches.
 */
export function clearAllCalculatorCaches(): void {
  calculatorCache.clear();
}
