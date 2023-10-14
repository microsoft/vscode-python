// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Position, TextDocument, Uri, window, workspace, WorkspaceEdit, Range, TextEditorRevealType } from 'vscode';
import { IApplicationEnvironment, IApplicationShell, IDocumentManager } from '../../common/application/types';
import {
    IBrowserService,
    IDisposableRegistry,
    IExperimentService,
    IPersistentState,
    IPersistentStateFactory,
} from '../../common/types';
import { Common, Interpreters } from '../../common/utils/localize';
import { IExtensionSingleActivationService } from '../../activation/types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';
import { IInterpreterService } from '../../interpreter/contracts';
import { PythonEnvType } from '../../pythonEnvironments/base/info';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { TerminalShellType } from '../../common/terminal/types';
import { IFileSystem } from '../../common/platform/types';
import { traceError } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { shellExec } from '../../common/process/rawProcessApis';
import { createDeferred } from '../../common/utils/async';
import { getDeactivateShellInfo } from './deactivateScripts';

export const terminalDeactivationPromptKey = 'TERMINAL_DEACTIVATION_PROMPT_KEY';
@injectable()
export class TerminalDeactivateLimitationPrompt implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private readonly codeCLI: string;

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IBrowserService) private readonly browserService: IBrowserService,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {
        this.codeCLI = this.appEnvironment.channel === 'insiders' ? 'code-insiders' : 'code';
    }

    public async activate(): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            return;
        }
        this.disposableRegistry.push(
            this.appShell.onDidWriteTerminalData(async (e) => {
                if (!e.data.includes('deactivate')) {
                    return;
                }
                const shellType = identifyShellFromShellPath(this.appEnvironment.shell);
                if (shellType === TerminalShellType.commandPrompt) {
                    return;
                }
                const { terminal } = e;
                const cwd =
                    'cwd' in terminal.creationOptions && terminal.creationOptions.cwd
                        ? terminal.creationOptions.cwd
                        : undefined;
                const resource = typeof cwd === 'string' ? Uri.file(cwd) : cwd;
                const interpreter = await this.interpreterService.getActiveInterpreter(resource);
                if (interpreter?.type !== PythonEnvType.Virtual) {
                    return;
                }
                await this.notifyUsers(shellType).catch((ex) => traceError('Deactivate prompt failed', ex));
            }),
        );
    }

    private async notifyUsers(shellType: TerminalShellType): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            `${terminalDeactivationPromptKey}-${shellType}`,
            true,
        );
        if (!notificationPromptEnabled.value) {
            return;
        }
        const scriptInfo = getDeactivateShellInfo(shellType);
        if (!scriptInfo) {
            await this.showGeneralNotification(notificationPromptEnabled);
            return;
        }
        const { initScript, source, destination } = scriptInfo;
        const prompts = [`Edit ${initScript.displayName}`, Common.doNotShowAgain];
        const selection = await this.appShell.showWarningMessage(
            Interpreters.terminalDeactivateShellSpecificPrompt.format(initScript.displayName),
            ...prompts,
        );
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            await this.fs.copyFile(source, destination);
            await this.openScriptWithEdits(initScript.path, initScript.contents);
            await notificationPromptEnabled.updateValue(false);
        }
        if (selection === prompts[1]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }

    private async openScriptWithEdits(scriptPath: string, content: string) {
        const document = await this.openScript(scriptPath);
        const editorEdit = new WorkspaceEdit();
        content = `\n
# >>> VSCode venv deactivate hook >>>
${content}
# <<< VSCode venv deactivate hook <<<`;
        const editor = await window.showTextDocument(document);
        editorEdit.insert(document.uri, new Position(document.lineCount, 0), content);
        workspace.applyEdit(editorEdit); // Reveal the edits
        const start = new Position(document.lineCount - 3, 0);
        const end = new Position(document.lineCount, 0);
        editor.revealRange(new Range(start, end), TextEditorRevealType.AtTop);
    }

    private async openScript(scriptPath: string) {
        const deferred = createDeferred<TextDocument>();
        this.documentManager.onDidChangeActiveTextEditor((e) => {
            if (e) {
                deferred.resolve(e.document);
            }
        });
        await shellExec(`${this.codeCLI} ${scriptPath}`, { shell: this.appEnvironment.shell });
        return deferred.promise;
    }

    private async showGeneralNotification(notificationPromptEnabled: IPersistentState<boolean>): Promise<void> {
        const prompts = [Common.seeInstructions, Interpreters.deactivateDoneButton, Common.doNotShowAgain];
        const telemetrySelections: ['See Instructions', 'Done, it works', "Don't show again"] = [
            'See Instructions',
            'Done, it works',
            "Don't show again",
        ];
        const selection = await this.appShell.showWarningMessage(Interpreters.terminalDeactivatePrompt, ...prompts);
        if (!selection) {
            return;
        }
        sendTelemetryEvent(EventName.TERMINAL_DEACTIVATE_PROMPT, undefined, {
            selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined,
        });
        if (selection === prompts[0]) {
            const url = `https://aka.ms/AAmx2ft`;
            this.browserService.launch(url);
        }
        if (selection === prompts[1] || selection === prompts[2]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }
}
