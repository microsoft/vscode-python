// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { sleep } from '../helpers';
import { Selector } from '../selectors';
import { IApplication, IQuickInput } from '../types';

export const delaysAfterTyping = 200;

export class QuickInput implements IQuickInput {
    constructor(private readonly app: IApplication) { }
    public async select(options: { value: string } | { index: number }): Promise<void> {
        await this.waitUntilOpened();

        if ('value' in options) {
            const selector = this.app.getCSSSelector(Selector.QuickInputInput);
            await this.app.driver.type(selector, options.value);
            // Wait for text to be typed in (sometimes having this delay helps).
            // Not doing this sometimes results in value not being entered in input box.
            // Hopefully we don't need bigger delays on CI.
            // Cause is the fact that typing into thie textbox causes vscode to filter
            //  the dropdown list. If we don't waait long enough, then an item isn't selected
            //  in the dropdown list, meaning the necessary action isn't performed.
            // Works much like an html dropdown, we need to wait for UI to react to the input
            //  before we can hit the enter key.
            // We don't need this delay when selecting files from quickopen or selecting
            //  commands from quick open, as we wait for those items to get highlighted in the dropdown.
            // Here we're not waiting for someting to get highlighted, that's where the problem lies.
            await sleep(delaysAfterTyping);
        } else {
            throw new Error('Selecting input in QuickInput with index not supported');
        }

        // await this.app.captureScreenshot('Filtered Interpreter List');
        await this.app.driver.keyboard.press('Enter');
        await this.waitUntilClosed();
    }
    public async close(): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.QuickInputInput);
        const failed = await this.app.driver.focus(selector).catch(() => true);
        if (failed) {
            return;
        }
        await this.app.driver.keyboard.press('Escape');
        await this.waitUntilClosed();
    }
    public async waitUntilOpened(retryCount?: number | undefined): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.QuickInputInput);
        // const retryOptions: SelectorRetryOptions = retryCount ? { retryCount } : { retryTimeout: 5000 };
        // await this.app.driver.$(selector, retryOptions).catch(() => true);
        await this.app.driver.waitForSelector(selector, { visible: true, timeout: (retryCount ? retryCount * 100 : 5000) });
    }
    // @retry(RetryMax5Seconds)
    public async waitUntilClosed(): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.QuickInput);
        await this.app.driver.waitForSelector(selector, { hidden: true, timeout: 5000 });
        // const css = await this.app.driver.$eval(selector, ele => ele && (getComputedStyle(ele).display || ''));
        // debug(css);
        // const found = await this.app.driver.$eval(selector, ele => ele && (getComputedStyle(ele).display || '').includes('none'));
        // if (!found) {
        //     throw new Error('Quick input not closed, retrying');
        // }
    }
}
