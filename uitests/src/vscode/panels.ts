// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { noop, retryWrapper, sleep } from '../helpers';
import '../helpers/extensions';
import { debug } from '../helpers/logger';
import { Selector } from '../selectors';
import { IApplication, IPanels } from '../types';

export class Panels implements IPanels {
    constructor(private readonly app: IApplication) {}
    public async maximize(): Promise<void> {
        debug('Maximize panels');
        await this.app.driver
            .click(this.app.getCSSSelector(Selector.MaximizePanel))
            // Wait for some time for click to take affect.
            .then(() => sleep(500))
            // Ignore Errors.
            .catch(noop);
    }
    public async minimize(): Promise<void> {
        debug('Minimize panels');
        await this.app.driver
            .click(this.app.getCSSSelector(Selector.MinimizePanel))
            // Wait for some time for click to take affect.
            .then(() => sleep(500))
            // Ignore Errors.
            .catch(noop);
    }
    public async waitUtilContent(text: string, timeoutSeconds: number = 10) {
        await this.maximize();
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
            await this.minimize();
        }
    }
}
