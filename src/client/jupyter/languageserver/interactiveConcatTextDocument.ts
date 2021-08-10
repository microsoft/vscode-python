// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable class-methods-use-this */

import {
    NotebookDocument,
    Position,
    Range,
    TextDocument,
    Uri,
    workspace,
    Event,
    EventEmitter,
    Location,
    TextLine,
} from 'vscode';
import { NotebookConcatTextDocument } from 'vscode-proposed';

import { IVSCodeNotebook } from '../../common/application/types';
import { InteractiveInputScheme } from '../../common/constants';
import { IConcatTextDocument, score } from './concatTextDocument';

export class InteractiveConcatTextDocument implements IConcatTextDocument {
    private _input: TextDocument | undefined = undefined;

    private _concatTextDocument: NotebookConcatTextDocument;

    private _lineCounts: [number, number] = [0, 0];

    private _textLen: [number, number] = [0, 0];

    private _onDidChange = new EventEmitter<void>();

    onDidChange: Event<void> = this._onDidChange.event;

    get isClosed(): boolean {
        return this._concatTextDocument.isClosed || !!this._input?.isClosed;
    }

    get lineCount(): number {
        return this._lineCounts[0] + this._lineCounts[1];
    }

    get languageId(): string {
        return this._input?.languageId ?? 'plaintext';
    }

    get isComposeDocumentsAllClosed(): boolean {
        return !this._notebook.getCells().some((cell) => !cell.document.isClosed) && !!this._input?.isClosed;
    }

    constructor(private _notebook: NotebookDocument, private _selector: string, notebookApi: IVSCodeNotebook) {
        this._concatTextDocument = notebookApi.createConcatTextDocument(_notebook, this._selector);

        this._concatTextDocument.onDidChange(() => {
            // not performant, NotebookConcatTextDocument should provide lineCount
            this._updateConcat();
            this._onDidChange.fire();
        });

        workspace.onDidChangeTextDocument((e) => {
            if (e.document === this._input) {
                this._updateInput();
                this._onDidChange.fire();
            }
        });

        const counter = /Interactive-(\d+)\.interactive/.exec(this._notebook.uri.path);
        if (counter) {
            this._input = workspace.textDocuments.find(
                (document) => document.uri.path.indexOf(`InteractiveInput-${counter[1]}`) >= 0,
            );
        }

        if (!this._input) {
            const once = workspace.onDidOpenTextDocument((e) => {
                if (e.uri.scheme === InteractiveInputScheme) {
                    if (!counter || !counter[1]) {
                        return;
                    }

                    if (e.uri.path.indexOf(`InteractiveInput-${counter[1]}`) >= 0) {
                        this._input = e;
                        this._updateInput();
                        once.dispose();
                    }
                }
            });
        }

        this._updateConcat();
        this._updateInput();
    }

    private _updateConcat() {
        let concatLineCnt = 0;
        let concatTextLen = 0;
        for (let i = 0; i < this._notebook.cellCount; i += 1) {
            const cell = this._notebook.cellAt(i);
            if (score(cell.document, this._selector)) {
                concatLineCnt += cell.document.lineCount;
                concatTextLen += this._getDocumentTextLen(cell.document) + 1;
            }
        }

        this._lineCounts = [concatLineCnt, this._lineCounts[1]];

        this._textLen = [concatTextLen > 0 ? concatTextLen - 1 : 0, this._textLen[1]];
    }

    private _updateInput() {
        this._lineCounts = [this._lineCounts[0], this._input?.lineCount ?? 0];

        this._textLen = [this._textLen[0], this._getDocumentTextLen(this._input)];
    }

    private _getDocumentTextLen(textDocument?: TextDocument): number {
        if (!textDocument) {
            return 0;
        }
        return textDocument.offsetAt(textDocument.lineAt(textDocument.lineCount - 1).range.end) + 1;
    }

