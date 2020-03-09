import { Cell } from './cell';
import * as ast from './python-parser';
import { DataflowAnalyzer, Ref } from './data-flow';
import { NumberSet } from './set';
/**
 * Maps to find out what line numbers over a program correspond to what cells.
 */
export declare type CellToLineMap = {
    [cellExecutionEventId: string]: NumberSet;
};
export declare type LineToCellMap = {
    [line: number]: Cell;
};
/**
 * A program built from cells.
 */
export declare class Program {
    /**
     * Construct a program.
     */
    constructor(cellPrograms: CellProgram[]);
    readonly text: string;
    readonly tree: ast.Module;
    readonly cellToLineMap: CellToLineMap;
    readonly lineToCellMap: LineToCellMap;
}
/**
 * Program fragment for a cell. Used to cache parsing results.
 */
export declare class CellProgram {
    /**
     * Construct a cell program
     */
    constructor(cell: Cell, statements: ast.SyntaxNode[], defs: Ref[], uses: Ref[], hasError: boolean);
    readonly cell: Cell;
    readonly statements: ast.SyntaxNode[];
    readonly defs: Ref[];
    readonly uses: Ref[];
    readonly hasError: boolean;
    usesSomethingFrom(that: CellProgram): boolean;
}
/**
 * Builds programs from a list of executed cells.
 */
export declare class ProgramBuilder {
    /**
     * Construct a program builder.
     */
    constructor(dataflowAnalyzer?: DataflowAnalyzer);
    /**
     * Add cells to the program builder.
     */
    add(...cells: Cell[]): void;
    /**
     * Reset (removing all cells).
     */
    reset(): void;
    /**
     * Build a program from the list of cells. Program will include the cells' contents in
     * the order they were added to the log. It will omit cells that raised errors (syntax or
     * runtime, except for the last cell).
     */
    buildTo(cellExecutionEventId: string): Program;
    buildFrom(executionEventId: string): Program;
    getCellProgram(executionEventId: string): CellProgram;
    getCellProgramsWithSameId(executionEventId: string): CellProgram[];
    private _cellPrograms;
    private _dataflowAnalyzer;
}
