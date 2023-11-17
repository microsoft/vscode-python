// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// !!!! IMPORTANT: DO NOT IMPORT FROM VSCODE MODULE AS IT IS NOT AVAILABLE INSIDE WORKER THREADS !!!!

import { Worker } from 'worker_threads';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export async function executeWorkerFile(workerFileName: string, workerData: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerFileName, { workerData });
        worker.on('message', (msg: { err: Error; res: unknown }) => {
            if (msg.err) {
                reject(msg.err);
            }
            resolve(msg.res);
        });
        worker.on('error', (ex: Error) => {
            reject(ex);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker ${workerFileName} stopped with exit code ${code}`));
            }
        });
    });
}
