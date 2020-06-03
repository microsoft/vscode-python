// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as internalPython from '../../common/process/internal/python';

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
