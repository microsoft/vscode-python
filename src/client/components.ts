// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable } from 'vscode';
import { PersistentState } from './common/persistentState';
import { IDisposableRegistry, IExtensionContext } from './common/types';
import { IServiceContainer, IServiceManager } from './ioc/types';

/**
 * The global extension state needed by components.
 */
export type ExtensionState = {
    context: IExtensionContext;
    serviceManager: IServiceManager;
    serviceContainer: IServiceContainer;
    disposables: IDisposableRegistry;
};

type ActivationBasicFunc = () => Promise<void> | void;

export interface IMaybeActive {
    activate?: ActivationBasicFunc;
    dispose?(): void;
}

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
    activate(): Promise<ActivationResult>;
}

export class Component implements IComponent {
    private readonly funcs: ActivationBasicFunc[] = [];

    constructor(
        // The name is mostly useful just for debugging for now.
        public readonly name: string,
        public readonly ext: ExtensionState
    ) {}

    public addInitialized(...initialized: IMaybeActive[]): void {
        initialized.forEach((init) => {
            if (init.activate !== undefined) {
                this.funcs.push(() => init.activate!());
            }
            if (init.dispose !== undefined) {
                this.ext.disposables.push(init as Disposable);
            }
        });
    }

    public addActivation(...funcs: ActivationBasicFunc[]): void {
        funcs.forEach((func) => {
            this.funcs.push(func);
        });
    }

    public async activate(): Promise<ActivationResult> {
        await Promise.all(
            this.funcs.map(async (func) => {
                // We do not expect any activation results.
                await func();
            })
        );
        return {
            finished: Promise.resolve()
        };
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
