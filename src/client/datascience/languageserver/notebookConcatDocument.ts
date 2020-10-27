// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    Disposable,
    DocumentSelector,
    EndOfLine,
    NotebookConcatTextDocument,
    NotebookDocument,
    Position,
    Range,
    TextDocument,
    Uri
} from 'vscode';
import { IVSCodeNotebook } from '../../common/application/types';
import { IDisposable } from '../../common/types';

export const NotebookConcatPrefix = '_NotebookConcat_';

/**
 * This helper class is used to present a converted document to an LS
 */
export class NotebookConcatDocument implements TextDocument, IDisposable {
    public get notebookUri() {
        return this.notebook.uri;
    }

    public get uri() {
        return this.dummyUri;
    }

    public get fileName() {
        return this.dummyFilePath;
    }

    public get isUntitled() {
        return this.notebook.isUntitled;
    }

    public get languageId() {
        return this.notebook.languages[0];
    }

    public get version() {
        return this._version;
    }

    public get isDirty() {
        return this.notebook.isDirty;
    }

    public get isClosed() {
        return this.concatDocument.isClosed;
    }
    public get eol() {
        return EndOfLine.LF;
    }
    public get lineCount() {
        return this.notebook.cells.map((c) => c.document.lineCount).reduce((p, c) => p + c);
    }
    public firedOpen = false;
    public firedClose = false;
    public concatDocument: NotebookConcatTextDocument;
    private dummyFilePath: string;
    private dummyUri: Uri;
    private _version = 1;
    private onDidChangeSubscription: Disposable;
    constructor(public notebook: NotebookDocument, notebookApi: IVSCodeNotebook, selector: DocumentSelector) {
        const dir = path.dirname(notebook.uri.fsPath);
        // Note: Has to be different than the prefix for old notebook editor (HiddenFileFormat) so
        // that the caller doesn't remove diagnostics for this document.
        this.dummyFilePath = path.join(dir, `${NotebookConcatPrefix}${uuid().replace(/-/g, '')}.py`);
        this.dummyUri = Uri.file(this.dummyFilePath);
        this.concatDocument = notebookApi.createConcatTextDocument(notebook, selector);
        this.onDidChangeSubscription = this.concatDocument.onDidChange(this.onDidChange, this);
    }

    public dispose() {
        this.onDidChangeSubscription.dispose();
    }

    public isCellOfDocument(uri: Uri) {
        return this.concatDocument.contains(uri);
    }
    public save(): Thenable<boolean> {
        // Not used
        throw new Error('Not implemented');
    }
    public lineAt(posOrNumber: Position | number) {
        const position = typeof posOrNumber === 'number' ? new Position(posOrNumber, 0) : posOrNumber;

        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this.concatDocument.locationAt(position);

        // Get the cell at this location
        const cell = this.notebook.cells.find((c) => c.uri.toString() === location.uri.toString());
        return cell!.document.lineAt(location.range.start);
    }

    public offsetAt(position: Position) {
        return this.concatDocument.offsetAt(position);
    }

    public positionAt(offset: number) {
        return this.concatDocument.positionAt(offset);
    }

    public getText(range?: Range | undefined) {
        return range ? this.concatDocument.getText(range) : this.concatDocument.getText();
    }

    public getWordRangeAtPosition(position: Position, regexp?: RegExp | undefined) {
        // convert this position into a cell location
        // (we need the translated location, that's why we can't use getCellAtPosition)
        const location = this.concatDocument.locationAt(position);

        // Get the cell at this location
        const cell = this.notebook.cells.find((c) => c.uri.toString() === location.uri.toString());
        return cell!.document.getWordRangeAtPosition(location.range.start, regexp);
    }

    public validateRange(range: Range) {
        return this.concatDocument.validateRange(range);
    }

    public validatePosition(pos: Position) {
        return this.concatDocument.validatePosition(pos);
    }

    public getCellAtPosition(position: Position) {
        const location = this.concatDocument.locationAt(position);
        return this.notebook.cells.find((c) => c.uri === location.uri);
    }

    private onDidChange() {
        this._version += 1;
    }
}
