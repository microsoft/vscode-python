// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator } from '../../locator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { Conda, CONDA_ACTIVATION_TIMEOUT } from '../../../common/environmentManagers/conda';
import { traceError, traceVerbose } from '../../../../logging';
import { shellExecute } from '../../../common/externalDependencies';
import { getExecutable } from '../../../../common/process/internal/python';
import { buildPythonExecInfo, copyPythonExecInfo } from '../../../exec';

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
        for (const { name, prefix } of envs) {
            let executablePath = await getInterpreterPathFromDir(prefix);
            if (executablePath !== undefined) {
                traceVerbose(`Found conda environment: ${executablePath}`);
                try {
                    yield { kind: PythonEnvKind.Conda, executablePath, envPath: prefix };
                } catch (ex) {
                    traceError(`Failed to process environment: ${executablePath}`, ex);
                }
            } else {
                const runArgs = await conda.getRunPythonArgs({ name, prefix });
                if (runArgs) {
                    try {
                        const [args, parse] = getExecutable();
                        const python = buildPythonExecInfo(runArgs);
                        const info = copyPythonExecInfo(python, args);
                        const argv = [info.command, ...info.args];
                        // Concat these together to make a set of quoted strings
                        const quoted = argv.reduce(
                            (p, c) => (p ? `${p} ${c.toCommandArgument()}` : `${c.toCommandArgument()}`),
                            '',
                        );
                        const result = await shellExecute(quoted, { timeout: CONDA_ACTIVATION_TIMEOUT });
                        executablePath = parse(result.stdout);
                        if (executablePath !== '') {
                            traceVerbose(`Found conda environment: ${JSON.stringify({ name, prefix })}`);
                            yield { kind: PythonEnvKind.Conda, executablePath, envPath: prefix };
                        }
                    } catch (ex) {
                        traceError(`Failed to process environment: ${JSON.stringify({ name, prefix })}`, ex);
                    }
                }
            }
        }
    }
}
