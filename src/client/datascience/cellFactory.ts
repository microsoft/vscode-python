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
        state: CellState.init,
        type: 'execute'
    };

}

function generateMarkdownCell(code: string[], file: string, line: number, id: string): ICell {
    return {
        id: id,
        file: file,
        line: line,
        state: CellState.finished,
        type: 'execute',
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

export function generateCellRanges(document: TextDocument, settings?: IDataScienceSettings): { range: Range; title: string; cell_type: string }[] {
    // Implmentation of getCells here based on Don's Jupyter extension work
    const matcher = new CellMatcher(settings);
    const cells : { range: Range; title: string; cell_type: string }[] = [];
    for (let index = 0; index < document.lineCount; index += 1) {
        const line = document.lineAt(index);
        if (matcher.isCell(line.text)) {
            if (cells.length > 0) {
                const previousCell = cells[cells.length - 1];
                previousCell.range = new Range(previousCell.range.start, document.lineAt(index - 1).range.end);
            }

            const results = matcher.exec(line.text);
            if (results !== undefined) {
                cells.push({
                    range: line.range,
                    title: results,
                    cell_type: matcher.getCellType(line.text)
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

export function generateCellsFromDocument(document: TextDocument, settings?: IDataScienceSettings): ICell[] {
    // Get our ranges. They'll determine our cells
    const ranges = generateCellRanges(document, settings);

    // For each one, get its text and turn it into a cell
    return Array.prototype.concat(...ranges.map(r => {
        const code = document.getText(r.range);
        return generateCells(settings, code, document.fileName, r.range.start.line, false, uuid());
    }));
}
