import { CodeCellModel, ICellModel, ICodeCellModel } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { IObservableList } from '@jupyterlab/observables';
import { GatherModel } from '../model';
import { LabCell } from '../model/cell';
import { UUID } from '@phosphor/coreutils';

/**
 * Listens to cell executions and edits.
 */
export class CellChangeListener {
    private _gatherModel: GatherModel;

    constructor(gatherModel: GatherModel, notebook: NotebookPanel) {
        this._gatherModel = gatherModel;
        this._registerCurrentCells(notebook);
        notebook.content.model.cells.changed.connect((_, change) => this._registerAddedCells(change), this);
    }

    private _registerCurrentCells(notebookPanel: NotebookPanel) {
        for (let i = 0; i < notebookPanel.content.model.cells.length; i++) {
            this._registerCell(notebookPanel.content.model.cells.get(i));
        }
    }

    /**
     * It's expected that this is called directly after the cell is executed.
     */
    private _annotateCellWithExecutionInformation(cell: LabCell) {
        cell.lastExecutedText = cell.text;
        cell.executionEventId = UUID.uuid4();
    }

    private _registerCell(cell: ICellModel) {
        if (cell.type !== 'code') {
            return;
        }
        /*
         * A cell will be considered edited whenever any of its contents changed, including
         * execution count, metadata, outputs, text, etc.
         */
        cell.stateChanged.connect((changedCell, cellStateChange) => {
            if (cellStateChange.name === 'executionCount' && cellStateChange.newValue !== undefined && cellStateChange.newValue !== null) {
                let labCell = new LabCell(changedCell as ICodeCellModel);
                /*
                 * Annotate the cell before reporting to the model that it was executed, because
                 * the model's listeners will need these annotations.
                 */
                this._annotateCellWithExecutionInformation(labCell);
                this._gatherModel.lastExecutedCell = labCell;
            }
        });
        cell.contentChanged.connect((changedCell, _) => {
            if (changedCell instanceof CodeCellModel) {
                this._gatherModel.lastEditedCell = new LabCell(changedCell);
            }
        });
    }

    private _registerAddedCells(cellListChange: IObservableList.IChangedArgs<ICellModel>): void {
        if (cellListChange.type === 'add' || cellListChange.type === 'remove') {
            const cellModel = cellListChange.newValues[0] as ICellModel;
            if (cellListChange.type === 'add') {
                this._registerCell(cellModel);
            } else if (cellListChange.type === 'remove') {
                if (cellModel instanceof CodeCellModel) {
                    this._gatherModel.lastDeletedCell = new LabCell(cellModel);
                }
            }
        }
    }
}
