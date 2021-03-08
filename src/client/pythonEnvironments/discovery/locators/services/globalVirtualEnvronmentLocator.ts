// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { uniq } from 'lodash';
import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import { getEnvironmentVariable, getOSType, getUserHomeDir, OSType } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator } from '../../../base/locator';
import { FSWatchingLocator } from '../../../base/locators/lowLevel/fsWatchingLocator';
import {
    findInterpretersInDir,
    getEnvironmentDirFromPath,
    getPythonVersionFromPath,
    looksLikeBasicVirtualPython,
} from '../../../common/commonUtils';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';
import { isPipenvEnvironment } from './pipEnvHelper';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment,
    isVirtualenvwrapperEnvironment,
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

async function buildSimpleVirtualEnvInfo(executablePath: string, kind: PythonEnvKind): Promise<PythonEnvInfo> {
    const envInfo = buildEnvInfo({
        kind,
        version: await getPythonVersionFromPath(executablePath),
        executable: executablePath,
        source: [PythonEnvSource.Other],
    });
    const location = getEnvironmentDirFromPath(executablePath);
    envInfo.location = location;
    envInfo.name = path.basename(location);

    // TODO: Call a general display name provider here to build display name.
    const fileData = await getFileInfo(executablePath);
    envInfo.executable.ctime = fileData.ctime;
    envInfo.executable.mtime = fileData.mtime;
    return envInfo;
}

/**
 * Finds and resolves virtual environments created in known global locations.
 */
export class GlobalVirtualEnvironmentLocator extends FSWatchingLocator {
    constructor(private readonly searchDepth?: number) {
        super(getGlobalVirtualEnvDirs, getVirtualEnvKind, {
            // Note detecting kind of virtual env depends on the file structure around the
            // executable, so we need to wait before attempting to detect it. However even
            // if the type detected is incorrect, it doesn't do any practical harm as kinds
            // in this locator are used in the same way (same activation commands etc.)
            delayOnCreated: 1000,
        });
    }

    protected doIterEnvs(): IPythonEnvsIterator {
        // Number of levels of sub-directories to recurse when looking for
        // interpreters
        const searchDepth = this.searchDepth ?? DEFAULT_SEARCH_DEPTH;

        async function* iterator() {
            const envRootDirs = await getGlobalVirtualEnvDirs();
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for global virtual envs in: ${envRootDir}`);

                    const executables = findInterpretersInDir(envRootDir, searchDepth);

                    for await (const entry of executables) {
                        const { filename } = entry;
                        // We only care about python.exe (on windows) and python (on linux/mac)
                        // Other version like python3.exe or python3.8 are often symlinks to
                        // python.exe or python in the same directory in the case of virtual
                        // environments.
                        if (await looksLikeBasicVirtualPython(entry)) {
                            // We should extract the kind here to avoid doing is*Environment()
                            // check multiple times. Those checks are file system heavy and
                            // we can use the kind to determine this anyway.
                            const kind = await getVirtualEnvKind(filename);
                            yield buildSimpleVirtualEnvInfo(filename, kind);
                            traceVerbose(`Global Virtual Environment: [added] ${filename}`);
                        } else {
                            traceVerbose(`Global Virtual Environment: [skipped] ${filename}`);
                        }
                    }
                }
                return generator();
            });

            yield* iterable(chain(envGenerators));
        }

        return iterator();
    }

    // eslint-disable-next-line class-methods-use-this
    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        if (await pathExists(executablePath)) {
            // We should extract the kind here to avoid doing is*Environment()
            // check multiple times. Those checks are file system heavy and
            // we can use the kind to determine this anyway.
            const kind = await getVirtualEnvKind(executablePath);
            return buildSimpleVirtualEnvInfo(executablePath, kind);
        }
        return undefined;
    }
}
