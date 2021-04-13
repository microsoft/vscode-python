// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getInterpreterPathFromDir, getPythonVersionFromPath } from '../../../common/commonUtils';
import { AnacondaCompanyName, Conda } from './conda';
import { resolveEnvFromIterator } from '../../../base/locatorUtils';
import { traceError, traceVerbose } from '../../../../common/logger';

export class CondaEnvironmentLocator extends Locator {
    // Locating conda binary is expensive, since it potentially involves spawning or
    // trying to spawn processes; so it's done lazily and asynchronously. Methods that
    // need a Conda instance should use getConda() to obtain it, and should never access
    // this property directly.
    private condaPromise: Promise<Conda | undefined> | undefined;

    public constructor(conda?: Conda) {
        super();
        if (conda !== undefined) {
            this.condaPromise = Promise.resolve(conda);
        }
    }

    public async getConda(): Promise<Conda | undefined> {
        traceVerbose(`Searching for conda.`);
        if (this.condaPromise === undefined) {
            this.condaPromise = Conda.locate();
        }
        return this.condaPromise;
    }

    public async *iterEnvs(): IPythonEnvsIterator {
        const conda = await this.getConda();
        if (conda === undefined) {
            traceVerbose(`Couldn't locate the conda binary.`);
            return;
        }
        traceVerbose(`Searching for conda environments using ${conda.command}`);

        const envs = await conda.getEnvList();
        for (const { name, prefix } of envs) {
            const executable = await getInterpreterPathFromDir(prefix);
            if (executable !== undefined) {
                const info = buildEnvInfo({
                    executable,
                    kind: PythonEnvKind.Conda,
                    org: AnacondaCompanyName,
                    location: prefix,
                    source: [PythonEnvSource.Conda],
                    version: await getPythonVersionFromPath(executable),
                });
                if (name) {
                    info.name = name;
                }
                traceVerbose(`Found conda environment: ${executable}`);
                try {
                    yield info;
                } catch (ex) {
                    traceError(`Failed to process environment: ${executable}`, ex);
                }
            }
        }
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (typeof env !== 'string') {
            if (env.kind !== PythonEnvKind.Conda && env.kind !== PythonEnvKind.Unknown) {
                return undefined;
            }
        }

        // There's no performance difference between getting all known environments, or just one -
        // we have to spawn conda either way - so use the naive implementation.
        return resolveEnvFromIterator(env, this.iterEnvs());
    }
}
