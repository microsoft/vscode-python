// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { uniqBy } from 'lodash';
import { HKCU, HKLM } from 'winreg';
import { getInterpreterDataFromRegistry, IRegistryInterpreterData, readRegistryKeys } from '../../../common/windowsUtils';

export async function getRegistryInterpreters() : Promise<IRegistryInterpreterData[]> {
    let registryData:IRegistryInterpreterData[] = [];

    for (const arch of ['x64', 'x86']) {
        for (const hive of [HKLM, HKCU]) {
            const keys = (await readRegistryKeys({ arch, hive, key: '\\SOFTWARE\\Python' })).map((k) => k.key);
            for (const key of keys) {
                registryData = registryData.concat(await getInterpreterDataFromRegistry(arch, hive, key));
            }
        }
    }

    return uniqBy(registryData, (r:IRegistryInterpreterData) => r.interpreterPath);
}
