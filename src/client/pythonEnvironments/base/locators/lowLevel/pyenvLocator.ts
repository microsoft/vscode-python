// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError, traceVerbose } from '../../../../common/logger';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { FSWatchingLocator } from './fsWatchingLocator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { getSubDirs } from '../../../common/externalDependencies';
import { getPyenvDir } from '../../../common/environmentManagers/pyenv';

function getPyenvVersionsDir(): string {
    return path.join(getPyenvDir(), 'versions');
}

/**
 * Gets all the pyenv environments.
 *
 * Remarks: This function looks at the <pyenv dir>/versions directory and gets
 * all the environments (global or virtual) in that directory.
 */
async function* getPyenvEnvironments(): AsyncIterableIterator<BasicEnvInfo> {
    const pyenvVersionDir = getPyenvVersionsDir();

    const subDirs = getSubDirs(pyenvVersionDir, { resolveSymlinks: true });
    for await (const subDirPath of subDirs) {
        traceVerbose(`Looking for pyenv into sub-directory: ${subDirPath}`);
        const interpreterPath = await getInterpreterPathFromDir(subDirPath);

        if (interpreterPath) {
            try {
                yield {
                    kind: PythonEnvKind.Pyenv,
                    executablePath: interpreterPath,
                };
                traceVerbose(`Found pyenv environment, ${interpreterPath}`);
            } catch (ex) {
                traceError(`Failed to process environment: ${interpreterPath}`, ex);
            }
        }
    }
}

export class PyenvLocator extends FSWatchingLocator<BasicEnvInfo> {
    constructor() {
        super(getPyenvVersionsDir, async () => PythonEnvKind.Pyenv);
    }

    // eslint-disable-next-line class-methods-use-this
    public doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        return getPyenvEnvironments();
    }
}
