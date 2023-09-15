// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { chain, iterable } from '../../../../common/utils/async';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { pathExists } from '../../../common/externalDependencies';
import { isPoetryEnvironment, localPoetryEnvDirName, Poetry } from '../../../common/environmentManagers/poetry';
import '../../../../common/extensions';
import { asyncFilter } from '../../../../common/utils/arrayUtils';
import { traceError, traceVerbose } from '../../../../logging';
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';
import { PythonDiscoverySettings } from '../../../common/settings';

/**
 * Gets all default virtual environment locations to look for in a workspace.
 */
async function getVirtualEnvDirs(root: string, settings: PythonDiscoverySettings): Promise<string[]> {
    const envDirs = [path.join(root, localPoetryEnvDirName)];
    const poetry = await Poetry.getPoetry(root, settings);
    const virtualenvs = await poetry?.getEnvList();
    if (virtualenvs) {
        envDirs.push(...virtualenvs);
    }
    return asyncFilter(envDirs, pathExists);
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
export class PoetryLocator extends LazyResourceBasedLocator {
    public readonly providerId: string = 'poetry';

    public constructor(private readonly root: string, private readonly settings: PythonDiscoverySettings) {
        super();
    }

    protected doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        async function* iterator(root: string, settings: PythonDiscoverySettings) {
            const envDirs = await getVirtualEnvDirs(root, settings);
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
            traceVerbose(`Finished searching for poetry envs`);
        }

        return iterator(this.root, this.settings);
    }
}
