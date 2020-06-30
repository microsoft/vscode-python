// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode';
import { createErrorOutput } from '../../../../datascience-ui/common/cellFactory';
import { VSCodeNotebookModel } from '../../notebookStorage/vscNotebookModel';
import { ICell } from '../../types';
import { findMappedNotebookCell } from './cellMappers';
import { createVSCCellOutputsFromOutputs, translateErrorOutput, updateVSCNotebookCellMetadata } from './helpers';

export interface IBaseCellVSCodeMetadata {
    end_execution_time?: string;
    start_execution_time?: string;
}

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
 * @returns {boolean} Returns `true` if output has changed.
 */
export function handleUpdateDisplayDataMessage(
    msg: KernelMessage.IUpdateDisplayDataMsg,
    model: VSCodeNotebookModel,
    document: NotebookDocument
): boolean {
    // Find any cells that have this same display_id
    return (
        model.cells.filter((cellToCheck) => {
            if (cellToCheck.data.cell_type !== 'code') {
                return false;
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
                return false;
            }

            const vscCell = findMappedNotebookCell(cellToCheck, document.cells);
            updateCellOutput(model, vscCell, cellToCheck, changedOutputs);
            return true;
        }).length > 0
    );
}

/**
 * Updates the VSC cell with the error output.
 */
export function updateCellWithErrorStatus(cell: NotebookCell, ex: Partial<Error>) {
    cell.outputs = [translateErrorOutput(createErrorOutput(ex))];
    cell.metadata.runState = NotebookCellRunState.Error;
}

/**
 * @returns {boolean} Returns `true` if execution count has changed.
 */
export function updateCellExecutionCount(
    model: VSCodeNotebookModel,
    vscCell: NotebookCell,
    cell: ICell,
    executionCount: number
): boolean {
    if (cell.data.execution_count !== executionCount && vscCell.metadata.executionOrder !== executionCount) {
        model.updateCellExecutionCount(cell, executionCount);
        vscCell.metadata.executionOrder = executionCount;
        return true;
    }
    return false;
}

/**
 * Updates our Cell Model with the cell output.
 * As we execute a cell we get output from jupyter. This code will ensure the cell is updated with the output.
 * Here we update both the VSCode Cell as well as our ICell (cell in our INotebookModel).
 * @returns {(boolean | undefined)} Returns `true` if output has changed.
 */
export function updateCellOutput(
    model: VSCodeNotebookModel,
    vscCell: NotebookCell,
    cell: ICell,
    outputs: nbformat.IOutput[]
): boolean | undefined {
    model.updateCellOutput(cell, outputs);
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
        Array.isArray(vscCell.outputs) &&
        vscCell.outputs.length === newOutput.length &&
        JSON.stringify(vscCell.outputs) === JSON.stringify(newOutput)
    ) {
        return;
    }
    updateVSCNotebookCellMetadata(vscCell.metadata, cell);
    vscCell.outputs = newOutput;
    return true;
}

/**
 * Store execution start and end times.
 * Stored as ISO for portability.
 */
export function updateCellExecutionTimes(
    model: VSCodeNotebookModel,
    cell: ICell,
    startTime?: number,
    duration?: number
) {
    const startTimeISO = startTime ? new Date(startTime).toISOString() : undefined;
    const endTimeISO = duration && startTime ? new Date(startTime + duration).toISOString() : undefined;
    model.updateCellMetadata(cell, {
        end_execution_time: endTimeISO,
        start_execution_time: startTimeISO
    });
}
