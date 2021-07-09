// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvKind } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { Conda } from './conda';
import { traceError, traceVerbose } from '../../../../common/logger';

export class CondaEnvironmentLocator extends Locator {
    public constructor() {
        super();
    }

    // eslint-disable-next-line class-methods-use-this
    public async *iterEnvs(): IPythonEnvsIterator {
        const conda = await Conda.getConda();
        if (conda === undefined) {
            traceVerbose(`Couldn't locate the conda binary.`);
            return;
        }
        traceVerbose(`Searching for conda environments using ${conda.command}`);

        const envs = await conda.getEnvList();
        for (const { prefix } of envs) {
            const executable = await getInterpreterPathFromDir(prefix);
            if (executable !== undefined) {
                traceVerbose(`Found conda environment: ${executable}`);
                try {
                    yield buildEnvInfo({ kind: PythonEnvKind.Conda, executable });
                } catch (ex) {
                    traceError(`Failed to process environment: ${executable}`, ex);
                }
            }
        }
    }
}
