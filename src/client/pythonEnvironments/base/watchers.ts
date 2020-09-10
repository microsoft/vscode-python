// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Event } from 'vscode';
import { IPythonEnvsWatcher, PythonEnvsChangedEvent, PythonEnvsWatcher } from './watcher';

/**
 * A wrapper around a set of watchers, exposing them as a single watcher.
 *
 * If any of the wrapped watchers emits an event then this wrapper
 * emits that event.
 */
export class PythonEnvsWatchers implements IPythonEnvsWatcher {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;
    private watcher = new PythonEnvsWatcher();

    constructor(watchers: ReadonlyArray<IPythonEnvsWatcher>) {
        this.onChanged = this.watcher.onChanged;
        watchers.forEach((w) => {
            w.onChanged((e) => this.watcher.fire(e));
        });
    }
}

// This matches the `vscode.Event` arg.
type EnvsEventListener = (e: PythonEnvsChangedEvent) => unknown;

/**
 * A watcher wrapper that can be disabled.
 *
 * If disabled, events emitted by the wrapped watcher are discarded.
 */
export class DisableableEnvsWatcher implements IPythonEnvsWatcher {
    protected enabled = true;
    constructor(
        // To wrap more than one use `PythonEnvWatchers`.
        private readonly wrapped: IPythonEnvsWatcher
    ) {}

    /**
     * Ensure that the watcher is enabled.
     */
    public enable() {
        this.enabled = true;
    }

    /**
     * Ensure that the watcher is disabled.
     */
    public disable() {
        this.enabled = false;
    }

    // This matches the signature of `vscode.Event`.
    public onChanged(listener: EnvsEventListener, thisArgs?: unknown, disposables?: Disposable[]): Disposable {
        return this.wrapped.onChanged(
            (e: PythonEnvsChangedEvent) => {
                if (this.enabled) {
                    listener(e);
                }
            },
            thisArgs,
            disposables
        );
    }
}
