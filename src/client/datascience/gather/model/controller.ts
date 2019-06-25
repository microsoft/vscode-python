import { DocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ExecutionLogSlicer } from '../slice/logSlicer';
import { LocationSet } from '../slice/slice';
import { Clipboard, NotebookOpener, ScriptOpener } from '../main/gather-actions';
import { GatherEventData, GatherModel, GatherModelEvent, GatherState, IGatherObserver } from '../model';
import { log } from '../util/log';
import { DefSelection, OutputSelection } from './selections';

/**
 * Controller for updating the gather model.
 */
export class GatherController implements IGatherObserver {
    /**
     * Constructor for gather controller.
     */
    constructor(model: GatherModel, documentManager: DocumentManager, notebooks: INotebookTracker) {
        model.addObserver(this);
        this._executionSlicer = model.executionLog;
        this._cellClipboard = Clipboard.getInstance();
        this._notebookOpener = new NotebookOpener(documentManager, notebooks);
        this._scriptOpener = new ScriptOpener(documentManager, notebooks);
    }

    /**
     * Handle change to the gather model.
     */
    onModelChange(eventType: GatherModelEvent, eventData: GatherEventData, model: GatherModel) {
        // If a gather action was requested, do the gather.
        if (eventType == GatherModelEvent.STATE_CHANGED) {
            let newState = eventData as GatherState;
            if (newState == GatherState.GATHER_TO_CLIPBOARD || newState == GatherState.GATHER_TO_NOTEBOOK || newState == GatherState.GATHER_TO_SCRIPT) {
                let slices = model.chosenSlices;
                let mergedSlice = slices[0].merge(...slices.slice(1));
                if (newState == GatherState.GATHER_TO_CLIPBOARD) {
                    log('Gathering to clipboard', { slice: mergedSlice });
                    this._cellClipboard.copy(mergedSlice, [...model.selectedOutputs]);
                } else if (newState == GatherState.GATHER_TO_NOTEBOOK) {
                    log('Gathering to notebook', { slice: mergedSlice });
                    if (this._notebookOpener !== undefined) {
                        this._notebookOpener.openNotebookForSlice(mergedSlice, [...model.selectedOutputs]);
                        model.resetChosenSlices();
                    }
                } else if (newState == GatherState.GATHER_TO_SCRIPT) {
                    log('Gathering to script', { slice: mergedSlice });
                    if (this._scriptOpener !== undefined) {
                        this._scriptOpener.openScriptForSlice(mergedSlice);
                        model.resetChosenSlices();
                    }
                }
                model.requestStateChange(GatherState.RESET);
            } else if (newState == GatherState.RESET) {
                // When a reset is selected, clear selections and transition to selection mode.
                model.deselectAllDefs();
                model.deselectAllOutputs();
                model.resetChosenSlices();
                model.requestStateChange(GatherState.SELECTING);
            }
        }

        // If def is selected, select its slice too.
        if (eventType == GatherModelEvent.DEF_SELECTED) {
            let defSelection = eventData as DefSelection;
            let sliceSeeds = new LocationSet(defSelection.editorDef.def.location);
            let slices = this._executionSlicer.sliceAllExecutions(defSelection.cell, sliceSeeds);
            let sliceSelection = {
                userSelection: defSelection,
                slice: slices[slices.length - 1]
            };
            model.selectSlice(sliceSelection);
            model.addSelectedDefSlices(defSelection, ...slices);
        }

        // If a def is deselected, deselect its slice too.
        if (eventType == GatherModelEvent.DEF_DESELECTED) {
            let defSelection = eventData as DefSelection;
            for (let sliceSelection of model.selectedSlices) {
                if (sliceSelection.userSelection == defSelection) {
                    model.deselectSlice(sliceSelection);
                }
            }
            model.removeSelectedDefSlices(defSelection);
        }

        // If output is selected, select the code that produced it too.
        if (eventType == GatherModelEvent.OUTPUT_SELECTED) {
            let outputSelection = eventData as OutputSelection;
            let cell = outputSelection.cell;
            let slices = this._executionSlicer.sliceAllExecutions(cell);
            let sliceSelection = {
                userSelection: outputSelection,
                slice: slices[slices.length - 1]
            };
            model.selectSlice(sliceSelection);
            model.addSelectedOutputSlices(outputSelection, ...slices);
        }

        // If an output is deselected, deselect its slice too.
        if (eventType == GatherModelEvent.OUTPUT_DESELECTED) {
            let outputSelection = eventData as OutputSelection;
            for (let sliceSelection of model.selectedSlices) {
                if (sliceSelection.userSelection == outputSelection) {
                    model.deselectSlice(sliceSelection);
                }
            }
            model.removeSelectedOutputSlices(outputSelection);
        }
    }

    private _executionSlicer: ExecutionLogSlicer;
    private _cellClipboard: Clipboard;
    private _notebookOpener: NotebookOpener;
    private _scriptOpener: ScriptOpener;
}
