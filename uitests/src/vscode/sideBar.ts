// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { RetryMax5Seconds } from '../constants';
import { retry } from '../helpers';
import { Selector } from '../selectors';
import { IApplication, ISideBar } from '../types';

export class SideBar implements ISideBar {
    private readonly app: IApplication;
    constructor(app: IApplication) {
        this.app = app;
    }
    public isVisible(): Promise<boolean> {
        const selector = this.app.getCSSSelector(Selector.SideBar);
        return this.app.driver
            .$eval(selector, element => element.getBoundingClientRect().width || 0)
            .then(width => width > 0)
            .catch(() => false);
    }
    public async show(): Promise<void> {
        if (await this.isVisible()) {
            return;
        }
        await this.app.quickopen.runCommand('View: Toggle Side Bar Visibility');
        await this.waitUntilVisible(true);
    }
    public async hide(): Promise<void> {
        if (!(await this.isVisible())) {
            return;
        }
        await this.app.quickopen.runCommand('View: Toggle Side Bar Visibility');
        await this.waitUntilVisible(false);
    }
    @retry(RetryMax5Seconds)
    private async waitUntilVisible(visible: boolean): Promise<void> {
        const currentVisibilityState = await this.isVisible();
        assert.equal(currentVisibilityState, visible);
    }
}
