/**
 * Console Reporter
 *
 * Outputs analysis results to stdout with colored formatting.
 */

import chalk from 'chalk';
import { AnalysisResult, Violation } from '../types.js';

export function reportConsole(result: AnalysisResult, verbose: boolean = false): void {
  const { ruleResults, totalViolations, totalErrors, totalWarnings, graphSummary } = result;

  // Header
  console.log('');
  console.log(chalk.bold('SF-ArchGuard Analysis Report'));
  console.log(chalk.dim('─'.repeat(50)));

  // Graph summary
  console.log(
    chalk.dim(
      `Scanned: ${graphSummary.nodeCount} nodes, ${graphSummary.edgeCount} edges, ${graphSummary.packageCount} packages`
    )
  );
  console.log('');

  // Rule results
  for (const ruleResult of ruleResults) {
    const errors = ruleResult.violations.filter(v => v.severity === 'error').length;
    const warnings = ruleResult.violations.filter(v => v.severity === 'warning').length;
    const count = errors + warnings;
    
    let icon = chalk.green('✓');
    if (errors > 0) icon = chalk.red('✗');
    else if (warnings > 0) icon = chalk.yellow('⚠');

    let countStr = chalk.green('0 violations');
    if (errors > 0 && warnings > 0) {
      countStr = `${chalk.red(`${errors} error${errors > 1 ? 's' : ''}`)}, ${chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`)}`;
    } else if (errors > 0) {
      countStr = chalk.red(`${errors} error${errors > 1 ? 's' : ''}`);
    } else if (warnings > 0) {
      countStr = chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    }

    console.log(`${icon} ${chalk.bold(ruleResult.ruleName)}: ${countStr} (${ruleResult.edgesChecked} edges checked)`);

    if (count > 0) {
      for (const violation of ruleResult.violations) {
        printViolation(violation, verbose);
      }
      console.log('');
    }
  }

  // Summary
  console.log(chalk.dim('─'.repeat(50)));
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.green.bold('All architecture rules passed!'));
  } else {
    const summaryParts = [];
    if (totalErrors > 0) summaryParts.push(chalk.red.bold(`${totalErrors} error${totalErrors > 1 ? 's' : ''}`));
    if (totalWarnings > 0) summaryParts.push(chalk.yellow.bold(`${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`));
    console.log(`Found ${summaryParts.join(' and ')}.`);
  }
  console.log('');
}

function printViolation(v: Violation, verbose: boolean): void {
  const location = v.line ? `${v.filePath}:${v.line}` : v.filePath;
  const severity = v.severity === 'error'
    ? chalk.red(`[${v.severity.toUpperCase()}]`)
    : chalk.yellow(`[${v.severity.toUpperCase()}]`);

  console.log(`  ${severity} ${chalk.dim(location)}`);
  if (verbose) {
    console.log(`    ${v.message}`);
    console.log(`    ${chalk.dim(`${v.sourcePackage}/${v.sourceNode} → ${v.targetPackage}/${v.targetNode}`)}`);
  } else {
    console.log(`    ${v.sourceNode} → ${v.targetNode} (${v.sourcePackage} → ${v.targetPackage})`);
  }
}
