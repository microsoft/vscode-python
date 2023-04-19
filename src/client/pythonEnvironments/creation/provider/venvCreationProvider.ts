// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import { CancellationToken, ProgressLocation, WorkspaceFolder } from 'vscode';
import { Commands, PVSC_EXTENSION_ID } from '../../../common/constants';
import { createVenvScript } from '../../../common/process/internal/scripts';
import { execObservable } from '../../../common/process/rawProcessApis';
import { createDeferred } from '../../../common/utils/async';
import { Common, CreateEnv } from '../../../common/utils/localize';
import { traceError, traceLog, traceVerbose } from '../../../logging';
import { CreateEnvironmentProgress } from '../types';
import { pickWorkspaceFolder } from '../common/workspaceSelection';
import { IInterpreterQuickPick } from '../../../interpreter/configuration/types';
import { EnvironmentType, PythonEnvironment } from '../../info';
import { MultiStepAction, MultiStepNode, withProgress } from '../../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { VenvProgressAndTelemetry, VENV_CREATED_MARKER, VENV_EXISTING_MARKER } from './venvProgressAndTelemetry';
import { showErrorMessageWithLogs } from '../common/commonUtils';
import { IPackageInstallSelection, pickPackagesToInstall } from './venvUtils';
import { InputFlowAction } from '../../../common/utils/multiStepInput';
import {
    CreateEnvironmentProvider,
    CreateEnvironmentOptions,
    CreateEnvironmentResult,
} from '../proposed.createEnvApis';

function generateCommandArgs(installInfo?: IPackageInstallSelection[], addGitIgnore?: boolean): string[] {
    const command: string[] = [createVenvScript()];

    if (addGitIgnore) {
        command.push('--git-ignore');
    }

    if (installInfo) {
        if (installInfo.some((i) => i.installType === 'toml')) {
            const source = installInfo.find((i) => i.installType === 'toml')?.source;
            command.push('--toml', source?.fileToCommandArgumentForPythonExt() || 'pyproject.toml');
        }
        const extras = installInfo.filter((i) => i.installType === 'toml').map((i) => i.installItem);
        extras.forEach((r) => {
            if (r) {
                command.push('--extras', r);
            }
        });

        const requirements = installInfo.filter((i) => i.installType === 'requirements').map((i) => i.installItem);
        requirements.forEach((r) => {
            if (r) {
                command.push('--requirements', r);
            }
        });
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
                    traceError('Workspace was not selected or found for creating virtual environment.');
                    return MultiStepAction.Cancel;
                }
                return MultiStepAction.Continue;
            },
            undefined,
        );

        let interpreter: string | undefined;
        const interpreterStep = new MultiStepNode(
            workspaceStep,
            async () => {
                if (workspace) {
                    try {
                        interpreter = await this.interpreterQuickPick.getInterpreterViaQuickPick(
                            workspace.uri,
                            (i: PythonEnvironment) =>
                                [
                                    EnvironmentType.System,
                                    EnvironmentType.MicrosoftStore,
                                    EnvironmentType.Global,
                                ].includes(i.envType),
                            {
                                skipRecommended: true,
                                showBackButton: true,
                                placeholder: CreateEnv.Venv.selectPythonPlaceHolder,
                                title: null,
                            },
                        );
                    } catch (ex) {
                        if (ex === InputFlowAction.back) {
                            return MultiStepAction.Back;
                        }
                        interpreter = undefined;
                    }
                }

                if (!interpreter) {
                    traceError('Virtual env creation requires an interpreter.');
                    return MultiStepAction.Cancel;
                }
                return MultiStepAction.Continue;
            },
            undefined,
        );
        workspaceStep.next = interpreterStep;

        let addGitIgnore = true;
        let installPackages = true;
        if (options) {
            addGitIgnore = options?.ignoreSourceControl !== undefined ? options.ignoreSourceControl : true;
            installPackages = options?.installPackages !== undefined ? options.installPackages : true;
        }
        let installInfo: IPackageInstallSelection[] | undefined;
        const packagesStep = new MultiStepNode(
            interpreterStep,
            async () => {
                if (workspace && installPackages) {
                    try {
                        installInfo = await pickPackagesToInstall(workspace);
                    } catch (ex) {
                        if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                            return ex;
                        }
                        throw ex;
                    }
                    if (!installInfo) {
                        traceVerbose('Virtual env creation exited during dependencies selection.');
                        return MultiStepAction.Cancel;
                    }
                }

                return MultiStepAction.Continue;
            },
            undefined,
        );
        interpreterStep.next = packagesStep;

        const action = await MultiStepNode.run(workspaceStep);
        if (action === MultiStepAction.Back || action === MultiStepAction.Cancel) {
            throw action;
        }

        const args = generateCommandArgs(installInfo, addGitIgnore);

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
                    if (interpreter && workspace) {
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

                return { path: envPath, workspaceFolder: workspace, action: undefined, error: undefined };
            },
        );
    }

    name = 'Venv';

    description: string = CreateEnv.Venv.providerDescription;

    id = `${PVSC_EXTENSION_ID}:venv`;

    tools = ['Venv'];
}
