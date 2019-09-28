// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import * as assert from 'assert';
import { expect } from 'chai';
import { Given, Then, When } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CucumberRetryMax10Seconds, CucumberRetryMax5Seconds } from '../constants';
import { noop, retryWrapper, sleep } from '../helpers';
import { warn } from '../helpers/logger';
import { IApplication } from '../types';

// tslint:disable-next-line: no-var-requires no-require-imports
const clipboardy = require('clipboardy');

// const autoCompletionListItemSlector = '.editor-widget.suggest-widget.visible .monaco-list-row a.label-name .monaco-highlighted-label';

When('I create a new file', async function() {
    await this.app.documents.createNewUntitledFile();
});

// Create a file in the editor by opening an editor and pasting the code.
// Sending text to the editor is the same as manually typging code.
// This can cause issues, e.g. vsc will auto complete brackets, etc...
// Easiest option, paste the text into the editor.
When('I create a new file with the following content', async function(contents: string) {
    await this.app.documents.createNewUntitledFile();
    await clipboardy.write(contents);
    await this.app.quickopen.runCommand('Paste');
    // Wait for text to get pasted and UI to get updated.
    await sleep(200);
});

Given('a file named {string} is created with the following content', async function(filename: string, contents: string) {
    const fullpath = path.join(this.app.workspacePathOrFolder, filename);
    await fs.ensureDir(path.dirname(fullpath));
    await fs.writeFile(fullpath, contents);
    // Ensure VS Code has had time to refresh to explorer and is aware of the file.
    // Else if we later attempt to open this file, VSC might not be aware of it and woudn't display anything in the `quick open` dropdown.
    const openRecentlyCreatedDocument = async () => {
        await this.app.documents.refreshExplorer();
        // Sometimes VS Code just doesn't know about files created from outside VS Code.
        // Not unless we expand the file explorer.
        // Hopefully we don't have (write) tests where files are created in nested folders and not detected by VSC, but required to be opened.
        const opened = await this.app.quickopen
            .openFile(path.basename(filename))
            .then(() => true)
            .catch(ex => warn(`Failed to open the file '${filename}' in VS Code, but continuing (hopefully file will not have to be opened)`, ex));
        if (opened === true) {
            await this.app.quickopen.runCommand('View: Close Editor');
        }
    };

    await retryWrapper({ timeout: 5000 }, openRecentlyCreatedDocument);
});

When('I change the language of the file to {string}', async function(language: string) {
    await this.app.quickopen.runCommand('Change Language Mode');
    await this.app.quickinput.select({ value: language });
});

When('I go to line {int}', async function(line: number) {
    await this.app.documents.gotToPosition({ line });
});

When('I go to line {int}, column {int}', async function(line: number, column: number) {
    await this.app.documents.gotToPosition({ line, column });
});

Given('the file {string} is open', async function(file: string) {
    await this.app.quickopen.openFile(file);
});

When('I open the file {string}', async function(file: string) {
    await this.app.quickopen.openFile(file);
});

// Wait for some time, possible UI hasn't been updated.
// Its been observed that 2 seconds isn't enough on Mac for Jedi/LS (go to definition).
Then('the cursor is on line {int}', CucumberRetryMax10Seconds, async function(lineNumber: number) {
    const { line } = await this.app.documents.getCurrentPosition();
    assert.equal(line, lineNumber, `Line number ${line} is not same as expected ${lineNumber}`);
});

// Wait for some time, possible UI hasn't been updated.
// Its been observed that 2 seconds isn't enough on Mac for Jedi/LS (go to definition).
Then('auto completion list contains the item {string}', CucumberRetryMax5Seconds, async function(label: string) {
    // tslint:disable-next-line: no-console
    const labels = await this.app.documents.getAutoCompletionList();
    expect(labels).to.contain(label, `Label '${label}' not found in [${labels.join(',')}]`);
});

Then('the file {string} will be opened', async function(file: string) {
    await this.app.documents.waitUntilFileOpened(file);
});

Then('the file {string} is opened', async function(file: string) {
    await this.app.documents.waitUntilFileOpened(file);
});

// Then('a file named {string} is created with the following content', async (fileName: string, contents: string) => {
//     const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
//     await fs.mkdirp(path.dirname(fullFilePath)).catch(noop);
//     await fs.writeFile(fullFilePath, contents);
//     await sleep(1000);
// });

// When('the file {string} has the following content', async (fileName: string, contents: string) => {
//     const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
//     await fs.mkdirp(path.dirname(fullFilePath)).catch(noop);
//     await fs.writeFile(fullFilePath, contents);
//     await sleep(1000);
// });

Given('a file named {string} does not exist', async function(fileName: string) {
    const fullFilePath = path.join(this.app.workspacePathOrFolder, fileName);
    await fs.unlink(fullFilePath).catch(noop);
});

Given('the file {string} does not exist', async function(fileName: string) {
    const fullFilePath = path.join(this.app.workspacePathOrFolder, fileName);
    await fs.unlink(fullFilePath).catch(noop);
    await sleep(1000);
});

// Then('a file named {string} exists', async (fileName: string) => {
//     const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
//     const exists = await fs.pathExists(fullFilePath);
//     expect(exists).to.equal(true, `File '${fullFilePath}' should exist`);
// });

async function expectFile(app: IApplication, fileName: string, timeout = 1000) {
    const checkFile = async () => {
        const fullFilePath = path.join(app.workspacePathOrFolder, fileName);
        const exists = await fs.pathExists(fullFilePath);
        assert.ok(exists, `File '${fullFilePath}' should exist`);
    };
    await retryWrapper({ timeout }, checkFile);
}

Then('a file named {string} will be created', async function(fileName: string) {
    await expectFile(this.app, fileName);
});
Then('a file named {string} is created', async function(fileName: string) {
    await expectFile(this.app, fileName);
});
Then('a file named {string} is created within {int} seconds', async function(fileName: string, seconds: number) {
    await expectFile(this.app, fileName, seconds * 1000);
});

// When(/^I press (.*)$/, async (key: string) => {
//     await context.app.code.dispatchKeybinding(key);
// });

// When('I press {word} {int} times', async (key: string, counter: number) => {
//     for (let i = 0; i <= counter; i += 1) {
//         await context.app.code.dispatchKeybinding(key);
//     }
// });

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
