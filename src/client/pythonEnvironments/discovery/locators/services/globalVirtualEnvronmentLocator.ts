// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError, traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import {
    Architecture, getEnvironmentVariable, getUserHomeDir,
} from '../../../../common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonVersion, UNKNOWN_PYTHON_VERSION,
} from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import { ILocator, IPythonEnvsIterator } from '../../../base/locator';
import { PythonEnvsWatcher } from '../../../base/watcher';
import { findInterpretersInDir } from '../../../common/commonUtils';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';
import { isVenvEnvironment, isVirtualenvEnvironment, isVirtualenvwrapperEnvironment } from './virtualEnvironmentIdentifier';

const DEFAULT_SEARCH_DEPTH = 4;

/**
 * Gets all default virtual environment locations. This uses WORKON_HOME,
 * and user home directory to find some known locations where global virtual
 * environments are often created.
 */
async function getGlobalVirtualEnvDirs(): Promise<string[]> {
    const venvDirs:string[] = [];
    const dirPaths:string[] = [];

    const workOnHome = getEnvironmentVariable('WORKON_HOME');
    if (workOnHome) {
        dirPaths.push(workOnHome);
    }

    const homeDir = getUserHomeDir();
    if (homeDir) {
        dirPaths.push(path.join(homeDir, 'envs'));
        dirPaths.push(path.join(homeDir, '.direnv'));
        dirPaths.push(path.join(homeDir, '.venvs'));
        dirPaths.push(path.join(homeDir, '.virtualenvs'));
        dirPaths.push(path.join(homeDir, '.local', 'share', 'virtualenvs'));
    }

    const exists = await Promise.all(dirPaths.map(pathExists));
    exists.forEach((v, i) => {
        if (v) {
            venvDirs.push(dirPaths[i]);
        }
    });

    return venvDirs;
}

/**
 * Gets the virtual environment kind for a given interpreter path.
 * This only checks for environments created using venv, virtualenv,
 * and virtualenvwrapper based environments.
 * @param interpreterPath: Absolute path to the interpreter paths.
 */
async function getVirtualEnvKind(interpreterPath:string): Promise<PythonEnvKind> {
    if (await isVenvEnvironment(interpreterPath)) {
        return PythonEnvKind.Venv;
    }

    if (await isVirtualenvwrapperEnvironment(interpreterPath)) {
        return PythonEnvKind.VirtualEnvWrapper;
    }

    if (await isVirtualenvEnvironment(interpreterPath)) {
        return PythonEnvKind.VirtualEnv;
    }

    return PythonEnvKind.Unknown;
}

/**
 * Takes absolute path to the interpreter and environment kind to build
 * environment info.
 * @param {string} interpreterPath: Absolute path to interpreter.
 * @param {PythonEnvKind} kind: Kind for the given environment.
 */
async function buildEnvInfo(interpreterPath:string, kind:PythonEnvKind): Promise<PythonEnvInfo> {
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
        kind,
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

/**
 * Finds and resolves virtual environments created in known global locations.
 */
export class GlobalVirtualEnvironmentLocator extends PythonEnvsWatcher implements ILocator {
    private virtualEnvKinds = [
        PythonEnvKind.Venv,
        PythonEnvKind.VirtualEnv,
        PythonEnvKind.VirtualEnvWrapper,
    ];

    public constructor(private readonly searchDepth?:number) {
        super();
    }

    public iterEnvs(): IPythonEnvsIterator {
        // Number of levels of sub-directories to recurse when looking for
        // interpreters
        const searchDepth = this.searchDepth ?? DEFAULT_SEARCH_DEPTH;

        async function* iterator(virtualEnvKinds:PythonEnvKind[]) {
            const envRootDirs = await getGlobalVirtualEnvDirs();
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for global virtual envs in: ${envRootDir}`);

                    const envGenerator = findInterpretersInDir(envRootDir, searchDepth);

                    for await (const env of envGenerator) {
                    // We only care about python.exe (on windows) and python (on linux/mac)
                    // Other version like python3.exe or python3.8 are often symlinks to
                    // python.exe or python in the same directory in the case od virtual
                    // environments.
                        const name = path.basename(env).toLowerCase();
                        if (name === 'python.exe' || name === 'python') {
                        // We should extract the kind here to avoid doing is*Environment()
                        // check multiple times. Those checks are file system heavy and
                        // we can use the kind to determine this anyway.
                            const kind = await getVirtualEnvKind(env);

                            if (virtualEnvKinds.includes(kind)) {
                                traceVerbose(`Global Virtual Environment: [added] ${env}`);

                                yield buildEnvInfo(env, kind);
                            } else {
                                traceVerbose(`Global Virtual Environment: [skipped] ${env}`);
                            }
                        } else {
                            traceVerbose(`Global Virtual Environment: [skipped] ${env}`);
                        }
                    }
                }
                return generator();
            });

            yield* iterable(chain(envGenerators));
        }

        return iterator(this.virtualEnvKinds);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        if (await pathExists(executablePath)) {
            // We should extract the kind here to avoid doing is*Environment()
            // check multiple times. Those checks are file system heavy and
            // we can use the kind to determine this anyway.
            const kind = await getVirtualEnvKind(executablePath);
            if (this.virtualEnvKinds.includes(kind)) {
                return buildEnvInfo(executablePath, kind);
            }
        }
        return undefined;
    }
}
