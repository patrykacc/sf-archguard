# SF-ArchGuard

Architecture enforcement for Salesforce SFDX projects. Think [ArchUnit](https://www.archunit.org/) but for Salesforce — define layers, assign packages to them, and let the tool catch illegal cross-package dependencies in your Apex classes, triggers, and custom object relationships.

SF-ArchGuard focuses exclusively on **structural and architectural rules**. It does not duplicate PMD, ESLint, or other linting tools — there are no code style, complexity, or security checks here.

## What It Checks

- **Layer dependency direction** — a service-layer package cannot depend on an integration-layer package
- **Package boundaries** — Apex classes can only reference classes from the same package, an allowed layer, or an explicitly declared dependency
- **Object boundaries** — Custom object lookups and master-detail relationships respect the same package/layer rules

## Installation

**As a Salesforce CLI plugin** (recommended for SFDX projects):
```bash
sf plugins install sf-archguard
```

**As a standalone global CLI**:
```bash
npm install -g sf-archguard
sf-archguard --help
```

**As a library** (for programmatic use — see [Programmatic API](#programmatic-api)):
```bash
npm install sf-archguard
```

## Quick Start

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
sf archguard enforce

# Target a specific project directory
sf archguard enforce --project-dir /path/to/sfdx-project

# Verbose mode with detailed messages
sf archguard enforce --verbose

# JSON output for scripting
sf archguard enforce --format json --output report.json

# JUnit XML for CI pipelines (Jenkins, GitHub Actions, GitLab CI)
sf archguard enforce --format junit --output archguard-report.xml
```

## Command Reference

### `sf archguard enforce`

| Flag | Short | Description | Default |
|---|---|---|---|
| `--project-dir <path>` | `-p` | SFDX project root directory | Current directory |
| `--config <path>` | `-c` | Path to `archguard.yml` | Auto-detected in project root |
| `--format <format>` | `-f` | Output: `console`, `json`, or `junit` | `console` |
| `--output <path>` | `-o` | Write report to file (json/junit) | stdout |
| `--verbose` | `-v` | Show full violation messages | `false` |
| `--[no-]fail-on-violation` | | Exit code 1 on violations | `true` |

### Standalone CLI: `sf-archguard`

When installed globally via `npm install -g sf-archguard`, use the `sf-archguard` command directly (no Salesforce CLI required):

| Flag | Short | Description | Default |
|---|---|---|---|
| `--project <path>` | `-p` | Project root directory | Current directory |
| `--config <path>` | `-c` | Path to `archguard.yml` | Auto-detected in project root |
| `--format <format>` | `-f` | Output: `console`, `json`, or `junit` | `console` |
| `--output <path>` | `-o` | Write report to file (json/junit) | stdout |
| `--verbose` | `-v` | Verbose output | `false` |
| `--[no-]fail-on-violation` | | Exit code 1 on violations | `true` |

```bash
sf-archguard --project ./myproject --format junit --output archguard-report.xml
```

> Note: the standalone CLI uses `--project` while the SF plugin uses `--project-dir`. Both accept the same path.

## CI Integration

Use the JUnit output format to surface violations in any CI pipeline:

**GitHub Actions:**
```yaml
- name: Enforce architecture
  run: sf archguard enforce --format junit --output archguard-report.xml

- name: Publish test results
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: archguard-report.xml
    check_name: Architecture Violations
```

**Fail the build on violations** (default `--fail-on-violation` is `true`; disable with `--no-fail-on-violation` for report-only mode).

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

## Programmatic API

SF-ArchGuard can be used as a library in custom scripts or SFDX plugins:

```typescript
import { analyze } from 'sf-archguard';

const result = await analyze({
  projectRoot: '/path/to/sfdx-project',
  configPath: 'archguard.yml',  // optional, auto-detected if omitted
  verbose: true,
});

console.log(`Found ${result.totalViolations} violations`);

for (const ruleResult of result.ruleResults) {
  for (const v of ruleResult.violations) {
    console.log(`${v.sourceNode} -> ${v.targetNode}: ${v.message}`);
  }
}
```

Custom rules can be registered by passing an array to `evaluateRules(graph, config, customRules)` directly.

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
