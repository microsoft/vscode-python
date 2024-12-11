const fs = require('fs');

const packageJsonPath = './package.json';

function checkProposedApiChanges() {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const { enabledApiProposals, engines } = packageJson;
    const vscodeEngineVersion = engines.vscode;

    const originalPackageJson = JSON.parse(fs.readFileSync(packageJsonPath + '.original', 'utf8'));
    const originalEnabledApiProposals = originalPackageJson.enabledApiProposals;
    const originalVscodeEngineVersion = originalPackageJson.engines.vscode;

    if (JSON.stringify(enabledApiProposals) !== JSON.stringify(originalEnabledApiProposals) &&
        vscodeEngineVersion === originalVscodeEngineVersion) {
        console.error('Error: `enabledApiProposals` was modified but `vscode` engine version was not updated.');
        process.exit(1);
    }
}

checkProposedApiChanges();
