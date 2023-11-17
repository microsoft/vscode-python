// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Worker } from 'worker_threads';
import { traceError, traceVerbose } from '../../../logging';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export async function executeWorkerFile(workerFileName: string, workerData: any): Promise<any> {
    return new Promise((resolve, reject) => {
        traceVerbose(`Starting worker ${workerFileName} with data ${JSON.stringify(workerData)}`);
        const worker = new Worker(workerFileName, { workerData });
        traceVerbose(`Started worker ${workerFileName}`);
        worker.on('message', (msg: { err: Error; res: unknown }) => {
            traceVerbose(`Worker ${workerFileName} sent message ${JSON.stringify(msg)}`);
            if (msg.err) {
                reject(msg.err);
            }
            resolve(msg.res);
        });
        worker.on('error', (ex: Error) => {
            traceError(`Error in worker ${workerFileName}`, ex);
            reject(ex);
        });
        worker.on('exit', (code) => {
            traceVerbose(`Worker ${workerFileName} exited with code ${code}`);
            if (code !== 0) {
                reject(new Error(`Worker ${workerFileName} stopped with exit code ${code}`));
            }
        });
    });
}
