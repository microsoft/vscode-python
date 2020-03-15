export interface FunctionSpec {
    name: string;
    updates?: (string | number)[];
    reads?: string[];
    returns?: string;
    returnsType?: PythonType;
    higherorder?: number;
}
export declare type FunctionDescription = string | FunctionSpec;
export declare function getFunctionName(fd: FunctionDescription): string;
export declare function isFunctionSpec(fd: FunctionDescription): fd is FunctionSpec;
export declare type PythonType = ListType | ClassType;
export declare class ListType {
    elementType: PythonType;
    constructor(elementType: PythonType);
}
export declare class ClassType {
    spec: TypeSpec<FunctionSpec>;
    constructor(spec: TypeSpec<FunctionSpec>);
}
export interface TypeSpec<FD> {
    methods?: FD[];
}
export interface ModuleSpec<FD> extends TypeSpec<FD> {
    functions?: FD[];
    modules?: ModuleMap<FD>;
    types?: {
        [typeName: string]: TypeSpec<FD>;
    };
}
export interface ModuleMap<FD> {
    [moduleName: string]: ModuleSpec<FD>;
}
export declare type JsonSpecs = ModuleMap<FunctionDescription>;
export declare const DefaultSpecs: JsonSpecs;
