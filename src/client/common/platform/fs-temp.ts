// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as tmp from 'tmp';
import { TemporaryFile } from './types';

interface IRawTempFS {
    // tslint:disable-next-line:no-any
    file(config: tmp.Options, callback?: (err: any, path: string, fd: number, cleanupCallback: () => void) => void): void;
}

export class TemporaryFileSystem {
    // prettier-ignore
    constructor(
        private readonly raw: IRawTempFS
    ) { }
    public static withDefaults(): TemporaryFileSystem {
        // prettier-ignore
        return new TemporaryFileSystem(
            tmp
        );
    }

    public createFile(suffix: string): Promise<TemporaryFile> {
        const opts = {
            postfix: suffix
        };
        return new Promise<TemporaryFile>((resolve, reject) => {
            this.raw.file(opts, (err, filename, _fd, cleanUp) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    filePath: filename,
                    dispose: cleanUp
                });
            });
        });
    }
}
