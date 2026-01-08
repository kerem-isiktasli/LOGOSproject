/**
 * Task Constraint Solver
 *
 * Solves constraints to select appropriate language objects for tasks.
 * Matches objects to task requirements based on difficulty, component,
 * mastery state, and pedagogical constraints.
 *
 * From GAPS-AND-CONNECTIONS.md Gap 4.6
 */

import type { LanguageObject, ComponentType, MasteryStage } from '../types';
import type { TraditionalTaskType, TraditionalTaskTypeMeta } from './traditional-task-types';
import { TRADITIONAL_TASK_TYPES } from './traditional-task-types';
import type { PedagogicalIntent, DifficultyConstraints } from '../content/pedagogical-intent';

// =============================================================================
// Types
// =============================================================================

/**
 * Constraints for object selection.
 */
export interface ObjectSelectionConstraints {
  /** Target task type */
  taskType: TraditionalTaskType;

  /** Pedagogical intent */
  intent: PedagogicalIntent;

  /** Difficulty requirements */
  difficulty: DifficultyConstraints;

  /** Required component focus */
  componentFocus?: ComponentType;

  /** Required mastery stage range */
  masteryRange?: [MasteryStage, MasteryStage];

  /** Required domains */
  domains?: string[];

  /** Required collocations (must include objects that collocate) */
  requireCollocations?: boolean;

  /** Minimum PMI for collocations */
  minPMI?: number;

  /** Exclude these object IDs */
  excludeIds?: string[];

  /** Maximum number of objects to select */
  maxObjects?: number;

  /** Minimum number of objects required */
  minObjects?: number;

  /** Prefer recently seen objects? */
  preferRecent?: boolean;

  /** Prefer objects needing review? */
  preferDue?: boolean;
}

/**
 * Object with computed scores.
 */
export interface ScoredObject {
  /** The language object */
  object: LanguageObject;

  /** Overall suitability score (0-100) */
  score: number;

  /** Individual score components */
  components: {
    difficultyFit: number;
    componentMatch: number;
    masteryFit: number;
    domainFit: number;
    recencyScore: number;
    dueScore: number;
  };

  /** Reasons for score */
  reasons: string[];
}

/**
 * Selection result with metadata.
 */
export interface SelectionResult {
  /** Selected objects in priority order */
  selected: ScoredObject[];

  /** Objects that didn't meet constraints */
  rejected: { object: LanguageObject; reason: string }[];

  /** Selection metadata */
  metadata: {
    totalCandidates: number;
    totalSelected: number;
    averageScore: number;
    constraintsSatisfied: boolean;
    missingConstraints: string[];
  };
}

/**
 * Collocation pair for related object selection.
 */
export interface CollocationPair {
  object1Id: string;
  object2Id: string;
  pmi: number;
  frequency: number;
}

// =============================================================================
// Task Constraint Solver Class
// =============================================================================

/**
 * Solves constraints to select appropriate objects for tasks.
 */
export class TaskConstraintSolver {
  private collocations: Map<string, CollocationPair[]>;

  constructor() {
    this.collocations = new Map();
  }

  /**
   * Select objects that satisfy constraints.
   */
  solve(
    candidates: LanguageObject[],
    constraints: ObjectSelectionConstraints,
    masteryStates?: Map<string, { stage: MasteryStage; nextReview?: Date }>
  ): SelectionResult {
    const taskMeta = TRADITIONAL_TASK_TYPES[constraints.taskType];
    const rejected: { object: LanguageObject; reason: string }[] = [];
    const scored: ScoredObject[] = [];

    // Filter and score candidates
    for (const object of candidates) {
      // Check exclusions
      if (constraints.excludeIds?.includes(object.id)) {
        rejected.push({ object, reason: 'Excluded by ID' });
        continue;
      }

      // Get mastery state if available
      const mastery = masteryStates?.get(object.id);

      // Check hard constraints
      const hardCheck = this.checkHardConstraints(object, constraints, taskMeta, mastery?.stage);
      if (!hardCheck.passes) {
        rejected.push({ object, reason: hardCheck.reason });
        continue;
      }

      // Score the object
      const scoredObject = this.scoreObject(object, constraints, taskMeta, mastery);
      scored.push(scoredObject);
    }

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Apply quantity constraints
    const maxObjects = constraints.maxObjects || taskMeta.typicalItemCount;
    const minObjects = constraints.minObjects || 1;

    let selected = scored.slice(0, maxObjects);

    // Check if we have enough
    const constraintsSatisfied = selected.length >= minObjects;
    const missingConstraints: string[] = [];

    if (selected.length < minObjects) {
      missingConstraints.push(`Need ${minObjects} objects, only found ${selected.length}`);
    }

    // If requiring collocations, ensure we have pairs
    if (constraints.requireCollocations && selected.length >= 2) {
      selected = this.ensureCollocations(selected, constraints.minPMI || 2.0);
    }

    // Calculate average score
    const averageScore = selected.length > 0
      ? selected.reduce((sum, s) => sum + s.score, 0) / selected.length
      : 0;

    return {
      selected,
      rejected,
      metadata: {
        totalCandidates: candidates.length,
        totalSelected: selected.length,
        averageScore,
        constraintsSatisfied,
        missingConstraints,
      },
    };
  }

