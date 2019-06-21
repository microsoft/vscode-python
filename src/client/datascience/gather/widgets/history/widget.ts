import { PanelLayout, Widget } from '@phosphor/widgets';
import { Revision } from '../revision';
import { IHistoryModel } from './model';

/**
 * The class name added to history viewer widgets
 */
const HISTORY_VIEWER_CLASS = 'jp-HistoryViewer';

const HISTORY_VIEWER_ICON_CLASS = 'jp-HistoryViewerIcon';

const REFERENCE_VERSION_CLASS = 'jp-HistoryViewer-referenceversion';

/**
 * A widget for showing the history of a result and how it was produced.
 */
export class HistoryViewer extends Widget {
  /**
   * Construct a new history viewer.
   */
  constructor(options: HistoryViewer.IOptions) {
    super();

    this.addClass(HISTORY_VIEWER_CLASS);
    this.id = 'livecells-revision-browser';
    this.title.label = 'Revision Browser';
    this.title.icon = HISTORY_VIEWER_ICON_CLASS;
    this.title.closable = true;

    this._model = options.model;

    // Add revisions from most recent to oldest.
    let layout = (this.layout = new PanelLayout());

    // Add pane for reference (most recent) version.
    const now = new Date();
    let referenceVersion = new Revision({
      model: this._model.revisions[this._model.revisions.length - 1],
      now: now,
    });
    referenceVersion.addClass(REFERENCE_VERSION_CLASS);
    layout.addWidget(referenceVersion);

    // Add pane for older versions.
    if (this._model.revisions.length > 1) {
      for (let i = this._model.revisions.length - 2; i >= 0; i--) {
        let revisionModel = this._model.revisions[i];
        layout.addWidget(
          new Revision({
            model: revisionModel,
            now: now,
          })
        );
      }
    }
  }

  /**
   * Get the model used by the history viewer.
   */
  get model(): IHistoryModel {
    return this._model;
  }

  /**
   * Dispose of the resources used by the widget.
   */
  dispose() {
    if (this.isDisposed) {
      return;
    }
    this._model = null;
    super.dispose();
  }

  private _model: IHistoryModel = null;
}

/**
 * The namespace for the `HistoryViewer` class statics.
 */
export namespace HistoryViewer {
  /**
   * An options object for initializing a history viewer widget.
   */
  export interface IOptions {
    /**
     * The model used by the history viewer.
     */
    model: IHistoryModel;
  }
}
