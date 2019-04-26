// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { IDisposable } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import {
    HistoryMessages,
    IHistoryMapping,
    IProvideCompletionItemsResponse
} from '../../client/datascience/history/historyTypes';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';

export class CompletionProvider implements monacoEditor.languages.CompletionItemProvider, IDisposable, IMessageHandler {
    public triggerCharacters?: string[] | undefined;
    private currentCompletionItemsRequest: Deferred<monacoEditor.languages.CompletionList> | undefined;
    private currentCompletionDisposable: monacoEditor.IDisposable | undefined;
    private registerDisposable: monacoEditor.IDisposable;
    constructor(private postOffice: PostOffice) {
        // Register a completion provider
        this.registerDisposable = monacoEditor.languages.registerCompletionItemProvider('python', this);
        this.postOffice.addHandler(this);
    }

    public provideCompletionItems(
        _model: monacoEditor.editor.ITextModel,
        position: monacoEditor.Position,
        context: monacoEditor.languages.CompletionContext,
        token: monacoEditor.CancellationToken): monacoEditor.languages.ProviderResult<monacoEditor.languages.CompletionList> {

        // Emit a new request
        const request = createDeferred<monacoEditor.languages.CompletionList>();
        this.registerDisposable = token.onCancellationRequested(() => {
            request.resolve();
        });
        this.currentCompletionItemsRequest = request;
        this.sendMessage(HistoryMessages.ProvideCompletionItemsRequest, { position, context });

        return request.promise;
    }

    public dispose() {
        this.registerDisposable.dispose();
        if (this.currentCompletionDisposable) {
            this.currentCompletionDisposable.dispose();
        }
        this.postOffice.removeHandler(this);
    }

    // tslint:disable-next-line: no-any
    public handleMessage(type: string, payload?: any): boolean {
        switch (type) {
            case HistoryMessages.ProvideCompletionItemsResponse:
                this.handleCompletionResponse(payload);
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
            if (this.currentCompletionItemsRequest && !this.currentCompletionItemsRequest.resolved) {
                this.currentCompletionItemsRequest.resolve(response.list);
            }
        }
    }
    private sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }
}
