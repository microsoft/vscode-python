// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { Then } from 'cucumber';
import { context } from '../application';
import { retryWrapper } from '../helpers';

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

Then('a message containing the text {string} is not displayed', async (message: string) => {
    const hasMessages = await context.app.workbench.notifications.hasMessages();
    if (!hasMessages) {
        return;
    }
    const messages = await context.app.workbench.notifications.getMessages();
    if (messages.findIndex(item => item.toLowerCase().indexOf(message.toLowerCase()) >= 0) !== -1) {
        assert.fail(`Message '${message}' found in [${messages.join(',')}]`);
    }
});

Then('I click the {string} button for the message with the text {string}', async (button: string, message: string) => {
    await notificationDisplayed(message);
    await context.app.workbench.notifications.dismiss([{ buttonText: button, content: message }]);
});
