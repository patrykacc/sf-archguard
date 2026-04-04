# Contributing to SF-ArchGuard

First off, thank you for considering contributing to SF-ArchGuard! It's people like you that make this tool useful for the Salesforce developer community.

## Where do I go from here?

If you've noticed a bug or have a feature request, please [open an issue](../../issues) using the provided templates. It's best to discuss your idea in an issue before writing any code.

## Setting up your development environment

1. **Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) version 18 or later installed.
2. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/sf-archguard.git
   cd sf-archguard
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Build the project:**
   ```bash
   npm run build
   ```

## Development Workflow

- **Testing:** We use Jest for testing. Before submitting a pull request, ensure all tests pass:
  ```bash
  npm test
  ```
  When adding new features or fixing bugs, please include relevant tests in the `tests/` directory.

- **Linting and Type Checking:** Maintain code quality by running:
  ```bash
  npm run lint
  ```
  Ensure there are no TypeScript errors.

- **Running locally:** You can test your local changes by running the CLI directly from the source:
  ```bash
  npm run start -- enforce --project-dir /path/to/test/sfdx-project
  ```

## Submitting a Pull Request

1. **Fork the repository** and create your branch from `main`.
2. **Keep changes focused:** If you are adding a new feature or fixing a bug, please keep the scope of the PR limited to that specific change.
3. **Test your changes:** Ensure that `npm test` and `npm run lint` pass. Add tests for new behavior.
4. **Update Documentation:** If you change command behavior, configuration formats, or add new rules, please update `README.md` and any relevant documentation.
5. **Describe Salesforce assumptions:** Since this tool deals with Salesforce metadata, clearly state any assumptions you've made about how Salesforce or SFDX behaves in your PR description.
6. **Open the PR:** Use the provided Pull Request template and fill in the details.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md). We expect all contributors to be respectful and welcoming.
