import { FunctionSpec, TypeSpec, ModuleSpec, ModuleMap, JsonSpecs } from "./specs";
import * as ast from './python-parser';
export declare class SymbolTable {
    private jsonSpecs;
    modules: ModuleMap<FunctionSpec>;
    types: {
        [name: string]: TypeSpec<FunctionSpec>;
    };
    functions: {
        [name: string]: FunctionSpec;
    };
    constructor(jsonSpecs: JsonSpecs);
    lookupFunction(name: string): FunctionSpec | undefined;
    lookupNode(func: ast.SyntaxNode): FunctionSpec;
    lookupModuleFunction(modName: string, funcName: string): FunctionSpec | undefined;
    importModule(modulePath: string, alias: string): ModuleSpec<FunctionSpec>;
    private resolveFunction;
    private resolveType;
    private makePythonType;
    private resolveModule;
    importModuleDefinitions(namePath: string, imports: {
        path: string;
        alias: string;
    }[]): string[];
    private lookupSpec;
}
