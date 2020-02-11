// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DebugConfiguration, DebugSession, DebugSessionCustomEvent } from 'vscode';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';

export const IDebugSessionEventHandlers = Symbol('IDebugSessionEventHandlers');
export interface IDebugSessionEventHandlers {
    handleCustomEvent?(e: DebugSessionCustomEvent): Promise<void>;
    handleTerminateEvent?(e: DebugSession): Promise<void>;
}

export type ChildProcessLaunchData = {
    /**
     * The main process (that in turn starts child processes).
     * @type {number}
     */
    rootProcessId: number;
    /**
     * The immediate parent of the current process (identified by `processId`).
     * This could be the same as `parentProcessId`, or something else.
     * @type {number}
     */
    parentProcessId: number;
    /**
     * The process id of the child process launched.
     * @type {number}
     */
    processId: number;
    /**
     * Port on which the child process is listening and waiting for the debugger to attach.
     * @type {number}
     */
    port: number;
    /**
     * The request object sent to the PTVSD by the main process.
     * If main process was launched, then `arguments` would be the launch request arsg,
     * else it would be the attach request args.
     * @type {({
     *         // tslint:disable-next-line:no-banned-terms
     *         arguments: LaunchRequestArguments | AttachRequestArguments;
     *         command: 'attach' | 'request';
     *         seq: number;
     *         type: string;
     *     })}
     */
    rootStartRequest: {
        // tslint:disable-next-line:no-banned-terms
        arguments: LaunchRequestArguments | AttachRequestArguments;
        command: 'attach' | 'request';
        seq: number;
        type: string;
    };
};

export const IChildProcessAttachService = Symbol('IChildProcessAttachService');
export interface IChildProcessAttachService {
    attach(
        data: ChildProcessLaunchData | (AttachRequestArguments & DebugConfiguration),
        parentSession: DebugSession
    ): Promise<void>;
}
