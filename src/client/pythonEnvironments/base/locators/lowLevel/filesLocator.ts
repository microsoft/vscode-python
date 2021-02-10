// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event, EventEmitter } from 'vscode';
import { DirEntry, getFileType, FileType } from '../../../../common/utils/filesystem';
import { iterPythonExecutablesInDir } from '../../../common/commonUtils';
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
export class FoundFilesLocator implements ILocator {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    protected readonly watcher = new PythonEnvsWatcher();

    constructor(
        private readonly kind: PythonEnvKind,
        // This is used only in iterEnvs().
        private readonly getExecutables: GetExecutablesFunc,
    ) {
        this.onChanged = this.watcher.onChanged;
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

async function resolveFile(
    executable: Executable,
    // If this isn't set then we return undefined when missing.
    onMissing?: FileType,
): Promise<DirEntry | undefined> {
    if (typeof executable !== 'string') {
        // We trust that this means the file exists.
        return executable;
    }
    const filename = executable;
    let filetype = await getFileType(filename);
    if (filetype === undefined) {
        if (onMissing === undefined) {
            return undefined;
        }
        filetype = onMissing;
    }
    return { filename, filetype };
}

/**
 * Build minimal env info corresponding to each executable filename.
 */
async function* iterMinimalEnvsFromExecutables(
    executables: Executable[] | AsyncIterableIterator<Executable>,
    kind: PythonEnvKind,
    ignoreMissing = true,
): AsyncIterableIterator<PythonEnvInfo> {
    for await (const executable of executables) {
        const onMissing = ignoreMissing ? undefined : FileType.Unknown;
        const entry = await resolveFile(executable, onMissing);
        if (entry === undefined) {
            // eslint-disable-next-line no-continue
            continue;
        }
        // This is where we would handle the file type.
        const normFile = resolvePath(entry.filename);
        yield getFastEnvInfo(kind, normFile);
    }
}

type GetDirExecutablesFunc = (dir: string) => AsyncIterableIterator<Executable>;

/**
 * A locator for executables in a single directory.
 */
export class DirFilesLocator extends FoundFilesLocator {
    constructor(
        dirname: string,
        kind: PythonEnvKind,
        // This is put in a closure and otherwise passed through as-is.
        getExecutables: GetDirExecutablesFunc = getExecutablesDefault,
    ) {
        super(
            kind,
            // a wrapper
            () => getExecutables(dirname),
        );
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
