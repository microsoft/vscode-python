// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { traceError, traceVerbose } from '../logging';
import { PythonVersion } from '../pythonEnvironments/base/info';
import { parseVersion } from '../pythonEnvironments/base/info/pythonVersion';
import { PythonEnvironment } from './types';

export function parsePythonEnvironmentVersion(pythonEnv: PythonEnvironment): PythonVersion | undefined {
    if (pythonEnv.version === 'no-python') {
        traceVerbose(`Skipping environment without Python: ${pythonEnv.displayName}`);
        return undefined;
    }

    try {
        return parseVersion(pythonEnv.version);
    } catch (error) {
        traceError(
            `Failed to parse version for environment "${pythonEnv.displayName}" from the Python Environments extension`,
            error,
        );
        return undefined;
    }
}
