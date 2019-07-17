// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Selector } from '../selectors';
import { IApplication, IDebugger } from '../types';

export class Debugger implements IDebugger {
    constructor(private readonly app: IApplication) { }
    public async isDebugViewOpened(): Promise<boolean> {
        return this.app.driver.$(this.app.getCSSSelector(Selector.DebugActivityBar))
            .then(ele => !!ele).catch(() => false);
    }
    public waitUntilViewOpened(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public waitUntilConsoleOpened(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public waitForConfigPicker(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public selectConfiguration(_configItem: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public waitUntilStarted(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public waitUntilStopped(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public setBreakpointOnLine(_lineNumber: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
