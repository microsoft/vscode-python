import * as ast from './python-parser';
export declare class Block {
    id: number;
    readonly hint: string;
    statements: ast.SyntaxNode[];
    loopVariables: ast.SyntaxNode[];
    constructor(id: number, hint: string, statements: ast.SyntaxNode[], loopVariables?: ast.SyntaxNode[]);
    toString(): string;
}
export declare class ControlFlowGraph {
    private _blocks;
    private globalId;
    private entry;
    private exit;
    private successors;
    private loopVariables;
    constructor(node: ast.SyntaxNode);
    private makeBlock;
    readonly blocks: Block[];
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
