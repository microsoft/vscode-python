// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { sleep } from '../../../../common/utils/async';
import { disposeAll, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { watchLocationForPythonBinaries } from '../../../common/pythonBinariesWatcher';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import { IPythonEnvsIterator, Locator, PythonLocatorQuery } from '../../locator';

/**
 * The base for Python envs locators who watch the file system.
 * Most low-level locators should be using this.
 *
 * Subclasses can call `this.emitter.fire()` * to emit events.
 */
export abstract class FSWatchingLocator extends Locator {
    private disposables: IDisposable[] | undefined;

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

    public async dispose(): Promise<void> {
        if (this.disposables !== undefined) {
            // tslint:disable-next-line:no-this-assignment
            const { disposables } = this;
            this.disposables = undefined;
            await disposeAll(disposables);
        }
    }

    public async* iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        if (this.disposables === undefined) {
            this.disposables = await this.startWatchers();
        }
        yield* this.doIterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (this.disposables === undefined) {
            this.disposables = await this.startWatchers();
        }
        return this.doResolveEnv(env);
    }

    protected abstract doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator;

    protected abstract async doResolveEnv(_env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined>;

    private async startWatchers(): Promise<IDisposable[]> {
        let roots = await this.getRoots();
        if (typeof roots === 'string') {
            roots = [roots];
        }
        const disposables: IDisposable[] = [];
        roots.forEach((root) => disposables.push(...this.startWatcher(root)));
        return disposables;
    }

    private startWatcher(root: string): IDisposable[] {
        return watchLocationForPythonBinaries(
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
        );
    }
}
