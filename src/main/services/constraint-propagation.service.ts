/**
 * Constraint Propagation Service
 *
 * Implements cascading constraint resolution for object selection.
 * When an object is selected for a task slot, this service determines
 * how that selection affects other slots and object choices.
 *
 * Key concepts:
 * - Constraint Graph: Network of relationships between objects/components
 * - Propagation: How one selection cascades to affect others
 * - Hard vs Soft Constraints: Required vs preferred relationships
 *
 * Example cascade:
 *   Select SYNT "passive voice"
 *   → restricts LEX to transitive verbs
 *   → requires MORPH past participle form
 *   → enables specific LEX-PHON mappings
 *   → prefers certain collocations
 */

import { getPrisma } from '../db/prisma';
import type {
  ComponentCode,
  ConstraintType,
  ConstraintEdge,
  ConstraintCondition,
  ConstraintPropagation,
  LinguisticConstraintRule,
  ObjectSlot,
  FilledSlot,
  MasteryStage,
} from '../../core/types';
import { LINGUISTIC_CONSTRAINT_RULES } from '../../core/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Object metadata for constraint checking.
 */
export interface ObjectMetadata {
  id: string;
  type: string;  // LEX, MORPH, SYNT, PRAG, G2P/PHON
  content: string;
  properties: Record<string, unknown>;  // Component-specific properties
}

/**
 * Constraint graph for a goal/domain.
 */
export interface ConstraintGraph {
  /** All constraint edges */
  edges: ConstraintEdge[];

  /** Quick lookup: source -> edges */
  bySource: Map<string, ConstraintEdge[]>;

  /** Quick lookup: target -> edges */
  byTarget: Map<string, ConstraintEdge[]>;

  /** Quick lookup: component pair -> rules */
  byComponentPair: Map<string, LinguisticConstraintRule[]>;
}

/**
 * Propagation context - state during constraint resolution.
 */
interface PropagationContext {
  /** Already processed triggers (prevent cycles) */
  processed: Set<string>;

  /** Current propagation result being built */
  result: ConstraintPropagation;

  /** Available objects for each component */
  availableObjects: Map<ComponentCode, ObjectMetadata[]>;

  /** Current slot assignments */
  currentAssignments: Map<string, FilledSlot>;
}

// =============================================================================
// Constraint Graph Building
// =============================================================================

/**
 * Build constraint graph from database relationships and linguistic rules.
 */
export async function buildConstraintGraph(goalId: string): Promise<ConstraintGraph> {
  const prisma = getPrisma();

  const edges: ConstraintEdge[] = [];

  // 1. Load collocations as 'prefers' constraints
  const collocations = await prisma.collocation.findMany({
    where: {
      word1: { goalId },
    },
    include: {
      word1: true,
      word2: true,
    },
  });

  for (const coll of collocations) {
    // Bidirectional preference
    edges.push({
      sourceId: coll.word1Id,
      targetId: coll.word2Id,
      type: 'prefers',
      strength: normalizeCollocationStrength(coll.npmi || coll.pmi),
    });
    edges.push({
      sourceId: coll.word2Id,
      targetId: coll.word1Id,
      type: 'prefers',
      strength: normalizeCollocationStrength(coll.npmi || coll.pmi),
    });
  }

  // 2. Load morphological families as 'enables' constraints
  // (Would need morphological family data in DB - placeholder)

  // 3. Build lookup indices
  const bySource = new Map<string, ConstraintEdge[]>();
  const byTarget = new Map<string, ConstraintEdge[]>();

  for (const edge of edges) {
    if (!bySource.has(edge.sourceId)) {
      bySource.set(edge.sourceId, []);
    }
    bySource.get(edge.sourceId)!.push(edge);

    if (!byTarget.has(edge.targetId)) {
      byTarget.set(edge.targetId, []);
    }
    byTarget.get(edge.targetId)!.push(edge);
  }

  // 4. Build component pair lookup for linguistic rules
  const byComponentPair = new Map<string, LinguisticConstraintRule[]>();
  for (const rule of LINGUISTIC_CONSTRAINT_RULES) {
    const key = `${rule.sourceComponent}->${rule.targetComponent}`;
    if (!byComponentPair.has(key)) {
      byComponentPair.set(key, []);
    }
    byComponentPair.get(key)!.push(rule);
  }

  return { edges, bySource, byTarget, byComponentPair };
}

/**
 * Normalize collocation strength to 0-1 range.
 */
function normalizeCollocationStrength(score: number): number {
  // NPMI ranges from -1 to 1, PMI typically 0 to ~10
  if (score >= -1 && score <= 1) {
    // Likely NPMI
    return (score + 1) / 2;
  }
  // Likely PMI - sigmoid normalization
  return 1 / (1 + Math.exp(-score + 2));
}

