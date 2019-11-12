// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Socket } from 'net';
import { Readable } from 'stream';
import { Disposable } from 'vscode';
import { Logger } from 'vscode-debugadapter';
import { Message } from 'vscode-debugadapter/lib/messages';

export type LocalDebugOptions = { port: number; host: string; customDebugger?: boolean };
export type RemoteDebugOptions = LocalDebugOptions & { waitUntilDebuggerAttaches: boolean };

export interface IDebugLauncherScriptProvider<T> {
    getLauncherArgs(options: T): string[];
}

export interface ILocalDebugLauncherScriptProvider extends IDebugLauncherScriptProvider<LocalDebugOptions> {
    getLauncherArgs(options: LocalDebugOptions): string[];
}

export interface IRemoteDebugLauncherScriptProvider extends IDebugLauncherScriptProvider<RemoteDebugOptions> {}

export const IProtocolParser = Symbol('IProtocolParser');
export interface IProtocolParser extends Disposable {
    connect(stream: Readable): void;
    once(event: string | symbol, listener: Function): this;
    on(event: string | symbol, listener: Function): this;
}

export const IProtocolLogger = Symbol('IProtocolLogger');
export interface IProtocolLogger extends Disposable {
    connect(inputStream: Readable, outputStream: Readable): void;
    setup(logger: Logger.ILogger): void;
}

export const IDebugStreamProvider = Symbol('IDebugStreamProvider');
export interface IDebugStreamProvider extends Disposable {
    readonly useDebugSocketStream: boolean;
    getInputAndOutputStreams(): Promise<{ input: NodeJS.ReadStream | Socket; output: NodeJS.WriteStream | Socket }>;
}

export const IProtocolMessageWriter = Symbol('IProtocolMessageWriter');
export interface IProtocolMessageWriter {
    write(stream: Socket | NodeJS.WriteStream, message: Message): void;
}
