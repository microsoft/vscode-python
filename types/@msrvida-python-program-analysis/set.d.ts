export declare class Set<T> {
    private getIdentifier;
    private _items;
    constructor(getIdentifier: (item: T) => string, ...items: T[]);
    get size(): number;
    add(...items: T[]): void;
    remove(item: T): void;
    pop(): T;
    has(item: T): boolean;
    get items(): T[];
    equals(that: Set<T>): boolean;
    get empty(): boolean;
    union(...those: Set<T>[]): Set<T>;
    intersect(that: Set<T>): Set<T>;
    filter(predicate: (item: T) => boolean): Set<T>;
    map<U>(getIdentifier: (item: U) => string, transform: (item: T) => U): Set<U>;
    mapSame(transform: (item: T) => T): Set<T>;
    some(predicate: (item: T) => boolean): boolean;
    minus(that: Set<T>): Set<T>;
    take(): T;
    product(that: Set<T>): Set<[T, T]>;
}
export declare class StringSet extends Set<string> {
    constructor(...items: string[]);
}
export declare class NumberSet extends Set<number> {
    constructor(...items: number[]);
}
export declare function range(min: number, max: number): Set<number>;
