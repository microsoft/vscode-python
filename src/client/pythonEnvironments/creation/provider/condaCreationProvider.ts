// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, ProgressLocation, WorkspaceFolder } from 'vscode';
import * as path from 'path';
import { Commands, PVSC_EXTENSION_ID } from '../../../common/constants';
import { traceError, traceLog } from '../../../logging';
import {
    CreateEnvironmentOptions,
    CreateEnvironmentProgress,
    CreateEnvironmentProvider,
    CreateEnvironmentResult,
} from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { getEnvironmentVariable, getOSType, OSType } from '../../../common/utils/platform';
import { createCondaScript } from '../../../common/process/internal/scripts';
import { Common, CreateEnv } from '../../../common/utils/localize';
import { getCondaBaseEnv, pickPythonVersion } from './condaUtils';
import { showErrorMessageWithLogs } from '../common/commonUtils';
import { withProgress } from '../../../common/vscodeApis/windowApis';
import { EventName } from '../../../telemetry/constants';
import { sendTelemetryEvent } from '../../../telemetry';
import {
    CondaProgressAndTelemetry,
    CONDA_ENV_CREATED_MARKER,
    CONDA_ENV_EXISTING_MARKER,
} from './condaProgressAndTelemetry';

function generateCommandArgs(version?: string, options?: CreateEnvironmentOptions): string[] {
    let addGitIgnore = true;
    let installPackages = true;
    if (options) {
        addGitIgnore = options?.ignoreSourceControl !== undefined ? options.ignoreSourceControl : true;
        installPackages = options?.installPackages !== undefined ? options.installPackages : true;
    }

    const command: string[] = [createCondaScript()];

    if (addGitIgnore) {
        command.push('--git-ignore');
    }

    if (installPackages) {
        command.push('--install');
    }

    if (version) {
        command.push('--python');
        command.push(version);
    }

    return command;
}

function getCondaEnvFromOutput(output: string): string | undefined {
    try {
        const envPath = output
            .split(/\r?\n/g)
            .map((s) => s.trim())
            .filter((s) => s.startsWith(CONDA_ENV_CREATED_MARKER) || s.startsWith(CONDA_ENV_EXISTING_MARKER))[0];
        if (envPath.includes(CONDA_ENV_CREATED_MARKER)) {
            return envPath.substring(CONDA_ENV_CREATED_MARKER.length);
        }
        return envPath.substring(CONDA_ENV_EXISTING_MARKER.length);
    } catch (ex) {
        traceError('Parsing out environment path failed.');
        return undefined;
    }
}

async function createCondaEnv(
    workspace: WorkspaceFolder,
    command: string,
    args: string[],
    progress: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
    progress.report({
        message: CreateEnv.Conda.creating,
    });

    const deferred = createDeferred<string>();
    let pathEnv = getEnvironmentVariable('PATH') || getEnvironmentVariable('Path') || '';
    if (getOSType() === OSType.Windows) {
        // On windows `conda.bat` is used, which adds the following bin directories to PATH
        // then launches `conda.exe` which is a stub to `python.exe -m conda`. Here, we are
        // instead using the `python.exe` that ships with conda to run a python script that
        // handles conda env creation and package installation.
        // See conda issue: https://github.com/conda/conda/issues/11399
        const root = path.dirname(command);
        const libPath1 = path.join(root, 'Library', 'bin');
        const libPath2 = path.join(root, 'Library', 'mingw-w64', 'bin');
        const libPath3 = path.join(root, 'Library', 'usr', 'bin');
        const libPath4 = path.join(root, 'bin');
        const libPath5 = path.join(root, 'Scripts');
        const libPath = [libPath1, libPath2, libPath3, libPath4, libPath5].join(path.delimiter);
        pathEnv = `${libPath}${path.delimiter}${pathEnv}`;
    }
    traceLog('Running Conda Env creation script: ', [command, ...args]);
    const { proc, out, dispose } = execObservable(command, args, {
        mergeStdOutErr: true,
        token,
        cwd: workspace.uri.fsPath,
        env: {
            PATH: pathEnv,
        },
    });

    const progressAndTelemetry = new CondaProgressAndTelemetry(progress);
    let condaEnvPath: string | undefined;
    out.subscribe(
        (value) => {
            const output = value.out.splitLines().join('\r\n');
            traceLog(output);
            if (output.includes(CONDA_ENV_CREATED_MARKER) || output.includes(CONDA_ENV_EXISTING_MARKER)) {
                condaEnvPath = getCondaEnvFromOutput(output);
            }
            progressAndTelemetry.process(output);
        },
        async (error) => {
            traceError('Error while running conda env creation script: ', error);
            deferred.reject(error);
        },
        () => {
            dispose();
            if (proc?.exitCode !== 0) {
                traceError('Error while running venv creation script: ', progressAndTelemetry.getLastError());
                deferred.reject(progressAndTelemetry.getLastError());
            } else {
                deferred.resolve(condaEnvPath);
            }
        },
    );
    return deferred.promise;
}

function getExecutableCommand(condaBaseEnvPath: string): string {
    if (getOSType() === OSType.Windows) {
        // Both Miniconda3 and Anaconda3 have the following structure:
        // Miniconda3 (or Anaconda3)
        //  |- python.exe     <--- this is the python that we want.
        return path.join(condaBaseEnvPath, 'python.exe');
    }
    // On non-windows machines:
    // miniconda (or miniforge or anaconda3)
    // |- bin
    //     |- python   <--- this is the python that we want.
    return path.join(condaBaseEnvPath, 'bin', 'python');
}

async function createEnvironment(options?: CreateEnvironmentOptions): Promise<CreateEnvironmentResult | undefined> {
    const conda = await getCondaBaseEnv();
    if (!conda) {
        return undefined;
    }

    const workspace = (await pickWorkspaceFolder()) as WorkspaceFolder | undefined;
    if (!workspace) {
        traceError('Workspace was not selected or found for creating virtual env.');
        return undefined;
    }

    const version = await pickPythonVersion();
    if (!version) {
        traceError('Conda environments for use with python extension require Python.');
        return undefined;
    }

    return withProgress(
        {
            location: ProgressLocation.Notification,
            title: `${CreateEnv.statusTitle} ([${Common.showLogs}](command:${Commands.ViewOutput}))`,
            cancellable: true,
        },
        async (
            progress: CreateEnvironmentProgress,
            token: CancellationToken,
        ): Promise<CreateEnvironmentResult | undefined> => {
            let hasError = false;

            progress.report({
                message: CreateEnv.statusStarting,
            });

            let envPath: string | undefined;
            try {
                sendTelemetryEvent(EventName.ENVIRONMENT_CREATING, undefined, {
                    environmentType: 'conda',
                    pythonVersion: version,
                });
                envPath = await createCondaEnv(
                    workspace,
                    getExecutableCommand(conda),
                    generateCommandArgs(version, options),
                    progress,
                    token,
                );
            } catch (ex) {
                traceError(ex);
                hasError = true;
                throw ex;
            } finally {
                if (hasError) {
                    showErrorMessageWithLogs(CreateEnv.Conda.errorCreatingEnvironment);
                }
            }
            return { path: envPath, uri: workspace.uri };
        },
    );
}

export function condaCreationProvider(): CreateEnvironmentProvider {
    return {
        createEnvironment,
        name: 'Conda',

        description: CreateEnv.Conda.providerDescription,

        id: `${PVSC_EXTENSION_ID}:conda`,
    };
}
