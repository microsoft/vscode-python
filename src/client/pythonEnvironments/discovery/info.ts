// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as internalPython from '../../common/process/internal/python';
import * as internalScripts from '../../common/process/internal/scripts';
import { Architecture } from '../../common/utils/platform';
import { parsePythonVersion } from '../pythonVersion';
import { InterpreterInformation } from './types';

type ExecutionResult = {
    stdout: string;
};
type ExecFunc = (command: string, args: string[]) => Promise<ExecutionResult>;

export async function getPythonVersion(pythonPath: string, defaultValue: string, exec: ExecFunc): Promise<string> {
    const [args, parse] = internalPython.getVersion();
    return exec(pythonPath, args)
        .then((result) => parse(result.stdout).splitLines()[0])
        .then((version) => (version.length === 0 ? defaultValue : version))
        .catch(() => defaultValue);
}

export function extractInterpreterInfo(python: string, raw: internalScripts.PythonEnvInfo): InterpreterInformation {
    const rawVersion = `${raw.versionInfo.slice(0, 3).join('.')}-${raw.versionInfo[3]}`;
    return {
        architecture: raw.is64Bit ? Architecture.x64 : Architecture.x86,
        path: python,
        version: parsePythonVersion(rawVersion),
        sysVersion: raw.sysVersion,
        sysPrefix: raw.sysPrefix
    };
}
