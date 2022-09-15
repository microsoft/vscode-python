// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable class-methods-use-this */

import { CancellationToken, QuickPickItem, WorkspaceFolder } from 'vscode';
import * as nls from 'vscode-nls';
import * as path from 'path';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { showQuickPick } from '../../../common/vscodeApis/windowApis';
import { traceError, traceLog } from '../../../logging';
import { Conda } from '../../common/environmentManagers/conda';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from '../types';
import { pickWorkspaceFolder } from './workspaceSelection';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { getEnvironmentVariable, getOSType, OSType } from '../../../common/utils/platform';
import { createCondaScript } from '../../../common/process/internal/scripts';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

const CONDA_ENV_CREATED_MARKER = 'CREATED_CONDA_ENV:';
const CONDA_INSTALLING_YML = 'CONDA_INSTALLING_YML:';

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
        const root = path.dirname(command);
        const libPath1 = path.join(root, 'Library', 'bin');
        const libPath2 = path.join(root, 'Library', 'mingw-w64', 'bin');
        const libPath3 = path.join(root, 'Library', 'usr', 'bin');
        const libPath4 = path.join(root, 'bin');
        const libPath5 = path.join(root, 'Scripts');
        const libPath = [libPath1, libPath2, libPath3, libPath4, libPath5].join(path.delimiter);
        pathEnv = `${libPath}${path.delimiter}${pathEnv}`;
    }
    traceLog('Running Env creation script: ', [command, ...args]);
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
                    message: localize('python.createEnv.conda.created', 'Environment created...'),
                });
                try {
                    const envPath = output
                        .split(/\r?\n/g)
                        .map((s) => s.trim())
                        .filter((s) => s.startsWith(CONDA_ENV_CREATED_MARKER))[0];
                    condaEnvPath = envPath.substring(CONDA_ENV_CREATED_MARKER.length);
                } catch (ex) {
                    traceError('Parsing out environment path failed.');
                } finally {
                    condaEnvPath = undefined;
                }
            } else if (output.includes(CONDA_INSTALLING_YML)) {
                progress?.report({
                    message: localize('python.createEnv.conda.installingPackages', 'Installing packages...'),
                });
            }
        },
        (error) => {
            traceError('Error while running conda env creation script: ', error);
            deferred.reject(error);
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
        return path.join(path.dirname(path.dirname(condaPath)), 'python.exe');
    }
    return path.join(path.dirname(condaPath), 'python');
}

async function createEnvironment(
    options?: CreateEnvironmentOptions,
    progress?: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
    progress?.report({
        message: localize('python.createEnv.conda.workspace', 'Waiting on workspace selection...'),
    });
    const workspace = (await pickWorkspaceFolder()) as WorkspaceFolder | undefined;
    if (workspace === undefined) {
        traceError('Workspace was not selected or found for creating virtual env.');
        return undefined;
    }

    progress?.report({
        message: localize('python.createEnv.conda.selectPython', 'Waiting on Python version selection...'),
    });
    const items: QuickPickItem[] = ['3.7', '3.8', '3.9', '3.10'].map((v) => ({
        label: `Python`,
        description: v,
    }));
    const version = await showQuickPick(items, {
        title: localize(
            'python.createConda.pythonSelection.title',
            'Please select the version of python to install in the environment.',
        ),
    });
    if (version) {
        progress?.report({
            message: localize('python.createEnv.conda.findConda', 'Searching for conda (base)...'),
        });
        const conda = await Conda.getConda();

        if (!conda) {
            traceError('Conda executable was not found.');
            return undefined;
        }
        progress?.report({
            message: localize('python.createEnv.conda.runCreate', 'Running conda create...'),
        });
        const args = generateCommandArgs(version.description, options);
        return createCondaEnv(workspace, getExecutableCommand(conda.command), args, progress, token);
    }
    return undefined;
}

export function condaCreationProvider(): CreateEnvironmentProvider {
    return {
        createEnvironment,
        name: 'conda',

        description: localize(
            'python.conda.description',
            'Creates a `.conda` virtual environment, using `conda`, in the current workspace.',
        ),

        id: `${PVSC_EXTENSION_ID}:conda`,
    };
}
