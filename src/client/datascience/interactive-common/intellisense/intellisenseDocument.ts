// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { EndOfLine, Position, Range, TextDocument, TextDocumentContentChangeEvent, TextLine, Uri } from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

import { PYTHON_LANGUAGE } from '../../../common/constants';
import { Identifiers } from '../../constants';
import { IEditorContentChange } from '../interactiveWindowTypes';
import { DefaultWordPattern, ensureValidWordDefinition, getWordAtText, regExpLeadsToEndlessLoop } from './wordHelper';

class IntellisenseLine implements TextLine {
    private _range: Range;
    private _rangeWithLineBreak: Range;
    private _firstNonWhitespaceIndex: number | undefined;
    private _isEmpty: boolean | undefined;

    constructor(private _contents: string, private _line: number, private _offset: number) {
        this._range = new Range(new Position(_line, 0), new Position(_line, _contents.length));
        this._rangeWithLineBreak = new Range(this.range.start, new Position(_line, _contents.length + 1));
    }

    public get offset(): number {
        return this._offset;
    }
    public get lineNumber(): number {
        return this._line;
    }
    public get text(): string {
        return this._contents;
    }
    public get range(): Range {
        return this._range;
    }
    public get rangeIncludingLineBreak(): Range {
        return this._rangeWithLineBreak;
    }
    public get firstNonWhitespaceCharacterIndex(): number {
        if (this._firstNonWhitespaceIndex === undefined) {
            this._firstNonWhitespaceIndex = this._contents.trimLeft().length - this._contents.length;
        }
        return this._firstNonWhitespaceIndex;
    }
    public get isEmptyOrWhitespace(): boolean {
        if (this._isEmpty === undefined) {
            this._isEmpty = this._contents.length === 0 || this._contents.trim().length === 0;
        }
        return this._isEmpty;
    }
}

interface ICellRange {
    id: string;
    start: number;
    fullEnd: number;
    currentEnd: number;
}

export interface ICellData {
    text: string;
    offset: number;
}

export class IntellisenseDocument implements TextDocument {
    private _uri: Uri;
    private _version: number = 1;
    private _lines: IntellisenseLine[] = [];
    private _contents: string = '';
    private _cellRanges: ICellRange[] = [];
    private inEditMode: boolean = false;

    constructor(fileName: string) {
        // The file passed in is the base Uri for where we're basing this
        // document.
        //
        // What about liveshare?
        this._uri = Uri.file(fileName);

        // We should start our edit offset at 0. Each cell should end with a '/n'
        this._cellRanges.push({ id: Identifiers.EditCellId, start: 0, fullEnd: 0, currentEnd: 0 });
    }

    public get uri(): Uri {
        return this._uri;
    }
    public get fileName(): string {
        return this._uri.fsPath;
    }

    public get isUntitled(): boolean {
        return true;
    }

    public get isReadOnly(): boolean {
        return !this.inEditMode;
    }
    public get languageId(): string {
        return PYTHON_LANGUAGE;
    }
    public get version(): number {
        return this._version;
    }
    public get isDirty(): boolean {
        return true;
    }
    public get isClosed(): boolean {
        return false;
    }
    public save(): Thenable<boolean> {
        return Promise.resolve(true);
    }
    public get eol(): EndOfLine {
        return EndOfLine.LF;
    }
    public get lineCount(): number {
        return this._lines.length;
    }

    public lineAt(position: Position | number): TextLine {
        if (typeof position === 'number') {
            return this._lines[position as number];
        } else {
            return this._lines[position.line];
        }
    }
    public offsetAt(position: Position): number {
        return this.convertToOffset(position);
    }
    public positionAt(offset: number): Position {
        let line = 0;
        let ch = 0;
        while (line + 1 < this._lines.length && this._lines[line + 1].offset <= offset) {
            line += 1;
        }
        if (line < this._lines.length) {
            ch = offset - this._lines[line].offset;
        }
        return new Position(line, ch);
    }
    public getText(range?: Range | undefined): string {
        if (!range) {
            return this._contents;
        } else {
            const startOffset = this.convertToOffset(range.start);
            const endOffset = this.convertToOffset(range.end);
            return this._contents.substr(startOffset, endOffset - startOffset);
        }
    }

