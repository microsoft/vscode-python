// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { createHash } from 'crypto';
import * as fileSystem from 'fs';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { createDeferred } from '../utils/async';
import { noop } from '../utils/misc';
import { FileStat, FileType, IFileSystem, IPlatformService, TemporaryFile } from './types';

const globAsync = promisify(glob);

// This helper function determines the file type of the given stats
// object.  The type follows the convention of node's fs module, where
// a file has exactly one type.  Symlinks are not resolved.
function convertFileType(stat: fs.Stats): FileType {
    if (stat.isFile()) {
        return FileType.File;
    } else if (stat.isDirectory()) {
        return FileType.Directory;
    } else if (stat.isSymbolicLink()) {
        // The caller is responsible for combining this ("logical or")
        // with File or Directory as necessary.
        return FileType.SymbolicLink;
    } else {
        return FileType.Unknown;
    }
}

async function getFileType(filename: string): Promise<FileType> {
    let stat: fs.Stats;
    try {
        // Note that we used to use stat() here instead of lstat().
        // This shouldn't matter because the only consumers were
        // internal methods that have been updated appropriately.
        stat = await fs.lstat(filename);
    } catch {
        return FileType.Unknown;
    }
    if (!stat.isSymbolicLink()) {
        return convertFileType(stat);
    }

    // For symlinks we emulate the behavior of the vscode.workspace.fs API.
    // See: https://code.visualstudio.com/api/references/vscode-api#FileType
    try {
        stat = await fs.stat(filename);
    } catch {
        return FileType.SymbolicLink;
    }
    if (stat.isFile()) {
        return FileType.SymbolicLink | FileType.File;
    } else if (stat.isDirectory()) {
        return FileType.SymbolicLink | FileType.Directory;
    } else {
        return FileType.SymbolicLink;
    }
}

export function convertStat(old: fs.Stats, filetype: FileType): FileStat {
    return {
        type: filetype,
        size: old.size,
        // FileStat.ctime and FileStat.mtime only have 1-millisecond
        // resolution, while node provides nanosecond resolution.  So
        // for now we round to the nearest integer.
        // See: https://github.com/microsoft/vscode/issues/84526
        ctime: Math.round(old.ctimeMs),
        mtime: Math.round(old.mtimeMs)
    };
}

@injectable()
export class FileSystem implements IFileSystem {
    constructor(@inject(IPlatformService) private platformService: IPlatformService) {}

    //=================================
    // path-related

    public get directorySeparatorChar(): string {
        return path.sep;
    }

    public arePathsSame(path1: string, path2: string): boolean {
        path1 = path.normalize(path1);
        path2 = path.normalize(path2);
        if (this.platformService.isWindows) {
            return path1.toUpperCase() === path2.toUpperCase();
        } else {
            return path1 === path2;
        }
    }

    public getRealPath(filePath: string): Promise<string> {
        return new Promise<string>(resolve => {
            fs.realpath(filePath, (err, realPath) => {
                resolve(err ? filePath : realPath);
            });
        });
    }

    //=================================
    // "raw" operations

    public async stat(filePath: string): Promise<FileStat> {
        // Do not import vscode directly, as this isn't available in the Debugger Context.
        // If stat is used in debugger context, it will fail, however theres a separate PR that will resolve this.
        // tslint:disable-next-line: no-require-imports
        const vscode = require('vscode');
        // Note that, prior to the November release of VS Code,
        // stat.ctime was always 0.
        // See: https://github.com/microsoft/vscode/issues/84525
        return vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    }
    public async lstat(filename: string): Promise<FileStat> {
        const stat = await fs.lstat(filename);
        // Note that, unlike stat(), lstat() does not include the type
        // of the symlink's target.
        const fileType = convertFileType(stat);
        return convertStat(stat, fileType);
    }

    // Return the UTF8-decoded text of the file.
    public readFile(filePath: string): Promise<string> {
        return fs.readFile(filePath, 'utf8');
    }
    public readFileSync(filePath: string): string {
        return fs.readFileSync(filePath, 'utf8');
    }
    public readData(filePath: string): Promise<Buffer> {
        return fs.readFile(filePath);
    }

    public async writeFile(filePath: string, data: {}, options: string | fs.WriteFileOptions = { encoding: 'utf8' }): Promise<void> {
        await fs.writeFile(filePath, data, options);
    }

    public createDirectory(directoryPath: string): Promise<void> {
        return fs.mkdirp(directoryPath);
    }

    public deleteDirectory(directoryPath: string): Promise<void> {
        const deferred = createDeferred<void>();
        fs.rmdir(directoryPath, err => (err ? deferred.reject(err) : deferred.resolve()));
        return deferred.promise;
    }

