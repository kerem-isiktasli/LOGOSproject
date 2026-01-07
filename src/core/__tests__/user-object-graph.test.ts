/**
 * User-Object Relationship Graph Module Unit Tests
 *
 * Tests for encounter tracking, relationship statistics,
 * and visualization data generation.
 *
 * Based on:
 * - DKT (Piech et al., 2015)
 * - DyGKT (2024)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyTaskCategory,
  createEncounter,
  calculateInterpretationProductionRatio,
  calculateModalityBalance,
  calculateSuccessRate,
  calculateRetrievalFluency,
  calculateKnowledgeStrength,
  estimateLearningCost,
  calculateDerivedEffect,
  buildRelationshipStats,
  buildRelationshipProfile,
  generateVisualizationData,
  updateStatsWithEncounter,
  type ObjectEncounter,
  type EncounterContext,
  type EncounterOutcome,
  type ObjectRelationshipStats,
} from '../user-object-graph';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestEncounter(
  overrides: Partial<{
    taskCategory: 'interpretation' | 'production';
    taskType: 'recognition' | 'recall_cued' | 'recall_free' | 'production' | 'timed';
    modality: 'visual' | 'auditory' | 'mixed';
    domain: string;
    successful: boolean;
    responseTimeMs: number;
    cueLevel: number;
  }> = {}
): ObjectEncounter {
  const context: EncounterContext = {
    taskCategory: overrides.taskCategory || 'interpretation',
    taskType: overrides.taskType || 'recognition',
    taskFormat: 'mcq',
    modality: overrides.modality || 'visual',
    domain: overrides.domain || 'general',
    userTheta: 0,
    itemDifficulty: 0,
  };

  const outcome: EncounterOutcome = {
    successful: overrides.successful ?? true,
    responseTimeMs: overrides.responseTimeMs ?? 1500,
    cueLevel: overrides.cueLevel ?? 0,
  };

  return createEncounter('obj-1', 'user-1', context, outcome);
}

function createTestStats(
  overrides: Partial<ObjectRelationshipStats> = {}
): ObjectRelationshipStats {
  return {
    objectId: 'obj-1',
    userId: 'user-1',
    updatedAt: new Date(),
    totalEncounters: 10,
    interpretationEncounters: 5,
    productionEncounters: 5,
    visualEncounters: 4,
    auditoryEncounters: 3,
    mixedEncounters: 3,
    overallSuccessRate: 0.7,
    interpretationSuccessRate: 0.8,
    productionSuccessRate: 0.6,
    visualSuccessRate: 0.75,
    auditorySuccessRate: 0.67,
    mixedSuccessRate: 0.67,
    interpretationRatio: 0.5,
    modalityBalance: 0.95,
    domainExposure: { general: 10 },
    estimatedLearningCost: 0.5,
    derivedEffectScore: 0.3,
    lastEncounter: new Date(),
    avgInterEncounterDays: 2,
    knowledgeStrength: 0.6,
    retrievalFluency: 0.7,
    ...overrides,
  };
}

// ============================================================================
// Task Category Classification Tests
// ============================================================================

describe('classifyTaskCategory', () => {
  describe('interpretation tasks', () => {
    it('classifies recognition as interpretation', () => {
      expect(classifyTaskCategory('recognition')).toBe('interpretation');
    });

    it('classifies definition_match as interpretation', () => {
      expect(classifyTaskCategory('definition_match')).toBe('interpretation');
    });

    it('classifies synonym_match as interpretation', () => {
      expect(classifyTaskCategory('synonym_match')).toBe('interpretation');
    });

    it('classifies listening_comprehension as interpretation', () => {
      expect(classifyTaskCategory('listening_comprehension')).toBe('interpretation');
    });

    it('classifies reading_comprehension as interpretation', () => {
      expect(classifyTaskCategory('reading_comprehension')).toBe('interpretation');
    });
  });

  describe('production tasks', () => {
    it('classifies recall_free as production', () => {
      expect(classifyTaskCategory('recall_free')).toBe('production');
    });

    it('classifies recall_cued as production', () => {
      expect(classifyTaskCategory('recall_cued')).toBe('production');
    });

    it('classifies production as production', () => {
      expect(classifyTaskCategory('production')).toBe('production');
    });

    it('classifies translation as production', () => {
      expect(classifyTaskCategory('translation')).toBe('production');
    });

    it('classifies free_response as production', () => {
      expect(classifyTaskCategory('free_response')).toBe('production');
    });

    it('classifies speaking as production', () => {
      expect(classifyTaskCategory('speaking')).toBe('production');
    });

    it('classifies writing as production', () => {
      expect(classifyTaskCategory('writing')).toBe('production');
    });

    it('classifies dictation as production', () => {
      expect(classifyTaskCategory('dictation')).toBe('production');
    });
  });

  describe('unknown tasks', () => {
    it('classifies timed as production', () => {
      expect(classifyTaskCategory('timed')).toBe('production');
    });

    it('defaults recognition-like tasks to interpretation', () => {
      expect(classifyTaskCategory('word_recognition')).toBe('interpretation');
    });

    it('defaults production-like tasks to production', () => {
      expect(classifyTaskCategory('sentence_production')).toBe('production');
    });

    it('defaults unknown tasks to interpretation', () => {
      expect(classifyTaskCategory('unknown_task')).toBe('interpretation');
    });
  });
});

// ============================================================================
// Encounter Creation Tests
// ============================================================================

describe('createEncounter', () => {
  it('creates encounter with correct structure', () => {
    const encounter = createTestEncounter();

    expect(encounter).toHaveProperty('id');
    expect(encounter).toHaveProperty('createdAt');
    expect(encounter.objectId).toBe('obj-1');
    expect(encounter.userId).toBe('user-1');
    expect(encounter.context).toBeDefined();
    expect(encounter.outcome).toBeDefined();
  });

  it('generates unique IDs for each encounter', () => {
    const e1 = createTestEncounter();
    const e2 = createTestEncounter();

    expect(e1.id).not.toBe(e2.id);
  });

  it('sets createdAt to current time', () => {
    const before = new Date();
    const encounter = createTestEncounter();
    const after = new Date();

    expect(encounter.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(encounter.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ============================================================================
// Interpretation/Production Ratio Tests
// ============================================================================

describe('calculateInterpretationProductionRatio', () => {
  it('returns 0.5 for empty array', () => {
    expect(calculateInterpretationProductionRatio([])).toBe(0.5);
  });

  it('returns 1 for all interpretation encounters', () => {
    const encounters = [
      createTestEncounter({ taskCategory: 'interpretation' }),
      createTestEncounter({ taskCategory: 'interpretation' }),
      createTestEncounter({ taskCategory: 'interpretation' }),
    ];

    expect(calculateInterpretationProductionRatio(encounters)).toBe(1);
  });

  it('returns 0 for all production encounters', () => {
    const encounters = [
      createTestEncounter({ taskCategory: 'production' }),
      createTestEncounter({ taskCategory: 'production' }),
      createTestEncounter({ taskCategory: 'production' }),
    ];

    expect(calculateInterpretationProductionRatio(encounters)).toBe(0);
  });

  it('returns correct ratio for mixed encounters', () => {
    const encounters = [
      createTestEncounter({ taskCategory: 'interpretation' }),
      createTestEncounter({ taskCategory: 'interpretation' }),
      createTestEncounter({ taskCategory: 'production' }),
      createTestEncounter({ taskCategory: 'production' }),
    ];

    expect(calculateInterpretationProductionRatio(encounters)).toBe(0.5);
  });
});

// ============================================================================
// Modality Balance Tests
// ============================================================================

describe('calculateModalityBalance', () => {
  it('returns 0 for empty array', () => {
    expect(calculateModalityBalance([])).toBe(0);
  });

  it('returns 0 for single modality', () => {
    const encounters = [
      createTestEncounter({ modality: 'visual' }),
      createTestEncounter({ modality: 'visual' }),
      createTestEncounter({ modality: 'visual' }),
    ];

    expect(calculateModalityBalance(encounters)).toBeCloseTo(0, 5);
  });

  it('returns 1 for perfectly balanced modalities', () => {
    const encounters = [
      createTestEncounter({ modality: 'visual' }),
      createTestEncounter({ modality: 'auditory' }),
      createTestEncounter({ modality: 'mixed' }),
    ];

    expect(calculateModalityBalance(encounters)).toBeCloseTo(1, 5);
  });

  it('returns intermediate value for partially balanced', () => {
    const encounters = [
      createTestEncounter({ modality: 'visual' }),
      createTestEncounter({ modality: 'visual' }),
      createTestEncounter({ modality: 'auditory' }),
    ];

    const balance = calculateModalityBalance(encounters);
    expect(balance).toBeGreaterThan(0);
    expect(balance).toBeLessThan(1);
  });
});

// ============================================================================
// Success Rate Tests
// ============================================================================

describe('calculateSuccessRate', () => {
  it('returns 0 for empty array', () => {
    expect(calculateSuccessRate([])).toBe(0);
  });

  it('returns 1 for all successful', () => {
    const encounters = [
      createTestEncounter({ successful: true }),
      createTestEncounter({ successful: true }),
      createTestEncounter({ successful: true }),
    ];

    expect(calculateSuccessRate(encounters)).toBe(1);
  });

  it('returns 0 for all failed', () => {
    const encounters = [
      createTestEncounter({ successful: false }),
      createTestEncounter({ successful: false }),
      createTestEncounter({ successful: false }),
    ];

    expect(calculateSuccessRate(encounters)).toBe(0);
  });

  it('returns correct rate for mixed results', () => {
    const encounters = [
      createTestEncounter({ successful: true }),
      createTestEncounter({ successful: true }),
      createTestEncounter({ successful: false }),
      createTestEncounter({ successful: false }),
    ];

    expect(calculateSuccessRate(encounters)).toBe(0.5);
  });

  it('applies filter correctly', () => {
    const encounters = [
      createTestEncounter({ successful: true, modality: 'visual' }),
      createTestEncounter({ successful: true, modality: 'visual' }),
      createTestEncounter({ successful: false, modality: 'auditory' }),
    ];

    const visualRate = calculateSuccessRate(
      encounters,
      (e) => e.context.modality === 'visual'
    );

    expect(visualRate).toBe(1);
  });
});

// ============================================================================
// Retrieval Fluency Tests
// ============================================================================

describe('calculateRetrievalFluency', () => {
  it('returns 0 for empty array', () => {
    expect(calculateRetrievalFluency([])).toBe(0);
  });

  it('returns 0 for all failed encounters', () => {
    const encounters = [
      createTestEncounter({ successful: false, responseTimeMs: 1000 }),
      createTestEncounter({ successful: false, responseTimeMs: 1000 }),
    ];

    expect(calculateRetrievalFluency(encounters)).toBe(0);
  });

  it('returns high fluency for fast responses', () => {
    const encounters = [
      createTestEncounter({ successful: true, responseTimeMs: 500 }),
      createTestEncounter({ successful: true, responseTimeMs: 500 }),
    ];

    const fluency = calculateRetrievalFluency(encounters);
    expect(fluency).toBeGreaterThan(0.7);
  });

  it('returns low fluency for slow responses', () => {
    const encounters = [
      createTestEncounter({ successful: true, responseTimeMs: 5000 }),
      createTestEncounter({ successful: true, responseTimeMs: 5000 }),
    ];

    const fluency = calculateRetrievalFluency(encounters);
    expect(fluency).toBeLessThan(0.3);
  });

  it('returns ~0.5 for 2000ms responses', () => {
    const encounters = [
      createTestEncounter({ successful: true, responseTimeMs: 2000 }),
      createTestEncounter({ successful: true, responseTimeMs: 2000 }),
    ];

    const fluency = calculateRetrievalFluency(encounters);
    expect(fluency).toBeCloseTo(0.5, 1);
  });
});

// ============================================================================
// Knowledge Strength Tests
// ============================================================================

describe('calculateKnowledgeStrength', () => {
  it('returns higher strength for high success rate', () => {
    const highSuccess = createTestStats({ overallSuccessRate: 0.9 });
    const lowSuccess = createTestStats({ overallSuccessRate: 0.3 });

    expect(calculateKnowledgeStrength(highSuccess)).toBeGreaterThan(
      calculateKnowledgeStrength(lowSuccess)
    );
  });

  it('returns higher strength for better fluency', () => {
    const highFluency = createTestStats({ retrievalFluency: 0.9 });
    const lowFluency = createTestStats({ retrievalFluency: 0.3 });

    expect(calculateKnowledgeStrength(highFluency)).toBeGreaterThan(
      calculateKnowledgeStrength(lowFluency)
    );
  });

  it('returns higher strength for balanced modality', () => {
    const balanced = createTestStats({ modalityBalance: 0.9 });
    const unbalanced = createTestStats({ modalityBalance: 0.1 });

    expect(calculateKnowledgeStrength(balanced)).toBeGreaterThan(
      calculateKnowledgeStrength(unbalanced)
    );
  });

  it('returns higher strength for recent encounters', () => {
    const recent = createTestStats({ lastEncounter: new Date() });
    const old = createTestStats({
      lastEncounter: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });

    expect(calculateKnowledgeStrength(recent)).toBeGreaterThan(
      calculateKnowledgeStrength(old)
    );
  });

  it('returns 0 for null lastEncounter (partial strength)', () => {
    const noEncounter = createTestStats({ lastEncounter: null });
    const strength = calculateKnowledgeStrength(noEncounter);

    // Should still have some strength from other factors
    expect(strength).toBeGreaterThan(0);
    expect(strength).toBeLessThan(1);
  });
});

// ============================================================================
// Learning Cost Estimation Tests
// ============================================================================

describe('estimateLearningCost', () => {
  it('returns higher cost for difficult items', () => {
    const stats = createTestStats();

    const easyCost = estimateLearningCost(stats, -2); // Easy item
    const hardCost = estimateLearningCost(stats, 2);  // Hard item

    expect(hardCost).toBeGreaterThan(easyCost);
  });

  it('returns higher cost for low success rate', () => {
    const highSuccess = createTestStats({ overallSuccessRate: 0.9 });
    const lowSuccess = createTestStats({ overallSuccessRate: 0.2 });

    const highCost = estimateLearningCost(lowSuccess, 0);
    const lowCost = estimateLearningCost(highSuccess, 0);

    expect(highCost).toBeGreaterThan(lowCost);
  });

  it('returns cost between 0.1 and 1.0', () => {
    const stats = createTestStats();

    const cost1 = estimateLearningCost(stats, -3);
    const cost2 = estimateLearningCost(stats, 3);

    expect(cost1).toBeGreaterThanOrEqual(0.1);
    expect(cost1).toBeLessThanOrEqual(1.0);
    expect(cost2).toBeGreaterThanOrEqual(0.1);
    expect(cost2).toBeLessThanOrEqual(1.0);
  });
});

// ============================================================================
// Derived Effect Tests
// ============================================================================

describe('calculateDerivedEffect', () => {
  it('returns 0 for no related objects', () => {
    expect(calculateDerivedEffect('obj-1', [], {})).toBe(0);
  });

  it('returns higher effect for more transfer', () => {
    const lowTransfer = calculateDerivedEffect('obj-1', ['obj-2'], { 'obj-2': 0.1 });
    const highTransfer = calculateDerivedEffect('obj-1', ['obj-2'], { 'obj-2': 0.5 });

    expect(highTransfer).toBeGreaterThan(lowTransfer);
  });

  it('includes network bonus for more relations', () => {
    const fewRelations = calculateDerivedEffect('obj-1', ['obj-2'], { 'obj-2': 0.3 });
    const manyRelations = calculateDerivedEffect(
      'obj-1',
      ['obj-2', 'obj-3', 'obj-4', 'obj-5'],
      { 'obj-2': 0.3, 'obj-3': 0.3, 'obj-4': 0.3, 'obj-5': 0.3 }
    );

    expect(manyRelations).toBeGreaterThan(fewRelations);
  });

  it('caps at 1.0', () => {
    const maxedEffect = calculateDerivedEffect(
      'obj-1',
      ['obj-2', 'obj-3', 'obj-4'],
      { 'obj-2': 0.9, 'obj-3': 0.9, 'obj-4': 0.9 }
    );

    expect(maxedEffect).toBeLessThanOrEqual(1.0);
  });
});

// ============================================================================
// Build Relationship Stats Tests
// ============================================================================

describe('buildRelationshipStats', () => {
  it('builds correct stats from encounters', () => {
    const encounters = [
      createTestEncounter({ taskCategory: 'interpretation', modality: 'visual', successful: true }),
      createTestEncounter({ taskCategory: 'interpretation', modality: 'auditory', successful: true }),
      createTestEncounter({ taskCategory: 'production', modality: 'visual', successful: false }),
      createTestEncounter({ taskCategory: 'production', modality: 'mixed', successful: true }),
    ];

    const stats = buildRelationshipStats(encounters, 'obj-1', 'user-1');

    expect(stats.totalEncounters).toBe(4);
    expect(stats.interpretationEncounters).toBe(2);
    expect(stats.productionEncounters).toBe(2);
    expect(stats.visualEncounters).toBe(2);
    expect(stats.auditoryEncounters).toBe(1);
    expect(stats.mixedEncounters).toBe(1);
    expect(stats.overallSuccessRate).toBe(0.75);
    expect(stats.interpretationRatio).toBe(0.5);
  });

  it('calculates domain exposure correctly', () => {
    const encounters = [
      createTestEncounter({ domain: 'medical' }),
      createTestEncounter({ domain: 'medical' }),
      createTestEncounter({ domain: 'legal' }),
    ];

    const stats = buildRelationshipStats(encounters, 'obj-1', 'user-1');

    expect(stats.domainExposure.medical).toBe(2);
    expect(stats.domainExposure.legal).toBe(1);
  });

  it('sets lastEncounter to most recent', () => {
    const now = new Date();
    const encounters = [
      createTestEncounter(),
      createTestEncounter(),
    ];
    // First encounter will be older
    encounters[0].createdAt = new Date(now.getTime() - 1000);
    encounters[1].createdAt = now;

    const stats = buildRelationshipStats(encounters, 'obj-1', 'user-1');

    expect(stats.lastEncounter?.getTime()).toBe(now.getTime());
  });

  it('handles empty encounters array', () => {
    const stats = buildRelationshipStats([], 'obj-1', 'user-1');

    expect(stats.totalEncounters).toBe(0);
    expect(stats.overallSuccessRate).toBe(0);
    expect(stats.lastEncounter).toBeNull();
  });
});

// ============================================================================
// Build Relationship Profile Tests
// ============================================================================

describe('buildRelationshipProfile', () => {
  it('recommends production when interpretation heavy', () => {
    const stats = createTestStats({ interpretationRatio: 0.8 });
    const profile = buildRelationshipProfile(stats);

    expect(profile.recommendedTaskCategory).toBe('production');
  });

  it('recommends interpretation when production heavy', () => {
    const stats = createTestStats({ interpretationRatio: 0.2 });
    const profile = buildRelationshipProfile(stats);

    expect(profile.recommendedTaskCategory).toBe('interpretation');
  });

  it('identifies modality gaps', () => {
    const stats = createTestStats({
      totalEncounters: 10,
      visualEncounters: 8,
      auditoryEncounters: 1,
      mixedEncounters: 1,
    });
    const profile = buildRelationshipProfile(stats);

    // Should identify auditory or mixed as gap (both under 20%)
    expect(
      profile.exposureGaps.modality === 'auditory' ||
      profile.exposureGaps.modality === 'mixed'
    ).toBe(true);
  });

  it('identifies category gaps', () => {
    const stats = createTestStats({ interpretationRatio: 0.1 });
    const profile = buildRelationshipProfile(stats);

    expect(profile.exposureGaps.category).toBe('interpretation');
  });
});

// ============================================================================
// Update Stats With Encounter Tests
// ============================================================================

describe('updateStatsWithEncounter', () => {
  it('increments encounter counts', () => {
    const stats = createTestStats({ totalEncounters: 10 });
    const encounter = createTestEncounter({ taskCategory: 'interpretation' });

    const updated = updateStatsWithEncounter(stats, encounter);

    expect(updated.totalEncounters).toBe(11);
    expect(updated.interpretationEncounters).toBe(stats.interpretationEncounters + 1);
  });

  it('updates modality counts', () => {
    const stats = createTestStats({ visualEncounters: 4 });
    const encounter = createTestEncounter({ modality: 'visual' });

    const updated = updateStatsWithEncounter(stats, encounter);

    expect(updated.visualEncounters).toBe(5);
  });

  it('updates domain exposure', () => {
    const stats = createTestStats({ domainExposure: { general: 5 } });
    const encounter = createTestEncounter({ domain: 'medical' });

    const updated = updateStatsWithEncounter(stats, encounter);

    expect(updated.domainExposure.medical).toBe(1);
    expect(updated.domainExposure.general).toBe(5);
  });

  it('updates success rates with running average', () => {
    const stats = createTestStats({
      totalEncounters: 10,
      overallSuccessRate: 0.5,
    });
    const successfulEncounter = createTestEncounter({ successful: true });

    const updated = updateStatsWithEncounter(stats, successfulEncounter);

    // Success rate should increase
    expect(updated.overallSuccessRate).toBeGreaterThan(0.5);
  });

  it('updates lastEncounter', () => {
    const oldDate = new Date(2020, 1, 1);
    const stats = createTestStats({ lastEncounter: oldDate });
    const encounter = createTestEncounter();

    const updated = updateStatsWithEncounter(stats, encounter);

    expect(updated.lastEncounter?.getTime()).toBeGreaterThan(oldDate.getTime());
  });
});

// ============================================================================
// Visualization Data Tests
// ============================================================================

describe('generateVisualizationData', () => {
  it('generates category distribution', () => {
    const stats = createTestStats({
      interpretationEncounters: 6,
      productionEncounters: 4,
    });
    const encounters: ObjectEncounter[] = [];

    const vizData = generateVisualizationData(stats, encounters);

    expect(vizData.categoryDistribution.interpretation).toBe(6);
    expect(vizData.categoryDistribution.production).toBe(4);
  });

  it('generates modality distribution', () => {
    const stats = createTestStats({
      visualEncounters: 5,
      auditoryEncounters: 3,
      mixedEncounters: 2,
    });
    const encounters: ObjectEncounter[] = [];

    const vizData = generateVisualizationData(stats, encounters);

    expect(vizData.modalityDistribution.visual).toBe(5);
    expect(vizData.modalityDistribution.auditory).toBe(3);
    expect(vizData.modalityDistribution.mixed).toBe(2);
  });

  it('generates success rates', () => {
    const stats = createTestStats({
      overallSuccessRate: 0.7,
      interpretationSuccessRate: 0.8,
      productionSuccessRate: 0.6,
    });
    const encounters: ObjectEncounter[] = [];

    const vizData = generateVisualizationData(stats, encounters);

    expect(vizData.successRates.overall).toBe(0.7);
    expect(vizData.successRates.interpretation).toBe(0.8);
    expect(vizData.successRates.production).toBe(0.6);
  });

  it('generates progress timeline from encounters', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const encounters = [
      createTestEncounter({ successful: true }),
      createTestEncounter({ successful: true }),
      createTestEncounter({ successful: false }),
    ];
    encounters[0].createdAt = yesterday;
    encounters[1].createdAt = today;
    encounters[2].createdAt = today;

    const stats = createTestStats();
    const vizData = generateVisualizationData(stats, encounters);

    expect(vizData.progressTimeline.length).toBe(2);
    expect(vizData.progressTimeline[0].encounters).toBe(1); // yesterday
    expect(vizData.progressTimeline[1].encounters).toBe(2); // today
  });

  it('generates strength radar', () => {
    const stats = createTestStats({
      retrievalFluency: 0.8,
      knowledgeStrength: 0.7,
    });
    const encounters: ObjectEncounter[] = [];

    const vizData = generateVisualizationData(stats, encounters);

    expect(vizData.strengthRadar.fluency).toBe(0.8);
    expect(vizData.strengthRadar.retention).toBe(0.7);
  });
});
