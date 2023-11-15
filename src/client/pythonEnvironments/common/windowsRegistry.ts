// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { HKCU, HKLM, Options, REG_SZ, Registry, RegistryItem } from 'winreg';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { createDeferred } from '../../common/utils/async';

export { HKCU, HKLM, REG_SZ, Options };

export interface IRegistryKey {
    hive: string;
    arch: string;
    key: string;
    parentKey?: IRegistryKey;
}

export interface IRegistryValue {
    hive: string;
    arch: string;
    key: string;
    name: string;
    type: string;
    value: string;
}

export async function readRegistryValues(options: Options, useWorkerThreads: boolean): Promise<IRegistryValue[]> {
    if (!useWorkerThreads) {
        // eslint-disable-next-line global-require
        const WinReg = require('winreg');
        const regKey = new WinReg(options);
        const deferred = createDeferred<RegistryItem[]>();
        regKey.values((err: Error, res: RegistryItem[]) => {
            if (err) {
                deferred.reject(err);
            }
            deferred.resolve(res);
        });
        return deferred.promise;
    }
    return new Promise((resolve, reject) => {
        // Create a worker thread
        const worker = new Worker(path.join(__dirname, 'registryValuesWorker.js'), { workerData: options });

        // Listen for messages from the worker
        worker.on('message', (res: { err: Error; res: IRegistryValue[] }) => {
            if (res.err) {
                reject(res.err);
            }
            resolve(res.res);
        });

        // Listen for any errors that occur
        worker.on('error', (ex: Error) => {
            reject(ex);
        });

        // Listen for exit if the worker thread exits prematurely
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

export async function readRegistryKeys(options: Options, useWorkerThreads: boolean): Promise<IRegistryKey[]> {
    if (!useWorkerThreads) {
        // eslint-disable-next-line global-require
        const WinReg = require('winreg');
        const regKey = new WinReg(options);
        const deferred = createDeferred<Registry[]>();
        regKey.keys((err: Error, res: Registry[]) => {
            if (err) {
                deferred.reject(err);
            }
            deferred.resolve(res);
        });
        return deferred.promise;
    }
    return new Promise((resolve, reject) => {
        // Create a worker thread
        const worker = new Worker(path.join(__dirname, 'registryKeysWorker.js'), { workerData: options });

        // Listen for messages from the worker
        worker.on('message', (res: { err: Error; res: Registry[] }) => {
            if (res.err) {
                reject(res.err);
            }
            resolve(res.res);
        });

        // Listen for any errors that occur
        worker.on('error', (ex: Error) => {
            reject(ex);
        });

        // Listen for exit if the worker thread exits prematurely
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}
