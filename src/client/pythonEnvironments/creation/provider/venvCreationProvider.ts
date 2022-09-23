// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, WorkspaceFolder } from 'vscode';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { CreateEnv } from '../../../common/utils/localize';
import { traceError, traceLog } from '../../../logging';
import { PythonEnvKind } from '../../base/info';
import { IDiscoveryAPI } from '../../base/locator';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { IInterpreterQuickPick } from '../../../interpreter/configuration/types';
import { EnvironmentType, PythonEnvironment } from '../../info';

export const VENV_CREATED_MARKER = 'CREATED_VENV:';
export const INSTALLING_REQUIREMENTS = 'VENV_INSTALLING_REQUIREMENTS:';
export const INSTALLING_PYPROJECT = 'VENV_INSTALLING_PYPROJECT:';
export const PIP_NOT_INSTALLED_MARKER = 'CREATE_VENV.PIP_NOT_FOUND';
export const VENV_NOT_INSTALLED_MARKER = 'CREATE_VENV.VENV_NOT_FOUND';
export const INSTALL_REQUIREMENTS_FAILED_MARKER = 'CREATE_VENV.PIP_FAILED_INSTALL_REQUIREMENTS';
export const INSTALL_PYPROJECT_FAILED_MARKER = 'CREATE_VENV.PIP_FAILED_INSTALL_PYPROJECT';

function generateCommandArgs(options?: CreateEnvironmentOptions): string[] {
    let addGitIgnore = true;
    let installPackages = true;
    if (options) {
        addGitIgnore = options?.ignoreSourceControl !== undefined ? options.ignoreSourceControl : true;
        installPackages = options?.installPackages !== undefined ? options.installPackages : true;
    }

    const command: string[] = [createVenvScript()];

    if (addGitIgnore) {
        command.push('--git-ignore');
    }

    if (installPackages) {
        command.push('--install');
    }

    return command;
}

async function createVenv(
    workspace: WorkspaceFolder,
    command: string,
    args: string[],
    progress?: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
    progress?.report({
        message: CreateEnv.Venv.creating,
    });
    const deferred = createDeferred<string | undefined>();
    traceLog('Running Env creation script: ', [command, ...args]);
    const { out, dispose } = execObservable(command, args, {
        mergeStdOutErr: true,
        token,
        cwd: workspace.uri.fsPath,
    });

    let venvPath: string | undefined;
    out.subscribe(
        (value) => {
            const output = value.out.split(/\r?\n/g).join('\r\n');
            traceLog(output);
            if (output.includes(VENV_CREATED_MARKER)) {
                progress?.report({
                    message: CreateEnv.Venv.created,
                });
                try {
                    const envPath = output
                        .split(/\r?\n/g)
                        .map((s) => s.trim())
                        .filter((s) => s.startsWith(VENV_CREATED_MARKER))[0];
                    venvPath = envPath.substring(VENV_CREATED_MARKER.length);
                } catch (ex) {
                    traceError('Parsing out environment path failed.');
                    venvPath = undefined;
                }
            } else if (output.includes(INSTALLING_REQUIREMENTS) || output.includes(INSTALLING_PYPROJECT)) {
                progress?.report({
                    message: CreateEnv.Venv.installingPackages,
                });
            }
        },
        (error) => {
            traceError('Error while running venv creation script: ', error);
            deferred.reject(error);
        },
        () => {
            dispose();
            if (!deferred.rejected) {
                deferred.resolve(venvPath);
            }
        },
    );
    return deferred.promise;
}

export class VenvCreationProvider implements CreateEnvironmentProvider {
    constructor(
        private readonly discoveryApi: IDiscoveryAPI,
        private readonly interpreterQuickPick: IInterpreterQuickPick,
    ) {}

    public async createEnvironment(
        options?: CreateEnvironmentOptions,
        progress?: CreateEnvironmentProgress,
        token?: CancellationToken,
    ): Promise<string | undefined> {
        progress?.report({
            message: CreateEnv.Venv.waitingForWorkspace,
        });

        const workspace = (await pickWorkspaceFolder()) as WorkspaceFolder | undefined;
        if (workspace === undefined) {
            traceError('Workspace was not selected or found for creating virtual environment.');
            return undefined;
        }

        progress?.report({
            message: CreateEnv.Venv.waitingForPython,
        });
        const interpreters = this.discoveryApi.getEnvs({
            kinds: [PythonEnvKind.MicrosoftStore, PythonEnvKind.OtherGlobal],
        });

        const args = generateCommandArgs(options);
        if (interpreters.length === 1) {
            return createVenv(workspace, interpreters[0].executable.filename, args, progress, token);
        }

        const interpreter = await this.interpreterQuickPick.getInterpreterViaQuickPick(
            workspace.uri,
            (i: PythonEnvironment) =>
                [EnvironmentType.System, EnvironmentType.MicrosoftStore, EnvironmentType.Global].includes(i.envType),
        );

        if (interpreter) {
            return createVenv(workspace, interpreter, args, progress, token);
        }

        traceError('Virtual env creation requires an interpreter.');
        return undefined;
    }

    name = 'Venv';

    description: string = CreateEnv.Venv.providerDescription;

    id = `${PVSC_EXTENSION_ID}:venv`;
}
