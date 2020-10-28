// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { FileChangeType, watchLocationForPattern } from '../../common/platform/fileSystemWatcher';
import { getOSType, OSType } from '../../common/utils/platform';

const [executable, binName] = getOSType() === OSType.Windows ? ['python.exe', 'Scripts'] : ['python', 'bin'];
const patterns = [executable, `*/${executable}`, `*/${binName}/${executable}`];

export function watchLocationForPythonBinaries(
    baseDir: string,
    callback: (type: FileChangeType, absPath: string) => void,
): void {
    for (const pattern of patterns) {
        watchLocationForPattern(baseDir, pattern, (type: FileChangeType, e: string) => {
            if (!e.endsWith(executable)) {
                // When deleting the file for some reason path to all directories leading up to python are reported
                // Skip those events
                return;
            }
            callback(type, e);
        });
    }
}
