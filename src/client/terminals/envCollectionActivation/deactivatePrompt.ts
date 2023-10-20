// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Position, Uri, WorkspaceEdit, Range, TextEditorRevealType, ProgressLocation, Terminal } from 'vscode';
import {
    IApplicationEnvironment,
    IApplicationShell,
    IDocumentManager,
    ITerminalManager,
} from '../../common/application/types';
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
import { sleep } from '../../common/utils/async';
import { getDeactivateShellInfo } from './deactivateScripts';
import { isTestExecution } from '../../common/constants';
import { ProgressService } from '../../common/application/progressService';
import { copyFile, createFile, pathExists } from '../../common/platform/fs-paths';
import { getOSType, OSType } from '../../common/utils/platform';

export const terminalDeactivationPromptKey = 'TERMINAL_DEACTIVATION_PROMPT_KEY';
@injectable()
export class TerminalDeactivateLimitationPrompt implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private terminalProcessId: number | undefined;

    private readonly progressService: ProgressService;

    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IDisposableRegistry) private readonly disposableRegistry: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {
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
                let shellType = identifyShellFromShellPath(this.appEnvironment.shell);
                if (shellType === TerminalShellType.commandPrompt) {
                    return;
                }
                if (getOSType() === OSType.OSX && shellType === TerminalShellType.bash) {
                    // On macOS, sometimes bash is overriden by OS to actually launch zsh, so we need to execute inside
                    // the shell to get the correct shell type.
                    const shell = await shellExec('echo $SHELL', { shell: this.appEnvironment.shell }).then((output) =>
                        output.stdout.trim(),
                    );
                    shellType = identifyShellFromShellPath(shell);
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
                await this._notifyUsers(shellType, terminal).catch((ex) => traceError('Deactivate prompt failed', ex));
            }),
        );
    }

    public async _notifyUsers(shellType: TerminalShellType, terminal: Terminal): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            `${terminalDeactivationPromptKey}-${shellType}`,
            true,
        );
        if (!notificationPromptEnabled.value) {
            const processId = await terminal.processId;
            if (processId && this.terminalProcessId === processId) {
                // Existing terminal needs to be restarted for changes to take effect.
                await this.forceRestartShell(terminal);
            }
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
            await this.openScriptWithEdits(initScript.command, initScript.contents);
            await notificationPromptEnabled.updateValue(false);
            this.progressService.hideProgress();
            this.terminalProcessId = await terminal.processId;
        }
        if (selection === prompts[1]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }

    private async openScriptWithEdits(command: string, content: string) {
        const document = await this.openScript(command);
        const hookMarker = 'VSCode venv deactivate hook';
        content = `
# >>> ${hookMarker} >>>
${content}
# <<< ${hookMarker} <<<`;
        // If script already has the hook, don't add it again.
        const editor = await this.documentManager.showTextDocument(document);
        if (document.getText().includes(hookMarker)) {
            return;
        }
        const editorEdit = new WorkspaceEdit();
        editorEdit.insert(document.uri, new Position(document.lineCount, 0), content);
        await this.documentManager.applyEdit(editorEdit);
        // Reveal the edits.
        editor.revealRange(
            new Range(new Position(document.lineCount - 3, 0), new Position(document.lineCount, 0)),
            TextEditorRevealType.AtTop,
        );
    }

    private async openScript(command: string) {
        const initScriptPath = await this.getPathToScript(command);
        if (!(await pathExists(initScriptPath))) {
            await createFile(initScriptPath);
        }
        const document = await this.documentManager.openTextDocument(initScriptPath);
        return document;
    }

    private async getPathToScript(command: string) {
        return shellExec(command, { shell: this.appEnvironment.shell }).then((output) => output.stdout.trim());
    }

    public async forceRestartShell(terminal: Terminal): Promise<void> {
        terminal.dispose();
        terminal = this.terminalManager.createTerminal({
            message: Interpreters.restartingTerminal,
        });
        terminal.show(true);
        terminal.sendText('deactivate');
    }
}
