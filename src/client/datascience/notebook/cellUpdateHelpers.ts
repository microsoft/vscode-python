// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { NotebookCell, NotebookDocument } from 'vscode';
import { IDisposable } from '../../common/types';
import { traceError } from '../../logging';
import { ICell, INotebookModel } from '../types';
import { cellOutputsToVSCCellOutputs } from './helpers';

export function findMappedNotebookCellData(source: ICell, cells: NotebookCell[]): NotebookCell {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Will metadata get copied across when copying/pasting cells (cloning a cell)?
    // If so, then we have a problem.
    const found = cells.filter((cell) => source.id === cell.metadata.custom?.cellId);

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Once VSC provides API, throw error here.
    if (!found || !found.length) {
        traceError(`Unable to find matching cell for ${source}`);
        return cells[0];
    }

    return found[0];
}

export function findMappedNotebookCellModel(source: NotebookCell, cells: ICell[]): ICell {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Will metadata get copied across when copying/pasting cells (cloning a cell)?
    // If so, then we have a problem.
    const found = cells.filter((cell) => cell.id === source.metadata.custom?.cellId);

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Once VSC provides API, throw error here.
    if (!found || !found.length) {
        traceError(`Unable to find matching cell for ${source}`);
        return cells[0];
    }

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
