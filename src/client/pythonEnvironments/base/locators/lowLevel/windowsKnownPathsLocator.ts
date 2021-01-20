// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { uniq } from 'lodash';
import * as path from 'path';
import { Event } from 'vscode';
import { getSearchPathEntries } from '../../../../common/utils/exec';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { logVerbose } from '../../../../logging';
import { isStandardPythonBinary } from '../../../common/commonUtils';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../info';
import { ILocator, IPythonEnvsIterator, PythonLocatorQuery } from '../../locator';
import { Locators } from '../../locators';
import { getEnvs } from '../../locatorUtils';
import { PythonEnvsChangedEvent } from '../../watcher';
import * as fsWatching from './fsWatchingLocator';
import { DirFilesLocator, DirFilesWatchingLocator } from './filesLocator';

/**
 * A locator for Windows locators found under the $PATH env var.
 *
 * Note that we assume $PATH won't change, so we don't need to watch
 * it for changes.
 */
export class WindowsPathEnvVarLocator implements ILocator, IDisposable {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly locators: Locators;

    private readonly disposables = new Disposables();

    constructor() {
        const dirLocators: (ILocator & IDisposable)[] = getSearchPathEntries()
            // Build a locator for each directory.
            .map((dirname) => getDirFilesLocator(dirname, PythonEnvKind.Unknown));
        this.disposables.push(...dirLocators);
        this.locators = new Locators(dirLocators);
        this.onChanged = this.locators.onChanged;
    }

    public async dispose(): Promise<void> {
        this.locators.dispose();
        await this.disposables.dispose();
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // Note that we do no filtering here, including to check if files
        // are valid executables.  That is left to callers (e.g. composite
        // locators).
        return this.locators.iterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.locators.resolveEnv(env);
    }
}

const DO_NOT_WATCH = [
    '\\WINDOWS\\SYSTEM32',
    // There are probably a few more worth adding here.
];

function isDirWatchable(dirname: string): boolean {
    const norm = path.normalize(dirname).toUpperCase().split(':')[1];
    for (const bad of DO_NOT_WATCH) {
        if (bad === norm) {
            return false;
        }
    }
    try {
        return fsWatching.isDirWatchable(dirname);
    } catch (err) {
        logVerbose(`failed in isDirWatchable("${dirname}"): ${err}`);
        return false;
    }
}

function getDirFilesLocator(
    // These are passed through to DirFilesLocator.
    dirname: string,
    kind: PythonEnvKind,
): ILocator & IDisposable {
    let locator: ILocator;
    let dispose: () => Promise<void>;
    if (isDirWatchable(dirname)) {
        const watchingLocator = new DirFilesWatchingLocator(dirname, kind);
        locator = watchingLocator;
        dispose = () => watchingLocator.dispose();
    } else {
        locator = new DirFilesLocator(dirname, kind);
        dispose = async () => undefined;
    }

    // Really we should be checking for symlinks or something more
    // sophisticated.  Also, this should be done in ReducingLocator
    // rather than in each low-level locator.  In the meantime we
    // take a naive approach.
    async function* iterEnvs(query: PythonLocatorQuery): IPythonEnvsIterator {
        const envs = await getEnvs(locator.iterEnvs(query));
        for (const env of envs) {
            if (isStandardPythonBinary(env.executable?.filename || '')) {
                env.source = env.source
                    ? uniq([...env.source, PythonEnvSource.PathEnvVar])
                    : [PythonEnvSource.PathEnvVar];
                yield env;
            }
        }
    }
    async function resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executable = typeof env === 'string' ? env : env.executable?.filename || '';

        if (!isStandardPythonBinary(executable)) {
            return undefined;
        }
        const resolved = await locator.resolveEnv(env);
        if (resolved) {
            const source =
                typeof env === 'string'
                    ? [PythonEnvSource.PathEnvVar]
                    : uniq([...env.source, PythonEnvSource.PathEnvVar]);
            resolved.source = source;
        }
        return resolved;
    }
    return {
        iterEnvs,
        resolveEnv,
        dispose,
        onChanged: locator.onChanged,
    };
}
