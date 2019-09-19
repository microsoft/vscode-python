// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { injectable, unmanaged } from 'inversify';
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

import { HiddenFileFormatString } from '../../../../client/constants';
import { IWorkspaceService } from '../../../common/application/types';
import { CancellationError } from '../../../common/cancellation';
import { traceWarning } from '../../../common/logger';
import { IFileSystem, TemporaryFile } from '../../../common/platform/types';
import { createDeferred, Deferred, waitForPromise } from '../../../common/utils/async';
import { concatMultilineString } from '../../common';
import { Identifiers, Settings } from '../../constants';
import {
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterExecution,
    INotebook
} from '../../types';
import {
    IAddCell,
    ICancelIntellisenseRequest,
    IEditCell,
    IInteractiveWindowMapping,
    ILoadAllCells,
    INotebookIdentity,
    InteractiveWindowMessages,
    IProvideCompletionItemsRequest,
    IProvideHoverRequest,
    IProvideSignatureHelpRequest,
    IRemoveCell
} from '../interactiveWindowTypes';
import { convertStringsToSuggestions } from './conversion';
import { IntellisenseDocument } from './intellisenseDocument';

// tslint:disable:no-any
@injectable()
export abstract class BaseIntellisenseProvider implements IInteractiveWindowListener {

    private documentPromise: Deferred<IntellisenseDocument> | undefined;
    private temporaryFile: TemporaryFile | undefined;
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    private cancellationSources: Map<string, CancellationTokenSource> = new Map<string, CancellationTokenSource>();
    private notebookIdentity: Uri | undefined;

    constructor(
        @unmanaged() private workspaceService: IWorkspaceService,
        @unmanaged() private fileSystem: IFileSystem,
        @unmanaged() private jupyterExecution: IJupyterExecution,
        @unmanaged() private interactiveWindowProvider: IInteractiveWindowProvider
    ) {
    }

    public dispose() {
        if (this.temporaryFile) {
            this.temporaryFile.dispose();
        }
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any) {
        switch (message) {
            case InteractiveWindowMessages.CancelCompletionItemsRequest:
            case InteractiveWindowMessages.CancelHoverRequest:
                if (this.isActive) {
                    this.dispatchMessage(message, payload, this.handleCancel);
                }
                break;

            case InteractiveWindowMessages.ProvideCompletionItemsRequest:
                if (this.isActive) {
                    this.dispatchMessage(message, payload, this.handleCompletionItemsRequest);
                }
                break;

            case InteractiveWindowMessages.ProvideHoverRequest:
                if (this.isActive) {
                    this.dispatchMessage(message, payload, this.handleHoverRequest);
                }
                break;

            case InteractiveWindowMessages.ProvideSignatureHelpRequest:
                if (this.isActive) {
                    this.dispatchMessage(message, payload, this.handleSignatureHelpRequest);
                }
                break;

            case InteractiveWindowMessages.EditCell:
                this.dispatchMessage(message, payload, this.editCell);
                break;

            case InteractiveWindowMessages.AddCell:
                this.dispatchMessage(message, payload, this.addCell);
                break;

            case InteractiveWindowMessages.RemoveCell:
                this.dispatchMessage(message, payload, this.removeCell);
                break;

            case InteractiveWindowMessages.DeleteAllCells:
                this.dispatchMessage(message, payload, this.removeAllCells);
                break;

            case InteractiveWindowMessages.RestartKernel:
                this.dispatchMessage(message, payload, this.restartKernel);
                break;

            case InteractiveWindowMessages.NotebookIdentity:
                this.dispatchMessage(message, payload, this.setIdentity);
                break;

            case InteractiveWindowMessages.LoadAllCellsComplete:
                this.dispatchMessage(message, payload, this.loadAllCells);
                break;

            default:
                break;
        }
    }

    protected getDocument(resource?: Uri): Promise<IntellisenseDocument> {
        if (!this.documentPromise) {
            this.documentPromise = createDeferred<IntellisenseDocument>();

            // Create our dummy document. Compute a file path for it.
            if (this.workspaceService.rootPath || resource) {
                const dir = resource ? path.dirname(resource.fsPath) : this.workspaceService.rootPath!;
                const dummyFilePath = path.join(dir, HiddenFileFormatString.format(uuid().replace(/-/g, '')));
                this.documentPromise.resolve(new IntellisenseDocument(dummyFilePath));
            } else {
                this.fileSystem.createTemporaryFile('.py')
                    .then(t => {
                        this.temporaryFile = t;
                        const dummyFilePath = this.temporaryFile.filePath;
                        this.documentPromise!.resolve(new IntellisenseDocument(dummyFilePath));
                    })
                    .catch(e => {
                        this.documentPromise!.reject(e);
                    });
            }
        }

        return this.documentPromise.promise;
    }

    protected abstract get isActive(): boolean;
    protected abstract provideCompletionItems(position: monacoEditor.Position, context: monacoEditor.languages.CompletionContext, cellId: string, token: CancellationToken): Promise<monacoEditor.languages.CompletionList>;
    protected abstract provideHover(position: monacoEditor.Position, cellId: string, token: CancellationToken): Promise<monacoEditor.languages.Hover>;
    protected abstract provideSignatureHelp(position: monacoEditor.Position, context: monacoEditor.languages.SignatureHelpContext, cellId: string, token: CancellationToken): Promise<monacoEditor.languages.SignatureHelp>;
    protected abstract handleChanges(originalFile: string | undefined, document: IntellisenseDocument, changes: TextDocumentContentChangeEvent[]): Promise<void>;

