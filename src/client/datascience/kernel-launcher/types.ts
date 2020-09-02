// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import type { nbformat } from '@jupyterlab/coreutils';
import { SpawnOptions } from 'child_process';
import { CancellationToken, Event } from 'vscode';
import { InterpreterUri } from '../../common/installer/types';
import { ObservableExecutionResult } from '../../common/process/types';
import { IAsyncDisposable, IDisposable, Resource } from '../../common/types';
import { KernelSpecConnectionMetadata, PythonKernelConnectionMetadata } from '../jupyter/kernels/types';
import { IJupyterKernelSpec } from '../types';

export const IKernelLauncher = Symbol('IKernelLauncher');
export interface IKernelLauncher {
    launch(
        kernelConnectionMetadata: KernelSpecConnectionMetadata | PythonKernelConnectionMetadata,
        resource: Resource,
        workingDirectory: string
    ): Promise<IKernelProcess>;
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
    readonly kernelConnectionMetadata: Readonly<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata>;
    /**
     * This event is triggered if the process is exited
     */
    readonly exited: Event<{ exitCode?: number; reason?: string }>;
    interrupt(): Promise<void>;
}

export const IKernelFinder = Symbol('IKernelFinder');
export interface IKernelFinder {
    findKernelSpec(
        interpreterUri: InterpreterUri,
        kernelSpecMetadata?: nbformat.IKernelspecMetadata,
        cancelToken?: CancellationToken,
        ignoreDependencyCheck?: boolean
    ): Promise<IJupyterKernelSpec | undefined>;
    listKernelSpecs(resource: Resource): Promise<IJupyterKernelSpec[]>;
}

/**
 * The daemon responsible for the Python Kernel.
 */
export interface IPythonKernelDaemon extends IDisposable {
    interrupt(): Promise<void>;
    kill(): Promise<void>;
    preWarm(): Promise<void>;
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
