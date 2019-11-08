// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { MessageConnection } from 'vscode-jsonrpc';
import { PythonDaemonExecutionService } from '../common/process/pythonDaemon';
import { IPythonExecutionService, SpawnOptions } from '../common/process/types';

export class JupyterDaemonExecutionService extends PythonDaemonExecutionService {
    constructor(pythonExecutionService: IPythonExecutionService, pythonPath: string, daemonProc: ChildProcess, connection: MessageConnection) {
        super(pythonExecutionService, pythonPath, daemonProc, connection);
    }
    protected canExecModuleUsingDaemon(moduleName: string, args: string[], options: SpawnOptions): boolean {
        if (
            moduleName === 'notebook' ||
            (moduleName === 'jupyter' && args[0] === 'notebook') ||
            (moduleName === 'jupyter' && args.join(',') === 'kernelspec,list') ||
            (moduleName === 'jupyter' && args.join(',') === 'kernelspec,--version')
        ) {
            return this.areOptionsSupported(options);
        } else {
            return false;
        }
    }
}
