# summary

Enforce architecture rules on a Salesforce SFDX project.

# description

Analyzes Apex code and custom object metadata to detect violations of architectural rules defined in archguard.yml. Checks layer dependencies, package boundaries, and object/field relationships.

# examples

- Enforce architecture rules in the current directory:

  <%= config.bin %> <%= command.id %>

- Enforce with a specific config file and verbose output:

  <%= config.bin %> <%= command.id %> --config archguard.yml --verbose

- Enforce and output results as JUnit XML:

  <%= config.bin %> <%= command.id %> --format junit --output report.xml

- Enforce on a specific project directory:

  <%= config.bin %> <%= command.id %> --project-dir ./my-sfdx-project

# flags.project-dir.summary

Project root directory to analyze.

# flags.config.summary

Path to archguard.yml config file.

# flags.format.summary

Output format: console, json, or junit.

# flags.output.summary

Output file path (for json/junit formats).

# flags.verbose.summary

Show detailed violation messages and graph statistics.

# flags.fail-on-violation.summary

Exit with code 1 if violations are found.
