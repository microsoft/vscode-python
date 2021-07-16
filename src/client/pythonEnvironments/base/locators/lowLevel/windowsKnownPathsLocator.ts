// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event } from 'vscode';
import { getSearchPathEntries } from '../../../../common/utils/exec';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { iterPythonExecutablesInDir, looksLikeBasicGlobalPython } from '../../../common/commonUtils';
import { isPyenvShimDir } from '../../../common/environmentManagers/pyenv';
import { isWindowsStoreDir } from '../../../common/environmentManagers/windowsStoreEnv';
import { PythonEnvKind, PythonEnvSource } from '../../info';
import { BasicEnvInfo, ILocator, IPythonEnvsIterator, PythonLocatorQuery } from '../../locator';
import { Locators } from '../../locators';
import { getEnvs } from '../../locatorUtils';
import { PythonEnvsChangedEvent } from '../../watcher';
import { DirFilesLocator } from './filesLocator';

/**
 * A locator for Windows locators found under the $PATH env var.
 *
 * Note that we assume $PATH won't change, so we don't need to watch
 * it for changes.
 */
export class WindowsPathEnvVarLocator implements ILocator<BasicEnvInfo>, IDisposable {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly locators: Locators<BasicEnvInfo>;

    private readonly disposables = new Disposables();

    constructor() {
        const dirLocators: (ILocator<BasicEnvInfo> & IDisposable)[] = getSearchPathEntries()
            .filter(
                (dirname) =>
                    // Filter out following directories:
                    // 1. Windows Store app directories: We have a store app locator that handles this. The
                    //    python.exe available in these directories might not be python. It can be a store
                    //    install shortcut that takes you to windows store.
                    //
                    // 2. Filter out pyenv shims: They are not actual python binaries, they are used to launch
                    //    the binaries specified in .python-version file in the cwd. We should not be reporting
                    //    those binaries as environments.
                    !isWindowsStoreDir(dirname) && !isPyenvShimDir(dirname),
            )
            // Build a locator for each directory.
            .map((dirname) => getDirFilesLocator(dirname, PythonEnvKind.System, [PythonEnvSource.PathEnvVar]));
        this.disposables.push(...dirLocators);
        this.locators = new Locators(dirLocators);
        this.onChanged = this.locators.onChanged;
    }

    public async dispose(): Promise<void> {
        this.locators.dispose();
        await this.disposables.dispose();
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator<BasicEnvInfo> {
        // Note that we do no filtering here, including to check if files
        // are valid executables.  That is left to callers (e.g. composite
        // locators).
        return this.locators.iterEnvs(query);
    }
}

async function* getExecutables(dirname: string): AsyncIterableIterator<string> {
    for await (const entry of iterPythonExecutablesInDir(dirname)) {
        if (await looksLikeBasicGlobalPython(entry)) {
            yield entry.filename;
        }
    }
}

function getDirFilesLocator(
    // These are passed through to DirFilesLocator.
    dirname: string,
    kind: PythonEnvKind,
    source?: PythonEnvSource[],
): ILocator<BasicEnvInfo> & IDisposable {
    // For now we do not bother using a locator that watches for changes
    // in the directory.  If we did then we would use
    // `DirFilesWatchingLocator`, but only if not \\windows\system32 and
    // the `isDirWatchable()` (from fsWatchingLocator.ts) returns true.
    const locator = new DirFilesLocator(dirname, kind, getExecutables, source);
    const dispose = async () => undefined;

    // Really we should be checking for symlinks or something more
    // sophisticated.  Also, this should be done in ReducingLocator
    // rather than in each low-level locator.  In the meantime we
    // take a naive approach.
    async function* iterEnvs(query: PythonLocatorQuery): IPythonEnvsIterator<BasicEnvInfo> {
        yield* await getEnvs(locator.iterEnvs(query));
    }
    return {
        iterEnvs,
        dispose,
        onChanged: locator.onChanged,
    };
}
