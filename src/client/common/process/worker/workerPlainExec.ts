// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// !!!! IMPORTANT: DO NOT IMPORT FROM VSCODE MODULE AS IT IS NOT AVAILABLE INSIDE WORKER THREADS !!!!

import { SpawnOptions } from 'child_process';
import { isMainThread, parentPort, workerData } from 'worker_threads';
import { executeWorkerFile } from './main';
import { ExecutionResult } from './types';

import { _workerPlainExecImpl } from './workerRawProcessApis';

export function workerPlainExec(
    file: string,
    args: string[],
    options: SpawnOptions = {},
): Promise<ExecutionResult<string>> {
    return executeWorkerFile(__filename, {
        file,
        args,
        options,
    });
}

if (!isMainThread) {
    _workerPlainExecImpl(workerData.file, workerData.args, workerData.options)
        .then((res) => {
            if (!parentPort) {
                throw new Error('Not in a worker thread');
            }
            parentPort.postMessage({ res });
        })
        .catch((err) => {
            if (!parentPort) {
                throw new Error('Not in a worker thread');
            }
            parentPort.postMessage({ err });
        });
}
