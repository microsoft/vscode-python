import { CodeEditor } from '@jupyterlab/codeeditor';
import { IModelDB } from '@jupyterlab/observables';
import { Diff } from '../history/diff';

/**
 * The definition of a model object for a sliced cell.
 */
export interface ISlicedCellModel extends CodeEditor.IModel {
  /**
   * A unique ID for a logged cell, computed at the moment of execution.
   */
  readonly cellExecutionEventId: string;

  /**
   * The execution count for the cell.
   */
  readonly executionCount: number;

  /**
   * The source code for the cell.
   */
  readonly sourceCode: string;

  /**
   * A text diff between the cell's contents in this version and the contents in the most
   * recent version of the cell.
   */
  readonly diff: Diff;
}

/**
 * An implementation for the sliced cell model.
 */
export class SlicedCellModel extends CodeEditor.Model
  implements ISlicedCellModel {
  /**
   * Construct a sliced cell model.
   */
  constructor(options: SlicedCellModel.IOptions) {
    super({ modelDB: options.modelDB });

    this._cellExecutionEventId = options.executionEventId;
    this._executionCount = options.executionCount;
    this._sourceCode = options.sourceCode;
    this._diff = options.diff;

    let text = this._sourceCode;
    this.value.text = text as string;
  }

  /**
   * Get the cell ID.
   */
  get cellExecutionEventId(): string {
    return this._cellExecutionEventId;
  }

  /**
   * Get the execution count for the cell.
   */
  get executionCount(): number {
    return this._executionCount;
  }

  /**
   * Get the source code for the cell.
   */
  get sourceCode(): string {
    return this._sourceCode;
  }

  /**
   * Get the difference between the cell contents in this version of the cell, and the contents
   * from the most recent version.
   */
  get diff(): Diff {
    return this._diff;
  }

  private _cellExecutionEventId: string;
  private _executionCount: number;
  private _sourceCode: string;
  private _diff: Diff;
}

/**
 * The namespace for `SlicedCellModel` statics.
 */
export namespace SlicedCellModel {
  /**
   * The options used to initialize a `SlicedCellModel`.
   */
  export interface IOptions {
    /**
     * A unique ID for a cell.
     */
    executionEventId: string;

    /**
     * The execution count for the cell.
     */
    executionCount: number;

    /**
     * The source code for the cell.
     */
    sourceCode: string;

    /**
     * A text diff between the cell's contents in this version and the contents in the most
     * recent version of the cell.
     */
    diff: Diff;

    /**
     * An IModelDB in which to store cell data.
     */
    modelDB?: IModelDB;
  }
}
