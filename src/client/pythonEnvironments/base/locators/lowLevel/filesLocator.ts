// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event } from 'vscode';
import { iterPythonExecutablesInDir } from '../../../common/commonUtils';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, ILocator, IPythonEnvsIterator, PythonLocatorQuery } from '../../locator';
import { PythonEnvsChangedEvent, PythonEnvsWatcher } from '../../watcher';

type GetExecutablesFunc = () => AsyncIterableIterator<string>;

/**
 * A naive locator the wraps a function that finds Python executables.
 */
class FoundFilesLocator implements ILocator<BasicEnvInfo> {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    protected readonly watcher = new PythonEnvsWatcher();

    constructor(private readonly kind: PythonEnvKind, private readonly getExecutables: GetExecutablesFunc) {
        this.onChanged = this.watcher.onChanged;
    }

    public iterEnvs(_query?: PythonLocatorQuery): IPythonEnvsIterator<BasicEnvInfo> {
        const executables = this.getExecutables();
        async function* generator(kind: PythonEnvKind): IPythonEnvsIterator<BasicEnvInfo> {
            for await (const executablePath of executables) {
                yield { executablePath, kind };
            }
        }
        const iterator = generator(this.kind);
        return iterator;
    }
}

type GetDirExecutablesFunc = (dir: string) => AsyncIterableIterator<string>;

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

async function* getExecutablesDefault(dirname: string): AsyncIterableIterator<string> {
    for await (const entry of iterPythonExecutablesInDir(dirname)) {
        yield entry.filename;
    }
}
