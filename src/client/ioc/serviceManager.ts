// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Container, interfaces } from 'inversify';
import { Abstract, IServiceManager, Newable } from './types';

type identifier<T> = string | symbol | Newable<T> | Abstract<T>;

export class ServiceManager implements IServiceManager {
    constructor(private container: Container) { }
    // tslint:disable-next-line:no-any
    public add<T>(serviceIdentifier: identifier<T>, constructor: new (...args: any[]) => T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container.bind<T>(serviceIdentifier).to(constructor).whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).to(constructor);
        }
    }
    // tslint:disable-next-line:no-any
    public addFactory<T>(factoryIdentifier: interfaces.ServiceIdentifier<interfaces.Factory<T>>, factoryMethod: interfaces.FactoryCreator<T>): void {
        this.container.bind<interfaces.Factory<T>>(factoryIdentifier).toFactory<T>(factoryMethod);
    }
    // tslint:disable-next-line:no-any
    public addSingleton<T>(serviceIdentifier: identifier<T>, constructor: new (...args: any[]) => T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container.bind<T>(serviceIdentifier).to(constructor).inSingletonScope().whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).to(constructor).inSingletonScope();
        }
    }
    // tslint:disable-next-line:no-any
    public addSingletonInstance<T>(serviceIdentifier: identifier<T>, instance: T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container.bind<T>(serviceIdentifier).toConstantValue(instance).whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).toConstantValue(instance);
        }
    }
    public get<T>(serviceIdentifier: identifier<T>, name?: string | number | symbol | undefined): T {
        return name ? this.container.getNamed<T>(serviceIdentifier, name) : this.container.get<T>(serviceIdentifier);
    }
    public getAll<T>(serviceIdentifier: identifier<T>, name?: string | number | symbol | undefined): T[] {
        return name ? this.container.getAllNamed<T>(serviceIdentifier, name) : this.container.getAll<T>(serviceIdentifier);
    }
}
