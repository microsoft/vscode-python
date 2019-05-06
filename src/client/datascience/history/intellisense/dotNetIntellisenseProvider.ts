// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { inject, injectable } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    CancellationToken,
    CancellationTokenSource,
    Event,
    EventEmitter,
    TextDocumentContentChangeEvent,
    Uri
} from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

import { ILanguageServer, ILanguageServerAnalysisOptions } from '../../../activation/types';
import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem, TemporaryFile } from '../../../common/platform/types';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { Identifiers } from '../../constants';
import { IHistoryListener } from '../../types';
import {
    HistoryMessages,
    IAddCell,
    ICancelIntellisenseRequest,
    IEditCell,
    IHistoryMapping,
    IProvideCompletionItemsRequest,
    IProvideHoverRequest
} from '.././historyTypes';
import { convertToMonacoCompletionList, convertToMonacoHover } from './conversion';
import { IntellisenseDocument } from './intellisenseDocument';

// tslint:disable:no-any
@injectable()
export class DotNetIntellisenseProvider implements IHistoryListener {

    private languageClientPromise : Deferred<vscodeLanguageClient.LanguageClient> | undefined;
    private document: IntellisenseDocument | undefined;
    private temporaryFile: TemporaryFile | undefined;
    private sentOpenDocument : boolean = false;
    private postEmitter: EventEmitter<{message: string; payload: any}> = new EventEmitter<{message: string; payload: any}>();
    private cancellationSources : Map<string, CancellationTokenSource> = new Map<string, CancellationTokenSource>();
    private active: boolean = false;

    constructor(
        @inject(ILanguageServer) private languageServer: ILanguageServer,
        @inject(ILanguageServerAnalysisOptions) private readonly analysisOptions: ILanguageServerAnalysisOptions,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        // Make sure we're active. We still listen to messages for adding and editing cells,
        // but we don't actually return any data.
        this.active = !this.configService.getSettings().jediEnabled;

        // Listen for updates to settings to change this flag. Don't bother disposing the config watcher. It lives
        // till the extension dies anyway.
        this.configService.getSettings().onDidChange(() => this.active = !this.configService.getSettings().jediEnabled);
    }

    public dispose() {
        if (this.temporaryFile) {
            this.temporaryFile.dispose();
        }

        // Actually don't dispose here. The extension does this elsewhere.
        // this.languageServer.dispose();
    }

