// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionList,
    CompletionTriggerKind,
    EndOfLine,
    Position,
    Range,
    TextDocument,
    TextLine,
    Uri,
    TextDocumentContentChangeEvent
} from 'vscode';
import { CompletionRequest, LanguageClient, DidOpenTextDocumentNotification, TextDocumentItem, DidChangeTextDocumentNotification, VersionedTextDocumentIdentifier } from 'vscode-languageclient';

import { ILanguageServer, ILanguageServerAnalysisOptions } from '../../activation/types';
import { IWorkspaceService } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IHistoryCompletionProvider } from '../types';

class HistoryLine implements TextLine {

    private _range : Range;
    private _rangeWithLineBreak: Range;
    private _firstNonWhitespaceIndex : number | undefined;
    private _isEmpty : boolean | undefined;

    constructor(private _contents: string, private _line: number) {
        this._range = new Range(new Position(_line, 0), new Position(_line, _contents.length));
        this._rangeWithLineBreak = new Range(this.range.start, new Position(_line, _contents.length + 1));
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

class HistoryDocument implements TextDocument {

    private _uri : Uri;
    private _version : number = 0;
    private _lines: TextLine[] = [];
    private _cells: string = '';
    private _editOffset: number = 0;

    constructor(fileName: string) {
        // The file passed in is the base Uri for where we're basing this
        // document.
        //
        // What about liveshare?
        this._uri = Uri.file(fileName);
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
    public offsetAt(_position: Position): number {
        throw new Error('Method not implemented.');
    }
    public positionAt(_offset: number): Position {
        throw new Error('Method not implemented.');
    }
    public getText(_range?: Range | undefined): string {
        if (!_range) {
            return this.getText(new Range(new Position(0, 0), new Position(this._lines.length, this._lines[this._lines.length-1])))
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

    public get textDocumentItem() : TextDocumentItem {
        return {
            uri : this.fileName,
            languageId: this.languageId,
            version: this.version,
            text: this.getText()
        };
    }

    public get textDocumentId() : VersionedTextDocumentIdentifier {
        return {
            uri: this.fileName,
            version: this.version
        };
    }
    public addLines(code: string): TextDocumentContentChangeEvent[] {
        this._lines.splice(this._editOffset);
        const lastIndex = this._lines.length;
        this._lines.concat(code.splitLines({trim: false, removeEmptyEntries: false}).map((c, i) => this.createTextLine(c, i + lastIndex)));
        this._editOffset = this._lines.length;
    }

    public editLines(from: Position, to: Position, newCode: string, removedCode?: string): TextDocumentContentChangeEvent[] {
        const replacedRange = new Range(new Position(this._editOffset, 0))
        this._lines.splice(this._editOffset);
        this._lines.concat(newCode.splitLines({trim: false, removeEmptyEntries: false}).map((c, i) => this.createTextLine(c, i + this._editOffset)));

    }

    private createTextLine(line: string, index: number) : TextLine {
        return new HistoryLine(line, index);
    }
}


@injectable()
export class CompletionProvider implements IHistoryCompletionProvider {

    private languageClient : LanguageClient | undefined;
    private document: HistoryDocument | undefined;
    private temporaryFile: TemporaryFile | undefined;
    private sentOpenDocument : boolean = false;

    constructor(
        @inject(ILanguageServer) private languageServer: ILanguageServer,
        @inject(ILanguageServerAnalysisOptions) private readonly analysisOptions: ILanguageServerAnalysisOptions,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
    }

    public dispose() {
        this.languageServer.dispose();
    }

    public async startup(resource?: Uri) : Promise<void> {
        // Save our language client. We'll use this to talk to the language server
        const options = await this.analysisOptions!.getAnalysisOptions();
        await this.languageServer.start(resource, options);
        this.languageClient = this.languageServer.languageClient;

        // Create our dummy document. Compute a file path for it.
        let dummyFilePath = '';
        if (this.workspaceService.rootPath || resource) {
            const dir = resource ? path.dirname(resource.fsPath) : this.workspaceService.rootPath!;
            dummyFilePath = path.join(dir, `History_${uuid().replace('-', '')}`);
        } else {
            this.temporaryFile = await this.fileSystem.createTemporaryFile('.py');
            dummyFilePath = this.temporaryFile.filePath;
        }
        this.document = new HistoryDocument(dummyFilePath);
    }

    public async provideCompletionItems(line: number, ch: number, cancellationToken: CancellationToken) : Promise<CompletionItem[]> {
        if (this.languageClient && this.document) {
            const position = new Position(line, ch); // Need to add on last line here
            const context: CompletionContext = {
                triggerKind: CompletionTriggerKind.TriggerCharacter
            };
            const result = await this.languageClient.sendRequest(
                CompletionRequest.type,
                this.languageClient.code2ProtocolConverter.asCompletionParams(this.document, position, context),
                cancellationToken) as CompletionList;
            return result ? result.items : [];
        }

        return [];
    }
    public async addCell(code: string): Promise<void> {
        let changes: TextDocumentContentChangeEvent[] = [];
        if (this.document) {
            changes = this.document.addLines(code);
        }

        // Broadcast an update to the language server
        if (this.languageClient && this.document) {
            if (!this.sentOpenDocument) {
                this.sentOpenDocument = true;
                return this.languageClient.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: this.document.textDocumentItem });
            } else {
                return this.languageClient.sendNotification(DidChangeTextDocumentNotification.type, { textDocument: this.document.textDocumentId, contentChanges: changes });
            }
        }
    }
    public async editCell(from: Position, to: Position, newCode: string, removedCode?: string): Promise<void> {
        let changes: TextDocumentContentChangeEvent[] = [];
        if (this.document) {
            changes = this.document.editLines(from, to, newCode, removedCode);
        }

        // Broadcast an update to the language server
        if (this.languageClient && this.document) {
            if (!this.sentOpenDocument) {
                this.sentOpenDocument = true;
                return this.languageClient.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: this.document.textDocumentItem });
            } else {
                return this.languageClient.sendNotification(DidChangeTextDocumentNotification.type, { textDocument: this.document.textDocumentId, contentChanges: changes });
            }
        }
    }
}
