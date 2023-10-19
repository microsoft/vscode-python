// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Position, TextDocument, Uri, WorkspaceEdit, Range, TextEditorRevealType, ProgressLocation } from 'vscode';
import { IApplicationEnvironment, IApplicationShell, IDocumentManager } from '../../common/application/types';
import { IDisposableRegistry, IExperimentService, IPersistentStateFactory } from '../../common/types';
import { Common, Interpreters } from '../../common/utils/localize';
import { IExtensionSingleActivationService } from '../../activation/types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';
import { IInterpreterService } from '../../interpreter/contracts';
import { PythonEnvType } from '../../pythonEnvironments/base/info';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { TerminalShellType } from '../../common/terminal/types';
import { traceError } from '../../logging';
import { shellExec } from '../../common/process/rawProcessApis';
import { createDeferred, sleep } from '../../common/utils/async';
import { getDeactivateShellInfo } from './deactivateScripts';
import { isTestExecution } from '../../common/constants';
import { ProgressService } from '../../common/application/progressService';
import { copyFile } from '../../common/platform/fs-paths';

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
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {
        this.codeCLI = this.appEnvironment.channel === 'insiders' ? 'code-insiders' : 'code';
        this.progressService = new ProgressService(this.appShell);
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
                await this._notifyUsers(shellType).catch((ex) => traceError('Deactivate prompt failed', ex));
            }),
        );
    }

    public async _notifyUsers(shellType: TerminalShellType): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            `${terminalDeactivationPromptKey}-${shellType}`,
            true,
        );
        if (!notificationPromptEnabled.value) {
            return;
        }
        const scriptInfo = getDeactivateShellInfo(shellType);
        if (!scriptInfo) {
            // Shell integration is not supported for these shells, in which case this workaround won't work.
            return;
        }
        const { initScript, source, destination } = scriptInfo;
        const prompts = [Common.editSomething.format(initScript.displayName), Common.doNotShowAgain];
        const selection = await this.appShell.showWarningMessage(
            Interpreters.terminalDeactivatePrompt.format(initScript.displayName),
            ...prompts,
        );
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            this.progressService.showProgress({
                location: ProgressLocation.Window,
                title: Interpreters.terminalDeactivateProgress.format(initScript.displayName),
            });
            await copyFile(source, destination);
            await this.openScriptWithEdits(initScript.path, initScript.contents);
            await notificationPromptEnabled.updateValue(false);
            this.progressService.hideProgress();
        }
        if (selection === prompts[1]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }

    private async openScriptWithEdits(scriptPath: string, content: string) {
        const document = await this.openScript(scriptPath);
        const hookMarker = 'VSCode venv deactivate hook';
        content = `
# >>> ${hookMarker} >>>
${content}
# <<< ${hookMarker} <<<`;
        // If script already has the hook, don't add it again.
        if (document.getText().includes(hookMarker)) {
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
        await shellExec(`${this.codeCLI} -r ${scriptPath}`, { shell: this.appEnvironment.shell });
        return deferred.promise;
    }
}
