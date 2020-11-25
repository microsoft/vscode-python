// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { FileChangeType } from '../../../../common/platform/fileSystemWatcher';
import { createDeferred, Deferred, sleep } from '../../../../common/utils/async';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
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
    private readonly disposables = new Disposables();

    // This will be set only once we have to create necessary resources
    // and resolves once those resources are ready.
    private ready?: Deferred<void>;

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
        } = {},
    ) {
        super();
    }

    public async dispose(): Promise<void> {
        await this.disposables.dispose();
    }

    public async* iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        await this.ensureResourcesReady();
        yield* this.doIterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        await this.ensureResourcesReady();
        return this.doResolveEnv(env);
    }

    /**
     * The subclass implementation of iterEnvs().
     */
    protected abstract doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator;

    /**
     * The subclass implementation of resolveEnv().
     */
    protected abstract async doResolveEnv(_env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined>;

    private async ensureResourcesReady(): Promise<void> {
        if (this.ready !== undefined) {
            await this.ready.promise;
            return;
        }
        this.ready = createDeferred<void>();
        const disposables = await this.startWatchers();
        this.disposables.push(...disposables);
        this.ready.resolve();
    }

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
                // Fetching kind after deletion normally fails because the file structure around the
                // executable is no longer available, so ignore the errors.
                const kind = await this.getKind(executable).catch(() => undefined);
                this.emitter.fire({ type, kind });
            },
            this.opts.executableBaseGlob,
        );
    }
}
