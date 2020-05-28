// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
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
import { concatMultilineStringInput, concatMultilineStringOutput } from '../../../datascience-ui/common';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../common/constants';
import { traceError, traceWarning } from '../../logging';
import { ICell, INotebookModel } from '../types';
// tslint:disable-next-line: no-var-requires no-require-imports
const ansiToHtml = require('ansi-to-html');
// tslint:disable-next-line: no-var-requires no-require-imports
const ansiRegex = require('ansi-regex');

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
            hasExecutionOrder: true,
            runnable: true,
            displayOrder: [
                'application/vnd.*',
                'application/vdom.*',
                'application/geo+json',
                'application/x-nteract-model-debug+json',
                'text/html',
                'application/javascript',
                'text/latex',
                'text/markdown',
                'application/json',
                'image/svg+xml',
                'image/png',
                'image/jpeg',
                'text/plain'
            ]
        }
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
    const text = concatMultilineStringOutput(output.text);
    const hasAngleBrackets = text.includes('<');
    const hasAnsiChars = ansiRegex().test(text);

    if (!hasAngleBrackets && !hasAnsiChars) {
        // Plain text output.
        return {
            outputKind: vscodeNotebookEnums.CellOutputKind.Text,
            text
        };
    }

    // Format the output, but ensure we have the plain text output as well.
    const richOutput: CellDisplayOutput = {
        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
        data: {
            ['text/plain']: text
        }
    };

    if (hasAngleBrackets) {
        // Stream output needs to be wrapped in xmp so it
        // show literally. Otherwise < chars start a new html element.
        richOutput.data['text/html'] = `<xmp>${text}</xmp>`;
    }
    if (hasAnsiChars) {
        // ansiToHtml is different between the tests running and webpack. figure out which one
        try {
            const ctor = ansiToHtml instanceof Function ? ansiToHtml : ansiToHtml.default;
            const converter = new ctor(getAnsiToHtmlOptions());
            richOutput.data['text/html'] = converter.toHtml(text);
        } catch (ex) {
            traceError(`Failed to convert Ansi text to HTML, ${text}`, ex);
        }
    }

    return richOutput;
}
export function translateErrorOutput(output: nbformat.IError): CellErrorOutput {
    return {
        ename: output.ename,
        evalue: output.evalue,
        outputKind: vscodeNotebookEnums.CellOutputKind.Error,
        traceback: output.traceback
    };
}

function getAnsiToHtmlOptions(): { fg: string; bg: string; colors: string[] } {
    // Here's the default colors for ansiToHtml. We need to use the
    // colors from our current theme.
    // const colors = {
    //     0: '#000',
    //     1: '#A00',
    //     2: '#0A0',
    //     3: '#A50',
    //     4: '#00A',
    //     5: '#A0A',
    //     6: '#0AA',
    //     7: '#AAA',
    //     8: '#555',
    //     9: '#F55',
    //     10: '#5F5',
    //     11: '#FF5',
    //     12: '#55F',
    //     13: '#F5F',
    //     14: '#5FF',
    //     15: '#FFF'
    // };
    return {
        fg: 'var(--vscode-terminal-foreground)',
        bg: 'var(--vscode-terminal-background)',
        colors: [
            'var(--vscode-terminal-ansiBlack)', // 0
            'var(--vscode-terminal-ansiBrightRed)', // 1
            'var(--vscode-terminal-ansiGreen)', // 2
            'var(--vscode-terminal-ansiYellow)', // 3
            'var(--vscode-terminal-ansiBrightBlue)', // 4
            'var(--vscode-terminal-ansiMagenta)', // 5
            'var(--vscode-terminal-ansiCyan)', // 6
            'var(--vscode-terminal-ansiBrightBlack)', // 7
            'var(--vscode-terminal-ansiWhite)', // 8
            'var(--vscode-terminal-ansiRed)', // 9
            'var(--vscode-terminal-ansiBrightGreen)', // 10
            'var(--vscode-terminal-ansiBrightYellow)', // 11
            'var(--vscode-terminal-ansiBlue)', // 12
            'var(--vscode-terminal-ansiBrightMagenta)', // 13
            'var(--vscode-terminal-ansiBrightCyan)', // 14
            'var(--vscode-terminal-ansiBrightWhite)' // 15
        ]
    };
}