    private dispatchMessage<M extends IInteractiveWindowMapping, T extends keyof M>(_message: T, payload: any, handler: (args: M[T]) => void) {
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

        // Combine all of the results together.
        this.postTimedResponse(
            [this.provideCompletionItems(request.position, request.context, request.cellId, cancelSource.token),
            this.provideJupyterCompletionItems(request.position, request.context, request.cellId, cancelSource.token)],
            InteractiveWindowMessages.ProvideCompletionItemsResponse,
            (c) => {
                const list = this.combineCompletions(c);
                return { list, requestId: request.requestId };
            }
        );
    }

    private handleHoverRequest(request: IProvideHoverRequest) {
        const cancelSource = new CancellationTokenSource();
        this.cancellationSources.set(request.requestId, cancelSource);
        this.postTimedResponse(
            [this.provideHover(request.position, request.cellId, cancelSource.token)],
            InteractiveWindowMessages.ProvideHoverResponse,
            (h) => {
                if (h && h[0]) {
                    return { hover: h[0]!, requestId: request.requestId };
                } else {
                    return { hover: { contents: [] }, requestId: request.requestId };
                }
            });
    }

    private async provideJupyterCompletionItems(position: monacoEditor.Position, _context: monacoEditor.languages.CompletionContext, cellId: string, cancelToken: CancellationToken): Promise<monacoEditor.languages.CompletionList> {
        try {
            const activeNotebook = await this.getNotebook();
            const document = await this.getDocument();
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
                            suggestions: convertStringsToSuggestions(jupyterResults.matches, range, jupyterResults.metadata),
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

    private postTimedResponse<R, M extends IInteractiveWindowMapping, T extends keyof M>(promises: Promise<R>[], message: T, formatResponse: (val: (R | null)[]) => M[T]) {
        // Time all of the promises to make sure they don't take too long
        const timed = promises.map(p => waitForPromise(p, Settings.IntellisenseTimeout));

        // Wait for all of of the timings.
        const all = Promise.all(timed);
        all.then(r => {
            this.postResponse(message, formatResponse(r));
        }).catch(_e => {
            this.postResponse(message, formatResponse([null]));
        });
    }

    private combineCompletions(list: (monacoEditor.languages.CompletionList | null)[]): monacoEditor.languages.CompletionList {
        // Note to self. We're eliminating duplicates ourselves. The alternative would be to
        // have more than one intellisense provider at the monaco editor level and return jupyter
        // results independently. Maybe we switch to this when jupyter resides on the react side.
        const uniqueSuggestions: Map<string, monacoEditor.languages.CompletionItem> = new Map<string, monacoEditor.languages.CompletionItem>();
        list.forEach(c => {
            if (c) {
                c.suggestions.forEach(s => {
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
                    return { signatureHelp: { signatures: [], activeParameter: 0, activeSignature: 0 }, requestId: request.requestId };
                }
            });
    }

    private async addCell(request: IAddCell): Promise<void> {
        // Get the document and then pass onto the sub class
        const document = await this.getDocument(request.file === Identifiers.EmptyFileName ? undefined : Uri.file(request.file));
        if (document) {
            const changes = document.addCell(request.fullText, request.currentText, request.id);
            return this.handleChanges(request.file, document, changes);
        }
    }

    private async editCell(request: IEditCell): Promise<void> {
        // First get the document
        const document = await this.getDocument();
        if (document) {
            const changes = document.edit(request.changes, request.id);
            return this.handleChanges(undefined, document, changes);
        }
    }

    private removeCell(_request: IRemoveCell): Promise<void> {
        // Skip this request. The logic here being that
        // a user can remove a cell from the UI, but it's still loaded into the Jupyter kernel.
        return Promise.resolve();
    }

    private removeAllCells(): Promise<void> {
        // Skip this request. The logic here being that
        // a user can remove a cell from the UI, but it's still loaded into the Jupyter kernel.
        return Promise.resolve();
    }

    private async loadAllCells(payload: ILoadAllCells) {
        const document = await this.getDocument();
        if (document) {
            document.switchToEditMode();
            await Promise.all(payload.cells.map(async cell => {
                if (cell.data.cell_type === 'code') {
                    const text = concatMultilineString(cell.data.source);
                    const addCell: IAddCell = {
                        fullText: text,
                        currentText: text,
                        file: cell.file,
                        id: cell.id
                    };
                    await this.addCell(addCell);
                }
            }));
        }
    }

    private async restartKernel(): Promise<void> {
        // This is the one that acts like a reset
        const document = await this.getDocument();
        if (document) {
            const changes = document.removeAllCells();
            return this.handleChanges(undefined, document, changes);
        }
    }

    private setIdentity(identity: INotebookIdentity) {
        this.notebookIdentity = Uri.parse(identity.resource);
    }

    private async getNotebook(): Promise<INotebook | undefined> {
        // First get the active server
        const activeServer = await this.jupyterExecution.getServer(await this.interactiveWindowProvider.getNotebookOptions());

        // If that works, see if there's a matching notebook running
        if (activeServer && this.notebookIdentity) {
            return activeServer.getNotebook(this.notebookIdentity);
        }

        return undefined;
    }
}