// =============================================================================
// Constraint Propagation
// =============================================================================

/**
 * Propagate constraints from a selection.
 * Returns all effects of selecting an object for a slot.
 */
export function propagateConstraints(
  trigger: { slotId: string; objectId: string; object: ObjectMetadata },
  graph: ConstraintGraph,
  availableObjects: Map<ComponentCode, ObjectMetadata[]>,
  currentAssignments: Map<string, FilledSlot>,
  slots: ObjectSlot[]
): ConstraintPropagation {
  const context: PropagationContext = {
    processed: new Set(),
    result: {
      trigger: { slotId: trigger.slotId, objectId: trigger.objectId },
      required: [],
      excluded: [],
      restrictions: [],
      preferences: [],
      modifications: [],
    },
    availableObjects,
    currentAssignments,
  };

  // Mark trigger as processed
  context.processed.add(trigger.objectId);

  // 1. Apply direct object-to-object constraints
  applyObjectConstraints(trigger.object, graph, context);

  // 2. Apply linguistic rules based on component types
  applyLinguisticRules(trigger.object, graph, context, slots);

  // 3. Recursively propagate from required objects
  propagateFromRequired(graph, context, slots);

  return context.result;
}

/**
 * Apply direct object-to-object constraints from the graph.
 */
function applyObjectConstraints(
  source: ObjectMetadata,
  graph: ConstraintGraph,
  context: PropagationContext
): void {
  const edges = graph.bySource.get(source.id) || [];

  for (const edge of edges) {
    // Skip already processed
    if (context.processed.has(edge.targetId)) continue;

    // Check condition if present
    if (edge.condition && !evaluateCondition(edge.condition, source)) {
      continue;
    }

    switch (edge.type) {
      case 'requires':
        context.result.required.push({
          objectId: edge.targetId,
          reason: `Required by ${source.content}`,
          fromConstraint: `${source.id}->requires->${edge.targetId}`,
        });
        break;

      case 'excludes':
        context.result.excluded.push({
          objectId: edge.targetId,
          reason: `Excluded by ${source.content}`,
          fromConstraint: `${source.id}->excludes->${edge.targetId}`,
        });
        break;

      case 'prefers':
        context.result.preferences.push({
          objectId: edge.targetId,
          adjustment: edge.strength * 0.5,  // Convert strength to value adjustment
          reason: `Preferred with ${source.content} (strength: ${edge.strength.toFixed(2)})`,
        });
        break;

      case 'restricts_to':
        // Find the slot that could contain this target
        // This is handled in applyLinguisticRules for component-level restrictions
        break;

      case 'enables':
        // Mark as available (would need more context about disabled objects)
        break;

      case 'modifies':
        if (edge.modification) {
          context.result.modifications.push({
            objectId: edge.targetId,
            property: edge.modification.property,
            originalValue: undefined,  // Would need to look up
            newValue: edge.modification.newValue,
            reason: edge.modification.reason,
          });
        }
        break;
    }
  }
}

/**
 * Apply linguistic rules based on component relationships.
 */
function applyLinguisticRules(
  source: ObjectMetadata,
  graph: ConstraintGraph,
  context: PropagationContext,
  slots: ObjectSlot[]
): void {
  const sourceComponent = mapTypeToComponent(source.type);

  // Find all rules where this component is the source
  for (const rule of LINGUISTIC_CONSTRAINT_RULES) {
    if (rule.sourceComponent !== sourceComponent) continue;

    // Find slots that accept the target component
    const targetSlots = slots.filter(s =>
      s.acceptedComponents.includes(rule.targetComponent) &&
      !context.currentAssignments.has(s.slotId)
    );

    if (targetSlots.length === 0) continue;

    // Apply the rule based on predicate type
    const restriction = applyLinguisticPredicate(
      source,
      rule,
      context.availableObjects.get(rule.targetComponent) || []
    );

    if (restriction) {
      for (const slot of targetSlots) {
        context.result.restrictions.push({
          slotId: slot.slotId,
          allowedObjectIds: restriction.allowedIds,
          reason: `${rule.name}: ${restriction.reason}`,
        });
      }
    }
  }
}

/**
 * Apply a linguistic predicate to filter target objects.
 */
