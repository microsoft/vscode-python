// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activatable, Disposables, IActivatable, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { Locator } from '../../locator';

/**
 * A locator that has resources to be activated and disposed.
 */
export abstract class ResourceBasedLocator extends Locator implements IActivatable {
    private activatable: Activatable;

    constructor() {
        super();
        this.activatable = new Activatable(
            () => this.do_activation(),
        );
    }

    public async activate(): Promise<void> {
        await this.activatable.activate();
    }

    public async dispose(): Promise<void> {
        await this.activatable.dispose();
    }

    public get active(): boolean {
        return this.activatable.active;
    }

    protected abstract async do_activation(): Promise<IDisposable[]>;
}

/**
 * A locator that has things to dispose.
 */
export abstract class DisposableLocator extends Locator {
    protected readonly disposables = new Disposables();

    public dispose(): void {
        this.disposables.dispose();
    }
}
