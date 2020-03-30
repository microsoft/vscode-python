// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { noop } from '../../core';
import { IWebServer } from './webBrowserPanel';

// tslint:disable: no-any

export type RequestFromUI = {
    type: 'fromUI';
    payload: any;
};

export type MessageForUI = {
    type: 'forUI';
    payload: any;
};
function getOnigasmContents(): Buffer | undefined {
    // Look for the file next or our current file (this is where it's installed in the vsix)
    const filePath = path.join(EXTENSION_ROOT_DIR, 'node_modules', 'onigasm', 'lib', 'onigasm.wasm');
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
    }
    return undefined;
}

export class TestRecorder {
    private readonly originalPostMessage: (message: {}) => void;
    private messages: (RequestFromUI | MessageForUI)[] = [];
    constructor(
        private readonly webServer: IWebServer,
        public readonly mode: 'record' | 'replay' | 'skip',
        private readonly file: string
    ) {
        this.originalPostMessage = this.webServer.postMessage.bind(this.webServer);
        if (mode === 'skip') {
            return;
        }
        this.initialize();
    }
    public async end() {
        if (this.mode !== 'record') {
            return;
        }
        const messages = JSON.stringify(this.messages, undefined, 4);
        await fs.writeFile(this.file, messages, {
            encoding: 'utf8'
        });
    }
    private initialize() {
        const disposable = this.webServer.onDidReceiveMessage(this.onDidReceiveMessage, this);
        const oldDispose = this.webServer.dispose.bind(this.webServer);

        this.webServer.dispose = () => {
            disposable.dispose();
            oldDispose();
        };
        if (this.mode === 'record') {
            this.webServer.postMessage = this.postMessage.bind(this);
        } else {
            // Rehydrate messages to be played back.
            this.messages = JSON.parse(fs.readFileSync(this.file, { encoding: 'utf8' })) as any;
            // Don't allow anything to interfere with communication with UI (test recorder will do everything).
            this.webServer.postMessage = noop as any;
        }
    }

    private onDidReceiveMessage(message: any) {
        if (this.mode === 'record') {
            this.messages.push({ payload: message, type: 'fromUI' });
        } else {
            // Find the message from the recorded list.
            const index = this.messages.findIndex(item => {
                if (item.type === 'fromUI' && item.payload.type === message.type) {
                    return true;
                }
                return false;
            });
            this.messages.splice(index, 1);
            this.sendMessageToUIUntilNextUIRequest();
        }
    }
    private sendMessageToUIUntilNextUIRequest() {
        // Now send all messages till the next request.
        const nextRequestIndex = this.messages.findIndex(item => item.type === 'fromUI');
        if (nextRequestIndex === 0 || this.messages.length === 0) {
            return;
        }
        // Send messages one at a time, with an artifical delay (mimic realworld).
        const messagesToSend = this.messages.shift()!;
        if (
            messagesToSend.type === 'forUI' &&
            messagesToSend.payload.type === InteractiveWindowMessages.LoadOnigasmAssemblyResponse
        ) {
            messagesToSend.payload.payload = getOnigasmContents();
        }
        this.originalPostMessage(messagesToSend.payload);
        setTimeout(this.sendMessageToUIUntilNextUIRequest.bind(this), 1);
    }
    private postMessage(message: any): void {
        const messageToLog = { ...message };
        if (messageToLog.type === InteractiveWindowMessages.LoadOnigasmAssemblyResponse) {
            messageToLog.payload = '<BLAH>';
        }
        this.messages.push({ payload: messageToLog, type: 'forUI' });
        // When recording, add a delay of 500ms, so we can record the messages and get the order right.
        setTimeout(() => {
            this.originalPostMessage(message);
        }, 500);
    }
}
