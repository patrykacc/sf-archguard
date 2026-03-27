#!/usr/bin/env node
/**
 * SF-ArchGuard CLI
 *
 * Usage:
 *   sf-archguard [options]
 *   sf-archguard --config archguard.yml --format console --verbose
 *   sf-archguard --format junit --output report.xml
 */

import { createRequire } from 'module';
import { Command } from 'commander';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyze } from './analyzer.js';
import { report } from './reporters/index.js';
import { AnalysisResult, ReportFormat } from './types.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export interface CliDependencies {
  analyze: (options: {
    projectRoot: string;
    configPath?: string;
    verbose?: boolean;
  }) => Promise<AnalysisResult>;
  report: typeof report;
  logError: (message: string) => void;
}

const defaultDependencies: CliDependencies = {
  analyze,
  report,
  logError: (message: string) => console.error(message),
};

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = defaultDependencies
): Promise<number> {
  const program = new Command();
  let exitCode = 0;

  program
    .name('sf-archguard')
    .description('Architecture enforcement for Salesforce SFDX projects')
    .version(version)
    .option('-p, --project <path>', 'Project root directory', process.cwd())
    .option('-c, --config <path>', 'Path to archguard.yml config file')
    .option(
      '-f, --format <format>',
      'Output format: console, json, junit',
      'console'
    )
    .option('-o, --output <path>', 'Output file path (for json/junit formats)')
    .option('-v, --verbose', 'Verbose output with detailed violation messages', false)
    .option('--fail-on-violation', 'Exit with code 1 if violations are found (default: true)', true)
    .option('--no-fail-on-violation', 'Do not exit with code 1 when violations are found')
    .action(async (options) => {
      try {
        const projectRoot = path.resolve(options.project);
        const format = options.format as ReportFormat;

        const result = await dependencies.analyze({
          projectRoot,
          configPath: options.config,
          verbose: options.verbose,
        });

        dependencies.report(result, {
          format,
          outputPath: options.output,
          verbose: options.verbose,
        });

        if (options.failOnViolation && result.totalViolations > 0) {
          exitCode = 1;
        }
      } catch (err) {
        dependencies.logError(`Error: ${(err as Error).message}`);
        exitCode = 2;
      }
    });

  await program.parseAsync(argv, { from: 'user' });
  return exitCode;
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
