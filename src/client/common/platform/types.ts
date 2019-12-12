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

export type TemporaryFile = { filePath: string } & vscode.Disposable;
export type TemporaryDirectory = { path: string } & vscode.Disposable;

export import FileType = vscode.FileType;
export import FileStat = vscode.FileStat;
export type WriteStream = fs.WriteStream;

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    // path-related
    directorySeparatorChar: string;
    arePathsSame(path1: string, path2: string): boolean;
    getRealPath(path: string): Promise<string>;

    // "raw" operations
    stat(filePath: string): Promise<FileStat>;
    createDirectory(path: string): Promise<void>;
    deleteDirectory(path: string): Promise<void>;
    listdir(dirname: string): Promise<[string, FileType][]>;
    readFile(filePath: string): Promise<string>;
    readData(filePath: string): Promise<Buffer>;
    writeFile(filePath: string, data: {}, options?: string | fsextra.WriteFileOptions): Promise<void>;
    appendFile(filename: string, data: {}): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    chmod(path: string, mode: string | number): Promise<void>;
    move(src: string, tgt: string): Promise<void>;
    // sync
    readFileSync(filename: string): string;
    createReadStream(path: string): fs.ReadStream;
    createWriteStream(path: string): fs.WriteStream;

    // utils
    fileExists(path: string): Promise<boolean>;
    fileExistsSync(path: string): boolean;
    directoryExists(path: string): Promise<boolean>;
    getSubDirectories(rootDir: string): Promise<string[]>;
    getFiles(rootDir: string): Promise<string[]>;
    getFileHash(filePath: string): Promise<string>;
    search(globPattern: string, cwd?: string): Promise<string[]>;
    createTemporaryFile(extension: string): Promise<TemporaryFile>;
    isDirReadonly(dirname: string): Promise<boolean>;
}
