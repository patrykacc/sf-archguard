/**
 * Dependency Graph Builder
 *
 * Orchestrates parsing of all packages and assembles a unified
 * dependency graph. Resolves edges to ensure targets map to
 * known nodes (unresolved refs are tagged for optional warnings).
 */

import { ArchGuardConfig, DependencyGraph, GraphNode, GraphEdge } from '../types';
import { parseApexPackage } from '../parsers/apex-parser';
import { parseObjectPackage } from '../parsers/object-parser';
import { minimatch } from 'minimatch';

export interface GraphBuildResult {
  graph: DependencyGraph;
  unresolvedEdges: GraphEdge[];
  stats: {
    totalFiles: number;
    apexClasses: number;
    apexTriggers: number;
    customObjects: number;
    customFields: number;
  };
}

/**
 * Builds the complete dependency graph from all configured packages.
 */
export async function buildDependencyGraph(config: ArchGuardConfig): Promise<GraphBuildResult> {
  const allNodes = new Map<string, GraphNode>();
  const allEdges: GraphEdge[] = [];

  const stats = {
    totalFiles: 0,
    apexClasses: 0,
    apexTriggers: 0,
    customObjects: 0,
    customFields: 0,
  };

  const excludePatterns = config.rules?.exclude || [];

  for (const [packageName, packageDef] of Object.entries(config.packages)) {
    // Parse Apex
    const apexResult = await parseApexPackage(config.projectRoot, packageDef.path, packageName);
    for (const node of apexResult.nodes) {
      if (!isExcluded(node.filePath, excludePatterns)) {
        allNodes.set(node.name, node);
        stats.totalFiles++;
        if (node.type === 'apex-class') stats.apexClasses++;
        if (node.type === 'apex-trigger') stats.apexTriggers++;
      }
    }
    for (const edge of apexResult.edges) {
      if (!isExcluded(getNodeFilePath(allNodes, edge.from) || '', excludePatterns)) {
        allEdges.push(edge);
      }
    }

    // Parse Objects/Fields
    const objectResult = await parseObjectPackage(config.projectRoot, packageDef.path, packageName);
    for (const node of objectResult.nodes) {
      if (!isExcluded(node.filePath, excludePatterns)) {
        allNodes.set(node.name, node);
        stats.totalFiles++;
        if (node.type === 'custom-object') stats.customObjects++;
        if (node.type === 'custom-field') stats.customFields++;
      }
    }
    for (const edge of objectResult.edges) {
      allEdges.push(edge);
    }
  }

  // Separate resolved vs unresolved edges
  const resolvedEdges: GraphEdge[] = [];
  const unresolvedEdges: GraphEdge[] = [];

  for (const edge of allEdges) {
    if (allNodes.has(edge.to)) {
      resolvedEdges.push(edge);
    } else {
      unresolvedEdges.push(edge);
    }
  }

  return {
    graph: {
      nodes: allNodes,
      edges: resolvedEdges,
    },
    unresolvedEdges,
    stats,
  };
}

/**
 * Checks if a file path matches any of the exclusion patterns.
 */
function isExcluded(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filePath, pattern));
}

/**
 * Helper to get a node's file path from the map.
 */
function getNodeFilePath(nodes: Map<string, GraphNode>, name: string): string | undefined {
  return nodes.get(name)?.filePath;
}
