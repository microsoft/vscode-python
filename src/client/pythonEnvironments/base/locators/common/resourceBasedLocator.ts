// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { DisposableRegistry } from '../../../../common/syncDisposableRegistry';
import { logWarning } from '../../../../logging';
import { Locator, } from '../../locator';

// TODO: Move `Activatable` and friends to an appropriate location.  (`src/client/common/utils/resources`?)

export interface IDisposable {
    dispose(): void | Promise<void>;
}

export interface IActivatable {
    activate(): Promise<void>;
    dispose(): Promise<void>;
    readonly active: boolean;
}

class Activatable implements IActivatable {
    private pending = false;

    private activated = false;

    private readonly disposables: IDisposable[] = [];

    constructor(
        private readonly do_activation: () => Promise<IDisposable[]>,
    ) {}

    public async activate(): Promise<void> {
        if (this.pending || this.activated) {
            return;
        }
        this.pending = true;
        const disposables = await this.do_activation();
        this.disposables.push(...disposables);
        this.pending = false;
        this.activated = true;
    }

    public async dispose(): Promise<void> {
        if (this.pending || !this.activated) {
            return;
        }
        this.pending = true;
        this.activated = false;
        await Promise.all(
            this.disposables.map(async (d, index) => {
                try {
                    await d.dispose();
                } catch (err) {
                    logWarning(`dispose() #${index} failed (${err})`);
                }
            }),
        );
        this.pending = false;
    }

    public get active(): boolean {
        return this.activated;
    }
}

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
    protected readonly disposables = new DisposableRegistry();

    public dispose(): void {
        this.disposables.dispose();
    }
}
