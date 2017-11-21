// tslint:disable-next-line:interface-name
export interface Newable<T> {
    // tslint:disable-next-line:no-any
    new(...args: any[]): T;
}
// tslint:disable-next-line:interface-name
export interface Abstract<T> {
    prototype: T;
}
export type ServiceIdentifier<T> = (string | symbol | Newable<T> | Abstract<T>);
export type ClassType<T> = {
    // tslint:disable-next-line:no-any
    new(...args: any[]): T;
};

export const IServiceManager = Symbol('IServiceManager');

export interface IServiceManager {
    add<T>(serviceIdentifier: ServiceIdentifier<T>, constructor: ClassType<T>, name?: string | number | symbol): void;
    addSingleton<T>(serviceIdentifier: ServiceIdentifier<T>, constructor: ClassType<T>, name?: string | number | symbol): void;
    addSingletonInstance<T>(serviceIdentifier: ServiceIdentifier<T>, instance: T, name?: string | number | symbol): void;
    get<T>(serviceIdentifier: ServiceIdentifier<T>, name?: string | number | symbol): T;
    getAll<T>(serviceIdentifier: ServiceIdentifier<T>, name?: string | number | symbol): T[];
}

export const IServiceContainer = Symbol('IServiceContainer');
export interface IServiceContainer {
    get<T>(serviceIdentifier: ServiceIdentifier<T>, name?: string | number | symbol): T;
    getAll<T>(serviceIdentifier: ServiceIdentifier<T>, name?: string | number | symbol): T[];
}
