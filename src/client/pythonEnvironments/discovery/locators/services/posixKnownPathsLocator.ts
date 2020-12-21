// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { traceError, traceInfo } from '../../../../common/logger';

import { Architecture } from '../../../../common/utils/platform';
import { PythonEnvInfo, PythonEnvKind, PythonReleaseLevel, PythonVersion } from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import { IPythonEnvsIterator, Locator } from '../../../base/locator';
import { getFileInfo, resolveSymbolicLink } from '../../../common/externalDependencies';
import { commonPosixBinPaths, isPosixPythonBin } from '../../../common/posixUtils';

async function getPythonBinFromKnownPaths(): Promise<string[]> {
    const knownPaths = await commonPosixBinPaths();
    const pythonBins: Set<string> = new Set();
    for (const knownPath of knownPaths) {
        const files = (await fsapi.readdir(knownPath))
            .map((filename: string) => path.join(knownPath, filename))
            .filter(isPosixPythonBin);

        for (const file of files) {
            // Ensure that we have a collection of unique global binaries by
            // resolving all symlinks to the target binaries.
            try {
                const resolvedBin = await resolveSymbolicLink(file);
                pythonBins.add(resolvedBin);
                traceInfo(`Found: ${file} --> ${resolvedBin}`);
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
        const buildEnvInfo = (bin: string) => this.buildEnvInfo(bin);
        const iterator = async function* () {
            const exes = await getPythonBinFromKnownPaths();
            yield* exes.map(buildEnvInfo);
        };
        return iterator();
    }

    public resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        return this.buildEnvInfo(executablePath);
    }

    private async buildEnvInfo(bin: string): Promise<PythonEnvInfo> {
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
        return {
            name: '',
            location: '',
            kind: this.kind,
            executable: {
                filename: bin,
                sysPrefix: '',
                ...(await getFileInfo(bin)),
            },
            version,
            arch: Architecture.Unknown,
            distro: { org: '' },
        };
    }
}
