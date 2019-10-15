// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import { Then, When } from 'cucumber';
import { CucumberRetryMax5Seconds } from '../constants';

Then('the Python Debug Configuration picker is displayed', async function() {
    await this.app.debugger.waitForConfigPicker();
});
When('I select the debug configuration {string}', async function(configItem: string) {
    await this.app.debugger.selectConfiguration(configItem);
});

Then('the debugger starts', async function() {
    await this.app.debugger.waitUntilStarted();
});

Then('the debugger pauses', async function() {
    await this.app.debugger.waitUntilPaused();
});

Then('the debugger stops', async function() {
    await this.app.debugger.waitUntilStopped();
});

Then('the debugger will stop within {int} seconds', async function(timeoutSeconds: number) {
    await this.app.debugger.waitUntilStopped(timeoutSeconds * 1000);
});
Then('the current stack frame is at line {int} in {string}', CucumberRetryMax5Seconds, async function(line: number, fileName: string) {
    await this.app.documents.waitForActiveEditor(fileName);
    await this.app.documents.waitForPosition({ line });
});

When('I add a breakpoint to line {int}', async function(line: number) {
    await this.app.debugger.setBreakpointOnLine(line);
});
When('I add a breakpoint to line {int} in {string}', async function(line: number, fileName: string) {
    await this.app.quickopen.openFile(fileName);
    await this.app.debugger.setBreakpointOnLine(line);
});

// Given('the debug sidebar is open', async function() {
//     await this.app.debugger.openDebugViewlet();
// });

// When('I configure the debugger', async function() {
//     await this.app.debugger.configure();
// });

// When('stopOnEntry is true in launch.json', async function() {
//     await updateDebugConfiguration('stopOnEntry', true, context.app.workspacePathOrFolder, 0);
// });

// When('stopOnEntry is false in launch.json', async function() {
//     await updateDebugConfiguration('stopOnEntry', false, context.app.workspacePathOrFolder, 0);
// });

// Then('debugger starts', async function() {
//     await sleep(200);
//     await this.app.debugger.debuggerHasStarted();
// });

// When('I open the debug console', async function() {
//     // await this.app.debugger.openDebugConsole();
//     await context.app.workbench.quickopen.runCommand('View: Debug Console');
// });

// Then('number of variables in variable window is {int}', async function(count: number) {
//     await this.app.debugger.waitForVariableCount(count, count);
// });

// When('I step over', async function() {
//     // await this.app.debugger.stepOver();
//     await context.app.workbench.quickopen.runCommand('Debug: Step Over');
// });

// When('I step in', async function() {
//     // await this.app.debugger.stepIn();
//     await context.app.workbench.quickopen.runCommand('Debug: Step Into');
// });

// When('I continue', async function() {
//     // await this.app.debugger.continue();
//     await context.app.workbench.quickopen.runCommand('Debug: Continue');
// });

// Then('stack frame for file {string} is displayed', async function(file: string) {
//     await this.app.debugger.waitForStackFrame(
//         sf => sf.name.indexOf(file) >= 0,
//         'looking for main.py'
//     );
// });

// Then('debugger stops', async function() {
//     await this.app.debugger.debuggerHasStopped();
// });

// Then('stack frame for file {string} and line {int} is displayed', async function(file: string, line: number) {
//     await this.app.debugger.waitForStackFrame(
//         sf => sf.name.indexOf(file) >= 0 && sf.lineNumber === line,
//         'looking for main.py'
//     );
// });

// Then('the text {string} is displayed in the debug console', async function(text: string) {
//     await this.app.debugger.waitForOutput(output => {
//         return output.some(line => line.indexOf(text) >= 0);
//     });
// });
