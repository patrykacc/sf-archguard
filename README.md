# SF-ArchGuard

Architecture enforcement for Salesforce SFDX projects. Think [ArchUnit](https://www.archunit.org/) but for Salesforce — define layers, assign packages to them, and let the tool catch illegal cross-package dependencies in your Apex classes, triggers, and custom object relationships.

SF-ArchGuard focuses exclusively on **structural and architectural rules**. It does not duplicate PMD, ESLint, or other linting tools — there are no code style, complexity, or security checks here.

## What It Checks

- **Layer dependency direction** — a service-layer package cannot depend on an integration-layer package
- **Package boundaries** — Apex classes can only reference classes from the same package, an allowed layer, or an explicitly declared dependency
- **Object boundaries** — Custom object lookups and master-detail relationships respect the same package/layer rules

## Quick Start

```bash
npm install
npm run build
```

Create an `archguard.yml` in your SFDX project root (see `archguard.example.yml` for a full template):

```yaml
layers:
  - name: integration
    dependsOn: [service, shared]
  - name: service
    dependsOn: [shared]
  - name: shared
    dependsOn: []

packages:
  billing:
    path: force-app/main/default/billing
    layer: service
  payments:
    path: force-app/main/default/payments
    layer: integration
    dependsOn: [billing]  # explicit cross-package exception
  common:
    path: force-app/main/default/common
    layer: shared

rules:
  enforcePackageBoundaries: true
  enforceObjectBoundaries: true
  exclude:
    - "**/*Test.cls"
    - "**/*Mock.cls"
```

Run the analysis:

```bash
# Console output (default)
npx sf-archguard --project /path/to/sfdx-project

# Verbose mode with detailed messages
npx sf-archguard --verbose

# JSON output for scripting
npx sf-archguard --format json --output report.json

# JUnit XML for CI pipelines (Jenkins, GitHub Actions, GitLab CI)
npx sf-archguard --format junit --output archguard-report.xml
```

## CLI Options

| Flag | Description | Default |
|---|---|---|
| `-p, --project <path>` | SFDX project root directory | Current directory |
| `-c, --config <path>` | Path to `archguard.yml` | Auto-detected in project root |
| `-f, --format <format>` | Output: `console`, `json`, or `junit` | `console` |
| `-o, --output <path>` | Write report to file (json/junit) | stdout |
| `-v, --verbose` | Show full violation messages | `false` |
| `--fail-on-violation` | Exit code 1 on violations | `true` |

## How Dependency Rules Work

Dependencies are allowed based on two mechanisms working together:

**Layer rules** define the general direction. A layer can only depend on layers listed in its `dependsOn`. Same-layer references are always allowed (lateral dependencies).

```
integration  -->  service  -->  domain  -->  shared
     \                \            \
      `-> shared       `-> shared   `-> (nothing else)
```

**Package-level `dependsOn`** adds specific exceptions. If `payments` declares `dependsOn: [billing]`, then classes in the payments package can reference billing classes regardless of layer rules.

Same-package references are always allowed — classes within a single package can freely reference each other.

## What Gets Analyzed

**Apex classes and triggers** — the parser detects:
- `extends` / `implements` (inheritance)
- Type usage in declarations (`BillingService svc = ...`)
- Generic type parameters (`List<InvoiceWrapper>`)
- Static method calls (`BillingService.createInvoice()`)
- `new ClassName()` instantiation
- `instanceof` checks and cast expressions
- SOQL `FROM Object__c` references
- Trigger `on SObject` declarations

**Custom objects and fields** — the parser reads `.object-meta.xml` and `.field-meta.xml` to detect:
- Lookup relationships (`referenceTo`)
- Master-Detail relationships (`referenceTo`)
- Formula field object references (`Object__c.Field__c` patterns)

## Project Structure

```
src/
  config/config-loader.ts    # YAML config parsing and validation
  parsers/
    apex-parser.ts           # Apex .cls and .trigger dependency extraction
    object-parser.ts         # Custom object/field metadata parsing
  graph/dependency-graph.ts  # Unified dependency graph builder
  rules/rule-engine.ts       # Rule evaluation (layer, package, object boundaries)
  reporters/
    console-reporter.ts      # Colored terminal output
    json-reporter.ts         # Structured JSON output
    junit-reporter.ts        # JUnit XML for CI systems
  analyzer.ts                # Orchestrates the full pipeline
  cli.ts                     # CLI entry point
  types.ts                   # Shared type definitions
```

## Programmatic API

SF-ArchGuard can be used as a library in custom scripts or SFDX plugins:

```typescript
import { analyze } from 'sf-archguard';

const result = await analyze({
  projectRoot: '/path/to/sfdx-project',
  verbose: true,
});

console.log(`Found ${result.totalViolations} violations`);

for (const ruleResult of result.ruleResults) {
  for (const v of ruleResult.violations) {
    console.log(`${v.sourceNode} -> ${v.targetNode}: ${v.message}`);
  }
}
```

## Running Tests

```bash
npm test
```

The test suite includes fixture Apex classes, object metadata XML, and an `archguard.yml` that exercises all three rules with both valid and invalid dependencies.

## What This Tool Does NOT Do

SF-ArchGuard is intentionally narrow in scope. The following are handled by other tools and should not be duplicated here:

- Code style and formatting (use Prettier, PMD)
- Cyclomatic complexity and method length (use PMD)
- Security scanning (use PMD security rules, Checkmarx)
- SOQL injection detection (use PMD)
- Naming conventions (use PMD)
- Governor limit analysis (use Salesforce Scanner)

## License

MIT
