// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
// tslint:disable-next-line: no-require-imports no-var-requires
const cloneDeep = require('lodash/cloneDeep');
import '../../client/common/extensions';
import { appendLineFeed, generateMarkdownFromCodeLines } from './index';

function uncommentMagicCommands(line: string): string {
    // Uncomment lines that are shell assignments (starting with #!),
    // line magic (starting with #!%) or cell magic (starting with #!%%).
    if (/^#\s*!/.test(line)) {
        // If the regex test passes, it's either line or cell magic.
        // Hence, remove the leading # and ! including possible white space.
        if (/^#\s*!\s*%%?/.test(line)) {
            return line.replace(/^#\s*!\s*/, '');
        }
        // If the test didn't pass, it's a shell assignment. In this case, only
        // remove leading # including possible white space.
        return line.replace(/^#\s*/, '');
    } else {
        // If it's regular Python code, just return it.
        return line;
    }
}

export function createMarkdownCell(code: string | string[]): nbformat.IMarkdownCell {
    code = Array.isArray(code) ? code : [code];
    return {
        cell_type: 'markdown',
        metadata: {},
        source: generateMarkdownFromCodeLines(code)
    };
}

export function createErrorOutput(error: Partial<Error>): nbformat.IError {
    return {
        output_type: 'error',
        ename: error.name || error.message || 'Error',
        evalue: error.message || error.name || 'Error',
        traceback: (error.stack || '').splitLines()
    };
}
export function createCodeCell(): nbformat.ICodeCell;
// tslint:disable-next-line: unified-signatures
export function createCodeCell(code: string): nbformat.ICodeCell;
export function createCodeCell(code: string[], outputs: nbformat.IOutput[]): nbformat.ICodeCell;
// tslint:disable-next-line: unified-signatures
export function createCodeCell(code: string[], magicCommandsAsComments: boolean): nbformat.ICodeCell;
export function createCodeCell(code?: string | string[], options?: boolean | nbformat.IOutput[]): nbformat.ICodeCell {
    const magicCommandsAsComments = typeof options === 'boolean' ? options : false;
    const outputs = typeof options === 'boolean' ? [] : options || [];
    code = code || '';
    // If we get a string, then no need to append line feeds. Leave as is (to preserve existing functionality).
    // If we get an array, the append a linefeed.
    const source = Array.isArray(code)
        ? appendLineFeed(code, magicCommandsAsComments ? uncommentMagicCommands : undefined)
        : code;
    return {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs,
        source
    };
}
/**
 * Clones a cell.
 * Also dumps unrecognized attributes from cells.
 *
 * @export
 * @template T
 * @param {T} cell
 * @returns {T}
 */
export function cloneCell<T extends nbformat.IBaseCell>(cell: T): T {
    // Construct the cell by hand so we drop unwanted/unrecognized properties from cells.
    // This way, the cell contains only the attributes that are valid (supported type).
    const clonedCell = cloneDeep(cell);
    const source = Array.isArray(clonedCell.source) || typeof clonedCell.source === 'string' ? clonedCell.source : '';
    switch (cell.cell_type) {
        case 'code': {
            const codeCell: nbformat.ICodeCell = {
                cell_type: 'code',
                // tslint:disable-next-line: no-any
                metadata: (clonedCell.metadata ?? {}) as any,
                execution_count: typeof clonedCell.execution_count === 'number' ? clonedCell.execution_count : null,
                outputs: Array.isArray(clonedCell.outputs) ? (clonedCell.outputs as nbformat.IOutput[]) : [],
                source
            };
            // tslint:disable-next-line: no-any
            return (codeCell as any) as T;
        }
        case 'markdown': {
            const markdownCell: nbformat.IMarkdownCell = {
                cell_type: 'markdown',
                // tslint:disable-next-line: no-any
                metadata: (clonedCell.metadata ?? {}) as any,
                source,
                // tslint:disable-next-line: no-any
                attachments: clonedCell.attachments as any
            };
            // tslint:disable-next-line: no-any
            return (markdownCell as any) as T;
        }
        case 'raw': {
            const rawCell: nbformat.IRawCell = {
                cell_type: 'raw',
                // tslint:disable-next-line: no-any
                metadata: (clonedCell.metadata ?? {}) as any,
                source,
                // tslint:disable-next-line: no-any
                attachments: clonedCell.attachments as any
            };
            // tslint:disable-next-line: no-any
            return (rawCell as any) as T;
        }
        default: {
            // Possibly one of our cell types (`message`).
            return clonedCell;
        }
    }
}

export function createCellFrom(
    source: nbformat.IBaseCell,
    target: nbformat.CellType
): nbformat.ICodeCell | nbformat.IMarkdownCell | nbformat.IRawCell {
    // If we're creating a new cell from the same base type, then ensure we preserve the metadata.
    const baseCell: nbformat.IBaseCell =
        source.cell_type === target
            ? // tslint:disable-next-line: no-any
              (cloneCell(source) as any)
            : {
                  source: source.source,
                  cell_type: target,
                  // tslint:disable-next-line: no-any
                  metadata: cloneDeep(source.metadata) as any
              };

    switch (target) {
        case 'code': {
            // tslint:disable-next-line: no-unnecessary-local-variable no-any
            const codeCell = (baseCell as any) as nbformat.ICodeCell;
            codeCell.execution_count = null;
            codeCell.outputs = [];
            return codeCell;
        }
        case 'markdown': {
            return baseCell as nbformat.IMarkdownCell;
        }
        case 'raw': {
            return baseCell as nbformat.IRawCell;
        }
        default: {
            throw new Error(`Unsupported target type, ${target}`);
        }
    }
}
