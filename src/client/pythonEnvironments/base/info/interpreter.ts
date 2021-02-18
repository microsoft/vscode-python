// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonExecutableInfo, PythonVersion } from '.';
import { traceError, traceInfo } from '../../../common/logger';
import {
    interpreterInfo as getInterpreterInfoCommand,
    InterpreterInfoJson,
} from '../../../common/process/internal/scripts';
import { IDisposable } from '../../../common/types';
import { Architecture } from '../../../common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { shellExecute } from '../../common/externalDependencies';
import { copyPythonExecInfo, PythonExecInfo } from '../../exec';
import { parseVersion } from './pythonVersion';

export type InterpreterExecInformation = {
    arch: Architecture;
    executable: PythonExecutableInfo;
    version: PythonVersion;
};

export type InterpreterInformation = {
    /**
     * The information parsed from the output of interpreter info script.
     */
    interpreterExecInfo: InterpreterExecInformation | undefined;
    /**
     * Carries if it's a valid python executable.
     * Note it maybe the case that interpreterExecInfo is `undefined`, but it is still a valid executable.
     */
    isValidExecutable: boolean;
};

/**
 * Compose full interpreter information based on the given data.
 *
 * The data format corresponds to the output of the `interpreterInfo.py` script.
 *
 * @param python - the path to the Python executable
 * @param raw - the information returned by the `interpreterInfo.py` script
 */
function extractInterpreterInfo(python: string, raw: InterpreterInfoJson): InterpreterExecInformation {
    const rawVersion = `${raw.versionInfo.slice(0, 3).join('.')}-${raw.versionInfo[3]}`;
    return {
        arch: raw.is64Bit ? Architecture.x64 : Architecture.x86,
        executable: {
            filename: python,
            sysPrefix: raw.sysPrefix,
            mtime: -1,
            ctime: -1,
        },
        version: {
            ...parseVersion(rawVersion),
            sysVersion: raw.sysVersion,
        },
    };
}

/**
 * Collect full interpreter information from the given Python executable.
 *
 * @param python - the information to use when running Python
 */
export async function getInterpreterInfo(
    python: PythonExecInfo,
    disposables?: Set<IDisposable>,
): Promise<InterpreterInformation> {
    const [args, parse] = getInterpreterInfoCommand();
    const info = copyPythonExecInfo(python, args);
    const argv = [info.command, ...info.args];

    // Concat these together to make a set of quoted strings
    const quoted = argv.reduce((p, c) => (p ? `${p} "${c}"` : `"${c.replace('\\', '\\\\')}"`), '');

    const result = await shellExecute(
        quoted,
        {
            /**
             * Try shell executing the command, followed by the arguments. This will make node kill the process if it
             * takes too long.
             * Sometimes the python path isn't valid, timeout if that's the case.
             * See these two bugs:
             * https://github.com/microsoft/vscode-python/issues/7569
             * https://github.com/microsoft/vscode-python/issues/7760
             */
            timeout: 15000,
            /**
             * Use extensions directory as cwd instead so there can be no shadowing when running the script.
             */
            cwd: EXTENSION_ROOT_DIR,
            /**
             * We're exiting using `sys.exit(42)` in the interpreter info script, hence we're expecting an exec exception.
             */
            ignoreExitCode: true,
        },
        disposables,
    );
    const isValidExecutable = result.exitCode === 42; // Error code 42 is thrown from interpreter info script.
    if (result.stderr) {
        traceError(`Failed to parse interpreter information for ${argv} stderr: ${result.stderr}`);
        return { interpreterExecInfo: undefined, isValidExecutable };
    }
    try {
        const json = parse(result.stdout);
        traceInfo(`Found interpreter for ${argv}`);
        return { interpreterExecInfo: extractInterpreterInfo(python.pythonExecutable, json), isValidExecutable };
    } catch (ex) {
        traceError(`Failed to parse interpreter information`, ex);
        return { interpreterExecInfo: undefined, isValidExecutable };
    }
}
