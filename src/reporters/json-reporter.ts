/**
 * JSON Reporter
 *
 * Outputs analysis results as structured JSON — suitable for
 * CI pipelines, dashboards, or downstream tooling.
 */

import * as fs from 'fs';
import { AnalysisResult } from '../types';

export function reportJson(result: AnalysisResult, outputPath?: string): string {
  const output = JSON.stringify(result, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, output, 'utf-8');
    console.log(`JSON report written to: ${outputPath}`);
  }

  return output;
}
