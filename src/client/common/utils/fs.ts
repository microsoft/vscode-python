// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

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

export function createTemporaryFile(extension: string, temporaryDirectory?: string): Promise<{ filePath: string; cleanupCallback: Function }> {
    // tslint:disable-next-line:no-any
    const options: any = { postfix: extension };
    if (temporaryDirectory) {
        options.dir = temporaryDirectory;
    }

    return new Promise<{ filePath: string; cleanupCallback: Function }>((resolve, reject) => {
        tmp.file(options, (err, tmpFile, _fd, cleanupCallback) => {
            if (err) {
                return reject(err);
            }
            resolve({ filePath: tmpFile, cleanupCallback: cleanupCallback });
        });
    });
}
