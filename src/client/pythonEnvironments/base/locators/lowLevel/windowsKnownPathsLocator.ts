// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import * as fs from 'fs';
import { uniq } from 'lodash';
import * as path from 'path';
import { Event } from 'vscode';
import { convertFileType } from '../../../../common/platform/fileSystem';
import { DirEntry, FileType } from '../../../../common/platform/types';
import { getSearchPathEntries } from '../../../../common/utils/exec';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { findInterpretersInDir, isStandardPythonBinary } from '../../../common/commonUtils';
import { PythonEnvInfo, PythonEnvKind, PythonEnvSource } from '../../info';
import { ILocator, IPythonEnvsIterator, PythonLocatorQuery } from '../../locator';
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

function getDirFilesLocator(
    // These are passed through to DirFilesLocator.
    dirname: string,
    kind: PythonEnvKind,
): ILocator & IDisposable {
    const iterExecutables = (d: string) => findInterpretersInDir(d, 0, undefined, false, onTimeout);
    const locator = new DirFilesLocator(dirname, kind, iterExecutables);

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
        onChanged: locator.onChanged,
        dispose: () => locator.dispose(),
    };
}

const TYPICAL_PYTHONS = [
    'python.exe',
    // There may be others.
];

// On Windows some directories are really big,
// so we fall back to known Python executables.
async function onTimeout(dirname: string): Promise<DirEntry[]> {
    const results = await Promise.all(
        TYPICAL_PYTHONS.map(async (basename: string) => {
            const filename = path.join(dirname, basename);
            const filetype = await getFileType(filename);
            if (filetype === undefined) {
                return undefined;
            }
            return { filename, filetype };
        }),
    );
    return results.filter((entry) => entry) as DirEntry[];
}

async function getFileType(filename: string): Promise<FileType | undefined> {
    let info: fs.Stats;
    try {
        info = await fs.promises.stat(filename);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return undefined;
        }
        return FileType.Unknown;
    }
    return convertFileType(info);
}
