import { Cell } from './cell';
import { CellSlice } from './cellslice';
import { DataflowAnalyzer } from './data-flow';
import { CellProgram, ProgramBuilder } from './program-builder';
import { LocationSet } from './slice';
/**
 * A record of when a cell was executed.
 */
export declare class CellExecution<TCell extends Cell> {
    readonly cell: TCell;
    readonly executionTime: Date;
    constructor(cell: TCell, executionTime: Date);
    /**
     * Update this method if at some point we only want to save some about a CellExecution when
     * serializing it and saving history.
     */
    toJSON(): any;
}
/**
 * A slice over a version of executed code.
 */
export declare class SlicedExecution {
    executionTime: Date;
    cellSlices: CellSlice[];
    constructor(executionTime: Date, cellSlices: CellSlice[]);
    merge(...slicedExecutions: SlicedExecution[]): SlicedExecution;
}
export declare type CellExecutionCallback<TCell extends Cell> = (exec: CellExecution<TCell>) => void;
/**
 * Makes slice on a log of executed cells.
 */
export declare class ExecutionLogSlicer<TCell extends Cell> {
    private dataflowAnalyzer;
    executionLog: CellExecution<TCell>[];
    readonly programBuilder: ProgramBuilder;
    /**
     * Signal emitted when a cell's execution has been completely processed.
     */
    readonly executionLogged: CellExecutionCallback<TCell>[];
    /**
     * Construct a new execution log slicer.
     */
    constructor(dataflowAnalyzer: DataflowAnalyzer);
    /**
     * Log that a cell has just been executed. The execution time for this cell will be stored
     * as the moment at which this method is called.
     */
    logExecution(cell: TCell): void;
    /**
     * Use logExecution instead if a cell has just been run to annotate it with the current time
     * as the execution time. This function is intended to be used only to initialize history
     * when a notebook is reloaded. However, any method that eventually calls this method will
     * notify all observers that this cell has been executed.
     */
    addExecutionToLog(cellExecution: CellExecution<TCell>): void;
    /**
     * Reset the log, removing log records.
     */
    reset(): void;
    /**
     * Get slice for the latest execution of a cell.
     */
    sliceLatestExecution(cellId: string, seedLocations?: LocationSet): SlicedExecution;
    /**
     * Get slices of the necessary code for all executions of a cell.
     * Relevant line numbers are relative to the cell's start line (starting at first line = 0).
     */
    sliceAllExecutions(cellId: string, seedLocations?: LocationSet): SlicedExecution[];
    get cellExecutions(): ReadonlyArray<CellExecution<TCell>>;
    /**
     * Get the cell program (tree, defs, uses) for a cell.
     */
    getCellProgram(executionEventId: string): CellProgram;
    /**
     * Returns the cells that directly or indirectly use variables
     * that are defined in the given cell. Result is in
     * topological order.
     * @param executionEventId a cell in the log
     */
    getDependentCells(executionEventId: string): Cell[];
}
