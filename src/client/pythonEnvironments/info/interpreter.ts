// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InterpreterInformation } from '.';
import { PythonEnvInfo } from '../../common/process/internal/scripts';
import { Architecture } from '../../common/utils/platform';
import { parsePythonVersion } from './pythonVersion';

export function extractInterpreterInfo(python: string, raw: PythonEnvInfo): InterpreterInformation {
    const rawVersion = `${raw.versionInfo.slice(0, 3).join('.')}-${raw.versionInfo[3]}`;
    return {
        architecture: raw.is64Bit ? Architecture.x64 : Architecture.x86,
        path: python,
        version: parsePythonVersion(rawVersion),
        sysVersion: raw.sysVersion,
        sysPrefix: raw.sysPrefix
    };
}
