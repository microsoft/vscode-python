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

export const IPlatformService = Symbol('IPlatformService');
export interface IPlatformService {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    is64bit: boolean;
    pathVariableName: 'Path' | 'PATH';
}

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    directorySeparatorChar: string;
    existsAsync(path: string): Promise<boolean>;
    createDirectoryAsync(path: string): Promise<boolean>;
    getSubDirectoriesAsync(rootDir: string): Promise<string[]>;
    arePathsSame(path1: string, path2: string): boolean;
}
