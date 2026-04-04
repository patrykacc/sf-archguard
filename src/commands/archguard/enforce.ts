import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as path from 'path';
import { analyze } from '../../analyzer.js';
import { report } from '../../reporters/index.js';
import { ReportFormat, AnalysisResult } from '../../types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-archguard', 'archguard.enforce');

export interface EnforceFlags {
  'project-dir': string;
  config?: string;
  format: ReportFormat;
  output?: string;
  verbose: boolean;
  'fail-on-violation': boolean;
}

export interface EnforceCommandDependencies {
  analyze: typeof analyze;
  report: typeof report;
}

export interface EnforceExecutionResult {
  result: AnalysisResult;
  summary?: string;
  exitCode?: number;
}

const defaultDependencies: EnforceCommandDependencies = {
  analyze,
  report,
};

export async function executeEnforce(
  flags: EnforceFlags,
  dependencies: EnforceCommandDependencies = defaultDependencies
): Promise<EnforceExecutionResult> {
  const projectRoot = path.resolve(flags['project-dir']);
  const format = flags.format as ReportFormat;

  const result = await dependencies.analyze({
    projectRoot,
    configPath: flags.config,
    verbose: flags.verbose,
  });

  dependencies.report(result, {
    format,
    outputPath: flags.output,
    verbose: flags.verbose,
  });

  let summary: string | undefined;
  if (format === 'console') {
    if (result.totalErrors > 0 || result.totalWarnings > 0) {
      summary = `\nFound ${result.totalErrors} error(s) and ${result.totalWarnings} warning(s) across ${result.totalEdgesAnalyzed} dependencies.`;
    } else {
      summary = `\nNo violations found. Checked ${result.totalEdgesAnalyzed} dependencies across ${result.graphSummary.packageCount} packages.`;
    }
  }

  return {
    result,
    summary,
    exitCode: result.totalErrors > 0 && flags['fail-on-violation'] ? 1 : undefined,
  };
}

export default class ArchguardEnforce extends SfCommand<AnalysisResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'project-dir': Flags.directory({
      char: 'p',
      summary: messages.getMessage('flags.project-dir.summary'),
      default: '.',
      exists: true,
    }),
    config: Flags.file({
      char: 'c',
      summary: messages.getMessage('flags.config.summary'),
    }),
    format: Flags.option({
      char: 'f',
      summary: messages.getMessage('flags.format.summary'),
      options: ['console', 'json', 'junit'] as const,
      default: 'console',
    })(),
    output: Flags.file({
      char: 'o',
      summary: messages.getMessage('flags.output.summary'),
    }),
    verbose: Flags.boolean({
      char: 'v',
      summary: messages.getMessage('flags.verbose.summary'),
      default: false,
    }),
    'fail-on-violation': Flags.boolean({
      summary: messages.getMessage('flags.fail-on-violation.summary'),
      default: true,
      allowNo: true,
    }),
  };

  public async run(): Promise<AnalysisResult> {
    const { flags } = await this.parse(ArchguardEnforce);

    const execution = await executeEnforce(flags as EnforceFlags);

    if (execution.summary) {
      this.log(execution.summary);
    }

    if (execution.exitCode === 1) {
      this.error('Architecture errors detected.', { exit: 1 });
    }

    return execution.result;
  }
}
