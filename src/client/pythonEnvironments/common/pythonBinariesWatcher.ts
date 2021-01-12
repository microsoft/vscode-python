// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as minimatch from 'minimatch';
import * as path from 'path';
import { FileChangeType, watchLocationForPattern } from '../../common/platform/fileSystemWatcher';
import { getOSType, OSType } from '../../common/utils/platform';
import { Disposables, IDisposable } from '../../common/utils/resourceLifecycle';

const [executable, binName] = getOSType() === OSType.Windows ? ['python.exe', 'Scripts'] : ['python', 'bin'];

/**
 * @param baseDir The base directory from which watch paths are to be derived.
 * @param callback The listener function will be called when the event happens.
 * @param executableBaseGlob Glob which represents basename of the executable to watch.
 */
export function watchLocationForPythonBinaries(
    baseDir: string,
    callback: (type: FileChangeType, absPath: string) => void,
    executableBaseGlob: string = executable,
): IDisposable {
    if (executableBaseGlob.includes(path.sep)) {
        throw new Error('Glob basename contains invalid characters');
    }
    function callbackClosure(type: FileChangeType, e: string) {
        const isMatch = minimatch(path.basename(e), executableBaseGlob, { nocase: getOSType() === OSType.Windows });
        if (!isMatch) {
            // When deleting the file for some reason path to all directories leading up to python are reported
            // Skip those events
            return;
        }
        callback(type, e);
    }

    return new Disposables(
        ...[executableBaseGlob, `*/${executableBaseGlob}`, `*/${binName}/${executableBaseGlob}`].map((pattern) =>
            watchLocationForPattern(baseDir, pattern, callbackClosure),
        ),
    );
}
