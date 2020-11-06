// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { traceWarning } from './logger';
import { IDisposable } from './types';

/**
 * Responsible for disposing a list of disposables synchronusly.
 */
export class DisposableRegistry implements IDisposable {
    private _list: IDisposable[] = [];

    public dispose(): void {
        this._list.forEach((l, index) => {
            try {
                l.dispose();
            } catch (err) {
                traceWarning(`dispose() #${index} failed (${err})`);
            }
        });
        this._list = [];
    }

    public push(disposable?: IDisposable): void {
        if (disposable) {
            this._list.push(disposable);
        }
    }
}
