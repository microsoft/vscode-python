//@ts-nocheck
import { Cell } from './cell';
import { CellSlice } from './cellslice';
import { DataflowAnalyzer } from './data-flow';
import { CellProgram, ProgramBuilder } from './program-builder';
import { LocationSet, slice, SliceDirection } from './slice';
import { Set, NumberSet } from './set';

/**
 * A record of when a cell was executed.
 */
export class CellExecution<TCell extends Cell> {
    readonly cell: TCell;
    readonly executionTime: Date;

    constructor(cell: TCell, executionTime: Date) {
        this.cell = cell;
        this.executionTime = executionTime;
    }

    /**
     * Update this method if at some point we only want to save some about a CellExecution when
     * serializing it and saving history.
     */
    toJSON(): any {
        return JSON.parse(JSON.stringify(this));
    }
}

/**
 * A slice over a version of executed code.
 */
export class SlicedExecution {
    constructor(public executionTime: Date, public cellSlices: CellSlice[]) { }

    merge(...slicedExecutions: SlicedExecution[]): SlicedExecution {
        let cellSlices: { [cellExecutionEventId: string]: CellSlice } = {};
        let mergedCellSlices = [];
        for (let slicedExecution of slicedExecutions.concat(this)) {
            for (let cellSlice of slicedExecution.cellSlices) {
                let cell = cellSlice.cell;
                if (!cellSlices[cell.executionEventId]) {
                    let newCellSlice = new CellSlice(
                        cell.deepCopy(),
                        new LocationSet(),
                        cellSlice.executionTime
                    );
                    cellSlices[cell.executionEventId] = newCellSlice;
                    mergedCellSlices.push(newCellSlice);
                }
                let mergedCellSlice = cellSlices[cell.executionEventId];
                mergedCellSlice.slice = mergedCellSlice.slice.union(cellSlice.slice);
            }
        }
        return new SlicedExecution(
            new Date(), // Date doesn't mean anything for the merged slice.
            mergedCellSlices.sort(
                (a, b) => a.cell.executionCount - b.cell.executionCount
            )
        );
    }
}


export type CellExecutionCallback<TCell extends Cell> = (exec: CellExecution<TCell>) => void;

/**
 * Makes slice on a log of executed cells.
 */
export class ExecutionLogSlicer<TCell extends Cell> {
    public executionLog: CellExecution<TCell>[] = [];
    public readonly programBuilder: ProgramBuilder;

    /**
     * Signal emitted when a cell's execution has been completely processed.
     */
    readonly executionLogged: CellExecutionCallback<TCell>[] = [];

    /**
     * Construct a new execution log slicer.
     */
    constructor(private dataflowAnalyzer: DataflowAnalyzer) {
        this.programBuilder = new ProgramBuilder(dataflowAnalyzer);
    }

    /**
     * Log that a cell has just been executed. The execution time for this cell will be stored
     * as the moment at which this method is called.
     */
    public logExecution(cell: TCell) {
        let cellExecution = new CellExecution<TCell>(cell, new Date());
        this.addExecutionToLog(cellExecution);
    }

    /**
     * Use logExecution instead if a cell has just been run to annotate it with the current time
     * as the execution time. This function is intended to be used only to initialize history
     * when a notebook is reloaded. However, any method that eventually calls this method will
     * notify all observers that this cell has been executed.
     */
    public addExecutionToLog(cellExecution: CellExecution<TCell>) {
        this.programBuilder.add(cellExecution.cell);
        this.executionLog.push(cellExecution);
        this.executionLogged.forEach(callback => callback(cellExecution));
    }

    /**
     * Reset the log, removing log records.
     */
    public reset() {
        this.executionLog = [];
        this.programBuilder.reset();
    }

    /**
     * Get slice for the latest execution of a cell.
     */
    public sliceLatestExecution(
        cellId: string,
        seedLocations?: LocationSet
    ): SlicedExecution {
        // XXX: This computes more than it has to, performing a slice on each execution of a cell
        // instead of just its latest computation. Optimize later if necessary.
        return this.sliceAllExecutions(cellId, seedLocations).pop();
    }

