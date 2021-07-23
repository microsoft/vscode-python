// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as tmp from 'tmp';
import { TemporaryFile } from '../../../common/platform/types';

export function createTemporaryFile(ext = '.tmp'): Promise<TemporaryFile> {
    return new Promise<TemporaryFile>((resolve, reject) => {
        tmp.file({ postfix: ext }, (err, filename, _fd, cleanUp): void => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    filePath: filename,
                    dispose: cleanUp,
                });
            }
        });
    });
}
