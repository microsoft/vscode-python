// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator } from '../../locator';
import { Conda } from '../../../common/environmentManagers/conda';
import { traceError, traceVerbose } from '../../../../logging';

export class CondaEnvironmentLocator extends Locator<BasicEnvInfo> {
    // eslint-disable-next-line class-methods-use-this
    public async *iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const conda = await Conda.getConda();
        if (conda === undefined) {
            traceVerbose(`Couldn't locate the conda binary.`);
            return;
        }
        traceVerbose(`Searching for conda environments using ${conda.command}`);

        const envs = await conda.getEnvList();
        for (const env of envs) {
            const executablePath = await conda.getInterpreterPathForEnvironment(env);
            if (executablePath !== undefined) {
                traceVerbose(`Found conda environment: ${executablePath}`);
                try {
                    yield { kind: PythonEnvKind.Conda, executablePath, envPath: env.prefix };
                } catch (ex) {
                    traceError(`Failed to process environment: ${executablePath}`, ex);
                }
            }
        }
    }
}
