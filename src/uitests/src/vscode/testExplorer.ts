// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Selector } from '../selectors';
import { IApplication, ITestExplorer, TestExplorerNodeStatus, TestExplorerToolbarIcon, TestingAction } from '../types';

export class TestExplorer implements ITestExplorer {
    constructor(private readonly app: IApplication) { }
    public async isOpened(): Promise<boolean> {
        return this.app.driver.$(this.app.getCSSSelector(Selector.TestActivityBar))
            .then(() => true).catch(() => false);
    }
    public async isIconVisible(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public async ensureOpened(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilOpened(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilIconVisible(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilTestsStop(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async expandNodes(_maxNodes?: number | undefined): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async getNodeCount(_maxNodes?: number | undefined): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async selectNode(_label: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilToolbarIconVisible(_icon: TestExplorerToolbarIcon): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async waitUntilToolbarIconHidden(_icon: TestExplorerToolbarIcon): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async clickToolbarIcon(_icon: TestExplorerToolbarIcon): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public async getNodes(): Promise<{ label: string; index: number; status: TestExplorerNodeStatus }> {
        throw new Error('Method not implemented.');
    }
    public async selectActionForNode(_label: string, _action: TestingAction): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
