// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Readable } from 'stream';

export interface IDebugLauncherScriptProvider {
    getLauncherFilePath(): string;
}

export const IProtocolParser = Symbol('IProtocolParser');
export interface IProtocolParser {
    connect(stream: Readable): void;
    on(event: string | symbol, listener: Function): this;
}

export const IProtocolLogger = Symbol('IProtocolLogger');
export interface IProtocolLogger {
    connect(inputStream: Readable, outputStream: Readable): void;
    logToFile(file: string): void;
    disable(): void;
}
