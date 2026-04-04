# Changelog

All notable changes to this project should be recorded here.

## [Unreleased]

## [0.2.0] - 2026-04-04

### Added
- `archguard init` command generates a starter `archguard.yml` and auto-discovers packages.
  - Reads source roots from `sfdx-project.json` `packageDirectories` when present.
  - Falls back to an interactive prompt for the source directory when no `sfdx-project.json` is found.
  - Discovers packages by locating `*-meta.xml` files and deriving the parent of any standard SFDX metadata-type folder (classes, objects, triggers, lwc, …) as the package root.
  - Supports non-interactive use via `--source-dir <path>` and `--no-scan` flags.
  - Narrates each step of the discovery process so users can see exactly what the tool is doing.
- Configurable violation severity via `rules.severity` (`error` | `warning`). Warnings surface in reports but do not fail the build.
- `AnalysisResult` now exposes `totalErrors` and `totalWarnings` counts in addition to `totalViolations`.
- Community scaffolding: `CODE_OF_CONDUCT.md`, GitHub issue templates, and pull request template.

### Changed
- `--fail-on-violation` now keys on error-severity violations only; warnings no longer fail the build.
- Console reporter differentiates errors vs. warnings with distinct icons and colors.
- Expanded `CONTRIBUTING.md` with onboarding, workflow, and PR guidelines.

### Fixed
- Trailing duplicated content removed from `README.md`.

## [0.1.0] - Initial release

- Initial CI-driven release automation.
- Clean JSON/JUnit output for machine consumers.
- Added release verification and OSS support files.