function applyLinguisticPredicate(
  source: ObjectMetadata,
  rule: LinguisticConstraintRule,
  targetObjects: ObjectMetadata[]
): { allowedIds: string[]; reason: string } | null {
  switch (rule.predicateType) {
    case 'syntactic_agreement':
      return applySyntacticAgreement(source, targetObjects, rule);

    case 'phonological_compatibility':
      return applyPhonologicalCompatibility(source, targetObjects, rule);

    case 'morphological_derivation':
      return applyMorphologicalDerivation(source, targetObjects, rule);

    case 'collocation':
      // Handled by direct object constraints
      return null;

    case 'register_consistency':
      return applyRegisterConsistency(source, targetObjects, rule);

    case 'semantic_coherence':
      // Would need semantic vectors - placeholder
      return null;

    default:
      return null;
  }
}

/**
 * Syntactic agreement predicate.
 * E.g., passive voice requires transitive verbs.
 */
function applySyntacticAgreement(
  source: ObjectMetadata,
  targets: ObjectMetadata[],
  _rule: LinguisticConstraintRule
): { allowedIds: string[]; reason: string } | null {
  const syntacticPattern = source.properties['pattern'] as string | undefined;

  if (!syntacticPattern) return null;

  // Example: passive voice pattern
  if (syntacticPattern.includes('passive') || syntacticPattern.includes('PASSIVE')) {
    // Filter to transitive verbs
    const transitiveVerbs = targets.filter(t => {
      const transitivity = t.properties['transitivity'] as string | undefined;
      return transitivity === 'transitive' || transitivity === 'ditransitive';
    });

    if (transitiveVerbs.length < targets.length) {
      return {
        allowedIds: transitiveVerbs.map(t => t.id),
        reason: 'Passive voice requires transitive verb',
      };
    }
  }

  // Example: subject-verb agreement for number
  if (syntacticPattern.includes('plural_subject')) {
    const pluralForms = targets.filter(t => {
      const number = t.properties['number'] as string | undefined;
      return number === 'plural' || number === 'both';
    });

    if (pluralForms.length < targets.length) {
      return {
        allowedIds: pluralForms.map(t => t.id),
        reason: 'Plural subject requires plural verb form',
      };
    }
  }

  return null;
}

/**
 * Phonological compatibility predicate.
 * E.g., word requires specific G2P patterns.
 */
function applyPhonologicalCompatibility(
  source: ObjectMetadata,
  targets: ObjectMetadata[],
  _rule: LinguisticConstraintRule
): { allowedIds: string[]; reason: string } | null {
  // Get phonological pattern from source word
  const phonPattern = source.properties['phonPattern'] as string | undefined;

  if (!phonPattern) return null;

  // Filter targets to matching G2P patterns
  const compatible = targets.filter(t => {
    const targetPattern = t.properties['pattern'] as string | undefined;
    if (!targetPattern) return true;  // No pattern = compatible
    return targetPattern === phonPattern || phonPattern.includes(targetPattern);
  });

  if (compatible.length < targets.length) {
    return {
      allowedIds: compatible.map(t => t.id),
      reason: `Phonological pattern: ${phonPattern}`,
    };
  }

  return null;
}

/**
 * Morphological derivation predicate.
 * E.g., word family relationships.
 */
function applyMorphologicalDerivation(
  source: ObjectMetadata,
  targets: ObjectMetadata[],
  _rule: LinguisticConstraintRule
): { allowedIds: string[]; reason: string } | null {
  const rootForm = source.properties['root'] as string | undefined;

  if (!rootForm) return null;

  // Find targets with same root
  const sameFamily = targets.filter(t => {
    const targetRoot = t.properties['root'] as string | undefined;
    return targetRoot === rootForm;
  });

  if (sameFamily.length > 0 && sameFamily.length < targets.length) {
    return {
      allowedIds: sameFamily.map(t => t.id),
      reason: `Morphological family: ${rootForm}`,
    };
  }

  return null;
}

/**
 * Register consistency predicate.
 * E.g., formal context requires formal vocabulary.
 */
function applyRegisterConsistency(
  source: ObjectMetadata,
  targets: ObjectMetadata[],
  _rule: LinguisticConstraintRule
): { allowedIds: string[]; reason: string } | null {
  const register = source.properties['register'] as string | undefined;

  if (!register) return null;

  // Filter targets to matching or compatible registers
  const compatible = targets.filter(t => {
    const targetRegister = t.properties['register'] as string | undefined;
    if (!targetRegister) return true;  // No register = neutral
    return isRegisterCompatible(register, targetRegister);
  });

  if (compatible.length < targets.length) {
    return {
      allowedIds: compatible.map(t => t.id),
      reason: `Register: ${register}`,
    };
  }

  return null;
}

/**
 * Check if two registers are compatible.
 */
