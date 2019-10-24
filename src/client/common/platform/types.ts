// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

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

export import FileType = vscode.FileType;
export type FileStat = fsextra.Stats;
export type WriteStream = fs.WriteStream;

// Later we will drop "IFileSystem", switching usage to
// "IFileSystemUtils" and then rename "IRawFileSystem" to "IFileSystem".

export interface IRawFileSystem {
    stat(filename: string): Promise<FileStat>;
    lstat(filename: string): Promise<FileStat>;
    chmod(filename: string, mode: string | number): Promise<void>;
    // files
    readText(filename: string): Promise<string>;
    writeText(filename: string, data: {}): Promise<void>;
    touch(filename: string): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    rmfile(filename: string): Promise<void>;
    // directories
    mkdirp(dirname: string): Promise<void>;
    rmtree(dirname: string): Promise<void>;
    listdir(dirname: string, path: IFileSystemPath): Promise<[string, FileType][]>;
    // not async
    statSync(filename: string): FileStat;
    readTextSync(filename: string): string;
    createWriteStream(filename: string): WriteStream;
}

// Eventually we will merge IPathUtils into IFileSystemPath.

export interface IFileSystemPath {
    join(...filenames: string[]): string;
    normCase(filename: string): string;
}

export const IFileSystemUtils = Symbol('IFileSystemUtils');
export interface IFileSystemUtils {
    raw: IRawFileSystem;
    path: IFileSystemPath;
    // aliases
    createDirectory(dirname: string): Promise<void>;
    deleteDirectory(dirname: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    // helpers
    pathExists(filename: string, fileType?: FileType): Promise<boolean>;
    fileExists(filename: string): Promise<boolean>;
    directoryExists(dirname: string): Promise<boolean>;
    getSubDirectories(dirname: string): Promise<string[]>;
    getFiles(dirname: string): Promise<string[]>;
    isDirReadonly(dirname: string): Promise<boolean>;
    getFileHash(filename: string): Promise<string>;
    search(globPattern: string): Promise<string[]>;
    createTemporaryFile(suffix: string): Promise<TemporaryFile>;
    // helpers (non-async)
    arePathsSame(path1: string, path2: string): boolean;  // Move to IPathUtils.
    pathExistsSync(filename: string): boolean;
}

// more aliases (to cause less churn)
export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem extends IFileSystemUtils {
    stat(filePath: string): Promise<vscode.FileStat>;
    readFile(filename: string): Promise<string>;
    writeFile(filename: string, data: {}): Promise<void>;
    chmod(filename: string, mode: string): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    // non-async
    fileExistsSync(filename: string): boolean;
    readFileSync(filename: string): string;
    createWriteStream(filename: string): WriteStream;
}
