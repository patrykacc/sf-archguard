#!/usr/bin/env node
/**
 * SF-ArchGuard CLI
 *
 * Usage:
 *   sf-archguard [options]
 *   sf-archguard --config archguard.yml --format console --verbose
 *   sf-archguard --format junit --output report.xml
 */

import { Command } from 'commander';
import * as path from 'path';
import { analyze } from './analyzer.js';
import { report } from './reporters/index.js';
import { ReportFormat } from './types.js';

const program = new Command();

program
  .name('sf-archguard')
  .description('Architecture enforcement for Salesforce SFDX projects')
  .version('0.1.0')
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
  .action(async (options) => {
    try {
      const projectRoot = path.resolve(options.project);
      const format = options.format as ReportFormat;

      const result = await analyze({
        projectRoot,
        configPath: options.config,
        verbose: options.verbose,
      });

      report(result, {
        format,
        outputPath: options.output,
        verbose: options.verbose,
      });

      // Exit with error code if violations found and --fail-on-violation is set
      if (options.failOnViolation && result.totalViolations > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(2);
    }
  });

program.parse();