    public get postMessage(): Event<{message: string; payload: any}> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any) {
        switch (message) {
            case HistoryMessages.CancelCompletionItemsRequest:
            case HistoryMessages.CancelHoverRequest:
                if (this.active) {
                    this.dispatchMessage(message, payload, this.handleCancel);
                }
                break;

            case HistoryMessages.ProvideCompletionItemsRequest:
                if (this.active) {
                    this.dispatchMessage(message, payload, this.handleCompletionItemsRequest);
                }
                break;

            case HistoryMessages.ProvideHoverRequest:
                if (this.active) {
                    this.dispatchMessage(message, payload, this.handleHoverRequest);
                }
                break;

            case HistoryMessages.EditCell:
                this.dispatchMessage(message, payload, this.editCell);
                break;

            case HistoryMessages.AddCell: // Might want to rethink this. Seems weird.
                this.dispatchMessage(message, payload, this.addCell);
                break;

            default:
                break;
        }
    }

    private dispatchMessage<M extends IHistoryMapping, T extends keyof M>(_message: T, payload: any, handler: (args : M[T]) => void) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    private postResponse<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) : void {
        const response = payload as any;
        if (response && response.id) {
            const cancelSource = this.cancellationSources.get(response.id);
            if (cancelSource) {
                cancelSource.dispose();
                this.cancellationSources.delete(response.id);
            }
        }
        this.postEmitter.fire({message: type.toString(), payload});
    }

    private handleCancel(request: ICancelIntellisenseRequest) {
        const cancelSource = this.cancellationSources.get(request.requestId);
        if (cancelSource) {
            cancelSource.cancel();
            cancelSource.dispose();
            this.cancellationSources.delete(request.requestId);
        }
    }

    private handleCompletionItemsRequest(request: IProvideCompletionItemsRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.provideCompletionItems(request.position, request.context, request.cellId, cancelSource.token).then(list => {
             this.postResponse(HistoryMessages.ProvideCompletionItemsResponse, {list, requestId: request.requestId});
        }).catch(_e => {
            this.postResponse(HistoryMessages.ProvideCompletionItemsResponse, {list: { suggestions: [], incomplete: true }, requestId: request.requestId});
        });
    }

    private handleHoverRequest(request: IProvideHoverRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.provideHover(request.position, request.cellId, cancelSource.token).then(hover => {
             this.postResponse(HistoryMessages.ProvideHoverResponse, {hover, requestId: request.requestId});
        }).catch(_e => {
            this.postResponse(HistoryMessages.ProvideHoverResponse, {hover: { contents: [] }, requestId: request.requestId});
        });
    }

    private getLanguageClient(file?: Uri) : Promise<vscodeLanguageClient.LanguageClient> {
        if (!this.languageClientPromise) {
            this.languageClientPromise = createDeferred<vscodeLanguageClient.LanguageClient>();
            this.startup(file)
                .then(() => {
                    this.languageClientPromise!.resolve(this.languageServer.languageClient);
                })
                .catch((e: any) => {
                    this.languageClientPromise!.reject(e);
                });
        }
        return this.languageClientPromise.promise;
    }

    private async getDocument(resource?: Uri) : Promise<IntellisenseDocument> {
        if (!this.document) {
            // Create our dummy document. Compute a file path for it.
            let dummyFilePath = '';
            if (this.workspaceService.rootPath || resource) {
                const dir = resource ? path.dirname(resource.fsPath) : this.workspaceService.rootPath!;
                dummyFilePath = path.join(dir, `History_${uuid().replace(/-/g, '')}.py`);
            } else {
                this.temporaryFile = await this.fileSystem.createTemporaryFile('.py');
                dummyFilePath = this.temporaryFile.filePath;
            }
            this.document = new IntellisenseDocument(dummyFilePath);
        }

        return this.document;
    }
    private async startup(resource?: Uri) : Promise<void> {
        // Start up the language server. We'll use this to talk to the language server
        const options = await this.analysisOptions!.getAnalysisOptions();
        await this.languageServer.start(resource, options);
    }

    private async provideCompletionItems(position: monacoEditor.Position, context: monacoEditor.languages.CompletionContext, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.CompletionList> {
        const languageClient = await this.getLanguageClient();
        if (languageClient && this.document) {
            const docPos = this.document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.CompletionRequest.type,
                languageClient.code2ProtocolConverter.asCompletionParams(this.document, docPos, context),
                token);
            return convertToMonacoCompletionList(result);
        }

        return {
            suggestions: [],
            incomplete: true
        };
    }
    private async provideHover(position: monacoEditor.Position, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.Hover> {
        const languageClient = await this.getLanguageClient();
        if (languageClient && this.document) {
            const docPos = this.document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.HoverRequest.type,
                languageClient.code2ProtocolConverter.asTextDocumentPositionParams(this.document, docPos),
                token);
            return convertToMonacoHover(result);
        }

        return {
            contents: []
        };
    }
    private async addCell(request: IAddCell): Promise<void> {
        // First get the document
        const document = await this.getDocument(request.file === Identifiers.EmptyFileName ? undefined : Uri.file(request.file));
        let changes: TextDocumentContentChangeEvent[] = [];
        if (document) {
            changes = document.addCell(request.text, request.id);
        }

        // Then see if we can talk to our language client
        if (this.active && document) {

            // Broadcast an update to the language server
            const languageClient = await this.getLanguageClient(request.file === Identifiers.EmptyFileName ? undefined : Uri.file(request.file));

            if (!this.sentOpenDocument) {
                this.sentOpenDocument = true;
                return languageClient.sendNotification(vscodeLanguageClient.DidOpenTextDocumentNotification.type, { textDocument: document.textDocumentItem });
            } else {
                return languageClient.sendNotification(vscodeLanguageClient.DidChangeTextDocumentNotification.type, { textDocument: document.textDocumentId, contentChanges: changes });
            }
        }
    }
    private async editCell(request: IEditCell): Promise<void> {
        // First get the document
        const document = await this.getDocument();

        let changes: TextDocumentContentChangeEvent[] = [];
        if (this.document) {
            changes = this.document.edit(request.changes, request.id);
        }

        // Then see if we can talk to our language client
        if (this.active && document) {

            // Broadcast an update to the language server
            const languageClient = await this.getLanguageClient();

            if (!this.sentOpenDocument) {
                this.sentOpenDocument = true;
                return languageClient.sendNotification(vscodeLanguageClient.DidOpenTextDocumentNotification.type, { textDocument: document.textDocumentItem });
            } else {
                return languageClient.sendNotification(vscodeLanguageClient.DidChangeTextDocumentNotification.type, { textDocument: document.textDocumentId, contentChanges: changes });
            }
        }
    }

}
