// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PersistentState } from './common/persistentState';
import { IDisposableRegistry, IExtensionContext } from './common/types';
import { IServiceContainer, IServiceManager } from './ioc/types';

/**
 * The global extension state needed by components.
 */
export type BaseExtensionState = {
    context: IExtensionContext;
    disposables: IDisposableRegistry;
};

export type ExtensionState = BaseExtensionState & {
    legacyIOC: {
        serviceManager: IServiceManager;
        serviceContainer: IServiceContainer;
    };
};

/**
 * The result of activating a component of the extension.
 *
 * Getting this value means the component has reached a state where it
 * may be used by the rest of the extension.
 *
 * If the component started any non-critical activation-related
 * operations during activation then the "finished" property will only
 * resolve once all those operations complete.
 *
 * The component may have also started long-running background helpers.
 * Those are not exposed here.
 */
export type ActivationResult = {
    finished: Promise<void>;
};

export interface IComponent {
    readonly name: string;

    activate(): Promise<ActivationResult>;
}

export type ActivationFunc = () => Promise<void> | void;

export class Component implements IComponent {
    constructor(
        // `name` is here mostly just for debugging purposes.
        public readonly name: string,
        private readonly activations: ActivationFunc[]
    ) {}

    public async activate(): Promise<ActivationResult> {
        const promises = this.activations.map((activate) => activate());
        await Promise.all(promises);
        return { finished: Promise.resolve() };
    }
}

/////////////////////////////
// helpers

interface IPersistentStorage<T> {
    get(): T | undefined;
    set(value: T): Promise<void>;
}

/**
 * Build a global storage object for the given key.
 */
export function getGlobalStorage<T>(context: IExtensionContext, key: string): IPersistentStorage<T> {
    const raw = new PersistentState<T>(context.globalState, key);
    return {
        // We adapt between PersistentState and IPersistentStorage.
        get() {
            return raw.value;
        },
        set(value: T) {
            return raw.updateValue(value);
        }
    };
}
