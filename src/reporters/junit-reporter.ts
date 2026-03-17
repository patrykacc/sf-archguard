/**
 * JUnit XML Reporter
 *
 * Outputs analysis results as JUnit XML — compatible with most
 * CI systems (Jenkins, GitHub Actions, GitLab CI, Azure DevOps).
 */

import * as fs from 'fs';
import { AnalysisResult, Violation } from '../types';

export function reportJunit(result: AnalysisResult, outputPath?: string): string {
  const { ruleResults, totalViolations } = result;

  const testSuites: string[] = [];

  for (const ruleResult of ruleResults) {
    const testCases: string[] = [];

    if (ruleResult.violations.length === 0) {
      // Add a passing test case
      testCases.push(
        `    <testcase name="${escapeXml(ruleResult.ruleName)}" classname="sf-archguard" time="0"/>`
      );
    } else {
      for (const v of ruleResult.violations) {
        testCases.push(formatFailure(v));
      }
    }

    testSuites.push(
      `  <testsuite name="${escapeXml(ruleResult.ruleName)}" tests="${Math.max(1, ruleResult.violations.length)}" failures="${ruleResult.violations.length}" errors="0">\n${testCases.join('\n')}\n  </testsuite>`
    );
  }

  const totalTests = ruleResults.reduce(
    (sum, r) => sum + Math.max(1, r.violations.length),
    0
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="sf-archguard" tests="${totalTests}" failures="${totalViolations}" errors="0">
${testSuites.join('\n')}
</testsuites>`;

  if (outputPath) {
    fs.writeFileSync(outputPath, xml, 'utf-8');
    console.log(`JUnit XML report written to: ${outputPath}`);
  }

  return xml;
}

function formatFailure(v: Violation): string {
  const location = v.line ? `${v.filePath}:${v.line}` : v.filePath;
  return `    <testcase name="${escapeXml(`${v.sourceNode} → ${v.targetNode}`)}" classname="${escapeXml(v.rule)}">
      <failure message="${escapeXml(v.message)}" type="${escapeXml(v.severity)}">
${escapeXml(location)}
${escapeXml(v.message)}
      </failure>
    </testcase>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
