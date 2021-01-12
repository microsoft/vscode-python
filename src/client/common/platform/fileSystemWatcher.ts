// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as chokidar from 'chokidar';
import * as path from 'path';
import { RelativePattern, workspace } from 'vscode';
import { traceError, traceVerbose } from '../logger';
import { Disposables, IDisposable } from '../utils/resourceLifecycle';
import { normCasePath } from './fs-paths';

/**
 * Enumeration of file change types.
 */
export enum FileChangeType {
    Changed = 'changed',
    Created = 'created',
    Deleted = 'deleted',
}
const POLLING_INTERVAL = 5000;

export function watchLocationForPattern(
    baseDir: string,
    pattern: string,
    callback: (type: FileChangeType, absPath: string) => void,
): IDisposable {
    // Use VSCode API iff base directory to exists within the current workspace folders
    const found = workspace.workspaceFolders?.find((e) => normCasePath(baseDir).startsWith(normCasePath(e.uri.fsPath)));
    if (found) {
        return watchLocationUsingVSCodeAPI(baseDir, pattern, callback);
    }
    // Fallback to chokidar as base directory to lookup doesn't exist within the current workspace folders
    return watchLocationUsingChokidar(baseDir, pattern, callback);
}

function watchLocationUsingVSCodeAPI(
    baseDir: string,
    pattern: string,
    callback: (type: FileChangeType, absPath: string) => void,
): IDisposable {
    const globPattern = new RelativePattern(baseDir, pattern);
    const disposables = new Disposables();
    traceVerbose(`Start watching: ${baseDir} with pattern ${pattern} using VSCode API`);
    const watcher = workspace.createFileSystemWatcher(globPattern);
    disposables.push(watcher.onDidCreate((e) => callback(FileChangeType.Created, e.fsPath)));
    disposables.push(watcher.onDidChange((e) => callback(FileChangeType.Changed, e.fsPath)));
    disposables.push(watcher.onDidDelete((e) => callback(FileChangeType.Deleted, e.fsPath)));
    return disposables;
}

function watchLocationUsingChokidar(
    baseDir: string,
    pattern: string,
    callback: (type: FileChangeType, absPath: string) => void,
): IDisposable {
    const watcherOpts: chokidar.WatchOptions = {
        cwd: baseDir,
        ignoreInitial: true,
        ignorePermissionErrors: true,
        // While not used in normal cases, if any error causes chokidar to fallback to polling, increase its intervals
        interval: POLLING_INTERVAL,
        binaryInterval: POLLING_INTERVAL,
        /* 'depth' doesn't matter given regex restricts the depth to 2, same goes for other properties below
         * But using them just to be safe in case it's misused */
        depth: 2,
        ignored: [
            '**/Lib/**',
            '**/.git/**',
            '**/node_modules/*/**',
            '**/.hg/store/**',
            '/dev/**',
            '/proc/**',
            '/sys/**',
            '**/lib/**',
            '**/includes/**',
        ], // https://github.com/microsoft/vscode/issues/23954
        followSymlinks: true,
    };
    traceVerbose(`Start watching: ${baseDir} with pattern ${pattern} using chokidar`);
    let watcher: chokidar.FSWatcher | null = chokidar.watch(pattern, watcherOpts);
    watcher.on('all', (type: string, e: string) => {
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

    const stopWatcher = async () => {
        if (watcher) {
            const obj = watcher;
            watcher = null;
            try {
                await obj.close();
            } catch (err) {
                traceError(`Failed to close FS watcher (${err})`);
            }
        }
    };

    watcher.on('error', async (error: NodeJS.ErrnoException) => {
        if (error) {
            // Specially handle ENOSPC errors that can happen when
            // the watcher consumes so many file descriptors that
            // we are running into a limit. We only want to warn
            // once in this case to avoid log spam.
            // See https://github.com/Microsoft/vscode/issues/7950
            if (error.code === 'ENOSPC') {
                traceError(`Inotify limit reached (ENOSPC) for ${baseDir} with pattern ${pattern}`);
                await stopWatcher();
            } else {
                traceVerbose(error.toString());
            }
        }
    });

    return { dispose: () => stopWatcher().ignoreErrors() };
}
