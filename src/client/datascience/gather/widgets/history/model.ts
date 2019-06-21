import { IRevisionModel } from '../revision';

/**
 * The definition of a model object for a code history.
 */
export interface IHistoryModel {
  readonly revisions: ReadonlyArray<IRevisionModel>;
}

/**
 * An implementation of the history model.
 */
export class HistoryModel implements IHistoryModel {
  /**
   * Construct a history model
   */
  constructor(options: HistoryModel.IOptions) {
    this._revisions = options.revisions;
  }

  /**
   * Get the versions from the history.
   */
  get revisions(): ReadonlyArray<IRevisionModel> {
    return this._revisions;
  }

  private _revisions: Array<IRevisionModel> = null;
}

/**
 * The namespace for `HistoryModel` statics.
 */
export namespace HistoryModel {
  /**
   * The options used to initialize a `HistoryModel`.
   */
  export interface IOptions {
    /**
     * Versions of the code.
     */
    revisions?: Array<IRevisionModel>;
  }
}