  /**
   * Check hard constraints that must be satisfied.
   */
  private checkHardConstraints(
    object: LanguageObject,
    constraints: ObjectSelectionConstraints,
    taskMeta: TraditionalTaskTypeMeta,
    masteryStage?: MasteryStage
  ): { passes: boolean; reason: string } {
    // Mastery range check
    if (masteryStage !== undefined) {
      const [minStage, maxStage] = constraints.masteryRange || taskMeta.masteryRange;
      if (masteryStage < minStage) {
        return { passes: false, reason: `Mastery stage ${masteryStage} below minimum ${minStage}` };
      }
      if (masteryStage > maxStage) {
        return { passes: false, reason: `Mastery stage ${masteryStage} above maximum ${maxStage}` };
      }
    }

    // Component check (if specified)
    if (constraints.componentFocus) {
      // Check if object exercises the required component
      // This would need more sophisticated component analysis
      // For now, we allow all objects
    }

    // Domain check
    if (constraints.domains && constraints.domains.length > 0) {
      const objectDomains = object.domainDistribution
        ? Object.keys(object.domainDistribution)
        : ['general'];

      const hasMatchingDomain = constraints.domains.some(d => objectDomains.includes(d));
      if (!hasMatchingDomain) {
        return { passes: false, reason: `No matching domain (needs: ${constraints.domains.join(', ')})` };
      }
    }

    return { passes: true, reason: '' };
  }

  /**
   * Score an object based on soft constraints.
   */
  private scoreObject(
    object: LanguageObject,
    constraints: ObjectSelectionConstraints,
    taskMeta: TraditionalTaskTypeMeta,
    mastery?: { stage: MasteryStage; nextReview?: Date }
  ): ScoredObject {
    const scores = {
      difficultyFit: 0,
      componentMatch: 0,
      masteryFit: 0,
      domainFit: 0,
      recencyScore: 0,
      dueScore: 0,
    };
    const reasons: string[] = [];

    // Difficulty fit (0-25 points)
    const objectDifficulty = this.estimateObjectDifficulty(object);
    const targetDifficulty = (constraints.difficulty.minDifficulty + constraints.difficulty.maxDifficulty) / 2;
    const difficultyDiff = Math.abs(objectDifficulty - targetDifficulty);

    if (difficultyDiff <= constraints.difficulty.tolerance) {
      scores.difficultyFit = 25;
      reasons.push('Difficulty matches target');
    } else if (difficultyDiff <= constraints.difficulty.tolerance * 2) {
      scores.difficultyFit = 15;
      reasons.push('Difficulty close to target');
    } else {
      scores.difficultyFit = 5;
      reasons.push('Difficulty outside target range');
    }

    // Component match (0-20 points)
    if (constraints.componentFocus) {
      const componentMatch = this.checkComponentMatch(object, constraints.componentFocus);
      scores.componentMatch = componentMatch ? 20 : 5;
      if (componentMatch) reasons.push(`Matches ${constraints.componentFocus} focus`);
    } else {
      scores.componentMatch = 15; // Neutral if no specific component required
    }

    // Mastery fit (0-25 points)
    if (mastery) {
      const [minStage, maxStage] = taskMeta.masteryRange;
      const optimalStage = Math.floor((minStage + maxStage) / 2);

      if (mastery.stage === optimalStage) {
        scores.masteryFit = 25;
        reasons.push('Optimal mastery stage');
      } else if (mastery.stage >= minStage && mastery.stage <= maxStage) {
        scores.masteryFit = 20;
        reasons.push('Mastery stage in range');
      } else {
        scores.masteryFit = 10;
      }
    } else {
      scores.masteryFit = 15; // Neutral if no mastery data
    }

    // Domain fit (0-15 points)
    if (constraints.domains && constraints.domains.length > 0) {
      const domainMatch = this.checkDomainMatch(object, constraints.domains);
      scores.domainFit = domainMatch * 15;
      if (domainMatch > 0.5) reasons.push('Good domain match');
    } else {
      scores.domainFit = 10;
    }

    // Recency score (0-10 points)
    if (constraints.preferRecent) {
      // Would need access to exposure history
      scores.recencyScore = 5; // Neutral for now
    } else {
      scores.recencyScore = 5;
    }

    // Due score (0-5 points)
    if (constraints.preferDue && mastery?.nextReview) {
      const now = new Date();
      if (mastery.nextReview <= now) {
        scores.dueScore = 5;
        reasons.push('Due for review');
      } else {
        scores.dueScore = 2;
      }
    } else {
      scores.dueScore = 3;
    }

    // Calculate total score
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

    return {
      object,
      score: totalScore,
      components: scores,
      reasons,
    };
  }

