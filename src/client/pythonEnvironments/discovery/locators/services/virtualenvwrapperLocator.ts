// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError } from '../../../../common/logger';
import {
    Architecture,
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType,
} from '../../../../common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonVersion, UNKNOWN_PYTHON_VERSION,
} from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import { ILocator, IPythonEnvsIterator } from '../../../base/locator';
import { PythonEnvsWatcher } from '../../../base/watcher';
import { findInterpretersInDir } from '../../../common/commonUtils';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';

const DEFAULT_SEARCH_DEPTH = 2;

async function getDefaultVirtualenvwrapperDir(): Promise<string> {
    const homeDir = getUserHomeDir() || '';

    // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
    // If 'Envs' is not available we should default to '.virtualenvs'. Since that
    // is also valid for windows.
    if (getOSType() === OSType.Windows) {
        const envs = path.join(homeDir, 'Envs');
        if (await pathExists(envs)) {
            return envs;
        }
    }
    return path.join(homeDir, '.virtualenvs');
}

export function getWorkOnHome(): Promise<string> {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.
    const workOnHome = getEnvironmentVariable('WORKON_HOME');
    if (workOnHome) {
        return Promise.resolve(workOnHome);
    }
    return getDefaultVirtualenvwrapperDir();
}

/**
 * Checks if the given interpreter belongs to a virtualenvWrapper based environment.
 * @param {string} interpreterPath: Absolute path to the python interpreter.
 * @returns {boolean}: Returns true if the interpreter belongs to a virtualenvWrapper environment.
 */
export async function isVirtualenvwrapperEnvironment(interpreterPath:string): Promise<boolean> {
    const workOnHomeDir = await getWorkOnHome();
    const environmentName = path.basename(path.dirname(path.dirname(interpreterPath)));

    let environmentDir = path.join(workOnHomeDir, environmentName);
    let pathToCheck = interpreterPath;

    if (getOSType() === OSType.Windows) {
        environmentDir = environmentDir.toUpperCase();
        pathToCheck = interpreterPath.toUpperCase();
    }

    return await pathExists(environmentDir) && pathToCheck.startsWith(`${environmentDir}${path.sep}`);
}

export class VirtualEnvWrapperLocator extends PythonEnvsWatcher implements ILocator {
    private kind:PythonEnvKind = PythonEnvKind.VirtualEnvWrapper;

    public constructor(private readonly searchDepth?:number) {
        super();
    }

    public iterEnvs(): IPythonEnvsIterator {
        const buildEnvInfo = (interpreterPath:string) => this.buildEnvInfo(interpreterPath);
        const searchDepth = this.searchDepth ?? DEFAULT_SEARCH_DEPTH;
        const iterator = async function* () {
            const virtualEnvs:string[] = [];
            const workOnHomeDir = await getWorkOnHome();
            const envs = await findInterpretersInDir(workOnHomeDir, searchDepth);
            for (const env of envs) {
                if (await isVirtualenvwrapperEnvironment(env)) {
                    virtualEnvs.push(env);
                }
            }
            yield* virtualEnvs.map(buildEnvInfo);
        };
        return iterator();
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        if (await isVirtualenvwrapperEnvironment(executablePath)) {
            return this.buildEnvInfo(executablePath);
        }
        return undefined;
    }

    private async buildEnvInfo(interpreterPath:string): Promise<PythonEnvInfo> {
        let version:PythonVersion;
        try {
            version = parseVersion(path.basename(interpreterPath));
        } catch (ex) {
            traceError(`Failed to parse version from path: ${interpreterPath}`, ex);
            version = UNKNOWN_PYTHON_VERSION;
        }
        return {
            name: '',
            location: '',
            kind: this.kind,
            executable: {
                filename: interpreterPath,
                sysPrefix: '',
                ...(await getFileInfo(interpreterPath)),
            },
            version,
            arch: Architecture.Unknown,
            distro: { org: '' },
        };
    }
}
