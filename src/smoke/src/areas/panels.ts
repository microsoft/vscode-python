// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { context } from '../application';
import { retryWrapper, sleep } from '../helpers';
import { getSelector } from '../selectors';

export class Panels {
    public async maximize(): Promise<void> {
        try {
            await context.app.code.waitAndClick(getSelector('MaximizePanel'));
            // Wait for some time for click to take affect.
            await sleep(500);
        } catch {
            // Ignore Errors.
        }
    }
    public async minimize(): Promise<void> {
        try {
            await context.app.code.waitAndClick(getSelector('MinimizePanel'));
            // Wait for some time for click to take affect.
            await sleep(500);
        } catch {
            // Ignore Errors.
        }
    }
    public async waitForContentInOutputPanel(text: string, timeoutSeconds: number = 10) {
        await this.maximize();
        try {
            async function checkOutput() {
                const elements = await context.app.code.waitForElements(getSelector('IndividualLinesInOutputPanel'), true);
                const output = elements.map(element => element.textContent.normalize()).join('');
                if (output.toLowerCase().indexOf(text.toLowerCase()) === -1) {
                    assert.fail(`Message '${text}' not found in Output Panel: [${output}]`);
                }
            }
            await retryWrapper({ timeout: timeoutSeconds * 1000 }, checkOutput);
        } finally {
            await this.minimize();
        }
    }
}
