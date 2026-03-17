/**
 * Rule Engine
 *
 * Evaluates the dependency graph against the ArchGuard configuration.
 * Each rule is an independent function that receives the graph and config,
 * and returns violations. New rules can be added without modifying others.
 *
 * Built-in rules:
 *   1. LayerDependencyRule  — enforces layer dependency direction
 *   2. PackageBoundaryRule  — enforces package isolation
 *   3. ObjectBoundaryRule   — enforces object/field package isolation
 */

import {
  ArchGuardConfig,
  DependencyGraph,
  GraphNode,
  GraphEdge,
  Violation,
  RuleResult,
  ViolationSeverity,
} from '../types';

// ─── Rule Interface ─────────────────────────────────────────

export interface ArchRule {
  /** Unique rule identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Evaluate this rule against the graph */
  evaluate(graph: DependencyGraph, config: ArchGuardConfig): RuleResult;
}

// ─── Rule Registry ──────────────────────────────────────────

function getDefaultRules(): ArchRule[] {
  return [
    new LayerDependencyRule(),
    new PackageBoundaryRule(),
    new ObjectBoundaryRule(),
  ];
}

/**
 * Runs all registered rules against the dependency graph.
 */
export function evaluateRules(
  graph: DependencyGraph,
  config: ArchGuardConfig,
  customRules?: ArchRule[]
): RuleResult[] {
  const rules = customRules ?? getDefaultRules();
  return rules.map((rule) => rule.evaluate(graph, config));
}

// ─── Helper: build lookup maps ──────────────────────────────

function buildLayerAllowedDeps(config: ArchGuardConfig): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const layer of config.layers) {
    map.set(layer.name, new Set(layer.dependsOn));
  }
  return map;
}

function buildPackageAllowedDeps(config: ArchGuardConfig): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [name, def] of Object.entries(config.packages)) {
    map.set(name, new Set(def.dependsOn || []));
  }
  return map;
}

function getPackageLayer(config: ArchGuardConfig, packageName: string): string | undefined {
  return config.packages[packageName]?.layer;
}

// ─── Rule 1: Layer Dependency Rule ──────────────────────────

class LayerDependencyRule implements ArchRule {
  name = 'layer-dependency';
  description = 'Ensures dependencies follow the allowed layer direction (e.g. service → domain, not domain → service).';

  evaluate(graph: DependencyGraph, config: ArchGuardConfig): RuleResult {
    const violations: Violation[] = [];
    const layerAllowed = buildLayerAllowedDeps(config);
    let edgesChecked = 0;

    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.get(edge.from);
      const targetNode = graph.nodes.get(edge.to);
      if (!sourceNode || !targetNode) continue;

      // Skip edges within the same package (same-package is always allowed)
      if (sourceNode.packageName === targetNode.packageName) continue;

      edgesChecked++;

      const sourceLayer = getPackageLayer(config, sourceNode.packageName);
      const targetLayer = getPackageLayer(config, targetNode.packageName);
      if (!sourceLayer || !targetLayer) continue;

      // Same layer is allowed (lateral dependency)
      if (sourceLayer === targetLayer) continue;

      const allowed = layerAllowed.get(sourceLayer);
      if (!allowed || !allowed.has(targetLayer)) {
        violations.push({
          rule: this.name,
          message: `Layer violation: "${sourceNode.name}" (${sourceNode.packageName}, layer: ${sourceLayer}) depends on "${targetNode.name}" (${targetNode.packageName}, layer: ${targetLayer}). Layer "${sourceLayer}" is not allowed to depend on layer "${targetLayer}".`,
          filePath: sourceNode.filePath,
          line: edge.line,
          severity: 'error' as ViolationSeverity,
          sourceNode: sourceNode.name,
          targetNode: targetNode.name,
          sourcePackage: sourceNode.packageName,
          targetPackage: targetNode.packageName,
        });
      }
    }

    return { ruleName: this.name, violations, edgesChecked };
  }
}

// ─── Rule 2: Package Boundary Rule ──────────────────────────

class PackageBoundaryRule implements ArchRule {
  name = 'package-boundary';
  description = 'Ensures Apex classes only reference classes from the same package, allowed layer dependencies, or explicitly declared package dependencies.';

