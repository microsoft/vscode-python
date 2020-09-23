// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { interpreterInfo as getInterpreterInfoCommand } from '../../../common/process/internal/scripts';
import { Architecture } from '../../../common/utils/platform';
import { copyPythonExecInfo, PythonExecInfo } from '../../exec';
import { buildEnvInfo } from './env';
import { parseVersion } from './pythonVersion';

import { PythonEnvInfo } from '.';

type ShellExecResult = {
    stdout: string;
    stderr?: string;
};
type ShellExecFunc = (command: string, timeout: number) => Promise<ShellExecResult>;

/**
 * Collect full Python env information from the given Python executable.
 *
 * @param python - the information to use when running Python
 * @param shellExec - the function to use to exec Python
 * @param logger - if provided, used to log failures or other info
 */
export async function getEnvInfo(
    python: PythonExecInfo,
    shellExec: ShellExecFunc,
    logger?: {
        info(msg: string): void;
        error(msg: string): void;
    },
): Promise<PythonEnvInfo | undefined> {
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
        return undefined;
    }
    const raw = parse(result.stdout);
    if (logger) {
        logger.info(`Found interpreter for ${argv}`);
    }

    // Handle the raw result.
    const rawVersion = `${raw.versionInfo.slice(0, 3).join('.')}-${raw.versionInfo[3]}`;
    const env = buildEnvInfo({
        executable: python.pythonExecutable,
        version: parseVersion(rawVersion),
    });
    env.arch = raw.is64Bit ? Architecture.x64 : Architecture.x86;
    env.executable.sysPrefix = raw.sysPrefix;
    env.version.sysVersion = raw.sysVersion;
    return env;
}
