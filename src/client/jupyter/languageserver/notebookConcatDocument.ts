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
        return this.notebook.languages[0];
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

    private cellTracking: { uri: Uri; endPosition: Position; length: number }[] = [];

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
            const startPosition = this.getPositionOfCell(c.uri);
            const cellText = c.document.getText();
            const lines = cellText.splitLines({ trim: false });

            // Include final split as a cell really has \n on the end.
            const endPosition = new Position(startPosition.line + lines.length, 0);

            this.cellTracking.push({
                uri: c.uri,
                length: cellText.length + 1, // \n is included concat length
                endPosition,
            });
        });
    }

    private onDidChange() {
        this._version += 1;
        const newUris = this.notebook.cells.map((c) => c.uri);
        const oldUris = this.cellTracking.map((c) => c.uri);

        // See if number of cells or cell positions changed
        if (this.cellTracking.length < this.notebook.cells.length) {
            this.raiseCellInsertion(newUris, oldUris);
        } else if (this.cellTracking.length > this.notebook.cells.length) {
            this.raiseCellDeletion(newUris, oldUris);
        } else if (!isEqual(oldUris, newUris)) {
            this.raiseCellMovement(newUris, oldUris);
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

    private raiseCellInsertion(newUris: Uri[], oldUris: Uri[]) {
        // A cell was inserted. Figure out which one
        const index = newUris.findIndex((p) => !oldUris.includes(p));
        if (index >= 0) {
            // Figure out the position of the item before. This is where we're inserting the cell
            const position = index > 0 ? this.getPositionOfCell(newUris[index]) : new Position(0, 0);

            // Text should be the contents of the new cell plus the '\n'
            const text = `${this.notebook.cells[index].document.getText()}\n`;
            // Turn this cell into a change event.
            this.onCellsChangedEmitter.fire({
                document: this,
                contentChanges: [
                    {
                        text,
                        range: new Range(position, position),
                        rangeLength: 0,
                        rangeOffset: 0,
                    },
                ],
            });
        }
    }

    private raiseCellDeletion(newUris: Uri[], oldUris: Uri[]) {
        // A cell was deleted. Figure out which one
        const index = oldUris.findIndex((p) => !newUris.includes(p));
        if (index >= 0) {
            // Figure out the position of the item in the new list
            const position = index < newUris.length ? this.getPositionOfCell(newUris[index]) : this.getEndPosition();

            // Length should be old length
            const { length } = this.cellTracking[index];

            // Range should go from new position to end of old position
            const { endPosition } = this.cellTracking[index];

            // Turn this cell into a change event.
            this.onCellsChangedEmitter.fire({
                document: this,
                contentChanges: [
                    {
                        text: '',
                        range: new Range(position, endPosition),
                        rangeLength: length,
                        rangeOffset: 0,
                    },
                ],
            });
        }
    }

    private raiseCellMovement(newUris: Uri[], oldUris: Uri[]) {
        const movedCells = oldUris
            .map((u, i) => {
                return {
                    index: i,
                    uri: u,
                };
            })
            .filter((e) => newUris[e.index] !== e.uri)
            .map((e) => e.index)
            .sort();
        if (movedCells && movedCells.length === 2) {
            // Should be two changes. One for each cell
            const startPosition1 = this.getPositionOfCell(newUris[movedCells[0]]);
            const endPosition1 = this.cellTracking[movedCells[1]].endPosition;
            const change1 = {
                text: `${this.notebook.cells[movedCells[0]].document.getText()}\n`,
                range: new Range(startPosition1, endPosition1),
                rangeLength: this.cellTracking[movedCells[1]].length,
                rangeOffset: 0,
            };

            // Second position is harder. From the language server's point of view we just
            // inserted the second cell into where the first cell was. So now the position for
            // new cell should be correct. End position is not though. It's relative.
            const startPosition2 = this.getPositionOfCell(newUris[movedCells[1]]);

            // For end position, really need the number of lines that were in the old cell. We
            // can use the previous end position to figure that out (as the second index has to be greater than zero)
            const numberOfLines =
                this.cellTracking[movedCells[0]].endPosition.line -
                this.cellTracking[movedCells[0] - 1].endPosition.line;
            const endPosition2 = new Position(startPosition2.line + numberOfLines, 0);
            const change2 = {
                text: `${this.notebook.cells[movedCells[1]].document.getText()}\n`,
                range: new Range(startPosition2, endPosition2),
                rangeLength: this.cellTracking[movedCells[0]].length,
                rangeOffset: 0,
            };

            // Turn this cell into a change event.
            this.onCellsChangedEmitter.fire({
                document: this,
                contentChanges: [change1, change2],
            });
        }
    }
}
