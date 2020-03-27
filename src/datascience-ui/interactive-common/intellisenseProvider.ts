// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as uuid from 'uuid/v4';

import { IDisposable } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { Identifiers } from '../../client/datascience/constants';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages,
    IProvideCompletionItemsResponse,
    IProvideHoverResponse,
    IProvideSignatureHelpResponse,
    IResolveCompletionItemResponse
} from '../../client/datascience/interactive-common/interactiveWindowTypes';

interface IRequestData<T> {
    promise: Deferred<T>;
    cancelDisposable: monacoEditor.IDisposable;
}

export class IntellisenseProvider
    implements
        monacoEditor.languages.CompletionItemProvider,
        monacoEditor.languages.HoverProvider,
        monacoEditor.languages.SignatureHelpProvider,
        IDisposable {
    public triggerCharacters?: string[] | undefined = ['.'];
    public readonly signatureHelpTriggerCharacters?: ReadonlyArray<string> = ['(', ',', '<'];
    public readonly signatureHelpRetriggerCharacters?: ReadonlyArray<string> = [')'];
    private completionRequests: Map<string, IRequestData<monacoEditor.languages.CompletionList>> = new Map<
        string,
        IRequestData<monacoEditor.languages.CompletionList>
    >();
    private resolveCompletionRequests: Map<string, IRequestData<monacoEditor.languages.CompletionItem>> = new Map<
        string,
        IRequestData<monacoEditor.languages.CompletionItem>
    >();
    private hoverRequests: Map<string, IRequestData<monacoEditor.languages.Hover>> = new Map<
        string,
        IRequestData<monacoEditor.languages.Hover>
    >();
    private signatureHelpRequests: Map<string, IRequestData<monacoEditor.languages.SignatureHelpResult>> = new Map<
        string,
        IRequestData<monacoEditor.languages.SignatureHelpResult>
    >();
    private registerDisposables: monacoEditor.IDisposable[] = [];
    private monacoIdToCellId: Map<string, string> = new Map<string, string>();
    private cellIdToMonacoId: Map<string, string> = new Map<string, string>();
    private disposed = false;
    constructor(
        private messageSender: <M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]) => void
    ) {
        // Register a completion provider
        this.registerDisposables.push(monacoEditor.languages.registerCompletionItemProvider('python', this));
        this.registerDisposables.push(monacoEditor.languages.registerHoverProvider('python', this));
        this.registerDisposables.push(monacoEditor.languages.registerSignatureHelpProvider('python', this));
    }

    public provideCompletionItems(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        context: monacoEditor.languages.CompletionContext,
        token: monacoEditor.CancellationToken
    ): monacoEditor.languages.ProviderResult<monacoEditor.languages.CompletionList> {
        // Emit a new request
        const requestId = uuid();
        const promise = createDeferred<monacoEditor.languages.CompletionList>();

        const cancelDisposable = token.onCancellationRequested(() => {
            promise.resolve();
            this.sendMessage(InteractiveWindowMessages.CancelCompletionItemsRequest, { requestId });
        });

        this.completionRequests.set(requestId, { promise, cancelDisposable });
        this.sendMessage(InteractiveWindowMessages.ProvideCompletionItemsRequest, {
            position,
            context,
            requestId,
            cellId: this.getCellId(model.id)
        });

        return promise.promise;
    }

    public async resolveCompletionItem(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        item: monacoEditor.languages.CompletionItem,
        token: monacoEditor.CancellationToken
    ): Promise<monacoEditor.languages.CompletionItem> {
        // If the item has already resolved documentation (as with MS LS) we don't need to do this
        if (!item.documentation) {
            // Emit a new request
            const requestId = uuid();
            const promise = createDeferred<monacoEditor.languages.CompletionItem>();

            const cancelDisposable = token.onCancellationRequested(() => {
                promise.resolve();
                this.sendMessage(InteractiveWindowMessages.CancelResolveCompletionItemRequest, { requestId });
            });

            this.resolveCompletionRequests.set(requestId, { promise, cancelDisposable });
            this.sendMessage(InteractiveWindowMessages.ResolveCompletionItemRequest, {
                position,
                item,
                requestId,
                cellId: this.getCellId(model.id)
            });

            const newItem = await promise.promise;
            // Our code strips out _documentPosition and possibly other items that are too large to send
            // so instead of returning the new resolve completion item, just return the old item with documentation added in
            // which is what we are resolving the item to get
            return Promise.resolve({ ...item, documentation: newItem.documentation });
        } else {
            return Promise.resolve(item);
        }
    }

    public provideHover(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        token: monacoEditor.CancellationToken
    ): monacoEditor.languages.ProviderResult<monacoEditor.languages.Hover> {
        // Emit a new request
        const requestId = uuid();
        const promise = createDeferred<monacoEditor.languages.Hover>();

        const cancelDisposable = token.onCancellationRequested(() => {
            promise.resolve();
            this.sendMessage(InteractiveWindowMessages.CancelCompletionItemsRequest, { requestId });
        });

        this.hoverRequests.set(requestId, { promise, cancelDisposable });
        this.sendMessage(InteractiveWindowMessages.ProvideHoverRequest, {
            position,
            requestId,
            cellId: this.getCellId(model.id)
        });

        return promise.promise;
    }

    public provideSignatureHelp(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        token: monacoEditor.CancellationToken,
        context: monacoEditor.languages.SignatureHelpContext
    ): monacoEditor.languages.ProviderResult<monacoEditor.languages.SignatureHelpResult> {
        // Emit a new request
        const requestId = uuid();
        const promise = createDeferred<monacoEditor.languages.SignatureHelpResult>();

        const cancelDisposable = token.onCancellationRequested(() => {
            promise.resolve();
            this.sendMessage(InteractiveWindowMessages.CancelSignatureHelpRequest, { requestId });
        });

        this.signatureHelpRequests.set(requestId, { promise, cancelDisposable });
        this.sendMessage(InteractiveWindowMessages.ProvideSignatureHelpRequest, {
            position,
            context,
            requestId,
            cellId: this.getCellId(model.id)
        });

        return promise.promise;
    }

    public dispose() {
        this.disposed = true;
        this.registerDisposables.forEach((r) => r.dispose());
        this.completionRequests.forEach((r) => r.promise.resolve());
        this.resolveCompletionRequests.forEach((r) => r.promise.resolve());
        this.hoverRequests.forEach((r) => r.promise.resolve());

        this.registerDisposables = [];
        this.completionRequests.clear();
        this.hoverRequests.clear();
    }

    public mapCellIdToModelId(cellId: string, modelId: string) {
        this.cellIdToMonacoId.set(cellId, modelId);
        this.monacoIdToCellId.set(modelId, cellId);
    }

    // Handle completion response
    public handleCompletionResponse(response: IProvideCompletionItemsResponse) {
        // Resolve our waiting promise if we have one
        const waiting = this.completionRequests.get(response.requestId);
        if (waiting) {
            waiting.promise.resolve(response.list);
            this.completionRequests.delete(response.requestId);
        }
    }

    // Handle hover response
    public handleHoverResponse(response: IProvideHoverResponse) {
        // Resolve our waiting promise if we have one
        const waiting = this.hoverRequests.get(response.requestId);
        if (waiting) {
            waiting.promise.resolve(response.hover);
            this.hoverRequests.delete(response.requestId);
        }
    }

    // Handle signature response
    public handleSignatureHelpResponse(response: IProvideSignatureHelpResponse) {
        // Resolve our waiting promise if we have one
        const waiting = this.signatureHelpRequests.get(response.requestId);
        if (waiting) {
            waiting.promise.resolve({
                value: response.signatureHelp,
                dispose: noop
            });
            this.signatureHelpRequests.delete(response.requestId);
        }
    }

    public handleResolveCompletionItemResponse(response: IResolveCompletionItemResponse) {
        // Resolve our waiting promise if we have one
        const waiting = this.resolveCompletionRequests.get(response.requestId);
        if (waiting) {
            waiting.promise.resolve(response.item);
            this.completionRequests.delete(response.requestId);
        }
    }

    private getCellId(monacoId: string): string {
        const result = this.monacoIdToCellId.get(monacoId);
        if (result) {
            return result;
        }

        // Just assume it's the edit cell if not found.
        return Identifiers.EditCellId;
    }

    private sendMessage<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]): void {
        if (!this.disposed) {
            this.messageSender(type, payload);
        }
    }
}
