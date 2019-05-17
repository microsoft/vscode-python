// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { inject, injectable } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { CancellationToken, TextDocumentContentChangeEvent, Uri } from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

import { ILanguageServer, ILanguageServerAnalysisOptions } from '../../../activation/types';
import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { Identifiers } from '../../constants';
import { IHistoryListener, IHistoryProvider, IJupyterExecution } from '../../types';
import { BaseIntellisenseProvider } from './baseIntellisenseProvider';
import { convertToMonacoCompletionList, convertToMonacoHover, convertToMonacoSignatureHelp } from './conversion';
import { IntellisenseDocument } from './intellisenseDocument';

// tslint:disable:no-any
@injectable()
export class DotNetIntellisenseProvider extends BaseIntellisenseProvider implements IHistoryListener {

    private languageClientPromise : Deferred<vscodeLanguageClient.LanguageClient> | undefined;
    private sentOpenDocument : boolean = false;
    private active: boolean = false;

    constructor(
        @inject(ILanguageServer) private languageServer: ILanguageServer,
        @inject(ILanguageServerAnalysisOptions) private readonly analysisOptions: ILanguageServerAnalysisOptions,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IHistoryProvider) historyProvider: IHistoryProvider
    ) {
        super(workspaceService, fileSystem, jupyterExecution, historyProvider);

        // Make sure we're active. We still listen to messages for adding and editing cells,
        // but we don't actually return any data.
        this.active = !this.configService.getSettings().jediEnabled;

        // Listen for updates to settings to change this flag. Don't bother disposing the config watcher. It lives
        // till the extension dies anyway.
        this.configService.getSettings().onDidChange(() => this.active = !this.configService.getSettings().jediEnabled);
    }

    protected get isActive() : boolean {
        return this.active;
    }

    protected async provideCompletionItems(position: monacoEditor.Position, context: monacoEditor.languages.CompletionContext, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.CompletionList> {
        const languageClient = await this.getLanguageClient();
        const document = await this.getDocument();
        if (languageClient && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.CompletionRequest.type,
                languageClient.code2ProtocolConverter.asCompletionParams(document, docPos, context),
                token);
            return convertToMonacoCompletionList(result, true);
        }

        return {
            suggestions: [],
            incomplete: false
        };
    }
    protected async provideHover(position: monacoEditor.Position, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.Hover> {
        const languageClient = await this.getLanguageClient();
        const document = await this.getDocument();
        if (languageClient && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.HoverRequest.type,
                languageClient.code2ProtocolConverter.asTextDocumentPositionParams(document, docPos),
                token);
            return convertToMonacoHover(result);
        }

        return {
            contents: []
        };
    }
    protected async provideSignatureHelp(position: monacoEditor.Position, _context: monacoEditor.languages.SignatureHelpContext, cellId: string, token: CancellationToken) : Promise<monacoEditor.languages.SignatureHelp> {
        const languageClient = await this.getLanguageClient();
        const document = await this.getDocument();
        if (languageClient && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageClient.sendRequest(
                vscodeLanguageClient.SignatureHelpRequest.type,
                languageClient.code2ProtocolConverter.asTextDocumentPositionParams(document, docPos),
                token);
            return convertToMonacoSignatureHelp(result);
        }

        return {
            signatures: [],
            activeParameter: 0,
            activeSignature: 0
        };
    }

    protected async handleChanges(originalFile: string | undefined, document: IntellisenseDocument, changes: TextDocumentContentChangeEvent[]) : Promise<void> {
        // Then see if we can talk to our language client
        if (this.active && document) {

            // Cache our document state as it may change after we get our language client. Async call may allow a change to
            // come in before we send the first doc open.
            const docItem = document.textDocumentItem;
            const docItemId = document.textDocumentId;

            // Broadcast an update to the language server
            const languageClient = await this.getLanguageClient(originalFile === Identifiers.EmptyFileName || originalFile === undefined ? undefined : Uri.file(originalFile));

            if (!this.sentOpenDocument) {
                this.sentOpenDocument = true;
                return languageClient.sendNotification(vscodeLanguageClient.DidOpenTextDocumentNotification.type, { textDocument: docItem });
            } else {
                return languageClient.sendNotification(vscodeLanguageClient.DidChangeTextDocumentNotification.type, { textDocument: docItemId, contentChanges: changes });
            }
        }
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

    private async startup(resource?: Uri) : Promise<void> {
        // Start up the language server. We'll use this to talk to the language server
        const options = await this.analysisOptions!.getAnalysisOptions();
        await this.languageServer.start(resource, options);
    }
}
