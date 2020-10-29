// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { uniq } from 'lodash';
import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { chain, iterable, sleep } from '../../../../common/utils/async';
import {
    getEnvironmentVariable, getOSType, getUserHomeDir, OSType
} from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, UNKNOWN_PYTHON_VERSION } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { findInterpretersInDir } from '../../../common/commonUtils';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';
import { watchLocationForPythonBinaries } from '../../../common/pythonBinariesWatcher';
import { isPipenvEnvironment } from './pipEnvHelper';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment,
    isVirtualenvwrapperEnvironment
} from './virtualEnvironmentIdentifier';

const DEFAULT_SEARCH_DEPTH = 2;
/**
 * Gets all default virtual environment locations. This uses WORKON_HOME,
 * and user home directory to find some known locations where global virtual
 * environments are often created.
 */
async function getGlobalVirtualEnvDirs(): Promise<string[]> {
    const venvDirs: string[] = [];

    const workOnHome = getEnvironmentVariable('WORKON_HOME');
    if (workOnHome && (await pathExists(workOnHome))) {
        venvDirs.push(workOnHome);
    }

    const homeDir = getUserHomeDir();
    if (homeDir && (await pathExists(homeDir))) {
        const subDirs = ['Envs', '.direnv', '.venvs', '.virtualenvs', path.join('.local', 'share', 'virtualenvs')];
        if (getOSType() !== OSType.Windows) {
            subDirs.push('envs');
        }
        subDirs
            .map((d) => path.join(homeDir, d))
            .filter(pathExists)
            .forEach((d) => venvDirs.push(d));
    }

    return uniq(venvDirs);
}

/**
 * Gets the virtual environment kind for a given interpreter path.
 * This only checks for environments created using venv, virtualenv,
 * and virtualenvwrapper based environments.
 * @param interpreterPath: Absolute path to the interpreter paths.
 */
async function getVirtualEnvKind(interpreterPath: string): Promise<PythonEnvKind> {
    if (await isPipenvEnvironment(interpreterPath)) {
        return PythonEnvKind.Pipenv;
    }

    if (await isVirtualenvwrapperEnvironment(interpreterPath)) {
        return PythonEnvKind.VirtualEnvWrapper;
    }

    if (await isVenvEnvironment(interpreterPath)) {
        return PythonEnvKind.Venv;
    }

    if (await isVirtualenvEnvironment(interpreterPath)) {
        return PythonEnvKind.VirtualEnv;
    }

    return PythonEnvKind.Unknown;
}

/**
 * Finds and resolves virtual environments created in known global locations.
 */
export class GlobalVirtualEnvironmentLocator extends Locator {
    private virtualEnvKinds = [
        PythonEnvKind.Venv,
        PythonEnvKind.VirtualEnv,
        PythonEnvKind.VirtualEnvWrapper,
        PythonEnvKind.Pipenv,
    ];

    public constructor(private readonly searchDepth?: number) {
        super();
        this.registerWatchers().ignoreErrors();
    }

    public iterEnvs(): IPythonEnvsIterator {
        // Number of levels of sub-directories to recurse when looking for
        // interpreters
        const searchDepth = this.searchDepth ?? DEFAULT_SEARCH_DEPTH;

        async function* iterator(virtualEnvKinds: PythonEnvKind[]) {
            const envRootDirs = await getGlobalVirtualEnvDirs();
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for global virtual envs in: ${envRootDir}`);

                    const envGenerator = findInterpretersInDir(envRootDir, searchDepth);

                    for await (const env of envGenerator) {
                        // We only care about python.exe (on windows) and python (on linux/mac)
                        // Other version like python3.exe or python3.8 are often symlinks to
                        // python.exe or python in the same directory in the case of virtual
                        // environments.
                        const name = path.basename(env).toLowerCase();
                        if (name === 'python.exe' || name === 'python') {
                            // We should extract the kind here to avoid doing is*Environment()
                            // check multiple times. Those checks are file system heavy and
                            // we can use the kind to determine this anyway.
                            const kind = await getVirtualEnvKind(env);

                            const timeData = await getFileInfo(env);
                            if (virtualEnvKinds.includes(kind)) {
                                traceVerbose(`Global Virtual Environment: [added] ${env}`);
                                const envInfo = buildEnvInfo({
                                    kind,
                                    executable: env,
                                    version: UNKNOWN_PYTHON_VERSION,
                                });
                                envInfo.executable.ctime = timeData.ctime;
                                envInfo.executable.mtime = timeData.mtime;
                                yield envInfo;
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
                const timeData = await getFileInfo(executablePath);
                const envInfo = buildEnvInfo({
                    kind,
                    version: UNKNOWN_PYTHON_VERSION,
                    executable: executablePath,
                });
                envInfo.executable.ctime = timeData.ctime;
                envInfo.executable.mtime = timeData.mtime;
                return envInfo;
            }
        }
        return undefined;
    }

    private async registerWatchers(): Promise<void> {
        const dirs = await getGlobalVirtualEnvDirs();
        dirs.forEach((d) => watchLocationForPythonBinaries(d, async (type: FileChangeType, executablePath: string) => {
            // Note detecting kind of virtual env depends on the file structure around the executable, so we need to
            // wait before attempting to detect it. However even if the type detected is incorrect, it doesn't do any
            // practical harm as kinds in this locator are used in the same way (same activation commands etc.)
            await sleep(1000);
            const kind = await getVirtualEnvKind(executablePath);
            this.emitter.fire({ type, kind });
        }));
    }
}
