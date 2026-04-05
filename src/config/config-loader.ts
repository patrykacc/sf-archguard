/**
 * Config Loader
 *
 * Reads and validates archguard.yml configuration files.
 * Resolves paths relative to project root and applies defaults.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { ArchGuardConfig, RawArchGuardConfig, LayerDefinition, PackageDefinition } from '../types.js';

const DEFAULT_CONFIG_FILENAMES = ['archguard.yml', 'archguard.yaml', '.archguard.yml'];

export class ConfigValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Config validation failed:\n  - ${errors.join('\n  - ')}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Loads and validates an ArchGuard config file.
 */
export function loadConfig(projectRoot: string, configPath?: string): ArchGuardConfig {
  const resolvedConfigPath = configPath
    ? path.resolve(projectRoot, configPath)
    : findConfigFile(projectRoot);

  if (!resolvedConfigPath) {
    throw new Error(
      `No archguard config found. Create archguard.yml in your project root, or specify a path with --config.`
    );
  }

  const rawContent = fs.readFileSync(resolvedConfigPath, 'utf-8');
  const rawConfig = YAML.parse(rawContent) as RawArchGuardConfig;

  validate(rawConfig);

  return resolveConfig(rawConfig, projectRoot);
}

/**
 * Searches for a config file in the project root using known filenames.
 */
function findConfigFile(projectRoot: string): string | null {
  for (const filename of DEFAULT_CONFIG_FILENAMES) {
    const candidate = path.join(projectRoot, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Validates the raw YAML config, collecting all errors before throwing.
 */
function validate(raw: RawArchGuardConfig): void {
  const errors: string[] = [];

  // --- layers ---
  if (!raw.layers || !Array.isArray(raw.layers) || raw.layers.length === 0) {
    errors.push('`layers` must be a non-empty array.');
  } else {
    const layerNames = new Set<string>();
    for (const layer of raw.layers) {
      if (!layer.name || typeof layer.name !== 'string') {
        errors.push('Each layer must have a `name` string.');
        continue;
      }
      if (layerNames.has(layer.name)) {
        errors.push(`Duplicate layer name: "${layer.name}".`);
      }
      layerNames.add(layer.name);

      if (!Array.isArray(layer.dependsOn)) {
        errors.push(`Layer "${layer.name}": \`dependsOn\` must be an array.`);
      }
    }

    // Check that all dependsOn references point to existing layers
    for (const layer of raw.layers) {
      if (Array.isArray(layer.dependsOn)) {
        for (const dep of layer.dependsOn) {
          if (!layerNames.has(dep)) {
            errors.push(`Layer "${layer.name}" depends on unknown layer "${dep}".`);
          }
        }
      }
    }

    // Check for circular layer dependencies
    const circularCheck = detectCircularLayers(raw.layers);
    if (circularCheck) {
      errors.push(`Circular layer dependency detected: ${circularCheck}.`);
    }
  }

  // --- packages ---
  if (!raw.packages || typeof raw.packages !== 'object' || Object.keys(raw.packages).length === 0) {
    errors.push('`packages` must be a non-empty object.');
  } else {
    const layerNames = new Set((raw.layers || []).map((l) => l.name));
    const packageNames = new Set(Object.keys(raw.packages));

    for (const [pkgName, pkgDef] of Object.entries(raw.packages)) {
      if (!pkgDef.path || typeof pkgDef.path !== 'string') {
        errors.push(`Package "${pkgName}": \`path\` is required and must be a string.`);
      }
      if (!pkgDef.layer || typeof pkgDef.layer !== 'string') {
        errors.push(`Package "${pkgName}": \`layer\` is required and must be a string.`);
      } else if (layerNames.size > 0 && !layerNames.has(pkgDef.layer)) {
        errors.push(`Package "${pkgName}": references unknown layer "${pkgDef.layer}".`);
      }

      if (pkgDef.dependsOn) {
        if (!Array.isArray(pkgDef.dependsOn)) {
          errors.push(`Package "${pkgName}": \`dependsOn\` must be an array.`);
        } else {
          for (const dep of pkgDef.dependsOn) {
            if (!packageNames.has(dep)) {
              errors.push(`Package "${pkgName}" depends on unknown package "${dep}".`);
            }
          }
        }
      }
    }
  }

  // --- rules.severity ---
  if (raw.rules?.severity !== undefined && raw.rules.severity !== 'error' && raw.rules.severity !== 'warning') {
    errors.push(`\`rules.severity\` must be "error" or "warning" (got "${raw.rules.severity}").`);
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
}

/**
 * Detects circular dependencies among layer definitions.
 * Returns a description string if circular, null otherwise.
 */
function detectCircularLayers(layers: LayerDefinition[]): string | null {
  const layerMap = new Map(layers.map((l) => [l.name, l.dependsOn]));

  function visit(name: string, path: string[], visited: Set<string>): string | null {
    if (visited.has(name)) {
      return [...path, name].join(' -> ');
    }
    visited.add(name);
    const deps = layerMap.get(name) || [];
    for (const dep of deps) {
      const result = visit(dep, [...path, name], new Set(visited));
      if (result) return result;
    }
    return null;
  }

  for (const layer of layers) {
    const result = visit(layer.name, [], new Set());
    if (result) return result;
  }
  return null;
}

/**
 * Resolves raw config into a fully resolved ArchGuardConfig with defaults applied.
 */
function resolveConfig(raw: RawArchGuardConfig, projectRoot: string): ArchGuardConfig {
  const resolvedPackages: Record<string, PackageDefinition> = {};

  for (const [name, pkg] of Object.entries(raw.packages)) {
    resolvedPackages[name] = {
      ...pkg,
      path: pkg.path, // kept relative; resolved at parse time
      dependsOn: pkg.dependsOn || [],
    };
  }

  return {
    projectRoot,
    layers: raw.layers,
    packages: resolvedPackages,
    rules: {
      enforcePackageBoundaries: raw.rules?.enforcePackageBoundaries ?? true,
      enforceObjectBoundaries: raw.rules?.enforceObjectBoundaries ?? true,
      exclude: raw.rules?.exclude ?? [],
      severity: raw.rules?.severity ?? 'error',
    },
  };
}
