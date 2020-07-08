// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Responsible for syncing changes from our model into the VS Code cells.
 * Eg. when executing a cell, we update our model with the output, and here we react to those events and update the VS Code output.
 * This way, all updates to VSCode cells can happen in one place (here), and we can focus on updating just the Cell model with the data.
 * Here we only keep the outputs in sync. The assumption is that we won't be adding cells directly.
 * If adding cells and the like then please use VSC api to manipulate cells, else we have 2 ways of doing the same thing and that could lead to issues.
 */

import * as assert from 'assert';
import { NotebookCell, NotebookDocument } from '../../../../../types/vscode-proposed';
import {
    NotebookCellLanguageChangeEvent,
    NotebookCellOutputsChangeEvent,
    NotebookCellsChangeEvent
} from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { sendTelemetryEvent } from '../../../telemetry';
import { VSCodeNativeTelemetry } from '../../constants';
import { VSCodeNotebookModel } from '../../notebookStorage/vscNotebookModel';
import { INotebookModel } from '../../types';
import { findMappedNotebookCellModel } from './cellMappers';
import {
    createCellFromVSCNotebookCell,
    createVSCCellOutputsFromOutputs,
    updateVSCNotebookCellMetadata
} from './helpers';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * If a VS Code cell changes, then ensure we update the corresponding cell in our INotebookModel.
 * I.e. if a cell is added/deleted/moved then update our model.
 * @returns {boolean} Returns `true` if the NotebookDocument was edited/updated.
 */
export function updateCellModelWithChangesToVSCCell(
    change: NotebookCellsChangeEvent | NotebookCellOutputsChangeEvent | NotebookCellLanguageChangeEvent,
    model: VSCodeNotebookModel
): boolean | undefined | void {
    switch (change.type) {
        case 'changeCellOutputs':
            return clearCellOutput(change, model);
        case 'changeCellLanguage':
            // VSC Fires this event only when changing code cells from one language to another.
            // If you change markdown to code &/or vice versa, thats treated as a cell being deleted and added.
            // In the case of Jupyter cells, we don't care of the language changes from python to csharp.
            // Why? Because today its not possible, hence there's nothing we need to do for now.
            return false;
        case 'changeCells':
            return handleChangesToCells(change, model);
        default:
            // tslint:disable-next-line: no-string-literal
            assert.fail(`Unsupported cell change ${change['type']}`);
    }
}

/**
 * Updates a notebook document as a result of trusting it.
 */
export function updateVSCNotebookAfterTrustingNotebook(document: NotebookDocument, model: INotebookModel) {
    const areAllCellsEditableAndRunnable = document.cells.every((cell) => {
        if (cell.cellKind === vscodeNotebookEnums.CellKind.Markdown) {
            return cell.metadata.editable;
        } else {
            return cell.metadata.editable && cell.metadata.runnable;
        }
    });
    const isDocumentEditableAndRunnable =
        document.metadata.cellEditable &&
        document.metadata.cellRunnable &&
        document.metadata.editable &&
        document.metadata.runnable;

    // If already trusted, then nothing to do.
    if (isDocumentEditableAndRunnable && areAllCellsEditableAndRunnable) {
        return;
    }

    document.metadata.cellEditable = true;
    document.metadata.cellRunnable = true;
    document.metadata.editable = true;
    document.metadata.runnable = true;

    document.cells.forEach((cell) => {
        cell.metadata.editable = true;
        if (cell.cellKind !== vscodeNotebookEnums.CellKind.Markdown) {
            cell.metadata.runnable = true;
        }

        // Restore the output once we trust the notebook.
        const cellModel = findMappedNotebookCellModel(cell, model.cells);
        if (cellModel) {
            // tslint:disable-next-line: no-any
            cell.outputs = createVSCCellOutputsFromOutputs(cellModel.data.outputs as any);
        }
    });
}

export function clearCellForExecution(vscCell: NotebookCell, model: VSCodeNotebookModel) {
    vscCell.metadata.statusMessage = undefined;
    vscCell.metadata.executionOrder = undefined;
    vscCell.metadata.lastRunDuration = undefined;
    vscCell.metadata.runStartTime = undefined;
    vscCell.outputs = [];

    const cell = findMappedNotebookCellModel(vscCell, model.cells);
    model.clearCellOutput(cell, true);
    updateVSCNotebookCellMetadata(vscCell.metadata, cell);
}

/**
 * We're not interested in changes to cell output as this happens as a result of us pushing changes to the notebook.
 * I.e. cell output is already in our INotebookModel.
 * However we are interested in cell output being cleared (when user clears output).
 * @returns {boolean} Return `true` if NotebookDocument was updated/edited.
 */
