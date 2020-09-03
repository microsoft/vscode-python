// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import * as uuid from 'uuid/v4';
import type {
    CellDisplayOutput,
    CellErrorOutput,
    CellOutput,
    NotebookCell,
    NotebookCellData,
    NotebookCellMetadata,
    NotebookData,
    NotebookDocument
} from 'vscode-proposed';
import { NotebookCellRunState } from '../../../../../typings/vscode-proposed';
import { concatMultilineString, splitMultilineString } from '../../../../datascience-ui/common';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../common/constants';
import { traceError, traceWarning } from '../../../common/logger';
import { sendTelemetryEvent } from '../../../telemetry';
import { Telemetry } from '../../constants';
import { CellState, ICell, INotebookModel } from '../../types';
import { JupyterNotebookView } from '../constants';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { isUntitledFile } from '../../../common/utils/misc';
import { KernelConnectionMetadata } from '../../jupyter/kernels/types';
import { updateNotebookMetadata } from '../../notebookStorage/baseModel';
import { VSCodeNotebookModel } from '../../notebookStorage/vscNotebookModel';
import { INotebookContentProvider } from '../types';

// This is the custom type we are adding into nbformat.IBaseCellMetadata
export interface IBaseCellVSCodeMetadata {
    end_execution_time?: string;
    start_execution_time?: string;
}

/**
 * Whether this is a Notebook we created/manage/use.
 * Remember, there could be other notebooks such as GitHub Issues nb by VS Code.
 */
export function isJupyterNotebook(document: NotebookDocument): boolean;
// tslint:disable-next-line: unified-signatures
export function isJupyterNotebook(viewType: string): boolean;
export function isJupyterNotebook(option: NotebookDocument | string) {
    if (typeof option === 'string') {
        return option === JupyterNotebookView;
    } else {
        return option.viewType === JupyterNotebookView;
    }
}

export function getNotebookMetadata(document: NotebookDocument): nbformat.INotebookMetadata | undefined {
    // tslint:disable-next-line: no-any
    let notebookContent: Partial<nbformat.INotebookContent> = document.metadata.custom as any;

    // If language isn't specified in the metadata, at least specify that
    if (!notebookContent?.metadata?.language_info?.name) {
        const content = notebookContent || {};
        const metadata = content.metadata || { orig_nbformat: 3, language_info: {} };
        const language_info = { ...metadata.language_info, name: document.languages[0] };
        // Fix nyc compiler not working.
        // tslint:disable-next-line: no-any
        notebookContent = { ...content, metadata: { ...metadata, language_info } } as any;
    }
    return notebookContent?.metadata;
}
export function updateKernelInNotebookMetadata(
    document: NotebookDocument,
    kernelConnection: KernelConnectionMetadata | undefined,
    notebookContentProvider: INotebookContentProvider
) {
    // tslint:disable-next-line: no-any
    const notebookContent: Partial<nbformat.INotebookContent> = document.metadata.custom as any;
    if (!notebookContent || !notebookContent.metadata) {
        traceError('VSCode Notebook does not have custom metadata', notebookContent);
        throw new Error('VSCode Notebook does not have custom metadata');
    }
    const info = updateNotebookMetadata(notebookContent.metadata, kernelConnection);

    if (info.changed) {
        notebookContentProvider.notifyChangesToDocument(document);
    }
}
/**
 * Converts a NotebookModel into VSCode friendly format.
 */
