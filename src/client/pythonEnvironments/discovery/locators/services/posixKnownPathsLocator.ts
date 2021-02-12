// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import { traceError, traceInfo } from '../../../../common/logger';
import { Architecture } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource, PythonReleaseLevel, PythonVersion } from '../../../base/info';
import { buildEnvInfo } from '../../../base/info/env';
import { parseVersion } from '../../../base/info/pythonVersion';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getFileInfo, resolveSymbolicLink } from '../../../common/externalDependencies';
import { commonPosixBinPaths, isPosixPythonBinPattern } from '../../../common/posixUtils';
import { isPyenvShimDir } from './pyenvLocator';

async function getPythonBinFromKnownPaths(): Promise<string[]> {
    // Filter out pyenv shims. They are not actual python binaries, they are used to launch
    // the binaries specified in .python-version file in the cwd. We should not be reporting
    // those binaries as environments.
    const knownDirs = (await commonPosixBinPaths()).filter((dirname) => !isPyenvShimDir(dirname));
    const pythonBins: Set<string> = new Set();
    for (const dirname of knownDirs) {
        const paths = (await fs.promises.readdir(dirname, { withFileTypes: true }))
            .filter((dirent: fs.Dirent) => !dirent.isDirectory())
            .map((dirent: fs.Dirent) => path.join(dirname, dirent.name))
            .filter(isPosixPythonBinPattern);

        for (const filepath of paths) {
            // Ensure that we have a collection of unique global binaries by
            // resolving all symlinks to the target binaries.
            try {
                const resolvedBin = await resolveSymbolicLink(filepath);
                pythonBins.add(resolvedBin);
                traceInfo(`Found: ${filepath} --> ${resolvedBin}`);
            } catch (ex) {
                traceError('Failed to resolve symbolic link: ', ex);
            }
        }
    }

    return Array.from(pythonBins);
}

export class PosixKnownPathsLocator extends Locator {
    private kind: PythonEnvKind = PythonEnvKind.OtherGlobal;

    public iterEnvs(): IPythonEnvsIterator {
        const buildPathEnvInfo = (bin: string) => this.buildPathEnvInfo(bin);
        const iterator = async function* () {
            const exes = await getPythonBinFromKnownPaths();
            yield* exes.map(buildPathEnvInfo);
        };
        return iterator();
    }

    public resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        return this.buildPathEnvInfo(executablePath);
    }

    private async buildPathEnvInfo(bin: string): Promise<PythonEnvInfo> {
        let version: PythonVersion;
        try {
            version = parseVersion(path.basename(bin));
        } catch (ex) {
            traceError(`Failed to parse version from path: ${bin}`, ex);
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
