// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as glob from 'glob';
import { injectable } from 'inversify';
import * as path from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { createDeferred } from '../utils/async';
import { getOSType, OSType } from '../utils/platform';
import {
    FileStat, FileType,
    IFileSystem, IFileSystemUtils, IRawFileSystem,
    TemporaryFile, WriteStream
} from './types';

const ENCODING: string = 'utf8';

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

interface IRawFS {
    //tslint:disable-next-line:no-any
    open(filename: string, flags: number, callback: any): void;
    //tslint:disable-next-line:no-any
    close(fd: number, callback: any): void;
    //tslint:disable-next-line:no-any
    unlink(filename: string, callback: any): void;

    // non-async
    createWriteStream(filePath: string): fs.WriteStream;
}

interface IRawFSExtra {
    chmod(filePath: string, mode: string): Promise<void>;
    readFile(path: string, encoding: string): Promise<string>;
    //tslint:disable-next-line:no-any
    writeFile(path: string, data: any, options: any): Promise<void>;
    unlink(filename: string): Promise<void>;
    stat(filename: string): Promise<fsextra.Stats>;
    lstat(filename: string): Promise<fsextra.Stats>;
    mkdirp(dirname: string): Promise<void>;
    rmdir(dirname: string): Promise<void>;
    readdir(dirname: string): Promise<string[]>;

    // non-async
    statSync(filename: string): fsextra.Stats;
    readFileSync(path: string, encoding: string): string;
    createReadStream(src: string): fsextra.ReadStream;
    createWriteStream(dest: string): fsextra.WriteStream;
}

// Later we will drop "FileSystem", switching usage to
// "FileSystemUtils" and then rename "RawFileSystem" to "FileSystem".

class RawFileSystem {
    constructor(
        private readonly nodefs: IRawFS = fs,
        private readonly fsExtra: IRawFSExtra = fsextra
    ) { }

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
        return this.fsExtra.rmdir(dirname);
    }

    public async rmfile(filename: string): Promise<void> {
        return this.fsExtra.unlink(filename);
    }

    public async chmod(filename: string, mode: string): Promise<void> {
        return this.fsExtra.chmod(filename, mode);
    }

    public async stat(filename: string): Promise<FileStat> {
        return this.fsExtra.stat(filename);
    }

    public async lstat(filename: string): Promise<FileStat> {
        return this.fsExtra.lstat(filename);
    }

    public async listdir(dirname: string): Promise<string[]> {
        return this.fsExtra.readdir(dirname);
    }

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
    // fs

    public async touch(filename: string): Promise<void> {
        const flags = fs.constants.O_CREAT | fs.constants.O_RDWR;
        const raw = this.nodefs;
        return new Promise<void>((resolve, reject) => {
            raw.open(filename, flags, (error: string, fd: number) => {
                if (error) {
                    return reject(error);
                }
                raw.close(fd, () => {
                    return resolve();
                });
            });
        });
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

// more aliases (to cause less churn)
@injectable()
export class FileSystemUtils implements IFileSystemUtils {
    constructor(
        private readonly isWindows = (getOSType() === OSType.Windows),
        //public readonly raw: IFileSystem = {}
        public readonly raw: IRawFileSystem = new RawFileSystem()
    ) { }

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
        path1 = path.normalize(path1);
        path2 = path.normalize(path2);
        if (this.isWindows) {
            return path1.toUpperCase() === path2.toUpperCase();
        } else {
            return path1 === path2;
        }
    }

    public async pathExists(
        filename: string,
        fileType?: FileType
    ): Promise<boolean> {
        let stat: FileStat;
        try {
            stat = await this.raw.stat(filename);
        } catch {
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
    public fileExistsSync(filename: string): boolean {
        try {
            this.raw.statSync(filename);
        } catch {
            return false;
        }
        return true;
    }

    public async listdir(
        dirname: string
    ): Promise<[string, FileType][]> {
        const filenames: string[] = await (
            this.raw.listdir(dirname)
                .then(names => names.map(name => path.join(dirname, name)))
                .catch(() => [])
        );
        const promises = filenames
            .map(filename => (
                 this.raw.stat(filename)
                     .then(stat => [filename, getFileType(stat)] as [string, FileType])
                     .catch(() => [filename, FileType.Unknown] as [string, FileType])
            ));
        return Promise.all(promises);
    }
    public async getSubDirectories(dirname: string): Promise<string[]> {
        return (await this.listdir(dirname))
            .filter(([_filename, fileType]) => fileType === FileType.Directory)
            .map(([filename, _fileType]) => filename);
    }
    public async getFiles(dirname: string): Promise<string[]> {
        return (await this.listdir(dirname))
            .filter(([_filename, fileType]) => fileType === FileType.File)
            .map(([filename, _fileType]) => filename);
    }

    public async isDirReadonly(dirname: string): Promise<boolean> {
        // Alternative: use tmp.file().
        const filename = path.join(dirname, '___vscpTest___');
        try {
            await this.raw.touch(filename);
        } catch {
            return false;
        }
        await this.raw.rmfile(filename);
        return true;
    }

    public async getFileHash(filename: string): Promise<string> {
        const stat = await this.raw.lstat(filename);
        const hash = createHash('sha512')
            .update(`${stat.ctimeMs}-${stat.mtimeMs}`);
        return hash.digest('hex');
    }

    public async search(globPattern: string): Promise<string[]> {
        // We could use util.promisify() here.
        return new Promise<string[]>((resolve, reject) => {
            glob(globPattern, (ex, files) => {
                if (ex) {
                    return reject(ex);
                }
                resolve(Array.isArray(files) ? files : []);
            });
        });
    }

    public async createTemporaryFile(suffix: string): Promise<TemporaryFile> {
        // We could use util.promisify() here.
        return new Promise<TemporaryFile>((resolve, reject) => {
            tmp.file({ postfix: suffix }, (err, tmpFile, _, cleanupCallback) => {
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

@injectable()
export class FileSystem extends FileSystemUtils implements IFileSystem {
    public async stat(filePath: string): Promise<vscode.FileStat> {
        // Do not import vscode directly, as this isn't available in the Debugger Context.
        // If stat is used in debugger context, it will fail, however theres a separate PR that will resolve this.
        // tslint:disable-next-line: no-require-imports
        const vscode = require('vscode');
        return vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    }

    public async readFile(filename: string): Promise<string> {
        return this.raw.readText(filename);
    }

    public async writeFile(filename: string, data: {}): Promise<void> {
        return this.raw.writeText(filename, data);
    }

    public async chmod(filename: string, mode: string): Promise<void> {
        return this.raw.chmod(filename, mode);
    }

    public async copyFile(src: string, dest: string): Promise<void> {
        return this.raw.copyFile(src, dest);
    }

    public readFileSync(filename: string): string {
        return this.raw.readTextSync(filename);
    }

    public createWriteStream(filename: string): WriteStream {
        return this.raw.createWriteStream(filename);
    }
}
