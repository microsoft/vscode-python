// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, QuickPickItem, WorkspaceFolder } from 'vscode';
import * as nls from 'vscode-nls';
import { PVSC_EXTENSION_ID } from '../../../common/constants';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { showQuickPick } from '../../../common/vscodeApis/windowApis';
import { traceError, traceLog } from '../../../logging';
import { PythonEnvKind } from '../../base/info';
import { IDiscoveryAPI } from '../../base/locator';
import { CreateEnvironmentOptions, CreateEnvironmentProgress, CreateEnvironmentProvider } from '../types';
import { pickWorkspaceFolder } from './workspaceSelection';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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
): Promise<void> {
    progress?.report({
        message: localize('python.createEnv.venv.runCreate', 'Creating venv...'),
    });
    const deferred = createDeferred();
    traceLog('Running Env creation script: ', [command, ...args]);
    const { out, dispose } = execObservable(command, args, {
        mergeStdOutErr: true,
        token,
        cwd: workspace.uri.fsPath,
    });

    out.subscribe(
        (value) => {
            const output = value.out.splitLines().join('\r\n');
            traceLog(output);
            if (output.includes('CREATED_VENV:')) {
                progress?.report({
                    message: localize('python.createEnv.venv.created', 'Environment created...'),
                });
            } else if (
                output.includes('VENV_INSTALLING_REQUIREMENTS:') ||
                output.includes('VENV_INSTALLING_PYPROJECT:')
            ) {
                progress?.report({
                    message: localize('python.createEnv.venv.installingPackages', 'Installing packages...'),
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
                deferred.resolve();
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
    ): Promise<void> {
        progress?.report({
            message: localize('python.createEnv.venv.workspace', 'Waiting on workspace selection...'),
        });
        const workspace = (await pickWorkspaceFolder()) as WorkspaceFolder | undefined;
        if (workspace === undefined) {
            traceError('Workspace was not selected or found for creating virtual env.');
            return;
        }

        progress?.report({
            message: localize('python.createEnv.venv.selectPython', 'Waiting on Python selection...'),
        });
        const interpreters = this.discoveryApi.getEnvs({
            kinds: [PythonEnvKind.MicrosoftStore, PythonEnvKind.OtherGlobal],
        });

        const args = generateCommandArgs(options);
        if (interpreters.length === 1) {
            await createVenv(workspace, interpreters[0].executable.filename, args, progress, token);
        } else if (interpreters.length > 1) {
            const items: QuickPickItem[] = interpreters.map((i) => ({
                label: `Python ${i.version.major}.${i.version.minor}.${i.version.micro}`,
                detail: i.executable.filename,
                description: i.distro.defaultDisplayName,
            }));
            const selected = await showQuickPick(items, {
                title: localize(
                    'python.createEnv.basePython.title',
                    'Select a python to use for environment creation.',
                ),
                matchOnDetail: true,
                matchOnDescription: true,
            });
            if (selected && selected.detail) {
                await createVenv(workspace, selected.detail, args, progress, token);
            }
        } else {
            traceError('No Python found to create venv.');
        }
    }

    name = 'venv';

    description: string = localize(
        'python.venv.description',
        'Creates a `.venv` virtual environment using `venv` in the current workspace.',
    );

    id = `${PVSC_EXTENSION_ID}:venv`;
}
