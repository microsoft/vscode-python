// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import {
    Options, REG_SZ, Registry, RegistryItem,
} from 'winreg';
import { traceVerbose } from '../../common/logger';
import { createDeferred } from '../../common/utils/async';

// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable global-require */

/**
 * Checks if a given path ends with python*.exe
 * @param {string} interpreterPath : Path to python interpreter.
 * @returns {boolean} : Returns true if the path matches pattern for windows python executable.
 */
export function isWindowsPythonExe(interpreterPath:string): boolean {
    /**
     * This Reg-ex matches following file names:
     * python.exe
     * python3.exe
     * python38.exe
     * python3.8.exe
     */
    const windowsPythonExes = /^python(\d+(.\d+)?)?\.exe$/;

    return windowsPythonExes.test(path.basename(interpreterPath));
}

export async function readRegistryValues(options: Options): Promise<RegistryItem[]> {
    // tslint:disable-next-line:no-require-imports
    const WinReg = require('winreg');
    const regKey = new WinReg(options);
    const deferred = createDeferred<RegistryItem[]>();
    regKey.values((err:Error, res:RegistryItem[]) => {
        if (err) {
            deferred.reject(err);
        }
        deferred.resolve(res);
    });
    return deferred.promise;
}

export async function readRegistryKeys(options: Options): Promise<Registry[]> {
    // tslint:disable-next-line:no-require-imports
    const WinReg = require('winreg');
    const regKey = new WinReg(options);
    const deferred = createDeferred<Registry[]>();
    regKey.keys((err:Error, res:Registry[]) => {
        if (err) {
            deferred.reject(err);
        }
        deferred.resolve(res);
    });
    return deferred.promise;
}

export interface IRegistryInterpreterData{
    interpreterPath: string;
    versionStr: string;
    bitnessStr: string;
    displayName: string;
}

async function getInterpreterDataFromKey(key:Registry): Promise<IRegistryInterpreterData | undefined> {
    const result = {
        interpreterPath: '',
        versionStr: '',
        bitnessStr: '',
        displayName: '',
    };
    const values:RegistryItem[] = await readRegistryValues({ arch: key.arch, hive: key.hive, key: key.key });
    for (const value of values) {
        if (value.name === 'Version') {
            result.versionStr = value.value;
        }
        if (value.name === 'SysArchitecture') {
            result.bitnessStr = value.value;
        }
        if (value.name === 'DisplayName') {
            result.displayName = value.value;
        }
    }

    const subKeys:Registry[] = await readRegistryKeys({ arch: key.arch, hive: key.hive, key: key.key });
    for (const subKey of subKeys) {
        if (subKey.key.endsWith('InstallPath')) {
            const subKeyValues:RegistryItem[] = await readRegistryValues({
                arch: key.arch,
                hive: key.hive,
                key: subKey.key,
            });

            for (const value of subKeyValues) {
                if (value.name === 'ExecutablePath') {
                    if (value.type === REG_SZ) {
                        result.interpreterPath = value.value;
                    } else {
                        traceVerbose(`Registry interpreter path type [${value.type}]: ${value.value}`);
                    }
                }
            }
        }
    }

    if (result.interpreterPath.length > 0) {
        return result;
    }
    return undefined;
}

export async function getInterpreterDataFromRegistry(options: Options): Promise<IRegistryInterpreterData[]> {
    const registryData:IRegistryInterpreterData[] = [];
    const codingPackKeys = await readRegistryKeys({ arch: options.arch, hive: options.hive, key: options.key });
    for (const key of codingPackKeys) {
        const data = await getInterpreterDataFromKey(key);
        if (data) {
            registryData.push(data);
        }
    }
    return registryData;
}