    getText(range?: Range): string {
        if (!range) {
            if (this._lineCounts[0] === 0) {
                // empty
                return this._input?.getText() ?? '';
            }

            return `${this._concatTextDocument.getText()}\n${this._input?.getText() ?? ''}`;
        }

        if (range.isEmpty) {
            return '';
        }

        const start = this.locationAt(range.start);
        const end = this.locationAt(range.end);

        const startDocument = workspace.textDocuments.find(
            (document) => document.uri.toString() === start.uri.toString(),
        );
        const endDocument = workspace.textDocuments.find((document) => document.uri.toString() === end.uri.toString());

        if (!startDocument || !endDocument) {
            return '';
        }
        if (startDocument === endDocument) {
            return startDocument.getText(start.range);
        }

        const a = startDocument.getText(new Range(start.range.start, new Position(startDocument.lineCount, 0)));
        const b = endDocument.getText(new Range(new Position(0, 0), end.range.end));
        return `${a}\n${b}`;
    }

    offsetAt(position: Position): number {
        const { line } = position;
        if (line >= this._lineCounts[0]) {
            // input box
            const lineOffset = Math.max(0, line - this._lineCounts[0] - 1);
            return this._input?.offsetAt(new Position(lineOffset, position.character)) ?? 0;
        }
        // concat
        return this._concatTextDocument.offsetAt(position);
    }

    // turning an offset on the final concatenatd document to position
    positionAt(locationOrOffset: Location | number): Position {
        if (typeof locationOrOffset === 'number') {
            const concatTextLen = this._textLen[0];

            if (locationOrOffset >= concatTextLen) {
                // in the input box
                const offset = Math.max(0, locationOrOffset - concatTextLen - 1);
                return this._input?.positionAt(offset) ?? new Position(0, 0);
            }
            const position = this._concatTextDocument.positionAt(locationOrOffset);
            return new Position(this._lineCounts[0] + position.line, position.character);
        }

        if (locationOrOffset.uri.toString() === this._input?.uri.toString()) {
            // range in the input box
            return new Position(
                this._lineCounts[0] + locationOrOffset.range.start.line,
                locationOrOffset.range.start.character,
            );
        }
        return this._concatTextDocument.positionAt(locationOrOffset);
    }

    locationAt(positionOrRange: Range | Position): Location {
        if (positionOrRange instanceof Position) {
            positionOrRange = new Range(positionOrRange, positionOrRange);
        }

        const start = positionOrRange.start.line;
        if (start >= this._lineCounts[0]) {
            // this is the inputbox
            const offset = start - this._lineCounts[0];
            const startPosition = new Position(offset, positionOrRange.start.character);
            const endOffset = positionOrRange.end.line - this._lineCounts[0];
            const endPosition = new Position(endOffset, positionOrRange.end.character);

            // TODO@rebornix !
            return new Location(this._input!.uri, new Range(startPosition, endPosition));
        }

        // this is the NotebookConcatTextDocument
        return this._concatTextDocument.locationAt(positionOrRange);
    }

    contains(uri: Uri): boolean {
        if (this._input?.uri.toString() === uri.toString()) {
            return true;
        }

        return this._concatTextDocument.contains(uri);
    }

    validateRange(range: Range): Range {
        return range;
    }

    validatePosition(position: Position): Position {
        return position;
    }

    lineAt(posOrNumber: Position | number): TextLine {
        const position = typeof posOrNumber === 'number' ? new Position(posOrNumber, 0) : posOrNumber;

        if (position.line >= this._lineCounts[0] && this._input) {
            // this is the input box
            return this._input?.lineAt(position.line - this._lineCounts[0]);
        }

        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this._concatTextDocument.locationAt(position);

        const cell = this._notebook.getCells().find((c) => c.document.uri.toString() === location.uri.toString());
        return cell!.document.lineAt(location.range.start);
    }

    getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined): Range | undefined {
        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this._concatTextDocument.locationAt(position);

        if (location.uri.toString() === this._input?.uri.toString()) {
            return this._input.getWordRangeAtPosition(location.range.start, regexp);
        }

        // Get the cell at this location
        const cell = this._notebook.getCells().find((c) => c.document.uri.toString() === location.uri.toString());
        return cell!.document.getWordRangeAtPosition(location.range.start, regexp);
    }

    getComposeDocuments(): TextDocument[] {
        if (this._input) {
            return [
                ...this._notebook
                    .getCells()
                    .filter((c) => score(c.document, this._selector) > 0)
                    .map((c) => c.document),
                this._input,
            ];
        }
        return [
            ...this._notebook
                .getCells()
                .filter((c) => score(c.document, this._selector) > 0)
                .map((c) => c.document),
        ];
    }
}
