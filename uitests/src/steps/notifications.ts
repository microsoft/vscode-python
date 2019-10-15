// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import * as assert from 'assert';
import { expect } from 'chai';
import { Then } from 'cucumber';
import { CucumberRetryMax20Seconds } from '../constants';
import { retryWrapper, sleep } from '../helpers';
import { debug } from '../helpers/logger';
import { IApplication } from '../types';

async function notificationDisplayed(app: IApplication, message: string, timeout: number = 10_000) {
    async function checkMessages() {
        const hasMessages = await app.notifications.hasMessages();
        debug(`Has Messages ${hasMessages}`);
        expect(hasMessages).to.be.equal(true, 'No messages displayed');
        const messages = await app.notifications.getMessages();
        if (messages.findIndex(item => item.toLowerCase().indexOf(message.toLowerCase()) >= 0) === -1) {
            assert.fail(`Message '${message}' not found in [${messages.join(',')}]`);
        }
    }
    await retryWrapper({ timeout }, checkMessages);
}

Then('no notifications are displayed', async function() {
    const hasMessages = await this.app.notifications.hasMessages();
    assert.ok(!hasMessages);
});

Then('no error notifications are displayed', async function() {
    const hasMessages = await this.app.notifications.hasMessages('error');
    assert.ok(!hasMessages);
});

Then('a message with the text {string} is displayed', async function(message: string) {
    await notificationDisplayed(this.app, message);
});

Then('a message containing the text {string} is displayed', async function(message: string) {
    await notificationDisplayed(this.app, message);
});

Then('a message containing the text {string} will be displayed within {int} seconds', async function(message: string, timeoutSeconds: number) {
    await notificationDisplayed(this.app, message, timeoutSeconds * 1000);
});

/**
 * Checks whether a message is not displayed.
 * If it is, then an assertion error is thrown.
 *
 * @param {string} message
 * @returns
 */
async function messageIsNotDisplayed(app: IApplication, message: string) {
    // Wait for a max of 5 seconds for messages to appear.
    // If it doesn't appear within this period, then assume everyting is ok.
    await sleep(5000);

    const hasMessages = await app.notifications.hasMessages();
    if (!hasMessages) {
        return;
    }
    const messages = await app.notifications.getMessages();
    if (messages.findIndex(item => item.toLowerCase().indexOf(message.toLowerCase()) >= 0) !== -1) {
        assert.fail(`Message '${message}' found in [${messages.join(',')}]`);
    }
}
Then('a message containing the text {string} is not displayed', async function(message: string) {
    await messageIsNotDisplayed(this.app, message);
});

Then('I click the {string} button for the message with the text {string}', CucumberRetryMax20Seconds, async function(button: string, message: string) {
    await notificationDisplayed(this.app, message);
    await this.app.notifications.dismiss([{ buttonText: button, content: message }], 2);
    // We might have to retry closing the message as its possible a new message was displayed in the mean time.
    // In which case closing the message won't work.
    // Imagine you as a user are about to close a message, then a new message appears! It doesn't work!
    await messageIsNotDisplayed(this.app, message);
    // Wait for state to get updated (e.g. if we're dismissing one time messages, then this state needs to be persisted).
    await sleep(500);
});
