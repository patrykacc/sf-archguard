import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';
import { confirm, input } from '@inquirer/prompts';
import { glob } from 'glob';
import { toPosixPath } from '../../parsers/path-utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-archguard', 'archguard.init');

export interface InitFlags {
  'project-dir': string;
  scan?: boolean;
  sourceDir?: string;
}

export interface DiscoveredPackage {
  name: string;
  path: string;
}

export interface InitLogger {
  log: (msg: string) => void;
  error: (msg: string) => void;
}

// Standard SFDX metadata-type folder names. A package root is the parent of any of these.
const METADATA_TYPE_FOLDERS = new Set([
  'classes', 'triggers', 'objects', 'lwc', 'aura', 'flows',
  'pages', 'components', 'tabs', 'layouts', 'permissionsets',
  'profiles', 'applications', 'flexipages', 'staticresources',
  'labels', 'customMetadata', 'contentassets', 'email',
  'reports', 'dashboards', 'queues', 'groups', 'roles',
  'workflows', 'quickActions', 'globalValueSets', 'standardValueSets',
  'remoteSiteSettings', 'connectedApps', 'namedCredentials',
  'cspTrustedSites', 'customPermissions', 'escalationRules',
  'assignmentRules', 'autoResponseRules', 'sharingRules'
]);

/**
 * Reads sfdx-project.json and returns the declared packageDirectories paths.
 * Returns null if the file is missing, malformed, or has no packageDirectories.
 */
