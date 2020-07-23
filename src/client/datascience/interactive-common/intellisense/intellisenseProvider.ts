// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { inject, injectable, named } from 'inversify';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    CancellationTokenSource,
    CompletionItem,
    Event,
    EventEmitter,
    Hover,
    SignatureHelpContext,
    TextDocumentContentChangeEvent,
    Uri
} from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vscodeLanguageClient from 'vscode-languageclient/node';
import { concatMultilineStringInput } from '../../../../datascience-ui/common';
import { ILanguageServer, ILanguageServerCache } from '../../../activation/types';
import { IWorkspaceService } from '../../../common/application/types';
import { CancellationError } from '../../../common/cancellation';
import { traceError, traceWarning } from '../../../common/logger';
import { TemporaryFile } from '../../../common/platform/types';
import { Resource } from '../../../common/types';
import { createDeferred, Deferred, sleep, waitForPromise } from '../../../common/utils/async';
import { noop } from '../../../common/utils/misc';
import { HiddenFileFormatString } from '../../../constants';
import { IInterpreterService } from '../../../interpreter/contracts';
import { PythonInterpreter } from '../../../pythonEnvironments/info';
import { sendTelemetryWhenDone } from '../../../telemetry';
import { Identifiers, Settings, Telemetry } from '../../constants';
import {
    ICell,
    IDataScienceFileSystem,
    IInteractiveWindowListener,
    IJupyterVariables,
    INotebook,
    INotebookCompletion,
    INotebookProvider
} from '../../types';
import {
    ICancelIntellisenseRequest,
    IInteractiveWindowMapping,
    ILoadAllCells,
    INotebookIdentity,
    InteractiveWindowMessages,
    IProvideCompletionItemsRequest,
    IProvideHoverRequest,
    IProvideSignatureHelpRequest,
    IResolveCompletionItemRequest,
    NotebookModelChange
} from '../interactiveWindowTypes';
import {
    convertStringsToSuggestions,
    convertToMonacoCompletionItem,
    convertToMonacoCompletionList,
    convertToMonacoHover,
    convertToMonacoSignatureHelp,
    convertToVSCodeCompletionItem
} from './conversion';
import { IntellisenseDocument } from './intellisenseDocument';

