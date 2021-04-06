// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import { Uri } from 'vscode';
import { DiscoveryVariants } from '../../../../common/experiments/groups';
import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { sleep } from '../../../../common/utils/async';
import { logError } from '../../../../logging';
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

type DirUnwatchableReason = 'too many files' | undefined;

/**
 * Determine if the directory is watchable.
 */
function checkDirWatchable(dirname: string): DirUnwatchableReason {
    let names: string[];
    try {
        names = fs.readdirSync(dirname);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // We treat a missing directory as watchable since it should
            // be watchable if created later.
            return undefined;
        }
        throw err; // re-throw
    }
    // The limit here is an educated guess.
    if (names.length > 200) {
        return 'too many files';
    }
    return undefined;
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
             * Glob which represents basename of the executable or directory to watch.
             */
            baseGlob?: string;
            /**
             * Time to wait before handling an environment-created event.
             */
            delayOnCreated?: number; // milliseconds
            /**
             * Location affected by the event. If not provided, a default search location is used.
             */
            searchLocation?: string;
            /**
             * The Python env structure to watch.
             */
            envStructure?: PythonEnvStructure;
        } = {},
        private readonly watcherKind: FSWatcherKind = FSWatcherKind.Global,
    ) {
        super();
    }

    protected async initWatchers(): Promise<void> {
        // Enable all workspace watchers.
        if (this.watcherKind === FSWatcherKind.Global) {
            // Enable global watchers only if the experiment allows it.
            const enableGlobalWatchers = await inExperiment(DiscoveryVariants.discoverWithFileWatching);
            if (!enableGlobalWatchers) {
                return;
            }
        }

        // Start the FS watchers.
        let roots = await this.getRoots();
        if (typeof roots === 'string') {
            roots = [roots];
        }
        const promises = roots.map(async (root) => {
            // Note that we only check the root dir.  Any directories
            // that might be watched due to a glob are not checked.
            const unwatchable = await checkDirWatchable(root);
            if (unwatchable) {
                logError(`dir "${root}" is not watchable (${unwatchable})`);
                return undefined;
            }
            return root;
        });
        const watchableRoots = (await Promise.all(promises)).filter((root) => !!root) as string[];

        watchableRoots.forEach((root) => this.startWatchers(root));
    }

    private startWatchers(root: string): void {
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
            this.opts.baseGlob,
            // The structure determines which globs are returned.
            this.opts.envStructure,
        );
        const watchers = globs.map((g) => watchLocationForPythonBinaries(root, callback, g));
        this.disposables.push(...watchers);
    }
}
