// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import { findInterpretersInDir, getEnvironmentDirFromPath, getPythonVersionFromPath } from '../../../common/commonUtils';
import { getFileInfo, pathExists } from '../../../common/externalDependencies';
import { isCondaEnvironment } from '../../../discovery/locators/services/condaLocator';
import { isPipenvEnvironment } from '../../../discovery/locators/services/pipEnvHelper';
import { isVenvEnvironment, isVirtualenvEnvironment } from '../../../discovery/locators/services/virtualEnvironmentIdentifier';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import { buildEnvInfo } from '../../info/env';
import { IPythonEnvsIterator, Locator } from '../../locator';

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
    if (await isCondaEnvironment(interpreterPath)) {
        return PythonEnvKind.Conda;
    }

    if (await isPipenvEnvironment(interpreterPath)) {
        return PythonEnvKind.Pipenv;
    }

    if (await isVenvEnvironment(interpreterPath)) {
        return PythonEnvKind.Venv;
    }

    if (await isVirtualenvEnvironment(interpreterPath)) {
        return PythonEnvKind.VirtualEnv;
    }

    return PythonEnvKind.Custom;
}

async function buildSimpleVirtualEnvInfo(executablePath: string, kind: PythonEnvKind): Promise<PythonEnvInfo> {
    const envInfo = buildEnvInfo({
        kind,
        version: cloneDeep(await getPythonVersionFromPath(executablePath)),
        executable: executablePath,
    });
    const location = getEnvironmentDirFromPath(executablePath);
    envInfo.location = location;
    envInfo.name = path.basename(location);
    // Call a general display name provider here to build display name.
    const fileData = await getFileInfo(executablePath);
    envInfo.executable.ctime = fileData.ctime;
    envInfo.executable.mtime = fileData.mtime;
    return envInfo;
}

/**
 * Finds and resolves virtual environments created in workspace roots.
 */
export class WorkspaceVirtualEnvironmentLocator extends Locator {
    public constructor(private readonly root: string, private readonly searchDepth?: number) {
        super();
    }

    public iterEnvs(): IPythonEnvsIterator {
        // Number of levels of sub-directories to recurse when looking for
        // interpreters
        const searchDepth = this.searchDepth ?? DEFAULT_SEARCH_DEPTH;

        async function* iterator(root: string) {
            const envRootDirs = getWorkspaceVirtualEnvDirs(root);
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for workspace virtual envs in: ${envRootDir}`);

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
    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
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