// tslint:disable:no-any
@injectable()
export class IntellisenseProvider implements IInteractiveWindowListener {
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }
    private documentPromise: Deferred<IntellisenseDocument> | undefined;
    private temporaryFile: TemporaryFile | undefined;
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    private cancellationSources: Map<string, CancellationTokenSource> = new Map<string, CancellationTokenSource>();
    private notebookIdentity: Uri | undefined;
    private notebookType: 'interactive' | 'native' = 'interactive';
    private potentialResource: Uri | undefined;
    private sentOpenDocument: boolean = false;
    private languageServer: ILanguageServer | undefined;
    private resource: Resource;
    private interpreter: PythonInterpreter | undefined;

    constructor(
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IDataScienceFileSystem) private fs: IDataScienceFileSystem,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(ILanguageServerCache) private languageServerCache: ILanguageServerCache,
        @inject(IJupyterVariables) @named(Identifiers.ALL_VARIABLES) private variableProvider: IJupyterVariables
    ) {}

    public dispose() {
        if (this.temporaryFile) {
            this.temporaryFile.dispose();
        }
        if (this.languageServer) {
            this.languageServer.dispose();
            this.languageServer = undefined;
        }
    }

    public onMessage(message: string, payload?: any) {
        switch (message) {
            case InteractiveWindowMessages.CancelCompletionItemsRequest:
            case InteractiveWindowMessages.CancelHoverRequest:
                this.dispatchMessage(message, payload, this.handleCancel);
                break;

            case InteractiveWindowMessages.ProvideCompletionItemsRequest:
                this.dispatchMessage(message, payload, this.handleCompletionItemsRequest);
                break;

            case InteractiveWindowMessages.ProvideHoverRequest:
                this.dispatchMessage(message, payload, this.handleHoverRequest);
                break;

            case InteractiveWindowMessages.ProvideSignatureHelpRequest:
                this.dispatchMessage(message, payload, this.handleSignatureHelpRequest);
                break;

            case InteractiveWindowMessages.ResolveCompletionItemRequest:
                this.dispatchMessage(message, payload, this.handleResolveCompletionItemRequest);
                break;

            case InteractiveWindowMessages.UpdateModel:
                this.dispatchMessage(message, payload, this.update);
                break;

            case InteractiveWindowMessages.RestartKernel:
                this.dispatchMessage(message, payload, this.restartKernel);
                break;

            case InteractiveWindowMessages.NotebookIdentity:
                this.dispatchMessage(message, payload, this.setIdentity);
                break;

            case InteractiveWindowMessages.NotebookExecutionActivated:
                this.dispatchMessage(message, payload, this.updateIdentity);
                break;

            case InteractiveWindowMessages.LoadAllCellsComplete:
                this.dispatchMessage(message, payload, this.loadAllCells);
                break;

            default:
                break;
        }
    }

    public getDocument(resource?: Uri): Promise<IntellisenseDocument> {
        if (!this.documentPromise) {
            this.documentPromise = createDeferred<IntellisenseDocument>();

            // Create our dummy document. Compute a file path for it.
            if (this.workspaceService.rootPath || resource) {
                const dir = resource ? path.dirname(resource.fsPath) : this.workspaceService.rootPath!;
                const dummyFilePath = path.join(dir, HiddenFileFormatString.format(uuid().replace(/-/g, '')));
                this.documentPromise.resolve(new IntellisenseDocument(dummyFilePath));
            } else {
                this.fs
                    .createTemporaryLocalFile('.py')
                    .then((t) => {
                        this.temporaryFile = t;
                        const dummyFilePath = this.temporaryFile.filePath;
                        this.documentPromise!.resolve(new IntellisenseDocument(dummyFilePath));
                    })
                    .catch((e) => {
                        this.documentPromise!.reject(e);
                    });
            }
        }

        return this.documentPromise.promise;
    }

    protected async getLanguageServer(token: CancellationToken): Promise<ILanguageServer | undefined> {
        // Resource should be our potential resource if its set. Otherwise workspace root
        const resource =
            this.potentialResource ||
            (this.workspaceService.rootPath ? Uri.parse(this.workspaceService.rootPath) : undefined);

        // Interpreter should be the interpreter currently active in the notebook
        const activeNotebook = await this.getNotebook(token);
        const interpreter = activeNotebook
            ? activeNotebook.getMatchingInterpreter()
            : await this.interpreterService.getActiveInterpreter(resource);

        const newPath = resource;
        const oldPath = this.resource;

        // See if the resource or the interpreter are different
        if (
            (newPath && !oldPath) ||
            (newPath && oldPath && !this.fs.arePathsSame(newPath, oldPath)) ||
            interpreter?.path !== this.interpreter?.path ||
            this.languageServer === undefined
        ) {
            this.resource = resource;
            this.interpreter = interpreter;

            // Get an instance of the language server (so we ref count it )
            try {
                const languageServer = await this.languageServerCache.get(resource, interpreter);

                // Dispose of our old language service
                this.languageServer?.dispose();

                // This new language server does not know about our document, so tell it.
                const document = await this.getDocument();
                if (document && languageServer.handleOpen && languageServer.handleChanges) {
                    // If we already sent an open document, that means we need to send both the open and
                    // the new changes
                    if (this.sentOpenDocument) {
                        languageServer.handleOpen(document);
                        languageServer.handleChanges(document, document.getFullContentChanges());
                    } else {
                        this.sentOpenDocument = true;
                        languageServer.handleOpen(document);
                    }
                }

                // Save the ref.
                this.languageServer = languageServer;
            } catch (e) {
                traceError(e);
            }
        }
        return this.languageServer;
    }

    protected async provideCompletionItems(
        position: monacoEditor.Position,
        context: monacoEditor.languages.CompletionContext,
        cellId: string,
        token: CancellationToken
    ): Promise<monacoEditor.languages.CompletionList> {
        const [languageServer, document] = await Promise.all([this.getLanguageServer(token), this.getDocument()]);
        if (languageServer && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageServer.provideCompletionItems(document, docPos, token, context);
            if (result) {
                return convertToMonacoCompletionList(result, true);
            }
        }

        return {
            suggestions: [],
            incomplete: false
        };
    }
    protected async provideHover(
        position: monacoEditor.Position,
        wordAtPosition: string | undefined,
        cellId: string,
        token: CancellationToken
    ): Promise<monacoEditor.languages.Hover> {
        const [languageServer, document, variableHover] = await Promise.all([
            this.getLanguageServer(token),
            this.getDocument(),
            this.getVariableHover(wordAtPosition, token)
        ]);
        if (!variableHover && languageServer && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageServer.provideHover(document, docPos, token);
            if (result) {
                return convertToMonacoHover(result);
            }
        } else if (variableHover) {
            return convertToMonacoHover(variableHover);
        }

        return {
            contents: []
        };
    }
    protected async provideSignatureHelp(
        position: monacoEditor.Position,
        context: monacoEditor.languages.SignatureHelpContext,
        cellId: string,
        token: CancellationToken
    ): Promise<monacoEditor.languages.SignatureHelp> {
        const [languageServer, document] = await Promise.all([this.getLanguageServer(token), this.getDocument()]);
        if (languageServer && document) {
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            const result = await languageServer.provideSignatureHelp(
                document,
                docPos,
                token,
                context as SignatureHelpContext
            );
            if (result) {
                return convertToMonacoSignatureHelp(result);
            }
        }

        return {
            signatures: [],
            activeParameter: 0,
            activeSignature: 0
        };
    }

    protected async resolveCompletionItem(
        position: monacoEditor.Position,
        item: monacoEditor.languages.CompletionItem,
        cellId: string,
        token: CancellationToken
    ): Promise<monacoEditor.languages.CompletionItem> {
        const [languageServer, document] = await Promise.all([this.getLanguageServer(token), this.getDocument()]);
        if (languageServer && languageServer.resolveCompletionItem && document) {
            const vscodeCompItem: CompletionItem = convertToVSCodeCompletionItem(item);

            // Needed by Jedi in completionSource.ts to resolve the item
            const docPos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
            (vscodeCompItem as any)._documentPosition = { document, position: docPos };

            const result = await languageServer.resolveCompletionItem(vscodeCompItem, token);
            if (result) {
                // Convert expects vclc completion item, but takes both vclc and vscode items so just cast here
                return convertToMonacoCompletionItem(result as vscodeLanguageClient.CompletionItem, true);
            }
        }

        // If we can't fill in the extra info, just return the item
        return item;
    }

    protected async handleChanges(
        document: IntellisenseDocument,
        changes: TextDocumentContentChangeEvent[]
    ): Promise<void> {
        // For the dot net language server, we have to send extra data to the language server
        if (document) {
            // Broadcast an update to the language server
            const languageServer = await this.getLanguageServer(CancellationToken.None);
            if (languageServer && languageServer.handleChanges && languageServer.handleOpen) {
                if (!this.sentOpenDocument) {
                    this.sentOpenDocument = true;
                    return languageServer.handleOpen(document);
                } else {
                    return languageServer.handleChanges(document, changes);
                }
            }
        }
    }

    private dispatchMessage<M extends IInteractiveWindowMapping, T extends keyof M>(
        _message: T,
        payload: any,
        handler: (args: M[T]) => void
    ) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    private postResponse<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]): void {
        const response = payload as any;
        if (response && response.id) {
            const cancelSource = this.cancellationSources.get(response.id);
            if (cancelSource) {
                cancelSource.dispose();
                this.cancellationSources.delete(response.id);
            }
        }
        this.postEmitter.fire({ message: type.toString(), payload });
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
        // Create a cancellation source. We'll use this for our sub class request and a jupyter one
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);

        const getCompletions = async (): Promise<monacoEditor.languages.CompletionList> => {
            const emptyList: monacoEditor.languages.CompletionList = {
                dispose: noop,
                incomplete: false,
                suggestions: []
            };

            const lsCompletions = this.provideCompletionItems(
                request.position,
                request.context,
                request.cellId,
                cancelSource.token
            );

            const jupyterCompletions = this.provideJupyterCompletionItems(
                request.position,
                request.context,
                request.cellId,
                cancelSource.token
            );

            // Capture telemetry for each of the two providers.
            // Telemetry will be used to improve how we handle intellisense to improve response times for code completion.
            // NOTE: If this code is around after a few months, telemetry isn't used, or we don't need it anymore.
            // I.e. delete this code.
            sendTelemetryWhenDone(Telemetry.CompletionTimeFromLS, lsCompletions);
            sendTelemetryWhenDone(Telemetry.CompletionTimeFromJupyter, jupyterCompletions);

            return this.combineCompletions(
                await Promise.all([
                    // Ensure we wait for a result from Language Server (assumption is LS is faster).
                    // Telemetry will prove/disprove this assumption and we'll change this code accordingly.
                    lsCompletions,
                    // Wait for a max of n ms before ignoring results from jupyter (jupyter completion is generally slower).
                    Promise.race([jupyterCompletions, sleep(Settings.IntellisenseTimeout).then(() => emptyList)])
                ])
            );
        };

        // Combine all of the results together.
        this.postTimedResponse([getCompletions()], InteractiveWindowMessages.ProvideCompletionItemsResponse, (c) => {
            const list = this.combineCompletions(c);
            return { list, requestId: request.requestId };
        });
    }

    private handleResolveCompletionItemRequest(request: IResolveCompletionItemRequest) {
        // Create a cancellation source. We'll use this for our sub class request and a jupyter one
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);

        // Combine all of the results together.
        this.postTimedResponse(
            [this.resolveCompletionItem(request.position, request.item, request.cellId, cancelSource.token)],
            InteractiveWindowMessages.ResolveCompletionItemResponse,
            (c) => {
                if (c && c[0]) {
                    return { item: c[0], requestId: request.requestId };
                } else {
                    return { item: request.item, requestId: request.requestId };
                }
            }
        );
    }

    private handleHoverRequest(request: IProvideHoverRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.postTimedResponse(
            [this.provideHover(request.position, request.wordAtPosition, request.cellId, cancelSource.token)],
            InteractiveWindowMessages.ProvideHoverResponse,
            (h) => {
                if (h && h[0]) {
                    return { hover: h[0]!, requestId: request.requestId };
                } else {
                    return { hover: { contents: [] }, requestId: request.requestId };
                }
            }
        );
    }

    private async provideJupyterCompletionItems(
        position: monacoEditor.Position,
        _context: monacoEditor.languages.CompletionContext,
        cellId: string,
        cancelToken: CancellationToken
    ): Promise<monacoEditor.languages.CompletionList> {
        try {
            const [activeNotebook, document] = await Promise.all([this.getNotebook(cancelToken), this.getDocument()]);
            if (activeNotebook && document) {
                const data = document.getCellData(cellId);

                if (data) {
                    const lines = data.text.splitLines({ trim: false, removeEmptyEntries: false });
                    const offsetInCode = lines.reduce((a: number, c: string, i: number) => {
                        if (i < position.lineNumber - 1) {
                            return a + c.length + 1;
                        } else if (i === position.lineNumber - 1) {
                            return a + position.column - 1;
                        } else {
                            return a;
                        }
                    }, 0);

                    const jupyterResults = await activeNotebook.getCompletion(data.text, offsetInCode, cancelToken);
                    if (jupyterResults && jupyterResults.matches) {
                        const filteredMatches = this.filterJupyterMatches(document, jupyterResults, cellId, position);

                        const baseOffset = data.offset;
                        const basePosition = document.positionAt(baseOffset);
                        const startPosition = document.positionAt(jupyterResults.cursor.start + baseOffset);
                        const endPosition = document.positionAt(jupyterResults.cursor.end + baseOffset);
                        const range: monacoEditor.IRange = {
                            startLineNumber: startPosition.line + 1 - basePosition.line, // monaco is 1 based
                            startColumn: startPosition.character + 1,
                            endLineNumber: endPosition.line + 1 - basePosition.line,
                            endColumn: endPosition.character + 1
                        };
                        return {
                            suggestions: convertStringsToSuggestions(filteredMatches, range, jupyterResults.metadata),
                            incomplete: false
                        };
                    }
                }
            }
        } catch (e) {
            if (!(e instanceof CancellationError)) {
                traceWarning(e);
            }
        }

        return {
            suggestions: [],
            incomplete: false
        };
    }

    // The suggestions that the kernel is giving always include magic commands. That is confusing to the user.
    // This function is called by provideJupyterCompletionItems to filter those magic commands when not in an empty line of code.
    private filterJupyterMatches(
        document: IntellisenseDocument,
        jupyterResults: INotebookCompletion,
        cellId: string,
        position: monacoEditor.Position
    ) {
        // If the line we're analyzing is empty or a whitespace, we filter out the magic commands
        // as its confusing to see them appear after a . or inside ().
        const pos = document.convertToDocumentPosition(cellId, position.lineNumber, position.column);
        const line = document.lineAt(pos);
        return line.isEmptyOrWhitespace
            ? jupyterResults.matches
            : jupyterResults.matches.filter((match) => !match.startsWith('%'));
    }

    private postTimedResponse<R, M extends IInteractiveWindowMapping, T extends keyof M>(
        promises: Promise<R>[],
        message: T,
        formatResponse: (val: (R | null)[]) => M[T]
    ) {
        // Time all of the promises to make sure they don't take too long.
        // Even if LS or Jupyter doesn't complete within e.g. 30s, then we should return an empty response (no point waiting that long).
        const timed = promises.map((p) => waitForPromise(p, Settings.MaxIntellisenseTimeout));

        // Wait for all of of the timings.
        const all = Promise.all(timed);
        all.then((r) => {
            this.postResponse(message, formatResponse(r));
        }).catch((_e) => {
            this.postResponse(message, formatResponse([null]));
        });
    }

    private combineCompletions(
        list: (monacoEditor.languages.CompletionList | null)[]
    ): monacoEditor.languages.CompletionList {
        // Note to self. We're eliminating duplicates ourselves. The alternative would be to
        // have more than one intellisense provider at the monaco editor level and return jupyter
        // results independently. Maybe we switch to this when jupyter resides on the react side.
        const uniqueSuggestions: Map<string, monacoEditor.languages.CompletionItem> = new Map<
            string,
            monacoEditor.languages.CompletionItem
        >();
        list.forEach((c) => {
            if (c) {
                c.suggestions.forEach((s) => {
                    if (!uniqueSuggestions.has(s.insertText)) {
                        uniqueSuggestions.set(s.insertText, s);
                    }
                });
            }
        });

        return {
            suggestions: Array.from(uniqueSuggestions.values()),
            incomplete: false
        };
    }

    private handleSignatureHelpRequest(request: IProvideSignatureHelpRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.postTimedResponse(
            [this.provideSignatureHelp(request.position, request.context, request.cellId, cancelSource.token)],
            InteractiveWindowMessages.ProvideSignatureHelpResponse,
            (s) => {
                if (s && s[0]) {
                    return { signatureHelp: s[0]!, requestId: request.requestId };
                } else {
                    return {
                        signatureHelp: { signatures: [], activeParameter: 0, activeSignature: 0 },
                        requestId: request.requestId
                    };
                }
            }
        );
    }

    private async update(request: NotebookModelChange): Promise<void> {
        // See where this request is coming from
        switch (request.source) {
            case 'redo':
            case 'user':
                return this.handleRedo(request);
            case 'undo':
                return this.handleUndo(request);
            default:
                break;
        }
    }

    private convertToDocCells(cells: ICell[]): { code: string; id: string }[] {
        return cells
            .filter((c) => c.data.cell_type === 'code')
            .map((c) => {
                return { code: concatMultilineStringInput(c.data.source), id: c.id };
            });
    }

    private async handleUndo(request: NotebookModelChange): Promise<void> {
        const document = await this.getDocument();
        let changes: TextDocumentContentChangeEvent[] = [];
        switch (request.kind) {
            case 'clear':
                // This one can be ignored, it only clears outputs
                break;
            case 'edit':
                changes = document.editCell(request.reverse, request.id);
                break;
            case 'add':
            case 'insert':
                changes = document.remove(request.cell.id);
                break;
            case 'modify':
                // This one can be ignored. it's only used for updating cell finished state.
                break;
            case 'remove':
                changes = document.insertCell(
                    request.cell.id,
                    concatMultilineStringInput(request.cell.data.source),
                    request.index
                );
                break;
            case 'remove_all':
                changes = document.reloadCells(this.convertToDocCells(request.oldCells));
                break;
            case 'swap':
                changes = document.swap(request.secondCellId, request.firstCellId);
                break;
            case 'version':
                // Also ignored. updates version which we don't keep track of.
                break;
            default:
                break;
        }

        return this.handleChanges(document, changes);
    }

    private async handleRedo(request: NotebookModelChange): Promise<void> {
        const document = await this.getDocument();
        let changes: TextDocumentContentChangeEvent[] = [];
        switch (request.kind) {
            case 'clear':
                // This one can be ignored, it only clears outputs
                break;
            case 'edit':
                changes = document.editCell(request.forward, request.id);
                break;
            case 'add':
                changes = document.addCell(request.fullText, request.currentText, request.cell.id);
                break;
            case 'insert':
                changes = document.insertCell(
                    request.cell.id,
                    concatMultilineStringInput(request.cell.data.source),
                    request.codeCellAboveId || request.index
                );
                break;
            case 'modify':
                // This one can be ignored. it's only used for updating cell finished state.
                break;
            case 'remove':
                changes = document.remove(request.cell.id);
                break;
            case 'remove_all':
                changes = document.removeAll();
                break;
            case 'swap':
                changes = document.swap(request.firstCellId, request.secondCellId);
                break;
            case 'version':
                // Also ignored. updates version which we don't keep track of.
                break;
            default:
                break;
        }

        return this.handleChanges(document, changes);
    }

    private async loadAllCells(payload: ILoadAllCells) {
        const document = await this.getDocument();
        if (document) {
            const changes = document.loadAllCells(
                payload.cells
                    .filter((c) => c.data.cell_type === 'code')
                    .map((cell) => {
                        return {
                            code: concatMultilineStringInput(cell.data.source),
                            id: cell.id
                        };
                    }),
                this.notebookType
            );

            await this.handleChanges(document, changes);
        }
    }

    private async restartKernel(): Promise<void> {
        // This is the one that acts like a reset if this is the interactive window
        const document = await this.getDocument();
        if (document && document.isReadOnly) {
            this.sentOpenDocument = false;
            const changes = document.removeAllCells();
            return this.handleChanges(document, changes);
        }
    }

    private setIdentity(identity: INotebookIdentity) {
        this.notebookIdentity = identity.resource;
        this.potentialResource =
            identity.resource.scheme !== Identifiers.HistoryPurpose ? identity.resource : undefined;
        this.notebookType = identity.type;
    }

    private updateIdentity(identity: INotebookIdentity & { owningResource: Resource }) {
        this.potentialResource = identity.owningResource ? identity.owningResource : this.potentialResource;
    }

    private async getNotebook(token: CancellationToken): Promise<INotebook | undefined> {
        return this.notebookIdentity
            ? this.notebookProvider.getOrCreateNotebook({ identity: this.notebookIdentity, getOnly: true, token })
            : undefined;
    }

    private async getVariableHover(
        wordAtPosition: string | undefined,
        token: CancellationToken
    ): Promise<Hover | undefined> {
        if (wordAtPosition) {
            const notebook = await this.getNotebook(token);
            if (notebook) {
                try {
                    const value = await this.variableProvider.getMatchingVariable(notebook, wordAtPosition, token);
                    if (value) {
                        return {
                            contents: [`${wordAtPosition}: ${value.type} = ${value.value}`]
                        };
                    }
                } catch (exc) {
                    traceError(`Exception attempting to retrieve hover for variables`, exc);
                }
            }
        }
    }
}
