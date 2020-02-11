// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { EndOfLine, Position, Range, TextDocument, TextDocumentContentChangeEvent, TextLine, Uri } from 'vscode';

import {
    DefaultWordPattern,
    ensureValidWordDefinition,
    getWordAtText,
    regExpLeadsToEndlessLoop
} from '../../client/datascience/interactive-common/intellisense/wordHelper';

class MockLine implements TextLine {
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

export class MockDocument implements TextDocument {
    private _uri: Uri;
    private _version: number = 0;
    private _lines: MockLine[] = [];
    private _contents: string = '';
    private _isUntitled = false;
    private _isDirty = false;
    private _onSave: (doc: TextDocument) => Promise<boolean>;

    constructor(contents: string, fileName: string, onSave: (doc: TextDocument) => Promise<boolean>) {
        this._uri = Uri.file(fileName);
        this._contents = contents;
        this._lines = this.createLines();
        this._onSave = onSave;
    }

    public forceUntitled(): void {
        this._isUntitled = true;
        this._isDirty = true;
    }

    public get uri(): Uri {
        return this._uri;
    }
    public get fileName(): string {
        return this._uri.fsPath;
    }

    public get isUntitled(): boolean {
        return this._isUntitled;
    }
    public get languageId(): string {
        return 'python';
    }
    public get version(): number {
        return this._version;
    }
    public get isDirty(): boolean {
        return this._isDirty;
    }
    public get isClosed(): boolean {
        return false;
    }
    public save(): Thenable<boolean> {
        return this._onSave(this);
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

    public edit(c: TextDocumentContentChangeEvent): void {
        this._version += 1;
        const before = this._contents.substr(0, c.rangeOffset);
        const after = this._contents.substr(c.rangeOffset + c.rangeLength);
        this._contents = `${before}${c.text}${after}`;
        this._lines = this.createLines();
    }

    private createLines(): MockLine[] {
        const split = this._contents.split('\n');
        let prevLine: MockLine | undefined;
        return split.map((s, i) => {
            const nextLine = this.createTextLine(s, i, prevLine);
            prevLine = nextLine;
            return nextLine;
        });
    }

    private createTextLine(line: string, index: number, prevLine: MockLine | undefined): MockLine {
        return new MockLine(
            line,
            index,
            prevLine ? prevLine.offset + prevLine.rangeIncludingLineBreak.end.character : 0
        );
    }

    private convertToOffset(pos: Position): number {
        if (pos.line < this._lines.length) {
            return (
                this._lines[pos.line].offset +
                Math.min(this._lines[pos.line].rangeIncludingLineBreak.end.character, pos.character)
            );
        }
        return this._contents.length;
    }
}
