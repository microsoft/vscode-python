// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { WebPanelMessage } from '../../client/common/application/types';
import { IDisposable } from '../../client/common/types';
import { logMessage } from './logger';

export interface IVsCodeApi {
    // tslint:disable-next-line:no-any
    postMessage(msg: any): void;
    // tslint:disable-next-line:no-any
    setState(state: any): void;
    // tslint:disable-next-line:no-any
    getState(): any;
}

export interface IMessageHandler {
    // tslint:disable-next-line:no-any
    handleMessage(type: string, payload?: any): boolean;
    dispose?(): void;
}

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;

// tslint:disable-next-line: no-unnecessary-class
export class PostOffice implements IDisposable {
    private registered: boolean = false;
    private vscodeApi: IVsCodeApi | undefined;
    private handlers: IMessageHandler[] = [];
    private baseHandler = this.handleMessages.bind(this);

    public dispose() {
        if (this.registered) {
            this.registered = false;
            window.removeEventListener('message', this.baseHandler);
        }
    }

    public sendMessage<M, T extends keyof M = keyof M>(type: T, payload?: M[T]) {
        return this.sendUnsafeMessage(type.toString(), payload);
    }

    // tslint:disable-next-line:no-any
    public sendUnsafeMessage(type: string, payload?: any) {
        const api = this.acquireApi();
        if (api) {
            logMessage(`Posting message ${type} to extension.`);
            api.postMessage({ type: type, payload });
        } else {
            logMessage(`No vscode API to post message ${type}`);
        }
    }

    public addHandler(handler: IMessageHandler) {
        // Acquire here too so that the message handlers are setup during tests.
        this.acquireApi();
        this.handlers.push(handler);
    }

    public removeHandler(handler: IMessageHandler) {
        this.handlers = this.handlers.filter(f => f !== handler);
    }

    private acquireApi(): IVsCodeApi | undefined {
        // Only do this once as it crashes if we ask more than once
        // tslint:disable-next-line:no-typeof-undefined
        if (!this.vscodeApi && typeof acquireVsCodeApi !== 'undefined') {
            this.vscodeApi = acquireVsCodeApi(); // NOSONAR
        }
        if (!this.registered) {
            // rewireConsole = true;
            this.registered = true;
            window.addEventListener('message', this.baseHandler);
        }

        return this.vscodeApi;
    }

    private async handleMessages(ev: MessageEvent) {
        if (this.handlers) {
            const msg = ev.data as WebPanelMessage;
            if (msg) {
                this.handlers.forEach((h: IMessageHandler | null) => {
                    if (h) {
                        h.handleMessage(msg.type, msg.payload);
                    }
                });
            }
        }
    }
}
