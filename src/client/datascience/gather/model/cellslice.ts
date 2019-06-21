import { LocationSet } from '../analysis/slice/slice';
import { IGatherCell } from './cell';

/**
 * A slice of a cell.
 */
export class CellSlice {
  /**
   * Construct an instance of a cell slice.
   */
  constructor(cell: IGatherCell, slice: LocationSet, executionTime?: Date) {
    this.cell = cell;
    this._slice = slice;
    this.executionTime = executionTime;
  }

  /**
   * Get the text in the slice of a cell.
   */
  get textSlice(): string {
    return this.getTextSlice(false);
  }

  /**
   * Get the text of all lines in a slice (no deletions from lines).
   */
  get textSliceLines(): string {
    return this.getTextSlice(true);
  }

  private getTextSlice(fullLines: boolean): string {
    let sliceLocations = this.slice.items;
    let textLines = this.cell.text.split('\n');
    return sliceLocations
      .sort((l1, l2) => l1.first_line - l2.first_line)
      .map(loc => {
        return textLines
          .map((line, index0) => {
            let index = index0 + 1;
            let left, right;
            if (index == loc.first_line) {
              left = loc.first_column;
            }
            if (index == loc.last_line) {
              right = loc.last_column;
            }
            if (index > loc.first_line) {
              left = 0;
            }
            if (index < loc.last_line) {
              right = line.length;
            }
            if (left != undefined && right != undefined) {
              if (fullLines) {
                return line.slice(0, line.length);
              } else {
                return line.slice(left, right);
              }
            }
            return '';
          })
          .filter(text => text != '')
          .join('\n');
      })
      .filter(text => text != '')
      .join('\n');
  }

  /**
   * Get the slice.
   */
  get slice(): LocationSet {
    return this._slice;
  }

  /**
   * Set the slice.
   */
  set slice(slice: LocationSet) {
    this._slice = slice;
  }

  readonly cell: IGatherCell;
  readonly executionTime: Date;
  private _slice: LocationSet;
}
