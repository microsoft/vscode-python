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
    NotebookData
} from 'vscode-proposed';
import { NotebookCellRunState } from '../../../../../typings/vscode-proposed';
import {
    concatMultilineStringInput,
    concatMultilineStringOutput,
    splitMultilineString
} from '../../../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../../../datascience-ui/common/cellFactory';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../common/constants';
import { traceError, traceWarning } from '../../../logging';
import { CellState, ICell, INotebookModel } from '../../types';
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
 * Converts a NotebookModel into VSCode friendly format.
 */
export function notebookModelToVSCNotebookData(model: INotebookModel): NotebookData {
    const cells = model.cells
        .map(createVSCNotebookCellDataFromCell.bind(undefined, model))
        .filter((item) => !!item)
        .map((item) => item!);

    const defaultLangauge = getDefaultCodeLanguage(model);
    return {
        cells,
        languages: [defaultLangauge],
        metadata: {
            cellEditable: true,
            cellRunnable: true,
            editable: true,
            cellHasExecutionOrder: true,
            runnable: true,
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
 * Updates the VSC Cell metadata with metadata from our cells.
 * If user exits without saving, then we have all metadata in VSC document.
 * (required for hot exit).
 */
export function updateVSCNotebookCellMetadata(cellMetadata: NotebookCellMetadata, cell: ICell) {
    cellMetadata.custom = cellMetadata.custom ?? {};
    // tslint:disable-next-line: no-any
    const metadata: Record<string, any> = {};
    cellMetadata.custom.vscodeMetadata = metadata;
    const propertiesToClone = ['metadata', 'attachments', 'outputs'];
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

    const notebookCellData: NotebookCellData = {
        cellKind:
            cell.data.cell_type === 'code' ? vscodeNotebookEnums.CellKind.Code : vscodeNotebookEnums.CellKind.Markdown,
        language: cell.data.cell_type === 'code' ? defaultCodeLanguage : MARKDOWN_LANGUAGE,
        metadata: {
            editable: true,
            executionOrder: typeof cell.data.execution_count === 'number' ? cell.data.execution_count : undefined,
            hasExecutionOrder: cell.data.cell_type === 'code',
            runState,
            runnable: cell.data.cell_type === 'code'
        },
        source: concatMultilineStringInput(cell.data.source),
        outputs
    };

    if (statusMessage) {
        notebookCellData.metadata.statusMessage = statusMessage;
    }
    const vscodeMetadata = (cell.data.metadata.vscode as unknown) as IBaseCellVSCodeMetadata | undefined;
    const startExecutionTime = vscodeMetadata?.start_execution_time
        ? new Date(Date.parse(vscodeMetadata.start_execution_time)).getTime()
        : undefined;
    const endExecutionTime = vscodeMetadata?.end_execution_time
        ? new Date(Date.parse(vscodeMetadata.end_execution_time)).getTime()
        : undefined;

    if (startExecutionTime && typeof endExecutionTime === 'number') {
        notebookCellData.metadata.runStartTime = startExecutionTime;
        notebookCellData.metadata.lastRunDuration = endExecutionTime - startExecutionTime;
    }

    updateVSCNotebookCellMetadata(notebookCellData.metadata, cell);
    return notebookCellData;
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
function translateDisplayDataOutput(output: nbformat.IDisplayData): CellDisplayOutput | undefined {
    const mimeTypes = Object.keys(output.data || {});
    // If no mimetype data, then there's nothing to display.
    if (!mimeTypes.length) {
        return;
    }
    // If we have images, then process those images.
    // If we have PNG or JPEG images with a background, then add that background as HTML
    const data = { ...output.data };
    if (mimeTypes.some(isImagePngOrJpegMimeType) && shouldConvertImageToHtml(output) && !output.data['text/html']) {
        const mimeType = 'image/png' in data ? 'image/png' : 'image/jpeg';
        const metadata = output.metadata || {};
        const needsBackground = typeof metadata.needs_background === 'string';
        const backgroundColor = metadata.needs_background === 'light' ? 'white' : 'black';
        const divStyle = needsBackground ? `background-color:${backgroundColor};` : '';
        const imgSrc = `data:${mimeType};base64,${output.data[mimeType]}`;

        let height = '';
        let width = '';
        let imgStyle = '';
        if (metadata[mimeType] && typeof metadata[mimeType] === 'object') {
            // tslint:disable-next-line: no-any
            const imageMetadata = metadata[mimeType] as any;
            height = imageMetadata.height ? `height=${imageMetadata.height}` : '';
            width = imageMetadata.width ? `width=${imageMetadata.width}` : '';
            if (imageMetadata.unconfined === true) {
                imgStyle = `style="max-width:none"`;
            }
        }

        // Hack, use same classes as used in VSCode for images.
        // This is to maintain consistenly in displaying images (if we hadn't used HTML).
        // See src/vs/workbench/contrib/notebook/browser/view/output/transforms/richTransform.ts
        data[
            'text/html'
        ] = `<div class='display' style="overflow:scroll;${divStyle}"><img src="${imgSrc}" ${imgStyle} ${height} ${width}></div>`;
    }
    return {
        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
        data
    };
}

function shouldConvertImageToHtml(output: nbformat.IDisplayData) {
    const metadata = output.metadata || {};
    return typeof metadata.needs_background === 'string' || metadata['image/png'] || metadata['image/jpeg'];
}
function isImagePngOrJpegMimeType(mimeType: string) {
    return mimeType === 'image/png' || mimeType === 'image/jpeg';
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
