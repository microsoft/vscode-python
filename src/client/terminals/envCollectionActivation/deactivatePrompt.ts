// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Position, TextDocument, Uri, WorkspaceEdit, Range, TextEditorRevealType } from 'vscode';
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
import { createDeferred, sleep } from '../../common/utils/async';
import { getDeactivateShellInfo } from './deactivateScripts';
import { isTestExecution } from '../../common/constants';
import { ProgressService } from '../../common/application/progressService';

export const terminalDeactivationPromptKey = 'TERMINAL_DEACTIVATION_PROMPT_KEY';
@injectable()
export class TerminalDeactivateLimitationPrompt implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private readonly codeCLI: string;

    private readonly progressService: ProgressService;

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IBrowserService) private readonly browserService: IBrowserService,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IApplicationShell) private readonly shell: IApplicationShell,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {
        this.codeCLI = this.appEnvironment.channel === 'insiders' ? 'code-insiders' : 'code';
        this.progressService = new ProgressService(this.shell, Interpreters.terminalDeactivateProgress);
    }

    public async activate(): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            return;
        }
        if (!isTestExecution()) {
            // Avoid showing prompt until startup completes.
            await sleep(5000);
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
                this.progressService.hideProgress(); // Hide the progress bar if it exists.
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
            this.progressService.showProgress();
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
        content = `
# >>> VSCode venv deactivate hook >>>
${content}
# <<< VSCode venv deactivate hook <<<`;
        // If script already has the hook, don't add it again.
        if (document.getText().includes('VSCode venv deactivate hook')) {
            return;
        }
        const editor = await this.documentManager.showTextDocument(document);
        const editorEdit = new WorkspaceEdit();
        editorEdit.insert(document.uri, new Position(document.lineCount, 0), content);
        await this.documentManager.applyEdit(editorEdit); // Reveal the edits
        const lastLine = new Position(document.lineCount, 0);
        editor.revealRange(new Range(lastLine, lastLine), TextEditorRevealType.AtTop);
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
