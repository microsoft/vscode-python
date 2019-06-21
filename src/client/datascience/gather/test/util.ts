import { ICodeCellModel } from '@jupyterlab/cells';
import { nbformat } from '@jupyterlab/coreutils';
import { IObservableString } from '@jupyterlab/observables';
import { IOutputAreaModel } from '@jupyterlab/outputarea';
import { IOutputModel } from '@jupyterlab/rendermime';

/**
 * IMPLEMENTATIONS OF JUPYTER INTERFACES.
 * Due to limitations of Mocha, using the actual implementations of these interfaces from the
 * Jupyter code (e.g., CodeCellModel) causes the test to crash, as it requires globals that
 * are usually only available in the browser (e.g., document, window, Element).
 * These implementations let us use Jupyter types for objects under test.
 */
export class SimpleObservableString implements IObservableString {
    type: 'String';
    changed: null;
    text: string;
    insert: null;
    remove: null;
    clear: null;
    dispose: null;
    isDisposed: false;
  constructor(value: string) {
    this.text = value;
  }
}

export class SimpleOutputAreaModel implements IOutputAreaModel {
    _outputs: IOutputModel[];
    stateChanged: null;
    changed: null;
    trusted: true;
    contentFactory: null;
    add: null;
    set: null;
    clear: null;
    fromJSON: null;
    toJSON: null;
    isDisposed: false;
    dispose: null;
    constructor(...outputs: IOutputModel[]) {
        this._outputs = outputs;
    }

    public get(index: number): IOutputModel {
        return this._outputs[index];
    }

    get length(): number {
        return this._outputs.length;
    }

}

export class SimpleOutputModel implements IOutputModel {
  constructor(type: string, data?: nbformat.IOutput) {
    this.type = type;
    this.data = data;
  }
  changed: null;
  type: string;
  executionCount: null;
  trusted: true;
  dispose: null;
  toJSON: null;
  data: nbformat.IOutput;
  metadata: {};
  setData: null;
}

export class SimpleCodeCellModel implements ICodeCellModel {
  constructor(
    id: string,
    executionCount: number,
    text: string,
    outputs?: IOutputAreaModel
  ) {
    this.id = id;
    this.executionCount = executionCount;
    this.value = new SimpleObservableString(text);
    this.outputs = outputs;
  }
  type: 'code';
  executionCount: number;
  outputs: IOutputAreaModel;
  id: string;
  contentChanged: null;
  stateChanged: null;
  trusted: true;
  metadata: null;
  toJSON: null;
  mimeTypeChanged: null;
  value: IObservableString;
  mimeType: null;
  selections: null;
  modelDB: null;
  isDisposed: false;
  dispose: null;
}
