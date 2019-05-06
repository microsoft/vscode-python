// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { EndOfLine, Position, Range, TextDocument, TextDocumentContentChangeEvent, TextLine, Uri } from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

import { PYTHON_LANGUAGE } from '../../../common/constants';
import { Identifiers } from '../../constants';

class IntellisenseLine implements TextLine {

    private _range : Range;
    private _rangeWithLineBreak: Range;
    private _firstNonWhitespaceIndex : number | undefined;
    private _isEmpty : boolean | undefined;

    constructor(private _contents: string, private _line: number, private _offset: number) {
        this._range = new Range(new Position(_line, 0), new Position(_line, _contents.length));
        this._rangeWithLineBreak = new Range(this.range.start, new Position(_line, _contents.length + 1));
    }

    public get offset() : number {
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
    end: number;
}

export class IntellisenseDocument implements TextDocument {

    private _uri : Uri;
    private _version : number = 0;
    private _lines: IntellisenseLine[] = [];
    private _contents: string = '';
    private _cellRanges: ICellRange[] = [];

    constructor(fileName: string) {
        // The file passed in is the base Uri for where we're basing this
        // document.
        //
        // What about liveshare?
        this._uri = Uri.file(fileName);

        // We should start our edit offset at 0. Each cell should end with a '/n'
        this._cellRanges.push({id: Identifiers.EditCellId, start: 0, end: 0});
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
        const before = this._contents.slice(0, offset);
        const newLines = before.match(/\n/g);
        const line = newLines ? newLines.length : 0;
        const preCharacters = before.match(/(\n|^).*$/g);
        return new Position(line, preCharacters ? preCharacters[0].length : 0);
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
    public getWordRangeAtPosition(_position: Position, _regex?: RegExp | undefined): Range | undefined {
        throw new Error('Method not implemented.');
    }
    public validateRange(range: Range): Range {
        return range;
    }
    public validatePosition(position: Position): Position {
        return position;
    }

    public get textDocumentItem() : vscodeLanguageClient.TextDocumentItem {
        return {
            uri : this._uri.toString(),
            languageId: this.languageId,
            version: this.version,
            text: this.getText()
        };
    }

    public get textDocumentId() : vscodeLanguageClient.VersionedTextDocumentIdentifier {
        return {
            uri: this._uri.toString(),
            version: this.version
        };
    }
    public addCell(code: string, id: string): TextDocumentContentChangeEvent[] {
        // This should only happen once for each cell.
        this._version += 1;

        // Get rid of windows line endings. We're normalizing on linux
        const normalized = code.replace(/\r/g, '');

        // This item should go just before the edit cell

        // Make sure to put a newline between this code and the next code
        const newCode = `${normalized}\n`;

        // We should start just before the last cell.
        const fromOffset = this._cellRanges[this._cellRanges.length - 1].start;

        // Split our text between the edit text and the cells above
        const before = this._contents.substr(0, fromOffset);
        const after = this._contents.substr(fromOffset);
        const fromPosition = this.computePosition(fromOffset);

        // Save the range for this cell ()
        this._cellRanges.splice(this._cellRanges.length - 1, 0, { id, start: fromOffset, end: fromOffset + newCode.length });

        // Update our entire contents and recompute our lines
        this._contents = `${before}${newCode}${after}`;
        this._lines = this.createLines();
        this._cellRanges[this._cellRanges.length - 1].start += newCode.length;
        this._cellRanges[this._cellRanges.length - 1].end += newCode.length;

        return [
            {
                range: this.createSerializableRange(fromPosition, fromPosition),
                rangeOffset: fromOffset,
                rangeLength: 0, // Adds are always zero
                text: newCode
            }
        ];
    }

    public edit(editorChanges: monacoEditor.editor.IModelContentChange[], id: string): TextDocumentContentChangeEvent[] {
        this._version += 1;

        // Convert the range to local (and remove 1 based)
        if (editorChanges && editorChanges.length) {
            const normalized = editorChanges[0].text.replace(/\r/g, '');

            // The monaco Editor doesn't know about the hidden '\n' we have between the cells. We have
            // to account for this in our length computations.
            const normalizedLength = id === Identifiers.EditCellId ? normalized.length : normalized.length + 1;

            // Figure out which cell we're editing.
            const cellIndex = this._cellRanges.findIndex(c => c.id === id);
            if (cellIndex >= 0) {
                // Line/column are within this cell. Use its offset to compute the real position
                const editPos = this.computePosition(this._cellRanges[cellIndex].start);
                const from = new Position(editPos.line + editorChanges[0].range.startLineNumber - 1, editorChanges[0].range.startColumn - 1);
                const to = new Position(editPos.line + editorChanges[0].range.endLineNumber - 1, editorChanges[0].range.endColumn - 1);
                const fromOffset = this.convertToOffset(from);
                const toOffset = this.convertToOffset(to);

                // Recreate our contents, and then recompute all of our lines
                const before = this._contents.substr(0, fromOffset);
                const after = this._contents.substr(toOffset);
                this._contents = `${before}${normalized}${after}`;
                this._lines = this.createLines();

                // Update ranges after this. All should move by the diff in length, although the current one
                // should stay at the same start point.
                const lengthDiff = normalizedLength - (this._cellRanges[cellIndex].end - this._cellRanges[cellIndex].start);
                for (let i = cellIndex; i < this._cellRanges.length; i += 1) {
                    if (i !== cellIndex) {
                        this._cellRanges[i].start += lengthDiff;
                    }
                    this._cellRanges[i].end += lengthDiff;
                }

                return [
                    {
                         range: this.createSerializableRange(from, to),
                         rangeOffset: fromOffset,
                         rangeLength: toOffset - fromOffset,
                         text: normalized
                    }
                ];

            }
        }

        return [];
    }

    public convertToDocumentPosition(id: string, line: number, ch: number) : Position {
        // Monaco is 1 based, and we need to add in our cell offset.
        const cellIndex = this._cellRanges.findIndex(c => c.id === id);
        if (cellIndex >= 0) {
            // Line/column are within this cell. Use its offset to compute the real position
            const editLine = this.computePosition(this._cellRanges[cellIndex].start);
            const docLine = line - 1 + editLine.line;
            const docCh = ch - 1;
            return new Position(docLine, docCh);
        }

        // We can't find a cell that matches. Just remove the 1 based
        return new Position(line - 1, ch - 1);
    }

    private computePosition(offset: number) : Position {
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

    private createLines() : IntellisenseLine[] {
        const split = this._contents.splitLines({trim: false, removeEmptyEntries: false});
        let prevLine: IntellisenseLine | undefined;
        return split.map((s, i) => {
            const nextLine = this.createTextLine(s, i, prevLine);
            prevLine = nextLine;
            return nextLine;
        });
    }

    private createTextLine(line: string, index: number, prevLine: IntellisenseLine | undefined) : IntellisenseLine {
        return new IntellisenseLine(line, index, prevLine ? prevLine.offset + prevLine.rangeIncludingLineBreak.end.character : 0);
    }

    private convertToOffset(pos: Position) : number {
        if (pos.line < this._lines.length) {
            return this._lines[pos.line].offset + pos.character;
        }
        return this._contents.length;
    }

    private createSerializableRange(start: Position, end: Position) : Range {
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
