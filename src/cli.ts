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
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { confirm, input } from '@inquirer/prompts';
import { analyze } from './analyzer.js';
import { report } from './reporters/index.js';
import { AnalysisResult, ReportFormat } from './types.js';
import { executeInit, readSfdxPackageDirectories } from './commands/archguard/init.js';

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
    // Default action options (for enforce)
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

        if (options.failOnViolation && result.totalErrors > 0) {
          exitCode = 1;
        }
      } catch (err) {
        dependencies.logError(`Error: ${(err as Error).message}`);
        exitCode = 2;
      }
    });

  // Init command
  program
    .command('init')
    .description('Initialize a new archguard.yml configuration file (reads --project from top-level)')
    .option('--source-dir <path>', 'Source directory to scan (overrides sfdx-project.json)')
    .option('--no-scan', 'Skip package scanning; emit template only')
    .option('-y, --yes', 'Skip confirmation prompts and proceed with scanning (for CI)', false)
    .action(async (options, command) => {
      try {
        // The --project flag is declared on the root program and shared across subcommands.
        const rootOpts = (command.parent?.opts() ?? {}) as { project?: string };
        const projectRoot = path.resolve(rootOpts.project ?? process.cwd());
        const configPath = path.join(projectRoot, 'archguard.yml');

        if (fs.existsSync(configPath)) {
          dependencies.logError(`Error: Configuration file already exists at ${configPath}`);
          exitCode = 1;
          return;
        }

        let scan = options.scan !== false;
        let sourceDir: string | undefined = options.sourceDir;
        const assumeYes = options.yes === true;
        const isInteractive = process.stdin.isTTY === true && process.stdout.isTTY === true;

        if (scan && !sourceDir) {
          if (assumeYes) {
            // --yes: proceed with scanning without prompting. If sfdx-project.json
            // is missing, fall back to scanning the default force-app directory.
            const sfdxDirs = readSfdxPackageDirectories(projectRoot);
            if (!sfdxDirs) {
              console.log('No sfdx-project.json found — defaulting source directory to "force-app".');
              sourceDir = 'force-app';
            } else {
              console.log(`Will use packageDirectories from sfdx-project.json: ${sfdxDirs.join(', ')}`);
            }
          } else if (!isInteractive) {
            console.log(
              'Non-interactive environment detected; re-run with --yes to scan or --no-scan to skip package discovery.'
            );
            scan = false;
          } else {
            scan = await confirm({
              message: 'Scan your project for existing packages to auto-populate the config?',
              default: true,
            });
            if (scan) {
              const sfdxDirs = readSfdxPackageDirectories(projectRoot);
              if (!sfdxDirs) {
                console.log('No sfdx-project.json found — cannot read packageDirectories.');
                sourceDir = await input({
                  message: 'Enter the relative path to your source directory:',
                  default: 'force-app',
                });
              } else {
                console.log(`Will use packageDirectories from sfdx-project.json: ${sfdxDirs.join(', ')}`);
              }
            }
          }
        }

        executeInit(
          { 'project-dir': projectRoot, scan, sourceDir },
          {
            log: (msg) => console.log(msg),
            error: (msg) => {
              dependencies.logError(`Error: ${msg}`);
              exitCode = 1;
            },
          }
        );
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
