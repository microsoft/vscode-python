import { DocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IExecutionLogSlicer } from '../../types';
import { Clipboard, NotebookOpener, ScriptOpener } from '../main/gather-actions';
import { GatherEventData, GatherModel, GatherModelEvent, GatherState, IGatherObserver } from '../model';
import { LocationSet } from '../slice/slice';
import { log } from '../util/log';
import { DefSelection, OutputSelection } from './selections';

/**
 * Controller for updating the gather model.
 */
export class GatherController implements IGatherObserver {
    private _executionSlicer: IExecutionLogSlicer;
    private _cellClipboard: Clipboard;
    private _notebookOpener: NotebookOpener;
    private _scriptOpener: ScriptOpener;
    /**
     * Constructor for gather controller.
     */
    constructor(model: GatherModel, documentManager: DocumentManager, notebooks: INotebookTracker) {
        model.addObserver(this);
        this._executionSlicer = model.executionLogSlicer;
        this._cellClipboard = Clipboard.getInstance();
        this._notebookOpener = new NotebookOpener(documentManager, notebooks);
        this._scriptOpener = new ScriptOpener(documentManager, notebooks);
    }

    /**
     * Handle change to the gather model.
     */
    public onModelChange(eventType: GatherModelEvent, eventData: GatherEventData, model: GatherModel) {
        // If a gather action was requested, do the gather.
        if (eventType == GatherModelEvent.STATE_CHANGED) {
            const newState = eventData as GatherState;
            if (newState == GatherState.GATHER_TO_CLIPBOARD || newState == GatherState.GATHER_TO_NOTEBOOK || newState == GatherState.GATHER_TO_SCRIPT) {
                const slices = model.chosenSlices;
                const mergedSlice = slices[0].merge(...slices.slice(1));
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
            const defSelection = eventData as DefSelection;
            const sliceSeeds = new LocationSet(defSelection.editorDef.def.location);
            const slices = this._executionSlicer.sliceAllExecutions(defSelection.cell, sliceSeeds);
            const sliceSelection = {
                userSelection: defSelection,
                slice: slices[slices.length - 1]
            };
            model.selectSlice(sliceSelection);
            model.addSelectedDefSlices(defSelection, ...slices);
        }

        // If a def is deselected, deselect its slice too.
        if (eventType == GatherModelEvent.DEF_DESELECTED) {
            const defSelection = eventData as DefSelection;
            for (const sliceSelection of model.selectedSlices) {
                if (sliceSelection.userSelection == defSelection) {
                    model.deselectSlice(sliceSelection);
                }
            }
            model.removeSelectedDefSlices(defSelection);
        }

        // If output is selected, select the code that produced it too.
        if (eventType == GatherModelEvent.OUTPUT_SELECTED) {
            const outputSelection = eventData as OutputSelection;
            const cell = outputSelection.cell;
            const slices = this._executionSlicer.sliceAllExecutions(cell);
            const sliceSelection = {
                userSelection: outputSelection,
                slice: slices[slices.length - 1]
            };
            model.selectSlice(sliceSelection);
            model.addSelectedOutputSlices(outputSelection, ...slices);
        }

        // If an output is deselected, deselect its slice too.
        if (eventType == GatherModelEvent.OUTPUT_DESELECTED) {
            const outputSelection = eventData as OutputSelection;
            for (const sliceSelection of model.selectedSlices) {
                if (sliceSelection.userSelection == outputSelection) {
                    model.deselectSlice(sliceSelection);
                }
            }
            model.removeSelectedOutputSlices(outputSelection);
        }
    }
}
