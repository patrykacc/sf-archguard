import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { parseApexPackage } from '../src/parsers/apex-parser';

describe('ApexParser', () => {
  const fixturesPath = path.resolve(__dirname, 'fixtures');
  const projectRoot = fixturesPath;

  describe('parseApexPackage', () => {
    it('should parse the billing package and return nodes and edges', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/billing',
        'billing'
      );

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.edges).toBeDefined();
      expect(Array.isArray(result.edges)).toBe(true);
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should create correct nodes for Apex classes in billing package', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/billing',
        'billing'
      );

      const classNodes = result.nodes.filter((n: any) => n.type === 'apex-class');
      expect(classNodes.length).toBeGreaterThanOrEqual(2);

      const billingServiceNode = classNodes.find(
        (n: any) => n.name === 'BillingService'
      );
      expect(billingServiceNode).toBeDefined();
      expect(billingServiceNode?.packageName).toBe('billing');
      expect(billingServiceNode?.type).toBe('apex-class');

      const invoiceCalculatorNode = classNodes.find(
        (n: any) => n.name === 'InvoiceCalculator'
      );
      expect(invoiceCalculatorNode).toBeDefined();
      expect(invoiceCalculatorNode?.packageName).toBe('billing');
    });

    it('should extract dependencies from BillingService', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/billing',
        'billing'
      );

      // BillingService depends on Logger (via new Logger()) and Invoice__c
      const billingDeps = result.edges.filter(
        (e: any) => e.from === 'BillingService'
      );
      expect(billingDeps.length).toBeGreaterThan(0);

      const loggerDep = billingDeps.find((e: any) => e.to === 'Logger');
      expect(loggerDep).toBeDefined();

      const invoiceDep = billingDeps.find((e: any) => e.to === 'Invoice__c');
      expect(invoiceDep).toBeDefined();
    });

    it('should handle class inheritance (extends)', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/billing',
        'billing'
      );

      // InvoiceCalculator extends BaseCalculator
      const inheritanceEdges = result.edges.filter(
        (e: any) =>
          e.from === 'InvoiceCalculator' &&
          e.to === 'BaseCalculator' &&
          e.dependencyType === 'inheritance'
      );

      expect(inheritanceEdges.length).toBeGreaterThan(0);
    });

    it('should parse the payments package', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/payments',
        'payments'
      );

      expect(result.nodes.length).toBeGreaterThan(0);
      const paymentNodes = result.nodes.filter((n: any) => n.type === 'apex-class');
      expect(paymentNodes.some((n: any) => n.name === 'PaymentProcessor')).toBe(true);
      expect(paymentNodes.some((n: any) => n.name === 'PaymentGateway')).toBe(true);
    });

    it('should extract dependencies from PaymentProcessor', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/payments',
        'payments'
      );

      // PaymentProcessor depends on BillingService and Logger
      const paymentDeps = result.edges.filter(
        (e: any) => e.from === 'PaymentProcessor'
      );

      const billingDep = paymentDeps.find((e: any) => e.to === 'BillingService');
      expect(billingDep).toBeDefined();
      expect(billingDep?.dependencyType).toBe('method-invocation');

      const loggerDep = paymentDeps.find((e: any) => e.to === 'Logger');
      expect(loggerDep).toBeDefined();
    });

    it('should parse the common package', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/common',
        'common'
      );

      expect(result.nodes.length).toBeGreaterThan(0);
      const classNodes = result.nodes.filter((n: any) => n.type === 'apex-class');
      expect(classNodes.some((n: any) => n.name === 'Logger')).toBe(true);
      expect(classNodes.some((n: any) => n.name === 'BaseCalculator')).toBe(true);
    });

    it('should handle classes with no external dependencies', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/common',
        'common'
      );

      // Logger has no external dependencies
      const loggerDeps = result.edges.filter((e: any) => e.from === 'Logger');
      expect(loggerDeps.length).toBe(0);
    });

    it('should include correct file paths in nodes', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/billing',
        'billing'
      );

      const billingServiceNode = result.nodes.find(
        (n: any) => n.name === 'BillingService'
      );
      expect(billingServiceNode?.filePath).toContain('force-app/main/default/billing');
      expect(billingServiceNode?.filePath).toContain('BillingService.cls');
    });

    it('should include line numbers in edges', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/billing',
        'billing'
      );

      const edges = result.edges.filter((e: any) => e.from === 'BillingService');
      expect(edges.length).toBeGreaterThan(0);

      // Check that at least one edge has a line number
      const edgesWithLines = edges.filter((e: any) => e.line !== undefined);
      expect(edgesWithLines.length).toBeGreaterThan(0);
    });

    it('should detect static method invocations', async () => {
      const result = await parseApexPackage(
        projectRoot,
        'force-app/main/default/payments',
        'payments'
      );

      // PaymentProcessor calls Logger.log() statically
      const methodInvocations = result.edges.filter(
        (e: any) =>
          e.from === 'PaymentProcessor' &&
          e.to === 'Logger' &&
          e.dependencyType === 'method-invocation'
      );

      expect(methodInvocations.length).toBeGreaterThan(0);
    });
  });
});
