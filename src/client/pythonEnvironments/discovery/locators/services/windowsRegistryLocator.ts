// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceVerbose } from '../../../../common/logger';
import { Architecture } from '../../../../common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonVersion, UNKNOWN_PYTHON_VERSION,
} from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import {
    IDisposableLocator, IPythonEnvsIterator, Locator,
} from '../../../base/locator';
import { getFileInfo } from '../../../common/externalDependencies';
import { getRegistryInterpreters, IRegistryInterpreterData } from '../../../common/windowsUtils';


function getArchitecture(data: IRegistryInterpreterData) {
    let arch = Architecture.Unknown;
    if (data.bitnessStr) {
        arch = data.bitnessStr === '32bit' ? Architecture.x86 : Architecture.x64;
    }
    return arch;
}

class WindowsRegistryLocator extends Locator {
    private kind: PythonEnvKind = PythonEnvKind.OtherGlobal;

    public iterEnvs(): IPythonEnvsIterator {
        const buildEnvInfo = (data: IRegistryInterpreterData) => this.buildEnvInfo(data);
        const iterator = async function* () {
            const interpreters = await getRegistryInterpreters();
            yield* interpreters.map(buildEnvInfo);
        };
        return iterator();
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executablePath = typeof env === 'string' ? env : env.executable.filename;
        const interpreters = await getRegistryInterpreters();
        const selected = interpreters.find((i) => i.interpreterPath.toUpperCase() === executablePath.toUpperCase());
        if (selected) {
            return this.buildEnvInfo(selected);
        }

        return undefined;
    }

    private async buildEnvInfo(data: IRegistryInterpreterData): Promise<PythonEnvInfo> {
        const versionStr = (data.versionStr ?? data.sysVersionStr) ?? data.interpreterPath;
        let version: PythonVersion = UNKNOWN_PYTHON_VERSION;

        try {
            version = parseVersion(versionStr);
        } catch (ex) {
            traceVerbose(`Failed to parse version: ${versionStr}`, ex);
        }

        return {
            name: '',
            location: '',
            kind: this.kind,
            executable: {
                filename: data.interpreterPath,
                sysPrefix: '',
                ...(await getFileInfo(data.interpreterPath)),
            },
            version,
            arch: getArchitecture(data),
            distro: { org: data.distroOrgName ?? '' },
            defaultDisplayName: data.displayName,
        };
    }
}

export function createWindowsRegistryLocator(): Promise<IDisposableLocator> {
    const locator = new WindowsRegistryLocator();
    return Promise.resolve(locator);
}
