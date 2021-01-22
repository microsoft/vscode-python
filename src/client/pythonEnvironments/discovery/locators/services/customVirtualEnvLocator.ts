// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { uniq } from 'lodash';
import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import { getUserHomeDir } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator } from '../../../base/locator';
import { FSWatchingLocator } from '../../../base/locators/lowLevel/fsWatchingLocator';
import {
    findInterpretersInDir,
    getEnvironmentDirFromPath,
    getPythonVersionFromPath,
    isStandardPythonBinary,
} from '../../../common/commonUtils';
import {
    getFileInfo,
    getPythonSetting,
    onDidChangePythonSetting,
    pathExists,
} from '../../../common/externalDependencies';
import { isPipenvEnvironment } from './pipEnvHelper';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment,
    isVirtualenvwrapperEnvironment,
} from './virtualEnvironmentIdentifier';

/**
 * Default number of levels of sub-directories to recurse when looking for interpreters.
 */
const DEFAULT_SEARCH_DEPTH = 2;

export const VENVPATH_SETTING_KEY = 'venvPath';
export const VENVFOLDERS_SETTING_KEY = 'venvFolders';

/**
 * Gets all custom virtual environment locations to look for environments.
 */
async function getCustomVirtualEnvDirs(): Promise<string[]> {
    const venvDirs: string[] = [];
    const venvPath = getPythonSetting<string>(VENVPATH_SETTING_KEY);
    if (venvPath) {
        venvDirs.push(venvPath);
    }
    const venvFolders = getPythonSetting<string[]>(VENVFOLDERS_SETTING_KEY) ?? [];
    const homeDir = getUserHomeDir();
    if (homeDir && (await pathExists(homeDir))) {
        venvFolders.map((item) => path.join(homeDir, item)).forEach((d) => venvDirs.push(d));
    }
    return uniq(venvDirs).filter(pathExists);
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
 * Finds and resolves custom virtual environments that users have provided.
 */
export class CustomVirtualEnvironmentLocator extends FSWatchingLocator {
    constructor() {
        super(getCustomVirtualEnvDirs, getVirtualEnvKind, {
            // Note detecting kind of virtual env depends on the file structure around the
            // executable, so we need to wait before attempting to detect it. However even
            // if the type detected is incorrect, it doesn't do any practical harm as kinds
            // in this locator are used in the same way (same activation commands etc.)
            delayOnCreated: 1000,
        });
    }

    protected async initResources(): Promise<void> {
        this.disposables.push(onDidChangePythonSetting(VENVPATH_SETTING_KEY, () => this.emitter.fire({})));
        this.disposables.push(onDidChangePythonSetting(VENVFOLDERS_SETTING_KEY, () => this.emitter.fire({})));
    }

    // eslint-disable-next-line class-methods-use-this
    protected doIterEnvs(): IPythonEnvsIterator {
        async function* iterator() {
            const envRootDirs = await getCustomVirtualEnvDirs();
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for custom virtual envs in: ${envRootDir}`);

                    const envGenerator = findInterpretersInDir(envRootDir, DEFAULT_SEARCH_DEPTH);

                    for await (const env of envGenerator) {
                        // We only care about python.exe (on windows) and python (on linux/mac)
                        // Other version like python3.exe or python3.8 are often symlinks to
                        // python.exe or python in the same directory in the case of virtual
                        // environments.
                        if (isStandardPythonBinary(env)) {
                            // We should extract the kind here to avoid doing is*Environment()
                            // check multiple times. Those checks are file system heavy and
                            // we can use the kind to determine this anyway.
                            const kind = await getVirtualEnvKind(env);
                            yield buildSimpleVirtualEnvInfo(env, kind);
                            traceVerbose(`Custom Virtual Environment: [added] ${env}`);
                        } else {
                            traceVerbose(`Custom Virtual Environment: [skipped] ${env}`);
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