  evaluate(graph: DependencyGraph, config: ArchGuardConfig): RuleResult {
    if (config.rules?.enforcePackageBoundaries === false) {
      return { ruleName: this.name, violations: [], edgesChecked: 0 };
    }

    const violations: Violation[] = [];
    const layerAllowed = buildLayerAllowedDeps(config);
    const packageAllowed = buildPackageAllowedDeps(config);
    let edgesChecked = 0;

    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.get(edge.from);
      const targetNode = graph.nodes.get(edge.to);
      if (!sourceNode || !targetNode) continue;

      // Only check Apex class/trigger references
      if (sourceNode.type !== 'apex-class' && sourceNode.type !== 'apex-trigger') continue;
      if (targetNode.type !== 'apex-class' && targetNode.type !== 'apex-trigger') continue;

      // Same package is always allowed
      if (sourceNode.packageName === targetNode.packageName) continue;

      edgesChecked++;

      const isAllowed = isDependencyAllowed(
        sourceNode.packageName,
        targetNode.packageName,
        config,
        layerAllowed,
        packageAllowed
      );

      if (!isAllowed) {
        violations.push({
          rule: this.name,
          message: `Package boundary violation: "${sourceNode.name}" (${sourceNode.packageName}) references "${targetNode.name}" (${targetNode.packageName}). This cross-package dependency is not allowed.`,
          filePath: sourceNode.filePath,
          line: edge.line,
          severity: 'error' as ViolationSeverity,
          sourceNode: sourceNode.name,
          targetNode: targetNode.name,
          sourcePackage: sourceNode.packageName,
          targetPackage: targetNode.packageName,
        });
      }
    }

    return { ruleName: this.name, violations, edgesChecked };
  }
}

// ─── Rule 3: Object Boundary Rule ───────────────────────────

class ObjectBoundaryRule implements ArchRule {
  name = 'object-boundary';
  description = 'Ensures custom objects/fields only reference objects within the same package or allowed dependencies.';

  evaluate(graph: DependencyGraph, config: ArchGuardConfig): RuleResult {
    if (config.rules?.enforceObjectBoundaries === false) {
      return { ruleName: this.name, violations: [], edgesChecked: 0 };
    }

    const violations: Violation[] = [];
    const layerAllowed = buildLayerAllowedDeps(config);
    const packageAllowed = buildPackageAllowedDeps(config);
    let edgesChecked = 0;

    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.get(edge.from);
      const targetNode = graph.nodes.get(edge.to);
      if (!sourceNode || !targetNode) continue;

      // Only check object/field-related edges
      if (
        edge.dependencyType !== 'lookup-relationship' &&
        edge.dependencyType !== 'field-reference'
      ) continue;

      // Same package is always allowed
      if (sourceNode.packageName === targetNode.packageName) continue;

      edgesChecked++;

      const isAllowed = isDependencyAllowed(
        sourceNode.packageName,
        targetNode.packageName,
        config,
        layerAllowed,
        packageAllowed
      );

      if (!isAllowed) {
        violations.push({
          rule: this.name,
          message: `Object boundary violation: "${sourceNode.name}" (${sourceNode.packageName}) has a relationship to "${targetNode.name}" (${targetNode.packageName}). This cross-package object dependency is not allowed.`,
          filePath: sourceNode.filePath,
          line: edge.line,
          severity: 'error' as ViolationSeverity,
          sourceNode: sourceNode.name,
          targetNode: targetNode.name,
          sourcePackage: sourceNode.packageName,
          targetPackage: targetNode.packageName,
        });
      }
    }

    return { ruleName: this.name, violations, edgesChecked };
  }
}

// ─── Shared: dependency allowed check ───────────────────────

/**
 * Determines if a dependency from sourcePackage to targetPackage is allowed,
 * considering both layer rules and explicit package-level dependencies.
 */
function isDependencyAllowed(
  sourcePackageName: string,
  targetPackageName: string,
  config: ArchGuardConfig,
  layerAllowed: Map<string, Set<string>>,
  packageAllowed: Map<string, Set<string>>
): boolean {
  // 1. Check explicit package-level dependency
  const explicitDeps = packageAllowed.get(sourcePackageName);
  if (explicitDeps && explicitDeps.has(targetPackageName)) {
    return true;
  }

  // 2. Check layer-level dependency
  const sourceLayer = getPackageLayer(config, sourcePackageName);
  const targetLayer = getPackageLayer(config, targetPackageName);
  if (sourceLayer && targetLayer) {
    // Same layer: allowed (lateral)
    if (sourceLayer === targetLayer) return true;

    const allowedLayers = layerAllowed.get(sourceLayer);
    if (allowedLayers && allowedLayers.has(targetLayer)) {
      return true;
    }
  }

  return false;
}

export { LayerDependencyRule, PackageBoundaryRule, ObjectBoundaryRule, isDependencyAllowed };
