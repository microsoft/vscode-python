// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import { IS_WINDOWS } from '../util';

export const PATH_VARIABLE_NAME = IS_WINDOWS ? 'Path' : 'PATH';

export function fsExistsAsync(filePath: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        fs.exists(filePath, exists => {
            return resolve(exists);
        });
    });
}
export function fsReaddirAsync(root: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(root, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            resolve(subDirs.map(subDir => path.join(root, subDir)));
        });
    });
}

export function getSubDirectories(rootDir: string): Promise<string[]> {
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
                }
                // tslint:disable-next-line:no-empty one-line
                catch (ex) { }
            });
            resolve(subDirs);
        });
    });
}

export function arePathsSame(path1: string, path2: string) {
    path1 = path.normalize(path1);
    path2 = path.normalize(path2);
    if (IS_WINDOWS) {
        return path1.toUpperCase() === path2.toUpperCase();
    } else {
        return path1 === path2;
    }
}

export function createTemporaryFile(extension: string, temporaryDirectory?: string): Promise<{ filePath: string; cleanupCallback: Function }> {
    // tslint:disable-next-line:no-any
    const options: any = { postfix: extension };
    if (temporaryDirectory) {
        options.dir = temporaryDirectory;
    }

    return new Promise<{ filePath: string; cleanupCallback: Function }>((resolve, reject) => {
        tmp.file(options, (err, tmpFile, fd, cleanupCallback) => {
            if (err) {
                return reject(err);
            }
            resolve({ filePath: tmpFile, cleanupCallback: cleanupCallback });
        });
    });
}
