// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { retryWrapper } from '../helpers';
import '../helpers/extensions';
import { debug } from '../helpers/logger';
import { Selector } from '../selectors';
import { IApplication, IPanels } from '../types';

export class Panels implements IPanels {
    constructor(private readonly app: IApplication) {}
    public async maximize(): Promise<void> {
        if (await this.isMaximized()) {
            return;
        }
        debug('Maximize panels');
        await this.app.quickopen.runCommand('View: Toggle Maximized Panel');
    }
    public async minimize(): Promise<void> {
        if (!(await this.isMaximized())) {
            return;
        }
        debug('Minimize panels');
        await this.app.quickopen.runCommand('View: Toggle Maximized Panel');
    }
    public async waitUtilContent(text: string, timeoutSeconds: number = 10) {
        await this.app.captureScreenshot('Step1');
        await this.maximize();
        // Hide the side bar to enure contents in output panels do not wrap.
        // If they wrap, the contents could scroll, meaning they aren't visible (not rendered in HTML).
        // We want them visible so we can use the dom queries to check the contents.
        await this.app.shideBar.hide();
        await this.app.captureScreenshot('Step3');
        const selector = this.app.getCSSSelector(Selector.IndividualLinesInOutputPanel);
        debug(`Look for the content '${text} in the panel ${selector}`);
        try {
            const checkOutput = async () => {
                debug(`Looking for the content '${text} in the panel`);
                const output = await this.app.driver
                    // Join without spaces, as its possible we have multiple elements, that may not necessarily break at words.
                    // I.e. it might break in the middle of a word.
                    .$$eval(selector, elements => elements.map(element => element.textContent || '').join(''));
                debug(`Content in output panel is '${output}'`);
                if (
                    output
                        .normalize()
                        .toLowerCase()
                        .includes(text.toLowerCase())
                ) {
                    return Promise.resolve();
                }

                debug('Content not found');
                return Promise.reject(new Error(`Message '${text}' not found in Output Panel: [${output}]`));
            };
            await retryWrapper({ timeout: timeoutSeconds * 1000 }, checkOutput);
        } finally {
            await this.app.captureScreenshot('Step6');
            // Restore.
            await this.app.shideBar.show();
            await this.minimize();
            await this.app.captureScreenshot('Step8');
        }
    }
    private isMaximized(): Promise<boolean> {
        // Don't look for the max button.
        // Sometimes we have other HTML elements (VS Code Notification messages) displayed over the panel resize icon.
        // If this happens we assume the panels have not been maximized (else we have 5-6 messages that span vertically to the top of the VS Code screen).
        return this.app.driver
            .$(this.app.getCSSSelector(Selector.MinimizePanel))
            .then(() => true)
            .catch(() => false);
    }
}