    /**
     * Get slices of the necessary code for all executions of a cell.
     * Relevant line numbers are relative to the cell's start line (starting at first line = 0).
     */
    public sliceAllExecutions(
        cellId: string,
        seedLocations?: LocationSet
    ): SlicedExecution[] {
        // Make a map from cells to their execution times.
        const cellExecutionTimes = new Map(this.executionLog.map(e =>
            [e.cell.executionEventId, e.executionTime]));

        // If seed locations weren't specified, slice the whole cell,
        // specified by an unreasonably large character range.
        if (!seedLocations) {
            seedLocations = new LocationSet({
                first_line: 1,
                first_column: 1,
                last_line: 10000,
                last_column: 10000,
            });
        }

        return this.executionLog
            .filter(cellExec =>
                cellExec.cell.persistentId == cellId &&
                cellExec.cell.executionCount)
            .map(cellExecution => {
                // Build the program up to that cell.
                let program = this.programBuilder.buildTo(cellExecution.cell.executionEventId);
                if (!program) { return null; }

                // Set seed locations were specified relative to the last cell's position in program.
                let lastCellLines = program.cellToLineMap[cellExecution.cell.executionEventId];
                let lastCellStart = Math.min(...lastCellLines.items);
                const adjustedLocations = seedLocations.mapSame(loc => ({
                    first_line: lastCellStart + loc.first_line - 1,
                    first_column: loc.first_column,
                    last_line: lastCellStart + loc.last_line - 1,
                    last_column: loc.last_column,
                }));

                // Slice the program
                let sliceLocations = slice(
                    program.tree,
                    adjustedLocations,
                    this.dataflowAnalyzer
                ).items.sort((loc1, loc2) => loc1.first_line - loc2.first_line);

                // Get the relative offsets of slice lines in each cell.
                let cellSliceLocations: {
                    [executionEventId: string]: LocationSet;
                } = {};
                let cellOrder: Cell[] = [];

                sliceLocations.forEach(location => {
                    let sliceCell = program.lineToCellMap[location.first_line];
                    let sliceCellLines =
                        program.cellToLineMap[sliceCell.executionEventId];
                    let sliceCellStart = Math.min(...sliceCellLines.items);
                    if (cellOrder.indexOf(sliceCell) == -1) {
                        cellOrder.push(sliceCell);
                    }
                    let adjustedLocation = {
                        first_line: location.first_line - sliceCellStart + 1,
                        first_column: location.first_column,
                        last_line: location.last_line - sliceCellStart + 1,
                        last_column: location.last_column,
                    };
                    if (!cellSliceLocations[sliceCell.executionEventId]) {
                        cellSliceLocations[sliceCell.executionEventId] = new LocationSet();
                    }
                    cellSliceLocations[sliceCell.executionEventId].add(adjustedLocation);
                });

                let cellSlices = cellOrder.map(
                    sliceCell => new CellSlice(
                        sliceCell,
                        cellSliceLocations[sliceCell.executionEventId],
                        cellExecutionTimes[sliceCell.executionEventId]
                    ));

                return new SlicedExecution(cellExecution.executionTime, cellSlices);
            })
            .filter(slice => slice != null && slice != undefined);
    }

    public get cellExecutions(): ReadonlyArray<CellExecution<TCell>> {
        return this.executionLog;
    }

    /**
     * Get the cell program (tree, defs, uses) for a cell.
     */
    public getCellProgram(executionEventId: string): CellProgram {
        return this.programBuilder.getCellProgram(executionEventId);
    }

    /**
     * Returns the cells that directly or indirectly use variables
     * that are defined in the given cell. Result is in
     * topological order.
     * @param executionEventId a cell in the log
     */
    public getDependentCells(executionEventId: string): Cell[] {
        const program = this.programBuilder.buildFrom(executionEventId);
        const sameCell = this.programBuilder.getCellProgramsWithSameId(executionEventId);
        let lines = new NumberSet();
        sameCell.forEach(cp =>
            lines = lines.union(program.cellToLineMap[cp.cell.executionEventId]));
        const seedLocations = new LocationSet(
            ...lines.items.map(line =>
                ({ first_line: line, first_column: 0, last_line: line, last_column: 1 })));
        let sliceLocations = slice(program.tree, seedLocations, undefined, SliceDirection.Forward).items;
        return new Set<Cell>(c => c.persistentId,
            ...sliceLocations.map(loc => program.lineToCellMap[loc.first_line]))
            .items.filter(c => c.executionEventId !== executionEventId);
    }

}
