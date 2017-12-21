// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IServiceContainer } from '../../ioc/types';
import { IFileSystem, IPlatformService } from './types';

@injectable()
export class FileSystem implements IFileSystem {
    constructor( @inject(IServiceContainer) private platformService: IPlatformService) { }

    public get directorySeparatorChar(): string {
        return this.platformService.isWindows ? '\\' : '/';
    }

    public existsAsync(filePath: string): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            fs.exists(filePath, exists => {
                return resolve(exists);
            });
        });
    }

    public createDirectoryAsync(directoryPath: string): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            fs.mkdir(directoryPath, error => {
                return resolve(!error);
            });
        });
    }

    public getSubDirectoriesAsync(rootDir: string): Promise<string[]> {
        return new Promise<string[]>(resolve => {
            fs.readdir(rootDir, (error, files) => {
                if (error) {
                    return resolve([]);
                }
                const subDirs = [];
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
}
