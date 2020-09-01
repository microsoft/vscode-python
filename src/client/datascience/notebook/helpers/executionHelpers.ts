// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import * as fastDeepEqual from 'fast-deep-equal';
import type { NotebookCell, NotebookEditor } from '../../../../../types/vscode-proposed';
import { createErrorOutput } from '../../../../datascience-ui/common/cellFactory';
import { createIOutputFromCellOutputs, createVSCCellOutputsFromOutputs, translateErrorOutput } from './helpers';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * Updates the cell in notebook model as well as the notebook document.
 * Update notebook document so UI is updated accordingly.
 * Notebook model is what we use to update/track changes to ipynb.
 * @returns {boolean} Returns `true` if output has changed.
 */
export function handleUpdateDisplayDataMessage(
    msg: KernelMessage.IUpdateDisplayDataMsg,
    editor: NotebookEditor
): boolean {
    const document = editor.document;
    // Find any cells that have this same display_id
    return (
        document.cells.filter((cellToCheck, index) => {
            if (cellToCheck.cellKind !== vscodeNotebookEnums.CellKind.Code) {
                return false;
            }

            let updated = false;
            const outputs = createIOutputFromCellOutputs(cellToCheck.outputs);
            const changedOutputs = outputs.map((output) => {
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

            const vscCell = document.cells[index];
            updateCellOutput(editor, vscCell, changedOutputs);
            return true;
        }).length > 0
    );
}

/**
 * Updates the VSC cell with the error output.
 */
export function updateCellWithErrorStatus(editor: NotebookEditor, cell: NotebookCell, ex: Partial<Error>) {
    editor.edit((edit) => {
        const cellIndex = editor.document.cells.indexOf(cell);
        edit.replaceMetadata(cellIndex, { ...cell.metadata, runState: vscodeNotebookEnums.NotebookCellRunState.Error });
        edit.replaceOutput(cellIndex, [translateErrorOutput(createErrorOutput(ex))]);
    });
    cell.outputs = [translateErrorOutput(createErrorOutput(ex))];
}

/**
 * @returns {boolean} Returns `true` if execution count has changed.
 */
export function updateCellExecutionCount(editor: NotebookEditor, cell: NotebookCell, executionCount: number): boolean {
    if (cell.metadata.executionOrder !== executionCount && executionCount) {
        editor.edit((edit) => {
            const cellIndex = editor.document.cells.indexOf(cell);
            edit.replaceMetadata(cellIndex, { ...cell.metadata, executionOrder: executionCount });
        });
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
    editor: NotebookEditor,
    vscCell: NotebookCell,
    outputs: nbformat.IOutput[]
): boolean | undefined {
    const newOutput = createVSCCellOutputsFromOutputs(outputs);
    // If there was no output and still no output, then nothing to do.
    if (vscCell.outputs.length === 0 && newOutput.length === 0) {
        return;
    }
    // Compare outputs (at the end of the day everything is serializable).
    // Hence this is a safe comparison.
    if (vscCell.outputs.length === newOutput.length && fastDeepEqual(vscCell.outputs, newOutput)) {
        return;
    }
    editor.edit((edit) => edit.replaceOutput(0, newOutput));
    return true;
}
