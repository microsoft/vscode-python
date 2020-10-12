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
): Promise<void> {
    const document = editor.document;
    // Find any cells that have this same display_id
    for (const cell of document.cells) {
        if (cell.cellKind !== vscodeNotebookEnums.CellKind.Code) {
            continue;
        }
        let updated = false;

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

        if (updated) {
            await updateCellOutput(editor, cell, changedOutputs);
        }
    }
}

/**
 * Updates the VSC cell with the error output.
 */
export async function updateCellWithErrorStatus(
    notebookEditor: NotebookEditor,
    cell: NotebookCell,
    ex: Partial<Error>
) {
    await notebookEditor.edit((edit) => {
        edit.replaceCellMetadata(cell.index, {
            ...cell.metadata,
            runState: vscodeNotebookEnums.NotebookCellRunState.Error
        });
        edit.replaceCellOutput(cell.index, [translateErrorOutput(createErrorOutput(ex))]);
    });
}

/**
 * @returns {boolean} Returns `true` if execution count has changed.
 */
export async function updateCellExecutionCount(
    editor: NotebookEditor,
    cell: NotebookCell,
    executionCount: number
): Promise<void> {
    if (cell.metadata.executionOrder !== executionCount && executionCount) {
        await editor.edit((edit) =>
            edit.replaceCellMetadata(cell.index, {
                ...cell.metadata,
                executionOrder: executionCount
            })
        );
    }
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
    await editor.edit((edit) => edit.replaceCellOutput(cell.index, newOutput));
}
