// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum RegistryHive {
    HKCU, HKLM
}

export const IRegistry = Symbol('IRegistry');

export interface IRegistry {
    getKeys(key: string, hive: RegistryHive, arch?: Architecture): Promise<string[]>;
    getValue(key: string, hive: RegistryHive, arch?: Architecture, name?: string): Promise<string | undefined | null>;
}
