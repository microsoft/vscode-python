// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import * as uuid from 'uuid/v4';
import { Range, TextDocument } from 'vscode';

import { noop } from '../../test/core';
import { IDataScienceSettings } from '../common/types';
import { CellMatcher } from './cellMatcher';
import { appendLineFeed, generateMarkdownFromCodeLines, parseForComments } from './common';
import { CellState, ICell } from './types';

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

function generateCodeCell(code: string[], file: string, line: number, id: string, magicCommandsAsComments: boolean): ICell {
    // Code cells start out with just source and no outputs.
    return {
        data: {
            source: appendLineFeed(code, magicCommandsAsComments ? uncommentMagicCommands : undefined),
            cell_type: 'code',
            outputs: [],
            metadata: {},
            execution_count: 0
        },
        id: id,
        file: file,
        line: line,
        state: CellState.init
    };

}

function generateMarkdownCell(code: string[], file: string, line: number, id: string): ICell {
    return {
        id: id,
        file: file,
        line: line,
        state: CellState.finished,
        data: {
            cell_type: 'markdown',
            source: generateMarkdownFromCodeLines(code),
            metadata: {}
        }
    };

}

export function generateCells(settings: IDataScienceSettings | undefined, code: string, file: string, line: number, splitMarkdown: boolean, id: string): ICell[] {
    // Determine if we have a markdown cell/ markdown and code cell combined/ or just a code cell
    const split = code.splitLines({ trim: false });
    const firstLine = split[0];
    const matcher = new CellMatcher(settings);
    const { magicCommandsAsComments = false } = settings || {};
    if (matcher.isMarkdown(firstLine)) {
        // We have at least one markdown. We might have to split it if there any lines that don't begin
        // with # or are inside a multiline comment
        let firstNonMarkdown = -1;
        parseForComments(split, (_s, _i) => noop(), (s, i) => {
            // Make sure there's actually some code.
            if (s && s.length > 0 && firstNonMarkdown === -1) {
                firstNonMarkdown = splitMarkdown ? i : -1;
            }
        });
        if (firstNonMarkdown >= 0) {
            // Make sure if we split, the second cell has a new id. It's a new submission.
            return [
                generateMarkdownCell(split.slice(0, firstNonMarkdown), file, line, id),
                generateCodeCell(split.slice(firstNonMarkdown), file, line + firstNonMarkdown, uuid(), magicCommandsAsComments)
            ];
        } else {
            // Just a single markdown cell
            return [generateMarkdownCell(split, file, line, id)];
        }
    } else {
        // Just code
        return [generateCodeCell(split, file, line, id, magicCommandsAsComments)];
    }
}

export function hasCells(document: TextDocument, settings?: IDataScienceSettings): boolean {
    const matcher = new CellMatcher(settings);
    for (let index = 0; index < document.lineCount; index += 1) {
        const line = document.lineAt(index);
        if (matcher.isCell(line.text)) {
            return true;
        }
    }

    return false;
}

// CellRange is used as the basis for creating new ICells. We only use it in this file.
class CellRange {
    public range: Range;
    public title: string;
    public cell_type: string;

    constructor(r: Range, t: string, ct: string) {
        this.range = r;
        this.title = t;
        this.cell_type = ct;
    }
}

function generateCellRangesFromStringArray(lines: string[], settings?: IDataScienceSettings): CellRange[] {
    const matcher = new CellMatcher(settings);
    const cells: CellRange[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        if (matcher.isCell(lines[index])) {

            // We have a cell, find the next cell
            let endCellIndex = index + 1;
            while (endCellIndex < lines.length && !matcher.isCell(lines[endCellIndex])) {
                endCellIndex += 1;
            }
            endCellIndex -= 1; // Get last line of cell.

            const result = matcher.exec(lines[index]);
            if (result !== undefined) {
                cells.push(new CellRange(
                    new Range(index, 0, endCellIndex, lines[endCellIndex].length),
                    result,
                    matcher.getCellType(lines[index])
                )
                );
            }
            index = endCellIndex;
        }
    }

    return cells;
}

export function generateCellsFromString(source: string, settings?: IDataScienceSettings): ICell[] {
    const lines: string[] = source.splitLines({ trim: false, removeEmptyEntries: false });

    // Get our ranges. They'll determine our cells
    const ranges = generateCellRangesFromStringArray(lines, settings);

    // For each one, get its text and turn it into a cell
    return Array.prototype.concat(...ranges.map(cr => {
        const code = lines.slice(cr.range.start.line, cr.range.end.line).join('\n');
        return generateCells(settings, code, '', cr.range.start.line, false, uuid());
    }));
}

export function generateCellRangesFromDocument(document: TextDocument, settings?: IDataScienceSettings): CellRange[] {
    if (!document.getText()) {
        return [];
    } else {
        const lines: string[] = document.getText().splitLines({ trim: false, removeEmptyEntries: false });
        return generateCellRangesFromStringArray(lines, settings);
    }

}

export function generateCellsFromDocument(document: TextDocument, settings?: IDataScienceSettings): ICell[] {
    return generateCellsFromString(document.getText(), settings);
}
