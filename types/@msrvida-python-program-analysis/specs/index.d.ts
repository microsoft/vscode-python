export interface Spec {
    [name: string]: any;
}
export declare type PythonType = ListType | ClassType;
export declare class ListType {
    elementType: PythonType;
    constructor(elementType: PythonType);
}
export declare class ClassType {
    private spec;
    constructor(spec: Spec);
    lookupMethod(name: string): any;
}
export declare const DefaultSpecs: Spec;
