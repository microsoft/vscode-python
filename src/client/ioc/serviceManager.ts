// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Container, injectable, interfaces } from 'inversify';

import { Abstract, ClassType, IServiceManager, Newable } from './types';

type identifier<T> = string | symbol | Newable<T> | Abstract<T>;

@injectable()
export class ServiceManager implements IServiceManager {
    constructor(private container: Container) {}
    // tslint:disable-next-line:no-any
    public add<T>(serviceIdentifier: identifier<T>, constructor: new (...args: any[]) => T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container
                .bind<T>(serviceIdentifier)
                .to(constructor)
                .whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).to(constructor);
        }
    }
    // tslint:disable-next-line:no-any
    public addFactory<T>(factoryIdentifier: interfaces.ServiceIdentifier<interfaces.Factory<T>>, factoryMethod: interfaces.FactoryCreator<T>): void {
        this.container.bind<interfaces.Factory<T>>(factoryIdentifier).toFactory<T>(factoryMethod);
    }

    // tslint:disable-next-line:no-any
    public addBinding<T1, T2>(from: identifier<T1>, to: identifier<T2>): void {
        this.container.bind(to).toService(from);
    }

    // tslint:disable-next-line:no-any
    public addSingleton<T>(serviceIdentifier: identifier<T>, constructor: new (...args: any[]) => T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container
                .bind<T>(serviceIdentifier)
                .to(constructor)
                .inSingletonScope()
                .whenTargetNamed(name);
        } else {
            this.container
                .bind<T>(serviceIdentifier)
                .to(constructor)
                .inSingletonScope();
        }
    }
    // tslint:disable-next-line:no-any
    public addSingletonInstance<T>(serviceIdentifier: identifier<T>, instance: T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container
                .bind<T>(serviceIdentifier)
                .toConstantValue(instance)
                .whenTargetNamed(name);
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

    public rebind<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, constructor: ClassType<T>, name?: string | number | symbol): void {
        if (name) {
            this.container
                .rebind<T>(serviceIdentifier)
                .to(constructor)
                .whenTargetNamed(name);
        } else {
            this.container.rebind<T>(serviceIdentifier).to(constructor);
        }
    }

    public rebindInstance<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, instance: T, name?: string | number | symbol): void {
        if (name) {
            this.container
                .rebind<T>(serviceIdentifier)
                .toConstantValue(instance)
                .whenTargetNamed(name);
        } else {
            this.container.rebind<T>(serviceIdentifier).toConstantValue(instance);
        }
    }
}
