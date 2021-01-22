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

    private cellUris: Uri[] = [];

    private cellLengths: number[] = [];

    private onCellsChangedEmitter = new EventEmitter<TextDocumentChangeEvent>();

    constructor(public notebook: NotebookDocument, notebookApi: IVSCodeNotebook, selector: DocumentSelector) {
        const dir = path.dirname(notebook.uri.fsPath);
        // Note: Has to be different than the prefix for old notebook editor (HiddenFileFormat) so
        // that the caller doesn't remove diagnostics for this document.
        this.dummyFilePath = path.join(dir, `${NotebookConcatPrefix}${uuid().replace(/-/g, '')}.py`);
        this.dummyUri = Uri.file(this.dummyFilePath);
        this.concatDocument = notebookApi.createConcatTextDocument(notebook, selector);
        this.onDidChangeSubscription = this.concatDocument.onDidChange(this.onDidChange, this);
        this.cellUris = notebook.cells.map((c) => c.uri);
        this.cellLengths = notebook.cells.map((c) => c.document.getText().length + 1);
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

    private onDidChange() {
        this._version += 1;
        const newUris = this.notebook.cells.map((c) => c.uri);

        // See if number of cells or cell positions changed
        if (this.cellUris.length < this.notebook.cells.length) {
            this.raiseCellInsertion(newUris);
        } else if (this.cellUris.length > this.notebook.cells.length) {
            this.raiseCellDeletion(newUris);
        } else if (!isEqual(this.cellUris, newUris)) {
            this.raiseCellMovement(newUris);
        }
        this.cellUris = newUris;
        this.cellLengths = this.notebook.cells.map((c) => c.document.getText().length + 1); // +1 for the /n between cells
    }

    private getPositionOfCell(cellUri: Uri): Position {
        return this.concatDocument.positionAt(new Location(cellUri, new Position(0, 0)));
    }

    private raiseCellInsertion(newUris: Uri[]) {
        // A cell was inserted. Figure out which one
        const index = newUris.findIndex((p) => !this.cellUris.includes(p));
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

    private raiseCellDeletion(newUris: Uri[]) {
        // A cell was deleted. Figure out which one
        const index = this.cellUris.findIndex((p) => !newUris.includes(p));
        if (index >= 0) {
            // Figure out the position of the item in the new list
            const position =
                index < newUris.length - 1
                    ? this.getPositionOfCell(newUris[index])
                    : this.getPositionOfCell(newUris[newUris.length - 1]);

            // Length should be old length
            const length = this.cellLengths[index];

            // Turn this cell into a change event.
            this.onCellsChangedEmitter.fire({
                document: this,
                contentChanges: [
                    {
                        text: '',
                        range: new Range(position, position),
                        rangeLength: length,
                        rangeOffset: 0,
                    },
                ],
            });
        }
    }

    private raiseCellMovement(newUris: Uri[]) {
        const movedCells = this.cellUris
            .map((u, i) => {
                return {
                    index: i,
                    uri: u,
                };
            })
            .filter((e) => newUris[e.index] !== e.uri);
        if (movedCells && movedCells.length === 2) {
            // Should be two changes. One for each cell
            const position1 = this.getPositionOfCell(newUris[movedCells[1].index]);
            const change1 = {
                text: `${this.notebook.cells[movedCells[1].index].document.getText()}\n`,
                range: new Range(position1, position1),
                rangeLength: this.cellLengths[movedCells[0].index],
                rangeOffset: 0,
            };

            // Second position is harder. From the language server's point of view we just
            // inserted the second cell into where the first cell was. So now the position for
            // new cell should be correct
            const position2 = this.getPositionOfCell(newUris[movedCells[0].index]);
            const change2 = {
                text: `${this.notebook.cells[movedCells[0].index].document.getText()}\n`,
                range: new Range(position2, position2),
                rangeLength: this.cellLengths[movedCells[1].index],
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
