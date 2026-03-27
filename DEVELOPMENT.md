# Development Guide

This document covers building SF-ArchGuard from source, running it locally, and preparing a release.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8
- **Salesforce CLI** (`sf`) installed globally — required to link and test the plugin locally

```bash
npm install -g @salesforce/cli
```

## Clone and Install

```bash
git clone https://github.com/<your-org>/sf-archguard.git
cd sf-archguard
npm install
```

## Build

Compile TypeScript to `dist/`:

```bash
npm run build
```

After a successful build, `dist/` will contain the compiled JS, declaration files (`.d.ts`), and source maps.

## Run Locally Without Installing

### Option 1 — Link as an SF plugin (recommended)

This makes `sf archguard` available in your terminal exactly as it would be after a registry install:

```bash
sf plugins link .
```

Verify the link:

```bash
sf plugins
# sf-archguard 0.x.x (link) /path/to/sf-archguard
```

Then use it normally against any SFDX project:

```bash
sf archguard enforce --project-dir /path/to/your/sfdx-project
```

To unlink when done:

```bash
sf plugins unlink sf-archguard
```

### Option 2 — Run the compiled CLI directly

```bash
node dist/cli.js --help
node dist/cli.js enforce --project-dir /path/to/your/sfdx-project
```

### Option 3 — Dev mode (live TypeScript, no build step)

`bin/dev.js` uses `@oclif/core` in development mode, which enables additional debug output:

```bash
./bin/dev.js archguard enforce --project-dir /path/to/your/sfdx-project
```

> On Windows, run `node bin/dev.js archguard enforce ...` instead.

## Watch Mode

There is no built-in watch script. Use `tsc --watch` in one terminal and re-run your command in another:

```bash
npx tsc --watch
```

## Tests

```bash
# Run all tests
npm test

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.cjs tests/apex-parser.test.ts

# Run tests matching a name pattern
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.cjs --testNamePattern="LayerDependency"

# Run with coverage
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.cjs --coverage
```

> **Note:** Jest is invoked via `node ... node_modules/jest/bin/jest.js` rather than `npx jest` because the project uses `"type": "module"` in `package.json`, which prevents the shell wrapper in `node_modules/.bin/jest` from executing correctly on Windows.

Tests use Jest with `ts-jest` — no build step required; test files import TypeScript directly.

Fixtures live in `tests/fixtures/` and include a small SFDX project with pre-configured `archguard.yml`.

## Lint

```bash
npm run lint
```

ESLint is configured for `src/**/*.ts`. Fix issues before opening a PR.

## Project Structure

```
src/
  cli.ts                      # Commander-based CLI entry point
  analyzer.ts                 # Orchestration: config → parsers → graph → rules → reporters
  index.ts                    # Public API exports
  commands/archguard/
    enforce.ts                # oclif command definition
  config/
    config-loader.ts          # Loads and validates archguard.yml
  parsers/
    apex-parser.ts            # Regex-based Apex class/trigger parser
    object-parser.ts          # XML metadata parser (.object-meta.xml, .field-meta.xml)
    index.ts
  graph/
    dependency-graph.ts       # Builds unified dependency graph
    index.ts
  rules/
    rule-engine.ts            # Pluggable rule engine + built-in rules
    index.ts
  reporters/
    console-reporter.ts       # Colored terminal output
    json-reporter.ts
    junit-reporter.ts
    index.ts
bin/
  run.js                      # Production oclif entry point
  dev.js                      # Development oclif entry point
messages/                     # oclif i18n message files
tests/
  fixtures/                   # Sample SFDX project used in tests
```

## Adding a New Rule

1. Implement the `ArchRule` interface from `src/rules/rule-engine.ts`
2. Export it from `src/rules/index.ts`
3. Register it in the rule engine or pass it via `evaluateRules(graph, config, customRules)`
4. Add a test case in `tests/rule-engine.test.ts`

## Preparing a Release

1. Bump the version in `package.json`
2. Run the full build and test suite:
   ```bash
   npm run release:check
   ```
3. Publish to the npm registry (the SF plugin registry uses npm):
   ```bash
   npm publish --access public
   ```
4. Tag and push the release:
   ```bash
   git tag v0.x.x
   git push --follow-tags
   ```

Users can then install the released version with:
```bash
sf plugins install sf-archguard
```
