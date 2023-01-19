// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import { CancellationToken, ProgressLocation, WorkspaceFolder } from 'vscode';
import { Commands, PVSC_EXTENSION_ID } from '../../../common/constants';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { Common, CreateEnv } from '../../../common/utils/localize';
import { traceError, traceInfo, traceLog } from '../../../logging';
import {
    CreateEnvironmentOptions,
    CreateEnvironmentProgress,
    CreateEnvironmentProvider,
    CreateEnvironmentResult,
} from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { IInterpreterQuickPick } from '../../../interpreter/configuration/types';
import { EnvironmentType, PythonEnvironment } from '../../info';
import { withProgress } from '../../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { VenvProgressAndTelemetry, VENV_CREATED_MARKER, VENV_EXISTING_MARKER } from './venvProgressAndTelemetry';
import { showErrorMessageWithLogs } from '../common/commonUtils';
import { IPackageInstallSelection, pickPackagesToInstall } from './venvUtils';

function generateCommandArgs(installInfo?: IPackageInstallSelection, addGitIgnore?: boolean): string[] {
    const command: string[] = [createVenvScript()];

    if (addGitIgnore) {
        command.push('--git-ignore');
    }

    if (installInfo) {
        if (installInfo?.installType === 'toml') {
            command.push('--toml', installInfo.source?.fileToCommandArgumentForPythonExt() || 'pyproject.toml');
            installInfo.installList?.forEach((i) => command.push('--extras', i));
        } else if (installInfo?.installType === 'requirements') {
            installInfo.installList?.forEach((i) => command.push('--requirements', i));
        }
    }

    return command;
}

function getVenvFromOutput(output: string): string | undefined {
    try {
        const envPath = output
            .split(/\r?\n/g)
            .map((s) => s.trim())
            .filter((s) => s.startsWith(VENV_CREATED_MARKER) || s.startsWith(VENV_EXISTING_MARKER))[0];
        if (envPath.includes(VENV_CREATED_MARKER)) {
            return envPath.substring(VENV_CREATED_MARKER.length);
        }
        return envPath.substring(VENV_EXISTING_MARKER.length);
    } catch (ex) {
        traceError('Parsing out environment path failed.');
        return undefined;
    }
}

async function createVenv(
    workspace: WorkspaceFolder,
    command: string,
    args: string[],
    progress: CreateEnvironmentProgress,
    token?: CancellationToken,
): Promise<string | undefined> {
    progress.report({
        message: CreateEnv.Venv.creating,
    });
    sendTelemetryEvent(EventName.ENVIRONMENT_CREATING, undefined, {
        environmentType: 'venv',
        pythonVersion: undefined,
    });

    const deferred = createDeferred<string | undefined>();
    traceLog('Running Env creation script: ', [command, ...args]);
    const { proc, out, dispose } = execObservable(command, args, {
        mergeStdOutErr: true,
        token,
        cwd: workspace.uri.fsPath,
    });

    const progressAndTelemetry = new VenvProgressAndTelemetry(progress);
    let venvPath: string | undefined;
    out.subscribe(
        (value) => {
            const output = value.out.split(/\r?\n/g).join(os.EOL);
            traceLog(output);
            if (output.includes(VENV_CREATED_MARKER) || output.includes(VENV_EXISTING_MARKER)) {
                venvPath = getVenvFromOutput(output);
            }
            progressAndTelemetry.process(output);
        },
        (error) => {
            traceError('Error while running venv creation script: ', error);
            deferred.reject(error);
        },
        () => {
            dispose();
            if (proc?.exitCode !== 0) {
                traceError('Error while running venv creation script: ', progressAndTelemetry.getLastError());
                deferred.reject(progressAndTelemetry.getLastError());
            } else {
                deferred.resolve(venvPath);
            }
        },
    );
    return deferred.promise;
}

export class VenvCreationProvider implements CreateEnvironmentProvider {
    constructor(private readonly interpreterQuickPick: IInterpreterQuickPick) {}

    public async createEnvironment(options?: CreateEnvironmentOptions): Promise<CreateEnvironmentResult | undefined> {
        const workspace = (await pickWorkspaceFolder()) as WorkspaceFolder | undefined;
        if (workspace === undefined) {
            traceError('Workspace was not selected or found for creating virtual environment.');
            return undefined;
        }

        const interpreter = await this.interpreterQuickPick.getInterpreterViaQuickPick(
            workspace.uri,
            (i: PythonEnvironment) =>
                [EnvironmentType.System, EnvironmentType.MicrosoftStore, EnvironmentType.Global].includes(i.envType),
        );

        let addGitIgnore = true;
        let installPackages = true;
        if (options) {
            addGitIgnore = options?.ignoreSourceControl !== undefined ? options.ignoreSourceControl : true;
            installPackages = options?.installPackages !== undefined ? options.installPackages : true;
        }
        let installInfo: IPackageInstallSelection | undefined;
        if (installPackages) {
            installInfo = await pickPackagesToInstall(workspace);
        }
        const args = generateCommandArgs(installInfo, addGitIgnore);

        if (!interpreter) {
            traceError('Virtual env creation requires an interpreter.');
            return undefined;
        }

        if (!installInfo) {
            traceInfo('Virtual env creation exited during dependencies selection.');
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
                    if (interpreter) {
                        envPath = await createVenv(workspace, interpreter, args, progress, token);
                    }
                } catch (ex) {
                    traceError(ex);
                    hasError = true;
                    throw ex;
                } finally {
                    if (hasError) {
                        showErrorMessageWithLogs(CreateEnv.Venv.errorCreatingEnvironment);
                    }
                }

                return { path: envPath, uri: workspace.uri };
            },
        );
    }

    name = 'Venv';

    description: string = CreateEnv.Venv.providerDescription;

    id = `${PVSC_EXTENSION_ID}:venv`;
}
