// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as semver from 'semver';
import { Disposable } from 'vscode';

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum OSType {
    Unknown,
    Windows,
    OSX,
    Linux
}
export enum OSDistro {
    Unknown,
    // linux:
    Ubuntu,
    Debian,
    RHEL,
    Fedora,
    CentOS,
    // The remainder aren't officially supported.
    // See: https://code.visualstudio.com/docs/supporting/requirements
    Suse,
    Gentoo,
    Arch
}

export const IOSInfo = Symbol('IOSInfo');
export interface IOSInfo {
    readonly type: OSType;
    readonly arch: string;
    readonly version: semver.SemVer;
    readonly distro: OSDistro;
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
    os: IOSInfo;
    pathVariableName: 'Path' | 'PATH';
    virtualEnvBinName: 'bin' | 'scripts';

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Drop the following (in favor of osType).
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    is64bit: boolean;
}

export type TemporaryFile = { filePath: string } & Disposable;

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    directorySeparatorChar: string;
    objectExists(path: string, statCheck: (s: fs.Stats) => boolean): Promise<boolean>;
    fileExists(path: string): Promise<boolean>;
    fileExistsSync(path: string): boolean;
    directoryExists(path: string): Promise<boolean>;
    createDirectory(path: string): Promise<void>;
    getSubDirectories(rootDir: string): Promise<string[]>;
    arePathsSame(path1: string, path2: string): boolean;
    readFile(filePath: string): Promise<string>;
    appendFileSync(filename: string, data: {}, encoding: string): void;
    appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: number; flag?: string }): void;
    // tslint:disable-next-line:unified-signatures
    appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: string; flag?: string }): void;
    getRealPath(path: string): Promise<string>;
    copyFile(src: string, dest: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    getFileHash(filePath: string): Promise<string | undefined>;
    search(globPattern: string): Promise<string[]>;
    createTemporaryFile(extension: string): Promise<TemporaryFile>;
}
