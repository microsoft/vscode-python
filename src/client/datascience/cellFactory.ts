// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import * as uuid from 'uuid/v4';
import { Range, TextDocument, Uri } from 'vscode';

import { parseForComments } from '../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../datascience-ui/common/cellFactory';
import { IDataScienceSettings, Resource } from '../common/types';
import { noop } from '../common/utils/misc';
import { CellMatcher } from './cellMatcher';
import { Identifiers } from './constants';
import { CellState, ICell } from './types';

function generateCodeCell(
    code: string[],
    file: string,
    line: number,
    id: string,
    magicCommandsAsComments: boolean
): ICell {
    // Code cells start out with just source and no outputs.
    return {
        data: createCodeCell(code, magicCommandsAsComments),
        id: id,
        file: file,
        line: line,
        state: CellState.init,
    };
}

function generateMarkdownCell(code: string[], file: string, line: number, id: string): ICell {
    return {
        id: id,
        file: file,
        line: line,
        state: CellState.finished,
        data: createMarkdownCell(code),
    };
}

export function getCellResource(cell: ICell): Resource {
    if (cell.file !== Identifiers.EmptyFileName) {
        return Uri.file(cell.file);
    }
    return undefined;
}

export function generateCells(
    settings: IDataScienceSettings | undefined,
    code: string,
    file: string,
    line: number,
    splitMarkdown: boolean,
    id: string
): ICell[] {
    // Determine if we have a markdown cell/ markdown and code cell combined/ or just a code cell
    const split = code.splitLines({ trim: false });
    const firstLine = split[0];
    const matcher = new CellMatcher(settings);
    const { magicCommandsAsComments = false } = settings || {};
    if (matcher.isMarkdown(firstLine)) {
        // We have at least one markdown. We might have to split it if there any lines that don't begin
        // with # or are inside a multiline comment
        let firstNonMarkdown = -1;
        parseForComments(
            split,
            (_s, _i) => noop(),
            (s, i) => {
                // Make sure there's actually some code.
                if (s && s.length > 0 && firstNonMarkdown === -1) {
                    firstNonMarkdown = splitMarkdown ? i : -1;
                }
            }
        );
        if (firstNonMarkdown >= 0) {
            // Make sure if we split, the second cell has a new id. It's a new submission.
            return [
                generateMarkdownCell(split.slice(0, firstNonMarkdown), file, line, id),
                generateCodeCell(
                    split.slice(firstNonMarkdown),
                    file,
                    line + firstNonMarkdown,
                    uuid(),
                    magicCommandsAsComments
                ),
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
interface ICellRange {
    range: Range;
    title: string;
    cell_type: string;
}

export function generateCellsFromString(source: string, settings?: IDataScienceSettings): ICell[] {
    const lines: string[] = source.splitLines({ trim: false, removeEmptyEntries: false });

    // Find all the lines that start a cell
    const matcher = new CellMatcher(settings);
    const starts: { startLine: number; title: string; code: string; cell_type: string }[] = [];
    let currentCode: string | undefined;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (matcher.isCell(line)) {
            if (starts.length > 0 && currentCode) {
                const previousCell = starts[starts.length - 1];
                previousCell.code = currentCode;
            }
            const results = matcher.exec(line);
            if (results !== undefined) {
                starts.push({
                    startLine: index + 1,
                    title: results,
                    cell_type: matcher.getCellType(line),
                    code: '',
                });
            }
            currentCode = undefined;
        }
        currentCode = currentCode ? `${currentCode}\n${line}` : line;
    }

    if (starts.length >= 1 && currentCode) {
        const previousCell = starts[starts.length - 1];
        previousCell.code = currentCode;
    }

    // For each one, get its text and turn it into a cell
    return Array.prototype.concat(
        ...starts.map((s) => {
            return generateCells(settings, s.code, '', s.startLine, false, uuid());
        })
    );
}

export function generateCellRangesFromDocument(document: TextDocument, settings?: IDataScienceSettings): ICellRange[] {
    // Implmentation of getCells here based on Don's Jupyter extension work
    const matcher = new CellMatcher(settings);
    const cells: ICellRange[] = [];
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
                    cell_type: matcher.getCellType(line.text),
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
    const ranges = generateCellRangesFromDocument(document, settings);

    // For each one, get its text and turn it into a cell
    return Array.prototype.concat(
        ...ranges.map((cr) => {
            const code = document.getText(cr.range);
            return generateCells(settings, code, '', cr.range.start.line, false, uuid());
        })
    );
}
