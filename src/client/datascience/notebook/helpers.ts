// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import {
    CellDisplayOutput,
    CellErrorOutput,
    CellKind,
    CellOutput,
    CellOutputKind,
    CellStreamOutput,
    NotebookCell,
    NotebookCellData,
    NotebookCellRunState,
    NotebookData
} from 'vscode';
import { concatMultilineStringInput, concatMultilineStringOutput } from '../../../datascience-ui/common';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../common/constants';
import { traceError, traceWarning } from '../../logging';
import { ICell, INotebookModel } from '../types';

export function findMappedNotebookCellData(source: ICell, cells: NotebookCell[]): NotebookCell {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Will metadata get copied across when copying/pasting cells (cloning a cell)?
    // If so, then we have a problem.
    const found = cells.filter((cell) => source.id === cell.metadata.custom?.cellId);

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Once VSC provides API, throw error here.
    if (!found || !found.length) {
        traceError(`Unable to find matching cell for ${source}`);
        return cells[0];
    }

    return found[0];
}

export function findMappedNotebookCellModel(source: NotebookCell, cells: ICell[]): ICell {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Will metadata get copied across when copying/pasting cells (cloning a cell)?
    // If so, then we have a problem.
    const found = cells.filter((cell) => cell.id === source.metadata.custom?.cellId);

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Once VSC provides API, throw error here.
    if (!found || !found.length) {
        traceError(`Unable to find matching cell for ${source}`);
        return cells[0];
    }

    return found[0];
}

/**
 * Converts a NotebookModel into VSCode friendly format.
 */
export function notebookModelToNotebookData(model: INotebookModel): NotebookData {
    const cells = model.cells
        .map(createNotebookCellDataFromCell)
        .filter((item) => !!item)
        .map((item) => item!);

    return {
        cells,
        languages: [PYTHON_LANGUAGE, MARKDOWN_LANGUAGE],
        metadata: {
            cellEditable: true,
            cellRunnable: true,
            editable: true,
            hasExecutionOrder: true,
            runnable: true,
            displayOrder: [
                'application/vnd.*',
                'application/json',
                'application/javascript',
                'text/html',
                'image/svg+xml',
                'text/markdown',
                'image/svg+xml',
                'image/png',
                'image/jpeg',
                'text/latex',
                'text/plain'
            ]
        }
    };
}
export function createNotebookCellDataFromCell(cell: ICell): NotebookCellData | undefined {
    if (cell.data.cell_type !== 'code' && cell.data.cell_type !== 'markdown') {
        traceError(`Conversion of Cell into VS Code NotebookCell not supported ${cell.data.cell_type}`);
        return;
    }

    return {
        cellKind: cell.data.cell_type === 'code' ? CellKind.Code : CellKind.Markdown,
        language: cell.data.cell_type === 'code' ? PYTHON_LANGUAGE : MARKDOWN_LANGUAGE,
        metadata: {
            editable: true,
            executionOrder: typeof cell.data.execution_count === 'number' ? cell.data.execution_count : undefined,
            runState: NotebookCellRunState.Idle,
            runnable: true,
            custom: {
                cellId: cell.id
            }
        },
        source: concatMultilineStringInput(cell.data.source),
        // tslint:disable-next-line: no-any
        outputs: translateCellOutputs(cell.data.outputs as any)
    };
}

export function translateCellOutputs(outputs?: nbformat.IOutput[]): CellOutput[] {
    const cellOutputs: nbformat.IOutput[] = Array.isArray(outputs) ? (outputs as []) : [];
    return cellOutputs
        .map(translateCellOutput)
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
export function translateCellOutput(output: nbformat.IOutput): CellOutput | undefined {
    const fn = cellOutputMappers.get(output.output_type as nbformat.OutputType);
    if (fn) {
        return fn(output);
    }
    traceWarning(`Unable to translate cell from ${output.output_type} to NotebookCellData for VS Code.`);
}
export function translateDisplayDataOutput(output: nbformat.IDisplayData): CellDisplayOutput | undefined {
    const mimeTypes = Object.keys(output.data);
    // If no mimetype data, then there's nothing to display.
    if (!mimeTypes.length) {
        return;
    }
    // If we have images, then process those images.
    // If we have PNG or JPEG images with a background, then add that background as HTML & delete image mime type.
    // Note: Assumption here is that PNG/JPEG takes precedence.
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Why would HTML be lower in priority over PNG/JPEG, surely HTML is better.
    // It could contain some plot with JS code.
    const data = { ...output.data };
    if (mimeTypes.some(isImagePngOrJpegMimeType) && shouldConvertImageToHtml(output) && !output.data['text/html']) {
        const mimeType = 'image/png' in data ? 'image/png' : 'image/jpeg';
        const needsBackground = typeof output.metadata.needs_background === 'string';
        const backgroundColor = output.metadata.needs_background === 'light' ? 'white' : 'black';
        const divStyle = needsBackground ? `background-color:${backgroundColor};` : '';
        const imgSrc = `data:${mimeType};base64,${output.data[mimeType]}`;

        let height = '';
        let width = '';
        let imgStyle = '';
        if (output && output.metadata[mimeType] && typeof output.metadata[mimeType] === 'object') {
            // tslint:disable-next-line: no-any
            const imageMetadata = output.metadata[mimeType] as any;
            height = imageMetadata.height ? `height=${imageMetadata.height}` : '';
            width = imageMetadata.width ? `width=${imageMetadata.width}` : '';
            if (imageMetadata.unconfined === true) {
                imgStyle = `style="max-width:none"`;
            }
        }
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Fix priority of mimetypes.
        // delete data[mimeType];

        // Hack, use same classes as used in VSCode for images.
        // See src/vs/workbench/contrib/notebook/browser/view/output/transforms/richTransform.ts
        data[
            'text/html'
        ] = `<div class='display' style="overflow:scroll;${divStyle}"><img src="${imgSrc}" ${imgStyle} ${height} ${width}></div>`;
    }
    return {
        outputKind: CellOutputKind.Rich,
        data
    };
}

function shouldConvertImageToHtml(output: nbformat.IDisplayData) {
    return (
        typeof output.metadata.needs_background === 'string' ||
        output.metadata['image/png'] ||
        output.metadata['image/jpeg']
    );
}
export function isImageMimeType(mimeType: string) {
    return mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/svg+xml';
}
export function isImagePngOrJpegMimeType(mimeType: string) {
    return mimeType === 'image/png' || mimeType === 'image/jpeg';
}
export function translateStreamOutput(output: nbformat.IStream): CellStreamOutput {
    return {
        outputKind: CellOutputKind.Text,
        text: concatMultilineStringOutput(output.text)
    };
}
export function translateErrorOutput(output: nbformat.IError): CellErrorOutput {
    return {
        ename: output.ename,
        evalue: output.evalue,
        outputKind: CellOutputKind.Error,
        traceback: output.traceback
    };
}
