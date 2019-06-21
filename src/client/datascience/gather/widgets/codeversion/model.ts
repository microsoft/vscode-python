import { ISlicedCellModel } from '../slicedcell/model';

/**
 * The definition of a model object for a source code revision.
 */
export interface ICodeVersionModel {
  /**
   * A list of cells for this version of the code, with slice info.
   */
  readonly cells: ReadonlyArray<ISlicedCellModel>;

  /**
   * Whether this is the latest source code version.
   */
  readonly isLatest: boolean;
}

/**
 * An implementation of the source code version model.
 */
export class CodeVersionModel implements ICodeVersionModel {
  /**
   * Construct a source model.
   */
  constructor(options: CodeVersionModel.IOptions) {
    this._cells = options.cells;
    this._isLatest = options.isLatest;
  }

  /**
   * Get the cells for this revision of the source code.
   */
  get cells(): ReadonlyArray<ISlicedCellModel> {
    return this._cells;
  }

  /**
   * Whether this is the latest source code version.
   */
  get isLatest(): boolean {
    return this._isLatest;
  }

  private _cells: ReadonlyArray<ISlicedCellModel>;
  private _isLatest: boolean;
}

/**
 * The namespace for `CodeVersionModel` statics.
 */
export namespace CodeVersionModel {
  /**
   * The options used to initialize a `CodeVersionModel`.
   */
  export interface IOptions {
    /**
     * The cells in the notebook at the time of this revision.
     */
    cells: ReadonlyArray<ISlicedCellModel>;

    /**
     * Whether this is the latest source code version.
     */
    isLatest?: boolean;
  }
}
