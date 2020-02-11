// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as tmp from 'tmp';
import { ITempFileSystem, TemporaryFile } from './types';

interface IRawTempFS {
    // tslint:disable-next-line:no-suspicious-comment
    // TODO (https://github.com/microsoft/vscode/issues/84517)
    //   This functionality has been requested for the
    //   VS Code FS API (vscode.workspace.fs.*).
    // tslint:disable-next-line:no-any
    file(config: tmp.Options, callback?: (err: any, path: string, fd: number, cleanupCallback: () => void) => void): void;
}

// Operations related to temporary files and directories.
export class TemporaryFileSystem implements ITempFileSystem {
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

    // Create a new temp file with the given filename suffix.
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
