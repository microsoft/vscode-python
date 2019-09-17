// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as uuid from 'uuid/v4';
import { IDisposable } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages,
    IProvideCompletionItemsResponse,
    IProvideHoverResponse,
    IProvideSignatureHelpResponse
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';

interface IRequestData<T> {
    promise: Deferred<T>;
    cancelDisposable: monacoEditor.IDisposable;
}

export class IntellisenseProvider implements monacoEditor.languages.CompletionItemProvider, monacoEditor.languages.HoverProvider, monacoEditor.languages.SignatureHelpProvider, IDisposable, IMessageHandler {
    public triggerCharacters?: string[] | undefined = ['.'];
    public readonly signatureHelpTriggerCharacters?: ReadonlyArray<string> = ['(', ',', '<'];
    public readonly signatureHelpRetriggerCharacters?: ReadonlyArray<string> = [')'];
    private completionRequests: Map<string, IRequestData<monacoEditor.languages.CompletionList>> = new Map<string, IRequestData<monacoEditor.languages.CompletionList>>();
    private hoverRequests: Map<string, IRequestData<monacoEditor.languages.Hover>> = new Map<string, IRequestData<monacoEditor.languages.Hover>>();
    private signatureHelpRequests: Map<string, IRequestData<monacoEditor.languages.SignatureHelp>> = new Map<string, IRequestData<monacoEditor.languages.SignatureHelp>>();
    private registerDisposables: monacoEditor.IDisposable[] = [];
    constructor(private postOffice: PostOffice, private getCellId: (modelId: string) => string) {
        // Register a completion provider
        this.registerDisposables.push(monacoEditor.languages.registerCompletionItemProvider('python', this));
        this.registerDisposables.push(monacoEditor.languages.registerHoverProvider('python', this));
        this.registerDisposables.push(monacoEditor.languages.registerSignatureHelpProvider('python', this));
        this.postOffice.addHandler(this);
    }

    public provideCompletionItems(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        context: monacoEditor.languages.CompletionContext,
        token: monacoEditor.CancellationToken): monacoEditor.languages.ProviderResult<monacoEditor.languages.CompletionList> {

        // Emit a new request
        const requestId = uuid();
        const promise = createDeferred<monacoEditor.languages.CompletionList>();

        const cancelDisposable = token.onCancellationRequested(() => {
            promise.resolve();
            this.sendMessage(InteractiveWindowMessages.CancelCompletionItemsRequest, { requestId });
        });

        this.completionRequests.set(requestId, { promise, cancelDisposable });
        this.sendMessage(InteractiveWindowMessages.ProvideCompletionItemsRequest, { position, context, requestId, cellId: this.getCellId(model.id) });

        return promise.promise;
    }

    public provideHover(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        token: monacoEditor.CancellationToken): monacoEditor.languages.ProviderResult<monacoEditor.languages.Hover> {
        // Emit a new request
        const requestId = uuid();
        const promise = createDeferred<monacoEditor.languages.Hover>();

        const cancelDisposable = token.onCancellationRequested(() => {
            promise.resolve();
            this.sendMessage(InteractiveWindowMessages.CancelCompletionItemsRequest, { requestId });
        });

        this.hoverRequests.set(requestId, { promise, cancelDisposable });
        this.sendMessage(InteractiveWindowMessages.ProvideHoverRequest, { position, requestId, cellId: this.getCellId(model.id) });

        return promise.promise;
    }

    public provideSignatureHelp(
        model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        token: monacoEditor.CancellationToken,
        context: monacoEditor.languages.SignatureHelpContext): monacoEditor.languages.ProviderResult<monacoEditor.languages.SignatureHelp> {
        // Emit a new request
        const requestId = uuid();
        const promise = createDeferred<monacoEditor.languages.SignatureHelp>();

        const cancelDisposable = token.onCancellationRequested(() => {
            promise.resolve();
            this.sendMessage(InteractiveWindowMessages.CancelSignatureHelpRequest, { requestId });
        });

        this.signatureHelpRequests.set(requestId, { promise, cancelDisposable });
        this.sendMessage(InteractiveWindowMessages.ProvideSignatureHelpRequest, { position, context, requestId, cellId: this.getCellId(model.id) });

        return promise.promise;
    }

    public dispose() {
        this.registerDisposables.forEach(r => r.dispose());
        this.completionRequests.forEach(r => r.promise.resolve());
        this.hoverRequests.forEach(r => r.promise.resolve());

        this.registerDisposables = [];
        this.completionRequests.clear();
        this.hoverRequests.clear();

        this.postOffice.removeHandler(this);
    }

    // tslint:disable-next-line: no-any
    public handleMessage(type: string, payload?: any): boolean {
        switch (type) {
            case InteractiveWindowMessages.ProvideCompletionItemsResponse:
                this.handleCompletionResponse(payload);
                return true;

            case InteractiveWindowMessages.ProvideHoverResponse:
                this.handleHoverResponse(payload);
                return true;

            case InteractiveWindowMessages.ProvideSignatureHelpResponse:
                this.handleSignatureHelpResponse(payload);
                return true;

            default:
                break;
        }

        return false;
    }

    // Handle completion response
    // tslint:disable-next-line:no-any
    private handleCompletionResponse = (payload?: any) => {
        if (payload) {
            const response = payload as IProvideCompletionItemsResponse;

            // Resolve our waiting promise if we have one
            const waiting = this.completionRequests.get(response.requestId);
            if (waiting) {
                waiting.promise.resolve(response.list);
                this.completionRequests.delete(response.requestId);
            }
        }
    }
    // Handle hover response
    // tslint:disable-next-line:no-any
    private handleHoverResponse = (payload?: any) => {
        if (payload) {
            const response = payload as IProvideHoverResponse;

            // Resolve our waiting promise if we have one
            const waiting = this.hoverRequests.get(response.requestId);
            if (waiting) {
                waiting.promise.resolve(response.hover);
                this.hoverRequests.delete(response.requestId);
            }
        }
    }

    // Handle hover response
    // tslint:disable-next-line:no-any
    private handleSignatureHelpResponse = (payload?: any) => {
        if (payload) {
            const response = payload as IProvideSignatureHelpResponse;

            // Resolve our waiting promise if we have one
            const waiting = this.signatureHelpRequests.get(response.requestId);
            if (waiting) {
                waiting.promise.resolve(response.signatureHelp);
                this.signatureHelpRequests.delete(response.requestId);
            }
        }
    }

    private sendMessage<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }
}
