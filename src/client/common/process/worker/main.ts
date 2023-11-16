// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Worker } from 'worker_threads';
import { traceError } from '../../../logging';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export async function executeWorkerFile(workerFileName: string, workerData: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerFileName, { workerData });
        worker.on('message', (res: { err: Error; res: unknown }) => {
            if (res.err) {
                reject(res.err);
            }
            resolve(res.res);
        });
        worker.on('error', (ex: Error) => {
            traceError(`Error in worker ${workerFileName}`, ex);
            reject(ex);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker ${workerFileName} stopped with exit code ${code}`));
            }
        });
    });
}
