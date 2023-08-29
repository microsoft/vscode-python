// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, ProgressLocation, WorkspaceFolder } from 'vscode';
import * as path from 'path';
import { Commands, PVSC_EXTENSION_ID } from '../../../common/constants';
import { traceError, traceInfo, traceLog } from '../../../logging';
import { CreateEnvironmentProgress } from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { getEnvironmentVariable, getOSType, OSType } from '../../../common/utils/platform';
import { createCondaScript } from '../../../common/process/internal/scripts';
import { Common, CreateEnv } from '../../../common/utils/localize';
import { getCondaBaseEnv, pickPythonVersion } from './condaUtils';
import { showErrorMessageWithLogs } from '../common/commonUtils';
import { MultiStepAction, MultiStepNode, withProgress } from '../../../common/vscodeApis/windowApis';
import { EventName } from '../../../telemetry/constants';
import { sendTelemetryEvent } from '../../../telemetry';
import {
    CondaProgressAndTelemetry,
    CONDA_ENV_CREATED_MARKER,
    CONDA_ENV_EXISTING_MARKER,
} from './condaProgressAndTelemetry';
import { splitLines } from '../../../common/stringUtils';
import {
    CreateEnvironmentOptions,
    CreateEnvironmentResult,
    CreateEnvironmentProvider,
} from '../proposed.createEnvApis';

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
): Promise<string> {
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
            const output = splitLines(value.out).join('\r\n');
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

    let workspace: WorkspaceFolder | undefined;
    const workspaceStep = new MultiStepNode(
        undefined,
        async (context?: MultiStepAction) => {
            try {
                workspace = (await pickWorkspaceFolder(undefined, context)) as WorkspaceFolder | undefined;
            } catch (ex) {
                if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                    return ex;
                }
                throw ex;
            }

            if (workspace === undefined) {
                traceError('Workspace was not selected or found for creating conda environment.');
                return MultiStepAction.Cancel;
            }
            traceInfo(`Selected workspace ${workspace.uri.fsPath} for creating conda environment.`);
            return MultiStepAction.Continue;
        },
        undefined,
    );

    let version: string | undefined;
    const versionStep = new MultiStepNode(
        workspaceStep,
        async () => {
            try {
                version = await pickPythonVersion();
            } catch (ex) {
                if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                    return ex;
                }
                throw ex;
            }

            if (version === undefined) {
                traceError('Python version was not selected for creating conda environment.');
                return MultiStepAction.Cancel;
            }
            traceInfo(`Selected Python version ${version} for creating conda environment.`);
            return MultiStepAction.Continue;
        },
        undefined,
    );
    workspaceStep.next = versionStep;

    const action = await MultiStepNode.run(workspaceStep);
    if (action === MultiStepAction.Back || action === MultiStepAction.Cancel) {
        throw action;
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
            progress.report({
                message: CreateEnv.statusStarting,
            });

            let envPath: string | undefined;
            try {
                sendTelemetryEvent(EventName.ENVIRONMENT_CREATING, undefined, {
                    environmentType: 'conda',
                    pythonVersion: version,
                });
                if (workspace) {
                    envPath = await createCondaEnv(
                        workspace,
                        getExecutableCommand(conda),
                        generateCommandArgs(version, options),
                        progress,
                        token,
                    );

                    if (envPath) {
                        return { path: envPath, workspaceFolder: workspace };
                    }

                    throw new Error('Failed to create conda environment. See Output > Python for more info.');
                } else {
                    throw new Error('A workspace is needed to create conda environment');
                }
            } catch (ex) {
                traceError(ex);
                showErrorMessageWithLogs(CreateEnv.Conda.errorCreatingEnvironment);
                throw ex;
            }
        },
    );
}

export function condaCreationProvider(): CreateEnvironmentProvider {
    return {
        createEnvironment,
        name: 'Conda',

        description: CreateEnv.Conda.providerDescription,

        id: `${PVSC_EXTENSION_ID}:conda`,

        tools: ['Conda'],
    };
}
