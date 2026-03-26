import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as path from 'path';
import { analyze } from '../../analyzer.js';
import { report } from '../../reporters/index.js';
import { ReportFormat, AnalysisResult } from '../../types.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-archguard', 'archguard.enforce');

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

    const projectRoot = path.resolve(flags['project-dir']);
    const format = flags.format as ReportFormat;

    const result = await analyze({
      projectRoot,
      configPath: flags.config,
      verbose: flags.verbose,
    });

    report(result, {
      format,
      outputPath: flags.output,
      verbose: flags.verbose,
    });

    if (result.totalViolations > 0) {
      this.log(
        `\nFound ${result.totalViolations} architecture violation(s) across ${result.totalEdgesAnalyzed} dependencies.`
      );
      if (flags['fail-on-violation']) {
        this.error('Architecture violations detected.', { exit: 1 });
      }
    } else {
      this.log(
        `\nNo violations found. Checked ${result.totalEdgesAnalyzed} dependencies across ${result.graphSummary.packageCount} packages.`
      );
    }

    return result;
  }
}
