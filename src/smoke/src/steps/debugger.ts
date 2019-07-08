// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Then, When } from 'cucumber';
import { context } from '../application';

Then('the Python Debug Configuration picker is displayed', async () => {
    await context.app.workbench.debug.waitForConfigPicker();
});
When('I select the debug configuration {string}', async (configItem: string) => {
    await context.app.workbench.debug.selectConfiguration(configItem);
});
Then('the debugger starts', async () => {
    await context.app.workbench.debug.waitToStart();
});
Then('the debugger pauses', async () => {
    await context.app.workbench.debug.waitToPause();
});
Then('the debugger stops', async () => {
    await context.app.workbench.debug.waitToStop(5);
});
Then('the debugger will stop within {int} seconds', async (timeoutSeconds: number) => {
    await context.app.workbench.debug.waitToStop(timeoutSeconds);
});
Then('the current stack frame is at line {int} in {string}', async (lineNumber: number, fileName: string) => {
    await context.app.workbench.debug.waitForStackFrame(frame => frame.lineNumber === lineNumber && frame.name.includes(fileName), '');
});

When('I add a breakpoint to line {int}', async (line: number) => {
    await context.app.workbench.debug.setBreakpointOnLine(line);
});
When('I add a breakpoint to line {int} in {string}', async (line: number, fileName: string) => {
    await context.app.workbench.quickopen.openFile(fileName);
    await context.app.workbench.debug.setBreakpointOnLine(line);
});

// Given('the debug sidebar is open', async () => {
//     await context.app.workbench.debug.openDebugViewlet();
// });

// When('I configure the debugger', async () => {
//     await context.app.workbench.debug.configure();
// });

// When('stopOnEntry is true in launch.json', async () => {
//     await updateDebugConfiguration('stopOnEntry', true, context.app.workspacePathOrFolder, 0);
// });

// When('stopOnEntry is false in launch.json', async () => {
//     await updateDebugConfiguration('stopOnEntry', false, context.app.workspacePathOrFolder, 0);
// });

// Then('debugger starts', async () => {
//     await sleep(200);
//     await context.app.workbench.debug.debuggerHasStarted();
// });

// When('I open the debug console', async () => {
//     // await context.app.workbench.debug.openDebugConsole();
//     await context.app.workbench.quickopen.runCommand('View: Debug Console');
// });

// Then('number of variables in variable window is {int}', async (count: number) => {
//     await context.app.workbench.debug.waitForVariableCount(count, count);
// });

// When('I step over', async () => {
//     // await context.app.workbench.debug.stepOver();
//     await context.app.workbench.quickopen.runCommand('Debug: Step Over');
// });

// When('I step in', async () => {
//     // await context.app.workbench.debug.stepIn();
//     await context.app.workbench.quickopen.runCommand('Debug: Step Into');
// });

// When('I continue', async () => {
//     // await context.app.workbench.debug.continue();
//     await context.app.workbench.quickopen.runCommand('Debug: Continue');
// });

// Then('stack frame for file {string} is displayed', async (file: string) => {
//     await context.app.workbench.debug.waitForStackFrame(
//         sf => sf.name.indexOf(file) >= 0,
//         'looking for main.py'
//     );
// });

// Then('debugger stops', async () => {
//     await context.app.workbench.debug.debuggerHasStopped();
// });

// Then('stack frame for file {string} and line {int} is displayed', async (file: string, line: number) => {
//     await context.app.workbench.debug.waitForStackFrame(
//         sf => sf.name.indexOf(file) >= 0 && sf.lineNumber === line,
//         'looking for main.py'
//     );
// });

// Then('the text {string} is displayed in the debug console', async (text: string) => {
//     await context.app.workbench.debug.waitForOutput(output => {
//         return output.some(line => line.indexOf(text) >= 0);
//     });
// });
