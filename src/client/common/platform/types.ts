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

export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    stat(filePath: string): Promise<vscode.FileStat>;
    // fs-extra
    fileExistsSync(path: string): boolean;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, data: {}, options?: string | fsextra.WriteFileOptions): Promise<void>;
    createDirectory(path: string): Promise<void>;
    deleteDirectory(path: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    // fs
    createWriteStream(path: string): fs.WriteStream;
    chmod(path: string, mode: string): Promise<void>;
    // helpers
    arePathsSame(path1: string, path2: string): boolean;
    pathExists(path: string, fileType?: vscode.FileType): Promise<boolean>;
    fileExists(path: string): Promise<boolean>;
    directoryExists(path: string): Promise<boolean>;
    getSubDirectories(rootDir: string): Promise<string[]>;
    getFiles(rootDir: string): Promise<string[]>;
    copyFile(src: string, dest: string): Promise<void>;
    getFileHash(filePath: string): Promise<string>;
    search(globPattern: string): Promise<string[]>;
    createTemporaryFile(extension: string): Promise<TemporaryFile>;
}
