// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import * as uuid from 'uuid/v4';
import type {
    CellDisplayOutput,
    CellErrorOutput,
    CellOutput,
    CellStreamOutput,
    NotebookCell,
    NotebookCellData,
    NotebookCellMetadata,
    NotebookData,
    NotebookDocument
} from 'vscode-proposed';
import { NotebookCellRunState } from '../../../../../typings/vscode-proposed';
import {
    concatMultilineStringInput,
    concatMultilineStringOutput,
    splitMultilineString
} from '../../../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../../../datascience-ui/common/cellFactory';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../common/constants';
import { traceError, traceWarning } from '../../../common/logger';
import { CellState, ICell, INotebookModel } from '../../types';
import { JupyterNotebookView } from '../constants';
import { mapVSCNotebookCellToCellModel } from './cellMappers';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');

// This is the custom type we are adding into nbformat.IBaseCellMetadata
interface IBaseCellVSCodeMetadata {
    end_execution_time?: string;
    start_execution_time?: string;
}

/**
 * Whether this is a Notebook we created/manage/use.
 * Remember, there could be other notebooks such as GitHub Issues nb by VS Code.
 */
export function isJupyterNotebook(notebook: NotebookDocument) {
    return notebook.viewType === JupyterNotebookView;
}

/**
 * Converts a NotebookModel into VSCode friendly format.
 */
export function notebookModelToVSCNotebookData(model: INotebookModel): NotebookData {
    const cells = model.cells
        .map(createVSCNotebookCellDataFromCell.bind(undefined, model))
        .filter((item) => !!item)
        .map((item) => item!);

    const defaultLanguage = getDefaultCodeLanguage(model);
    return {
        cells,
        languages: [defaultLanguage],
        metadata: {
            cellEditable: model.isTrusted,
            cellRunnable: model.isTrusted,
            editable: model.isTrusted,
            cellHasExecutionOrder: true,
            runnable: model.isTrusted,
            displayOrder: [
                'application/vnd.*',
                'application/vdom.*',
                'application/geo+json',
                'application/x-nteract-model-debug+json',
                'text/html',
                'application/javascript',
                'image/gif',
                'text/latex',
                'text/markdown',
                'image/svg+xml',
                'image/png',
                'image/jpeg',
                'application/json',
                'text/plain'
            ]
        }
    };
}
export function createCellFromVSCNotebookCell(vscCell: NotebookCell, model: INotebookModel): ICell {
    const cell = (() => {
        if (vscCell.cellKind === vscodeNotebookEnums.CellKind.Markdown) {
            return {
                data: createMarkdownCell(splitMultilineString(vscCell.document.getText()), true),
                file: model.file.toString(),
                id: uuid(),
                line: 0,
                state: CellState.init
            };
        }
        return {
            data: createCodeCell([vscCell.document.getText()], []),
            file: model.file.toString(),
            id: uuid(),
            line: 0,
            state: CellState.init
        };
    })();

    // Add the metadata back to the cell if we have any.
    // Refer to `addCellMetadata` to see how metadata is stored in VSC Cells.
    // This metadata would exist if the user copied and pasted an existing cell.
    if (vscCell.metadata.custom?.vscodeMetadata) {
        cell.data = {
            ...cell.data,
            ...vscCell.metadata.custom?.vscodeMetadata
        };
    }
    // Ensure we add the cell id of the new cell to the VSC cell to map into ours.
    mapVSCNotebookCellToCellModel(vscCell, cell);

    return cell;
}

/**
 * Stores the Jupyter Cell metadata into the VSCode Cells.
 * This is used to facilitate:
 * 1. When a user copies and pastes a cell, then the corresponding metadata is also copied across.
 * 2. Diffing (VSC knows about metadata & stuff that contributes changes to a cell).
 */
