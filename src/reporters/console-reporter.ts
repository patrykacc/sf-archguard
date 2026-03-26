/**
 * Console Reporter
 *
 * Outputs analysis results to stdout with colored formatting.
 */

import chalk from 'chalk';
import { AnalysisResult, Violation } from '../types.js';

export function reportConsole(result: AnalysisResult, verbose: boolean = false): void {
  const { ruleResults, totalViolations, graphSummary } = result;

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
    const count = ruleResult.violations.length;
    const icon = count === 0 ? chalk.green('✓') : chalk.red('✗');
    const countStr = count === 0
      ? chalk.green('0 violations')
      : chalk.red(`${count} violation${count > 1 ? 's' : ''}`);

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
  if (totalViolations === 0) {
    console.log(chalk.green.bold('All architecture rules passed!'));
  } else {
    console.log(
      chalk.red.bold(`${totalViolations} total violation${totalViolations > 1 ? 's' : ''} found.`)
    );
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
