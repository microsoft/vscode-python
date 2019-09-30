// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { EndOfLine, Position, Range, TextDocument, TextDocumentContentChangeEvent, TextLine, Uri } from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

import { PYTHON_LANGUAGE } from '../../../common/constants';
import { concatMultilineString } from '../../common';
import { Identifiers } from '../../constants';
import { ICell } from '../../types';
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
    private _version: number = 0;
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

    public switchToEditMode() {
        this.inEditMode = true;
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
    public getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined): Range | undefined {
        if (!regexp) {
            // use default when custom-regexp isn't provided
            regexp = DefaultWordPattern;

        } else if (regExpLeadsToEndlessLoop(regexp)) {
            // use default when custom-regexp is bad
            console.warn(`[getWordRangeAtPosition]: ignoring custom regexp '${regexp.source}' because it matches the empty string.`);
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

    public handleNativeEditorCellChanges(cells: ICell[]): TextDocumentContentChangeEvent[][] {
        const changes: TextDocumentContentChangeEvent[][] = [];

        if (this.inEditMode) {
            const incomingCells = cells.filter(c => c.data.cell_type === 'code');
            const currentCellCount = this._cellRanges.length - 1;

            if (currentCellCount < incomingCells.length) { // Cell was added
                incomingCells.forEach((cell, i) => {
                    if (!this.hasCell(cell.id)) {
                        const text = concatMultilineString(cell.data.source);

                        // addCell to the end of the document, or if adding in the middle,
                        // send the id of the next cell to get its offset in the document
                        if (i + 1 > incomingCells.length - 1) {
                            changes.push(this.addCell(text, text, cell.id));
                        } else {
                            changes.push(this.addCell(text, text, cell.id, incomingCells[i + 1].id));
                        }
                    }
                });
            } else if (currentCellCount > incomingCells.length) { // Cell was deleted
                const change = this.lookForCellToDelete(incomingCells);

                if (change.length > 0) {
                    changes.push(change);
                }
            } else { // Cell might have moved
                const change = this.lookForCellMovement(incomingCells);

                if (change.length > 0) {
                    changes.push(change);
                }
            }
        }

        return changes;
    }

    public addCell(fullCode: string, currentCode: string, id: string, cellId?: string): TextDocumentContentChangeEvent[] {
        // This should only happen once for each cell.
        this._version += 1;

        // Get rid of windows line endings. We're normalizing on linux
        const normalized = fullCode.replace(/\r/g, '');
        const normalizedCurrent = currentCode.replace(/\r/g, '');

        // This item should go just before the edit cell

        // Make sure to put a newline between this code and the next code
        const newCode = `${normalized}\n`;
        const newCurrentCode = `${normalizedCurrent}\n`;

        // We should start just before the last cell for the interactive window
        // But return the start of the next cell for the native editor,
        // in case we add a cell at the end in the native editor,
        // just don't send a cellId to get an offset at the end of the document
        const fromOffset = this.getEditCellOffset(cellId);

        // Split our text between the edit text and the cells above
        const before = this._contents.substr(0, fromOffset);
        const after = this._contents.substr(fromOffset);
        const fromPosition = this.positionAt(fromOffset);

        // for the interactive window or if the cell was added last,
        // add cell to the end
        let splicePosition = this._cellRanges.length - 1;

        // for the native editor, find the index to add the cell to
        if (cellId) {
            const index = this._cellRanges.findIndex(c => c.id === cellId);

            if (index > -1) {
                splicePosition = index;
            }
        }

        // Save the range for this cell ()
        this._cellRanges.splice(splicePosition, 0,
            { id, start: fromOffset, fullEnd: fromOffset + newCode.length, currentEnd: fromOffset + newCurrentCode.length });

        // Update our entire contents and recompute our lines
        this._contents = `${before}${newCode}${after}`;
        this._lines = this.createLines();

        if (cellId) {
            // With the native editor, we fix all the positions that changed after adding
            for (let i = splicePosition + 1; i < this._cellRanges.length; i += 1) {
                this._cellRanges[i].start += newCode.length;
                this._cellRanges[i].fullEnd += newCode.length;
                this._cellRanges[i].currentEnd += newCode.length;
            }
        } else {
            // with the interactive window, we just fix the positon of the last cell
            this._cellRanges[this._cellRanges.length - 1].start += newCode.length;
            this._cellRanges[this._cellRanges.length - 1].fullEnd += newCode.length;
            this._cellRanges[this._cellRanges.length - 1].currentEnd += newCode.length;
        }

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
        // Remove everything up to the edit cell
        if (this._cellRanges.length > 1) {
            this._version += 1;

            // Compute the offset for the edit cell
            const toOffset = this._cellRanges[this._cellRanges.length - 1].start;
            const from = this.positionAt(0);
            const to = this.positionAt(toOffset);

            // Remove the entire range.
            const result = this.removeRange('', from, to, 0);

            // Update our cell range
            this._cellRanges = [{
                id: Identifiers.EditCellId,
                start: 0,
                fullEnd: this._cellRanges[this._cellRanges.length - 1].fullEnd - toOffset,
                currentEnd: this._cellRanges[this._cellRanges.length - 1].fullEnd - toOffset
            }];

            return result;
        }

        return [];
    }

    public edit(editorChanges: monacoEditor.editor.IModelContentChange[], id: string): TextDocumentContentChangeEvent[] {
        this._version += 1;

        // Convert the range to local (and remove 1 based)
        if (editorChanges && editorChanges.length) {
            const normalized = editorChanges[0].text.replace(/\r/g, '');

            // Figure out which cell we're editing.
            const cellIndex = this._cellRanges.findIndex(c => c.id === id);
            if (cellIndex >= 0 && (id === Identifiers.EditCellId || this.inEditMode)) {
                // This is an actual edit.
                // Line/column are within this cell. Use its offset to compute the real position
                const editPos = this.positionAt(this._cellRanges[cellIndex].start);
                const from = new Position(editPos.line + editorChanges[0].range.startLineNumber - 1, editorChanges[0].range.startColumn - 1);
                const to = new Position(editPos.line + editorChanges[0].range.endLineNumber - 1, editorChanges[0].range.endColumn - 1);

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

    public convertToDocumentPosition(id: string, line: number, ch: number): Position {
        // Monaco is 1 based, and we need to add in our cell offset.
        const cellIndex = this._cellRanges.findIndex(c => c.id === id);
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
            const cell = this._cellRanges.find(c => c.id === cellId);

            if (cell) {
                return cell.start;
            }
        }

        // in interactive window
        return this._cellRanges[this._cellRanges.length - 1].start;
    }

    private hasCell(cellId: string) {
        const foundIt = this._cellRanges.find(c => c.id === cellId);
        return foundIt ? true : false;
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

    private lookForCellToDelete(incomingCells: ICell[]): TextDocumentContentChangeEvent[] {
        let change: TextDocumentContentChangeEvent[] = [];

        this._cellRanges.forEach((cell, i) => {
            const foundIt = incomingCells.find(c => c.id === cell.id);

            // if cell is not found in the document and its not the last edit cell, we remove it
            if (!foundIt && i !== this._cellRanges.length - 1) {
                const from = new Position(this.getLineFromOffset(cell.start), 0);
                const to = new Position(this.getLineFromOffset(cell.currentEnd - 1), cell.currentEnd - cell.start);

                // for some reason, start for the next cell isn't updated on removeRange,
                // so we update it here
                this._cellRanges[i + 1].start = cell.start;
                this._cellRanges.splice(i, 1);
                change = this.removeRange('', from, to, i);
            }
        });

        return change;
    }

    private lookForCellMovement(incomingCells: ICell[]): TextDocumentContentChangeEvent[] {
        for (let i = 0; i < incomingCells.length && this._cellRanges.length > 1; i += 1) {

            if (incomingCells[i].id !== this._cellRanges[i].id) {
                const lineBreak = '\n';
                const text = this._contents.substr(this._cellRanges[i].start, this._cellRanges[i].currentEnd - this._cellRanges[i].start - 1);
                const newText = concatMultilineString(incomingCells[i].data.source) + lineBreak + text + lineBreak;

                // swap contents
                this._contents = this._contents.substring(0, this._cellRanges[i].start)
                    + this._contents.substring(this._cellRanges[i + 1].start, this._cellRanges[i + 1].fullEnd)
                    + this._contents.substring(this._cellRanges[i].start, this._cellRanges[i].fullEnd)
                    + this._contents.substring(this._cellRanges[i + 1].fullEnd);

                // create lines
                this._lines = this.createLines();

                // swap cell ranges
                const temp1Id = this._cellRanges[i].id;
                const temp1Start = this._cellRanges[i].start;
                const temp1End = this._cellRanges[i].fullEnd;
                const temp1Length = temp1End - temp1Start;

                const temp2Id = this._cellRanges[i + 1].id;
                const temp2Start = this._cellRanges[i + 1].start;
                const temp2End = this._cellRanges[i + 1].fullEnd;
                const temp2Length = temp2End - temp2Start;

                this._cellRanges[i].id = temp2Id;
                this._cellRanges[i].start = temp1Start;
                this._cellRanges[i].currentEnd = temp1Start + temp2Length;
                this._cellRanges[i].fullEnd = temp1Start + temp2Length;

                this._cellRanges[i + 1].id = temp1Id;
                this._cellRanges[i + 1].start = temp1Start + temp2Length;
                this._cellRanges[i + 1].currentEnd = temp1Start + temp2Length + temp1Length;
                this._cellRanges[i + 1].fullEnd = temp1Start + temp2Length + temp1Length;

                const from = new Position(this.getLineFromOffset(temp1Start), 0);
                const to = new Position(this.getLineFromOffset(temp2End - 1), temp2End - temp2Start);
                const fromOffset = temp1Start;
                const toOffset = temp2End;

                return [{
                    range: this.createSerializableRange(from, to),
                    rangeOffset: fromOffset,
                    rangeLength: toOffset - fromOffset,
                    text: newText
                }];
            }
        }

        return [];
    }

    private removeRange(newText: string, from: Position, to: Position, cellIndex: number): TextDocumentContentChangeEvent[] {
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
        return new IntellisenseLine(line, index, prevLine ? prevLine.offset + prevLine.rangeIncludingLineBreak.end.character : 0);
    }

    private convertToOffset(pos: Position): number {
        if (pos.line < this._lines.length) {
            return this._lines[pos.line].offset + pos.character;
        }
        return this._contents.length;
    }

    private createSerializableRange(start: Position, end: Position): Range {
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