    public getFullContentChanges(): TextDocumentContentChangeEvent[] {
        return [
            {
                range: this.createSerializableRange(new Position(0, 0), new Position(0, 0)),
                rangeOffset: 0,
                rangeLength: 0, // Adds are always zero
                text: this._contents
            }
        ];
    }

    public getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined): Range | undefined {
        if (!regexp) {
            // use default when custom-regexp isn't provided
            regexp = DefaultWordPattern;
        } else if (regExpLeadsToEndlessLoop(regexp)) {
            // use default when custom-regexp is bad
            console.warn(
                `[getWordRangeAtPosition]: ignoring custom regexp '${regexp.source}' because it matches the empty string.`
            );
            regexp = DefaultWordPattern;
        }

        const wordAtText = getWordAtText(
            position.character + 1,
            ensureValidWordDefinition(regexp),
            this._lines[position.line].text,
            0
        );

        if (wordAtText) {
            return new Range(position.line, wordAtText.startColumn - 1, position.line, wordAtText.endColumn - 1);
        }
        return undefined;
    }
    public validateRange(range: Range): Range {
        return range;
    }
    public validatePosition(position: Position): Position {
        return position;
    }

    public get textDocumentItem(): vscodeLanguageClient.TextDocumentItem {
        return {
            uri: this._uri.toString(),
            languageId: this.languageId,
            version: this.version,
            text: this.getText()
        };
    }

    public get textDocumentId(): vscodeLanguageClient.VersionedTextDocumentIdentifier {
        return {
            uri: this._uri.toString(),
            version: this.version
        };
    }

    public loadAllCells(
        cells: { code: string; id: string }[],
        notebookType: 'interactive' | 'native'
    ): TextDocumentContentChangeEvent[] {
        if (!this.inEditMode && notebookType === 'native') {
            this.inEditMode = true;
            return this.reloadCells(cells);
        }
        return [];
    }

    public reloadCells(cells: { code: string; id: string }[]): TextDocumentContentChangeEvent[] {
        this._version += 1;

        // Normalize all of the cells, removing \r and separating each
        // with a newline
        const normalized = cells.map((c) => {
            return {
                id: c.id,
                code: `${c.code.replace(/\r/g, '')}\n`
            };
        });

        // Contents are easy, just load all of the code in a row
        this._contents =
            normalized && normalized.length
                ? normalized
                      .map((c) => c.code)
                      .reduce((p, c) => {
                          return `${p}${c}`;
                      })
                : '';

        // Cell ranges are slightly more complicated
        let prev: number = 0;
        this._cellRanges = normalized.map((c) => {
            const result = {
                id: c.id,
                start: prev,
                fullEnd: prev + c.code.length,
                currentEnd: prev + c.code.length
            };
            prev += c.code.length;
            return result;
        });

        // Then create the lines.
        this._lines = this.createLines();

        // Return our changes
        return [
            {
                range: this.createSerializableRange(new Position(0, 0), new Position(0, 0)),
                rangeOffset: 0,
                rangeLength: 0, // Adds are always zero
                text: this._contents
            }
        ];
    }

    public addCell(fullCode: string, currentCode: string, id: string): TextDocumentContentChangeEvent[] {
        // This should only happen once for each cell.
        this._version += 1;

        // Get rid of windows line endings. We're normalizing on linux
        const normalized = fullCode.replace(/\r/g, '');
        const normalizedCurrent = currentCode.replace(/\r/g, '');

        // This item should go just before the edit cell

        // Make sure to put a newline between this code and the next code
        const newCode = `${normalized}\n`;
        const newCurrentCode = `${normalizedCurrent}\n`;

        // We should start just before the last cell.
        const fromOffset = this.getEditCellOffset();

        // Split our text between the edit text and the cells above
        const before = this._contents.substr(0, fromOffset);
        const after = this._contents.substr(fromOffset);
        const fromPosition = this.positionAt(fromOffset);

        // Save the range for this cell ()
        this._cellRanges.splice(this._cellRanges.length - 1, 0, {
            id,
            start: fromOffset,
            fullEnd: fromOffset + newCode.length,
            currentEnd: fromOffset + newCurrentCode.length
        });

        // Update our entire contents and recompute our lines
        this._contents = `${before}${newCode}${after}`;
        this._lines = this.createLines();
        this._cellRanges[this._cellRanges.length - 1].start += newCode.length;
        this._cellRanges[this._cellRanges.length - 1].fullEnd += newCode.length;
        this._cellRanges[this._cellRanges.length - 1].currentEnd += newCode.length;

        return [
            {
                range: this.createSerializableRange(fromPosition, fromPosition),
                rangeOffset: fromOffset,
                rangeLength: 0, // Adds are always zero
                text: newCode
            }
        ];
    }

    public reloadCell(id: string, code: string): TextDocumentContentChangeEvent[] {
        this._version += 1;

        // Make sure to put a newline between this code and the next code
        const newCode = `${code.replace(/\r/g, '')}\n`;

        // Figure where this goes
        const index = this._cellRanges.findIndex((r) => r.id === id);
        if (index >= 0) {
            const start = this.positionAt(this._cellRanges[index].start);
            const end = this.positionAt(this._cellRanges[index].currentEnd);
            return this.removeRange(newCode, start, end, index);
        }

        return [];
    }

    public insertCell(
        id: string,
        code: string,
        codeCellAboveOrIndex: string | undefined | number
    ): TextDocumentContentChangeEvent[] {
        // This should only happen once for each cell.
        this._version += 1;

        // Make sure to put a newline between this code and the next code
        const newCode = `${code.replace(/\r/g, '')}\n`;

        // Figure where this goes
        const aboveIndex = this._cellRanges.findIndex((r) => r.id === codeCellAboveOrIndex);
        const insertIndex = typeof codeCellAboveOrIndex === 'number' ? codeCellAboveOrIndex : aboveIndex + 1;

        // Compute where we start from.
        const fromOffset =
            insertIndex < this._cellRanges.length ? this._cellRanges[insertIndex].start : this._contents.length;

        // Split our text between the text and the cells above
        const before = this._contents.substr(0, fromOffset);
        const after = this._contents.substr(fromOffset);
        const fromPosition = this.positionAt(fromOffset);

        // Update our entire contents and recompute our lines
        this._contents = `${before}${newCode}${after}`;
        this._lines = this.createLines();

        // Move all the other cell ranges down
        for (let i = insertIndex; i <= this._cellRanges.length - 1; i += 1) {
            this._cellRanges[i].start += newCode.length;
            this._cellRanges[i].fullEnd += newCode.length;
            this._cellRanges[i].currentEnd += newCode.length;
        }
        this._cellRanges.splice(insertIndex, 0, {
            id,
            start: fromOffset,
            fullEnd: fromOffset + newCode.length,
            currentEnd: fromOffset + newCode.length
        });

        return [
            {
                range: this.createSerializableRange(fromPosition, fromPosition),
                rangeOffset: fromOffset,
                rangeLength: 0, // Adds are always zero
                text: newCode
            }
        ];
    }

    public removeAllCells(): TextDocumentContentChangeEvent[] {
        // Remove everything
        if (this.inEditMode) {
            this._version += 1;

            // Compute the offset for the edit cell
            const toOffset = this._cellRanges.length > 0 ? this._cellRanges[this._cellRanges.length - 1].fullEnd : 0;
            const from = this.positionAt(0);
            const to = this.positionAt(toOffset);

            // Remove the entire range.
            const result = this.removeRange('', from, to, 0);

            // Update our cell range
            this._cellRanges = [];

            return result;
        }

        return [];
    }

    public editCell(editorChanges: IEditorContentChange[], id: string): TextDocumentContentChangeEvent[] {
        this._version += 1;

        // Convert the range to local (and remove 1 based)
        if (editorChanges && editorChanges.length) {
            const normalized = editorChanges[0].text.replace(/\r/g, '');

            // Figure out which cell we're editing.
            const cellIndex = this._cellRanges.findIndex((c) => c.id === id);
            if (cellIndex >= 0 && (id === Identifiers.EditCellId || this.inEditMode)) {
                // This is an actual edit.
                // Line/column are within this cell. Use its offset to compute the real position
                const editPos = this.positionAt(this._cellRanges[cellIndex].start);
                const from = new Position(
                    editPos.line + editorChanges[0].range.startLineNumber - 1,
                    editorChanges[0].range.startColumn - 1
                );
                const to = new Position(
                    editPos.line + editorChanges[0].range.endLineNumber - 1,
                    editorChanges[0].range.endColumn - 1
                );

                // Remove this range from the contents and return the change.
                return this.removeRange(normalized, from, to, cellIndex);
            } else if (cellIndex >= 0) {
                // This is an edit of a read only cell. Just replace our currentEnd position
                const newCode = `${normalized}\n`;
                this._cellRanges[cellIndex].currentEnd = this._cellRanges[cellIndex].start + newCode.length;
            }
        }

        return [];
    }

    public remove(id: string): TextDocumentContentChangeEvent[] {
        let change: TextDocumentContentChangeEvent[] = [];

        const index = this._cellRanges.findIndex((c) => c.id === id);
        // Ignore unless in edit mode. For non edit mode, cells are still there.
        if (index >= 0 && this.inEditMode) {
            this._version += 1;

            const found = this._cellRanges[index];
            const foundLength = found.currentEnd - found.start;
            const from = new Position(this.getLineFromOffset(found.start), 0);
            const to = this.positionAt(found.currentEnd);

            // Remove from the cell ranges.
            for (let i = index + 1; i <= this._cellRanges.length - 1; i += 1) {
                this._cellRanges[i].start -= foundLength;
                this._cellRanges[i].fullEnd -= foundLength;
                this._cellRanges[i].currentEnd -= foundLength;
            }
            this._cellRanges.splice(index, 1);

            // Recreate the contents
            const before = this._contents.substr(0, found.start);
            const after = this._contents.substr(found.currentEnd);
            this._contents = `${before}${after}`;
            this._lines = this.createLines();

            change = [
                {
                    range: this.createSerializableRange(from, to),
                    rangeOffset: found.start,
                    rangeLength: foundLength,
                    text: ''
                }
            ];
        }

        return change;
    }

    public swap(first: string, second: string): TextDocumentContentChangeEvent[] {
        let change: TextDocumentContentChangeEvent[] = [];

        const firstIndex = this._cellRanges.findIndex((c) => c.id === first);
        const secondIndex = this._cellRanges.findIndex((c) => c.id === second);
        if (firstIndex >= 0 && secondIndex >= 0 && firstIndex !== secondIndex && this.inEditMode) {
            this._version += 1;

            const topIndex = firstIndex < secondIndex ? firstIndex : secondIndex;
            const bottomIndex = firstIndex > secondIndex ? firstIndex : secondIndex;
            const top = { ...this._cellRanges[topIndex] };
            const bottom = { ...this._cellRanges[bottomIndex] };

            const from = new Position(this.getLineFromOffset(top.start), 0);
            const to = this.positionAt(bottom.currentEnd);

            // Swap everything
            this._cellRanges[topIndex].id = bottom.id;
            this._cellRanges[topIndex].fullEnd = top.start + (bottom.fullEnd - bottom.start);
            this._cellRanges[topIndex].currentEnd = top.start + (bottom.currentEnd - bottom.start);
            this._cellRanges[bottomIndex].id = top.id;
            this._cellRanges[bottomIndex].start = this._cellRanges[topIndex].fullEnd;
            this._cellRanges[bottomIndex].fullEnd = this._cellRanges[topIndex].fullEnd + (top.fullEnd - top.start);
            this._cellRanges[bottomIndex].currentEnd =
                this._cellRanges[topIndex].fullEnd + (top.currentEnd - top.start);

            const fromOffset = this.convertToOffset(from);
            const toOffset = this.convertToOffset(to);

            // Recreate our contents, and then recompute all of our lines
            const before = this._contents.substr(0, fromOffset);
            const topText = this._contents.substr(top.start, top.fullEnd - top.start);
            const bottomText = this._contents.substr(bottom.start, bottom.fullEnd - bottom.start);
            const after = this._contents.substr(toOffset);
            const replacement = `${bottomText}${topText}`;
            this._contents = `${before}${replacement}${after}`;
            this._lines = this.createLines();

            // Change is a full replacement
            change = [
                {
                    range: this.createSerializableRange(from, to),
                    rangeOffset: fromOffset,
                    rangeLength: toOffset - fromOffset,
                    text: replacement
                }
            ];
        }

        return change;
    }

    public removeAll(): TextDocumentContentChangeEvent[] {
        let change: TextDocumentContentChangeEvent[] = [];
        // Ignore unless in edit mode.
        if (this._lines.length > 0 && this.inEditMode) {
            this._version += 1;

            const from = this._lines[0].range.start;
            const to = this._lines[this._lines.length - 1].rangeIncludingLineBreak.end;
            const length = this._contents.length;
            this._cellRanges = [];
            this._contents = '';
            this._lines = [];

            change = [
                {
                    range: this.createSerializableRange(from, to),
                    rangeOffset: 0,
                    rangeLength: length,
                    text: ''
                }
            ];
        }

        return change;
    }

    public convertToDocumentPosition(id: string, line: number, ch: number): Position {
        // Monaco is 1 based, and we need to add in our cell offset.
        const cellIndex = this._cellRanges.findIndex((c) => c.id === id);
        if (cellIndex >= 0) {
            // Line/column are within this cell. Use its offset to compute the real position
            const editLine = this.positionAt(this._cellRanges[cellIndex].start);
            const docLine = line - 1 + editLine.line;
            const docCh = ch - 1;
            return new Position(docLine, docCh);
        }

        // We can't find a cell that matches. Just remove the 1 based
        return new Position(line - 1, ch - 1);
    }

    public getCellData(cellId: string) {
        const range = this._cellRanges.find((cellRange) => cellRange.id === cellId);
        if (range) {
            return {
                offset: range.start,
                text: this._contents.substring(range.start, range.currentEnd)
            };
        }
    }

    public getEditCellContent() {
        return this._contents.substr(this.getEditCellOffset());
    }

    public getEditCellOffset(cellId?: string) {
        // in native editor
        if (this.inEditMode && cellId) {
            const cell = this._cellRanges.find((c) => c.id === cellId);

            if (cell) {
                return cell.start;
            }
        }

        // in interactive window
        return this._cellRanges && this._cellRanges.length > 0
            ? this._cellRanges[this._cellRanges.length - 1].start
            : 0;
    }

    private getLineFromOffset(offset: number) {
        let lineCounter = 0;

        for (let i = 0; i < offset; i += 1) {
            if (this._contents[i] === '\n') {
                lineCounter += 1;
            }
        }

        return lineCounter;
    }

    private removeRange(
        newText: string,
        from: Position,
        to: Position,
        cellIndex: number
    ): TextDocumentContentChangeEvent[] {
        const fromOffset = this.convertToOffset(from);
        const toOffset = this.convertToOffset(to);

        // Recreate our contents, and then recompute all of our lines
        const before = this._contents.substr(0, fromOffset);
        const after = this._contents.substr(toOffset);
        this._contents = `${before}${newText}${after}`;
        this._lines = this.createLines();

        // Update ranges after this. All should move by the diff in length, although the current one
        // should stay at the same start point.
        const lengthDiff = newText.length - (toOffset - fromOffset);
        for (let i = cellIndex; i < this._cellRanges.length; i += 1) {
            if (i !== cellIndex) {
                this._cellRanges[i].start += lengthDiff;
            }
            this._cellRanges[i].fullEnd += lengthDiff;
            this._cellRanges[i].currentEnd += lengthDiff;
        }

        return [
            {
                range: this.createSerializableRange(from, to),
                rangeOffset: fromOffset,
                rangeLength: toOffset - fromOffset,
                text: newText
            }
        ];
    }

    private createLines(): IntellisenseLine[] {
        const split = this._contents.splitLines({ trim: false, removeEmptyEntries: false });
        let prevLine: IntellisenseLine | undefined;
        return split.map((s, i) => {
            const nextLine = this.createTextLine(s, i, prevLine);
            prevLine = nextLine;
            return nextLine;
        });
    }

    private createTextLine(line: string, index: number, prevLine: IntellisenseLine | undefined): IntellisenseLine {
        return new IntellisenseLine(
            line,
            index,
            prevLine ? prevLine.offset + prevLine.rangeIncludingLineBreak.end.character : 0
        );
    }

    private convertToOffset(pos: Position): number {
        if (pos.line < this._lines.length) {
            return this._lines[pos.line].offset + pos.character;
        }
        return this._contents.length;
    }

    private createSerializableRange(start: Position, end: Position): Range {
        // This funciton is necessary so that the Range can be passed back
        // over a remote connection without including all of the extra fields that
        // VS code puts into a Range object.
        const result = {
            start: {
                line: start.line,
                character: start.character
            },
            end: {
                line: end.line,
                character: end.character
            }
        };
        return result as Range;
    }
}
