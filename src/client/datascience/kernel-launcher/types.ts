// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { IDisposable } from 'monaco-editor';
import { InterpreterUri } from '../../common/installer/types';
import { IJupyterKernelSpec } from '../types';

export const IKernelLauncher = Symbol('IKernelLauncher');
export interface IKernelLauncher {
    launch(interpreterUri: InterpreterUri, kernelName: string): Promise<IKernelProcess>;
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

export const IKernelProcess = Symbol('IKernelProcess');

export interface IKernelProcess extends IDisposable {
    process: ChildProcess | undefined;
    connection: IKernelConnection | undefined;
    dispose(): void;
    launch(interpreter: InterpreterUri, kernelSpec: IJupyterKernelSpec): Promise<void>;
}

export const IKernelFinder = Symbol('IKernelFinder');
export interface IKernelFinder {
    findKernelSpec(interpreterUri: InterpreterUri, kernelName?: string): Promise<IJupyterKernelSpec>;
}
