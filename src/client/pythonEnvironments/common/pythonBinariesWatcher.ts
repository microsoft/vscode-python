// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as minimatch from 'minimatch';
import * as path from 'path';
import { Disposable } from 'vscode';
import { FileChangeType, watchLocationForPattern } from '../../common/platform/fileSystemWatcher';
import { getOSType, OSType } from '../../common/utils/platform';

const [executable, binName] = getOSType() === OSType.Windows ? ['python.exe', 'Scripts'] : ['python', 'bin'];

export function watchLocationForPythonBinaries(
    baseDir: string,
    callback: (type: FileChangeType, absPath: string) => void,
    executableGlob: string = executable,
): Disposable {
    const patterns = [executableGlob, `*/${executableGlob}`, `*/${binName}/${executableGlob}`];
    const disposables: Disposable[] = [];
    for (const pattern of patterns) {
        disposables.push(watchLocationForPattern(baseDir, pattern, (type: FileChangeType, e: string) => {
            const isMatch = minimatch(e, path.join('**', executableGlob), { nocase: getOSType() === OSType.Windows });
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
