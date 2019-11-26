// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as glob from 'glob';
import { injectable } from 'inversify';
import * as fspath from 'path';
import * as tmpMod from 'tmp';
import * as util from 'util';
import * as vscode from 'vscode';
import { createDeferred } from '../utils/async';
import { getOSType, OSType } from '../utils/platform';
import {
    FileStat, FileType,
    IFileSystem, IFileSystemPaths, IFileSystemUtils, IRawFileSystem,
    ITempFileSystem,
    TemporaryFile, WriteStream
} from './types';

// tslint:disable:max-classes-per-file

const ENCODING: string = 'utf8';

// Determine the file type from the given file info.
function getFileType(stat: FileStat): FileType {
    if (stat.isFile()) {
        return FileType.File;
    } else if (stat.isDirectory()) {
        return FileType.Directory;
    } else if (stat.isSymbolicLink()) {
        return FileType.SymbolicLink;
    } else {
        return FileType.Unknown;
    }
}

// The parts of node's 'path' module used by FileSystemPath.
interface INodePath {
    join(...filenames: string[]): string;
    normalize(filename: string): string;
}

// Eventually we will merge PathUtils into FileSystemPath.

// The file path operations used by the extension.
export class FileSystemPaths implements IFileSystemPaths {
    constructor(
        protected readonly isCaseSensitive: boolean,
        protected readonly raw: INodePath
    ) { }
    // Create a new object using common-case default values.
    // We do not use an alternate constructor because defaults in the
    // constructor runs counter to our approach.
    public static withDefaults(): FileSystemPaths {
        return new FileSystemPaths(
            (getOSType() === OSType.Windows),
            fspath
        );
    }

    public join(...filenames: string[]): string {
        return this.raw.join(...filenames);
    }

    public normCase(filename: string): string {
        filename = this.raw.normalize(filename);
        return this.isCaseSensitive ? filename.toUpperCase() : filename;
    }
}

//tslint:disable-next-line:no-any
type TempCallback = (err: any, path: string, fd: number, cleanupCallback: () => void) => void;
// The parts of the 'tmp' module used by TempFileSystem.
interface IRawTmp {
    file(options: tmpMod.Options, cb: TempCallback): void;
}

// The operations on temporary files/directoryes used by the extension.
export class TempFileSystem {
    constructor(
        protected readonly raw: IRawTmp
    ) { }
    // Create a new object using common-case default values.
    public static withDefaults(): TempFileSystem {
        return new TempFileSystem(
            tmpMod
        );
    }

    public async createFile(suffix?: string, dir?: string): Promise<TemporaryFile> {
        const options = {
            postfix: suffix,
            dir: dir
        };
        // We could use util.promisify() here.  The tmp.file() callback
        // makes it a bit complicated though.
        return new Promise<TemporaryFile>((resolve, reject) => {
            this.raw.file(options, (err, tmpFile, _fd, cleanupCallback) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    filePath: tmpFile,
                    dispose: cleanupCallback
                });
            });
        });
    }
}

// This is the parts of node's 'fs' module that we use in RawFileSystem.
interface IRawFS {
    // non-async
    createWriteStream(filePath: string): fs.WriteStream;
}

// This is the parts of the 'fs-extra' module that we use in RawFileSystem.
interface IRawFSExtra {
    chmod(filePath: string, mode: string | number): Promise<void>;
    readFile(path: string, encoding: string): Promise<string>;
    //tslint:disable-next-line:no-any
    writeFile(path: string, data: any, options: any): Promise<void>;
    unlink(filename: string): Promise<void>;
    stat(filename: string): Promise<fsextra.Stats>;
    lstat(filename: string): Promise<fsextra.Stats>;
    mkdirp(dirname: string): Promise<void>;
    rmdir(dirname: string): Promise<void>;
    readdir(dirname: string): Promise<string[]>;
    remove(dirname: string): Promise<void>;

    // non-async
    statSync(filename: string): fsextra.Stats;
    readFileSync(path: string, encoding: string): string;
    createReadStream(src: string): fsextra.ReadStream;
    createWriteStream(dest: string): fsextra.WriteStream;
}

// The parts of IFileSystemPaths used by RawFileSystem.
interface IRawPath {
    join(...filenames: string[]): string;
}

// Later we will drop "FileSystem", switching usage to
// "FileSystemUtils" and then rename "RawFileSystem" to "FileSystem".

// The low-level filesystem operations used by the extension.
export class RawFileSystem implements IRawFileSystem {
    constructor(
        protected readonly path: IRawPath,
        protected readonly nodefs: IRawFS,
        protected readonly fsExtra: IRawFSExtra
    ) { }

    // Create a new object using common-case default values.
    public static withDefaults(): RawFileSystem{
        return new RawFileSystem(
            FileSystemPaths.withDefaults(),
            fs,
            fsextra
        );
    }

