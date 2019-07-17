// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { Given, Then, When } from 'cucumber';
import { context } from '../application';
import { CucumberRetryMax10Seconds, CucumberRetryMax5Seconds } from '../constants';
// tslint:disable-next-line: no-var-requires no-require-imports
const clipboardy = require('clipboardy');

const autoCompletionListItemSlector = '.editor-widget.suggest-widget.visible .monaco-list-row a.label-name .monaco-highlighted-label';

When('I create a new file', async () => {
    await context.app.workbench.editors.newUntitledFile();
});

// Create a file in the editor by opening an editor and pasting the code.
// Sending text to the editor is the same as manually typging code.
// This can cause issues, e.g. vsc will auto complete brackets, etc...
// Easiest option, paste the text into the editor.
When('I create a new file with the following content', async (contents: string) => {
    await context.app.workbench.editors.newUntitledFile();
    await clipboardy.write(contents);
    await context.app.workbench.quickopen.runCommand('Paste');
});

When('I change the language of the file to {string}', async (language: string) => {
    await context.app.workbench.quickopen.runCommand('Change Language Mode');
    await context.app.workbench.quickinput.waitForQuickInputOpened();
    await context.app.workbench.quickinput.selectValue(language);
    await context.app.code.dispatchKeybinding('enter');
    await context.app.workbench.quickinput.waitForQuickInputClosed();
});

When('I go to line {int}', async (line: number) => {
    await context.app.workbench.editor.gotToLine(line);
});

When('I go to line {int}, column {int}', async (line: number, column: number) => {
    await context.app.workbench.editor.gotToLine(line);
    await context.app.workbench.editor.gotToColumn(column);
});

Given('the file {string} is open', async (file: string) => {
    await context.app.workbench.quickopen.openFile(file);
});

When('I open the file {string}', async (file: string) => {
    await context.app.workbench.quickopen.openFile(file);
});

// Wait for some time, possible UI hasn't been updated.
// Its been observed that 2 seconds isn't enough on Mac for Jedi/LS (go to definition).
Then('the cursor is on line {int}', CucumberRetryMax10Seconds, async (lineNumber: number) => {
    const { line } = await context.app.workbench.editor.getCurrentLineColumn();
    assert.equal(line, lineNumber, `Line number ${line} is not same as expected ${lineNumber}`);
});

// Wait for some time, possible UI hasn't been updated.
// Its been observed that 2 seconds isn't enough on Mac for Jedi/LS (go to definition).
Then('auto completion list contains the item {string}', CucumberRetryMax5Seconds, async (label: string) => {
    const elements = await context.app.code.waitForElements(autoCompletionListItemSlector, true);
    const labels = elements.map(element => element.textContent.trim());
    expect(labels).to.contain(label, `Label '${label}' not found in [${labels.join(',')}]`);
});

Then('the file {string} will be opened', async (file: string) => {
    await context.app.workbench.editors.waitForFileToOpen(file);
});

Then('the file {string} is opened', async (file: string) => {
    await context.app.workbench.editors.waitForFileToOpen(file);
});
// Then('code lens {string} is visible in {int} seconds', async (title: string, timeout: number) => {
//     const retryInterval = 200;
//     const retryCount = timeout * 1000 / 200;
//     const eles = await context.app.code.waitForElements('div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration a', true, undefined, retryCount, retryInterval);
//     const expectedLenses = eles.filter(item => item.textContent.trim().indexOf(title) === 0);
//     expect(expectedLenses).to.be.lengthOf.greaterThan(0);
// });
// Then('code lens {string} is visible', async (title: string) => {
//     const eles = await context.app.code.waitForElements('div[id="workbench.editors.files.textFileEditor"] span.codelens-decoration a', true);
//     const expectedLenses = eles.filter(item => item.textContent.trim().indexOf(title) === 0);
//     expect(expectedLenses).to.be.lengthOf.greaterThan(0);
// });

// Given('the file {string} does not exist', async (file: string) => {
//     const filePath = path.join(context.app.workspacePathOrFolder, file);
//     if (await fs.pathExists(filePath)) {
//         await fs.unlink(filePath);
//     }
// });

// When('I open the file {string}', async (file: string) => {
//     await context.app.workbench.quickopen.openFile(file);
// });

// Given('the file is scrolled to the top', async () => {
//     await context.app.workbench.quickopen.runCommand('Go to Line...');
//     await context.app.workbench.quickopen.waitForQuickOpenOpened(10);
//     await context.app.code.dispatchKeybinding('1');
//     await context.app.code.dispatchKeybinding('Enter');
//     await sleep(100);
// });

// Given('the file {string} is updated with the value {string}', async (file: string, value: string) => {
//     await fs.writeFile(path.join(context.app.workspacePathOrFolder, file), value);
// });

// When('I update file {string} with value {string}', async (file: string, value: string) => {
//     await fs.writeFile(path.join(context.app.workspacePathOrFolder, file), value);
// });

// When('I select the text {string} in line {int} of file {string}', async (selection: string, line: number, file: string) => {
//     await context.app.workbench.editor.clickOnTerm(file, selection, line);
// });

// When('I set cursor to line {int} of file {string}', async (line: number, file: string) => {
//     await context.app.workbench.editor.waitForEditorFocus(file, line);
// });

// When('I press {string}', async (keyStroke: string) => {
//     await context.app.code.dispatchKeybinding(keyStroke);
// });

// Then('line {int} of file {string} will be highlighted', async (line: number, file: string) => {
//     await context.app.workbench.editor.waitForHighlightingLine(file, line);
// });

// Then('text {string} will appear in the file {string}', async (text: number, file: string) => {
//     await context.app.workbench.editor.waitForEditorContents(file, contents => contents.indexOf(`${text}`) > -1);
// });

// When('I type the text {string} into the file {string}', async (text: string, file: string) => {
//     await context.app.workbench.editor.waitForTypeInEditor(file, text);
// });

// When('I go to definition for {string} in line {int} of file {string}', async (selection: string, line: number, file: string) => {
//     await context.app.workbench.quickopen.openFile(file);
//     await context.app.workbench.editor.clickOnTerm(file, selection, line);
//     await context.app.code.dispatchKeybinding('right');
//     await context.app.code.dispatchKeybinding('F12');
// });
