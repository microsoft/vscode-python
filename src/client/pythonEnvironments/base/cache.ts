// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvInfo } from './info';
import { IPythonEnvsCache } from './locators/composite/cachingLocator';

/**
 * A rudimentary empty cache.
 */
export class EmptyCache implements IPythonEnvsCache {
    // tslint:disable-next-line: no-single-line-block-comment
    /* eslint-disable class-methods-use-this */

    public async initialize(): Promise<void> {
        // Do nothing!
    }

    public getAllEnvs(): PythonEnvInfo[] | undefined {
        return undefined;
    }

    public matchEnv(/* env: Partial<PythonEnvInfo> */): PythonEnvInfo[] {
        return [];
    }

    public setAllEnvs(/* envs: PythonEnvInfo[] */): void {
        // Do nothing!
    }

    public async flush(): Promise<void> {
        // Do nothing!
    }

    // tslint:disable-next-line: no-single-line-block-comment
    /* eslint-enable class-methods-use-this */
}
