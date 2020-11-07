// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { uniqBy } from 'lodash';
import { HKCU, HKLM } from 'winreg';
import { traceError, traceVerbose } from '../../../../common/logger';
import { Architecture } from '../../../../common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonVersion, UNKNOWN_PYTHON_VERSION,
} from '../../../base/info';
import { parseVersion } from '../../../base/info/pythonVersion';
import {
    IDisposableLocator, IPythonEnvsIterator, Locator,
} from '../../../base/locator';
import { getFileInfo } from '../../../common/externalDependencies';
import { getInterpreterDataFromRegistry, IRegistryInterpreterData, readRegistryKeys } from '../../../common/windowsUtils';

async function getRegistryInterpreters() : Promise<IRegistryInterpreterData[]> {
    let registryData:IRegistryInterpreterData[] = [];

    for (const arch of ['x64', 'x86']) {
        for (const hive of [HKLM, HKCU]) {
            const root = '\\SOFTWARE\\Python';
            let keys:string[] = [];
            try {
                keys = (await readRegistryKeys({ arch, hive, key: root })).map((k) => k.key);
            } catch (ex) {
                traceError(`Failed to access Registry: ${arch}\\${hive}\\${root}`, ex);
            }

            for (const key of keys) {
                registryData = registryData.concat(await getInterpreterDataFromRegistry(arch, hive, key));
            }
        }
    }

    return uniqBy(registryData, (r:IRegistryInterpreterData) => r.interpreterPath);
}

function getArchitecture(data:IRegistryInterpreterData) {
    let arch = Architecture.Unknown;
    if (data.bitnessStr) {
        arch = data.bitnessStr === '32bit' ? Architecture.x86 : Architecture.x64;
    }
    return arch;
}

class WindowsRegistryLocator extends Locator {
    private kind:PythonEnvKind = PythonEnvKind.OtherGlobal;

    public iterEnvs(): IPythonEnvsIterator {
        const buildEnvInfo = (data:IRegistryInterpreterData) => this.buildEnvInfo(data);
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

    private async buildEnvInfo(data:IRegistryInterpreterData): Promise<PythonEnvInfo> {
        const versionStr = (data.versionStr ?? data.sysVersionStr) ?? data.interpreterPath;
        let version:PythonVersion = UNKNOWN_PYTHON_VERSION;

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
