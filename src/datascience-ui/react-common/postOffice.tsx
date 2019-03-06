// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as React from 'react';
import { WebPanelMessage } from '../../client/common/application/types';
import { IHistoryMapping } from '../../client/datascience/historyTypes';

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

interface IPostOfficeProps {
    messageHandlers: IMessageHandler[];
}

// This special function talks to vscode from a web panel
export declare function acquireVsCodeApi(): IVsCodeApi;

export class PostOffice extends React.Component<IPostOfficeProps> {

    private vscodeApi : IVsCodeApi | undefined;
    private registered: boolean = false;

    constructor(props: IPostOfficeProps) {
        super(props);
    }

    public sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) {
        const api = this.acquireApi();
        if (api) {
            api.postMessage({ type: type.toString(), payload });
        }
    }

    public componentDidMount() {
        if (!this.registered) {
            this.registered = true;
            window.addEventListener('message', this.handleMessages);
        }
    }

    public componentWillUnmount() {
        if (this.registered) {
            this.registered = false;
            window.removeEventListener('message', this.handleMessages);
        }
    }

    public render() {
        return null;
    }

    private acquireApi() : IVsCodeApi | undefined {

        // Only do this once as it crashes if we ask more than once
        // tslint:disable-next-line:no-typeof-undefined
        if (!this.vscodeApi && typeof acquireVsCodeApi !== 'undefined') {
            this.vscodeApi = acquireVsCodeApi();
        }

        return this.vscodeApi;
    }

    private handleMessages = async (ev: MessageEvent) => {
        if (this.props) {
            const msg = ev.data as WebPanelMessage;
            if (msg) {
                this.props.messageHandlers.forEach((h : IMessageHandler) => {
                    h.handleMessage(msg.type, msg.payload);
                });
            }
        }
    }
}
