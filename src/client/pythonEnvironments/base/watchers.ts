// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Event } from 'vscode';
import { Disableable } from '../../common/utils/misc';
import { IPythonEnvsWatcher, PythonEnvsChangedEvent, PythonEnvsWatcher } from './watcher';

/**
 * A wrapper around a set of watchers.
 *
 * If any of the wrapped watchers emits an event then this wrapper
 * emits that event.
 */
export class PythonEnvsWatchers {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;
    private watcher = new PythonEnvsWatcher();

    constructor(watchers: ReadonlyArray<IPythonEnvsWatcher>) {
        this.onChanged = this.watcher.onChanged;
        watchers.forEach((w) => {
            w.onChanged((e) => this.watcher.fire(e));
        });
    }
}

// tslint:disable-next-line:no-any
type EnvsEventListener = (e: PythonEnvsChangedEvent) => any;

/**
 * A watcher wrapper that can be disabled.
 *
 * If disabled, events emitted by the wrapped watcher are discarded.
 */
export class DisableableEnvsWatcher extends Disableable {
    constructor(
        // To wrap more than one use `PythonEnvWatchers`.
        private readonly wrapped: IPythonEnvsWatcher
    ) {
        super();
    }

    // tslint:disable-next-line:no-any
    public onChanged(listener: EnvsEventListener, thisArgs?: any, disposables?: Disposable[]): Disposable {
        return this.wrapped.onChanged(
            (e: PythonEnvsChangedEvent) => {
                if (this.isEnabled) {
                    listener(e);
                }
            },
            thisArgs,
            disposables
        );
    }
}
