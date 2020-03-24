// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { InterpreterUri } from '../../common/installer/types';
import { IDisposable } from '../../common/types';
import { PythonInterpreter } from '../../interpreter/contracts';
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

export interface IKernelProcess extends IDisposable {
    process: ChildProcess;
    connection: IKernelConnection;
}

export interface IKernelFinder {
    findKernelSpec(
        kernelName: string,
        interpreterPaths: string[],
        currentInterpreter: PythonInterpreter | undefined
    ): Promise<IJupyterKernelSpec | undefined>;
    getKernelSpec(path: string, kernelName: string): Promise<IJupyterKernelSpec | undefined>;
}
