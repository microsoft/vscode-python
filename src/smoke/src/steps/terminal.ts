// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// import * as assert from 'assert';
// import { Given, Then, When } from 'cucumber';
// import { sleep } from '../helpers';
// import { updateSetting } from '../helpers/settings';
// import { getPythonPathInActiveTerminal } from '../tests/terminal/activation.test';
// import { fileWillRunInActivatedEnvironment } from '../tests/terminal/helper';
// import { context } from './app';

// Given('"python.terminal.activateEnvironment:{word}" in settings.json', async (enabled: 'true' | 'false') => {
//     await updateSetting('python.terminal.activateEnvironment', enabled === 'true', context.app.workspacePathOrFolder);
//     await sleep(100);
// });

// When('I open a new terminal', async () => {
//     await context.app.workbench.quickopen.runCommand('Terminal: Create New Integrated Terminal');
//     await sleep(context.app.activeEnvironment.delayForActivation);
// });

// When('I send the command {string} to the terminal', async (command: string) => {
//     await context.app.workbench.terminal.runCommand(command);
// });

// When('a python file run in the terminal will run in the activated environment', async () => {
//     await fileWillRunInActivatedEnvironment(context.app);
// });

// Then('the text {string} will be displayed in the terminal', async (text: string) => {
//     await context.app.workbench.terminal.waitForTerminalText((lines: string[]) => lines.indexOf(text) >= 0);
// });

// Then('the text {string} and {string} will be displayed in the terminal', async (text1: string, text2: string) => {
//     const predicate = (buffer: string[]) => {
//         if (buffer.some(line => line.indexOf(text1) >= 0) &&
//             buffer.some(line => line.indexOf(text2) >= 0)) {
//             return true;
//         }
//         return false;
//     };
//     await context.app.workbench.terminal.waitForTerminalText(predicate);
// });

// Then('the text {string} will not be displayed in the terminal', async (text: string) => {
//     await context.app.workbench.terminal.waitForTerminalText((lines: string[]) => lines.indexOf(text) === -1);
// });

// Then('environment will auto-activate in the terminal', async () => {
//     await context.app.workbench.quickopen.runCommand('Terminal: Create New Integrated Terminal');
//     await sleep(context.app.activeEnvironment.delayForActivation);
//     try {
//         const pythonPath = await getPythonPathInActiveTerminal(context.app);
//         assert.equal(pythonPath, context.app.activeEnvironment.pythonPath!);
//     } finally {
//         await context.app.workbench.terminal.closeTerminal();
//     }
// });

// Then('environment will not auto-activate in the terminal', async () => {
//     await context.app.workbench.quickopen.runCommand('Terminal: Create New Integrated Terminal');
//     await sleep(context.app.activeEnvironment.delayForActivation);
//     try {
//         const pythonPath = await getPythonPathInActiveTerminal(context.app);
//         assert.notEqual(pythonPath, context.app.activeEnvironment.pythonPath!);
//     } finally {
//         await context.app.workbench.terminal.closeTerminal();
//     }
// });
