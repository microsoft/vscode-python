// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Architecture } from '../../../common/utils/platform';
import { mergeVersions } from './pythonVersion';

import { PythonBuildInfo } from '.';

/**
 * Make a copy of "build" and fill in empty properties using "other."
 */
export function mergeBuilds(build: PythonBuildInfo, other: PythonBuildInfo): PythonBuildInfo {
    const merged: PythonBuildInfo = {
        version: mergeVersions(build.version, other.version),
        arch: build.arch,
    };

    if (build.arch === Architecture.Unknown) {
        merged.arch = other.arch;
    }

    return merged;
}
