import { PanelLayout } from '@phosphor/widgets';
import { Widget } from '@phosphor/widgets';
import { ICodeVersionModel } from './model';
import { CellArea } from '../slicedcell';

/**
 * The class name added to code version widgets
 */
const CODE_VERSION_CLASS = 'jp-CodeVersion';

/**
 * A widget for showing a version of code.
 */
export class CodeVersion extends Widget {
  /**
   * Construct a new code version.
   */
  constructor(options: CodeVersion.IOptions) {
    super();
    this.addClass(CODE_VERSION_CLASS);
    this.model = options.model;

    let layout = (this.layout = new PanelLayout());
    for (let cellModel of this.model.cells) {
      let options: CellArea.IOptions = {
        model: cellModel,
        showDiff: this.model.isLatest,
      };
      layout.addWidget(new CellArea(options));
    }
  }

  /**
   * The model used by the widget.
   */
  readonly model: ICodeVersionModel;
}

/**
 * A namespace for `CodeVersion` statics.
 */
export namespace CodeVersion {
  /**
   * The options used to create a `CodeVersion`.
   */
  export interface IOptions {
    /**
     * The model used by the widget.
     */
    model: ICodeVersionModel;
  }
}
