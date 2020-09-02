// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-classes-per-file

import { Event, EventEmitter, Uri } from 'vscode';
import { PythonEnvKind } from './info';

/**
 * The most basic info for a Python environments event.
 *
 * @prop kind - the env kind, if any, affected by the event
 */
export type BasicPythonEnvsChangedEvent = {
    kind?: PythonEnvKind;
};

/**
 * The full set of possible info for a Python environments event.
 *
 * @prop searchLocation - the location, if any, affected by the event
 */
export type PythonEnvsChangedEvent = BasicPythonEnvsChangedEvent & {
    searchLocation?: Uri;
};

/**
 * A "watcher" for events related to changes to Python environemts.
 *
 * The watcher will notify listeners (callbacks registered through
 * `onChanged`) of events at undetermined times.  The actual emitted
 * events, their source, and the timing is entirely up to the watcher
 * implementation.
 */
export interface IPythonEnvsWatcher<E extends BasicPythonEnvsChangedEvent = PythonEnvsChangedEvent> {
    /**
     * The hook for registering event listeners (callbacks).
     */
    readonly onChanged: Event<E>;
}

/**
 * This provides the fundamental functionality of a watcher for any event type.
 *
 * Consumers register listeners (callbacks) using `onChanged`.  Each
 * listener is invoked when `fire()` is called.
 *
 * Note that in most cases classes will not inherit from this classes,
 * but instead keep a private watcher property.  The rule of thumb
 * is to follow whether or not consumers of *that* class should be able
 * to trigger events (via `fire()`).
 */
class WatcherBase<T> implements IPythonEnvsWatcher<T> {
    /**
     * The hook for registering event listeners (callbacks).
     */
    public readonly onChanged: Event<T>;
    private readonly didChange = new EventEmitter<T>();

    constructor() {
        this.onChanged = this.didChange.event;
    }

    /**
     * Send the event to all registered listeners.
     */
    public fire(event: T) {
        this.didChange.fire(event);
    }
}

// The use cases for BasicPythonEnvsWatcher are currently hypothetical.
// However, there's a real chance they may prove useful for the concrete
// locators.  Adding BasicPythonEnvsWatcher later will be much harder
// than removing it later, so we're leaving it for now.

/**
 * A watcher for the basic Python environments events.
 *
 * This should be used only in low-level cases, with the most
 * rudimentary watchers.  Most of the time `PythonEnvsWatcher`
 * should be used instead.
 *
 * Note that in most cases classes will not inherit from this classes,
 * but instead keep a private watcher property.  The rule of thumb
 * is to follow whether or not consumers of *that* class should be able
 * to trigger events (via `fire()`).
 */
export class BasicPythonEnvsWatcher extends WatcherBase<BasicPythonEnvsChangedEvent> {
    /**
     * Fire an event based on the given info.
     */
    public trigger(kind?: PythonEnvKind) {
        this.fire({ kind });
    }
}

/**
 * A general-use watcher for Python environments events.
 *
 * In most cases this is the class you will want to use or subclass.
 * Only in low-level cases should you consider using `BasicPythonEnvsWatcher`.
 *
 * Note that in most cases classes will not inherit from this classes,
 * but instead keep a private watcher property.  The rule of thumb
 * is to follow whether or not consumers of *that* class should be able
 * to trigger events (via `fire()`).
 */
export class PythonEnvsWatcher extends WatcherBase<PythonEnvsChangedEvent> {
    /**
     * Fire an event based on the given info.
     */
    public trigger(kind?: PythonEnvKind, searchLocation?: Uri) {
        this.fire({ kind, searchLocation });
    }
}
