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

export async function disposeAll(disposables: IDisposable[]): Promise<void> {
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
