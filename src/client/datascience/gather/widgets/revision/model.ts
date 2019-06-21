import { nbformat } from '@jupyterlab/coreutils';
import { SlicedExecution } from '../../analysis/slice/log-slicer';
import { ICodeVersionModel } from '../codeversion/model';
import { GatherModel } from '../../model';

/**
 * The definition of a model object for a code version.
 */
export interface IRevisionModel {
  /**
   * A unique index for this code version---lower indexes were are for earlier versions.
   */
  readonly versionIndex: number;

  /**
   * The source code for this revision.
   */
  readonly source: ICodeVersionModel;

  /**
   * The model holding gathering state.
   */
  readonly gatherModel: GatherModel;

  /**
   * The slice the revision was made from.
   */
  readonly slice: SlicedExecution;

  /**
   * The result of the computation.
   */
  readonly output: nbformat.IOutput[];

  /**
   * Whether this revision is the latest revision.
   */
  readonly isLatest: boolean;

  /**
   * The time this version was created.
   */
  readonly timeCreated: Date;
}

/**
 * An implementation of the code version model.
 */
export class RevisionModel implements IRevisionModel {
  /**
   * Construct a code version model.
   */
  constructor(options: RevisionModel.IOptions) {
    this.versionIndex = options.versionIndex;
    this._source = options.source;
    this._slice = options.slice;
    this._gatherModel = options.gatherModel;
    this._output = options.output;
    this.isLatest = options.isLatest;
    this._timeCreated = options.timeCreated;
  }

  readonly versionIndex: number;
  readonly isLatest: boolean;

  /**
   * Get the source code for this revision.
   */
  get source(): ICodeVersionModel {
    return this._source;
  }

  /**
   * Get the slice the revision was created from.
   */
  get slice(): SlicedExecution {
    return this._slice;
  }

  /**
   * Get the model that holds gathering state.
   */
  get gatherModel(): GatherModel {
    return this._gatherModel;
  }

  /**
   * Get the result of this computation.
   */
  get output(): nbformat.IOutput[] {
    return this._output;
  }

  /**
   * Get the time this revision was created.
   */
  get timeCreated(): Date {
    return this._timeCreated;
  }

  private _source: ICodeVersionModel;
  private _slice: SlicedExecution;
  private _gatherModel: GatherModel;
  private _output: nbformat.IOutput[];
  private _timeCreated: Date;
}

/**
 * The namespace for `RevisionModel` statics.
 */
export namespace RevisionModel {
  /**
   * The options used to initialize a `CodeVerionModel`.
   */
  export interface IOptions {
    /**
     * A slice of the source code for this revision.
     */
    source?: ICodeVersionModel;

    /**
     * The slice the revision was made from.
     */
    slice: SlicedExecution;

    /**
     * A model holding the state for gathering.
     */
    gatherModel: GatherModel;

    /**
     * A unique index for this version---lower indexes were made earlier.
     */
    versionIndex?: number;

    /**
     * The display data for the result at this version.
     */
    output?: nbformat.IOutput[];

    /**
     * Whether this revision is the latest revision.
     */
    isLatest?: boolean;

    /**
     * The time this version was created.
     */
    timeCreated?: Date;
  }
}
