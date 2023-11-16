// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { SpawnOptions } from 'child_process';
import * as path from 'path';
import { IProcessLogger } from '../types';
import { executeWorkerFile } from './main';
import { EnvironmentVariables, ExecutionResult, ShellOptions } from './types';

export function workerShellExec(
    command: string,
    options: ShellOptions,
    processLogger: IProcessLogger,
    defaultEnv?: EnvironmentVariables,
): Promise<ExecutionResult<string>> {
    processLogger.logProcess(command, undefined, options);
    return executeWorkerFile(path.join(__dirname, 'shellExecWorker.js'), {
        command,
        options,
        defaultEnv,
    });
}

export function workerPlainExec(
    file: string,
    args: string[],
    options: SpawnOptions = {},
    processLogger: IProcessLogger,
): Promise<ExecutionResult<string>> {
    processLogger.logProcess(file, args, options);
    return executeWorkerFile(path.join(__dirname, 'plainExecWorker.js'), {
        file,
        args,
        options,
    });
}
