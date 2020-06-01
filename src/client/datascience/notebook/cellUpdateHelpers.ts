// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import type { NotebookCell, NotebookDocument } from 'vscode-proposed';
import { createCellFrom } from '../../../datascience-ui/common/cellFactory';
import {
    NotebookCellLanguageChangeEvent,
    NotebookCellOutputsChangeEvent,
    NotebookCellsChangeEvent
} from '../../common/application/types';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../common/constants';
import { IDisposable } from '../../common/types';
import { traceError } from '../../logging';
import { ICell, INotebookModel } from '../types';
import { cellOutputsToVSCCellOutputs, vscNotebookCellToCellModel } from './helpers';

export function findMappedNotebookCellData(source: ICell, cells: NotebookCell[]): NotebookCell {
    // If so, then we have a problem.
    const found = cells.filter((cell) => source.id === cell.metadata.custom?.cellId);

    assert.ok(found.length, `NotebookCell not found, for CellId = ${source.id} in ${source}`);

    return found[0];
}

export function findMappedNotebookCellModel(source: NotebookCell, cells: ICell[]): ICell {
    // If so, then we have a problem.
    const found = cells.filter((cell) => cell.id === source.metadata.custom?.cellId);
    assert.ok(found.length, `ICell not found, for CellId = ${source.metadata.custom?.cellId} in ${source}`);

    return found[0];
}

/**
 * Responsible for syncing changes from our model into the VS Code cells.
 * Eg. when executing a cell, we update our model with the output, and here we react to those events and update the VS Code output.
 * This way, all updates to VSCode cells can happen in one place (here), and we can focus on updating just the Cell model with the data.
 * Here we only keep the outputs in sync. The assumption is that we won't be adding cells directly.
 * If adding cells and the like then please use VSC api to manipulate cells, else we have 2 ways of doing the same thing and that could lead to issues.
 */
export function monitorModelCellOutputChangesAndUpdateNotebookDocument(
    document: NotebookDocument,
    model: INotebookModel
): IDisposable {
    let wasUntitledNotebook = model.isUntitled;
    let stopSyncingOutput = false;
    const disposable = model.changed((change) => {
        if (stopSyncingOutput) {
            return;
        }
        if (change.kind === 'saveAs') {
            if (wasUntitledNotebook) {
                wasUntitledNotebook = false;
                // User saved untitled file as a real file.
                return;
            } else {
                // Ok, user save a normal notebook as another name.
                // Stop monitoring changes.
                stopSyncingOutput = true;
                disposable.dispose();
                return;
            }
        }
        // We're only interested in updates to cells (output or execution count).
        if (change.kind === 'updateCellExecutionCount') {
            const cell = model.cells.find((item) => item.id === change.cellId);
            if (!cell) {
                return;
            }
            const uiCellToUpdate = findMappedNotebookCellData(cell, document.cells);
            if (uiCellToUpdate) {
                uiCellToUpdate.metadata.executionOrder = change.executionCount;
            }
            return;
        }
        // We're only interested in updates to cells.
        if (change.kind !== 'modify') {
            return;
        }
        for (const cell of change.newCells) {
            const uiCellToUpdate = findMappedNotebookCellData(cell, document.cells);
            if (!uiCellToUpdate) {
                continue;
            }
            const newOutput = Array.isArray(cell.data.outputs)
                ? // tslint:disable-next-line: no-any
                  cellOutputsToVSCCellOutputs(cell.data.outputs as any)
                : [];
            // If there were no cells and still no cells, nothing to update.
            if (newOutput.length === 0 && uiCellToUpdate.outputs.length === 0) {
                return;
            }
            // If no changes in output, then nothing to do.
            if (
                newOutput.length === uiCellToUpdate.outputs.length &&
                JSON.stringify(newOutput) === JSON.stringify(uiCellToUpdate.outputs)
            ) {
                return;
            }
            uiCellToUpdate.outputs = newOutput;
        }
    });

    return disposable;
}

/**
 * If a VS Code cell changes, then ensure we update the corresponding cell in our INotebookModel.
 * I.e. if a cell is added/deleted/moved then update our model.
 */
export function updateCellModelWithChangesToVSCCell(
    change: NotebookCellsChangeEvent | NotebookCellOutputsChangeEvent | NotebookCellLanguageChangeEvent,
    model: INotebookModel
) {
    switch (change.type) {
        case 'changeCellOutputs':
            // We're not interested in changes to cell output as this happens as a result of us pushing changes to the notebook.
            // I.e. cell output is already in our INotebookModel.
            return;
        case 'changeCellLanguage':
            return changeCellLanguage(change, model);
        case 'changeCells':
            return handleChangesToCells(change, model);
        default:
            // tslint:disable-next-line: no-string-literal
            assert.fail(`Unsupported cell change ${change['type']}`);
    }
}

