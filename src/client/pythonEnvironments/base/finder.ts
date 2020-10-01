// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvInfo } from './info';

export interface IPythonEnvsFinder {
    /**
     * If possible, locate the environment.
     *
     * This represents a minimal effort, so at most the following
     * `PythoEnvInfo` properties are guaranteed to be populated:
     *
     *  * `kind`
     *  * `executable.filename`
     *
     * Finders may also provide any edditional information that they
     * may have gathered at part of their minimal effort.
     *
     * Note that the finder may find 0 or more matching environments.
     * The returned array is in no specific order.
     */
    findEnv(env: string | Partial<PythonEnvInfo>): Promise<PythonEnvInfo[]>;

    /**
     * If found, make a copy and fill in as much missing info as possible.
     *
     * If the finder can find the environment then the result is as
     * much info about that env as the finder has.  At the least this
     * will include all the `PythonEnvBaseInfo` data.
     *
     * If the finder could not find the environment then `undefined`
     * is returned.
     *
     * @param env - the Python executable path or minimal env info to find and update
     */
    resolveEnv(env: PythonEnvInfo): Promise<PythonEnvInfo | undefined>;
}
