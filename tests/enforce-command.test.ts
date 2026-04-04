import { describe, expect, it, jest } from '@jest/globals';
import {
  executeEnforce,
  EnforceFlags,
} from '../src/commands/archguard/enforce';
import { AnalysisResult } from '../src/types';

function createResult(totalViolations = 0): AnalysisResult {
  return {
    ruleResults: [],
    totalViolations: totalViolations,
    totalErrors: totalViolations,
    totalWarnings: 0,
    totalEdgesAnalyzed: 5,
    graphSummary: {
      nodeCount: 4,
      edgeCount: 5,
      packageCount: 2,
    },
  };
}

function createFlags(overrides: Partial<EnforceFlags> = {}): EnforceFlags {
  return {
    'project-dir': '.',
    config: undefined,
    format: 'console',
    output: undefined,
    verbose: false,
    'fail-on-violation': true,
    ...overrides,
  };
}

describe('executeEnforce', () => {
  it('analyzes and reports using the provided flags', async () => {
    const analyzeMock = jest.fn(async () => createResult(0));
    const reportMock = jest.fn();

    const execution = await executeEnforce(createFlags({ verbose: true }), {
      analyze: analyzeMock,
      report: reportMock,
    });

    expect(execution.result).toEqual(createResult(0));
    expect(execution.summary).toBe('\nNo violations found. Checked 5 dependencies across 2 packages.');
    expect(execution.exitCode).toBeUndefined();
    expect(analyzeMock).toHaveBeenCalledWith({
      projectRoot: expect.any(String),
      configPath: undefined,
      verbose: true,
    });
    expect(reportMock).toHaveBeenCalledWith(
      createResult(0),
      expect.objectContaining({
        format: 'console',
        outputPath: undefined,
        verbose: true,
      })
    );
  });

  it('returns a failing exit code when violations are found in console mode', async () => {
    const execution = await executeEnforce(createFlags(), {
      analyze: jest.fn(async () => createResult(2)),
      report: jest.fn(),
    });

    expect(execution.summary).toBe('\nFound 2 error(s) and 0 warning(s) across 5 dependencies.');
    expect(execution.exitCode).toBe(1);
  });

  it('suppresses the exit code when fail-on-violation is disabled', async () => {
    const execution = await executeEnforce(
      createFlags({ 'fail-on-violation': false }),
      {
        analyze: jest.fn(async () => createResult(2)),
        report: jest.fn(),
      }
    );

    expect(execution.exitCode).toBeUndefined();
  });

  it('omits the console summary for non-console output formats', async () => {
    const execution = await executeEnforce(
      createFlags({ format: 'json', output: 'report.json' }),
      {
        analyze: jest.fn(async () => createResult(0)),
        report: jest.fn(),
      }
    );

    expect(execution.summary).toBeUndefined();
    expect(execution.exitCode).toBeUndefined();
  });
});
