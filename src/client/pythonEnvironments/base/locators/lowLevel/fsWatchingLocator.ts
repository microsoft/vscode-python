// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { sleep } from '../../../../common/utils/async';
import { watchLocationForPythonBinaries } from '../../../common/pythonBinariesWatcher';
import { PythonEnvKind } from '../../info';
import { Locator } from '../../locator';

/**
 * The base for Python envs locators who watch the file system.
 * Most low-level locators should be using this.
 *
 * Subclasses can call `this.emitter.fire()` * to emit events.
 */
export abstract class FSWatchingLocator extends Locator {
    private initialized = false;

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
            executableBaseGlob?: string,
            /**
             * Time to wait before handling an environment-created event.
             */
            delayOnCreated?: number, // milliseconds
        } = {},
    ) {
        super();
    }

    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.startWatchers().ignoreErrors();
    }

    public dispose(): void {
        super.dispose();
        this.initialized = false;
    }

    private async startWatchers(): Promise<void> {
        let roots = await this.getRoots();
        if (typeof roots === 'string') {
            roots = [roots];
        }
        roots.forEach((root) => this.startWatcher(root));
    }

    private startWatcher(root: string): void {
        this.disposables.push(
            watchLocationForPythonBinaries(
                root,
                async (type: FileChangeType, executable: string) => {
                    if (type === FileChangeType.Created) {
                        if (this.opts.delayOnCreated !== undefined) {
                            // Note detecting kind of env depends on the file structure around the
                            // executable, so we need to wait before attempting to detect it.
                            await sleep(this.opts.delayOnCreated);
                        }
                    }
                    const kind = await this.getKind(executable);
                    this.emitter.fire({ type, kind });
                },
                this.opts.executableBaseGlob,
            ),
        );
    }
}
