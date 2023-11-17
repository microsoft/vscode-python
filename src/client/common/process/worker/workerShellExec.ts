// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// !!!! IMPORTANT: DO NOT IMPORT FROM VSCODE MODULE AS IT IS NOT AVAILABLE INSIDE WORKER THREADS !!!!

import { isMainThread, parentPort, workerData } from 'worker_threads';
import { executeWorkerFile } from './main';
import { ExecutionResult, ShellOptions } from './types';
import { _workerShellExecImpl } from './workerRawProcessApis';

export function workerShellExec(command: string, options: ShellOptions): Promise<ExecutionResult<string>> {
    return executeWorkerFile(__filename, {
        command,
        options,
    });
}

if (!isMainThread) {
    _workerShellExecImpl(workerData.command, workerData.options, workerData.defaultEnv)
        .then((res) => {
            if (!parentPort) {
                throw new Error('Not in a worker thread');
            }
            parentPort.postMessage({ res });
        })
        .catch((ex) => {
            if (!parentPort) {
                throw new Error('Not in a worker thread');
            }
            parentPort.postMessage({ ex });
        });
}