function isRegisterCompatible(source: string, target: string): boolean {
  const registerHierarchy: Record<string, number> = {
    'frozen': 5,
    'formal': 4,
    'consultative': 3,
    'casual': 2,
    'intimate': 1,
  };

  const sourceLevel = registerHierarchy[source] ?? 3;
  const targetLevel = registerHierarchy[target] ?? 3;

  // Allow same level or adjacent levels
  return Math.abs(sourceLevel - targetLevel) <= 1;
}

/**
 * Recursively propagate from required objects.
 */
function propagateFromRequired(
  graph: ConstraintGraph,
  context: PropagationContext,
  slots: ObjectSlot[]
): void {
  // Get required objects that haven't been processed
  const toProcess = context.result.required.filter(
    r => !context.processed.has(r.objectId)
  );

  for (const required of toProcess) {
    context.processed.add(required.objectId);

    // Find the object metadata
    for (const [_component, objects] of context.availableObjects) {
      const obj = objects.find(o => o.id === required.objectId);
      if (obj) {
        // Recursively apply constraints from this object
        applyObjectConstraints(obj, graph, context);
        applyLinguisticRules(obj, graph, context, slots);
        break;
      }
    }
  }

  // Check for new required objects and recurse
  const newRequired = context.result.required.filter(
    r => !context.processed.has(r.objectId)
  );

  if (newRequired.length > 0) {
    propagateFromRequired(graph, context, slots);
  }
}

/**
 * Evaluate a constraint condition.
 */
function evaluateCondition(
  condition: ConstraintCondition,
  object: ObjectMetadata
): boolean {
  let value: unknown;

  switch (condition.property) {
    case 'componentType':
      value = mapTypeToComponent(object.type);
      break;
    case 'content':
      value = object.content;
      break;
    default:
      value = object.properties[condition.property];
  }

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case 'greater_than':
      return typeof value === 'number' && typeof condition.value === 'number' &&
             value > condition.value;
    case 'less_than':
      return typeof value === 'number' && typeof condition.value === 'number' &&
             value < condition.value;
    default:
      return true;
  }
}

/**
 * Map object type to component code.
 */
function mapTypeToComponent(type: string): ComponentCode {
  const mapping: Record<string, ComponentCode> = {
    'LEX': 'LEX',
    'MORPH': 'MORPH',
    'G2P': 'PHON',
    'PHON': 'PHON',
    'SYNT': 'SYNT',
    'PRAG': 'PRAG',
  };
  return mapping[type] || 'LEX';
}

// =============================================================================
// Constraint Validation
// =============================================================================

/**
 * Validate that a set of assignments satisfies all constraints.
 */
export function validateAssignments(
  assignments: Map<string, FilledSlot>,
  graph: ConstraintGraph
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const [_slotId, slot] of assignments) {
    const edges = graph.bySource.get(slot.objectId) || [];

    for (const edge of edges) {
      if (edge.type === 'requires') {
        // Check if required object is in assignments
        const hasRequired = Array.from(assignments.values()).some(
          s => s.objectId === edge.targetId
        );
        if (!hasRequired) {
          violations.push(
            `${slot.content} requires ${edge.targetId} but it's not included`
          );
        }
      }

      if (edge.type === 'excludes') {
        // Check if excluded object is in assignments
        const hasExcluded = Array.from(assignments.values()).some(
          s => s.objectId === edge.targetId
        );
        if (hasExcluded) {
          violations.push(
            `${slot.content} excludes ${edge.targetId} but both are included`
          );
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// =============================================================================
// Constraint-Aware Selection
// =============================================================================

/**
 * Get adjusted economic values after applying constraint preferences.
 */
export function applyConstraintPreferences(
  baseValues: Map<string, number>,
  propagation: ConstraintPropagation
): Map<string, number> {
  const adjusted = new Map(baseValues);

  // Apply preference adjustments
  for (const pref of propagation.preferences) {
    const current = adjusted.get(pref.objectId) || 0;
    adjusted.set(pref.objectId, current + pref.adjustment);
  }

  // Set excluded objects to -Infinity
  for (const excluded of propagation.excluded) {
    adjusted.set(excluded.objectId, -Infinity);
  }

  return adjusted;
}

/**
 * Filter candidate pool based on restrictions.
 */
export function applyRestrictions(
  candidates: ObjectMetadata[],
  slotId: string,
  propagation: ConstraintPropagation
): ObjectMetadata[] {
  // Find restriction for this slot
  const restriction = propagation.restrictions.find(r => r.slotId === slotId);

  if (!restriction) return candidates;

  // Filter to allowed objects
  return candidates.filter(c => restriction.allowedObjectIds.includes(c.id));
}
