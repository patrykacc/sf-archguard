const { readFile, writeFile } = require('fs/promises');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runCommand(command, options = {}) {
    console.log(`Executing: ${command}`);
    try {
        const { stdout, stderr } = await execPromise(command, options);
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        return stdout;
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.message);
        process.exit(1);
    }
}

async function main() {
    try {
        // 1. Get current version from package.json
        const packageJsonPath = 'package.json';
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        const currentVersion = packageJson.version;
        console.log(`Current version: ${currentVersion}`);

        // 2. Calculate next patch version
        const versionParts = currentVersion.split('.').map(Number);
        versionParts[2]++; // Increment patch version
        const newVersion = versionParts.join('.');
        console.log(`New version: ${newVersion}`);

        // 3. Update package.json
        packageJson.version = newVersion;
        await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`Updated ${packageJsonPath} to version ${newVersion}`);

        // 4. Update CHANGELOG.md
        const changelogPath = 'CHANGELOG.md';
        let changelogContent = await readFile(changelogPath, 'utf8');
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const newChangelogEntry = `## [${newVersion}] - ${date}

### Changed
- Updated internal components and added path utility for improved parsing.

`;
        
        // Find the position to insert the new entry (below "## [Unreleased]")
        const unreleasedHeader = '## [Unreleased]';
        const insertIndex = changelogContent.indexOf(unreleasedHeader);
        if (insertIndex !== -1) {
            changelogContent = 
                changelogContent.substring(0, insertIndex + unreleasedHeader.length) + 
                '

' + newChangelogEntry + 
                changelogContent.substring(insertIndex + unreleasedHeader.length);
        } else {
            // Fallback if "Unreleased" header is not found, prepend to file
            changelogContent = `# Changelog

${unreleasedHeader}

${newChangelogEntry}${changelogContent.replace('# Changelog', '')}`;
        }
        await writeFile(changelogPath, changelogContent);
        console.log(`Updated ${changelogPath} with entry for ${newVersion}`);

        // 5. Update README.md (basic replacement of old version with new)
        const readmePath = 'README.md';
        let readmeContent = await readFile(readmePath, 'utf8');
        // This is a very basic replacement. A more robust solution would be needed for complex READMEs.
        const oldVersionRegex = new RegExp(currentVersion.replace(/\./g, '\.'), 'g'); // Escape dots for regex
        readmeContent = readmeContent.replace(oldVersionRegex, newVersion);
        await writeFile(readmePath, readmeContent);
        console.log(`Updated ${readmePath} with version ${newVersion}`);

        // 6. Run npm build
        await runCommand('npm run build');

        // 7. git add .
        await runCommand('git add .');

        // 8. git commit
        const commitMessage = `chore(release): ${newVersion}`;
        await runCommand(`git commit -m "${commitMessage}"`);

        // 9. Get current branch name
        const currentBranch = (await runCommand('git rev-parse --abbrev-ref HEAD')).trim();

        // 10. git push
        await runCommand(`git push --set-upstream origin ${currentBranch}`);

        // 11. npm publish
        await runCommand('npm publish');

        console.log(`Successfully released version ${newVersion}!`);

    } catch (error) {
        console.error('Release process failed:', error);
        process.exit(1);
    }
}

main();