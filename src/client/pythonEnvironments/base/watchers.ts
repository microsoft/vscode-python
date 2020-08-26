// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event } from 'vscode';
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
