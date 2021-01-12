// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import * as path from 'path';
import { DiscoveryVariants } from '../../../../common/experiments/groups';
import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { sleep } from '../../../../common/utils/async';
import { getEnvironmentDirFromPath } from '../../../common/commonUtils';
import { inExperiment } from '../../../common/externalDependencies';
import { watchLocationForPythonBinaries } from '../../../common/pythonBinariesWatcher';
import { PythonEnvKind } from '../../info';
import { LazyResourceBasedLocator } from '../common/resourceBasedLocator';

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
         * Returns the kind of environment specific to locator given the path to exectuable.
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
    ) {
        super();
    }

    protected async initWatchers(): Promise<void> {
        if (await inExperiment(DiscoveryVariants.discoverWithFileWatching)) {
            // Start the FS watchers.
            let roots = await this.getRoots();
            if (typeof roots === 'string') {
                roots = [roots];
            }
            roots.forEach((root) => this.startWatcher(root));
        }
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
        this.disposables.push(watchLocationForPythonBinaries(root, callback, this.opts.executableBaseGlob));
    }
}
