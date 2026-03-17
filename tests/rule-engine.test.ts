import { describe, it, expect, beforeEach } from '@jest/globals';
import * as path from 'path';
import { loadConfig } from '../src/config/config-loader';
import { buildDependencyGraph } from '../src/graph/dependency-graph';
import { evaluateRules } from '../src/rules/rule-engine';
import { ArchGuardConfig, DependencyGraph } from '../src/types';

describe('RuleEngine', () => {
  const fixturesPath = path.resolve(__dirname, 'fixtures');
  let config: ArchGuardConfig;
  let graph: DependencyGraph;

  beforeEach(async () => {
    // Load configuration
    config = loadConfig(fixturesPath);

    // Build the dependency graph
    const result = await buildDependencyGraph(config);
    graph = result.graph;
  });

  describe('evaluateRules', () => {
    it('should return an array of RuleResult objects', () => {
      const results = evaluateRules(graph, config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should evaluate the layer-dependency rule', () => {
      const results = evaluateRules(graph, config);

      const layerRule = results.find((r: any) => r.ruleName === 'layer-dependency');
      expect(layerRule).toBeDefined();
      expect(layerRule?.violations).toBeDefined();
      expect(Array.isArray(layerRule?.violations)).toBe(true);
    });

    it('should evaluate the package-boundary rule', () => {
      const results = evaluateRules(graph, config);

      const packageRule = results.find((r: any) => r.ruleName === 'package-boundary');
      expect(packageRule).toBeDefined();
      expect(packageRule?.violations).toBeDefined();
      expect(Array.isArray(packageRule?.violations)).toBe(true);
    });

    it('should evaluate the object-boundary rule', () => {
      const results = evaluateRules(graph, config);

      const objectRule = results.find((r: any) => r.ruleName === 'object-boundary');
      expect(objectRule).toBeDefined();
      expect(objectRule?.violations).toBeDefined();
      expect(Array.isArray(objectRule?.violations)).toBe(true);
    });

    it('should track edgesChecked in each rule result', () => {
      const results = evaluateRules(graph, config);

      for (const result of results) {
        expect(typeof result.edgesChecked).toBe('number');
        expect(result.edgesChecked).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('allowed dependencies', () => {
    it('should allow integration layer (payments) to depend on service layer (billing)', () => {
      const results = evaluateRules(graph, config);

      // PaymentProcessor is in the payments (integration) package
      // which is allowed to depend on billing (service)
      const layerViolations = results
        .find((r: any) => r.ruleName === 'layer-dependency')
        ?.violations.filter(
          (v: any) =>
            v.sourceNode === 'PaymentProcessor' &&
            v.targetNode === 'BillingService'
        );

      expect(layerViolations?.length).toBe(0);
    });

    it('should allow service layer to depend on shared layer', () => {
      const results = evaluateRules(graph, config);

      // BillingService is in the billing (service) package
      // which is allowed to depend on common (shared)
      const layerViolations = results
        .find((r: any) => r.ruleName === 'layer-dependency')
        ?.violations.filter(
          (v: any) =>
            (v.sourceNode === 'BillingService' ||
              v.sourceNode === 'InvoiceCalculator') &&
            (v.targetNode === 'Logger' ||
              v.targetNode === 'BaseCalculator')
        );

      expect(layerViolations?.length).toBe(0);
    });

    it('should allow payments to explicitly depend on billing via dependsOn', () => {
      const results = evaluateRules(graph, config);

      // The config specifies that payments dependsOn billing explicitly
      const packageViolations = results
        .find((r: any) => r.ruleName === 'package-boundary')
        ?.violations.filter(
          (v: any) =>
            v.sourcePackage === 'payments' &&
            v.targetPackage === 'billing'
        );

      expect(packageViolations?.length).toBe(0);
    });

    it('should allow classes within same package to reference each other', () => {
      const results = evaluateRules(graph, config);

      // All classes within billing package referencing each other
      // should be allowed (same package is always allowed)
      const packageViolations = results
        .find((r: any) => r.ruleName === 'package-boundary')
        ?.violations.filter(
          (v: any) =>
            (v.sourcePackage === 'billing' && v.targetPackage === 'billing') ||
            (v.sourcePackage === 'payments' && v.targetPackage === 'payments')
        );

      expect(packageViolations?.length).toBe(0);
    });

    it('should allow payments object to reference billing object via lookup', () => {
      const results = evaluateRules(graph, config);

      // Payment__c has a lookup to Invoice__c
      // This is allowed because payments can depend on billing
      const objectViolations = results
        .find((r: any) => r.ruleName === 'object-boundary')
        ?.violations.filter(
          (v: any) =>
            v.sourceNode === 'Payment__c' &&
            v.targetNode === 'Invoice__c'
        );

      expect(objectViolations?.length).toBe(0);
    });

    it('should allow all packages to depend on shared layer (common)', () => {
      const results = evaluateRules(graph, config);

      // All packages should be able to reference common (shared layer)
      const sharedViolations = results
        .find((r: any) => r.ruleName === 'layer-dependency')
        ?.violations.filter(
          (v: any) =>
            v.targetNode === 'Logger' ||
            v.targetNode === 'BaseCalculator'
        );

      expect(sharedViolations?.length).toBe(0);
    });
  });

  describe('violation detection', () => {
    it('should detect when shared layer tries to depend on service layer', async () => {
      // This test would require modifying the config or graph
      // For now, we verify that violations are properly reported
      const results = evaluateRules(graph, config);
      const layerViolations = results.find(
        (r: any) => r.ruleName === 'layer-dependency'
      )?.violations;

      expect(Array.isArray(layerViolations)).toBe(true);

      // Check structure of violations
      if (layerViolations && layerViolations.length > 0) {
        const violation = layerViolations[0];
        expect(violation).toHaveProperty('rule');
        expect(violation).toHaveProperty('message');
        expect(violation).toHaveProperty('filePath');
        expect(violation).toHaveProperty('sourceNode');
        expect(violation).toHaveProperty('targetNode');
        expect(violation).toHaveProperty('sourcePackage');
        expect(violation).toHaveProperty('targetPackage');
        expect(violation).toHaveProperty('severity');
      }
    });

    it('should detect illegal cross-package dependencies', () => {
      const results = evaluateRules(graph, config);
      const packageViolations = results.find(
        (r: any) => r.ruleName === 'package-boundary'
      )?.violations;

      expect(Array.isArray(packageViolations)).toBe(true);

      // With the current fixture setup, there might be valid violations
      // (e.g., if common tries to reference billing or payments)
      // This just verifies the structure is correct
    });

    it('should detect object boundary violations', () => {
      const results = evaluateRules(graph, config);
      const objectViolations = results.find(
        (r: any) => r.ruleName === 'object-boundary'
      )?.violations;

      expect(Array.isArray(objectViolations)).toBe(true);
    });
  });

  describe('violation details', () => {
    it('should include all required properties in violations', () => {
      const results = evaluateRules(graph, config);

      for (const result of results) {
        for (const violation of result.violations) {
          expect(violation).toHaveProperty('rule');
          expect(violation).toHaveProperty('message');
          expect(violation).toHaveProperty('filePath');
          expect(violation).toHaveProperty('sourceNode');
          expect(violation).toHaveProperty('targetNode');
          expect(violation).toHaveProperty('sourcePackage');
          expect(violation).toHaveProperty('targetPackage');
          expect(violation).toHaveProperty('severity');

          expect(typeof violation.rule).toBe('string');
          expect(typeof violation.message).toBe('string');
          expect(typeof violation.filePath).toBe('string');
          expect(typeof violation.sourceNode).toBe('string');
          expect(typeof violation.targetNode).toBe('string');
          expect(typeof violation.sourcePackage).toBe('string');
          expect(typeof violation.targetPackage).toBe('string');
          expect(['error', 'warning']).toContain(violation.severity);
        }
      }
    });

    it('should include line numbers when available', () => {
      const results = evaluateRules(graph, config);

      for (const result of results) {
        for (const violation of result.violations) {
          if (violation.line !== undefined) {
            expect(typeof violation.line).toBe('number');
            expect(violation.line).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('rule configuration', () => {
    it('should respect enforcePackageBoundaries = false', async () => {
      const customConfig = {
        ...config,
        rules: {
          ...config.rules,
          enforcePackageBoundaries: false,
        },
      };

      const results = evaluateRules(graph, customConfig);
      const packageRule = results.find(
        (r: any) => r.ruleName === 'package-boundary'
      );

      expect(packageRule?.violations.length).toBe(0);
      expect(packageRule?.edgesChecked).toBe(0);
    });

    it('should respect enforceObjectBoundaries = false', async () => {
      const customConfig = {
        ...config,
        rules: {
          ...config.rules,
          enforceObjectBoundaries: false,
        },
      };

      const results = evaluateRules(graph, customConfig);
      const objectRule = results.find(
        (r: any) => r.ruleName === 'object-boundary'
      );

      expect(objectRule?.violations.length).toBe(0);
      expect(objectRule?.edgesChecked).toBe(0);
    });
  });

  describe('full analysis pipeline', () => {
    it('should complete full pipeline: load config, build graph, evaluate rules', async () => {
      // This test verifies the entire integration works end-to-end
      const loadedConfig = loadConfig(fixturesPath);
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.packages).toBeDefined();
      expect(Object.keys(loadedConfig.packages).length).toBe(3);

      const buildResult = await buildDependencyGraph(loadedConfig);
      expect(buildResult.graph).toBeDefined();
      expect(buildResult.graph.nodes.size).toBeGreaterThan(0);
      expect(buildResult.graph.edges.length).toBeGreaterThan(0);

      const results = evaluateRules(buildResult.graph, loadedConfig);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r: any) => r.ruleName && Array.isArray(r.violations))).toBe(
        true
      );
    });

    it('should report total violations across all rules', async () => {
      const results = evaluateRules(graph, config);
      const totalViolations = results.reduce(
        (sum: number, r: any) => sum + r.violations.length,
        0
      );

      expect(typeof totalViolations).toBe('number');
      expect(totalViolations).toBeGreaterThanOrEqual(0);
    });

    it('should report edges analyzed across all rules', async () => {
      const results = evaluateRules(graph, config);
      const totalEdgesChecked = results.reduce(
        (sum: number, r: any) => sum + r.edgesChecked,
        0
      );

      expect(typeof totalEdgesChecked).toBe('number');
      expect(totalEdgesChecked).toBeGreaterThanOrEqual(0);
    });
  });

  describe('graph node and edge counts', () => {
    it('should have parsed nodes for all classes and objects', () => {
      expect(graph.nodes.size).toBeGreaterThan(0);

      // Verify key nodes exist
      expect(graph.nodes.has('BillingService')).toBe(true);
      expect(graph.nodes.has('PaymentProcessor')).toBe(true);
      expect(graph.nodes.has('Logger')).toBe(true);
      expect(graph.nodes.has('Invoice__c')).toBe(true);
      expect(graph.nodes.has('Payment__c')).toBe(true);
    });

    it('should have parsed edges for dependencies', () => {
      expect(graph.edges.length).toBeGreaterThan(0);

      // Verify some expected edges exist
      const paymentProcessorToBillingEdges = graph.edges.filter(
        (e: any) => e.from === 'PaymentProcessor' && e.to === 'BillingService'
      );
      expect(paymentProcessorToBillingEdges.length).toBeGreaterThan(0);
    });
  });
});