export function readSfdxPackageDirectories(projectRoot: string): string[] | null {
  const sfdxProjectPath = path.join(projectRoot, 'sfdx-project.json');
  if (!fs.existsSync(sfdxProjectPath)) return null;
  try {
    const raw = fs.readFileSync(sfdxProjectPath, 'utf8');
    const data = JSON.parse(raw) as { packageDirectories?: Array<{ path?: string }> };
    const dirs = (data.packageDirectories ?? [])
      .map(d => d.path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    return dirs.length > 0 ? dirs : null;
  } catch {
    return null;
  }
}

/**
 * Scans a source root for *-meta.xml files and derives archguard packages.
 * A package root is identified as the parent directory of any standard
 * SFDX metadata-type folder (classes, objects, triggers, ...).
 * If the source root itself contains metadata-type folders directly, it is
 * treated as a single package.
 */
export function discoverPackagesInRoot(
  projectRoot: string,
  sourceRootAbs: string
): DiscoveredPackage[] {
  if (!fs.existsSync(sourceRootAbs)) return [];

  const metaFiles = glob.sync('**/*-meta.xml', {
    cwd: sourceRootAbs,
    nodir: true,
    absolute: true,
  });

  const packageRoots = new Set<string>();
  for (const file of metaFiles) {
    let current = path.dirname(file);
    while (current && current !== path.dirname(current)) {
      const name = path.basename(current);
      if (METADATA_TYPE_FOLDERS.has(name)) {
        const pkgRoot = path.dirname(current);
        if (pkgRoot !== sourceRootAbs && pkgRoot.startsWith(sourceRootAbs)) {
          packageRoots.add(pkgRoot);
        } else if (pkgRoot === sourceRootAbs) {
          packageRoots.add(sourceRootAbs);
        }
        break;
      }
      if (current === sourceRootAbs) break;
      current = path.dirname(current);
    }
  }

  return Array.from(packageRoots)
    .sort()
    .map(abs => ({
      name: path.basename(abs),
      path: toPosixPath(path.relative(projectRoot, abs)),
    }));
}

/**
 * Orchestrates package discovery across all known source roots, narrating
 * each step via the supplied logger so the user understands what happens.
 */
export function discoverPackages(
  projectRoot: string,
  explicitSourceDir: string | undefined,
  logger: InitLogger
): DiscoveredPackage[] {
  let sourceRoots: string[];

  if (explicitSourceDir) {
    logger.log(`Using provided source directory: ${explicitSourceDir}`);
    sourceRoots = [explicitSourceDir];
  } else {
    logger.log('Looking for sfdx-project.json in project root...');
    const fromSfdx = readSfdxPackageDirectories(projectRoot);
    if (fromSfdx && fromSfdx.length > 0) {
      logger.log(`Found sfdx-project.json with ${fromSfdx.length} packageDirectories: ${fromSfdx.join(', ')}`);
      sourceRoots = fromSfdx;
    } else {
      logger.log('No sfdx-project.json (or no packageDirectories) found.');
      sourceRoots = [];
    }
  }

  if (sourceRoots.length === 0) {
    return [];
  }

  const all: DiscoveredPackage[] = [];
  const seen = new Set<string>();
  for (const root of sourceRoots) {
    const abs = path.isAbsolute(root) ? root : path.join(projectRoot, root);
    if (!fs.existsSync(abs)) {
      logger.log(`  - ${root}: directory does not exist, skipping.`);
      continue;
    }
    logger.log(`  Scanning ${root} for *-meta.xml files...`);
    const found = discoverPackagesInRoot(projectRoot, abs);
    if (found.length === 0) {
      logger.log(`    No packages discovered under ${root}.`);
      continue;
    }
    logger.log(`    Found ${found.length} package(s): ${found.map(p => p.name).join(', ')}`);
    for (const pkg of found) {
      if (!seen.has(pkg.path)) {
        seen.add(pkg.path);
        all.push(pkg);
      }
    }
  }

  return all;
}

function renderPackagesSection(packages: DiscoveredPackage[]): string {
  if (packages.length === 0) {
    return `packages:
  # Example: A core domain package
  core-domain:
    path: force-app/main/default/core-domain
    layer: domain

  # Example: A service package
  billing:
    path: force-app/main/default/billing
    layer: service

  # Example: An integration package with a specific dependency exception
  payments:
    path: force-app/main/default/payments
    layer: integration
    dependsOn: [billing]   # payments can explicitly use billing classes

  # Example: A shared utilities package
  common:
    path: force-app/main/default/common
    layer: shared`;
  }

  let out = 'packages:\n';
  packages.forEach(pkg => {
    out += `  ${pkg.name}:\n    path: ${pkg.path}\n    layer: domain # TODO: assign correct layer\n\n`;
  });
  return out.trimEnd();
}

export function generateConfig(packages: DiscoveredPackage[]): string {
  const packagesSection = renderPackagesSection(packages);
  return `# SF-ArchGuard Configuration Example
#
# This file defines the architectural rules for your Salesforce SFDX project.
# It helps you enforce package boundaries and layer dependencies.
#
# Place this file as \`archguard.yml\` in your project root.

# ─── Layer Definitions ────────────────────────────────────────
# Layers define the dependency direction. A layer can only depend
# on layers listed in its \`dependsOn\` array.
#
# Example hierarchy:
#   integration -> service -> domain -> shared
#
# In this example, the integration layer can use classes from the
# service, domain, and shared layers. The shared layer cannot
# depend on anything else.

layers:
  - name: integration
    dependsOn: [service, domain, shared]

  - name: service
    dependsOn: [domain, shared]

  - name: domain
    dependsOn: [shared]

  - name: shared
    dependsOn: []

# ─── Package Definitions ─────────────────────────────────────
# Each package maps to a folder in your SFDX project.
# - \`path\`: relative path from project root
# - \`layer\`: which architectural layer this package belongs to
# - \`dependsOn\`: explicit cross-package dependencies (optional)
#   Use this for specific exceptions beyond layer rules.
#
# For example, if you have a \`payments\` package that needs to
# access \`billing\` classes directly despite layer restrictions,
# you can explicitly declare it here.

${packagesSection}

# ─── Global Rules ─────────────────────────────────────────────

rules:
  # Default severity for violations ('error' or 'warning')
  severity: error

  # Enforce that Apex classes respect package boundaries
  enforcePackageBoundaries: true

  # Enforce that custom objects (Lookups, Master-Detail) respect package boundaries
  enforceObjectBoundaries: true

  # Exclude test classes, mock factories, and specific files from analysis
  exclude:
    - "**/*Test.cls"
    - "**/*Mock.cls"
    - "**/*TestDataFactory.cls"
`;
}

export function executeInit(
  flags: InitFlags,
  dependencies: InitLogger = {
    log: (msg) => console.log(msg),
    error: (msg) => {
      throw new Error(msg);
    },
  }
): void {
  const projectRoot = path.resolve(flags['project-dir']);
  const configPath = path.join(projectRoot, 'archguard.yml');

  dependencies.log(`Initializing archguard config in ${projectRoot}`);

  if (fs.existsSync(configPath)) {
    dependencies.error(`Configuration file already exists at ${configPath}`);
    return;
  }

  let packages: DiscoveredPackage[] = [];
  if (flags.scan) {
    dependencies.log('');
    dependencies.log('Discovering packages...');
    packages = discoverPackages(projectRoot, flags.sourceDir, dependencies);
    dependencies.log('');
  } else {
    dependencies.log('Scan disabled; generating template with example packages.');
  }

  fs.writeFileSync(configPath, generateConfig(packages), 'utf8');
  dependencies.log(`Successfully created ${configPath}`);
  if (flags.scan) {
    if (packages.length > 0) {
      dependencies.log(
        `Auto-populated ${packages.length} package(s). Please review the assigned layers in archguard.yml.`
      );
    } else {
      dependencies.log('No packages discovered; wrote template with example packages. Edit archguard.yml to describe your project.');
    }
  }
}

export default class ArchguardInit extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'project-dir': Flags.directory({
      char: 'p',
      summary: messages.getMessage('flags.project-dir.summary'),
      default: '.',
      exists: true,
    }),
    yes: Flags.boolean({
      char: 'y',
      summary: 'Skip confirmation prompts and proceed with scanning (for CI).',
      default: false,
    }),
    'no-scan': Flags.boolean({
      summary: 'Skip package scanning; emit template only.',
      default: false,
    }),
    'source-dir': Flags.directory({
      summary: 'Source directory to scan (overrides sfdx-project.json).',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ArchguardInit);
    const projectRoot = path.resolve(flags['project-dir'] as string);

    const assumeYes = flags.yes === true;
    const noScan = flags['no-scan'] === true;
    let sourceDir: string | undefined = flags['source-dir'] as string | undefined;
    const isInteractive = process.stdin.isTTY === true && process.stdout.isTTY === true;

    let scan = !noScan;

    if (scan && !sourceDir) {
      if (assumeYes) {
        const sfdxDirs = readSfdxPackageDirectories(projectRoot);
        if (!sfdxDirs) {
          this.log('No sfdx-project.json found — defaulting source directory to "force-app".');
          sourceDir = 'force-app';
        } else {
          this.log(`Will use packageDirectories from sfdx-project.json: ${sfdxDirs.join(', ')}`);
        }
      } else if (!isInteractive) {
        this.log(
          'Non-interactive environment detected; re-run with --yes to scan or --no-scan to skip package discovery.'
        );
        scan = false;
      } else {
        scan = await confirm({
          message: 'Scan your project for existing packages to auto-populate the config?',
          default: true,
        });
        if (scan) {
          const sfdxDirs = readSfdxPackageDirectories(projectRoot);
          if (!sfdxDirs) {
            this.log('No sfdx-project.json found — cannot read packageDirectories.');
            sourceDir = await input({
              message: 'Enter the relative path to your source directory:',
              default: 'force-app',
            });
          } else {
            this.log(`Will use packageDirectories from sfdx-project.json: ${sfdxDirs.join(', ')}`);
          }
        }
      }
    }

    const executeFlags: InitFlags = {
      'project-dir': flags['project-dir'] as string,
      scan,
      sourceDir,
    };

    try {
      executeInit(executeFlags, {
        log: (msg) => this.log(msg),
        error: (msg) => this.error(msg),
      });
    } catch (err) {
      this.error((err as Error).message);
    }
  }
}
