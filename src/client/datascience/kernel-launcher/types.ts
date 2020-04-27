// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IDisposable } from 'monaco-editor';
import { CancellationToken, Event } from 'vscode';
import { InterpreterUri } from '../../common/installer/types';
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

export interface IKernelProcess extends IDisposable {
    readonly connection: Readonly<IKernelConnection>;
    ready: Promise<void>;
    readonly kernelSpec: Readonly<IJupyterKernelSpec>;
    exited: Event<number | null>;
    dispose(): void;
}

export const IKernelFinder = Symbol('IKernelFinder');
export interface IKernelFinder {
    findKernelSpec(
        interpreterUri: InterpreterUri,
        kernelName?: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec>;
}
