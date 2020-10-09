// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvInfo } from '../../info';

/**
 * Determine which of the given envs should be used.
 *
 * The candidates must be equivalent in some way.
 */
export function pickBestEnv(candidates: PythonEnvInfo[]): PythonEnvInfo {
    // For the moment we take a naive approach.
    return candidates[0];
}
