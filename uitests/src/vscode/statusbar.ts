// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '../helpers/extensions';
import { Selector } from '../selectors';
import { IApplication, IStatusBar } from '../types';

export class StatusBar implements IStatusBar {
    constructor(private readonly app: IApplication) {}
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
}
