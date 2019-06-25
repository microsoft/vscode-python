// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import { SemVer } from 'semver';
import { Disposable } from 'vscode';
import { Architecture, OSType } from '../utils/platform';

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
    readonly osType: OSType;
    osRelease: string;
    readonly pathVariableName: 'Path' | 'PATH';
    readonly virtualEnvBinName: 'bin' | 'Scripts';

    // convenience methods
    readonly isWindows: boolean;
    readonly isMac: boolean;
    readonly isLinux: boolean;
    readonly is64bit: boolean;
    getVersion(): Promise<SemVer>;
}

export type TemporaryFile = { filePath: string } & Disposable;
export type TemporaryDirectory = { path: string } & Disposable;

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    directorySeparatorChar: string;
    objectExists(path: string, statCheck: (s: fs.Stats) => boolean): Promise<boolean>;
    fileExists(path: string): Promise<boolean>;
    fileExistsSync(path: string): boolean;
    directoryExists(path: string): Promise<boolean>;
    createDirectory(path: string): Promise<void>;
    deleteDirectory(path: string): Promise<void>;
    getSubDirectories(rootDir: string): Promise<string[]>;
    getFiles(rootDir: string): Promise<string[]>;
    arePathsSame(path1: string, path2: string): boolean;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, data: {}, options?: string | fsextra.WriteFileOptions): Promise<void>;
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
    createWriteStream(path: string): fs.WriteStream;
    chmod(path: string, mode: string): Promise<void>;
}