function clearCellOutput(change: NotebookCellOutputsChangeEvent, model: VSCodeNotebookModel): boolean {
    if (!change.cells.every((cell) => cell.outputs.length === 0)) {
        return false;
    }
    // In the VS Code cells, also clear the cell results, execution counts and times.
    change.cells.forEach((vscCell) => {
        // If we're not in the middle of an execution, then don't clear its status.
        // Else a cell isn't cancellable.
        if (vscCell.metadata.runState !== vscodeNotebookEnums.NotebookCellRunState.Running) {
            vscCell.metadata.runState = undefined;
            vscCell.metadata.executionOrder = undefined;
        }
        vscCell.metadata.statusMessage = undefined;
        vscCell.metadata.lastRunDuration = undefined;
        vscCell.metadata.runStartTime = undefined;

        // If a cell has been cleared, then clear the corresponding ICell (cell in INotebookModel).
        const cell = findMappedNotebookCellModel(vscCell, model.cells);
        // If we're not in the middle of an execution, then don't clear its status.
        // Else a cell isn't cancellable.
        const clearExecutionCount = vscCell.metadata.runState !== vscodeNotebookEnums.NotebookCellRunState.Running;
        model.clearCellOutput(cell, clearExecutionCount);
        updateVSCNotebookCellMetadata(vscCell.metadata, cell);
    });

    return true;
}

function handleChangesToCells(change: NotebookCellsChangeEvent, model: VSCodeNotebookModel) {
    if (isSingleCellMoveChange(change)) {
        handleCellMove(change, model);
    } else if (isCellDelete(change)) {
        handleCellDeletes(change.changes[0].deletedItems, model);
    } else if (isSingleCellInsertion(change)) {
        handleCellInsertions(change.changes[0].items, change.changes[0].start, model);
    } else {
        // A more complex change.
        // E.g. when user reverts a document, we will get a change event
        // to delete all cells and add all the old cells.
        // Similarly we could have other changes were we have 4 changes,
        // First 3 are to delete cells, and last change in the array is to insert.
        for (const individualChange of change.changes) {
            if (individualChange.deletedCount) {
                handleCellDeletes(individualChange.deletedItems, model);
            }
            if (individualChange.items) {
                handleCellInsertions(individualChange.deletedItems, individualChange.start, model);
            }
        }
    }
}
/**
 * Determines whether a change is a move of a cell.
 * A move = Delete the cell as the first change, then as the second change insert into required place.
 */
function isSingleCellMoveChange(change: NotebookCellsChangeEvent) {
    if (change.changes.length !== 2) {
        return false;
    }
    const [deleteChange, insertChange] = change.changes;
    //
    return (
        (deleteChange.deletedCount === 1 &&
            deleteChange.items.length === 0 &&
            // When moving, the second change needs to be an insertion of a single item at a given index.
            insertChange.deletedCount === 0) ||
        insertChange.items.length === 1
    );
}
function isCellDelete(change: NotebookCellsChangeEvent) {
    return change.changes.length === 1 && change.changes[0].deletedCount > 0 && change.changes[0].items.length === 0;
}
function isSingleCellInsertion(change: NotebookCellsChangeEvent) {
    return change.changes.length === 1 && change.changes[0].deletedCount === 0 && change.changes[0].items.length === 1;
}

function handleCellMove(change: NotebookCellsChangeEvent, model: VSCodeNotebookModel) {
    assert.equal(change.changes.length, 2, 'When moving cells we must have only 2 changes');
    const [, insertChange] = change.changes;
    const cellToSwap = findMappedNotebookCellModel(insertChange.items[0]!, model.cells);
    const cellToSwapWith = model.cells[insertChange.start];
    assert.notEqual(cellToSwap, cellToSwapWith, 'Cannot swap cell with the same cell');
    model.swapCells(cellToSwap, cellToSwapWith);
    sendTelemetryEvent(VSCodeNativeTelemetry.MoveCell);
}
function handleCellInsertions(cells: NotebookCell[], insertionStart: number, model: VSCodeNotebookModel) {
    for (const cell of cells) {
        const newCell = createCellFromVSCNotebookCell(cell, model);
        model.addCell(newCell, insertionStart);
        insertionStart += 1;
    }
    sendTelemetryEvent(VSCodeNativeTelemetry.AddCell);
}
function handleCellDeletes(deletedItems: NotebookCell[], model: VSCodeNotebookModel) {
    deletedItems.forEach((cell) => {
        try {
            const cellModel = findMappedNotebookCellModel(cell, model.cells);
            model.deleteCell(cellModel);
        } catch (ex) {
            // If cell doesn't exist, then nothing to delete.
            traceError('Unable to delete cell as it does not exist in the model', ex);
        }
    });
    sendTelemetryEvent(VSCodeNativeTelemetry.DeleteCell);
}
