// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event } from 'vscode';
import { getSearchPathEntries } from '../../../../common/utils/exec';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import {
    ILocator,
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from '../../locator';
import { Locators } from '../../locators';
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
        const dirLocators: DirFilesLocator[] = getSearchPathEntries()
            .map((dirname) => new DirFilesLocator(dirname, PythonEnvKind.Unknown));
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
