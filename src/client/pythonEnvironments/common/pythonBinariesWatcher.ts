// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as minimatch from 'minimatch';
import * as path from 'path';
import { Disposable } from 'vscode';
import { FileChangeType, watchLocationForPattern } from '../../common/platform/fileSystemWatcher';
import { getOSType, OSType } from '../../common/utils/platform';

const [executable, binName] = getOSType() === OSType.Windows ? ['python.exe', 'Scripts'] : ['python', 'bin'];

/**
 * @param baseDir The base directory from which watch paths are to be derived.
 * @param callback The listener function will be called when the event happens.
 * @param executableSuffixGlob Glob which represents suffix of the full executable file path to watch.
 */
export function watchLocationForPythonBinaries(
    baseDir: string,
    callback: (type: FileChangeType, absPath: string) => void,
    executableSuffixGlob: string = executable,
): Disposable {
    const patterns = [executableSuffixGlob, `*/${executableSuffixGlob}`, `*/${binName}/${executableSuffixGlob}`];
    const disposables: Disposable[] = [];
    for (const pattern of patterns) {
        disposables.push(watchLocationForPattern(baseDir, pattern, (type: FileChangeType, e: string) => {
            const isMatch = minimatch(e, path.join('**', executableSuffixGlob), { nocase: getOSType() === OSType.Windows });
            if (!isMatch) {
                // When deleting the file for some reason path to all directories leading up to python are reported
                // Skip those events
                return;
            }
            callback(type, e);
        }));
    }
    return {
        dispose: async () => {
            disposables.forEach((d) => d.dispose());
        },
    };
}