export function updateVSCNotebookCellMetadata(cellMetadata: NotebookCellMetadata, cell: ICell) {
    cellMetadata.custom = cellMetadata.custom ?? {};
    // tslint:disable-next-line: no-any
    const metadata: Record<string, any> = {};
    cellMetadata.custom.vscodeMetadata = metadata;
    // We put this only for VSC to display in diff view.
    // Else we don't use this.
    const propertiesToClone = ['metadata', 'attachments'];
    propertiesToClone.forEach((propertyToClone) => {
        if (cell.data[propertyToClone]) {
            metadata[propertyToClone] = cloneDeep(cell.data[propertyToClone]);
        }
    });
}

export function getDefaultCodeLanguage(model: INotebookModel) {
    return model.metadata?.language_info?.name &&
        model.metadata?.language_info?.name.toLowerCase() !== PYTHON_LANGUAGE.toLowerCase()
        ? model.metadata?.language_info?.name
        : PYTHON_LANGUAGE;
}

export function createVSCNotebookCellDataFromCell(model: INotebookModel, cell: ICell): NotebookCellData | undefined {
    if (cell.data.cell_type === 'raw') {
        const rawCell = cell.data;
        return {
            cellKind: vscodeNotebookEnums.CellKind.Code,
            language: 'raw',
            metadata: {
                custom: {
                    metadata: rawCell.metadata,
                    attachments: rawCell.attachments
                }
            },
            outputs: [],
            source: concatMultilineStringInput(cell.data.source)
        };
    }
    if (cell.data.cell_type !== 'code' && cell.data.cell_type !== 'markdown') {
        traceError(`Conversion of Cell into VS Code NotebookCell not supported ${cell.data.cell_type}`);
        return;
    }

    // tslint:disable-next-line: no-any
    const outputs = createVSCCellOutputsFromOutputs(cell.data.outputs as any);
    const defaultCodeLanguage = getDefaultCodeLanguage(model);
    // If we have an execution count & no errors, then success state.
    // If we have an execution count &  errors, then error state.
    // Else idle state.
    const hasErrors = outputs.some((output) => output.outputKind === vscodeNotebookEnums.CellOutputKind.Error);
    const hasExecutionCount = typeof cell.data.execution_count === 'number' && cell.data.execution_count > 0;
    let runState: NotebookCellRunState;
    let statusMessage: string | undefined;
    if (!hasExecutionCount) {
        runState = vscodeNotebookEnums.NotebookCellRunState.Idle;
    } else if (hasErrors) {
        runState = vscodeNotebookEnums.NotebookCellRunState.Error;
        // Error details are stripped from the output, get raw output.
        // tslint:disable-next-line: no-any
        statusMessage = getCellStatusMessageBasedOnFirstErrorOutput(cell.data.outputs as any);
    } else {
        runState = vscodeNotebookEnums.NotebookCellRunState.Success;
    }

    const notebookCellMetadata: NotebookCellMetadata = {
        editable: model.isTrusted,
        executionOrder: typeof cell.data.execution_count === 'number' ? cell.data.execution_count : undefined,
        hasExecutionOrder: cell.data.cell_type === 'code',
        runState,
        runnable: cell.data.cell_type === 'code' && model.isTrusted
    };

    if (statusMessage) {
        notebookCellMetadata.statusMessage = statusMessage;
    }
    const vscodeMetadata = (cell.data.metadata.vscode as unknown) as IBaseCellVSCodeMetadata | undefined;
    const startExecutionTime = vscodeMetadata?.start_execution_time
        ? new Date(Date.parse(vscodeMetadata.start_execution_time)).getTime()
        : undefined;
    const endExecutionTime = vscodeMetadata?.end_execution_time
        ? new Date(Date.parse(vscodeMetadata.end_execution_time)).getTime()
        : undefined;

    if (startExecutionTime && typeof endExecutionTime === 'number') {
        notebookCellMetadata.runStartTime = startExecutionTime;
        notebookCellMetadata.lastRunDuration = endExecutionTime - startExecutionTime;
    }

    updateVSCNotebookCellMetadata(notebookCellMetadata, cell);

    // If not trusted, then clear the output in VSC Cell.
    // At this point we have the original output in the ICell.
    if (!model.isTrusted) {
        while (outputs.length) {
            outputs.shift();
        }
    }
    return {
        cellKind:
            cell.data.cell_type === 'code' ? vscodeNotebookEnums.CellKind.Code : vscodeNotebookEnums.CellKind.Markdown,
        language: cell.data.cell_type === 'code' ? defaultCodeLanguage : MARKDOWN_LANGUAGE,
        metadata: notebookCellMetadata,
        source: concatMultilineStringInput(cell.data.source),
        outputs
    };
}

