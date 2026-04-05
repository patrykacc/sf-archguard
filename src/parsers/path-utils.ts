/**
 * Path Utilities
 *
 * Shared helpers for normalizing file paths in parser output.
 * Violation reports should always use forward-slash (POSIX) separators so
 * CI log grepping and cross-platform diffs behave consistently.
 */

/**
 * Converts a path to POSIX form (forward-slash separators).
 * Safe to call on already-POSIX paths.
 */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}
