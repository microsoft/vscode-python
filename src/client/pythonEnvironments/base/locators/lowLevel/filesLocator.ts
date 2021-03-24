// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event, EventEmitter } from 'vscode';
import { DirEntry } from '../../../../common/utils/filesystem';
import { iterPythonExecutablesInDir } from '../../../common/commonUtils';
import { identifyEnvironment } from '../../../common/environmentIdentifier';
import { resolvePath } from '../../../common/externalDependencies';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import { getFastEnvInfo } from '../../info/env';
import { ILocator, IPythonEnvsIterator, PythonEnvUpdatedEvent, PythonLocatorQuery } from '../../locator';
import { iterAndUpdateEnvs, resolveEnvFromIterator } from '../../locatorUtils';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';

type Executable = string | DirEntry;

type GetExecutablesFunc = () => Promise<Executable[]> | AsyncIterableIterator<Executable>;

/**
 * A naive locator the wraps a function that finds Python executables.
 */
class FoundFilesLocator implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    protected readonly watcher = new PythonEnvsWatcher();

    constructor(
        private readonly defaultKind: PythonEnvKind,
        // This is used only in iterEnvs().
        private readonly getExecutables: GetExecutablesFunc,
    ) {
        this.onChanged = this.watcher.onChanged;
    }

    public iterEnvs(_query?: PythonLocatorQuery): IPythonEnvsIterator {
        const executablesPromise = this.getExecutables();
        const emitter = new EventEmitter<PythonEnvUpdatedEvent | null>();
        async function* generator(defaultKind: PythonEnvKind): IPythonEnvsIterator {
            const executables = await executablesPromise;
            yield* iterAndUpdateEnvs(
                iterMinimalEnvsFromExecutables(executables, defaultKind),
                (evt: PythonEnvUpdatedEvent | null) => emitter.fire(evt),
            );
        }
        const iterator = generator(this.defaultKind);
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
    executables: Executable[] | AsyncIterableIterator<Executable>,
    defaultKind: PythonEnvKind,
): AsyncIterableIterator<PythonEnvInfo> {
    for await (const executable of executables) {
        const filename = typeof executable === 'string' ? executable : executable.filename;
        const normFile = resolvePath(filename);
        const kind = await identifyEnvironment(normFile);
        yield getFastEnvInfo(kind === PythonEnvKind.Unknown ? defaultKind : kind, normFile);
    }
}

type GetDirExecutablesFunc = (dir: string) => AsyncIterableIterator<Executable>;

/**
 * A locator for executables in a single directory.
 */
export class DirFilesLocator extends FoundFilesLocator {
    constructor(
        dirname: string,
        defaultKind: PythonEnvKind,
        // This is put in a closure and otherwise passed through as-is.
        getExecutables: GetDirExecutablesFunc = getExecutablesDefault,
    ) {
        super(defaultKind, () => getExecutables(dirname));
    }
}

// For now we do not have a DirFilesWatchingLocator.  It would be
// a subclass of FSWatchingLocator that wraps a DirFilesLocator
// instance.

async function* getExecutablesDefault(dirname: string): AsyncIterableIterator<DirEntry> {
    for await (const entry of iterPythonExecutablesInDir(dirname)) {
        yield entry;
    }
}
