// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ok } from 'assert';
import { RetryMax10Seconds, RetryMax5Seconds } from '../constants';
import { retry } from '../helpers';
import { Selector } from '../selectors';
import { IApplication, IDebugger } from '../types';

export class Debugger implements IDebugger {
    constructor(private readonly app: IApplication) {}
    public async isDebugViewOpened(): Promise<boolean> {
        return this.app.driver
            .$(this.app.getCSSSelector(Selector.DebugActivityBar))
            .then(ele => !!ele)
            .catch(() => false);
    }
    public async waitUntilViewOpened(): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.DebugActivityBar));
    }
    public waitUntilConsoleOpened(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    @retry(RetryMax5Seconds)
    public async waitForConfigPicker(): Promise<void> {
        const selector = this.app.getCSSSelector(Selector.DebugConfigurationPickerDropDownInput);
        const text = this.app.localization.get('debug.selectConfigurationTitle');
        const found = await this.app.driver.$$eval(
            selector,
            (elements, textToSearch) => {
                return elements.find(element => (element.textContent || '').includes(textToSearch)) !== undefined;
            },
            text
        );
        ok(found);
    }
    public async selectConfiguration(value: string): Promise<void> {
        await this.app.quickinput.select({ value });
    }
    @retry(RetryMax10Seconds)
    public async waitUntilStarted(): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.DebugToolbar));
    }
    public async waitUntilStopped(timeout: number = 10_000): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.DebugToolbar), {
            timeout,
            hidden: true
        });
    }

    @retry(RetryMax10Seconds)
    public async waitUntilPaused(): Promise<void> {
        const iconSelector = this.app.getCSSSelector(Selector.DebugToolbarIcon);
        const predicateToFindTitleWithContinue = (elements: Element[]) => elements.find(element => (element.getAttribute('title') || '').includes('Continue')) !== undefined;
        const found = await this.app.driver.$$eval(iconSelector, predicateToFindTitleWithContinue);
        ok(found);
    }
    public async setBreakpointOnLine(line: number): Promise<void> {
        await this.app.documents.gotToPosition({ line });
        await this.app.quickopen.runCommand('Debug: Toggle Breakpoint');
    }
}
