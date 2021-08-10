// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError } from '../../../../common/logger';
import { PythonEnvKind, PythonEnvSource } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator, Locator } from '../../locator';
import { commonPosixBinPaths, getPythonBinFromPosixPaths } from '../../../common/posixUtils';
import { isPyenvShimDir } from '../../../common/environmentManagers/pyenv';
import { logTime } from '../../../../common/performance';

export class PosixKnownPathsLocator extends Locator<BasicEnvInfo> {
    private kind: PythonEnvKind = PythonEnvKind.OtherGlobal;

    public iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const iterator = async function* (kind: PythonEnvKind) {
            logTime('PosixKnownPathsLocator - start');
            // Filter out pyenv shims. They are not actual python binaries, they are used to launch
            // the binaries specified in .python-version file in the cwd. We should not be reporting
            // those binaries as environments.
            const knownDirs = (await commonPosixBinPaths()).filter((dirname) => !isPyenvShimDir(dirname));
            const pythonBinaries = await getPythonBinFromPosixPaths(knownDirs);
            for (const bin of pythonBinaries) {
                try {
                    logTime(`PosixKnownPathsLocator - yielding ${bin}`);
                    yield { executablePath: bin, kind, source: [PythonEnvSource.PathEnvVar] };
                } catch (ex) {
                    traceError(`Failed to process environment: ${bin}`, ex);
                }
            }
            logTime('PosixKnownPathsLocator - done');
        };
        return iterator(this.kind);
    }
}
