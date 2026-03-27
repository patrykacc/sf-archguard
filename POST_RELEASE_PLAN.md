# Post-Release Execution Plan

This file tracks the immediate post-`0.1.0` work in execution order.

## 1. Object Metadata Parser Tests

Add focused coverage for `src/parsers/object-parser.ts`:

- lookup relationships via `referenceTo`
- master-detail relationships via `referenceTo`
- formula references using both `__c` and `__r`
- malformed XML handling
- multiple objects and fields within a package fixture

Status: completed

## 2. Analyzer Integration Tests

Add end-to-end tests for `src/analyzer.ts` using fixture SFDX projects:

- config load to result aggregation
- violation counts and edge counts
- graph summary assertions
- verbose mode smoke coverage

Status: completed

## 3. CLI Entrypoint Tests

Add tests for the standalone CLI in `src/cli.ts`:

- console/json/junit output selection
- file output behavior
- `--fail-on-violation` and `--no-fail-on-violation`
- exit code behavior for violations and runtime errors

Status: completed

## 4. Salesforce Command Tests

Add coverage for `src/commands/archguard/enforce.ts`:

- `sf archguard enforce` success path
- violation path with exit code `1`
- console summary output
- non-console formatter behavior

Status: completed

