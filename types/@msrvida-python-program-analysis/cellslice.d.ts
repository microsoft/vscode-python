import { Cell } from './cell';
import { LocationSet } from './slice';
export declare class CellSlice {
    /**
     * Construct an instance of a cell slice.
     */
    constructor(cell: Cell, slice: LocationSet, executionTime?: Date);
    /**
     * Get the text in the slice of a cell.
     */
    readonly textSlice: string;
    /**
     * Get the text of all lines in a slice (no deletions from lines).
     */
    readonly textSliceLines: string;
    private getTextSlice;
    /**
     * Get the slice.
     */
    /**
    * Set the slice.
    */
    slice: LocationSet;
    readonly cell: Cell;
    readonly executionTime: Date;
    private _slice;
}
