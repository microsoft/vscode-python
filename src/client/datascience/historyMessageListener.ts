// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { ILiveShareApi, IWebPanelMessageListener } from '../common/application/types';
import { HistoryMessages, LiveShare } from './constants';
import { PostOffice } from './liveshare/postOffice';

// tslint:disable:no-any

// This class listens to messages that come from the local Python Interactive window
export class HistoryMessageListener implements IWebPanelMessageListener {
    private postOffice : PostOffice;
    private disposedCallback : () => void;
    private callback :  (message: string, payload: any) => void;
    private historyMessages : string[] = [];

    constructor(liveShare: ILiveShareApi, callback: (message: string, payload: any) => void, disposed: () => void) {
        this.postOffice = new PostOffice(LiveShare.WebPanelMessageService, liveShare);

        // Save our dispose callback so we remove our history window
        this.disposedCallback = disposed;

        // Save our local callback so we can handle the non broadcast case(s)
        this.callback = callback;

        // Remember the list of history messages we registered for
        this.historyMessages = this.getHistoryMessages();

        // We need to register callbacks for all history messages.
        this.historyMessages.forEach(m => {
            this.postOffice.registerCallback(m, (a) => callback(m, a)).ignoreErrors();
        });
    }

    public async dispose() {
        await this.postOffice.dispose();
        this.disposedCallback();
    }

    public onMessage(message: string, payload: any) {
        // We received a message from the local webview. Broadcast it to everybody if it's a history message
        if (this.historyMessages.indexOf(message) >= 0) {
            this.postOffice.postCommand(message, payload).ignoreErrors();
        } else {
            // Send to just our local callback.
            this.callback(message, payload);
        }
    }

    private getHistoryMessages() : string [] {
        return Object.keys(HistoryMessages).map(k => (HistoryMessages as any)[k].toString());
    }
}
