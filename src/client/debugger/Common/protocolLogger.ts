// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Readable, Transform } from 'stream';
import { Logger } from 'vscode-debugadapter';
import { IProtocolLogger } from '../types';

@injectable()
export class ProtocolLogger implements IProtocolLogger {
    private readonly inLoggerStream: Transform;
    private readonly outLoggerStream: Transform;
    private inputStream?: Readable;
    private outputStream?: Readable;
    private messagesToLog: string[] = [];
    private logger?: Logger.ILogger;
    constructor() {
        this.inLoggerStream = new Transform({
            transform: (chunk, encoding, callback) => {
                this.logMessages(['\nFrom Client:', chunk.toString()]);
                callback(null, chunk);
            }
        });
        this.outLoggerStream = new Transform({
            transform: (chunk, encoding, callback) => {
                this.logMessages(['\nTo Client:', chunk.toString()]);
                callback(null, chunk);
            }
        });

    }
    public dispose() {
        if (this.inputStream) {
            this.inputStream!.unpipe(this.inLoggerStream);
            this.outputStream!.unpipe(this.outLoggerStream);
            this.messagesToLog = [];
            this.inputStream = undefined;
            this.outputStream = undefined;
        }
    }
    public connect(inputStream: Readable, outputStream: Readable) {
        this.inputStream = inputStream;
        this.outputStream = outputStream;

        inputStream.pipe(this.inLoggerStream);
        outputStream.pipe(this.outLoggerStream);
    }
    public setup(logger: Logger.ILogger) {
        this.logger = logger;
        this.logMessages([`Started @ ${new Date().toString()}`]);
        this.logMessages(this.messagesToLog);
        this.messagesToLog = [];
    }
    private logMessages(messages: string[]) {
        if (this.logger) {
            messages.forEach(message => this.logger!.verbose(`${message}`));
        } else {
            this.messagesToLog.push(...messages);
        }
    }
}
