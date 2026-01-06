/**
 * Quadrature Module Tests
 *
 * Tests for Gauss-Hermite quadrature implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  getGaussHermiteNodes,
  createGaussHermiteRule,
  createUniformRule,
  integrateNormal,
  computeEAP,
  estimateThetaEAPGaussHermite,
  compareQuadratureMethods,
  RECOMMENDED_SETTINGS,
} from '../quadrature';

describe('Quadrature Module', () => {
  describe('getGaussHermiteNodes', () => {
    it('should return 5 nodes for n <= 5', () => {
      const nodes = getGaussHermiteNodes(3);
      expect(nodes.length).toBe(5);
    });

    it('should return 11 nodes for n <= 11', () => {
      const nodes = getGaussHermiteNodes(10);
      expect(nodes.length).toBe(11);
    });

    it('should return 21 nodes for n <= 21', () => {
      const nodes = getGaussHermiteNodes(15);
      expect(nodes.length).toBe(21);
    });

    it('should return 41 nodes for n > 21', () => {
      const nodes = getGaussHermiteNodes(30);
      expect(nodes.length).toBe(41);
    });

    it('should have symmetric nodes around zero', () => {
      const nodes = getGaussHermiteNodes(11);

      // Check symmetry (nodes come in pairs)
      for (let i = 0; i < Math.floor(nodes.length / 2); i++) {
        expect(nodes[i].x).toBeCloseTo(-nodes[nodes.length - 1 - i].x, 10);
        expect(nodes[i].w).toBeCloseTo(nodes[nodes.length - 1 - i].w, 10);
      }
    });
  });

  describe('createGaussHermiteRule', () => {
    it('should create a valid rule with correct properties', () => {
      const rule = createGaussHermiteRule(21);

      expect(rule.type).toBe('gauss-hermite');
      expect(rule.n).toBe(21);
      expect(rule.nodes.length).toBe(21);
    });

    it('should default to 21 points', () => {
      const rule = createGaussHermiteRule();

      expect(rule.n).toBe(21);
    });
  });

  describe('createUniformRule', () => {
    it('should create correct number of points', () => {
      const rule = createUniformRule(41);

      expect(rule.type).toBe('uniform');
      expect(rule.n).toBe(41);
      expect(rule.nodes.length).toBe(41);
    });

    it('should span the specified range', () => {
      const rule = createUniformRule(5, [-2, 2]);

      expect(rule.nodes[0].x).toBeCloseTo(-2, 10);
      expect(rule.nodes[4].x).toBeCloseTo(2, 10);
    });

    it('should have equal weights', () => {
      const rule = createUniformRule(10);

      const firstWeight = rule.nodes[0].w;
      for (const node of rule.nodes) {
        expect(node.w).toBeCloseTo(firstWeight, 10);
      }
    });
  });

  describe('integrateNormal', () => {
    it('should integrate constant function correctly', () => {
      // Integral of 1 over normal distribution should be 1
      const result = integrateNormal(() => 1, 0, 1);

      expect(result).toBeCloseTo(1, 2);
    });

    it('should compute mean of x correctly', () => {
      // E[X] for X ~ N(0, 1) should be 0
      const result = integrateNormal((x) => x, 0, 1);

      expect(result).toBeCloseTo(0, 2);
    });

    it('should compute variance correctly', () => {
      // E[X^2] for X ~ N(0, 1) should be 1
      const result = integrateNormal((x) => x * x, 0, 1);

      expect(result).toBeCloseTo(1, 2);
    });

    it('should handle non-standard normal distributions', () => {
      // E[X] for X ~ N(5, 2) should be 5
      const result = integrateNormal((x) => x, 5, 2);

      expect(result).toBeCloseTo(5, 1);
    });
  });

  describe('computeEAP', () => {
    it('should return prior when likelihood is flat', () => {
      const result = computeEAP(() => 1, 0, 1);

      expect(result.mean).toBeCloseTo(0, 1);
      expect(result.sd).toBeGreaterThan(0);
    });

    it('should shift toward high-likelihood regions', () => {
      // Likelihood peaks at theta = 1
      const result = computeEAP(
        (theta) => Math.exp(-Math.pow(theta - 1, 2)),
        0, // Prior mean at 0
        1
      );

      // Posterior mean should be between 0 and 1
      expect(result.mean).toBeGreaterThan(0);
      expect(result.mean).toBeLessThan(1);
    });

    it('should have smaller SD when likelihood is concentrated', () => {
      // Diffuse likelihood
      const diffuse = computeEAP(
        (theta) => Math.exp(-Math.pow(theta - 1, 2) / 4),
        0, 1
      );

      // Concentrated likelihood
      const concentrated = computeEAP(
        (theta) => Math.exp(-Math.pow(theta - 1, 2) / 0.25),
        0, 1
      );

      expect(concentrated.sd).toBeLessThan(diffuse.sd);
    });

    it('should return prior for zero likelihood', () => {
      const result = computeEAP(() => 0, 0, 1);

      expect(result.mean).toBe(0);
      expect(result.sd).toBe(1);
    });
  });

  describe('estimateThetaEAPGaussHermite', () => {
    it('should estimate theta near prior for no responses', () => {
      const result = estimateThetaEAPGaussHermite([], [], 0, 1);

      expect(result.theta).toBeCloseTo(0, 1);
    });

    it('should estimate higher theta for all correct responses', () => {
      const responses = [true, true, true, true, true];
      const items = responses.map((_, i) => ({
        a: 1.0,
        b: i - 2, // Difficulties: -2, -1, 0, 1, 2
      }));

      const result = estimateThetaEAPGaussHermite(responses, items, 0, 1);

      expect(result.theta).toBeGreaterThan(0);
    });

    it('should estimate lower theta for all incorrect responses', () => {
      const responses = [false, false, false, false, false];
      const items = responses.map((_, i) => ({
        a: 1.0,
        b: i - 2,
      }));

      const result = estimateThetaEAPGaussHermite(responses, items, 0, 1);

      expect(result.theta).toBeLessThan(0);
    });

    it('should estimate theta near item difficulty for 50% correct', () => {
      const responses = [true, true, false, false];
      const items = [
        { a: 1.0, b: 0 },
        { a: 1.0, b: 0 },
        { a: 1.0, b: 0 },
        { a: 1.0, b: 0 },
      ];

      const result = estimateThetaEAPGaussHermite(responses, items, 0, 1);

      // Should be near 0 (the item difficulty)
      expect(Math.abs(result.theta)).toBeLessThan(0.5);
    });

    it('should handle guessing parameter', () => {
      // With guessing, low-ability examinees can still get items right
      const responses = [true, true, true];
      const itemsWithGuessing = [
        { a: 1.0, b: 2, c: 0.25 },
        { a: 1.0, b: 2, c: 0.25 },
        { a: 1.0, b: 2, c: 0.25 },
      ];

      const withGuessing = estimateThetaEAPGaussHermite(
        responses,
        itemsWithGuessing,
        0, 1
      );

      const itemsWithoutGuessing = [
        { a: 1.0, b: 2 },
        { a: 1.0, b: 2 },
        { a: 1.0, b: 2 },
      ];

      const withoutGuessing = estimateThetaEAPGaussHermite(
        responses,
        itemsWithoutGuessing,
        0, 1
      );

      // With guessing accounted for, theta estimate should be lower
      expect(withGuessing.theta).toBeLessThan(withoutGuessing.theta);
    });
  });

  describe('compareQuadratureMethods', () => {
    it('should return results for all methods', () => {
      const likelihood = (theta: number) => Math.exp(-theta * theta / 2);

      const results = compareQuadratureMethods(likelihood);

      expect(results['gauss-hermite-11']).toBeDefined();
      expect(results['gauss-hermite-21']).toBeDefined();
      expect(results['gauss-hermite-41']).toBeDefined();
      expect(results['uniform-41']).toBeDefined();
    });

    it('should produce similar results across methods for simple cases', () => {
      const likelihood = (theta: number) => Math.exp(-theta * theta / 2);

      const results = compareQuadratureMethods(likelihood, 0, 1);

      // All methods should agree on mean
      expect(results['gauss-hermite-21'].mean).toBeCloseTo(
        results['gauss-hermite-41'].mean,
        1
      );
    });
  });

  describe('RECOMMENDED_SETTINGS', () => {
    it('should have settings for all use cases', () => {
      expect(RECOMMENDED_SETTINGS.fast).toBeDefined();
      expect(RECOMMENDED_SETTINGS.standard).toBeDefined();
      expect(RECOMMENDED_SETTINGS.precise).toBeDefined();
    });

    it('should have increasing point counts', () => {
      expect(RECOMMENDED_SETTINGS.fast.points).toBeLessThan(
        RECOMMENDED_SETTINGS.standard.points
      );
      expect(RECOMMENDED_SETTINGS.standard.points).toBeLessThan(
        RECOMMENDED_SETTINGS.precise.points
      );
    });
  });
});
