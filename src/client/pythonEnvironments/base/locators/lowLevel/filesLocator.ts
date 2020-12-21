// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, EventEmitter } from 'vscode';
import { normalizeFilename } from '../../../../common/utils/filesystem';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import { getFastEnvInfo } from '../../info/env';
import { ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, PythonLocatorQuery } from '../../locator';
import { iterAndUpdateEnvs, resolveEnvFromIterator } from '../../locatorUtils';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';

/**
 * A naive locator the wraps a function that finds Python executables.
 */
export class FoundFilesLocator implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    protected readonly watcher = new PythonEnvsWatcher();

    constructor(
        private readonly kind: PythonEnvKind,
        private readonly getExecutables: () => Promise<string[]> | AsyncIterableIterator<string>,
        onUpdated?: Event<void>,
    ) {
        this.onChanged = this.watcher.onChanged;

        if (onUpdated !== undefined) {
            onUpdated(() => this.watcher.fire({}));
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public iterEnvs(_query?: PythonLocatorQuery): IPythonEnvsIterator {
        const executablesPromise = this.getExecutables();
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        async function* generator(kind: PythonEnvKind): IPythonEnvsIterator {
            const executables = await executablesPromise;
            yield* iterAndUpdateEnvs(
                iterMinimalEnvsFromExecutables(executables, kind),
                (evt: PythonEnvUpdatedEvent | null) => emitter.fire(evt),
            );
        }
        const iterator = generator(this.kind);
        iterator.onUpdated = emitter.event;
        return iterator;
    }

    public async resolveEnv(env: string | Partial<PythonEnvInfo>): Promise<PythonEnvInfo | undefined> {
        const iterator = this.iterEnvs();
        return resolveEnvFromIterator(env, iterator);
    }
}

/**
 * Build minimal env info corresponding to each executable filename.
 */
async function* iterMinimalEnvsFromExecutables(
    executables: string[] | AsyncIterableIterator<string>,
    kind: PythonEnvKind,
): AsyncIterableIterator<PythonEnvInfo> {
    for await (const filename of executables) {
        const executable = normalizeFilename(filename);
        yield getFastEnvInfo(kind, executable);
    }
}
