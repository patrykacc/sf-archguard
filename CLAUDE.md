# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SF-ArchGuard is an ArchUnit-style architecture enforcement tool for Salesforce SFDX projects. It analyzes Apex code and custom object metadata to detect violations of architectural rules (layer dependencies, package boundaries, object/field relationships). Written in TypeScript, it provides both a CLI and programmatic API.

## Commands

```bash
npm run build          # Compile TypeScript → dist/
npm test               # Run Jest tests
npm run lint           # ESLint on src/**/*.ts
npm start              # Run CLI (node dist/cli.js)

# Run a single test file
npx jest tests/apex-parser.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="pattern"
```

## Architecture

The analysis pipeline flows through five layers in sequence:

```
Config → Parsers → Graph → Rules → Reporters
```

1. **Config** (`src/config/config-loader.ts`) — Loads and validates `archguard.yml`, detects circular layer dependencies
2. **Parsers** (`src/parsers/`) — Regex-based Apex parser (`*.cls`, `*.trigger`) and XML-based metadata parser for custom objects/fields
3. **Graph** (`src/graph/dependency-graph.ts`) — Builds a unified dependency graph with typed nodes (classes, triggers, objects, fields) and edges (class-reference, inheritance, method-invocation, lookup-relationship, etc.). Unresolved edges (external/standard Salesforce types) are tracked separately and don't produce violations
4. **Rules** (`src/rules/rule-engine.ts`) — Pluggable rule engine implementing `ArchRule` interface. Three built-in rules:
   - **LayerDependencyRule** — Enforces layer hierarchy direction
   - **PackageBoundaryRule** — Enforces Apex class isolation per package/layer
   - **ObjectBoundaryRule** — Enforces custom object/field isolation per package
5. **Reporters** (`src/reporters/`) — Console (colored), JSON, and JUnit XML output formats

**Entry points:** `src/cli.ts` (Commander-based CLI), `src/analyzer.ts` (orchestration), `src/index.ts` (public API exports)

## Key Design Decisions

- **Dependency resolution order:** same package → always allowed; same layer → allowed (lateral); cross-layer → source must list target in `dependsOn`; package-level `dependsOn` overrides layer rules
- **Apex parsing is regex-based** (not AST) — extracts inheritance, type refs, generics, static calls, SOQL refs, `new`/`instanceof`/casts
- **Configuration is YAML** (`archguard.yml`) — layers, packages, rules, and glob-based excludes
- Custom rules can be registered via `evaluateRules(graph, config, customRules)`

## Core Dependencies

- `commander` — CLI parsing
- `yaml` — YAML config parsing
- `glob` — File pattern matching
- `chalk` (v4, CommonJS) — Colored output
- `fast-xml-parser` — SFDX metadata XML parsing

## TypeScript Configuration

- Target: ES2020, Module: CommonJS, strict mode enabled
- Source maps and declaration files generated to `dist/`
