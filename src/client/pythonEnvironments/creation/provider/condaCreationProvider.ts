// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable class-methods-use-this */

import { CancellationToken, QuickPickItem, Uri, WorkspaceFolder } from 'vscode';
import * as path from 'path';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { showErrorMessage, showQuickPick } from '../../../common/vscodeApis/windowApis';
import { traceError, traceLog } from '../../../logging';
import { Conda } from '../../common/environmentManagers/conda';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { getEnvironmentVariable, getOSType, OSType } from '../../../common/utils/platform';
import { createCondaScript } from '../../../common/process/internal/scripts';
import { Common, CreateEnv } from '../../../common/utils/localize';
import { executeCommand } from '../../../common/vscodeApis/commandApis';

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
                } finally {
                    condaEnvPath = undefined;
                }
            } else if (output.includes(CONDA_INSTALLING_YML)) {
                progress?.report({
                    message: CreateEnv.Conda.installingPackages,
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

async function getConda(progress?: CreateEnvironmentProgress): Promise<Conda | undefined> {
    progress?.report({
        message: CreateEnv.Conda.searching,
    });
    const conda = await Conda.getConda();

    if (!conda) {
        const response = await showErrorMessage(CreateEnv.Conda.condaMissing, Common.learnMore);
        if (response === Common.learnMore) {
            await executeCommand('vscode.open', Uri.parse('https://docs.anaconda.com/anaconda/install/'));
        }
        return undefined;
    }
    return conda;
}

async function pickPythonVersion(progress?: CreateEnvironmentProgress): Promise<string | undefined> {
    progress?.report({
        message: CreateEnv.Conda.waitingForPython,
    });
    const items: QuickPickItem[] = ['3.7', '3.8', '3.9', '3.10'].map((v) => ({
        label: `Python`,
        description: v,
    }));
    const version = await showQuickPick(items, {
        title: CreateEnv.Conda.selectPythonQuickPickTitle,
    });
    return version?.description;
}

async function createEnvironment(
    options?: CreateEnvironmentOptions,
    progress?: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
    const conda = await getConda(progress);
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

    const version = await pickPythonVersion(progress);
    if (!version) {
        traceError('Conda environments for use with python extension require Python.');
        return undefined;
    }

    progress?.report({
        message: CreateEnv.Conda.creating,
    });
    const args = generateCommandArgs(version, options);
    return createCondaEnv(workspace, getExecutableCommand(conda.command), args, progress, token);
}

export function condaCreationProvider(): CreateEnvironmentProvider {
    return {
        createEnvironment,
        name: CreateEnv.Conda.providerName,

        description: CreateEnv.Conda.providerDescription,

        id: `${PVSC_EXTENSION_ID}:conda`,
    };
}
