// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import * as uuid from 'uuid/v4';
import { Range, TextDocument } from 'vscode';

import { RegExpValues } from './constants';
import { CellState, ICell } from './types';

function appendLineFeed(arr : string[], modifier? : (s : string) => string) {
    return arr.map((s: string, i: number) => {
        const out = modifier ? modifier(s) : s;
        return i === arr.length - 1 ? `${out}` : `${out}\n`;
    });
}

function generateCodeCell(code: string[], file: string, line: number) : ICell {
    // Code cells start out with just source and no outputs.
    return {
        data: {
            source: appendLineFeed(code),
            cell_type: 'code',
            outputs: [],
            metadata: {},
            execution_count: 0
        },
        id: uuid(),
        file: file,
        line: line,
        state: CellState.init
    };

}

function generateMarkdownCell(code: string[], file: string, line: number) : ICell {
    // Generate markdown by stripping out the comment and markdown header
    const markdown = appendLineFeed(code.slice(1).filter(s => s.includes('#')), s => s.trim().slice(1).trim());

    return {
        id: uuid(),
        file: file,
        line: line,
        state: CellState.finished,
        data: {
            cell_type: 'markdown',
            source: markdown,
            metadata: {}
        }
    };

}

export function generateCells(code: string, file: string, line: number, splitMarkdown?: boolean) : ICell[] {
    // Determine if we have a markdown cell/ markdown and code cell combined/ or just a code cell
    const split = code.splitLines();
    const firstLine = split[0];
    if (RegExpValues.PythonMarkdownCellMarker.test(firstLine)) {
        // We have at least one markdown. We might have to split it if there any lines that don't begin
        // with #
        const firstNonMarkdown = splitMarkdown ? split.findIndex((l: string) => l.trim().length > 0 && !l.trim().startsWith('#')) : -1;
        if (firstNonMarkdown >= 0) {
            return [
                generateMarkdownCell(split.slice(0, firstNonMarkdown), file, line),
                generateCodeCell(split.slice(firstNonMarkdown), file, line + firstNonMarkdown)
            ];
        } else {
            // Just a single markdown cell
            return [generateMarkdownCell(split, file, line)];
        }
    } else {
        // Just code
        return [generateCodeCell(split, file, line)];
    }
}

export function hasCells(document: TextDocument) : boolean {
    const cellIdentifier: RegExp = RegExpValues.PythonCellMarker;
    for (let index = 0; index < document.lineCount; index += 1) {
        const line = document.lineAt(index);
        // clear regex cache
        if (cellIdentifier.test(line.text)) {
            return true;
        }
    }

    return false;
}

export function generateCellRanges(document: TextDocument) : {range: Range; title: string}[] {
    // Implmentation of getCells here based on Don's Jupyter extension work
    const cellIdentifier: RegExp = RegExpValues.PythonCellMarker;
    const cells : {range: Range; title: string}[] = [];
    for (let index = 0; index < document.lineCount; index += 1) {
        const line = document.lineAt(index);
        // clear regex cache
        cellIdentifier.lastIndex = -1;
        if (cellIdentifier.test(line.text)) {
            const results = cellIdentifier.exec(line.text);
            if (cells.length > 0) {
                const previousCell = cells[cells.length - 1];
                previousCell.range = new Range(previousCell.range.start, document.lineAt(index - 1).range.end);
            }

            if (results !== null) {
                cells.push({
                    range: line.range,
                    title: results.length > 1 ? results[2].trim() : ''
                });
            }
        }
    }

    if (cells.length >= 1) {
        const line = document.lineAt(document.lineCount - 1);
        const previousCell = cells[cells.length - 1];
        previousCell.range = new Range(previousCell.range.start, line.range.end);
    }

    return cells;
}

export function generateCellsFromDocument(document: TextDocument) : ICell[] {
    // Get our ranges. They'll determine our cells
    const ranges = generateCellRanges(document);

    // For each one, get its text and turn it into a cell
    return Array.prototype.concat(...ranges.map(r => {
        const code = document.getText(r.range);
        return generateCells(code, document.fileName, r.range.start.line);
    }));
}
