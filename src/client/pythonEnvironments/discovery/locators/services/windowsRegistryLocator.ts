// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { HKCU, HKLM } from 'winreg';
import { getInterpreterDataFromRegistry, IRegistryInterpreterData } from '../../../common/windowsUtils';

export async function getRegistryInterpreters() : Promise<IRegistryInterpreterData[]> {
    let registryData:IRegistryInterpreterData[] = [];

    // Read from PythonCore locations
    for (const arch of ['x64', 'x86']) {
        for (const hive of [HKLM, HKCU]) {
            registryData = registryData.concat(await getInterpreterDataFromRegistry({ arch, hive, key: '\\SOFTWARE\\Python\\PythonCore' }));
        }
    }

    // Read from PythonCodingPack locations
    return registryData.concat(await getInterpreterDataFromRegistry({ arch: 'x64', hive: HKCU, key: '\\SOFTWARE\\Python\\PythonCodingPack' }));
}
