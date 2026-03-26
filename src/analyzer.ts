/**
 * Analyzer
 *
 * Orchestrates the full analysis pipeline:
 *   1. Load config
 *   2. Build dependency graph
 *   3. Evaluate rules
 *   4. Produce AnalysisResult
 */

import { ArchGuardConfig, AnalysisResult } from './types.js';
import { loadConfig } from './config/config-loader.js';
import { buildDependencyGraph } from './graph/dependency-graph.js';
import { evaluateRules } from './rules/rule-engine.js';

export interface AnalyzerOptions {
  projectRoot: string;
  configPath?: string;
  verbose?: boolean;
}

/**
 * Runs the full architecture analysis.
 */
export async function analyze(options: AnalyzerOptions): Promise<AnalysisResult> {
  // 1. Load and validate config
  const config = loadConfig(options.projectRoot, options.configPath);

  if (options.verbose) {
    const pkgCount = Object.keys(config.packages).length;
    console.log(`Loaded config: ${config.layers.length} layers, ${pkgCount} packages`);
  }

  // 2. Build dependency graph
  const { graph, unresolvedEdges, stats } = await buildDependencyGraph(config);

  if (options.verbose) {
    console.log(
      `Graph built: ${stats.apexClasses} classes, ${stats.apexTriggers} triggers, ` +
      `${stats.customObjects} objects, ${stats.customFields} fields`
    );
    if (unresolvedEdges.length > 0) {
      console.log(`Unresolved references (external/standard): ${unresolvedEdges.length}`);
    }
  }

  // 3. Evaluate rules
  const ruleResults = evaluateRules(graph, config);

  // 4. Aggregate
  const totalViolations = ruleResults.reduce(
    (sum, r) => sum + r.violations.length,
    0
  );
  const totalEdgesAnalyzed = ruleResults.reduce(
    (sum, r) => sum + r.edgesChecked,
    0
  );

  return {
    ruleResults,
    totalViolations,
    totalEdgesAnalyzed,
    graphSummary: {
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.length,
      packageCount: Object.keys(config.packages).length,
    },
  };
}
