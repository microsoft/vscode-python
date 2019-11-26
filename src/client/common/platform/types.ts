// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
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
export interface ITempFileSystem {
    createFile(suffix?: string, dir?: string): Promise<TemporaryFile>;
}

// Eventually we will merge IPathUtils into IFileSystemPath.

export interface IFileSystemPaths {
    join(...filenames: string[]): string;
    dirname(filename: string): string;
    normCase(filename: string): string;
}

export import FileType = vscode.FileType;
export type FileStat = vscode.FileStat;
export type WriteStream = fs.WriteStream;

// Later we will drop "IFileSystem", switching usage to
// "IFileSystemUtils" and then rename "IRawFileSystem" to "IFileSystem".

// The low-level filesystem operations on which the extension depends.
export interface IRawFileSystem {
    // Get information about a file (resolve symlinks).
    stat(filename: string): Promise<FileStat>;
    // Get information about a file (do not resolve synlinks).
    lstat(filename: string): Promise<FileStat>;
    // Change a file's permissions.
    chmod(filename: string, mode: string | number): Promise<void>;

    //***********************
    // files

    // Return the text of the given file (decoded from UTF-8).
    readText(filename: string): Promise<string>;
    // Write the given text to the file (UTF-8 encoded).
    writeText(filename: string, data: {}): Promise<void>;
    // Copy a file.
    copyFile(src: string, dest: string): Promise<void>;
    // Delete a file.
    rmfile(filename: string): Promise<void>;

    //***********************
    // directories

    // Create the directory and any missing parent directories.
    mkdirp(dirname: string): Promise<void>;
    // Delete the directory and everything in it.
    rmtree(dirname: string): Promise<void>;
    // Return the contents of the directory.
    listdir(dirname: string): Promise<[string, FileType][]>;

    //***********************
    // not async

    // Get information about a file (resolve symlinks).
    statSync(filename: string): FileStat;
    // Return the text of the given file (decoded from UTF-8).
    readTextSync(filename: string): string;
    // Create a streaming wrappr around an open file.
    createWriteStream(filename: string): WriteStream;
}

// High-level filesystem operations used by the extension.
export const IFileSystemUtils = Symbol('IFileSystemUtils');
export interface IFileSystemUtils {
    readonly raw: IRawFileSystem;
    readonly paths: IFileSystemPaths;
    readonly tmp: ITempFileSystem;

    //***********************
    // aliases

    createDirectory(dirname: string): Promise<void>;
    deleteDirectory(dirname: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;

    //***********************
    // helpers

    // Determine if the file exists, optionally requiring the type.
    pathExists(filename: string, fileType?: FileType): Promise<boolean>;
    // Determine if the regular file exists.
    fileExists(filename: string): Promise<boolean>;
    // Determine if the directory exists.
    directoryExists(dirname: string): Promise<boolean>;
    // Get the paths of all immediate subdirectories.
    getSubDirectories(dirname: string): Promise<string[]>;
    // Get the paths of all immediately contained files.
    getFiles(dirname: string): Promise<string[]>;
    // Determine if the directory is read-only.
    isDirReadonly(dirname: string): Promise<boolean>;
    // Generate the sha512 hash for the file (based on timestamps).
    getFileHash(filename: string): Promise<string>;
    // Get the paths of all files matching the pattern.
    search(globPattern: string): Promise<string[]>;

    //***********************
    // helpers (non-async)

    // Decide if the two filenames are equivalent.
    arePathsSame(path1: string, path2: string): boolean;  // Move to IPathUtils.
}

// more aliases (to cause less churn)
export const IFileSystem = Symbol('IFileSystem');
export interface IFileSystem {
    createDirectory(dirname: string): Promise<void>;
    deleteDirectory(dirname: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    pathExists(filename: string, fileType?: FileType): Promise<boolean>;
    fileExists(filename: string): Promise<boolean>;
    directoryExists(dirname: string): Promise<boolean>;
    getSubDirectories(dirname: string): Promise<string[]>;
    getFiles(dirname: string): Promise<string[]>;
    isDirReadonly(dirname: string): Promise<boolean>;
    getFileHash(filename: string): Promise<string>;
    search(globPattern: string): Promise<string[]>;
    arePathsSame(path1: string, path2: string): boolean;

    stat(filePath: string): Promise<FileStat>;
    readFile(filename: string): Promise<string>;
    writeFile(filename: string, data: {}): Promise<void>;
    chmod(filename: string, mode: string): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    createTemporaryFile(suffix: string): Promise<TemporaryFile>;

    //***********************
    // non-async

    fileExistsSync(filename: string): boolean;
    readFileSync(filename: string): string;
    createWriteStream(filename: string): WriteStream;
}
