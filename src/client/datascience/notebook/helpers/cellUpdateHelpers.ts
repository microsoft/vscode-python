// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Responsible for syncing changes from our model into the VS Code cells.
 * Eg. when executing a cell, we update our model with the output, and here we react to those events and update the VS Code output.
 * This way, all updates to VSCode cells can happen in one place (here), and we can focus on updating just the Cell model with the data.
 * Here we only keep the outputs in sync. The assumption is that we won't be adding cells directly.
 * If adding cells and the like then please use VSC api to manipulate cells, else we have 2 ways of doing the same thing and that could lead to issues.
 */

import { NotebookCell, NotebookDocument } from '../../../../../types/vscode-proposed';
import { ICell } from '../../types';
import { createVSCCellOutputsFromOutputs } from './helpers';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * Updates a notebook document as a result of trusting it.
 */
export function updateVSCNotebookAfterTrustingNotebook(document: NotebookDocument, originalCells: ICell[]) {
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

    document.cells.forEach((cell, index) => {
        cell.metadata.editable = true;
        if (cell.cellKind !== vscodeNotebookEnums.CellKind.Markdown) {
            cell.metadata.runnable = true;
            // Restore the output once we trust the notebook.
            // tslint:disable-next-line: no-any
            cell.outputs = createVSCCellOutputsFromOutputs(originalCells[index].data.outputs as any);
        }
    });
}

export function clearCellForExecution(cell: NotebookCell) {
    cell.metadata.statusMessage = undefined;
    cell.metadata.executionOrder = undefined;
    cell.metadata.lastRunDuration = undefined;
    cell.metadata.runStartTime = undefined;
    cell.outputs = [];
}
