// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { retryWrapper } from '../helpers';
import '../helpers/extensions';
import { Selector } from '../selectors';
import { IApplication, IStatusBar } from '../types';

export class StatusBar implements IStatusBar {
    constructor(private readonly app: IApplication) {}
    public async hidePythonStatusBarItem(): Promise<void> {
        // We make the assumption that the first Python statusbar item is the one that contains the interpreter info.
        const selector = this.app.getCSSSelector(Selector.PythonExtensionStatusBar);
        await this.app.driver.$$eval(selector, eles => {
            if (eles.length === 0) {
                return;
            }
            eles[0].parentNode!.removeChild(eles[0]);
        });
    }
    public getPythonStatusBarText(): Promise<string> {
        const selector = this.app.getCSSSelector(Selector.PythonExtensionStatusBar);
        return this.app.driver.$eval(selector, ele => ele.textContent || '').then(text => text.normalize());
    }
    public async waitUntilPythonItemVisible(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilBootstrapItemVisible(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilStatusBarItemWithText(text: string, timeout: number = 3_000): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.StatusBarItem);

        const lookForStatusBarItem = async () => {
            const found = await this.app.driver
                .$$eval(selector, (eles, textToSearch) => eles.findIndex(ele => (ele.textContent || '').indexOf(textToSearch) >= 0) >= 0, text)
                .catch(() => false);

            assert.ok(found, `Statubar item '${text}' not found`);
        };

        await retryWrapper({ timeout }, lookForStatusBarItem);
    }
    public async waitUntilNoStatusBarItemWithText(text: string, timeout: number = 3_000): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.StatusBarItem);

        const lookForStatusBarItem = async () => {
            const notFound = await this.app.driver
                .$$eval(selector, (eles, textToSearch) => eles.findIndex(ele => (ele.textContent || '').indexOf(textToSearch) >= 0) === -1, text)
                .catch(() => false);

            assert.ok(notFound, `Statubar item '${text}' found, when it should not exist`);
        };

        await retryWrapper({ timeout }, lookForStatusBarItem);
    }
}
