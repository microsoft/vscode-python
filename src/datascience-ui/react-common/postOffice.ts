// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { WebPanelMessage } from '../../client/common/application/types';

export interface IVsCodeApi {
    // tslint:disable-next-line:no-any
    postMessage(msg: any) : void;
    // tslint:disable-next-line:no-any
    setState(state: any) : void;
    // tslint:disable-next-line:no-any
    getState() : any;
}

export interface IMessageHandler {
    // tslint:disable-next-line:no-any
    handleMessage(type: string, payload?: any) : boolean;
}

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;

// tslint:disable-next-line: no-unnecessary-class
export class PostOffice {

    private static vscodeApi : IVsCodeApi | undefined;
    private static registered: boolean = false;
    private static handlers: IMessageHandler[] = [];

    public static sendMessage<M, T extends keyof M>(type: T, payload?: M[T]) {
        const api = PostOffice.acquireApi();
        if (api) {
            api.postMessage({ type: type.toString(), payload });
        }
    }

    // tslint:disable-next-line:no-any
    public static sendUnsafeMessage(type: string, payload?: any) {
        const api = PostOffice.acquireApi();
        if (api) {
            api.postMessage({ type: type, payload });
        }
    }

    public static addHandler(handler: IMessageHandler) {
        // Acquire here too so that the message handlers are setup during tests.
        PostOffice.acquireApi();
        PostOffice.handlers.push(handler);
    }

    public static removeHandler(handler: IMessageHandler) {
        PostOffice.handlers = PostOffice.handlers.filter(f => f !== handler);
    }

    public static resetApi() {
        // This is necessary so that tests can reset the vscode api for the next test
        // to find.
        PostOffice.vscodeApi = undefined;
        if (PostOffice.registered) {
            PostOffice.registered = false;
            window.removeEventListener('message', PostOffice.handleMessages);
        }
    }

    private static acquireApi() : IVsCodeApi | undefined {
        // Only do this once as it crashes if we ask more than once
        // tslint:disable-next-line:no-typeof-undefined
        if (!PostOffice.vscodeApi && typeof acquireVsCodeApi !== 'undefined') {
            PostOffice.vscodeApi = acquireVsCodeApi();
        }
        if (!PostOffice.registered) {
            PostOffice.registered = true;
            window.addEventListener('message', PostOffice.handleMessages);
        }

        return PostOffice.vscodeApi;
    }

    private static handleMessages = async (ev: MessageEvent) => {
        if (PostOffice.handlers) {
            const msg = ev.data as WebPanelMessage;
            if (msg) {
                PostOffice.handlers.forEach((h : IMessageHandler | null) => {
                    if (h) {
                        h.handleMessage(msg.type, msg.payload);
                    }
                });
            }
        }
    }
}
