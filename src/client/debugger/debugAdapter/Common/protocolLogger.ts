// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Readable } from 'stream';
import { Logger } from 'vscode-debugadapter';
import { IProtocolLogger } from '../types';

@injectable()
export class ProtocolLogger implements IProtocolLogger {
    private inputStream?: Readable;
    private outputStream?: Readable;
    private messagesToLog: string[] = [];
    private logger?: Logger.ILogger;
    public dispose() {
        if (this.inputStream) {
            this.inputStream.removeListener('data', this.fromDataCallbackHandler);
            this.outputStream!.removeListener('data', this.toDataCallbackHandler);
            this.messagesToLog = [];
            this.inputStream = undefined;
            this.outputStream = undefined;
        }
    }
    public connect(inputStream: Readable, outputStream: Readable) {
        this.inputStream = inputStream;
        this.outputStream = outputStream;

        inputStream.addListener('data', this.fromDataCallbackHandler);
        outputStream.addListener('data', this.toDataCallbackHandler);
    }
    public setup(logger: Logger.ILogger) {
        this.logger = logger;
        this.logMessages([`Started @ ${new Date().toString()}`]);
        this.logMessages(this.messagesToLog);
        this.messagesToLog = [];
    }
    private fromDataCallbackHandler = (data: string | Buffer) => {
        this.logMessages(['From Client:', (data as Buffer).toString('utf8')]);
    };
    private toDataCallbackHandler = (data: string | Buffer) => {
        this.logMessages(['To Client:', (data as Buffer).toString('utf8')]);
    };
    private logMessages(messages: string[]) {
        if (this.logger) {
            messages.forEach((message) => this.logger!.verbose(`${message}`));
        } else {
            this.messagesToLog.push(...messages);
        }
    }
}
