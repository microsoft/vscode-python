// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { traceError, traceVerbose } from '../../../../common/logger';
import { chain, iterable } from '../../../../common/utils/async';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { FSWatcherKind, FSWatchingLocator } from './fsWatchingLocator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { pathExists } from '../../../common/externalDependencies';
import { isPoetryEnvironment, localPoetryEnvDirName, Poetry } from '../../../common/environmentManagers/poetry';
import '../../../../common/extensions';
import { asyncFilter } from '../../../../common/utils/arrayUtils';

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
    return asyncFilter(envDirs, pathExists);
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
    if (await isPoetryEnvironment(interpreterPath)) {
        return PythonEnvKind.Poetry;
    }

    return PythonEnvKind.Unknown;
}

/**
 * Finds and resolves virtual environments created using poetry.
 */
export class PoetryLocator extends FSWatchingLocator<BasicEnvInfo> {
    public constructor(private readonly root: string) {
        super(
            () => getRootVirtualEnvDir(root),
            async () => PythonEnvKind.Poetry,
            undefined,
            FSWatcherKind.Workspace,
        );
    }

    protected doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        async function* iterator(root: string) {
            const envDirs = await getVirtualEnvDirs(root);
            const envGenerators = envDirs.map((envDir) => {
                async function* generator() {
                    traceVerbose(`Searching for poetry virtual envs in: ${envDir}`);
                    const filename = await getInterpreterPathFromDir(envDir);
                    if (filename !== undefined) {
                        const kind = await getVirtualEnvKind(filename);
                        try {
                            // We should extract the kind here to avoid doing is*Environment()
                            // check multiple times. Those checks are file system heavy and
                            // we can use the kind to determine this anyway.
                            yield { executablePath: filename, kind };
                            traceVerbose(`Poetry Virtual Environment: [added] ${filename}`);
                        } catch (ex) {
                            traceError(`Failed to process environment: ${filename}`, ex);
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
