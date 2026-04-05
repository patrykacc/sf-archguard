---
name: release-patch-version
description: Automates the process of creating a new patch release, including version bumping, updating changelog/package.json, building, committing, pushing to git, and publishing to npm.
---

# Release Patch Version Skill

This skill automates the complete process of performing a patch release for this project. It handles version bumping, updating release notes, building the project, committing changes, pushing to the remote repository, and publishing the package to npm.

## Usage

To use this skill, ensure you are on the `develop` branch (or the branch you intend to release from). The skill will perform the following actions:

1.  **Determine Next Patch Version:** It will read the current version from `package.json` and automatically increment the patch number.
2.  **Update `package.json`:** Sets the new patch version in `package.json`.
3.  **Update `CHANGELOG.md`:** Adds a new entry for the patch version under the "Unreleased" section, detailing generic changes (e.g., "Updated internal components"). *Note: This skill provides a generic changelog entry. For more specific details, you will need to manually edit `CHANGELOG.md` before initiating the release process if the default description is not sufficient.*
4.  **Update `README.md`:** Performs basic version number updates in `README.md` if any references are found. *Note: Comprehensive content changes to `README.md` (e.g., re-writing sections or focusing on specific themes) are outside the scope of this automated skill and should be done manually before running this release process.*
5.  **Build Project:** Executes `npm run build`.
6.  **Commit Changes:** Creates a git commit with a message like `chore(release): <new_version>`.
7.  **Push to Remote:** Pushes the committed changes to the upstream `develop` branch.
8.  **Publish to npm:** Publishes the package to the npm registry.

## How to Trigger

You can ask me to "release a new patch version" or "automate the release process".

## Available Scripts

*   `scripts/run_release.cjs`: This is the main script that orchestrates the entire release process.
