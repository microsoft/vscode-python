// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface IDebugLauncherScriptProvider {
    getLauncherFilePath(): string;
}

export const IProtocolParser = Symbol('IProtocolParser');
export interface IProtocolParser {
    on(event: string | symbol, listener: Function): this;
}
