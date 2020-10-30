// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as picomatch from 'picomatch';
import { FileChangeType, watchLocationForPattern } from '../../common/platform/fileSystemWatcher';
import { getOSType, OSType } from '../../common/utils/platform';

const [executable, binName] = getOSType() === OSType.Windows ? ['python.exe', 'Scripts'] : ['python', 'bin'];

export function watchLocationForPythonBinaries(
    baseDir: string,
    callback: (type: FileChangeType, absPath: string) => void,
    executablePattern: string = executable,
): void {
    const patterns = [executablePattern, `*/${executablePattern}`, `*/${binName}/${executablePattern}`];
    for (const pattern of patterns) {
        watchLocationForPattern(baseDir, pattern, (type: FileChangeType, e: string) => {
            const isMatch = picomatch(executablePattern);
            if (!isMatch(path.basename(e))) {
                // When deleting the file for some reason path to all directories leading up to python are reported
                // Skip those events
                return;
            }
            callback(type, e);
        });
    }
}
