import { describe, expect, it, jest } from '@jest/globals';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyze } from '../src/analyzer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Analyzer', () => {
  const fixturesPath = path.resolve(__dirname, 'fixtures');

  it('runs the full analysis pipeline and returns aggregated totals', async () => {
    const result = await analyze({
      projectRoot: fixturesPath,
    });

    expect(result.totalViolations).toBe(2);
    expect(result.totalEdgesAnalyzed).toBe(16);
    expect(result.graphSummary).toEqual({
      nodeCount: 14,
      edgeCount: 9,
      packageCount: 3,
    });
  });

  it('returns rule results for each built-in rule', async () => {
    const result = await analyze({
      projectRoot: fixturesPath,
    });

    expect(result.ruleResults.map((rule) => rule.ruleName)).toEqual([
      'layer-dependency',
      'package-boundary',
      'object-boundary',
    ]);
  });

  it('reports the expected fixture violations', async () => {
    const result = await analyze({
      projectRoot: fixturesPath,
    });

    const violations = result.ruleResults.flatMap((rule) => rule.violations);

    expect(violations).toContainEqual(
      expect.objectContaining({
        rule: 'layer-dependency',
        sourceNode: 'Invoice__c',
        targetNode: 'Payment__c',
        sourcePackage: 'billing',
        targetPackage: 'payments',
      })
    );

    expect(violations).toContainEqual(
      expect.objectContaining({
        rule: 'object-boundary',
        sourceNode: 'Invoice__c',
        targetNode: 'Payment__c',
        sourcePackage: 'billing',
        targetPackage: 'payments',
      })
    );
  });

  it('logs pipeline progress in verbose mode', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await analyze({
        projectRoot: fixturesPath,
        verbose: true,
      });

      expect(logSpy).toHaveBeenCalledWith('Loaded config: 3 layers, 3 packages');
      expect(logSpy).toHaveBeenCalledWith(
        'Graph built: 6 classes, 0 triggers, 3 objects, 5 fields'
      );
      expect(logSpy).toHaveBeenCalledTimes(2);
    } finally {
      logSpy.mockRestore();
    }
  });
});
