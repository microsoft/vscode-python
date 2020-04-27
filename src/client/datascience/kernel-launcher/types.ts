// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { SpawnOptions } from 'child_process';
import { CancellationToken, Event } from 'vscode';
import { InterpreterUri } from '../../common/installer/types';
import { ObservableExecutionResult } from '../../common/process/types';
import { IAsyncDisposable, IDisposable } from '../../common/types';
import { IJupyterKernelSpec } from '../types';

export const IKernelLauncher = Symbol('IKernelLauncher');
export interface IKernelLauncher {
    launch(kernelSpec: IJupyterKernelSpec): Promise<IKernelProcess>;
}

export interface IKernelConnection {
    version: number;
    iopub_port: number;
    shell_port: number;
    stdin_port: number;
    control_port: number;
    signature_scheme: 'hmac-sha256';
    hb_port: number;
    ip: string;
    key: string;
    transport: 'tcp' | 'ipc';
}

export interface IKernelProcess extends IAsyncDisposable {
    readonly connection: Readonly<IKernelConnection>;
    /**
     * This promise is resolved when the launched process is ready to get JMP messages
     */
    readonly ready: Promise<void>;
    readonly kernelSpec: Readonly<IJupyterKernelSpec>;
    /**
     * This event is triggered if the process is exited
     */
    readonly exited: Event<number | null>;
    interrupt(): Promise<void>;
}

export const IKernelFinder = Symbol('IKernelFinder');
export interface IKernelFinder {
    findKernelSpec(
        interpreterUri: InterpreterUri,
        kernelName?: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec>;
}

/**
 * The daemon responsbile for the Python Kernel.
 */
export interface IPythonKernelDaemon extends IDisposable {
    interrupt(): Promise<void>;
    kill(): Promise<void>;
    start(moduleName: string, args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>>;
}

export class PythonKernelDiedError extends Error {
    public readonly exitCode: number;
    public readonly reason?: string;
    constructor(options: { exitCode: number; reason?: string } | { error: Error }) {
        const message =
            'exitCode' in options
                ? `Kernel died with exit code ${options.exitCode}. ${options.reason}`
                : `Kernel died ${options.error.message}`;
        super(message);
        if ('exitCode' in options) {
            this.exitCode = options.exitCode;
            this.reason = options.reason;
        } else {
            this.exitCode = -1;
            this.reason = options.error.message;
            this.stack = options.error.stack;
            this.name = options.error.name;
        }
    }
}
