// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
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

export type TemporaryFile = vscode.Disposable & {
    filePath: string;
};
export type TemporaryDirectory = vscode.Disposable & {
    path: string;
};

import FileType = vscode.FileType;
export { FileType };
export type FileStat = fsextra.Stats;
export type WriteStream = fs.WriteStream;

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    stat(filePath: string): Promise<vscode.FileStat>;
    // fs-extra
    fileExistsSync(filename: string): boolean;
    readFile(filename: string): Promise<string>;
    writeFile(filename: string, data: {}): Promise<void>;
    createDirectory(dirname: string): Promise<void>;
    deleteDirectory(dirname: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    // fs
    createWriteStream(filename: string): WriteStream;
    chmod(filename: string, mode: string): Promise<void>;
    // helpers
    arePathsSame(path1: string, path2: string): boolean;
    pathExists(filename: string, fileType?: FileType): Promise<boolean>;
    fileExists(filename: string): Promise<boolean>;
    directoryExists(dirname: string): Promise<boolean>;
    getSubDirectories(dirname: string): Promise<string[]>;
    getFiles(dirname: string): Promise<string[]>;
    isDirReadonly(dirname: string): Promise<boolean>;
    copyFile(src: string, dest: string): Promise<void>;
    getFileHash(filename: string): Promise<string>;
    search(globPattern: string): Promise<string[]>;
    createTemporaryFile(suffix: string): Promise<TemporaryFile>;
}
