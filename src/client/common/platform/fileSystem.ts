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
import { FileStat } from 'vscode';
import { createDeferred } from '../utils/async';
import { IFileSystem, IPlatformService, TemporaryFile } from './types';

@injectable()
export class FileSystem implements IFileSystem {
    constructor(
        @inject(IPlatformService) private platformService: IPlatformService
    ) { }

    public async stat(filePath: string): Promise<FileStat> {
        // Do not import vscode directly, as this isn't available in the Debugger Context.
        // If stat is used in debugger context, it will fail, however theres a separate PR that will resolve this.
        // tslint:disable-next-line: no-require-imports
        const vscode = require('vscode');
        return vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    }

    //****************************
    // fs-extra

    public fileExistsSync(filePath: string): boolean {
        return fsextra.existsSync(filePath);
    }

    /**
     * Reads the contents of the file using utf8 and returns the string contents.
     * @param {string} filePath
     * @returns {Promise<string>}
     * @memberof FileSystem
     */
    public readFile(filePath: string): Promise<string> {
        return fsextra.readFile(filePath).then(buffer => buffer.toString());
    }

    public async writeFile(filePath: string, data: {}, options: string | fsextra.WriteFileOptions = { encoding: 'utf8' }): Promise<void> {
        await fsextra.writeFile(filePath, data, options);
    }

    public createDirectory(directoryPath: string): Promise<void> {
        return fsextra.mkdirp(directoryPath);
    }

    public deleteDirectory(directoryPath: string): Promise<void> {
        const deferred = createDeferred<void>();
        fsextra.rmdir(directoryPath, err => (err ? deferred.reject(err) : deferred.resolve()));
        return deferred.promise;
    }

    public appendFileSync(filename: string, data: {}, encoding: string): void;
    public appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: number; flag?: string }): void;
    // tslint:disable-next-line:unified-signatures
    public appendFileSync(filename: string, data: {}, options?: { encoding?: string; mode?: string; flag?: string }): void;
    public appendFileSync(filename: string, data: {}, optionsOrEncoding: {}): void {
        return fsextra.appendFileSync(filename, data, optionsOrEncoding);
    }

    public deleteFile(filename: string): Promise<void> {
        const deferred = createDeferred<void>();
        fsextra.unlink(filename, err => (err ? deferred.reject(err) : deferred.resolve()));
        return deferred.promise;
    }

    //****************************
    // fs

    public createWriteStream(filePath: string): fs.WriteStream {
        return fs.createWriteStream(filePath);
    }

    public chmod(filePath: string, mode: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.chmod(filePath, mode, (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
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

    public objectExists(filePath: string, statCheck: (s: fsextra.Stats) => boolean): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            fsextra.stat(filePath, (error, stats) => {
                if (error) {
                    return resolve(false);
                }
                return resolve(statCheck(stats));
            });
        });
    }

    public fileExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, (stats) => stats.isFile());
    }
    public directoryExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, stats => stats.isDirectory());
    }

    public getSubDirectories(rootDir: string): Promise<string[]> {
        return new Promise<string[]>(resolve => {
            fsextra.readdir(rootDir, async (error, files) => {
                if (error) {
                    return resolve([]);
                }
                const subDirs = (
                    await Promise.all(
                        files.map(async name => {
                            const fullPath = path.join(rootDir, name);
                            try {
                                if ((await fsextra.stat(fullPath)).isDirectory()) {
                                    return fullPath;
                                }
                                // tslint:disable-next-line:no-empty
                            } catch (ex) { }
                        })
                    ))
                    .filter(dir => dir !== undefined) as string[];
                resolve(subDirs);
            });
        });
    }

    public async getFiles(rootDir: string): Promise<string[]> {
        const files = await fsextra.readdir(rootDir);
        return files.filter(async f => {
            const fullPath = path.join(rootDir, f);
            if ((await fsextra.stat(fullPath)).isFile()) {
                return true;
            }
            return false;
        });
    }

    public copyFile(src: string, dest: string): Promise<void> {
        const deferred = createDeferred<void>();
        const rs = fsextra.createReadStream(src).on('error', (err) => {
            deferred.reject(err);
        });
        const ws = fsextra.createWriteStream(dest).on('error', (err) => {
            deferred.reject(err);
        }).on('close', () => {
            deferred.resolve();
        });
        rs.pipe(ws);
        return deferred.promise;
    }

    public getFileHash(filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            fsextra.lstat(filePath, (err, stats) => {
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

    public search(globPattern: string): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            glob(globPattern, (ex, files) => {
                if (ex) {
                    return reject(ex);
                }
                resolve(Array.isArray(files) ? files : []);
            });
        });
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
}
