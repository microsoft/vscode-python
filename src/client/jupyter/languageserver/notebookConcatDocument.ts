// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    Disposable,
    DocumentSelector,
    EndOfLine,
    Event,
    EventEmitter,
    Position,
    Location,
    Range,
    TextDocument,
    TextDocumentChangeEvent,
    TextLine,
    Uri,
} from 'vscode';
import { isEqual } from 'lodash';
import { NotebookConcatTextDocument, NotebookCell, NotebookDocument } from 'vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { PYTHON_LANGUAGE } from '../../common/constants';

export const NotebookConcatPrefix = '_NotebookConcat_';

/**
 * This helper class is used to present a converted document to an LS
 */
export class NotebookConcatDocument implements TextDocument, IDisposable {
    public get notebookUri(): Uri {
        return this.notebook.uri;
    }

    public get uri(): Uri {
        return this.dummyUri;
    }

    public get fileName(): string {
        return this.dummyFilePath;
    }

    public get isUntitled(): boolean {
        return this.notebook.isUntitled;
    }

    public get languageId(): string {
        // eslint-disable-next-line global-require
        const { NotebookCellKind } = require('vscode');
        // Return Python if we have python cells.
        if (this.notebook.cells.some((item) => item.language.toLowerCase() === PYTHON_LANGUAGE.toLowerCase())) {
            return PYTHON_LANGUAGE;
        }
        // Return the language of the first available cell, else assume its a Python notebook.
        // The latter is not possible, except for the case where we have all markdown cells,
        // in which case the language server will never kick in.
        return this.notebook.cells.find((item) => item.cellKind === NotebookCellKind.Code)?.language || PYTHON_LANGUAGE;
    }

    public get version(): number {
        return this._version;
    }

    public get isDirty(): boolean {
        return this.notebook.isDirty;
    }

    public get isClosed(): boolean {
        return this.concatDocument.isClosed;
    }

    // eslint-disable-next-line class-methods-use-this
    public get eol(): EndOfLine {
        return EndOfLine.LF;
    }

    public get lineCount(): number {
        return this.notebook.cells.map((c) => c.document.lineCount).reduce((p, c) => p + c);
    }

    public get onCellsChanged(): Event<TextDocumentChangeEvent> {
        return this.onCellsChangedEmitter.event;
    }

    public firedOpen = false;

    public firedClose = false;

    public concatDocument: NotebookConcatTextDocument;

    private dummyFilePath: string;

    private dummyUri: Uri;

    private _version = 1;

    private onDidChangeSubscription: Disposable;

    private cellTracking: { uri: Uri; lineCount: number; length: number }[] = [];

    private onCellsChangedEmitter = new EventEmitter<TextDocumentChangeEvent>();

    constructor(public notebook: NotebookDocument, notebookApi: IVSCodeNotebook, selector: DocumentSelector) {
        const dir = path.dirname(notebook.uri.fsPath);
        // Note: Has to be different than the prefix for old notebook editor (HiddenFileFormat) so
        // that the caller doesn't remove diagnostics for this document.
        this.dummyFilePath = path.join(dir, `${NotebookConcatPrefix}${uuid().replace(/-/g, '')}.py`);
        this.dummyUri = Uri.file(this.dummyFilePath);
        this.concatDocument = notebookApi.createConcatTextDocument(notebook, selector);
        this.onDidChangeSubscription = this.concatDocument.onDidChange(this.onDidChange, this);
        this.updateCellTracking();
    }

    public dispose(): void {
        this.onDidChangeSubscription.dispose();
    }

    public isCellOfDocument(uri: Uri): boolean {
        return this.concatDocument.contains(uri);
    }

    // eslint-disable-next-line class-methods-use-this
    public save(): Thenable<boolean> {
        // Not used
        throw new Error('Not implemented');
    }

    public lineAt(posOrNumber: Position | number): TextLine {
        const position = typeof posOrNumber === 'number' ? new Position(posOrNumber, 0) : posOrNumber;

        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this.concatDocument.locationAt(position);

        // Get the cell at this location
        const cell = this.notebook.cells.find((c) => c.uri.toString() === location.uri.toString());
        return cell!.document.lineAt(location.range.start);
    }

    public offsetAt(position: Position): number {
        return this.concatDocument.offsetAt(position);
    }

    public positionAt(offset: number): Position {
        return this.concatDocument.positionAt(offset);
    }

    public getText(range?: Range | undefined): string {
        return range ? this.concatDocument.getText(range) : this.concatDocument.getText();
    }

