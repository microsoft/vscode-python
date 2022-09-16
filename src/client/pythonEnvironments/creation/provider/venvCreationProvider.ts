// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, QuickPickItem, WorkspaceFolder } from 'vscode';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { CreateEnv } from '../../../common/utils/localize';
import { showQuickPick } from '../../../common/vscodeApis/windowApis';
import { traceError, traceLog } from '../../../logging';
import { PythonEnvKind } from '../../base/info';
import { IDiscoveryAPI } from '../../base/locator';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';

const VENV_CREATED_MARKER = 'CREATED_VENV:';
const INSTALLING_REQUIREMENTS = 'VENV_INSTALLING_REQUIREMENTS:';
const INSTALLING_PYPROJECT = 'VENV_INSTALLING_PYPROJECT:';

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
                } finally {
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
    constructor(private readonly discoveryApi: IDiscoveryAPI) {}

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
            traceError('Workspace was not selected or found for creating virtual env.');
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
        if (interpreters.length > 1) {
            const items: QuickPickItem[] = interpreters.map((i) => ({
                label: `Python ${i.version.major}.${i.version.minor}.${i.version.micro}`,
                detail: i.executable.filename,
                description: i.distro.defaultDisplayName,
            }));
            const selected = await showQuickPick(items, {
                title: CreateEnv.Venv.selectPythonQuickPickTitle,
                matchOnDetail: true,
                matchOnDescription: true,
            });
            if (selected && selected.detail) {
                return createVenv(workspace, selected.detail, args, progress, token);
            }
        } else {
            traceError('No Python found to create venv.');
        }
        return undefined;
    }

    name = CreateEnv.Venv.providerName;

    description: string = CreateEnv.Venv.providerDescription;

    id = `${PVSC_EXTENSION_ID}:venv`;
}
