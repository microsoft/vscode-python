import * as ast from './python-parser';
import { ControlFlowGraph } from './control-flow';
import { Set } from './set';
import { Spec } from './specs';
import { SymbolTable } from './symbol-table';
export interface Dataflow {
    fromNode: ast.SyntaxNode;
    toNode: ast.SyntaxNode;
    fromRef?: Ref;
    toRef?: Ref;
}
export declare enum ReferenceType {
    DEFINITION = "DEFINITION",
    UPDATE = "UPDATE",
    USE = "USE"
}
export interface Ref {
    level: ReferenceType;
    name: string;
    location: ast.Location;
    node: ast.SyntaxNode;
}
export declare class RefSet extends Set<Ref> {
    constructor(...items: Ref[]);
}
declare class DefUseDelta {
    DEFINITION: RefSet;
    UPDATE: RefSet;
    USE: RefSet;
    leaks: LeakInfo[];
    constructor(DEFINITION?: RefSet, UPDATE?: RefSet, USE?: RefSet, leaks?: LeakInfo[]);
    get uses(): Set<Ref>;
    createFlowsFrom(fromSet: DefUse): [Set<Dataflow>, Set<Ref>];
}
declare class DefUse {
    private DEFINITION;
    private UPDATE;
    private USE;
    leaks: LeakInfo[];
    constructor(DEFINITION?: RefSet, UPDATE?: RefSet, USE?: RefSet, leaks?: LeakInfo[]);
    get defs(): Set<Ref>;
    union(that: DefUse): DefUse;
    update(newRefs: DefUseDelta): void;
    equals(that: DefUse): boolean;
}
/**
 * Use a shared dataflow analyzer object for all dataflow analysis / querying for defs and uses.
 * It caches defs and uses for each statement, which can save time.
 * For caching to work, statements must be annotated with a cell's ID and execution count.
 */
export declare class DataflowAnalyzer {
    constructor(moduleMap?: Spec, symbolTable?: SymbolTable);
    getDefUseForStatement(statement: ast.SyntaxNode, incomingDefs: RefSet, incomingLeaks: LeakInfo[]): DefUseDelta;
    analyze(cfg: ControlFlowGraph, refSet?: RefSet): DataflowAnalysisResult;
    getDefs(statement: ast.SyntaxNode, stateLeaks: LeakInfo[]): {
        defs: RefSet;
        leaks: LeakInfo[];
    };
    private getClassDefs;
    private getFuncDefs;
    private getAssignDefs;
    private getDelDefs;
    private getFromImportDefs;
    private getImportDefs;
    getUses(statement: ast.SyntaxNode): RefSet;
    private getNameUses;
    private getClassDeclUses;
    private getFuncDeclUses;
    private getAssignUses;
    private symbolTable;
    private _defUsesCache;
}
export declare function sameLocation(loc1: ast.Location, loc2: ast.Location): boolean;
export declare const GlobalSyntheticVariable = "$global";
interface LeakInfo {
    innerName: string;
    outerName: string;
}
export declare type DataflowAnalysisResult = {
    dataflows: Set<Dataflow>;
    undefinedRefs: RefSet;
};
export {};