export function createVSCCellOutputsFromOutputs(outputs?: nbformat.IOutput[]): CellOutput[] {
    const cellOutputs: nbformat.IOutput[] = Array.isArray(outputs) ? (outputs as []) : [];
    return cellOutputs
        .map(cellOutputToVSCCellOutput)
        .filter((item) => !!item)
        .map((item) => item!);
}
const cellOutputMappers = new Map<nbformat.OutputType, (output: nbformat.IOutput) => CellOutput | undefined>();
// tslint:disable-next-line: no-any
cellOutputMappers.set('display_data', translateDisplayDataOutput as any);
// tslint:disable-next-line: no-any
cellOutputMappers.set('error', translateErrorOutput as any);
// tslint:disable-next-line: no-any
cellOutputMappers.set('execute_result', translateDisplayDataOutput as any);
// tslint:disable-next-line: no-any
cellOutputMappers.set('stream', translateStreamOutput as any);
// tslint:disable-next-line: no-any
cellOutputMappers.set('update_display_data', translateDisplayDataOutput as any);
export function cellOutputToVSCCellOutput(output: nbformat.IOutput): CellOutput | undefined {
    const fn = cellOutputMappers.get(output.output_type as nbformat.OutputType);
    if (fn) {
        return fn(output);
    }
    traceWarning(`Unable to translate cell from ${output.output_type} to NotebookCellData for VS Code.`);
}

/**
 * Converts a Jupyter display cell output into a VSCode cell output format.
 * Handles sizing, adding backgrounds to images and the like.
 * E.g. Jupyter cell output contains metadata to add backgrounds to images, here we generate the necessary HTML.
 *
 * @export
 * @param {nbformat.IDisplayData} output
 * @returns {(CellDisplayOutput | undefined)}
 */
function translateDisplayDataOutput(
    output: nbformat.IDisplayData | nbformat.IDisplayUpdate | nbformat.IExecuteResult
): CellDisplayOutput | undefined {
    // If no mimeType data, then there's nothing to display.
    if (!Object.keys(output.data || {}).length) {
        return;
    }
    const data = { ...output.data };
    // tslint:disable-next-line: no-any
    const metadata = output.metadata ? ({ custom: output.metadata } as any) : undefined;
    return {
        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
        data,
        metadata // Used be renderers & VS Code for diffing (it knows what has changed).
    };
}

function translateStreamOutput(output: nbformat.IStream): CellStreamOutput | CellDisplayOutput {
    // Do not return as `CellOutputKind.Text`. VSC will not translate ascii output correctly.
    // Instead format the output as rich.
    return {
        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
        data: {
            ['text/plain']: concatMultilineStringOutput(output.text)
        }
    };
}

/**
 * We will display the error message in the status of the cell.
 * The `ename` & `evalue` is displayed at the top of the output by VS Code.
 * As we're displaying the error in the statusbar, we don't want this dup error in output.
 * Hence remove this.
 */
export function translateErrorOutput(output: nbformat.IError): CellErrorOutput {
    return {
        ename: '',
        evalue: '',
        outputKind: vscodeNotebookEnums.CellOutputKind.Error,
        traceback: output.traceback
    };
}

export function getCellStatusMessageBasedOnFirstErrorOutput(outputs?: nbformat.IOutput[]): string {
    if (!Array.isArray(outputs)) {
        return '';
    }
    const errorOutput = (outputs.find((output) => output.output_type === 'error') as unknown) as
        | nbformat.IError
        | undefined;
    if (!errorOutput) {
        return '';
    }
    return `${errorOutput.ename}${errorOutput.evalue ? ': ' : ''}${errorOutput.evalue}`;
}
