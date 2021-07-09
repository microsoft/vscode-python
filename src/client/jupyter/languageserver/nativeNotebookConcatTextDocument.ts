// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    NotebookDocument,
    Position,
    Range,
    Uri,
    Event,
    EventEmitter,
    Location,
    TextLine,
    NotebookCell,
    TextDocument,
} from 'vscode';
import { NotebookConcatTextDocument } from 'vscode-proposed';

import { IVSCodeNotebook } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IConcatTextDocument, score } from './concatTextDocument';

export class EnhancedNotebookConcatTextDocument implements IConcatTextDocument {
    private _concatTextDocument: NotebookConcatTextDocument;

    private _onDidChange = new EventEmitter<void>();

    onDidChange: Event<void> = this._onDidChange.event;

    constructor(private _notebook: NotebookDocument, private _selector: string, notebookApi: IVSCodeNotebook) {
        this._concatTextDocument = notebookApi.createConcatTextDocument(_notebook, _selector);
    }

    get isClosed(): boolean {
        return this._concatTextDocument.isClosed;
    }

    get lineCount(): number {
        return this._notebook
            .getCells()
            .filter((c) => score(c.document, this._selector) > 0)
            .map((c) => c.document.lineCount)
            .reduce((p, c) => p + c);
    }

    get languageId(): string {
        // eslint-disable-next-line global-require
        const { NotebookCellKind } = require('vscode');
        // Return Python if we have python cells.
        if (this.getCellsInConcatDocument().length > 0) {
            return PYTHON_LANGUAGE;
        }
        // Return the language of the first available cell, else assume its a Python notebook.
        // The latter is not possible, except for the case where we have all markdown cells,
        // in which case the language server will never kick in.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (
            this.getCellsInConcatDocument().find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (item) => ((item as any).cellKind || item.kind) === NotebookCellKind.Code,
            )?.document?.languageId || PYTHON_LANGUAGE
        );
    }

    getText(range?: Range | undefined): string {
        if (range) {
            return this._concatTextDocument.getText(range);
        }

        return this._concatTextDocument.getText();
    }

    contains(uri: Uri): boolean {
        return this._concatTextDocument.contains(uri);
    }

    offsetAt(position: Position): number {
        return this._concatTextDocument.offsetAt(position);
    }

    positionAt(locationOrOffset: Location | number): Position {
        if (typeof locationOrOffset === 'number') {
            return this._concatTextDocument.positionAt(locationOrOffset);
        }

        return this._concatTextDocument.positionAt(locationOrOffset);
    }

    validateRange(range: Range): Range {
        return this._concatTextDocument.validateRange(range);
    }

    validatePosition(position: Position): Position {
        return this._concatTextDocument.validatePosition(position);
    }

    locationAt(positionOrRange: Position | Range): Location {
        return this._concatTextDocument.locationAt(positionOrRange);
    }

    lineAt(posOrNumber: Position | number): TextLine {
        const position = typeof posOrNumber === 'number' ? new Position(posOrNumber, 0) : posOrNumber;

        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this._concatTextDocument.locationAt(position);

        // Get the cell at this location
        const cell = this._notebook.getCells().find((c) => c.document.uri.toString() === location.uri.toString());
        return cell!.document.lineAt(location.range.start);
    }

    getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined): Range | undefined {
        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this._concatTextDocument.locationAt(position);

        // Get the cell at this location
        const cell = this._notebook.getCells().find((c) => c.document.uri.toString() === location.uri.toString());
        return cell!.document.getWordRangeAtPosition(location.range.start, regexp);
    }

    getComposeDocuments(): TextDocument[] {
        return this.getCellsInConcatDocument().map((c) => c.document);
    }

    private getCellsInConcatDocument(): NotebookCell[] {
        return this._notebook.getCells().filter((c) => score(c.document, this._selector) > 0);
    }
}
