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
export async function handleUpdateDisplayDataMessage(
    msg: KernelMessage.IUpdateDisplayDataMsg,
    editor: NotebookEditor
): Promise<boolean> {
    const document = editor.document;
    let updated = false;
    // Find any cells that have this same display_id
    for (const cell of document.cells) {
        if (cell.cellKind !== vscodeNotebookEnums.CellKind.Code) {
            return false;
        }

        const outputs = createIOutputFromCellOutputs(cell.outputs);
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
            continue;
        }

        await updateCellOutput(editor, cell, changedOutputs);
        updated = true;
    }

    return updated;
}

/**
 * Updates the VSC cell with the error output.
 */
export async function updateCellWithErrorStatus(
    notebookEditor: NotebookEditor,
    cell: NotebookCell,
    ex: Partial<Error>
) {
    const cellIndex = cell.notebook.cells.indexOf(cell);
    await notebookEditor.edit((edit) => {
        edit.replaceCellMetadata(cellIndex, {
            ...cell.metadata,
            runState: vscodeNotebookEnums.NotebookCellRunState.Error
        });
        edit.replaceCellOutput(cellIndex, [translateErrorOutput(createErrorOutput(ex))]);
    });
}

/**
 * @returns {boolean} Returns `true` if execution count has changed.
 */
export async function updateCellExecutionCount(
    editor: NotebookEditor,
    cell: NotebookCell,
    executionCount: number
): Promise<boolean> {
    if (cell.metadata.executionOrder !== executionCount && executionCount) {
        const cellIndex = editor.document.cells.indexOf(cell);
        await editor.edit((edit) =>
            edit.replaceCellMetadata(cellIndex, {
                ...cell.metadata,
                executionOrder: executionCount
            })
        );
        return true;
    }
    return false;
}

/**
 * Updates our Cell Model with the cell output.
 * As we execute a cell we get output from jupyter. This code will ensure the cell is updated with the output.
 */
export async function updateCellOutput(editor: NotebookEditor, cell: NotebookCell, outputs: nbformat.IOutput[]) {
    const newOutput = createVSCCellOutputsFromOutputs(outputs);
    // If there was no output and still no output, then nothing to do.
    if (cell.outputs.length === 0 && newOutput.length === 0) {
        return;
    }
    // Compare outputs (at the end of the day everything is serializable).
    // Hence this is a safe comparison.
    if (cell.outputs.length === newOutput.length && fastDeepEqual(cell.outputs, newOutput)) {
        return;
    }
    const cellIndex = cell.notebook.cells.indexOf(cell);
    await editor.edit((edit) => edit.replaceCellOutput(cellIndex, newOutput));
}
