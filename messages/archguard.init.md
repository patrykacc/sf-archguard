# summary

Initialize a new archguard.yml configuration file.

# description

Generates a well-commented archguard.yml template in the specified project directory to help you get started with Salesforce architecture enforcement. The command will interactively prompt you to auto-scan your project for existing packages.

# examples

- Initialize configuration in the current directory:

  <%= config.bin %> <%= command.id %>

- Initialize configuration in a specific directory:

  <%= config.bin %> <%= command.id %> --project-dir ./my-sfdx-project

# flags.project-dir.summary

Project root directory where archguard.yml will be created.
