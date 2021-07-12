// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    Disposable,
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
import { NotebookDocument } from 'vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { InteractiveScheme } from '../../common/constants';
import { IConcatTextDocument } from './concatTextDocument';
import { InteractiveConcatTextDocument } from './interactiveConcatTextDocument';
import { EnhancedNotebookConcatTextDocument } from './nativeNotebookConcatTextDocument';

const NotebookConcatPrefix = '_NotebookConcat_';

/**
 * This helper class is used to present a converted document to an LS
 */
export class NotebookConcatDocument implements TextDocument, IDisposable {
    public get uri(): Uri {
        return this.dummyUri;
    }

    public get fileName(): string {
        return this.dummyFilePath;
    }

    public get isUntitled(): boolean {
        return this._notebook.isUntitled;
    }

    public get languageId(): string {
        return this.concatDocument.languageId;
    }

    public get version(): number {
        return this._version;
    }

    public get isDirty(): boolean {
        return this._notebook.isDirty;
    }

    public get isClosed(): boolean {
        return this.concatDocument.isClosed;
    }

    // eslint-disable-next-line class-methods-use-this
    public get eol(): EndOfLine {
        return EndOfLine.LF;
    }

    public get lineCount(): number {
        return this.concatDocument.lineCount;
    }

    public get onCellsChanged(): Event<TextDocumentChangeEvent> {
        return this.onCellsChangedEmitter.event;
    }

    public get isComposeDocumentsAllClosed(): boolean {
        return this.concatDocument.isComposeDocumentsAllClosed;
    }

    public firedOpen = false;

    public concatDocument: IConcatTextDocument;

    private dummyFilePath: string;

    private dummyUri: Uri;

    private _version = 1;

    private onDidChangeSubscription: Disposable;

    private cellTracking: { uri: Uri; lineCount: number; length: number }[] = [];

    private onCellsChangedEmitter = new EventEmitter<TextDocumentChangeEvent>();

    private _notebook: NotebookDocument;

    constructor(notebook: NotebookDocument, notebookApi: IVSCodeNotebook, selector: string) {
        const dir = path.dirname(notebook.uri.fsPath);
        // Create a safe notebook document so that we can handle both >= 1.56 vscode API and < 1.56
        // when vscode stable is 1.56 and both Python release and insiders can update to that engine version we
        // can remove this and just use NotebookDocument directly
        this._notebook = notebook;
        // Note: Has to be different than the prefix for old notebook editor (HiddenFileFormat) so
        // that the caller doesn't remove diagnostics for this document.
        this.dummyFilePath = path.join(dir, `${NotebookConcatPrefix}${uuid().replace(/-/g, '')}.py`);
        this.dummyUri = Uri.file(this.dummyFilePath);

        if (notebook.uri.scheme === InteractiveScheme) {
            this.concatDocument = new InteractiveConcatTextDocument(notebook, selector, notebookApi);
        } else {
            this.concatDocument = new EnhancedNotebookConcatTextDocument(notebook, selector, notebookApi);
        }

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
        return this.concatDocument.lineAt(posOrNumber);
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
        return this.concatDocument.getWordRangeAtPosition(position, regexp);
    }

    public validateRange(range: Range): Range {
        return this.concatDocument.validateRange(range);
    }

    public validatePosition(pos: Position): Position {
        return this.concatDocument.validatePosition(pos);
    }

    public locationAt(range: Range): Location {
        return this.concatDocument.locationAt(range);
    }

    public getTextDocumentAtPosition(position: Position): TextDocument | undefined {
        const location = this.concatDocument.locationAt(position);
        return this.concatDocument.getComposeDocuments().find((c) => c.uri === location.uri);
    }

    private updateCellTracking() {
        this.cellTracking = [];
        this.concatDocument.getComposeDocuments().forEach((document) => {
            // Compute end position from number of lines in a cell
            const cellText = document.getText();
            const lines = cellText.splitLines({ trim: false });

            this.cellTracking.push({
                uri: document.uri,
                length: cellText.length + 1, // \n is included concat length
                lineCount: lines.length,
            });
        });
    }

    private onDidChange() {
        this._version += 1;
        const newUris = this.concatDocument.getComposeDocuments().map((document) => document.uri.toString());
        const oldUris = this.cellTracking.map((c) => c.uri.toString());

        // See if number of cells or cell positions changed
        if (this.cellTracking.length < this._notebook.cellCount) {
            this.raiseCellInsertions(oldUris);
        } else if (this.cellTracking.length > this._notebook.cellCount) {
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
        if (this._notebook.cellCount > 0) {
            const finalCell = this._notebook.cellAt(this._notebook.cellCount - 1);
            const start = this.getPositionOfCell(finalCell.document.uri);
            const lines = finalCell.document.getText().splitLines({ trim: false });
            return new Position(start.line + lines.length, 0);
        }
        return new Position(0, 0);
    }

    private raiseCellInsertions(oldUris: string[]) {
        // One or more cells were added. Add a change event for each
        const insertions = this.concatDocument
            .getComposeDocuments()
            .filter((document) => !oldUris.includes(document.uri.toString()));

        const changes = insertions.map((insertion) => {
            // Figure out the position of the item. This is where we're inserting the cell
            // Note: The first insertion will line up with the old cell at this position
            // The second or other insertions will line up with their new positions.
            const position = this.getPositionOfCell(insertion.uri);

            // Text should be the contents of the new cell plus the '\n'
            const text = `${insertion.getText()}\n`;

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
                index < newUris.length
                    ? this.getPositionOfCell(this._notebook.cellAt(index).document.uri)
                    : this.getEndPosition();

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
