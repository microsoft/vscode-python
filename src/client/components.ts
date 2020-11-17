// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposableRegistry, IExtensionContext } from './common/types';
import { IServiceContainer, IServiceManager } from './ioc/types';

/**
 * The global extension state needed by components.
 *
 * Once we move off inversify, this will be merged back into `ExtensionState`.
 */
export type BaseExtensionState = {
    context: IExtensionContext;
    disposables: IDisposableRegistry;
};

/**
 * The global extension state needed by components.
 *
 * For now this includes the objects dealing with inversify (IOC) registration.
 */
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

/**
 * The info & functionality provided by every component.
 */
export interface IComponent {
    /**
     * A human friendly identifier for the component.
     *
     * This is mostly for logging and as a convenience when debugging
     * the extension.
     */
    readonly name: string;

    /**
     * Finishes preparing the component for use in the rest of the extension.
     *
     * Note that most component "activation" will happen lazily
     * (when needed).  The activation that happens here should only
     * include things that need to happen as soon as possible
     * (including background operations).
     *
     * @returns - see `ActivationResult` for more info
     */
    activate(): Promise<ActivationResult>;
}

/**
 * A single activation operation for some internal part of the component.
 */
export type ActivationFunc = () => Promise<void> | void;

/**
 * A single component of the extension.
 *
 * A subclass of this is what every component's `initialize()` function
 * returns.  Note that `initialize()` is not expected to return
 * `IComponent` since it does not include the `api` property.
 */
export abstract class Component implements IComponent {
    constructor(
        // `name` is here mostly just for debugging purposes.
        public readonly name: string,
        private readonly activations: ActivationFunc[]
    ) {}

    /**
     * The public interface of the component.
     *
     * Each subclass will return its component-specific concreate type.
     * The object may be passed to the `initialize()` function
     * of other components.
     */
    // tslint:disable-next-line:no-any
    public abstract get api(): any;

    /**
     * Activated the component.
     */
    public async activate(): Promise<ActivationResult> {
        const promises = this.activations.map((activate) => activate());
        await Promise.all(promises);
        return { finished: Promise.resolve() };
    }
}
