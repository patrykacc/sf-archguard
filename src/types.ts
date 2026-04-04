/**
 * SF-ArchGuard Core Types
 *
 * Defines all shared interfaces for config, dependency graph,
 * rule evaluation, and reporting.
 */

// ─── Config Types ───────────────────────────────────────────

export interface ArchGuardConfig {
  /** Project root (defaults to cwd) */
  projectRoot: string;

  /** Layer definitions and their allowed dependencies */
  layers: LayerDefinition[];

  /** Package definitions mapped to folders and layers */
  packages: Record<string, PackageDefinition>;

  /** Global rules that apply across all packages */
  rules?: GlobalRules;
}

export interface LayerDefinition {
  /** Unique layer name (e.g. "service", "domain", "shared") */
  name: string;

  /** Which layers this layer is allowed to depend on */
  dependsOn: string[];
}

export interface PackageDefinition {
  /** Relative path from project root to the package folder */
  path: string;

  /** Which layer this package belongs to */
  layer: string;

  /**
   * Explicit cross-package dependencies allowed beyond layer rules.
   * References other package names (keys in the packages map).
   */
  dependsOn?: string[];
}

export interface GlobalRules {
  /**
   * If true, classes within a package can only reference classes
   * in the same package, allowed layer deps, or explicit dependsOn.
   * Default: true
   */
  enforcePackageBoundaries?: boolean;

  /**
   * If true, custom objects/fields can only reference objects
   * within the same package or allowed dependencies.
   * Default: true
   */
  enforceObjectBoundaries?: boolean;

  /** Glob patterns to exclude from analysis. */
  exclude?: string[];

  /**
   * Default severity for violations.
   * Default: 'error'
   */
  severity?: ViolationSeverity;
}

// ─── Raw YAML Config (before resolution) ────────────────────

export interface RawArchGuardConfig {
  layers: LayerDefinition[];
  packages: Record<string, PackageDefinition>;
  rules?: GlobalRules;
}

// ─── Dependency Graph Types ─────────────────────────────────

export type MetadataType = 'apex-class' | 'apex-trigger' | 'custom-object' | 'custom-field';

export interface GraphNode {
  /** Fully qualified name (e.g. "BillingService", "Invoice__c") */
  name: string;

  /** What kind of metadata this is */
  type: MetadataType;

  /** Which package this node belongs to */
  packageName: string;

  /** File path relative to project root */
  filePath: string;
}

export interface GraphEdge {
  /** Source node name */
  from: string;

  /** Target node name */
  to: string;

  /** What kind of dependency this is */
  dependencyType: DependencyType;

  /** Line number in source file where the dependency occurs (if known) */
  line?: number;
}

export type DependencyType =
  | 'class-reference'     // Type usage in Apex
  | 'inheritance'         // extends / implements
  | 'method-invocation'   // Static method calls like ClassName.method()
  | 'field-reference'     // Referencing a field from another object
  | 'lookup-relationship' // Lookup or Master-Detail to another object
  | 'trigger-object';     // Trigger references an SObject

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

// ─── Rule Engine Types ──────────────────────────────────────

export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  /** Rule that was violated */
  rule: string;

  /** Human-readable description */
  message: string;

  /** Source file where violation was found */
  filePath: string;

  /** Line number (if available) */
  line?: number;

  /** Severity level */
  severity: ViolationSeverity;

  /** Source node (the one that has the illegal dependency) */
  sourceNode: string;

  /** Target node (the one being illegally depended upon) */
  targetNode: string;

  /** Source package */
  sourcePackage: string;

  /** Target package */
  targetPackage: string;
}

export interface RuleResult {
  /** Name of the rule that was evaluated */
  ruleName: string;

  /** All violations found by this rule */
  violations: Violation[];

  /** How many edges were checked */
  edgesChecked: number;
}

// ─── Reporter Types ─────────────────────────────────────────

export type ReportFormat = 'console' | 'json' | 'junit';

export interface ReportOptions {
  format: ReportFormat;
  outputPath?: string;
  verbose?: boolean;
}

export interface AnalysisResult {
  /** All rule results */
  ruleResults: RuleResult[];

  /** Total violations across all rules */
  totalViolations: number;

  /** Total errors across all rules */
  totalErrors: number;

  /** Total warnings across all rules */
  totalWarnings: number;

  /** Total edges analyzed */
  totalEdgesAnalyzed: number;

  /** Summary of the dependency graph */
  graphSummary: {
    nodeCount: number;
    edgeCount: number;
    packageCount: number;
  };
}
