// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { QuickOpen } from '../../../../out/smoke/vscode/areas/quickopen/quickopen';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { noop, sleep, StopWatch } from '../helpers';
import '../helpers/extensions';
import { getSelector } from '../selectors';

const messageBoxContainer = 'div.notifications-toasts.visible div.notification-toast-container';
const messageBoxSelector = `${messageBoxContainer} div.notification-list-item-message span`;
// const firstMessageBoxCloseSelector = 'div.notifications-toasts.visible div.notification-toast-container:nth-child(1) a.action-label.icon.clear-notification-action';

type Notification = {
    content: string;
    buttonText?: string;
};

export class Notifications {

    constructor(private code: Code, private quickopen: QuickOpen) { }
    public async hasMessages(): Promise<boolean> {
        try {
            // await this.code.waitForElement('div.notifications-toasts.visible', undefined, 1);
            await this.code.waitForElement(getSelector('Notification'), undefined, 1);
            return true;
        } catch {
            return false;
        }
    }
    public async  getMessages(): Promise<string[]> {
        if (!await this.hasMessages()) {
            return [];
        }
        const elements = await this.code.waitForElements(messageBoxSelector, true);
        return elements.map(item => item.textContent.normalize());
    }

    public async  getNotifications(): Promise<string[]> {
        if (!await this.hasMessages()) {
            return [];
        }
        const elements = await this.code.waitForElements(messageBoxContainer, true);
        return elements.map(item => item.textContent.normalize());
    }

    public async  closeMessages() {
        await this.quickopen.runCommand('Notifications: Clear All Notifications');
    }
    public async dismiss(messages: Notification[], timeout: number = 1_000): Promise<void> {
        const stopwatch = new StopWatch();
        const _closeNotifications = async (): Promise<void> => {
            if (messages.length === 0) {
                return;
            }
            const count = await this.getNotificationCount();
            if (count === 0) {
                return;
            }

            // tslint:disable-next-line: prefer-array-literal
            for (const i of [...new Array(count).keys()]) {
                const message = messages.shift()!;

                // Check if we can find a notification with this message.
                const selector = getSelector('NthNotification').format((i + 1).toString());
                const predicate = (content: string) => content.toLowerCase().normalize().includes(message.content.toLowerCase());
                if (await context.app.code.waitForTextContent(selector, message.content, predicate, { retryCount: 1 }).catch(noop)) {
                    const closeSelector = message.buttonText ?
                        getSelector('ButtonInNthNotification').format((i + 1).toString(), message.buttonText) :
                        getSelector('CloseButtonInNthNotification').format((i + 1).toString());

                    // If we found a notification with this message, then use the selector to dismiss it.
                    await context.app.code.waitAndClick(closeSelector).catch(noop);

                    // Wait for message to get clicked and dissappear.
                    await sleep(200);

                    // Continue dismissing other messages.
                    return _closeNotifications();
                }
                messages.push(message);
            }
            return stopwatch.elapsedTime > timeout ? undefined : _closeNotifications();
        };

        await _closeNotifications();
    }
    private getNotificationCount() {
        const notifications = getSelector('Notification');
        return context.app.code.waitForElements(notifications, true, undefined, { retryCount: 20 }).catch(() => []).then(items => items.length);
    }
}