export function notebookModelToVSCNotebookData(model: VSCodeNotebookModel): NotebookData {
    const cells = model.cells
        .map(createVSCNotebookCellDataFromCell.bind(undefined, model))
        .filter((item) => !!item)
        .map((item) => item!);

    const defaultLanguage = getDefaultCodeLanguage(model);
    if (cells.length === 0 && isUntitledFile(model.file)) {
        cells.push({
            cellKind: vscodeNotebookEnums.CellKind.Code,
            language: defaultLanguage,
            metadata: {},
            outputs: [],
            source: ''
        });
    }
    return {
        cells,
        languages: ['*'],
        metadata: {
            custom: model.notebookContentWithoutCells,
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
    let cell: ICell;
    if (vscCell.cellKind === vscodeNotebookEnums.CellKind.Markdown) {
        const data = createMarkdownCellFromVSCNotebookCell(vscCell);
        cell = {
            data,
            file: model.file.toString(),
            id: uuid(),
            line: 0,
            state: CellState.init
        };
    } else if (vscCell.language === 'raw') {
        const data = createRawCellFromVSCNotebookCell(vscCell);
        cell = {
            data,
            file: model.file.toString(),
            id: uuid(),
            line: 0,
            state: CellState.init
        };
    } else {
        const data = createCodeCellFromVSCNotebookCell(vscCell);
        cell = {
            data,
            file: model.file.toString(),
            id: uuid(),
            line: 0,
            state: CellState.init
        };
    }
    // Delete the `metadata.custom.vscode` property we added.
    if ('vscode' in cell.data.metadata) {
        const metadata = { ...cell.data.metadata };
        delete metadata.vscode;
        cell.data.metadata = metadata;
    }
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
    // We put this only for VSC to display in diff view.
    // Else we don't use this.
    const propertiesToClone = ['metadata', 'attachments'];
    propertiesToClone.forEach((propertyToClone) => {
        if (cell.data[propertyToClone]) {
            cellMetadata.custom![propertyToClone] = cloneDeep(cell.data[propertyToClone]);
        }
    });
}

export function getDefaultCodeLanguage(model: INotebookModel) {
    return model.metadata?.language_info?.name &&
        model.metadata?.language_info?.name.toLowerCase() !== PYTHON_LANGUAGE.toLowerCase()
        ? model.metadata?.language_info?.name
        : PYTHON_LANGUAGE;
}
function createRawCellFromVSCNotebookCell(cell: NotebookCell): nbformat.IRawCell {
    const rawCell: nbformat.IRawCell = {
        cell_type: 'raw',
        source: splitMultilineString(cell.document.getText()),
        metadata: cell.metadata.custom?.metadata || {}
    };
    if (cell.metadata.custom?.attachments) {
        rawCell.attachments = cell.metadata.custom?.attachments;
    }
    return rawCell;
}

function createVSCNotebookCellDataFromRawCell(model: INotebookModel, cell: ICell): NotebookCellData {
    const notebookCellMetadata: NotebookCellMetadata = {
        editable: model.isTrusted,
        executionOrder: undefined,
        hasExecutionOrder: false,
        runnable: false
    };
    updateVSCNotebookCellMetadata(notebookCellMetadata, cell);
    return {
        cellKind: vscodeNotebookEnums.CellKind.Code,
        language: 'raw',
        metadata: notebookCellMetadata,
        outputs: [],
        source: concatMultilineString(cell.data.source)
    };
}
function createMarkdownCellFromVSCNotebookCell(cell: NotebookCell): nbformat.IMarkdownCell {
    const markdownCell: nbformat.IMarkdownCell = {
        cell_type: 'markdown',
        source: splitMultilineString(cell.document.getText()),
        metadata: cell.metadata.custom?.metadata || {}
    };
    if (cell.metadata.custom?.attachments) {
        markdownCell.attachments = cell.metadata.custom?.attachments;
    }
    return markdownCell;
}
function createVSCNotebookCellDataFromMarkdownCell(model: INotebookModel, cell: ICell): NotebookCellData {
    const notebookCellMetadata: NotebookCellMetadata = {
        editable: model.isTrusted,
        executionOrder: undefined,
        hasExecutionOrder: false,
        runnable: false
    };
    updateVSCNotebookCellMetadata(notebookCellMetadata, cell);
    return {
        cellKind: vscodeNotebookEnums.CellKind.Markdown,
        language: MARKDOWN_LANGUAGE,
        metadata: notebookCellMetadata,
        source: concatMultilineString(cell.data.source),
        outputs: []
    };
}
function createVSCNotebookCellDataFromCodeCell(model: INotebookModel, cell: ICell): NotebookCellData {
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
        hasExecutionOrder: true,
        runState,
        runnable: model.isTrusted
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
        cellKind: vscodeNotebookEnums.CellKind.Code,
        language: defaultCodeLanguage,
        metadata: notebookCellMetadata,
        source: concatMultilineString(cell.data.source),
        outputs
    };
}

export function createIOutputFromCellOutputs(cellOutputs: CellOutput[]): nbformat.IOutput[] {
    return cellOutputs
        .map((output) => {
            switch (output.outputKind) {
                case vscodeNotebookEnums.CellOutputKind.Error:
                    return translateCellErrorOutput(output);
                case vscodeNotebookEnums.CellOutputKind.Rich:
                    return translateCellDisplayOutput(output);
                case vscodeNotebookEnums.CellOutputKind.Text:
                    // We do not generate text output.
                    return;
                default:
                    return;
            }
        })
        .filter((output) => !!output)
        .map((output) => output!!);
}

export function clearCellForExecution(cell: NotebookCell) {
    cell.metadata.statusMessage = undefined;
    cell.metadata.executionOrder = undefined;
    cell.metadata.lastRunDuration = undefined;
    cell.metadata.runStartTime = undefined;
    cell.outputs = [];

    updateCellExecutionTimes(cell);
}

/**
 * Store execution start and end times.
 * Stored as ISO for portability.
 */
export function updateCellExecutionTimes(cell: NotebookCell, times?: { startTime?: number; duration?: number }) {
    if (!times || !times.duration || !times.startTime) {
        if (cell.metadata.custom?.metadata?.vscode?.start_execution_time) {
            delete cell.metadata.custom.metadata.vscode.start_execution_time;
        }
        if (cell.metadata.custom?.metadata?.vscode?.end_execution_time) {
            delete cell.metadata.custom.metadata.vscode.end_execution_time;
        }
        return;
    }

    const startTimeISO = new Date(times.startTime).toISOString();
    const endTimeISO = new Date(times.startTime + times.duration).toISOString();
    cell.metadata.custom = cell.metadata.custom || {};
    cell.metadata.custom.metadata = cell.metadata.custom.metadata || {};
    cell.metadata.custom.metadata.vscode = cell.metadata.custom.metadata.vscode || {};
    cell.metadata.custom.metadata.vscode.end_execution_time = endTimeISO;
    cell.metadata.custom.metadata.vscode.start_execution_time = startTimeISO;
}

function createCodeCellFromVSCNotebookCell(cell: NotebookCell): nbformat.ICodeCell {
    const metadata = cell.metadata.custom?.metadata || {};
    return {
        cell_type: 'code',
        execution_count: cell.metadata.executionOrder ?? null,
        source: splitMultilineString(cell.document.getText()),
        outputs: createIOutputFromCellOutputs(cell.outputs),
        metadata
    };
}
export function createVSCNotebookCellDataFromCell(model: INotebookModel, cell: ICell): NotebookCellData | undefined {
    switch (cell.data.cell_type) {
        case 'raw': {
            return createVSCNotebookCellDataFromRawCell(model, cell);
        }
        case 'markdown': {
            return createVSCNotebookCellDataFromMarkdownCell(model, cell);
        }
        case 'code': {
            return createVSCNotebookCellDataFromCodeCell(model, cell);
        }
        default: {
            traceError(`Conversion of Cell into VS Code NotebookCell not supported ${cell.data.cell_type}`);
        }
    }
}

export function createVSCCellOutputsFromOutputs(outputs?: nbformat.IOutput[]): CellOutput[] {
    const cellOutputs: nbformat.IOutput[] = Array.isArray(outputs) ? (outputs as []) : [];
    return cellOutputs.map(cellOutputToVSCCellOutput);
}
const cellOutputMappers = new Map<
    nbformat.OutputType,
    (output: nbformat.IOutput, outputType: nbformat.OutputType) => CellOutput
>();
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
export function cellOutputToVSCCellOutput(output: nbformat.IOutput): CellOutput {
    const fn = cellOutputMappers.get(output.output_type as nbformat.OutputType);
    let result: CellOutput;
    if (fn) {
        result = fn(output, (output.output_type as unknown) as nbformat.OutputType);
    } else {
        traceWarning(`Unable to translate cell from ${output.output_type} to NotebookCellData for VS Code.`);
        result = {
            outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
            // tslint:disable-next-line: no-any
            data: output.data as any,
            metadata: { custom: { vscode: { outputType: output.output_type } } }
        };
    }

    // Add on transient data if we have any. This should be removed by our save functions elsewhere.
    if (
        output.transient &&
        result &&
        result.outputKind === vscodeNotebookEnums.CellOutputKind.Rich &&
        result.metadata
    ) {
        // tslint:disable-next-line: no-any
        result.metadata.custom = { ...result.metadata.custom, transient: output.transient };
    }
    return result;
}

export function vscCellOutputToCellOutput(output: CellOutput): nbformat.IOutput | undefined {
    switch (output.outputKind) {
        case vscodeNotebookEnums.CellOutputKind.Error: {
            return translateCellErrorOutput(output);
        }
        case vscodeNotebookEnums.CellOutputKind.Rich: {
            return translateCellDisplayOutput(output);
        }
        case vscodeNotebookEnums.CellOutputKind.Text: {
            // We do not return such output.
            return;
        }
        default: {
            return;
        }
    }
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
    output: nbformat.IDisplayData | nbformat.IDisplayUpdate | nbformat.IExecuteResult,
    outputType: nbformat.OutputType
): CellDisplayOutput | undefined {
    const data = { ...output.data };
    // tslint:disable-next-line: no-any
    const metadata = output.metadata ? ({ custom: output.metadata } as any) : { custom: {} };
    metadata.custom.vscode = { outputType };
    if (output.execution_count) {
        metadata.execution_order = output.execution_count;
    }
    return {
        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
        data,
        metadata // Used be renderers & VS Code for diffing (it knows what has changed).
    };
}

function translateStreamOutput(output: nbformat.IStream, outputType: nbformat.OutputType): CellDisplayOutput {
    // Do not return as `CellOutputKind.Text`. VSC will not translate ascii output correctly.
    // Instead format the output as rich.
    return {
        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
        data: {
            ['text/plain']: concatMultilineString(output.text, true)
        },
        metadata: {
            custom: { vscode: { outputType, name: output.name } }
        }
    };
}

// tslint:disable-next-line: no-any
function getSanitizedCellMetadata(metadata?: { [key: string]: any }) {
    const cloned = { ...metadata };
    if ('vscode' in cloned) {
        delete cloned.vscode;
    }
    return cloned;
}

type JupyterOutput =
    | nbformat.IUnrecognizedOutput
    | nbformat.IExecuteResult
    | nbformat.IDisplayData
    | nbformat.IStream
    | nbformat.IError;

function translateCellDisplayOutput(output: CellDisplayOutput): JupyterOutput {
    const outputType: nbformat.OutputType = output.metadata?.custom?.vscode?.outputType;
    let result: JupyterOutput;
    switch (outputType) {
        case 'stream':
            {
                result = {
                    output_type: 'stream',
                    name: output.metadata?.custom?.vscode?.name,
                    text: splitMultilineString(output.data['text/plain'])
                };
            }
            break;
        case 'display_data':
            {
                const metadata = getSanitizedCellMetadata(output.metadata?.custom);
                result = {
                    output_type: 'display_data',
                    data: output.data,
                    metadata
                };
            }
            break;
        case 'execute_result':
            {
                const metadata = getSanitizedCellMetadata(output.metadata?.custom);
                result = {
                    output_type: 'execute_result',
                    data: output.data,
                    metadata,
                    execution_count: output.metadata?.custom?.vscode?.execution_count
                };
            }
            break;
        case 'update_display_data':
            {
                const metadata = getSanitizedCellMetadata(output.metadata?.custom);
                result = {
                    output_type: 'update_display_data',
                    data: output.data,
                    metadata
                };
            }
            break;
        default:
            {
                sendTelemetryEvent(Telemetry.VSCNotebookCellTranslationFailed, undefined, {
                    isErrorOutput: outputType === 'error'
                });
                const metadata = getSanitizedCellMetadata(output.metadata?.custom);
                const unknownOutput: nbformat.IUnrecognizedOutput = { output_type: outputType };
                if (Object.keys(metadata).length > 0) {
                    unknownOutput.metadata = metadata;
                }
                if (Object.keys(output.data).length > 0) {
                    unknownOutput.data = output.data;
                }
                result = unknownOutput;
            }
            break;
    }

    // Account for transient data as well
    if (result && output.metadata && output.metadata.custom?.transient) {
        result.transient = { ...output.metadata.custom?.transient };
    }
    return result;
}

/**
 * We will display the error message in the status of the cell.
 * The `ename` & `evalue` is displayed at the top of the output by VS Code.
 * As we're displaying the error in the statusbar, we don't want this dup error in output.
 * Hence remove this.
 */
export function translateErrorOutput(output: nbformat.IError): CellErrorOutput {
    return {
        ename: output.ename,
        evalue: output.evalue,
        outputKind: vscodeNotebookEnums.CellOutputKind.Error,
        traceback: output.traceback
    };
}
export function translateCellErrorOutput(output: CellErrorOutput): nbformat.IError {
    return {
        output_type: 'error',
        ename: output.ename,
        evalue: output.evalue,
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
export function getCellStatusMessageBasedOnFirstCellErrorOutput(outputs?: CellOutput[]): string {
    if (!Array.isArray(outputs)) {
        return '';
    }
    const errorOutput = outputs.find((output) => output.outputKind === vscodeNotebookEnums.CellOutputKind.Error) as
        | CellErrorOutput
        | undefined;
    if (!errorOutput) {
        return '';
    }
    return `${errorOutput.ename}${errorOutput.evalue ? ': ' : ''}${errorOutput.evalue}`;
}

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
