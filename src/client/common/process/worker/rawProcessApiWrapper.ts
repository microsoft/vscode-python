// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { SpawnOptions } from 'child_process';
import * as path from 'path';
import { executeWorkerFile } from './main';
import { EnvironmentVariables, ExecutionResult, IDisposable, ShellOptions } from './types';

export function shellExec(
    command: string,
    options: ShellOptions,
    defaultEnv?: EnvironmentVariables,
    disposables?: Set<IDisposable>,
): Promise<ExecutionResult<string>> {
    return executeWorkerFile(path.join(__dirname, 'shellExecWorker.js'), {
        command,
        options,
        defaultEnv,
        disposables,
    });
}

export function plainExec(
    file: string,
    args: string[],
    options: SpawnOptions & { doNotLog?: boolean } = {},
    defaultEnv?: EnvironmentVariables,
    disposables?: Set<IDisposable>,
): Promise<ExecutionResult<string>> {
    return executeWorkerFile(path.join(__dirname, 'plainExecWorker.js'), {
        file,
        args,
        options,
        defaultEnv,
        disposables,
    });
}
