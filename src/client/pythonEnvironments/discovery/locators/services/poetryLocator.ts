// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { uniq } from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
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
import { getFileInfo, isParentPath, pathExists } from '../../../common/externalDependencies';
import { isPoetryEnvironment, localPoetryEnvDirName, Poetry } from './poetry';

/**
 * Gets all default virtual environment locations to look for in a workspace.
 */
async function getVirtualEnvDirs(root: string): Promise<string[]> {
    const envDirs = [path.join(root, localPoetryEnvDirName)];
    const poetry = await Poetry.getPoetry();
    const virtualenvs = await poetry?.getEnvList(root);
    if (virtualenvs) {
        envDirs.push(...virtualenvs);
    }
    return envDirs.asyncFilter(pathExists);
}

async function getRootVirtualEnvDir(root: string): Promise<string[]> {
    const poetry = await Poetry.getPoetry();
    const setting = await poetry?.getVirtualenvsPathSetting(root);
    return setting ? [setting] : [];
}

async function getVirtualEnvKind(interpreterPath: string): Promise<PythonEnvKind> {
    return (await isPoetryEnvironment(interpreterPath)) ? PythonEnvKind.Poetry : PythonEnvKind.Unknown;
}

async function buildVirtualEnvInfo(
    executablePath: string,
    kind: PythonEnvKind,
    source?: PythonEnvSource[],
    rootedEnv = false,
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
    if (rootedEnv) {
        // For environments inside roots, we need to set search location so they can be queried accordingly.
        // Search location particularly for virtual environments is intended as the directory in which the
        // environment was found in.
        // For eg.the default search location for an env containing 'bin' or 'Scripts' directory is:
        //
        // searchLocation <--- Default search location directory
        // |__ env
        //    |__ bin or Scripts
        //        |__ python  <--- executable
        envInfo.searchLocation = Uri.file(path.dirname(location));
    }

    // TODO: Call a general display name provider here to build display name.
    const fileData = await getFileInfo(executablePath);
    envInfo.executable.ctime = fileData.ctime;
    envInfo.executable.mtime = fileData.mtime;
    return envInfo;
}

/**
 * Finds and resolves virtual environments created using poetry.
 */
export class PoetryLocator extends FSWatchingLocator {
    public constructor(private readonly root: string) {
        super(
            () => getRootVirtualEnvDir(root),
            async () => PythonEnvKind.Poetry,
        );
    }

    protected doIterEnvs(): IPythonEnvsIterator {
        async function* iterator(root: string) {
            const envDirs = await getVirtualEnvDirs(root);
            const envGenerators = envDirs.map((envDir) => {
                async function* generator() {
                    traceVerbose(`Searching for poetry virtual envs in: ${envDir}`);

                    const isLocal = isParentPath(envDir, root);
                    const executables = findInterpretersInDir(envDir, 1);

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
                            yield buildVirtualEnvInfo(
                                filename,
                                // Global environments are fetched using 'poetry env list' so we already
                                // know they're poetry environments, no need to get kind for them.
                                isLocal ? await getVirtualEnvKind(filename) : PythonEnvKind.Poetry,
                                undefined,
                                isLocal,
                            );
                            traceVerbose(`Poetry Virtual Environment: [added] ${filename}`);
                        } else {
                            traceVerbose(`Poetry Virtual Environment: [skipped] ${filename}`);
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
        const kind = await getVirtualEnvKind(executablePath);
        if (kind === PythonEnvKind.Poetry) {
            const isLocal = isParentPath(executablePath, this.root);
            return buildVirtualEnvInfo(executablePath, PythonEnvKind.Poetry, source, isLocal);
        }
        return undefined;
    }
}
