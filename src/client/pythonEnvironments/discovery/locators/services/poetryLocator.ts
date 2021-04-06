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
    getEnvironmentDirFromPath,
    getInterpreterPathFromDir,
    getPythonVersionFromPath,
} from '../../../common/commonUtils';
import { getFileInfo, isParentPath, pathExists } from '../../../common/externalDependencies';
import { isPoetryEnvironment, localPoetryEnvDirName, Poetry } from './poetry';
import '../../../../common/extensions';

/**
 * Gets all default virtual environment locations to look for in a workspace.
 */
async function getVirtualEnvDirs(root: string): Promise<string[]> {
    const envDirs = [path.join(root, localPoetryEnvDirName)];
    const poetry = await Poetry.getPoetry(root);
    const virtualenvs = await poetry?.getEnvList();
    if (virtualenvs) {
        envDirs.push(...virtualenvs);
    }
    return envDirs.asyncFilter(pathExists);
}

async function getRootVirtualEnvDir(root: string): Promise<string[]> {
    const rootDirs = [];
    const poetry = await Poetry.getPoetry(root);
    /**
     * We can infer the directory in which the existing poetry environments are created to determine
     * the root virtual env dir. If no virtual envs are created yet, then fetch the setting value to
     * get the root directory instead. We prefer to use 'poetry env list' command first because the
     * result of that command is already cached when getting poetry.
     */
    const virtualenvs = await poetry?.getEnvList();
    if (virtualenvs?.length) {
        rootDirs.push(path.dirname(virtualenvs[0]));
    } else {
        const setting = await poetry?.getVirtualenvsPathSetting();
        if (setting) {
            rootDirs.push(setting);
        }
    }
    return rootDirs;
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
                    const filename = await getInterpreterPathFromDir(envDir);
                    if (filename !== undefined) {
                        const kind = PythonEnvKind.Poetry;
                        if (isLocal && !(await isPoetryEnvironment(filename))) {
                            // This is not a poetry env.
                            traceVerbose(
                                `Poetry Virtual Environment: [skipped] ${filename} (reason: Not poetry environment)`,
                            );
                        } else {
                            // We should extract the kind here to avoid doing is*Environment()
                            // check multiple times. Those checks are file system heavy and
                            // we can use the kind to determine this anyway.
                            yield buildVirtualEnvInfo(filename, kind, undefined, isLocal);
                            traceVerbose(`Poetry Virtual Environment: [added] ${filename}`);
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
