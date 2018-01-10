// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const ITerminalService = Symbol('ITerminalService');

export interface ITerminalService {
    sendCommand(command: string, args: string[]): Promise<void>;
}
