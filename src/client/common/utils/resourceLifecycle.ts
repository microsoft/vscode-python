// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposable } from '../types';

interface IDisposables extends IDisposable {
    push(...disposable: IDisposable[]): void;
}

/**
 * Safely dispose each of the disposables.
 */
export async function disposeAll(disposables: IDisposable[]): Promise<void> {
    await Promise.all(
        disposables.map(async (d) => {
            try {
                return Promise.resolve(d.dispose());
            } catch (err) {
                // do nothing
            }
            return Promise.resolve();
        }),
    );
}

/**
 * A list of disposables.
 */
export class Disposables implements IDisposables {
    private disposables: IDisposable[] = [];

    constructor(...disposables: IDisposable[]) {
        this.disposables.push(...disposables);
    }

    public push(...disposables: IDisposable[]): void {
        this.disposables.push(...disposables);
    }

    public async dispose(): Promise<void> {
        const { disposables } = this;
        this.disposables = [];
        await disposeAll(disposables);
    }
}
