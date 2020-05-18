// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { interfaces } from 'inversify';
import { IDisposable } from '../common/types';

//tslint:disable:callable-types
// tslint:disable-next-line:interface-name
export interface Newable<T> {
    // tslint:disable-next-line:no-any
    new (...args: any[]): T;
}
//tslint:enable:callable-types

// tslint:disable-next-line:interface-name
export interface Abstract<T> {
    prototype: T;
}

//tslint:disable:callable-types
export type ClassType<T> = {
    // tslint:disable-next-line:no-any
    new (...args: any[]): T;
};
//tslint:enable:callable-types

export const IServiceManager = Symbol('IServiceManager');

export interface IServiceManager extends IDisposable {
    add<T>(
        serviceIdentifier: interfaces.ServiceIdentifier<T>,
        constructor: ClassType<T>,
        name?: string | number | symbol | undefined,
        bindings?: symbol[]
    ): void;
    addSingleton<T>(
        serviceIdentifier: interfaces.ServiceIdentifier<T>,
        constructor: ClassType<T>,
        name?: string | number | symbol,
        bindings?: symbol[]
    ): void;
    addSingletonInstance<T>(
        serviceIdentifier: interfaces.ServiceIdentifier<T>,
        instance: T,
        name?: string | number | symbol
    ): void;
    addFactory<T>(
        factoryIdentifier: interfaces.ServiceIdentifier<interfaces.Factory<T>>,
        factoryMethod: interfaces.FactoryCreator<T>
    ): void;
    addBinding<T1, T2>(from: interfaces.ServiceIdentifier<T1>, to: interfaces.ServiceIdentifier<T2>): void;
    get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T;
    getAll<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T[];
    rebind<T>(
        serviceIdentifier: interfaces.ServiceIdentifier<T>,
        constructor: ClassType<T>,
        name?: string | number | symbol
    ): void;
    rebindSingleton<T>(
        serviceIdentifier: interfaces.ServiceIdentifier<T>,
        constructor: ClassType<T>,
        name?: string | number | symbol
    ): void;
    rebindInstance<T>(
        serviceIdentifier: interfaces.ServiceIdentifier<T>,
        instance: T,
        name?: string | number | symbol
    ): void;
}

export const IServiceContainer = Symbol('IServiceContainer');
export interface IServiceContainer {
    get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T;
    getAll<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T[];
}
