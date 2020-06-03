// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import type {
    CellDisplayOutput,
    CellErrorOutput,
    CellOutput,
    CellStreamOutput,
    NotebookCellData,
    NotebookData
} from 'vscode-proposed';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');
import * as uuid from 'uuid/v4';
import {
    concatMultilineStringInput,
    concatMultilineStringOutput,
    splitMultilineString
} from '../../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../common/constants';
import { traceError, traceWarning } from '../../logging';
import { CellState, ICell, INotebookModel } from '../types';

/**
 * Converts a NotebookModel into VSCode friendly format.
 */
export function notebookModelToVSCNotebookData(model: INotebookModel): NotebookData {
    const cells = model.cells
        .map(cellToVSCNotebookCellData)
        .filter((item) => !!item)
        .map((item) => item!);

    return {
        cells,
        languages: [PYTHON_LANGUAGE, MARKDOWN_LANGUAGE],
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
export function vscNotebookCellToCellModel(cell: NotebookCellData, model: INotebookModel): ICell {
    if (cell.cellKind === vscodeNotebookEnums.CellKind.Markdown) {
        return {
            data: createMarkdownCell(splitMultilineString(cell.source), true),
            file: model.file.toString(),
            id: uuid(),
            line: 0,
            state: CellState.init
        };
    }
    assert.equal(cell.language, PYTHON_LANGUAGE, 'Cannot create a non Python cell');
    return {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: #12068 Translate output into nbformat.IOutput.
        data: createCodeCell([cell.source], []),
        file: model.file.toString(),
        id: uuid(),
        line: 0,
        state: CellState.init
    };
}
export function cellToVSCNotebookCellData(cell: ICell): NotebookCellData | undefined {
    if (cell.data.cell_type !== 'code' && cell.data.cell_type !== 'markdown') {
        traceError(`Conversion of Cell into VS Code NotebookCell not supported ${cell.data.cell_type}`);
        return;
    }

    return {
        cellKind:
            cell.data.cell_type === 'code' ? vscodeNotebookEnums.CellKind.Code : vscodeNotebookEnums.CellKind.Markdown,
        language: cell.data.cell_type === 'code' ? PYTHON_LANGUAGE : MARKDOWN_LANGUAGE,
        metadata: {
            editable: true,
            executionOrder: typeof cell.data.execution_count === 'number' ? cell.data.execution_count : undefined,
            hasExecutionOrder: cell.data.cell_type === 'code',
            runState: vscodeNotebookEnums.NotebookCellRunState.Idle,
            runnable: cell.data.cell_type === 'code',
            custom: {
                cellId: cell.id
            }
        },
        source: concatMultilineStringInput(cell.data.source),
        // tslint:disable-next-line: no-any
        outputs: cellOutputsToVSCCellOutputs(cell.data.outputs as any)
    };
}

export function cellOutputsToVSCCellOutputs(outputs?: nbformat.IOutput[]): CellOutput[] {
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
export function translateErrorOutput(output: nbformat.IError): CellErrorOutput {
    return {
        ename: output.ename,
        evalue: output.evalue,
        outputKind: vscodeNotebookEnums.CellOutputKind.Error,
        traceback: output.traceback
    };
}
