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

You can generate a starter configuration file by running:

```bash
sf archguard init
```

Or, if using the standalone CLI:

```bash
sf-archguard init
```

This will create an `archguard.yml` in your project root (see `archguard.example.yml` for a full template):

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

## When To Use It

SF-ArchGuard is most useful when a Salesforce codebase is split into multiple logical modules that should be developed and deployed separately, while still living in the same repository and SFDX project.

Typical cases:

- Large orgs with distinct domains such as billing, payments, CRM, or notifications
- Teams trying to keep deployments fast by shipping only the affected module
- Projects getting close to Salesforce deployment scale limits, including the 10,000-component limit for a single deployment
- Repositories where architectural boundaries are defined up front, but tend to erode over time during normal feature work

Without automated boundary checks, one module can quietly start depending on another in ways that make separate deployment harder. That usually shows up later as slow deployments, unexpected metadata coupling, or an inability to deploy a large package cleanly because too many components now need to move together.

## Example Project Structure

One common setup is a single repo with subfolders representing modules that should remain independently deployable:

```text
force-app/
  main/
    default/
      billing/
      payments/
      crm/
      notifications/
      core-domain/
      common/
```

Example intent for those folders:

- `billing` contains invoice and receivables logic
- `payments` contains payment gateway integrations
- `crm` contains customer service workflows
- `notifications` contains email, SMS, or platform event delivery
- `core-domain` contains reusable business entities and domain logic
- `common` contains shared technical utilities

In that structure, `payments` may be allowed to depend on `billing`, and both may use `common`, but `common` should not depend on `payments`. A CRM module also should not reach into billing internals just because both folders sit under the same SFDX source tree.

SF-ArchGuard makes those boundaries executable during development, before dependency drift turns into deployment coupling.

When the codebase is split well and those boundaries are actively governed, teams usually get practical delivery benefits as well:

- Easier packaging and clearer ownership of what belongs in each package
- Easier multi-stream development, because teams can work in parallel with less accidental overlap
- More scratch-org-friendly development, since smaller and cleaner module scopes are easier to push and validate
- More deployment-friendly release flows, because the deployable unit stays smaller and more predictable

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

> **Coming Soon:** A dedicated public GitHub Action is in development. It will provide a turnkey setup without needing to write bash scripts, and will natively annotate your pull requests with architectural violations inline!

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

This is especially useful when packages map to deployment units. Keeping dependencies limited to approved layers and explicitly declared package links helps preserve smaller deployment scopes and reduces the risk that unrelated modules must be deployed together.

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

## What This Tool Does NOT Do

SF-ArchGuard is intentionally narrow in scope. The following are handled by other tools and should not be duplicated here:

- Code style and formatting (use Prettier, PMD)
- Cyclomatic complexity and method length (use PMD)
- Security scanning (use PMD security rules, Checkmarx)
- SOQL injection detection (use PMD)
- Naming conventions (use PMD)
- Governor limit analysis (use Salesforce Scanner)

## Community and Contributing

We welcome contributions from the community! Whether it's reporting a bug, proposing a feature, or submitting a pull request, your input helps make `sf-archguard` better.

- **Report Bugs & Request Features:** Please use our GitHub Issue Tracker. We have templates for bug reports and feature requests to make it easier for you to provide the necessary information.
- **Contribute Code:** Read our [CONTRIBUTING.md](./CONTRIBUTING.md) guide for details on our development process and the steps for submitting pull requests.
- **Code of Conduct:** Please review and adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for everyone.

## License

MIT
