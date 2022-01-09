// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { chain, iterable } from '../../../../common/utils/async';
import {
    findInterpretersInDir,
    getEnvironmentDirFromPath,
    looksLikeBasicVirtualPython,
} from '../../../common/commonUtils';
import { pathExists } from '../../../common/externalDependencies';
import { isPipenvEnvironment } from '../../../common/environmentManagers/pipenv';
import { isVenvEnvironment, isVirtualenvEnvironment } from '../../../common/environmentManagers/simplevirtualenvs';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { FSWatcherKind, FSWatchingLocator } from './fsWatchingLocator';
import '../../../../common/extensions';
import { asyncFilter } from '../../../../common/utils/arrayUtils';
import { traceVerbose } from '../../../../logging';

/**
 * Default number of levels of sub-directories to recurse when looking for interpreters.
 */
const DEFAULT_SEARCH_DEPTH = 2;

/**
 * Gets all default virtual environment locations to look for in a workspace.
 */
function getWorkspaceVirtualEnvDirs(root: string): Promise<string[]> {
    return asyncFilter([root, path.join(root, '.direnv')], pathExists);
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
/**
 * Finds and resolves virtual environments created in workspace roots.
 */
export class WorkspaceVirtualEnvironmentLocator extends FSWatchingLocator<BasicEnvInfo> {
    public constructor(private readonly root: string) {
        super(
            () => getWorkspaceVirtualEnvDirs(this.root),
            getVirtualEnvKind,
            {
                // Note detecting kind of virtual env depends on the file structure around the
                // executable, so we need to wait before attempting to detect it.
                delayOnCreated: 1000,
            },
            FSWatcherKind.Workspace,
        );
    }

    protected doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
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
                            const location = getEnvironmentDirFromPath(filename);
                            // For environments inside roots, we need to set search location so they can be queried accordingly.
                            // Search location particularly for virtual environments is intended as the directory in which the
                            // environment was found in.
                            // For eg.the default search location for an env containing 'bin' or 'Scripts' directory is:
                            //
                            // searchLocation <--- Default search location directory
                            // |__ env
                            //    |__ bin or Scripts
                            //        |__ python  <--- executable
                            const searchLocation = Uri.file(path.dirname(location));
                            const kind = await getVirtualEnvKind(filename);
                            yield { kind, executablePath: filename, searchLocation };
                            traceVerbose(`Workspace Virtual Environment: [added] ${filename}`);
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
}
