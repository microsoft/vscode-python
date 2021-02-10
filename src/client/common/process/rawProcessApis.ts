// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { exec } from 'child_process';
import { IDisposable } from '../types';
import { EnvironmentVariables } from '../variables/types';
import { DEFAULT_ENCODING } from './constants';
import { ExecutionResult, ShellOptions, SpawnOptions } from './types';

export function getDefaultOptions<T extends ShellOptions | SpawnOptions>(
    options: T,
    defaultEnv?: EnvironmentVariables,
): T {
    const defaultOptions = { ...options };
    const execOptions = defaultOptions as SpawnOptions;
    if (execOptions) {
        execOptions.encoding =
            typeof execOptions.encoding === 'string' && execOptions.encoding.length > 0
                ? execOptions.encoding
                : DEFAULT_ENCODING;
        const { encoding } = execOptions;
        delete execOptions.encoding;
        execOptions.encoding = encoding;
    }
    if (!defaultOptions.env || Object.keys(defaultOptions.env).length === 0) {
        const env = defaultEnv || process.env;
        defaultOptions.env = { ...env };
    } else {
        defaultOptions.env = { ...defaultOptions.env };
    }

    if (execOptions && execOptions.extraVariables) {
        defaultOptions.env = { ...defaultOptions.env, ...execOptions.extraVariables };
    }

    // Always ensure we have unbuffered output.
    defaultOptions.env.PYTHONUNBUFFERED = '1';
    if (!defaultOptions.env.PYTHONIOENCODING) {
        defaultOptions.env.PYTHONIOENCODING = 'utf-8';
    }

    return defaultOptions;
}

export function shellExec(
    command: string,
    options: ShellOptions = {},
    disposables?: Set<IDisposable>,
): Promise<ExecutionResult<string>> {
    const shellOptions = getDefaultOptions(options);
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proc = exec(command, shellOptions, (e: any, stdout: any, stderr: any) => {
            if (e && e !== null) {
                reject(e);
            } else if (shellOptions.throwOnStdErr && stderr && stderr.length) {
                reject(new Error(stderr));
            } else {
                // Make sure stderr is undefined if we actually had none. This is checked
                // elsewhere because that's how exec behaves.
                resolve({ stderr: stderr && stderr.length > 0 ? stderr : undefined, stdout });
            }
        }); // NOSONAR
        const disposable: IDisposable = {
            dispose: () => {
                if (!proc.killed) {
                    proc.kill();
                }
            },
        };
        if (disposables) {
            disposables.add(disposable);
        }
    });
}
