// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Socket } from 'net';
import { Readable } from 'stream';
import { Message } from 'vscode-debugadapter/lib/messages';

export interface IDebugLauncherScriptProvider {
    getLauncherFilePath(): string;
}

export const IProtocolParser = Symbol('IProtocolParser');
export interface IProtocolParser {
    connect(stream: Readable): void;
    once(event: string | symbol, listener: Function): this;
    on(event: string | symbol, listener: Function): this;
}

export const IProtocolLogger = Symbol('IProtocolLogger');
export interface IProtocolLogger {
    connect(inputStream: Readable, outputStream: Readable): void;
    logToFile(file: string): void;
    disable(): void;
}

export const IDebugStreamProvider = Symbol('IDebugStreamProvider');
export interface IDebugStreamProvider {
    readonly useDebugSocketStream: boolean;
    getInputAndOutputStreams(): Promise<{ input: NodeJS.ReadStream | Socket; output: NodeJS.WriteStream | Socket }>;
}

export const IProtocolMessageWriter = Symbol('IProtocolMessageWriter');
export interface IProtocolMessageWriter {
    write(stream: Socket | NodeJS.WriteStream, message: Message): void;
}
