import * as Registry from 'winreg';
enum RegistryArchitectures {
    x86 = 'x86',
    x64 = 'x64'
}

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum Hive {
    HKCU, HKLM
}

export interface IRegistry {
    getKeys(key: string, hive: Hive, arch?: Architecture): Promise<string[]>;
    getValue(key: string, hive: Hive, arch?: Architecture, name?: string): Promise<string | undefined | null>;
}

export class RegistryImplementation implements IRegistry {
    public async getKeys(key: string, hive: Hive, arch?: Architecture) {
        return getRegistryKeys({ hive: translateHive(hive)!, arch: translateArchitecture(arch), key });
    }
    public async getValue(key: string, hive: Hive, arch?: Architecture, name: string = '') {
        return getRegistryValue({ hive: translateHive(hive)!, arch: translateArchitecture(arch), key }, name);
    }
}

export function getArchitectureDislayName(arch?: Architecture) {
    switch (arch) {
        case Architecture.x64:
            return '64-bit';
        case Architecture.x86:
            return '32-bit';
        default:
            return '';
    }
}

async function getRegistryValue(options: Registry.Options, name: string = '') {
    return new Promise<string | undefined | null>((resolve, reject) => {
        new Registry(options).get(name, (error, result) => {
            if (error || !result || typeof result.value !== 'string') {
                return resolve(undefined);
            }
            resolve(result.value);
        });
    });
}
async function getRegistryKeys(options: Registry.Options): Promise<string[]> {
    // https://github.com/python/peps/blob/master/pep-0514.txt#L85
    return new Promise<string[]>((resolve, reject) => {
        new Registry(options).keys((error, result) => {
            if (error || !Array.isArray(result)) {
                return resolve([]);
            }
            resolve(result.filter(item => typeof item.key === 'string').map(item => item.key));
        });
    });
}
function translateArchitecture(arch?: Architecture): RegistryArchitectures | undefined {
    switch (arch) {
        case Architecture.x86:
            return RegistryArchitectures.x86;
        case Architecture.x64:
            return RegistryArchitectures.x64;
        default:
            return;
    }
}
function translateHive(hive: Hive): string | undefined {
    switch (hive) {
        case Hive.HKCU:
            return Registry.HKCU;
        case Hive.HKLM:
            return Registry.HKLM;
        default:
            return;
    }
}
