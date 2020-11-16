// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-classes-per-file

import { logWarning } from '../../logging';

export interface IDisposable {
    dispose(): void | Promise<void>;
}

export interface IDisposables extends IDisposable {
    push(...disposable: IDisposable[]): void;
}

async function disposeAll(disposables: IDisposable[]): Promise<void> {
    await Promise.all(
        disposables.map(async (d, index) => {
            try {
                await d.dispose();
            } catch (err) {
                logWarning(`dispose() #${index} failed (${err})`);
            }
        })
    );
}

/**
 * A list of disposables.
 */
export class Disposables implements IDisposables {
    private disposables: IDisposable[] = [];

    public push(...disposables: IDisposable[]) {
        this.disposables.push(...disposables);
    }

    public async dispose(): Promise<void> {
        const disposables = this.disposables;
        this.disposables = [];
        await disposeAll(disposables);
    }
}

export interface IActivatable {
    readonly active: boolean;
    activate(): Promise<void>;
    dispose(): Promise<void>;
}

export class Activatable implements IActivatable {
    private pending = false;

    private activated = false;

    private readonly disposables: IDisposable[] = [];

    constructor(
        // The disposables are tracked.
        private readonly doActivation: () => Promise<IDisposable[]>
    ) {}

    public get active(): boolean {
        return this.activated;
    }

    public async activate(): Promise<void> {
        if (this.pending || this.activated) {
            return;
        }
        this.pending = true;
        const disposables = await this.doActivation();
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
        await disposeAll(this.disposables);
        this.pending = false;
    }
}
