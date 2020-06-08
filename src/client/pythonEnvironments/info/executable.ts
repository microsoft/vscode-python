// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as internalPython from '../../common/process/internal/python';
import { buildPythonExecInfo, PythonExecInfo } from '../exec';

type ExecResult = {
    stdout: string;
};
type ExecFunc = (command: string, args: string[]) => Promise<ExecResult>;

export async function getExecutablePath(python: PythonExecInfo, exec: ExecFunc): Promise<string> {
    const [args, parse] = internalPython.getExecutable();
    const info = buildPythonExecInfo(python, args);
    const result = await exec(info.command, info.args);
    return parse(result.stdout);
}