  /**
   * Estimate object difficulty (0-1).
   */
  private estimateObjectDifficulty(object: LanguageObject): number {
    let difficulty = 0.5; // Base

    // Word length contributes to difficulty
    if (object.content.length > 10) difficulty += 0.1;
    if (object.content.length > 15) difficulty += 0.1;

    // Frequency inversely related to difficulty
    if (object.frequency !== undefined) {
      difficulty -= object.frequency * 0.2; // Higher frequency = easier
    }

    // Phonological difficulty
    if (object.phonologicalDifficulty !== undefined) {
      difficulty += object.phonologicalDifficulty * 0.2;
    }

    // Morphological complexity
    if (object.morphologicalScore !== undefined) {
      difficulty += (1 - object.morphologicalScore) * 0.1;
    }

    return Math.max(0, Math.min(1, difficulty));
  }

  /**
   * Check if object matches component focus.
   */
  private checkComponentMatch(object: LanguageObject, component: ComponentType): boolean {
    // Simplified check - in production, would analyze object properties
    switch (component) {
      case 'phonological':
        return object.phonologicalDifficulty !== undefined && object.phonologicalDifficulty > 0.3;
      case 'morphological':
        return object.morphologicalScore !== undefined && object.morphologicalScore < 0.8;
      case 'lexical':
        return true; // All objects have lexical component
      case 'syntactic':
        return object.content.includes(' '); // Multi-word likely has syntactic component
      case 'pragmatic':
        return object.domainDistribution !== undefined;
      default:
        return true;
    }
  }

  /**
   * Check domain match score (0-1).
   */
  private checkDomainMatch(object: LanguageObject, requiredDomains: string[]): number {
    if (!object.domainDistribution) {
      return requiredDomains.includes('general') ? 0.5 : 0;
    }

    // Parse domainDistribution if it's a JSON string
    const distribution: Record<string, number> = typeof object.domainDistribution === 'string'
      ? JSON.parse(object.domainDistribution)
      : object.domainDistribution;

    let totalMatch = 0;
    for (const domain of requiredDomains) {
      const weight = distribution[domain] || 0;
      totalMatch += weight;
    }

    return Math.min(1, totalMatch);
  }

  /**
   * Ensure selected objects include collocating pairs.
   */
  private ensureCollocations(
    selected: ScoredObject[],
    minPMI: number
  ): ScoredObject[] {
    // Check for collocations among selected
    const hasCollocations = this.findCollocationsInSet(
      selected.map(s => s.object.id),
      minPMI
    );

    if (hasCollocations.length > 0) {
      return selected; // Already has collocations
    }

    // Would need to reorder or substitute to ensure collocations
    // For now, return as-is
    return selected;
  }

  /**
   * Find collocation pairs within a set of object IDs.
   */
  private findCollocationsInSet(objectIds: string[], minPMI: number): CollocationPair[] {
    const result: CollocationPair[] = [];

    for (const id of objectIds) {
      const pairs = this.collocations.get(id) || [];
      for (const pair of pairs) {
        if (pair.pmi >= minPMI && objectIds.includes(pair.object2Id)) {
          result.push(pair);
        }
      }
    }

    return result;
  }

  /**
   * Load collocation data.
   */
  loadCollocations(pairs: CollocationPair[]): void {
    this.collocations.clear();

    for (const pair of pairs) {
      // Index by object1Id
      if (!this.collocations.has(pair.object1Id)) {
        this.collocations.set(pair.object1Id, []);
      }
      this.collocations.get(pair.object1Id)!.push(pair);

      // Also index by object2Id for bidirectional lookup
      if (!this.collocations.has(pair.object2Id)) {
        this.collocations.set(pair.object2Id, []);
      }
      this.collocations.get(pair.object2Id)!.push({
        ...pair,
        object1Id: pair.object2Id,
        object2Id: pair.object1Id,
      });
    }
  }

  /**
   * Get collocations for an object.
   */
  getCollocations(objectId: string, minPMI: number = 0): CollocationPair[] {
    const pairs = this.collocations.get(objectId) || [];
    return pairs.filter(p => p.pmi >= minPMI);
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a constraint solver instance.
 */
export function createConstraintSolver(): TaskConstraintSolver {
  return new TaskConstraintSolver();
}

/**
 * Quick selection helper.
 */
export function selectObjectsForTask(
  candidates: LanguageObject[],
  taskType: TraditionalTaskType,
  intent: PedagogicalIntent,
  options: Partial<ObjectSelectionConstraints> = {}
): SelectionResult {
  const solver = createConstraintSolver();

  const constraints: ObjectSelectionConstraints = {
    taskType,
    intent,
    difficulty: {
      minDifficulty: 0.3,
      maxDifficulty: 0.7,
      targetTheta: 0,
      tolerance: 0.2,
    },
    ...options,
  };

  return solver.solve(candidates, constraints);
}
