import { describe, it, expect, jest, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { report } from '../src/reporters/index.js';
import { reportJson } from '../src/reporters/json-reporter.js';
import { reportJunit } from '../src/reporters/junit-reporter.js';
import { AnalysisResult } from '../src/types.js';

const sampleResult: AnalysisResult = {
  ruleResults: [
    {
      ruleName: 'package-boundary',
      violations: [
        {
          rule: 'package-boundary',
          message: 'payments cannot depend on billing',
          filePath: 'force-app/main/default/payments/classes/PaymentProcessor.cls',
          line: 12,
          severity: 'error',
          sourceNode: 'PaymentProcessor',
          targetNode: 'BillingService',
          sourcePackage: 'payments',
          targetPackage: 'billing',
        },
      ],
      edgesChecked: 3,
    },
  ],
  totalViolations: 2,
  totalErrors: 2,
  totalWarnings: 0,
  totalEdgesAnalyzed: 3,
  graphSummary: {
    nodeCount: 2,
    edgeCount: 1,
    packageCount: 2,
  },
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('reporters', () => {
  it('prints only JSON to stdout when using json format without an output file', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    report(sampleResult, { format: 'json' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(sampleResult, null, 2));
  });

  it('writes JSON reports without extra console output', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archguard-json-'));
    const outputPath = path.join(tempDir, 'report.json');

    try {
      const json = reportJson(sampleResult, outputPath);

      expect(fs.readFileSync(outputPath, 'utf-8')).toBe(json);
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes JUnit reports without extra console output', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archguard-junit-'));
    const outputPath = path.join(tempDir, 'report.xml');

    try {
      const xml = reportJunit(sampleResult, outputPath);

      expect(fs.readFileSync(outputPath, 'utf-8')).toBe(xml);
      expect(xml).toContain('<testsuites');
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
