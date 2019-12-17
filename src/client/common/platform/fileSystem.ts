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
import { FileStat } from 'vscode';
import { createDeferred } from '../utils/async';
import { noop } from '../utils/misc';
import { IFileSystem, IPlatformService, TemporaryFile } from './types';

const globAsync = promisify(glob);

@injectable()
export class FileSystem implements IFileSystem {
    constructor(@inject(IPlatformService) private platformService: IPlatformService) {}

    public get directorySeparatorChar(): string {
        return path.sep;
    }
    public async stat(filePath: string): Promise<FileStat> {
        // Do not import vscode directly, as this isn't available in the Debugger Context.
        // If stat is used in debugger context, it will fail, however theres a separate PR that will resolve this.
        // tslint:disable-next-line: no-require-imports
        const vscode = require('vscode');
        return vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    }

    public objectExists(filePath: string, statCheck: (s: fs.Stats) => boolean): Promise<boolean> {
        return new Promise<boolean>(resolve => {
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
    /**
     * Reads the contents of the file using utf8 and returns the string contents.
     * @param {string} filePath
     * @returns {Promise<string>}
     * @memberof FileSystem
     */
    public readFile(filePath: string): Promise<string> {
        return fs.readFile(filePath, 'utf8');
    }
    public readData(filePath: string): Promise<Buffer> {
        return fs.readFile(filePath);
    }

    public async writeFile(filePath: string, data: {}, options: string | fs.WriteFileOptions = { encoding: 'utf8' }): Promise<void> {
        await fs.writeFile(filePath, data, options);
    }

    public directoryExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, stats => stats.isDirectory());
    }

    public createDirectory(directoryPath: string): Promise<void> {
        return fs.mkdirp(directoryPath);
    }

    public deleteDirectory(directoryPath: string): Promise<void> {
        const deferred = createDeferred<void>();
        fs.rmdir(directoryPath, err => (err ? deferred.reject(err) : deferred.resolve()));
        return deferred.promise;
    }

    public async listdir(root: string): Promise<string[]> {
        return new Promise<string[]>(resolve => {
            // Now look for Interpreters in this directory
            fs.readdir(root, (err, names) => {
                if (err) {
                    return resolve([]);
                }
                resolve(names.map(name => path.join(root, name)));
            });
        });
    }

    public getSubDirectories(rootDir: string): Promise<string[]> {
        return new Promise<string[]>(resolve => {
            fs.readdir(rootDir, async (error, files) => {
                if (error) {
                    return resolve([]);
                }
                const subDirs = (await Promise.all(
                    files.map(async name => {
                        const fullPath = path.join(rootDir, name);
                        try {
                            if ((await fs.stat(fullPath)).isDirectory()) {
                                return fullPath;
                            }
                            // tslint:disable-next-line:no-empty
                        } catch (ex) {}
                    })
                )).filter(dir => dir !== undefined) as string[];
                resolve(subDirs);
            });
        });
    }

    public async getFiles(rootDir: string): Promise<string[]> {
        const files = await fs.readdir(rootDir);
        return files.filter(async f => {
            const fullPath = path.join(rootDir, f);
            if ((await fs.stat(fullPath)).isFile()) {
                return true;
            }
            return false;
        });
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

    public appendFile(filename: string, data: {}): Promise<void> {
        return fs.appendFile(filename, data);
    }
    public appendFileSync(filename: string, data: {}, encoding: string): void;
    public appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: number; flag?: string }): void;
    // tslint:disable-next-line:unified-signatures
    public appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: string; flag?: string }): void;
    public appendFileSync(filename: string, data: {}, optionsOrEncoding: {}): void {
        return fs.appendFileSync(filename, data, optionsOrEncoding);
    }

    public getRealPath(filePath: string): Promise<string> {
        return new Promise<string>(resolve => {
            fs.realpath(filePath, (err, realPath) => {
                resolve(err ? filePath : realPath);
            });
        });
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

    public createReadStream(filePath: string): fileSystem.ReadStream {
        return fileSystem.createReadStream(filePath);
    }

    public createWriteStream(filePath: string): fileSystem.WriteStream {
        return fileSystem.createWriteStream(filePath);
    }

    public chmod(filePath: string, mode: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fileSystem.chmod(filePath, mode, (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    public readFileSync(filePath: string): string {
        return fs.readFileSync(filePath, 'utf8');
    }

    public async move(src: string, tgt: string) {
        await fs.rename(src, tgt);
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
