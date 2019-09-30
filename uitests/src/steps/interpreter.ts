// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import { Given, When } from 'cucumber';
import { ensurePackageIsInstalled, ensurePackageIsNotInstalled, runPythonCommand } from '../helpers/python';

When('I select the Python Interpreter containing the text {string}', async function(text: string) {
    await this.app.interpreters.select({ name: text });
});

// When('I select the default mac Interpreter', async () => {
//     await context.app.workbench.interpreters.selectInterpreter({ tooltip: '/usr/bin/python' });
// });

Given('the package {string} is not installed', async function(moduleName: string) {
    await ensurePackageIsNotInstalled(this.options.pythonPath, moduleName);
});

When('the python command {string} has been executed', async function(command: string) {
    await runPythonCommand(this.options.pythonPath, this.app.workspacePathOrFolder, command);
});

When('I install the package {string}', async function(moduleName: string) {
    await ensurePackageIsInstalled(this.options.pythonPath, moduleName);
});
When('I run the python command {string}', async function(command: string) {
    await runPythonCommand(this.options.pythonPath, this.app.workspacePathOrFolder, command);
});
When('I uninstall the package {string}', async function(moduleName: string) {
    await ensurePackageIsInstalled(this.options.pythonPath, moduleName);
});
Given('the package {string} is installed', async function(moduleName: string) {
    await ensurePackageIsInstalled(this.options.pythonPath, moduleName);
});

// Given('there are no pipenv environments', async () => {
//     await deletePipEnv(context.app);
// });

// Given('there are no virtual environments in the workspace', async () => {
//     await deleteVenvs(context.app);
// });

// Given('there are no virtual environments in the workspace', async () => {
//     await deleteVenvs(context.app);
// });

// Given('some random interpreter is selected', async () => {
//     await selectGenericInterpreter(context.app);
// });

// When('I select some random interpreter', async () => {
//     await selectGenericInterpreter(context.app);
// });

// When('I create a pipenv environment', async () => {
//     await createPipEnv(context.app.activeEnvironment as PipEnvEnviroment, context.app);
// });

// When('I create a venv environment with the name {string}', async (venvName: string) => {
//     const venvEnv = context.app.activeEnvironment as VenvEnviroment;
//     venvEnv.venvArgs = [venvName];
//     await createVenv(venvEnv, context.app);
// });

// When('I change the python path in settings.json to {string}', async (pythonPath: string) => {
//     await updateSetting('python.pythonPath', pythonPath, context.app.workspacePathOrFolder);
// });

// When('I select a python interpreter', async () => {
//     await updateSetting('python.pythonPath', context.app.activeEnvironment.pythonPath!, context.app.workspacePathOrFolder);
//     await sleep(1000);
// });

// Given('there is no python path in settings.json', async () => {
//     await removeSetting('python.pythonPath', context.app.workspacePathOrFolder);
// });

// Then('settings.json will automatically be updated with pythonPath', { timeout: 60000 }, async () => {
//     const currentPythonPath = await getSetting<string | undefined>('python.pythonPath', context.app.workspacePathOrFolder);
//     assert.notEqual(currentPythonPath, undefined);
//     await interpreterInStatusBarDisplaysCorrectPath(currentPythonPath!, context.app);
// });

// Then('the selected interpreter contains the name {string}', async (name: string) => {
//     const pythonPathInSettings = await getSetting<string>('python.pythonPath', context.app.workspacePathOrFolder);
//     const tooltip = getDisplayPath(pythonPathInSettings, context.app.workspacePathOrFolder);

//     const text = await context.app.workbench.statusbar.waitForStatusbarLinkText(tooltip);
//     assert.notEqual(text.indexOf(name), -1, `'${name}' not found in display name`);
// });

// Then('a message containing the text {string} will be displayed', async (message: string) => {
//     await context.app.workbench.quickinput.waitForMessage(message);
//     try {
//         await sleep(100);
//         await context.app.code.waitAndClick('.action-label.icon.clear-notification-action');
//         await sleep(100);
//         await context.app.code.waitAndClick('.action-label.icon.clear-notification-action');
//         await sleep(100);
//     } catch {
//         // Do nothing.
//     }
// });

// Then('interpreter informantion in status bar has refreshed', async () => {
//     const tooltip = getDisplayPath(context.app.activeEnvironment.pythonPath!, context.app.workspacePathOrFolder);
//     const text = await context.app.workbench.statusbar.waitForStatusbarLinkText(tooltip);
//     context.app.activeEnvironment.displayNameParts.forEach(item => {
//         // In the case of pipenv environments, the spaces are replaced with '_'.
//         const parsed = item.replace('/ /g', '_');
//         const found = text.indexOf(item) >= 0 || text.indexOf(parsed) >= 0;
//         assert.equal(found, true, `'${item}' not found in display name`);
//     });
// });
