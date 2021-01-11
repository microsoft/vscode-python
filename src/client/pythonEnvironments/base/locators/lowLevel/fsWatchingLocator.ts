// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { DiscoveryVariants } from '../../../../common/experiments/groups';
import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { sleep } from '../../../../common/utils/async';
import { inExperiment } from '../../../common/externalDependencies';
import { watchLocationForPythonBinaries } from '../../../common/pythonBinariesWatcher';
import { PythonEnvKind } from '../../info';
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';

export enum FSWatcherKind {
    Global, // Watcher observes a global location such as ~/.envs, %LOCALAPPDATA%/Microsoft/WindowsApps.
    Workspace, // Watchers observes directory in the user's currently open workspace.
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
             * FS watcher kind to control global and workspace locators.
             */
            watcherKind: FSWatcherKind;
        },
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
        if (this.opts.watcherKind === FSWatcherKind.Global) {
            // Enable global watchers only if the experiment allows it.
            enableGlobalWatchers = await inExperiment(DiscoveryVariants.discoverWithFileWatching);
        }

        roots.forEach((root) => {
            if (enableGlobalWatchers) {
                this.startWatcher(root);
            }
        });
    }

    private startWatcher(root: string): void {
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
            this.emitter.fire({ type, kind });
        };
        this.disposables.push(watchLocationForPythonBinaries(root, callback, this.opts.executableBaseGlob));
    }
}
