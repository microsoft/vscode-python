// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Architecture } from '../../common/utils/platform';
import { PythonExecutableInfo, PythonVersion } from '../base/info';
import { getEnvInfo } from '../base/info/tool';
import { PythonExecInfo } from '../exec';

export type InterpreterInformation = {
    arch: Architecture;
    executable: PythonExecutableInfo;
    version: PythonVersion;
};

type ShellExecResult = {
    stdout: string;
    stderr?: string;
};
type ShellExecFunc = (command: string, timeout: number) => Promise<ShellExecResult>;

type Logger = {
    info(msg: string): void;

    error(msg: string): void;
};

/**
 * Collect full interpreter information from the given Python executable.
 *
 * @param python - the information to use when running Python
 * @param shellExec - the function to use to exec Python
 * @param logger - if provided, used to log failures or other info
 */
export async function getInterpreterInfo(
    python: PythonExecInfo,
    shellExec: ShellExecFunc,
    logger?: Logger,
): Promise<InterpreterInformation | undefined> {
    return getEnvInfo(python, shellExec, logger);
}
