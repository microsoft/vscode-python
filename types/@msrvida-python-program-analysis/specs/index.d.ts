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
export declare function setSpecFolder(dir: string): void;
export declare function addSpecFolder(dir: string): void;
export declare function getSpecs(): Spec | undefined;
export declare let DefaultSpecs: Spec;
