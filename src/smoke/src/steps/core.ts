// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { Given, Then, When } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { context } from '../application';
import { extensionActivationTimeout } from '../constants';
import { noop, retryWrapper, sleep } from '../helpers';
import { getSelector } from '../selectors';
import { initializeDefaultUserSettings } from '../setup/setup';

Then('Step {string}', async (_step: string) => {
    noop();
});

When('I wait for {int} milliseconds', async (ms: number) => {
    await sleep(ms);
});

When('I open VS Code for the first time', async () => {
    await context.app.stop();
    // Wait for 2 seconds before re-starting.
    // Also delete the downloaded language server.
    await Promise.all([
        new Promise(resolve => rimraf(context.app.userDataPath, resolve)),
        new Promise(resolve => rimraf(path.join(context.app.extensionsPath, '**', 'languageServer.*'), resolve)),
        sleep(2000)
    ]);
    // Restore the user settings.
    await initializeDefaultUserSettings(context.options);
    await context.app.start();
});

Given('VS Code is closed', async () => {
    await context.app.stop();
});

When('I close VS Code', async () => {
    await context.app.stop();
});

When('I start VS Code', async () => {
    await context.app.start();
});

When('I reload VS Code', async () => {
    await context.app.reload();
});

export async function waitForExtensionToActivate(timeoutSeconds: number) {
    await context.app.workbench.quickopen.runCommand('Activate Python Extension');
    await retryWrapper({ timeout: timeoutSeconds * 1000, interval: 100 }, () => context.app.code.waitForElement(getSelector('PyBootstrapActivatedStatusBar')));
}
When('I wait for a maximum of {int} seconds for the Python extension to get activated', async (seconds: number) => {
    await waitForExtensionToActivate(seconds);
});

When('I wait for the Python extension to activate', async () => {
    await waitForExtensionToActivate(extensionActivationTimeout);
});

When('the Python extension has activated', async () => {
    await waitForExtensionToActivate(extensionActivationTimeout);
});

Given('the Python extension has been activated', async () => {
    await waitForExtensionToActivate(extensionActivationTimeout);
});

When('I wait for {int} seconds', async (seconds: number) => {
    await sleep(seconds * 1000);
});

When('I wait for 1 second', async () => {
    await sleep(1000);
});

Then('wait for {int} milliseconds', async (ms: number) => {
    await sleep(ms);
});

Then('wait for 1 second', async () => {
    await sleep(1000);
});

Then('wait for {int} seconds', async (seconds: number) => {
    await sleep(seconds * 1000);
});

Then('take a screenshot', async () => {
    await sleep(500);
    await context.app.captureScreenshot(`take_a_screenshot_${new Date().getTime().toString()}`);
});

Then('log the message {string}', async (message: string) => {
    // tslint:disable-next-line: no-console
    console.info(message);
});

Then('a file named {string} is created with the following contents', async (fileName: string, contents: string) => {
    const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
    await fs.mkdirp(path.dirname(fullFilePath)).catch(noop);
    await fs.writeFile(fullFilePath, contents);
    await context.app.workbench.quickopen.runCommand('File: Refresh Explorer');
});

When('the file {string} has the following content', async (fileName: string, contents: string) => {
    const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
    await fs.mkdirp(path.dirname(fullFilePath)).catch(noop);
    await fs.writeFile(fullFilePath, contents);
    await context.app.workbench.quickopen.runCommand('File: Refresh Explorer');
});

Given('a file named {string} does not exist', async (fileName: string) => {
    const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
    await fs.unlink(fullFilePath).catch(noop);
    await context.app.workbench.quickopen.runCommand('File: Refresh Explorer');
});

Given('the file {string} does not exist', async (fileName: string) => {
    const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
    await fs.unlink(fullFilePath).catch(noop);
    await context.app.workbench.quickopen.runCommand('File: Refresh Explorer');
});

Then('a file named {string} exists', async (fileName: string) => {
    const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
    const exists = await fs.pathExists(fullFilePath);
    expect(exists).to.equal(true, `File '${fullFilePath}' should exist`);
});

async function expectFile(fileName: string) {
    const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
    const exists = await fs.pathExists(fullFilePath);
    expect(exists).to.equal(true, `File '${fullFilePath}' should exist`);
}

Then('a file named {string} will be created', async (fileName: string) => expectFile(fileName));
Then('a file named {string} is created', async (fileName: string) => expectFile(fileName));

Then('a file named {string} is created within {int} seconds', async (fileName: string, seconds: number) => {
    async function checkFile() {
        const fullFilePath = path.join(context.app.workspacePathOrFolder, fileName);
        const exists = await fs.pathExists(fullFilePath);
        expect(exists).to.equal(true, `File '${fullFilePath}' should exist`);
    }
    await retryWrapper({ timeout: seconds * 1000 }, checkFile);
});

When(/^I press (.*)$/, async (key: string) => {
    await context.app.code.dispatchKeybinding(key);
});

When('I press {word} {int} times', async (key: string, counter: number) => {
    for (let i = 0; i <= counter; i += 1) {
        await context.app.code.dispatchKeybinding(key);
    }
});

Then('do nothing', noop);

Then('wip', noop);
