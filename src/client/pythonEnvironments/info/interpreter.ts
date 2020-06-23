// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InterpreterInformation } from '.';
import { interpreterInfo as getInterpreterInfoCommand, PythonEnvInfo } from '../../common/process/internal/scripts';
import { Architecture } from '../../common/utils/platform';
import { copyPythonExecInfo, PythonExecInfo } from '../exec';
import { parsePythonVersion } from './pythonVersion';

/**
 * Compose full interpreter information based on the given data.
 *
 * The data format corresponds to the output of the `interpreterInfo.py` script.
 *
 * @param python - the path to the Python executable
 * @param raw - the information returned by the `interpreterInfo.py` script
 */
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
    logger?: Logger
): Promise<InterpreterInformation | undefined> {
    const [args, parse] = getInterpreterInfoCommand();
    const info = copyPythonExecInfo(python, args);
    const argv = [info.command, ...info.args];

    // Concat these together to make a set of quoted strings
    const quoted = argv.reduce((p, c) => (p ? `${p} "${c}"` : `"${c.replace('\\', '\\\\')}"`), '');

    // Try shell execing the command, followed by the arguments. This will make node kill the process if it
    // takes too long.
    // Sometimes the python path isn't valid, timeout if that's the case.
    // See these two bugs:
    // https://github.com/microsoft/vscode-python/issues/7569
    // https://github.com/microsoft/vscode-python/issues/7760
    const result = await shellExec(quoted, 15000);
    if (result.stderr) {
        if (logger) {
            logger.error(`Failed to parse interpreter information for ${argv} stderr: ${result.stderr}`);
        }
        return;
    }
    const json = parse(result.stdout);
    if (logger) {
        logger.info(`Found interpreter for ${argv}`);
    }
    return extractInterpreterInfo(python.pythonExecutable, json);
}
