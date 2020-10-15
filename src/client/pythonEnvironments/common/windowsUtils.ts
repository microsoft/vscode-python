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

export interface IRegistryKey{
    hive:string;
    arch:string;
    key:string;
    parentKey?:IRegistryKey;
}

export interface IRegistryValue{
    hive:string;
    arch:string;
    key:string;
    name:string;
    type:string;
    value:string;
}

export async function readRegistryValues(options: Options): Promise<IRegistryValue[]> {
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

export async function readRegistryKeys(options: Options): Promise<IRegistryKey[]> {
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
    versionStr?: string;
    sysVersionStr?:string;
    bitnessStr?: string;
    displayName?: string;
    distroOrgName?: string;
}

async function getInterpreterDataFromKey(
    { arch, hive, key }:IRegistryKey,
    distroOrgName:string,
): Promise<IRegistryInterpreterData | undefined> {
    const result:IRegistryInterpreterData = {
        interpreterPath: '',
        distroOrgName,
    };

    const values:IRegistryValue[] = await readRegistryValues({ arch, hive, key });
    for (const value of values) {
        switch (value.name) {
            case 'SysArchitecture':
                result.bitnessStr = value.value;
                break;
            case 'SysVersion':
                result.sysVersionStr = value.value;
                break;
            case 'Version':
                result.versionStr = value.value;
                break;
            case 'DisplayName':
                result.displayName = value.value;
                break;
            default:
                break;
        }
    }

    const subKeys:IRegistryKey[] = await readRegistryKeys({ arch, hive, key });
    const subKey = subKeys.map((s) => s.key).find((s) => s.endsWith('InstallPath'));
    if (subKey) {
        const subKeyValues:IRegistryValue[] = await readRegistryValues({ arch, hive, key: subKey });
        const value = subKeyValues.find((v) => v.name === 'ExecutablePath');
        if (value) {
            result.interpreterPath = value.value;
            if (value.type !== REG_SZ) {
                traceVerbose(`Registry interpreter path type [${value.type}]: ${value.value}`);
            }
        }
    }

    if (result.interpreterPath.length > 0) {
        return result;
    }
    return undefined;
}

export async function getInterpreterDataFromRegistry(
    arch:string,
    hive:string,
    key:string,
): Promise<IRegistryInterpreterData[]> {
    const subKeys = await readRegistryKeys({ arch, hive, key });
    const distroOrgName = key.substr(key.lastIndexOf('\\') + 1);
    const allData = await Promise.all(subKeys.map((subKey) => getInterpreterDataFromKey(subKey, distroOrgName)));
    return (allData.filter((data) => data !== undefined) || []) as IRegistryInterpreterData[];
}
