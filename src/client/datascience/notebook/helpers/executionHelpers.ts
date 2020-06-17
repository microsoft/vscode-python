// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode';
import { IBaseCellVSCodeMetadata } from '../../../../../types/@jupyterlab_coreutils_nbformat';
import { createErrorOutput } from '../../../../datascience-ui/common/cellFactory';
import { ICell, INotebookModel } from '../../types';
import { findMappedNotebookCell } from './cellMappers';
import { createVSCCellOutputsFromOutputs, translateErrorOutput, updateVSCNotebookCellMetadata } from './helpers';

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
    document: NotebookDocument
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

        const vscCell = findMappedNotebookCell(cellToCheck, document.cells);
        updateCellOutput(vscCell, cellToCheck, changedOutputs);
    });
}

/**
 * Updates the VSC cell with the error output.
 */
export function updateCellWithErrorStatus(cell: NotebookCell, ex: Partial<Error>) {
    cell.outputs = [translateErrorOutput(createErrorOutput(ex))];
    cell.metadata.runState = NotebookCellRunState.Error;
}

export function updateCellExecutionCount(vscCell: NotebookCell, cell: ICell, executionCount: number) {
    cell.data.execution_count = executionCount;
    vscCell.metadata.executionOrder = executionCount;
}

/**
 * Updates our Cell Model with the cell output.
 * As we execute a cell we get output from jupyter. This code will ensure the cell is updated with the output.
 * (this has nothing to do with VSCode cells), this is out ICell in INotebookModel.
 */
export function updateCellOutput(vscCell: NotebookCell, cell: ICell, outputs: nbformat.IOutput[]) {
    cell.data.outputs = outputs;
    const newOutput = createVSCCellOutputsFromOutputs(outputs);
    // If there was no output and still no output, then nothing to do.
    if (
        Array.isArray(cell.data.outputs) &&
        cell.data.outputs.length === 0 &&
        newOutput.length === 0 &&
        vscCell.outputs.length === 0
    ) {
        return;
    }
    // Compare outputs (at the end of the day everything is serializable).
    // Hence this is a safe comparison.
    if (
        Array.isArray(cell.data.outputs) &&
        cell.data.outputs.length === newOutput.length &&
        JSON.stringify(cell.data.outputs) === JSON.stringify(newOutput)
    ) {
        return;
    }
    updateVSCNotebookCellMetadata(vscCell.metadata, cell);
    vscCell.outputs = newOutput;
}

/**
 * Store execution start and end times in ISO format for portability.
 */
export function updateCellExecutionTimes(notebookCellModel: ICell, startTime?: number, duration?: number) {
    const startTimeISO = startTime ? new Date(startTime).toISOString() : undefined;
    const endTimeISO = duration && startTime ? new Date(startTime + duration).toISOString() : undefined;
    updateCellMetadata(notebookCellModel, {
        end_execution_time: endTimeISO,
        start_execution_time: startTimeISO
    });
}

export function updateCellMetadata(notebookCellModel: ICell, metadata: Partial<IBaseCellVSCodeMetadata>) {
    const originalVscodeMetadata: IBaseCellVSCodeMetadata = notebookCellModel.data.metadata.vscode || {};
    // Update our model with the new metadata stored in jupyter.
    notebookCellModel.data.metadata = {
        ...notebookCellModel.data.metadata,
        vscode: {
            ...originalVscodeMetadata,
            ...metadata
        }
    };
}
