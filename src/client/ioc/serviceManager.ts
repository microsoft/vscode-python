import { Container } from 'inversify';
import { Abstract, IServiceManager, Newable } from './types';
export class ServiceManager implements IServiceManager {
    constructor(private container: Container) { }
    // tslint:disable-next-line:no-any
    public add<T>(serviceIdentifier: string | symbol | Newable<T> | Abstract<T>, constructor: new (...args: any[]) => T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container.bind<T>(serviceIdentifier).to(constructor).whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).to(constructor);
        }
    }
    // tslint:disable-next-line:no-any
    public addSingleton<T>(serviceIdentifier: string | symbol | Newable<T> | Abstract<T>, constructor: new (...args: any[]) => T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container.bind<T>(serviceIdentifier).to(constructor).inSingletonScope().whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).to(constructor).inSingletonScope();
        }
    }
    // tslint:disable-next-line:no-any
    public addSingletonInstance<T>(serviceIdentifier: string | symbol | Newable<T> | Abstract<T>, instance: T, name?: string | number | symbol | undefined): void {
        if (name) {
            this.container.bind<T>(serviceIdentifier).toConstantValue(instance).whenTargetNamed(name);
        } else {
            this.container.bind<T>(serviceIdentifier).toConstantValue(instance);
        }
    }
    public get<T>(serviceIdentifier: string | symbol | Newable<T> | Abstract<T>, name?: string | number | symbol | undefined): T {
        return name ? this.container.getNamed<T>(serviceIdentifier, name) : this.container.get<T>(serviceIdentifier);
    }
    public getAll<T>(serviceIdentifier: string | symbol | Newable<T> | Abstract<T>, name?: string | number | symbol | undefined): T[] {
        return name ? this.container.getAllNamed<T>(serviceIdentifier, name) : this.container.getAll<T>(serviceIdentifier);
    }
}
