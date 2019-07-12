// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { Then } from 'cucumber';
import { context } from '../application';
import { CucumberRetryMax20Seconds } from '../constants';
import { retryWrapper, sleep } from '../helpers';

Then('close notifications', async () => {
    await context.app.workbench.notifications.closeMessages();
});

async function notificationDisplayed(message: string, timeoutSeconds: number = 10) {
    async function checkMessages() {
        const hasMessages = await context.app.workbench.notifications.hasMessages();
        expect(hasMessages).to.be.equal(true, 'No messages displayed');
        const messages = await context.app.workbench.notifications.getMessages();
        if (messages.findIndex(item => item.toLowerCase().indexOf(message.toLowerCase()) >= 0) === -1) {
            assert.fail(`Message '${message}' not found in [${messages.join(',')}]`);
        }
    }
    await retryWrapper({ timeout: timeoutSeconds * 1000 }, checkMessages);
}

Then('there are no notifications', async () => {
    const hasMessages = await context.app.workbench.notifications.hasMessages();
    assert.ok(!hasMessages);
});

Then('a message with the text {string} is displayed', async (message: string) => {
    await notificationDisplayed(message);
});

Then('a message containing the text {string} is displayed', async (message: string) => {
    await notificationDisplayed(message);
});

Then('a message containing the text {string} will be displayed within {int} seconds', async (message: string, timeoutSeconds: number) => {
    await notificationDisplayed(message, timeoutSeconds);
});

/**
 * Checks whether a message is not displayed.
 * If it is, then an assertion error is thrown.
 *
 * @param {string} message
 * @returns
 */
async function messageIsNotDisplayed(message: string) {
    const hasMessages = await context.app.workbench.notifications.hasMessages();
    if (!hasMessages) {
        return;
    }
    const messages = await context.app.workbench.notifications.getMessages();
    if (messages.findIndex(item => item.toLowerCase().indexOf(message.toLowerCase()) >= 0) !== -1) {
        assert.fail(`Message '${message}' found in [${messages.join(',')}]`);
    }
}
Then('a message containing the text {string} is not displayed', messageIsNotDisplayed);

Then('I click the {string} button for the message with the text {string}', CucumberRetryMax20Seconds, async (button: string, message: string) => {
    await notificationDisplayed(message, 2);
    await context.app.workbench.notifications.dismiss([{ buttonText: button, content: message }], 2);
    // We might have to retry closing the message as its possible a new message was displayed in the mean time.
    // In which case closing the message won't work.
    // Imagine you as a user are about to close a message, then a new message appears! It doesn't work!
    await messageIsNotDisplayed(message);
    // Wait for state to get updated (e.g. if we're dismissing one time messages, then this state needs to be persisted).
    await sleep(500);
});
