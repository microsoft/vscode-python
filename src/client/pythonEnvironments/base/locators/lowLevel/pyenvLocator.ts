// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError } from '../../../../common/logger';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { FSWatchingLocator } from './fsWatchingLocator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { getSubDirs } from '../../../common/externalDependencies';
import { getPyenvDir } from '../../../common/environmentManagers/pyenv';
import { logTime } from '../../../../common/performance';

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
    logTime('PyenvLocator - start');

    const pyenvVersionDir = getPyenvVersionsDir();

    const subDirs = getSubDirs(pyenvVersionDir, { resolveSymlinks: true });
    for await (const subDirPath of subDirs) {
        const interpreterPath = await getInterpreterPathFromDir(subDirPath);

        if (interpreterPath) {
            try {
                logTime(`PyenvLocator - yielding ${interpreterPath}`);
                yield {
                    kind: PythonEnvKind.Pyenv,
                    executablePath: interpreterPath,
                };
            } catch (ex) {
                traceError(`Failed to process environment: ${interpreterPath}`, ex);
            }
        }
    }
    logTime('PyenvLocator - done');
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