function changeCellLanguage(change: NotebookCellLanguageChangeEvent, model: INotebookModel) {
    const cellModel = findMappedNotebookCellModel(change.cell, model.cells);

    // VSC fires event if changing cell language from markdown to markdown.
    // https://github.com/microsoft/vscode/issues/98836
    if (
        (change.language === PYTHON_LANGUAGE && cellModel.data.cell_type === 'code') ||
        (change.language === MARKDOWN_LANGUAGE && cellModel.data.cell_type === 'markdown')
    ) {
        return;
    }

    const newCellData = createCellFrom(cellModel.data, change.language === MARKDOWN_LANGUAGE ? 'markdown' : 'code');
    const newCell: ICell = {
        ...cellModel,
        data: newCellData
    };

    model.update({
        source: 'user',
        kind: 'modify',
        newCells: [newCell],
        oldCells: [cellModel],
        oldDirty: model.isDirty,
        newDirty: true
    });

    // tslint:disable-next-line: no-any
    change.cell.outputs = cellOutputsToVSCCellOutputs(newCellData.outputs as any);
    change.cell.metadata.executionOrder = undefined;
    change.cell.metadata.hasExecutionOrder = change.language !== MARKDOWN_LANGUAGE; // Do not check for Python, to support other languages
    change.cell.metadata.runnable = change.language !== MARKDOWN_LANGUAGE; // Do not check for Python, to support other languages
}

function handleChangesToCells(change: NotebookCellsChangeEvent, model: INotebookModel) {
    // For some reason VSC fires a change even when opening a document.
    // Ignore this https://github.com/microsoft/vscode/issues/98841
    if (
        change.changes.length === 1 &&
        change.changes[0].deletedCount === 0 &&
        change.changes[0].start === 0 &&
        change.changes[0].items.length === model.cells.length &&
        change.document.cells.length === model.cells.length
    ) {
        // This is an event fired when a document is opened, we can safely ignore this.
        return;
    }

    if (isCellMoveChange(change)) {
        handleCellMove(change, model);
    } else if (isCellDelete(change)) {
        handleCellDelete(change, model);
    } else if (isCellInsertion(change)) {
        handleCellInsertion(change, model);
    } else {
        traceError('Unsupported cell change', change);
        throw new Error('Unsupported cell change');
    }
}
/**
 * Determines whether a change is a move of a cell.
 * A move = Delete the cell as the first change, then as the second change insert into required place.
 */
function isCellMoveChange(change: NotebookCellsChangeEvent) {
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
function isCellInsertion(change: NotebookCellsChangeEvent) {
    return change.changes.length === 1 && change.changes[0].deletedCount === 0 && change.changes[0].items.length > 0;
}

function handleCellMove(change: NotebookCellsChangeEvent, model: INotebookModel) {
    assert.equal(change.changes.length, 2, 'When moving cells we must have only 2 changes');
    const [, insertChange] = change.changes;
    const cellToSwap = findMappedNotebookCellModel(insertChange.items[0]!, model.cells);
    const cellToSwapWith = model.cells[insertChange.start];
    assert.notEqual(cellToSwap, cellToSwapWith, 'Cannot swap cell with the same cell');
    model.update({
        source: 'user',
        kind: 'swap',
        oldDirty: model.isDirty,
        newDirty: true,
        firstCellId: cellToSwap.id,
        secondCellId: cellToSwapWith.id
    });
}
function handleCellInsertion(change: NotebookCellsChangeEvent, model: INotebookModel) {
    assert.equal(change.changes.length, 1, 'When inserting cells we must have only 1 change');
    assert.equal(change.changes[0].items.length, 1, 'Insertion of more than 1 cell is not supported');
    const insertChange = change.changes[0];
    const cell = change.changes[0].items[0];
    const newCell = vscNotebookCellToCellModel(cell, model);
    // Ensure we add the cell id to the VSC cell to map itto ours.
    cell.metadata.custom = cell.metadata.custom || {};
    cell.metadata.custom.cellId = newCell.id;
    model.update({
        source: 'user',
        kind: 'insert',
        newDirty: true,
        oldDirty: model.isDirty,
        index: insertChange.start,
        cell: newCell
    });
}
function handleCellDelete(change: NotebookCellsChangeEvent, model: INotebookModel) {
    assert.equal(change.changes.length, 1, 'When deleting cells we must have only 1 change');
    const deletionChange = change.changes[0];
    assert.equal(deletionChange.deletedCount, 1, 'Deleting more than one cell is not supported');
    const cellToDelete = model.cells[deletionChange.start];
    model.update({
        source: 'user',
        kind: 'remove',
        oldDirty: model.isDirty,
        newDirty: true,
        cell: cellToDelete,
        index: deletionChange.start
    });
}
