// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Readable, Transform } from 'stream';
import { IFileSystem } from '../../common/platform/types';
import { IServiceContainer } from '../../ioc/types';
import { IProtocolLogger } from '../types';

@injectable()
export class ProtocolLogger implements IProtocolLogger {
    private readonly inLoggerStream: Transform;
    private readonly outLoggerStream: Transform;
    private inputStream: Readable;
    private outputStream: Readable;
    private messagesToLog: string[] = [];
    private logFile?: string;
    private disabled: boolean;
    private readonly fileSystem: IFileSystem;
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
        this.inLoggerStream = new Transform({
            transform: (chunk, encoding, callback) => {
                this.logMessages(['From Client:', chunk.toString()]);
                callback(null, chunk);
            }
        });
        this.outLoggerStream = new Transform({
            transform: (chunk, encoding, callback) => {
                this.logMessages(['To Client:', chunk.toString()]);
                callback(null, chunk);
            }
        });

    }
    public connect(inputStream: Readable, outputStream: Readable) {
        this.inputStream = inputStream;
        this.outputStream = outputStream;

        inputStream.pipe(this.inLoggerStream);
        outputStream.pipe(this.outLoggerStream);
    }
    public logToFile(file: string) {
        if (this.disabled) {
            throw new Error('Logging has been disabled');
        }
        this.logFile = file;
        if (this.logFile) {
            this.logMessages([`Started @ ${new Date().toString()}`]);
            this.logMessages(this.messagesToLog);
            this.messagesToLog = [];
        }
    }
    public disable() {
        this.inputStream.unpipe(this.inLoggerStream);
        this.outputStream.unpipe(this.outLoggerStream);
        this.messagesToLog = [];
        this.disabled = true;
    }
    private logMessages(messages: string[]) {
        if (typeof this.logFile === 'string' && this.logFile.length > 0) {
            messages.forEach(message => this.fileSystem.appendFileSync(this.logFile!, `${message}\n`));
        } else {
            this.messagesToLog.push(...messages);
        }
    }
}