    public async listdir(dirname: string): Promise<[string, FileType][]> {
        const files = await fs.readdir(dirname);
        const promises = files.map(async basename => {
            const filename = path.join(dirname, basename);
            const fileType = await getFileType(filename);
            return [filename, fileType] as [string, FileType];
        });
        return Promise.all(promises);
    }

    public appendFile(filename: string, data: {}): Promise<void> {
        return fs.appendFile(filename, data);
    }

    public copyFile(src: string, dest: string): Promise<void> {
        const deferred = createDeferred<void>();
        const rs = fs.createReadStream(src).on('error', err => {
            deferred.reject(err);
        });
        const ws = fs
            .createWriteStream(dest)
            .on('error', err => {
                deferred.reject(err);
            })
            .on('close', () => {
                deferred.resolve();
            });
        rs.pipe(ws);
        return deferred.promise;
    }

    public deleteFile(filename: string): Promise<void> {
        const deferred = createDeferred<void>();
        fs.unlink(filename, err => (err ? deferred.reject(err) : deferred.resolve()));
        return deferred.promise;
    }

    public chmod(filePath: string, mode: string | number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fileSystem.chmod(filePath, mode, (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    public async move(src: string, tgt: string) {
        await fs.rename(src, tgt);
    }

    public createReadStream(filePath: string): fileSystem.ReadStream {
        return fileSystem.createReadStream(filePath);
    }

    public createWriteStream(filePath: string): fileSystem.WriteStream {
        return fileSystem.createWriteStream(filePath);
    }

    //=================================
    // utils

    public objectExists(filePath: string, statCheck: (s: fs.Stats) => boolean): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            // Note that we are using stat() rather than lstat().  This
            // means that any symlinks are getting resolved.
            fs.stat(filePath, (error, stats) => {
                if (error) {
                    return resolve(false);
                }
                return resolve(statCheck(stats));
            });
        });
    }
    public fileExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, stats => stats.isFile());
    }
    public fileExistsSync(filePath: string): boolean {
        return fs.existsSync(filePath);
    }
    public directoryExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, stats => stats.isDirectory());
    }

    public async getSubDirectories(dirname: string): Promise<string[]> {
        let files: [string, FileType][];
        try {
            files = await this.listdir(dirname);
        } catch {
            // We're only preserving pre-existng behavior here...
            return [];
        }
        return files
            .filter(([_file, fileType]) => {
                // We preserve the pre-existing behavior of following
                // symlinks.
                return (fileType & FileType.Directory) > 0;
            })
            .map(([filename, _ft]) => filename);
    }
    public async getFiles(dirname: string): Promise<string[]> {
        let files: [string, FileType][];
        try {
            files = await this.listdir(dirname);
        } catch (err) {
            // This matches what getSubDirectories() does.
            if (!(await fs.pathExists(dirname))) {
                return [];
            }
            throw err; // re-throw
        }
        return files
            .filter(([_file, fileType]) => {
                // We preserve the pre-existing behavior of following
                // symlinks.
                return (fileType & FileType.File) > 0;
            })
            .map(([filename, _ft]) => filename);
    }

    public getFileHash(filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            fs.lstat(filePath, (err, stats) => {
                if (err) {
                    reject(err);
                } else {
                    const actual = createHash('sha512')
                        .update(`${stats.ctimeMs}-${stats.mtimeMs}`)
                        .digest('hex');
                    resolve(actual);
                }
            });
        });
    }

    public async search(globPattern: string, cwd?: string): Promise<string[]> {
        let found: string[];
        if (cwd) {
            const options = {
                cwd: cwd
            };
            found = await globAsync(globPattern, options);
        } else {
            found = await globAsync(globPattern);
        }
        return Array.isArray(found) ? found : [];
    }

    public createTemporaryFile(extension: string): Promise<TemporaryFile> {
        return new Promise<TemporaryFile>((resolve, reject) => {
            tmp.file({ postfix: extension }, (err, tmpFile, _, cleanupCallback) => {
                if (err) {
                    return reject(err);
                }
                resolve({ filePath: tmpFile, dispose: cleanupCallback });
            });
        });
    }

    public async isDirReadonly(dirname: string): Promise<boolean> {
        const filePath = `${dirname}${path.sep}___vscpTest___`;
        return new Promise<boolean>(resolve => {
            fs.open(filePath, fs.constants.O_CREAT | fs.constants.O_RDWR, (error, fd) => {
                if (!error) {
                    fs.close(fd, () => {
                        fs.unlink(filePath, noop);
                    });
                }
                return resolve(!error);
            });
        });
    }
}