    public getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined): Range | undefined {
        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this.concatDocument.locationAt(position);

        // Get the cell at this location
        const cell = this.notebook.cells.find((c) => c.uri.toString() === location.uri.toString());
        return cell!.document.getWordRangeAtPosition(location.range.start, regexp);
    }

    public validateRange(range: Range): Range {
        return this.concatDocument.validateRange(range);
    }

    public validatePosition(pos: Position): Position {
        return this.concatDocument.validatePosition(pos);
    }

    public getCellAtPosition(position: Position): NotebookCell | undefined {
        const location = this.concatDocument.locationAt(position);
        return this.notebook.cells.find((c) => c.uri === location.uri);
    }

    private updateCellTracking() {
        this.cellTracking = [];
        this.notebook.cells.forEach((c) => {
            // Compute end position from number of lines in a cell
            const cellText = c.document.getText();
            const lines = cellText.splitLines({ trim: false });

            this.cellTracking.push({
                uri: c.uri,
                length: cellText.length + 1, // \n is included concat length
                lineCount: lines.length,
            });
        });
    }

    private onDidChange() {
        this._version += 1;
        const newUris = this.notebook.cells.map((c) => c.uri.toString());
        const oldUris = this.cellTracking.map((c) => c.uri.toString());

        // See if number of cells or cell positions changed
        if (this.cellTracking.length < this.notebook.cells.length) {
            this.raiseCellInsertions(oldUris);
        } else if (this.cellTracking.length > this.notebook.cells.length) {
            this.raiseCellDeletions(newUris, oldUris);
        } else if (!isEqual(oldUris, newUris)) {
            this.raiseCellMovement();
        }
        this.updateCellTracking();
    }

    private getPositionOfCell(cellUri: Uri): Position {
        return this.concatDocument.positionAt(new Location(cellUri, new Position(0, 0)));
    }

    public getEndPosition(): Position {
        if (this.notebook.cells.length > 0) {
            const finalCell = this.notebook.cells[this.notebook.cells.length - 1];
            const start = this.getPositionOfCell(finalCell.uri);
            const lines = finalCell.document.getText().splitLines({ trim: false });
            return new Position(start.line + lines.length, 0);
        }
        return new Position(0, 0);
    }

    private raiseCellInsertions(oldUris: string[]) {
        // One or more cells were added. Add a change event for each
        const insertions = this.notebook.cells.filter((c) => !oldUris.includes(c.uri.toString()));

        const changes = insertions.map((insertion) => {
            // Figure out the position of the item. This is where we're inserting the cell
            // Note: The first insertion will line up with the old cell at this position
            // The second or other insertions will line up with their new positions.
            const position = this.getPositionOfCell(insertion.uri);

            // Text should be the contents of the new cell plus the '\n'
            const text = `${insertion.document.getText()}\n`;

            return {
                text,
                range: new Range(position, position),
                rangeLength: 0,
                rangeOffset: 0,
            };
        });

        // Send all of the changes
        this.onCellsChangedEmitter.fire({
            document: this,
            contentChanges: changes,
        });
    }

    private raiseCellDeletions(newUris: string[], oldUris: string[]) {
        // cells were deleted. Figure out which ones
        const oldIndexes: number[] = [];
        oldUris.forEach((o, i) => {
            if (!newUris.includes(o)) {
                oldIndexes.push(i);
            }
        });
        const changes = oldIndexes.map((index) => {
            // Figure out the position of the item in the new list
            const position =
                index < newUris.length ? this.getPositionOfCell(this.notebook.cells[index].uri) : this.getEndPosition();

            // Length should be old length
            const { length } = this.cellTracking[index];

            // Range should go from new position to end of old position
            const endPosition = new Position(position.line + this.cellTracking[index].lineCount, 0);

            // Turn this cell into a change event.
            return {
                text: '',
                range: new Range(position, endPosition),
                rangeLength: length,
                rangeOffset: 0,
            };
        });

        // Send the event
        this.onCellsChangedEmitter.fire({
            document: this,
            contentChanges: changes,
        });
    }

    private raiseCellMovement() {
        // When moving, just replace everything. Simpler this way. Might this
        // cause unknown side effects? Don't think so.
        this.onCellsChangedEmitter.fire({
            document: this,
            contentChanges: [
                {
                    text: this.concatDocument.getText(),
                    range: new Range(
                        new Position(0, 0),
                        new Position(
                            this.cellTracking.reduce((p, c) => p + c.lineCount, 0),
                            0,
                        ),
                    ),
                    rangeLength: this.cellTracking.reduce((p, c) => p + c.length, 0),
                    rangeOffset: 0,
                },
            ],
        });
    }
}
