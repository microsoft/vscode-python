// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface IDebugLauncherScriptProvider {
    getLauncherFilePath(): string;
}

export const IProtcolParser = Symbol('IProtcolParser');
export interface IProtcolParser {
    on(event: string | symbol, listener: Function): this;
}
