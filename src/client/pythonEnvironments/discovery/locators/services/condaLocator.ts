// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvKind } from '../../../base/info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { Conda } from './conda';
import { traceError, traceVerbose } from '../../../../common/logger';

export class CondaEnvironmentLocator extends Locator<BasicEnvInfo> {
    public constructor() {
        super();
    }

    // eslint-disable-next-line class-methods-use-this
    public async *iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const conda = await Conda.getConda();
        if (conda === undefined) {
            traceVerbose(`Couldn't locate the conda binary.`);
            return;
        }
        traceVerbose(`Searching for conda environments using ${conda.command}`);

        const envs = await conda.getEnvList();
        for (const { prefix } of envs) {
            const executablePath = await getInterpreterPathFromDir(prefix);
            if (executablePath !== undefined) {
                traceVerbose(`Found conda environment: ${executablePath}`);
                try {
                    yield { kind: PythonEnvKind.Conda, executablePath };
                } catch (ex) {
                    traceError(`Failed to process environment: ${executablePath}`, ex);
                }
            }
        }
    }
}
