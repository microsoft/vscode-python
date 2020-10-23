// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as chokidar from 'chokidar';
import * as path from 'path';
import { FileChangeType, RelativePattern, workspace } from 'vscode';
import { traceError, traceVerbose, traceWarning } from '../../common/logger';
import { getOSType, OSType } from '../../common/utils/platform';
import { normCasePath } from './externalDependencies';

const POLLING_INTERVAL = 5000;
const os = getOSType();
const [executable, binName] = os === OSType.Windows ? ['python.exe', 'Scripts'] : ['python', 'bin'];
const patterns = [executable, `*/${executable}`, `*/${binName}/${executable}`];

export function watchLocationForPythonBinaries(
    baseDir: string,
    callback: (type: FileChangeType, absPath: string) => void,
): void {
    traceVerbose(`Start watching: ${baseDir} for Python binaries`);
    // Use VSCode API if base directory to exists within the current workspace folders
    const folders = workspace.workspaceFolders;
    if (folders) {
        const found = folders.find((folder) => normCasePath(baseDir).startsWith(normCasePath(folder.uri.fsPath)));
        if (found) {
            watchLocationUsingVSCodeAPI(baseDir, callback);
        }
    }
    // Fallback to chokidar if base directory to lookup doesn't exist within the current workspace folders
    watchLocationUsingChokidar(baseDir, callback);
}

function watchLocationUsingVSCodeAPI(baseDir: string, callback: (type: FileChangeType, absPath: string) => void) {
    for (const pattern of patterns) {
        const globPattern = new RelativePattern(baseDir, pattern);
        const watcher = workspace.createFileSystemWatcher(globPattern);
        watcher.onDidCreate((e) => callback(FileChangeType.Created, e.fsPath));
        watcher.onDidChange((e) => callback(FileChangeType.Changed, e.fsPath));
        watcher.onDidDelete((e) => callback(FileChangeType.Deleted, e.fsPath));
    }
}

function watchLocationUsingChokidar(baseDir: string, callback: (type: FileChangeType, absPath: string) => void) {
    const watcherOpts: chokidar.WatchOptions = {
        cwd: baseDir,
        ignoreInitial: true,
        ignorePermissionErrors: true,
        // While not used in normal cases, if any error causes chokidar to fallback to polling, increase its intervals
        interval: POLLING_INTERVAL,
        binaryInterval: POLLING_INTERVAL,
        // 'depth' doesn't matter rn given regex already restricts the depth to 2, same goes for other properties below
        // But using them just to be safe in case regex is modified
        depth: 2,
        ignored: ['**/Lib/**'],
        followSymlinks: false,
    };
    for (const pattern of patterns) {
        let watcher: chokidar.FSWatcher | null = chokidar.watch(pattern, watcherOpts);
        watcher.on('all', (type: string, e: string) => {
            if (!e.endsWith(executable)) {
                // When deleting the file for some reason path to all directories leading up to python are reported
                // Skip those events
                return;
            }
            const absPath = path.join(baseDir, e);
            let eventType: FileChangeType;
            switch (type) {
                case 'change':
                    eventType = FileChangeType.Changed;
                    break;
                case 'add':
                case 'addDir':
                    eventType = FileChangeType.Created;
                    break;
                case 'unlink':
                case 'unlinkDir':
                    eventType = FileChangeType.Deleted;
                    break;
                default:
                    return;
            }
            callback(eventType, absPath);
        });

        watcher.on('error', async (error: NodeJS.ErrnoException) => {
            if (error) {
                // Specially handle ENOSPC errors that can happen when
                // the watcher consumes so many file descriptors that
                // we are running into a limit. We only want to warn
                // once in this case to avoid log spam.
                // See https://github.com/Microsoft/vscode/issues/7950
                if (error.code === 'ENOSPC') {
                    traceError('Inotify limit reached (ENOSPC)');
                    if (watcher) {
                        await watcher.close();
                        watcher = null;
                    }
                } else {
                    traceWarning(error.toString());
                }
            }
        });
    }
}
