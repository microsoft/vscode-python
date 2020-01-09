// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { sleep, StopWatch } from '../helpers';
import '../helpers/extensions';
import { debug, warn } from '../helpers/logger';
import { Selector } from '../selectors';
import { IApplication, INotifications } from '../types';

export class Notifications implements INotifications {
    constructor(private readonly app: IApplication) {}
    public hasMessages(type?: 'error'): Promise<boolean> {
        const selector = type === 'error' ? Selector.NotificationError : Selector.Notification;
        return this.app.driver
            .$$(this.app.getCSSSelector(selector))
            .then(eles => Array.isArray(eles) && eles.length > 0)
            .catch(() => false);
    }
    public getMessages(): Promise<string[]> {
        return this.app.driver.$$eval(this.app.getCSSSelector(Selector.IndividualNotification), elements =>
            elements.map(ele => ele.textContent || '').filter(text => text.length > 0)
        );
    }
    /**
     * Possibly a faster way would be to find the first visible message in UI, then look for it in the array.
     *
     * @param {({ content: string; buttonText?: string | undefined }[])} messages
     * @param {number} timeout
     * @returns {Promise<void>}
     * @memberof Notifications
     */
    public async dismiss(messages: { content: string; buttonText?: string | undefined }[], timeout: number): Promise<void> {
        const stopwatch = new StopWatch();
        const _closeNotifications = async (): Promise<void> => {
            if (messages.length === 0) {
                return;
            }
            const count = await this.getMessages().then(msgs => msgs.length);
            if (count === 0) {
                return;
            }

            // tslint:disable-next-line: prefer-array-literal
            for (const i of [...new Array(count).keys()]) {
                // Check if we can find a notification with this message.
                const selector = this.app.getCSSSelector(Selector.NthNotificationMessage).format((i + 1).toString());
                const textContent = await this.app.driver
                    .$$eval(selector, elements => elements.reduce<string>((content, element) => element.textContent || content, ''))
                    .catch(warn.bind(warn, `Failed to get content of notification with selector '${selector}'`));

                if (!textContent) {
                    continue;
                }

                debug(`Found notification '${textContent}'.`);
                // Find a notification that matches this message.
                const message = messages.find(msg => textContent.normalize().startsWith(msg.content));
                if (!message) {
                    // warn(`Unknown notification ${textContent}. Not dismissed!`);
                    continue;
                }

                const closeSelector = message.buttonText
                    ? this.app.getCSSSelector(Selector.ButtonInNthNotification).format((i + 1).toString(), message.buttonText)
                    : this.app.getCSSSelector(Selector.CloseButtonInNthNotification).format((i + 1).toString());

                // If we found a notification with this message, then use the selector to dismiss it.
                const failed = await this.app.driver
                    .click(closeSelector)
                    // Wait for message to get clicked and dissappear.
                    .then(() => sleep(200))
                    .catch(() => true);

                if (!failed) {
                    debug(`Dismissed message '${message.content}`);
                    // Continue dismissing other messages.
                    return _closeNotifications();
                }
                messages.push(message);
            }

            if (stopwatch.elapsedTime > timeout) {
                return;
            }
            await _closeNotifications();
        };
        await _closeNotifications();
    }
}
