// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { uniq } from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceError, traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import {
    findInterpretersInDir,
    getEnvironmentDirFromPath,
    getPythonVersionFromPath,
    looksLikeBasicVirtualPython,
} from '../../../common/commonUtils';
import { getFileInfo, isParentPath, pathExists } from '../../../common/externalDependencies';
import { isPipenvEnvironment } from '../../../discovery/locators/services/pipEnvHelper';
import {
    isVenvEnvironment,
    isVirtualenvEnvironment,
} from '../../../discovery/locators/services/virtualEnvironmentIdentifier';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../info';
import { buildEnvInfo } from '../../info/env';
import { IPythonEnvsIterator } from '../../locator';
import { FSWatchingLocator } from './fsWatchingLocator';
import '../../../../common/extensions';

/**
 * Default number of levels of sub-directories to recurse when looking for interpreters.
 */
const DEFAULT_SEARCH_DEPTH = 2;

/**
 * Gets all default virtual environment locations to look for in a workspace.
 */
function getWorkspaceVirtualEnvDirs(root: string): Promise<string[]> {
    return [root, path.join(root, '.direnv')].asyncFilter(pathExists);
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

async function buildSimpleVirtualEnvInfo(
    executablePath: string,
    kind: PythonEnvKind,
    source?: PythonEnvSource[],
): Promise<PythonEnvInfo> {
    const envInfo = buildEnvInfo({
        kind,
        version: await getPythonVersionFromPath(executablePath),
        executable: executablePath,
        source: source ?? [PythonEnvSource.Other],
    });
    const location = getEnvironmentDirFromPath(executablePath);
    envInfo.location = location;
    envInfo.name = path.basename(location);
    // Search location particularly for virtual environments is intended as the
    // directory in which the environment was found in. For eg. the default search location
    // for an env containing 'bin' or 'Scripts' directory is:
    //
    // searchLocation <--- Default search location directory
    // |__ env
    //    |__ bin or Scripts
    //        |__ python  <--- executable
    envInfo.searchLocation = Uri.file(path.dirname(location));

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
            const envRootDirs = await getWorkspaceVirtualEnvDirs(root);
            const envGenerators = envRootDirs.map((envRootDir) => {
                async function* generator() {
                    traceVerbose(`Searching for workspace virtual envs in: ${envRootDir}`);

                    const executables = findInterpretersInDir(envRootDir, DEFAULT_SEARCH_DEPTH);

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

                            if (kind === PythonEnvKind.Unknown) {
                                // We don't know the environment type so skip this one.
                                traceVerbose(`Workspace Virtual Environment: [skipped] ${filename}`);
                            } else {
                                try {
                                    yield buildSimpleVirtualEnvInfo(filename, kind);
                                    traceVerbose(`Workspace Virtual Environment: [added] ${filename}`);
                                } catch (ex) {
                                    traceError(`Failed to process environment: ${filename}`, ex);
                                }
                            }
                        } else {
                            traceVerbose(`Workspace Virtual Environment: [skipped] ${filename}`);
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
        const source = typeof env === 'string' ? [PythonEnvSource.Other] : uniq([PythonEnvSource.Other, ...env.source]);
        if (isParentPath(executablePath, this.root) && (await pathExists(executablePath))) {
            // We should extract the kind here to avoid doing is*Environment()
            // check multiple times. Those checks are file system heavy and
            // we can use the kind to determine this anyway.
            const kind = await getVirtualEnvKind(executablePath);
            if (kind === PythonEnvKind.Unknown) {
                return undefined;
            }
            return buildSimpleVirtualEnvInfo(executablePath, kind, source);
        }
        return undefined;
    }
}
