// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import * as colors from 'colors';
import { Given, Then, When } from 'cucumber';
import { extensionActivationTimeout } from '../constants';
import { noop, sleep } from '../helpers';
import { waitForPythonExtensionToActivate } from '../setup';

Then('do nothing', noop);

Then('kaboom', () => {
    throw new Error('Kaboom');
});

Then('wip', noop);

Then('Step {string}', async (_step: string) => {
    noop();
});

Given('VS Code is opened for the first time', async function() {
    await this.app.exit();
    await this.app.start(true);
});

When('I open VS Code for the first time', async function() {
    await this.app.exit();
    await this.app.start(true);
});

Given('VS Code is closed', function() {
    return this.app.exit();
});

When('I close VS Code', function() {
    return this.app.exit();
});

When('I start VS Code', function() {
    return this.app.start();
});

When('I reload VS Code', function() {
    return this.app.reload();
});

When('I wait for a maximum of {int} seconds for the Python extension to get activated', async function(seconds: number) {
    await waitForPythonExtensionToActivate(seconds * 1000, this.app);
});

When('I wait for the Python extension to activate', async function() {
    await waitForPythonExtensionToActivate(extensionActivationTimeout, this.app);
});

When('the Python extension has activated', async function() {
    await waitForPythonExtensionToActivate(extensionActivationTimeout, this.app);
});

Given('the Python extension has been activated', async function() {
    await waitForPythonExtensionToActivate(extensionActivationTimeout, this.app);
});

When('I wait for {int} second(s)', async (seconds: number) => sleep(seconds * 1000));

Then('wait for {int} millisecond(s)', sleep);

When('I wait for {int} millisecond(s)', sleep);

Then('wait for {int} second(s)', (seconds: number) => sleep(seconds * 1000));

Then('take a screenshot', async function() {
    // await sleep(500);
    await this.app.captureScreenshot(`take_a_screenshot_${new Date().getTime().toString()}`);
});

// tslint:disable-next-line: no-console
Then('log the message {string}', (message: string) => console.info(colors.green(message)));

When(/^I press (.*)$/, async function(key: string) {
    await this.app.driver.press(key);
});

When('I press {word} {int} times', async function(key: string, counter: number) {
    for (let i = 0; i <= counter; i += 1) {
        await this.app.driver.press(key);
    }
});