    //****************************
    // fs-extra

    public async readText(filename: string): Promise<string> {
        return this.fsExtra.readFile(filename, ENCODING);
    }

    public async writeText(filename: string, data: {}): Promise<void> {
        const options: fsextra.WriteFileOptions = {
            encoding: ENCODING
        };
        await this.fsExtra.writeFile(filename, data, options);
    }

    public async mkdirp(dirname: string): Promise<void> {
        return this.fsExtra.mkdirp(dirname);
    }

    public async rmtree(dirname: string): Promise<void> {
        return this.fsExtra.stat(dirname)
            .then(() => this.fsExtra.remove(dirname));
    }

    public async rmfile(filename: string): Promise<void> {
        return this.fsExtra.unlink(filename);
    }

    public async chmod(filename: string, mode: string | number): Promise<void> {
        return this.fsExtra.chmod(filename, mode);
    }

    public async stat(filename: string): Promise<FileStat> {
        return this.fsExtra.stat(filename);
    }

    public async lstat(filename: string): Promise<FileStat> {
        return this.fsExtra.lstat(filename);
    }

    // Once we move to the VS Code API, this method becomes a trivial wrapper.
    public async listdir(dirname: string): Promise<[string, FileType][]> {
        const names: string[] = await this.fsExtra.readdir(dirname);
        const promises = names
            .map(name => {
                 const filename = this.path.join(dirname, name);
                 return this.lstat(filename)
                     .then(stat => [name, getFileType(stat)] as [string, FileType])
                     .catch(() => [name, FileType.Unknown] as [string, FileType]);
            });
        return Promise.all(promises);
    }

    // Once we move to the VS Code API, this method becomes a trivial wrapper.
    public async copyFile(src: string, dest: string): Promise<void> {
        const deferred = createDeferred<void>();
        const rs = this.fsExtra.createReadStream(src)
            .on('error', (err) => {
                deferred.reject(err);
            });
        const ws = this.fsExtra.createWriteStream(dest)
            .on('error', (err) => {
                deferred.reject(err);
            }).on('close', () => {
                deferred.resolve();
            });
        rs.pipe(ws);
        return deferred.promise;
    }

    //****************************
    // non-async (fs-extra)

    public statSync(filename: string): FileStat {
        return this.fsExtra.statSync(filename);
    }

    public readTextSync(filename: string): string {
        return this.fsExtra.readFileSync(filename, ENCODING);
    }

    //****************************
    // non-async (fs)

    public createWriteStream(filename: string): WriteStream {
        return this.nodefs.createWriteStream(filename);
    }
}

// High-level filesystem operations used by the extension.
@injectable()
export class FileSystemUtils implements IFileSystemUtils {
    constructor(
        public readonly raw: IRawFileSystem,
        public readonly path: IFileSystemPaths,
        public readonly tmp: ITempFileSystem,
        protected readonly getHash: (data: string) => string,
        protected readonly globFile: (pat: string) => Promise<string[]>
    ) { }
    // Create a new object using common-case default values.
    public static withDefaults(): FileSystemUtils {
        const paths = FileSystemPaths.withDefaults();
        return new FileSystemUtils(
            new RawFileSystem(paths, fs, fsextra),
            paths,
            TempFileSystem.withDefaults(),
            getHashString,
            util.promisify(glob)
        );
    }

    //****************************
    // aliases

    public async createDirectory(dirname: string): Promise<void> {
        return this.raw.mkdirp(dirname);
    }

    public async deleteDirectory(dirname: string): Promise<void> {
        return this.raw.rmtree(dirname);
    }

    public async deleteFile(filename: string): Promise<void> {
        return this.raw.rmfile(filename);
    }

    //****************************
    // helpers

    public arePathsSame(path1: string, path2: string): boolean {
        if (path1 === path2) {
            return true;
        }
        path1 = this.path.normCase(path1);
        path2 = this.path.normCase(path2);
        return path1 === path2;
    }

    public async pathExists(
        filename: string,
        fileType?: FileType
    ): Promise<boolean> {
        let stat: FileStat;
        try {
            stat = await this.raw.stat(filename);
        } catch (err) {
            return false;
        }
        if (fileType === undefined) {
            return true;
        } else if (fileType === FileType.File) {
            return stat.isFile();
        } else if (fileType === FileType.Directory) {
            return stat.isDirectory();
        } else {
            return false;
        }
    }
    public async fileExists(filename: string): Promise<boolean> {
        return this.pathExists(filename, FileType.File);
    }
    public async directoryExists(dirname: string): Promise<boolean> {
        return this.pathExists(dirname, FileType.Directory);
    }

