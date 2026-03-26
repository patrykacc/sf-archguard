/**
 * SF-ArchGuard — Public API
 *
 * For programmatic use (e.g. in custom scripts, SFDX plugins, or tests).
 */

export { analyze, AnalyzerOptions } from './analyzer.js';
export { loadConfig, ConfigValidationError } from './config/config-loader.js';
export { buildDependencyGraph, GraphBuildResult } from './graph/index.js';
export { evaluateRules, ArchRule } from './rules/index.js';
export { report } from './reporters/index.js';
export * from './types.js';
