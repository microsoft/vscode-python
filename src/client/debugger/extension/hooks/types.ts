// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugSession, DebugSessionCustomEvent } from 'vscode';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';

export const IDebugSessionEventHandlers = Symbol('IDebugSessionEventHandlers');
export interface IDebugSessionEventHandlers {
    handleCustomEvent?(e: DebugSessionCustomEvent): Promise<void>;
    handleTerminateEvent?(e: DebugSession): Promise<void>;
}

export type ChildProcessLaunchData = {
    rootProcessId: number;
    initialProcessId: number;
    rootStartRequest: {
        // tslint:disable-next-line:no-banned-terms
        arguments: LaunchRequestArguments | AttachRequestArguments;
        command: 'attach' | 'request';
        seq: number;
        type: string;
    };
    parentProcessId: number;
    processId: number;
    port: number;
};
