import { PanelLayout, Widget } from '@phosphor/widgets';
import { GatherModel, GatherState } from '../model/model';
import { log } from '../util/log';
import { buildHistoryModel, HistoryViewer } from '../widgets/history';

/**
 * Class for the revision browser widget.
 */
const REVISION_BROWSER_CLASS = 'jp-Notebook-revisionbrowser';

/**
 * Window that lets the user browse revisions of code.
 */
export class RevisionBrowser extends Widget {
  /**
   * Construct a new revision browser.
   */
  constructor(gatherModel: GatherModel) {
    super();
    this.id = 'revision-browser';
    this.title.label = 'Revision browser';
    this.title.icon = 'jp-HistoryIcon';
    this.title.closable = true;
    this.addClass(REVISION_BROWSER_CLASS);

    this._gatherModel = gatherModel;
    this.layout = new PanelLayout();

    this.attachSliceWidgets(gatherModel);
  }

  attachSliceWidgets(model: GatherModel) {
    let defSelections = model.selectedDefs;
    let outputSelections = model.selectedOutputs;
    let selectedCell;
    if (defSelections.length > 0) {
      selectedCell = defSelections[0].cell;
    } else if (outputSelections.length > 0) {
      selectedCell = outputSelections[0].cell;
    }
    let slices = model.executionLog.sliceAllExecutions(selectedCell);
    log('Bringing up the revision browser for selection', {
      cellExecutionEventId: selectedCell.executionEventId,
      slices,
      selectedDefs: model.selectedDefs,
      selectedOutputs: model.selectedOutputs,
    });
    if (slices) {
      /*
       * Only show output if the selection was output.
       */
      let includeOutput = model.selectedOutputs.length >= 1;
      let historyModel = buildHistoryModel(
        model,
        selectedCell.persistentId,
        slices,
        includeOutput
      );
      let historyViewer = new HistoryViewer({
        model: historyModel,
      });
      (this.layout as PanelLayout).addWidget(historyViewer);
    }
  }

  /**
   * Dismiss this widget.
   */
  dismiss() {
    log('Dismissing revision browser');
    this._gatherModel.requestStateChange(GatherState.SELECTING);
  }

  private _gatherModel: GatherModel;
}
