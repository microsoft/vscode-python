import { Disposable, TerminalShellExecutionStartEvent } from 'vscode';
import { CreateEnvOnPipInstallTrigger } from '../../common/experiments/groups';
import { inExperiment } from '../common/externalDependencies';
import {
    disableCreateEnvironmentTrigger,
    disableWorkspaceCreateEnvironmentTrigger,
    isGlobalPythonSelected,
    shouldPromptToCreateEnv,
} from './common/createEnvTriggerUtils';
import { getWorkspaceFolder, getWorkspaceFolders } from '../../common/vscodeApis/workspaceApis';
import { CreateEnv } from '../../common/utils/localize';
import { traceError, traceInfo } from '../../logging';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import { Commands, PVSC_EXTENSION_ID } from '../../common/constants';
import { CreateEnvironmentResult } from './proposed.createEnvApis';
import { onDidStartTerminalShellExecution, showWarningMessage } from '../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

export function registerTriggerForPipInTerminal(disposables: Disposable[]): void {
    if (!shouldPromptToCreateEnv() || !inExperiment(CreateEnvOnPipInstallTrigger.experiment)) {
        return;
    }

    const folders = getWorkspaceFolders();
    if (!folders || folders.length === 0) {
        return;
    }

    const createEnvironmentTriggered: Map<string, boolean> = new Map();
    folders.forEach((workspaceFolder) => {
        createEnvironmentTriggered.set(workspaceFolder.uri.fsPath, false);
    });

    disposables.push(
        onDidStartTerminalShellExecution(async (e: TerminalShellExecutionStartEvent) => {
            const workspaceFolder = getWorkspaceFolder(e.shellIntegration.cwd);
            if (
                workspaceFolder &&
                !createEnvironmentTriggered.get(workspaceFolder.uri.fsPath) &&
                (await isGlobalPythonSelected(workspaceFolder))
            ) {
                if (e.execution.commandLine.isTrusted && e.execution.commandLine.value.startsWith('pip install')) {
                    createEnvironmentTriggered.set(workspaceFolder.uri.fsPath, true);
                    sendTelemetryEvent(EventName.ENVIRONMENT_TERMINAL_GLOBAL_PIP);
                    const selection = await showWarningMessage(
                        CreateEnv.Trigger.globalPipInstallTriggerMessage,
                        CreateEnv.Trigger.createEnvironment,
                        CreateEnv.Trigger.disableCheckWorkspace,
                        CreateEnv.Trigger.disableCheck,
                    );
                    if (selection === CreateEnv.Trigger.createEnvironment) {
                        try {
                            const result: CreateEnvironmentResult = await executeCommand(Commands.Create_Environment, {
                                workspaceFolder,
                                providerId: `${PVSC_EXTENSION_ID}:venv`,
                            });
                            if (result.path) {
                                traceInfo('CreateEnv Trigger - Environment created: ', result.path);
                                traceInfo(
                                    `CreateEnv Trigger - Running: ${
                                        result.path
                                    } -m ${e.execution.commandLine.value.trim()}`,
                                );
                                e.shellIntegration.executeCommand(
                                    `${result.path} -m ${e.execution.commandLine.value}`.trim(),
                                );
                            }
                        } catch (error) {
                            traceError('CreateEnv Trigger - Error while creating environment: ', error);
                        }
                    } else if (selection === CreateEnv.Trigger.disableCheck) {
                        disableCreateEnvironmentTrigger();
                    } else if (selection === CreateEnv.Trigger.disableCheckWorkspace) {
                        disableWorkspaceCreateEnvironmentTrigger();
                    }
                }
            }
        }),
    );
}
