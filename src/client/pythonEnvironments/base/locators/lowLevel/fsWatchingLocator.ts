// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import { Uri } from 'vscode';
import { DiscoveryVariants } from '../../../../common/experiments/groups';
import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { sleep } from '../../../../common/utils/async';
import { getEnvironmentDirFromPath } from '../../../common/commonUtils';
import { inExperiment } from '../../../common/externalDependencies';
import {
    PythonEnvStructure,
    resolvePythonExeGlobs,
    watchLocationForPythonBinaries,
} from '../../../common/pythonBinariesWatcher';
import { PythonEnvKind } from '../../info';
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';

export enum FSWatcherKind {
    Global, // Watcher observes a global location such as ~/.envs, %LOCALAPPDATA%/Microsoft/WindowsApps.
    Workspace, // Watchers observes directory in the user's currently open workspace.
}

/**
 * Determine if the directory is watchable.
 */
export function isDirWatchable(dirname: string): boolean {
    let names: string[];
    try {
        names = fs.readdirSync(dirname);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // We treat a missing directory as watchable since it should
            // be watchable if created later.
            return true;
        }
        throw err; // re-throw
    }
    // The limit here is an educated guess.
    return names.length < 200;
}

/**
 * The base for Python envs locators who watch the file system.
 * Most low-level locators should be using this.
 *
 * Subclasses can call `this.emitter.fire()` * to emit events.
 */
export abstract class FSWatchingLocator extends LazyResourceBasedLocator {
    constructor(
        /**
         * Location(s) to watch for python binaries.
         */
        private readonly getRoots: () => Promise<string[]> | string | string[],
        /**
         * Returns the kind of environment specific to locator given the path to executable.
         */
        private readonly getKind: (executable: string) => Promise<PythonEnvKind>,
        private readonly opts: {
            /**
             * Glob which represents basename of the executable to watch.
             */
            executableBaseGlob?: string;
            /**
             * Time to wait before handling an environment-created event.
             */
            delayOnCreated?: number; // milliseconds
            /**
             * Location affected by the event. If not provided, a default search location is used.
             */
            searchLocation?: string;
        } = {},
        private readonly watcherKind: FSWatcherKind = FSWatcherKind.Global,
    ) {
        super();
    }

    protected async initWatchers(): Promise<void> {
        // Start the FS watchers.
        let roots = await this.getRoots();
        if (typeof roots === 'string') {
            roots = [roots];
        }

        // Enable all workspace watchers.
        let enableGlobalWatchers = true;
        if (this.watcherKind === FSWatcherKind.Global) {
            // Enable global watchers only if the experiment allows it.
            enableGlobalWatchers = await inExperiment(DiscoveryVariants.discoverWithFileWatching);
        }

        roots.forEach((root) => {
            if (enableGlobalWatchers) {
                this.startWatchers(root);
            }
        });
    }

    private startWatchers(root: string): void {
        if (!isDirWatchable(root)) {
            throw Error(`dir "${root}" is not watchable`);
        }

        const callback = async (type: FileChangeType, executable: string) => {
            if (type === FileChangeType.Created) {
                if (this.opts.delayOnCreated !== undefined) {
                    // Note detecting kind of env depends on the file structure around the
                    // executable, so we need to wait before attempting to detect it.
                    await sleep(this.opts.delayOnCreated);
                }
            }
            // Fetching kind after deletion normally fails because the file structure around the
            // executable is no longer available, so ignore the errors.
            const kind = await this.getKind(executable).catch(() => undefined);
            // By default, search location particularly for virtual environments is intended as the
            // directory in which the environment was found in. For eg. the default search location
            // for an env containing 'bin' or 'Scripts' directory is:
            //
            // searchLocation <--- Default search location directory
            // |__ env
            //    |__ bin or Scripts
            //        |__ python  <--- executable
            const searchLocation = Uri.file(
                this.opts.searchLocation ?? path.dirname(getEnvironmentDirFromPath(executable)),
            );
            this.emitter.fire({ type, kind, searchLocation });
        };

        const globs = resolvePythonExeGlobs(
            this.opts.executableBaseGlob,
            // For now we always watch a standard structure.
            PythonEnvStructure.Standard,
        );
        const watchers = globs.map((g) => watchLocationForPythonBinaries(root, callback, g));
        this.disposables.push(...watchers);
    }
}
