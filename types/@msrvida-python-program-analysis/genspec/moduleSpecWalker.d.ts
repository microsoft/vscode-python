import * as py from '../python-parser';
import { ModuleSpec, FunctionDescription } from "..";
export declare class ModuleSpecWalker {
    spec: ModuleSpec<FunctionDescription>;
    constructor();
    private static lookForSideEffects;
    onEnterNode(node: py.SyntaxNode, ancestors: py.SyntaxNode[]): void;
}
export declare class HeuristicTransitiveClosure {
    private moduleSpec;
    constructor(moduleSpec: ModuleSpec<FunctionDescription>);
    private transferSideEffectsAcrossCalls;
    private recordSideEffects;
    onEnterNode(node: py.SyntaxNode, ancestors: py.SyntaxNode[]): void;
}
