// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { traceVerbose } from '../../../../common/logger';
import { getHashString } from '../../../../common/platform/fileSystem';

export async function getInterpreterHash(pythonPath: string): Promise<string> {
    let data = '';
    try {
        const stat = await fsapi.lstat(pythonPath);
        data = `${stat.ctime.valueOf()}-${stat.mtime.valueOf()}`;
    } catch (err) {
        if (err.code === 'UNKNOWN') {
            // This is probably due to the following bug in node file system:
            // https://github.com/nodejs/node/issues/33024
            // https://github.com/nodejs/node/issues/36790
            // The work around does not work in all cases, especially for the
            // Windows Store python.

            try {
                // A soft alternative is to check the mtime of the parent directory and use the
                // path and mtime as hash. We don't want to run Python to determine this.
                const stat = await fsapi.lstat(path.dirname(pythonPath));
                data = `${stat.ctime.valueOf()}-${stat.mtime.valueOf()}-${pythonPath}`;
            } catch (err2) {
                traceVerbose('Error when computing file hash using parent directory: ', err2);
                throw err2;
            }
        } else {
            traceVerbose('Error when computing file hash: ', err);
        }
    }
    return getHashString(data);
}
