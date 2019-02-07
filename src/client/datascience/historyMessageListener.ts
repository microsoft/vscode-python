// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { IWebPanelMessageListener } from '../common/application/types';
import { HistoryMessages, LiveShare } from './constants';
import { PostOffice } from './liveshare/postOffice';

// This class listens to messages that come from the local Python Interactive window
export class HistoryMessageListener implements IWebPanelMessageListener {
    private postOffice : PostOffice = new PostOffice(LiveShare.WebPanelMessageService);
    private disposedCallback : () => void;

    constructor(callback: (message: string, payload: any) => void, disposed: () => void) {
        // Save our dispose callback so we remove our history window
        this.disposedCallback = disposed;

        // We need to register callbacks for all history messages.
        Object.keys(HistoryMessages).forEach(k => this.postOffice.registerCallback(HistoryMessages[k], (a : any) => callback(HistoryMessages[k], a)));
    }

    public dispose() {
        this.postOffice.dispose();
        this.disposedCallback();
    }

    public onMessage(message: string, payload: any) {
        // We received a message from the local webview. Broadcast it to everybody
        this.postOffice.postCommand(message, payload).ignoreErrors();
    }
}
