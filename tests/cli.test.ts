import { describe, expect, it, jest } from '@jest/globals';
import { runCli } from '../src/cli';
import { AnalysisResult } from '../src/types';

function createResult(totalViolations = 0): AnalysisResult {
  return {
    ruleResults: [],
    totalViolations,
    totalEdgesAnalyzed: 3,
    graphSummary: {
      nodeCount: 2,
      edgeCount: 3,
      packageCount: 1,
    },
  };
}

describe('CLI', () => {
  it('passes parsed options to analyze and report for console output', async () => {
    const analyzeMock = jest.fn(async () => createResult(0));
    const reportMock = jest.fn();
    const logErrorMock = jest.fn();

    const exitCode = await runCli(
      ['--project', '.', '--format', 'console', '--verbose'],
      {
        analyze: analyzeMock,
        report: reportMock,
        logError: logErrorMock,
      }
    );

    expect(exitCode).toBe(0);
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
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('returns exit code 1 when violations exist and fail-on-violation is enabled', async () => {
    const exitCode = await runCli(
      ['--project', '.'],
      {
        analyze: jest.fn(async () => createResult(2)),
        report: jest.fn(),
        logError: jest.fn(),
      }
    );

    expect(exitCode).toBe(1);
  });

  it('returns exit code 0 when violations exist and fail-on-violation is disabled', async () => {
    const exitCode = await runCli(
      ['--project', '.', '--no-fail-on-violation'],
      {
        analyze: jest.fn(async () => createResult(2)),
        report: jest.fn(),
        logError: jest.fn(),
      }
    );

    expect(exitCode).toBe(0);
  });

  it('passes file output options through to the reporter', async () => {
    const reportMock = jest.fn();

    const exitCode = await runCli(
      ['--project', '.', '--format', 'junit', '--output', 'archguard-report.xml'],
      {
        analyze: jest.fn(async () => createResult(0)),
        report: reportMock,
        logError: jest.fn(),
      }
    );

    expect(exitCode).toBe(0);
    expect(reportMock).toHaveBeenCalledWith(
      createResult(0),
      expect.objectContaining({
        format: 'junit',
        outputPath: 'archguard-report.xml',
        verbose: false,
      })
    );
  });

  it('returns exit code 2 and logs errors when analysis fails', async () => {
    const logErrorMock = jest.fn();
    const reportMock = jest.fn();

    const exitCode = await runCli(
      ['--project', '.'],
      {
        analyze: jest.fn(async () => {
          throw new Error('boom');
        }),
        report: reportMock,
        logError: logErrorMock,
      }
    );

    expect(exitCode).toBe(2);
    expect(reportMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith('Error: boom');
  });
});
