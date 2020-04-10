import { Spec, PythonType } from "./specs";
import * as ast from './python-parser';
declare class Scope {
    types: {
        [name: string]: PythonType;
    };
    functions: {
        [name: string]: ast.Def;
    };
}
export declare class SymbolTable {
    private pkgSpecs;
    private globals;
    private scopes;
    constructor(pkgSpecs: Spec);
    lookup(name: string): Spec | undefined;
    lookupModuleFunction(func: ast.SyntaxNode): Spec;
    private lookupPath;
    store(name: string, spec: Spec): void;
    get currentScope(): Scope;
    storeType(name: string, type: PythonType): void;
    lookupType(name: string): PythonType;
    storeLocalFunction(def: ast.Def): void;
    lookupLocalFunction(name: string): ast.Def;
    pushScope(): void;
    popScope(): void;
    importModule(modulePath: string, alias: string): Spec;
    importModuleDefinitions(namePath: string, imports: {
        name: string;
        alias?: string;
    }[]): string[];
}
export {};
