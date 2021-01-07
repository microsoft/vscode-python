// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import {
    findInterpretersInDir,
    getEnvironmentDirFromPath,
    getPythonVersionFromPath,
    isStandardPythonBinary,
} from '../../../common/commonUtils';
import { getFileInfo, isParentPath, pathExists } from '../../../common/externalDependencies';
import { isPipenvEnvironment } from '../../../discovery/locators/services/pipEnvHelper';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment,
} from '../../../discovery/locators/services/virtualEnvironmentIdentifier';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import { buildEnvInfo } from '../../info/env';
import { IPythonEnvsIterator } from '../../locator';
import { FSWatchingLocator } from './fsWatchingLocator';

/**
 * Default number of levels of sub-directories to recurse when looking for interpreters.
 */
const DEFAULT_SEARCH_DEPTH = 2;

/**
 * Gets all default virtual environment locations to look for in a workspace.
 */
function getWorkspaceVirtualEnvDirs(root: string): string[] {
    return [root, path.join(root, '.direnv')].filter(pathExists);
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
 * Finds and resolves virtual environments created in workspace roots.
 */
export class WorkspaceVirtualEnvironmentLocator extends FSWatchingLocator {
    public constructor(private readonly root: string) {
        super(() => getWorkspaceVirtualEnvDirs(this.root), getVirtualEnvKind, {
            // Note detecting kind of virtual env depends on the file structure around the
            // executable, so we need to wait before attempting to detect it.
            delayOnCreated: 1000,
        });
    }

    protected doIterEnvs(): IPythonEnvsIterator {
        async function* iterator(root: string) {
            const envRootDirs = getWorkspaceVirtualEnvDirs(root);
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for workspace virtual envs in: ${envRootDir}`);

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
                            traceVerbose(`Workspace Virtual Environment: [added] ${env}`);
                        } else {
                            traceVerbose(`Workspace Virtual Environment: [skipped] ${env}`);
                        }
                    }
                }
                return generator();
            });

            yield* iterable(chain(envGenerators));
        }

        return iterator(this.root);
    }

    // eslint-disable-next-line class-methods-use-this
    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        if (isParentPath(executablePath, this.root) && (await pathExists(executablePath))) {
            // We should extract the kind here to avoid doing is*Environment()
            // check multiple times. Those checks are file system heavy and
            // we can use the kind to determine this anyway.
            const kind = await getVirtualEnvKind(executablePath);
            return buildSimpleVirtualEnvInfo(executablePath, kind);
        }
        return undefined;
    }
}
