// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { createDeferred } from '../helpers';
import { IFileSystem, IPlatformService } from './types';

@injectable()
export class FileSystem implements IFileSystem {
    constructor(@inject(IPlatformService) private platformService: IPlatformService) { }

    public get directorySeparatorChar(): string {
        return path.sep;
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
        return this.objectExists(filePath, (stats) => stats.isFile());
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
        return fs.readFile(filePath).then(buffer => buffer.toString());
    }

    public directoryExists(filePath: string): Promise<boolean> {
        return this.objectExists(filePath, (stats) => stats.isDirectory());
    }

    public createDirectory(directoryPath: string): Promise<void> {
        return fs.mkdirp(directoryPath);
    }

    public getSubDirectories(rootDir: string): Promise<string[]> {
        return new Promise<string[]>(resolve => {
            fs.readdir(rootDir, (error, files) => {
                if (error) {
                    return resolve([]);
                }
                const subDirs: string[] = [];
                files.forEach(name => {
                    const fullPath = path.join(rootDir, name);
                    try {
                        if (fs.statSync(fullPath).isDirectory()) {
                            subDirs.push(fullPath);
                        }
                        // tslint:disable-next-line:no-empty
                    } catch (ex) { }
                });
                resolve(subDirs);
            });
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
        const rs = fs.createReadStream(src).on('error', (err) => {
            deferred.reject(err);
        });
        const ws = fs.createWriteStream(dest).on('error', (err) => {
            deferred.reject(err);
        }).on('close', () => {
            deferred.resolve();
        });
        rs.pipe(ws);
        return deferred.promise;
    }

    public deleteFile(filename: string): Promise<void> {
        const deferred = createDeferred<void>();
        fs.unlink(filename, err => err ? deferred.reject(err) : deferred.resolve());
        return deferred.promise;
    }
    public getFileHash(filePath: string): Promise<string | undefined> {
        return new Promise<string | undefined>(resolve => {
            fs.lstat(filePath, (err, stats) => {
                if (err) {
                    resolve();
                } else {
                    const actual = createHash('sha512').update(`${stats.ctimeMs}-${stats.mtimeMs}`).digest('hex');
                    resolve(actual);
                }
            });
        });
    }
}
