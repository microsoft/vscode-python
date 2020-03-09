/**
 * Generic interface for accessing data about a code cell.
 */
export interface Cell {
    /**
     * The cell's current text.
     */
    text: string;
    executionCount: number;
    /**
     * A unique ID generated each time a cell is executed. This lets us disambiguate between two
     * runs of a cell that have the same ID *and* execution count, if the kernel was restarted.
     * This ID should also be programmed to be *persistent*, so that even after a notebook is
     * reloaded, the cell in the same position will still have this ID.
     */
    readonly executionEventId: string;
    /**
     * A persistent ID for a cell in a notebook. This ID will stay the same even as the cell is
     * executed, and even when the cell is reloaded from the file.
     */
    readonly persistentId: string;
    /**
     * Whether analysis or execution of this cell has yielded an error.
     */
    hasError: boolean;
    /**
     * Create a deep copy of the cell.
     */
    deepCopy: () => Cell;
}
