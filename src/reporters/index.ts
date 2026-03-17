/**
 * Reporter Facade
 *
 * Routes to the correct reporter based on format.
 */

import { AnalysisResult, ReportOptions } from '../types';
import { reportConsole } from './console-reporter';
import { reportJson } from './json-reporter';
import { reportJunit } from './junit-reporter';

export function report(result: AnalysisResult, options: ReportOptions): void {
  switch (options.format) {
    case 'console':
      reportConsole(result, options.verbose);
      break;
    case 'json':
      const json = reportJson(result, options.outputPath);
      if (!options.outputPath) {
        console.log(json);
      }
      break;
    case 'junit':
      const xml = reportJunit(result, options.outputPath);
      if (!options.outputPath) {
        console.log(xml);
      }
      break;
    default:
      reportConsole(result, options.verbose);
  }
}

export { reportConsole } from './console-reporter';
export { reportJson } from './json-reporter';
export { reportJunit } from './junit-reporter';
