// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Selector } from '../selectors';
import { IApplication, IQuickInput } from '../types';

export class QuickInput implements IQuickInput {
    constructor(private readonly app: IApplication) {}
    public async select(options: { value: string } | { index: number }): Promise<void> {
        await this.waitUntilOpened();

        if ('value' in options) {
            const selector = this.app.getCSSSelector(Selector.QuickInputInput);
            await this.app.driver.type(selector, options.value);
        } else {
            throw new Error('Selecting input in QuickInput with index not supported');
        }

        // await this.app.captureScreenshot('Filtered Interpreter List');
        await this.app.driver.press('Enter');
        await this.waitUntilClosed();
    }
    public async close(): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.QuickInputInput);
        const failed = await this.app.driver.focus(selector).catch(() => true);
        if (failed) {
            return;
        }
        await this.app.driver.press('Escape');
        await this.waitUntilClosed();
    }
    public async waitUntilOpened(retryCount?: number | undefined): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.QuickInputInput);
        // const retryOptions: SelectorRetryOptions = retryCount ? { retryCount } : { retryTimeout: 5000 };
        // await this.app.driver.$(selector, retryOptions).catch(() => true);
        await this.app.driver.waitForSelector(selector, {
            visible: true,
            timeout: retryCount ? retryCount * 100 : 5000
        });
    }
    // @retry(RetryMax5Seconds)
    public async waitUntilClosed(): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.QuickInput);
        await this.app.driver.waitForSelector(selector, { hidden: true, timeout: 5000 });
    }
}
