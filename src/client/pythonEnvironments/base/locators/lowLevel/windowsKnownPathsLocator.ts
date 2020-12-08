// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { chain } from '../../../../common/utils/async';
import { getSearchPathEntries } from '../../../../common/utils/exec';
import { findInterpretersInDir } from '../../../common/commonUtils';
import { PythonEnvKind } from '../../info';
import {
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from '../../locator';
import { CachingLocatorWrapper } from '../composite/cachingWrapper';
import { FoundFilesLocator } from './filesLocator';

class SimpleLocator extends FoundFilesLocator {
    constructor() {
        super(
            PythonEnvKind.Unknown,
            getExecutables,
        );
    }

    // Eventually we will want to set up some sort of combination
    // watcher, which we will tie to `this.watcher.fire()`.  For
    // changes to `$PATH` we need some sort of env vars watcher.
    // For changes to the directories on `$PATH` we need an FS
    // watcher.  (We might also want to watch the individual Python
    // executable files that we find.)  We'll also need to be sure
    // to have a `dispose()` to stop the watcher.
    //
    // In the meantime we trigger `onChanged` events only when we
    // iterate and notice that something changed.  We could also
    // operate on a timer, but that isn't immediately necessary.

    public triggerRefresh(): void {
        this.watcher.fire({});
    }
}

async function* getExecutables(): AsyncIterableIterator<string> {
    const entries = getSearchPathEntries();
    // The entries can be processed in parallel so we get each started
    // and then chain the async results below.
    // Note that we do no filtering here, including to check if file
    // is a valid executable.  That is left to callers (e.g. composite
    // locators).
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    const generators = entries.map((entry) => findInterpretersInDir(entry));
    yield* chain(generators);
}

/**
 * A locator that exposes Python environments found via `$PATH`.
 */
export class WindowsKnownPathsLocator extends CachingLocatorWrapper {
    private readonly simple: SimpleLocator;

    constructor() {
        const simple = new SimpleLocator();
        super(simple);
        this.simple = simple;
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        const iterator = super.iterEnvs(query);
        // Until we have FS watchers set up, we force a background
        // refresh every time we iterate.
        this.simple.triggerRefresh();
        return iterator;
    }
}