    public async listdir(dirname: string): Promise<[string, FileType][]> {
        try {
            return await this.raw.listdir(dirname);
        } catch {
            return [];
        }
    }
    public async getSubDirectories(dirname: string): Promise<string[]> {
        return (await this.listdir(dirname))
            .filter(([_name, fileType]) => fileType === FileType.Directory)
            .map(([name, _fileType]) => this.path.join(dirname, name));
    }
    public async getFiles(dirname: string): Promise<string[]> {
        return (await this.listdir(dirname))
            .filter(([_name, fileType]) => fileType === FileType.File)
            .map(([name, _fileType]) => this.path.join(dirname, name));
    }

    public async isDirReadonly(dirname: string): Promise<boolean> {
        let tmpFile: TemporaryFile;
        try {
            tmpFile = await this.tmp.createFile('___vscpTest___', dirname);
        } catch {
            // Use a stat call to ensure the directory exists.
            await this.raw.stat(dirname);
            return true;
        }
        tmpFile.dispose();
        return false;
    }

    public async getFileHash(filename: string): Promise<string> {
        const stat = await this.raw.lstat(filename);
        const data = `${stat.ctimeMs}-${stat.mtimeMs}`;
        return this.getHash(data);
    }

    public async search(globPattern: string): Promise<string[]> {
        const files = await this.globFile(globPattern);
        return Array.isArray(files) ? files : [];
    }
}

// We *could* use ICryptoUtils, but it's a bit overkill, issue tracked
// in https://github.com/microsoft/vscode-python/issues/8438.
function getHashString(data: string): string {
    const hash = createHash('sha512')
        .update(data);
    return hash.digest('hex');
}

// more aliases (to cause less churn)
@injectable()
export class FileSystem implements IFileSystem {
    private readonly utils: FileSystemUtils;
    constructor() {
        this.utils = FileSystemUtils.withDefaults();
    }

    //****************************
    // wrappers

    public async createDirectory(dirname: string): Promise<void> {
        return this.utils.createDirectory(dirname);
    }
    public async deleteDirectory(dirname: string): Promise<void> {
        return this.utils.deleteDirectory(dirname);
    }
    public async deleteFile(filename: string): Promise<void> {
        return this.utils.deleteFile(filename);
    }
    public arePathsSame(path1: string, path2: string): boolean {
        return this.utils.arePathsSame(path1, path2);
    }
    public async pathExists(filename: string): Promise<boolean> {
        return this.utils.pathExists(filename);
    }
    public async fileExists(filename: string): Promise<boolean> {
        return this.utils.fileExists(filename);
    }
    public async directoryExists(dirname: string): Promise<boolean> {
        return this.utils.directoryExists(dirname);
    }
    public async listdir(dirname: string): Promise<[string, FileType][]> {
        return this.utils.listdir(dirname);
    }
    public async getSubDirectories(dirname: string): Promise<string[]> {
        return this.utils.getSubDirectories(dirname);
    }
    public async getFiles(dirname: string): Promise<string[]> {
        return this.utils.getFiles(dirname);
    }
    public async isDirReadonly(dirname: string): Promise<boolean> {
        return this.utils.isDirReadonly(dirname);
    }
    public async getFileHash(filename: string): Promise<string> {
        return this.utils.getFileHash(filename);
    }
    public async search(globPattern: string): Promise<string[]> {
        return this.utils.search(globPattern);
    }

    public fileExistsSync(filename: string): boolean {
        try {
            this.utils.raw.statSync(filename);
        } catch {
            return false;
        }
        return true;
    }

    //****************************
    // aliases

    public async stat(filePath: string): Promise<vscode.FileStat> {
        // Do not import vscode directly, as this isn't available in the Debugger Context.
        // If stat is used in debugger context, it will fail, however theres a separate PR that will resolve this.
        // tslint:disable-next-line: no-require-imports
        const vsc = require('vscode');
        return vsc.workspace.fs.stat(vscode.Uri.file(filePath));
    }

    public async readFile(filename: string): Promise<string> {
        return this.utils.raw.readText(filename);
    }

    public async writeFile(filename: string, data: {}): Promise<void> {
        return this.utils.raw.writeText(filename, data);
    }

    public async chmod(filename: string, mode: string): Promise<void> {
        return this.utils.raw.chmod(filename, mode);
    }

    public async copyFile(src: string, dest: string): Promise<void> {
        return this.utils.raw.copyFile(src, dest);
    }

    public readFileSync(filename: string): string {
        return this.utils.raw.readTextSync(filename);
    }

    public createWriteStream(filename: string): WriteStream {
        return this.utils.raw.createWriteStream(filename);
    }

    public async createTemporaryFile(suffix: string): Promise<TemporaryFile> {
        return this.utils.tmp.createFile(suffix);
    }
}
