// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as glob from 'glob';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { createDeferred } from '../utils/async';
import { noop } from '../utils/misc';
import {
    FileStat, FileType,
    IFileSystem, IPlatformService,
    TemporaryFile, WriteStream
} from './types';

const ENCODING = 'utf8';

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

@injectable()
export class FileSystem implements IFileSystem {
    constructor(
        @inject(IPlatformService) private platformService: IPlatformService
    ) { }

    public async stat(filePath: string): Promise<vscode.FileStat> {
        // Do not import vscode directly, as this isn't available in the Debugger Context.
        // If stat is used in debugger context, it will fail, however theres a separate PR that will resolve this.
        // tslint:disable-next-line: no-require-imports
        const vscode = require('vscode');
        return vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    }

    //****************************
    // fs-extra

    public fileExistsSync(filename: string): boolean {
        return fsextra.existsSync(filename);
    }

    public async readFile(filename: string): Promise<string> {
        return fsextra.readFile(filename, ENCODING);
    }

    public async writeFile(filename: string, data: {}): Promise<void> {
        const options: fsextra.WriteFileOptions = {
            encoding: ENCODING
        };
        await fsextra.writeFile(filename, data, options);
    }

    public async createDirectory(dirname: string): Promise<void> {
        return fsextra.mkdirp(dirname);
    }

    public async deleteDirectory(dirname: string): Promise<void> {
        return fsextra.rmdir(dirname);
    }

    public async deleteFile(filename: string): Promise<void> {
        return fsextra.unlink(filename);
    }

    public async chmod(filename: string, mode: string): Promise<void> {
        return fsextra.chmod(filename, mode);
    }

    //****************************
    // fs

    public createWriteStream(filename: string): WriteStream {
        return fs.createWriteStream(filename);
    }

    //****************************
    // helpers

    public arePathsSame(path1: string, path2: string): boolean {
        path1 = path.normalize(path1);
        path2 = path.normalize(path2);
        if (this.platformService.isWindows) {
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
            stat = await fsextra.stat(filename);
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

    public async listdir(
        dirname: string
    ): Promise<[string, FileType][]> {
        const filenames: string[] = await (
            fsextra.readdir(dirname)
                .then(names => names.map(name => path.join(dirname, name)))
                .catch(() => [])
        );
        const promises = filenames
            .map(filename => (
                 fsextra.stat(filename)
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
        const filePath = path.join(dirname, '___vscpTest___');
        return new Promise<boolean>(resolve => {
            fs.open(filePath, fs.constants.O_CREAT | fs.constants.O_RDWR, (error, fd) => {
                if (!error) {
                    fs.close(fd, () => {
                        fs.unlink(filePath, noop);
                    });
                }
                return resolve(!!error);
            });
        });
    }

    public async copyFile(src: string, dest: string): Promise<void> {
        const deferred = createDeferred<void>();
        const rs = fsextra.createReadStream(src)
            .on('error', (err) => {
                deferred.reject(err);
            });
        const ws = fsextra.createWriteStream(dest)
            .on('error', (err) => {
                deferred.reject(err);
            }).on('close', () => {
                deferred.resolve();
            });
        rs.pipe(ws);
        return deferred.promise;
    }

    public async getFileHash(filename: string): Promise<string> {
        const stat = await fsextra.lstat(filename);
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
