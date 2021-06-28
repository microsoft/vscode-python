// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    NotebookDocument,
    Position,
    Range,
    Uri,
    DocumentSelector,
    Event,
    EventEmitter,
    Location,
    TextLine,
} from 'vscode';
import { NotebookConcatTextDocument } from 'vscode-proposed';

import { IVSCodeNotebook } from '../../common/application/types';
import { IConcatTextDocument } from './concatTextDocument';

export class EnhancedNotebookConcatTextDocument implements IConcatTextDocument {
    private _concatTextDocument: NotebookConcatTextDocument;

    private _onDidChange = new EventEmitter<void>();

    onDidChange: Event<void> = this._onDidChange.event;

    constructor(private _notebook: NotebookDocument, selector: DocumentSelector, notebookApi: IVSCodeNotebook) {
        this._concatTextDocument = notebookApi.createConcatTextDocument(_notebook, selector);
    }

    get isClosed(): boolean {
        return this._concatTextDocument.isClosed;
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
}
