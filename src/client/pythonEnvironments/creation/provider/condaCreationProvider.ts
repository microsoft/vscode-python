// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, WorkspaceFolder } from 'vscode';
import * as path from 'path';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { traceError, traceLog } from '../../../logging';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { getEnvironmentVariable, getOSType, OSType } from '../../../common/utils/platform';
import { createCondaScript } from '../../../common/process/internal/scripts';
import { CreateEnv } from '../../../common/utils/localize';
import { getConda, pickPythonVersion } from './condaUtils';
import { showErrorMessageWithLogs } from '../common/commonUtils';

export const CONDA_ENV_CREATED_MARKER = 'CREATED_CONDA_ENV:';
export const CONDA_INSTALLING_YML = 'CONDA_INSTALLING_YML:';

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

async function createCondaEnv(
    workspace: WorkspaceFolder,
    command: string,
    args: string[],
    progress?: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
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
    const { out, dispose } = execObservable(command, args, {
        mergeStdOutErr: true,
        token,
        cwd: workspace.uri.fsPath,
        env: {
            PATH: pathEnv,
        },
    });

    let condaEnvPath: string | undefined;
    out.subscribe(
        (value) => {
            const output = value.out.splitLines().join('\r\n');
            traceLog(output);
            if (output.includes(CONDA_ENV_CREATED_MARKER)) {
                progress?.report({
                    message: CreateEnv.Conda.created,
                });
                try {
                    const envPath = output
                        .split(/\r?\n/g)
                        .map((s) => s.trim())
                        .filter((s) => s.startsWith(CONDA_ENV_CREATED_MARKER))[0];
                    condaEnvPath = envPath.substring(CONDA_ENV_CREATED_MARKER.length);
                } catch (ex) {
                    traceError('Parsing out environment path failed.');
                    condaEnvPath = undefined;
                }
            } else if (output.includes(CONDA_INSTALLING_YML)) {
                progress?.report({
                    message: CreateEnv.Conda.installingPackages,
                });
            }
        },
        async (error) => {
            traceError('Error while running conda env creation script: ', error);
            deferred.reject(error);
            await showErrorMessageWithLogs(CreateEnv.Conda.errorCreatingEnvironment);
        },
        () => {
            dispose();
            if (!deferred.rejected) {
                deferred.resolve(condaEnvPath);
            }
        },
    );
    return deferred.promise;
}

function getExecutableCommand(condaPath: string): string {
    if (getOSType() === OSType.Windows) {
        // Both Miniconda3 and Anaconda3 have the following structure:
        // Miniconda3 (or Anaconda3)
        //  |- condabin
        //  |   |- conda.bat  <--- this actually points to python.exe below,
        //  |                      after adding few paths to PATH.
        //  |- Scripts
        //  |   |- conda.exe  <--- this is the path we get as condaPath,
        //  |                      which is really a stub for `python.exe -m conda`.
        //  |- python.exe     <--- this is the python that we want.
        return path.join(path.dirname(path.dirname(condaPath)), 'python.exe');
    }
    // On non-windows machines:
    // miniconda (or miniforge or anaconda3)
    // |- bin
    //     |- conda    <--- this is the path we get as condaPath.
    //     |- python   <--- this is the python that we want.
    return path.join(path.dirname(condaPath), 'python');
}

async function createEnvironment(
    options?: CreateEnvironmentOptions,
    progress?: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
    progress?.report({
        message: CreateEnv.Conda.searching,
    });
    const conda = await getConda();
    if (!conda) {
        return undefined;
    }

    progress?.report({
        message: CreateEnv.Conda.waitingForWorkspace,
    });
    const workspace = (await pickWorkspaceFolder()) as WorkspaceFolder | undefined;
    if (!workspace) {
        traceError('Workspace was not selected or found for creating virtual env.');
        return undefined;
    }

    progress?.report({
        message: CreateEnv.Conda.waitingForPython,
    });
    const version = await pickPythonVersion();
    if (!version) {
        traceError('Conda environments for use with python extension require Python.');
        return undefined;
    }

    progress?.report({
        message: CreateEnv.Conda.creating,
    });
    const args = generateCommandArgs(version, options);
    return createCondaEnv(workspace, getExecutableCommand(conda), args, progress, token);
}

export function condaCreationProvider(): CreateEnvironmentProvider {
    return {
        createEnvironment,
        name: 'Conda',

        description: CreateEnv.Conda.providerDescription,

        id: `${PVSC_EXTENSION_ID}:conda`,
    };
}
