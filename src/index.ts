/**
 * SF-ArchGuard — Public API
 *
 * For programmatic use (e.g. in custom scripts, SFDX plugins, or tests).
 */

export { analyze, AnalyzerOptions } from './analyzer';
export { loadConfig, ConfigValidationError } from './config/config-loader';
export { buildDependencyGraph, GraphBuildResult } from './graph';
export { evaluateRules, ArchRule } from './rules';
export { report } from './reporters';
export * from './types';
