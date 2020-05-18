// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode';
import { createErrorOutput } from '../../../datascience-ui/common/cellFactory';
import { IDisposable } from '../../common/types';
import { INotebookModelModifyChange } from '../interactive-common/interactiveWindowTypes';
import { ICell, INotebookModel } from '../types';
import { cellOutputsToVSCCellOutputs, findMappedNotebookCellData, translateErrorOutput } from './helpers';

export function hasTransientOutputForAnotherCell(output?: nbformat.IOutput) {
    return (
        output &&
        // tslint:disable-next-line: no-any
        (output as any).output_type === 'display_data' &&
        // tslint:disable-next-line: no-any
        'transient' in (output as any) &&
        // tslint:disable-next-line: no-any
        Object.keys((output as any).transient).length > 0
    );
}

/**
 * Updates the cell in notebook model as well as the notebook document.
 * Update notebook document so UI is updated accordingly.
 * Notebook model is what we use to update/track changes to ipynb.
 */
export function handleUpdateDisplayDataMessage(
    msg: KernelMessage.IUpdateDisplayDataMsg,
    model: INotebookModel,
    _document: NotebookDocument
) {
    // Find any cells that have this same display_id
    model.cells.forEach((cellToCheck) => {
        if (cellToCheck.data.cell_type !== 'code') {
            return;
        }

        let updated = false;
        const data: nbformat.ICodeCell = cellToCheck.data as nbformat.ICodeCell;
        const changedOutputs = data.outputs.map((output) => {
            if (
                (output.output_type === 'display_data' || output.output_type === 'execute_result') &&
                output.transient &&
                // tslint:disable-next-line: no-any
                (output.transient as any).display_id === msg.content.transient.display_id
            ) {
                // Remember we have updated output for this cell.
                updated = true;

                return {
                    ...output,
                    data: msg.content.data,
                    metadata: msg.content.metadata
                };
            } else {
                return output;
            }
        });

        if (!updated) {
            return;
        }

        updateCellOutput(cellToCheck, changedOutputs, model);
    });
}

/**
 * Updates the VSC cell with the error output.
 */
export function updateCellWithErrorStatus(cell: NotebookCell, ex: Partial<Error>) {
    cell.outputs = [translateErrorOutput(createErrorOutput(ex))];
    cell.metadata.runState = NotebookCellRunState.Error;
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
    return model.changed((change) => {
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
}

/**
 * Updates our Cell Model with the cell output.
 * As we execute a cell we get output from jupyter. This code will ensure the cell is updated with the output.
 * (this has nothing to do with VSCode cells), this is out ICell in INotebookModel.
 */
export function updateCellOutput(notebookCellModel: ICell, outputs: nbformat.IOutput[], model: INotebookModel) {
    const newOutput = cellOutputsToVSCCellOutputs(outputs);
    // If there was no output and still no output, then nothing to do.
    if (
        Array.isArray(notebookCellModel.data.outputs) &&
        notebookCellModel.data.outputs.length === 0 &&
        newOutput.length === 0
    ) {
        return;
    }
    // Compare outputs (at the end of the day everything is serializable).
    // Hence this is a safe comparison.
    if (
        Array.isArray(notebookCellModel.data.outputs) &&
        notebookCellModel.data.outputs.length === newOutput.length &&
        JSON.stringify(notebookCellModel.data.outputs) === JSON.stringify(newOutput)
    ) {
        return;
    }

    // Update our model.
    const newCell: ICell = {
        ...notebookCellModel,
        data: {
            ...notebookCellModel.data,
            outputs
        }
    };
    const updateCell: INotebookModelModifyChange = {
        kind: 'modify',
        newCells: [newCell],
        oldCells: [notebookCellModel],
        newDirty: true,
        oldDirty: model.isDirty === true,
        source: 'user'
    };
    model.update(updateCell);
}
