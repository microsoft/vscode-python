// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator } from '../../locator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { Conda } from '../../../common/environmentManagers/conda';
import { traceError, traceVerbose } from '../../../../common/logger';
import { logTime } from '../../../../common/performance';

export class CondaEnvironmentLocator extends Locator<BasicEnvInfo> {
    // eslint-disable-next-line class-methods-use-this
    public async *iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        logTime(`CondaEnvironmentLocator - start`);
        const conda = await Conda.getConda();
        logTime(`CondaEnvironmentLocator - got conda`);
        if (conda === undefined) {
            traceVerbose(`Couldn't locate the conda binary.`);
            return;
        }
        traceVerbose(`Searching for conda environments using ${conda.command}`);

        logTime(`CondaEnvironmentLocator - getting envs`);
        const envs = await conda.getEnvList();
        for (const { prefix } of envs) {
            const executablePath = await getInterpreterPathFromDir(prefix);
            if (executablePath !== undefined) {
                traceVerbose(`Found conda environment: ${executablePath}`);
                try {
                    logTime(`CondaEnvironmentLocator - yielding ${executablePath}`);
                    yield { kind: PythonEnvKind.Conda, executablePath };
                } catch (ex) {
                    traceError(`Failed to process environment: ${executablePath}`, ex);
                }
            }
        }
        logTime(`CondaEnvironmentLocator - done`);
    }
}
