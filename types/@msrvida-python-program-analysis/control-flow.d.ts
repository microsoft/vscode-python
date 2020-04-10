import * as ast from './python-parser';
export declare class Block {
    id: number;
    readonly hint: string;
    statements: ast.SyntaxNode[];
    private imports;
    loopVariables: ast.SyntaxNode[];
    private ssa;
    constructor(id: number, hint: string, statements: ast.SyntaxNode[], imports: string[], loopVariables?: ast.SyntaxNode[]);
    toString(): string;
    get flattenedStatements(): ast.SyntaxNode[];
}
export declare class ControlFlowGraph {
    private _blocks;
    private globalId;
    private entry;
    private exit;
    private successors;
    private loopVariables;
    private imports;
    constructor(node: ast.SyntaxNode);
    private makeBlock;
    get blocks(): Block[];
    getSuccessors(block: Block): Block[];
    getPredecessors(block: Block): Block[];
    print(): void;
    private link;
    private handleIf;
    private handleWhile;
    private handleFor;
    private handleWith;
    private handleTry;
    private makeCFG;
    /**
     * Based on the algorithm in "Engineering a Compiler", 2nd ed., Cooper and Torczon:
     * - p479: computing dominance
     * - p498-500: dominator trees and frontiers
     * - p544: postdominance and reverse dominance frontier
     */
    visitControlDependencies(visit: (controlStmt: ast.SyntaxNode, stmt: ast.SyntaxNode) => void): void;
    private postdominators;
    private immediatePostdominators;
    private reverseDominanceFrontiers;
    private postdominatorExists;
    private getImmediatePostdominator;
    private findPostdominators;
    private getImmediatePostdominators;
    private buildReverseDominanceFrontiers;
}
