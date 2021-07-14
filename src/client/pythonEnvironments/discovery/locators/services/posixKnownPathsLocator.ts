// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError, traceVerbose } from '../../../../common/logger';
import { Architecture } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource, PythonReleaseLevel, PythonVersion } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { parseVersion } from '../../../base/info/pythonVersion';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getFileInfo } from '../../../common/externalDependencies';
import { commonPosixBinPaths, getPythonBinFromPosixPaths } from '../../../common/posixUtils';
import { isPyenvShimDir } from './pyenvLocator';

export class PosixKnownPathsLocator extends Locator {
    private kind: PythonEnvKind = PythonEnvKind.OtherGlobal;

    public iterEnvs(): IPythonEnvsIterator {
        const buildPathEnvInfo = (bin: string) => this.buildPathEnvInfo(bin);
        const iterator = async function* () {
            // Filter out pyenv shims. They are not actual python binaries, they are used to launch
            // the binaries specified in .python-version file in the cwd. We should not be reporting
            // those binaries as environments.
            const knownDirs = (await commonPosixBinPaths()).filter((dirname) => !isPyenvShimDir(dirname));
            const pythonBinaries = await getPythonBinFromPosixPaths(knownDirs);
            for (const bin of pythonBinaries) {
                try {
                    const env = await buildPathEnvInfo(bin);
                    yield env;
                } catch (ex) {
                    traceError(`Failed to process environment: ${bin}`, ex);
                }
            }
        };
        return iterator();
    }

    private async buildPathEnvInfo(bin: string): Promise<PythonEnvInfo> {
        let version: PythonVersion;
        try {
            version = parseVersion(path.basename(bin));
        } catch (ex) {
            traceVerbose(`Failed to parse version from path: ${bin}`, ex);
            version = {
                major: -1,
                minor: -1,
                micro: -1,
                release: { level: PythonReleaseLevel.Final, serial: -1 },
                sysVersion: undefined,
            };
        }
        return buildEnvInfo({
            name: '',
            location: '',
            kind: this.kind,
            executable: bin,
            fileInfo: await getFileInfo(bin),
            version,
            arch: Architecture.Unknown,
            source: [PythonEnvSource.PathEnvVar],
        });
    }
}
