// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, l10n, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { Commands } from '../../common/constants';
import '../../common/extensions';
import { IPlatformService } from '../../common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../common/terminal/types';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../common/types';
import { showWarningMessage } from '../../common/vscodeApis/windowApis';
import { IInterpreterService } from '../../interpreter/contracts';
import { buildPythonExecInfo, PythonExecInfo } from '../../pythonEnvironments/exec';
import { ICodeExecutionService } from '../../terminals/types';
import * as vscode from 'vscode';
@injectable()
export class TerminalCodeExecutionProvider implements ICodeExecutionService {
    private hasRanOutsideCurrentDrive = false;
    protected terminalTitle!: string;
    private replActive?: Promise<boolean>;
    constructor(
        @inject(ITerminalServiceFactory) protected readonly terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) protected readonly configurationService: IConfigurationService,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) protected readonly disposables: Disposable[],
        @inject(IPlatformService) protected readonly platformService: IPlatformService,
        @inject(IInterpreterService) protected readonly interpreterService: IInterpreterService,
    ) {}

    public async executeFile(file: Uri, options?: { newTerminalPerFile: boolean }) {
        await this.setCwdForFileExecution(file, options);
        const { command, args } = await this.getExecuteFileArgs(file, [
            file.fsPath.fileToCommandArgumentForPythonExt(),
        ]);

        await this.getTerminalService(file, options).sendCommand(command, args);
    }

    public async execute(code: string, resource?: Uri): Promise<void> {
        if (!code || code.trim().length === 0) {
            return;
        }
        await this.initializeRepl(resource);
        if (code == 'deprecated') {
            // If user is trying to smart send deprecated code show warning
            const selection = await showWarningMessage(
                l10n.t(
                    `Python AST cannot parse invalid code provided in the current file, please
                    turn off Smart Send if you wish to always run line by line or explicitly select code
                    to force run. [logs](command:${Commands.ViewOutput}) for more details.`,
                ),
                'Change Settings',
            );
            if (selection === 'Change Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'python.REPL.EnableREPLSmartSend');
            }
        } else {
            await this.getTerminalService(resource).sendText(code);
        }
    }
    public async initializeRepl(resource: Resource) {
        const terminalService = this.getTerminalService(resource);
        if (this.replActive && (await this.replActive)) {
            await terminalService.show();
            return;
        }
        this.replActive = new Promise<boolean>(async (resolve) => {
            const replCommandArgs = await this.getExecutableInfo(resource);
            terminalService.sendCommand(replCommandArgs.command, replCommandArgs.args);

            // Give python repl time to start before we start sending text.
            setTimeout(() => resolve(true), 1000);
        });
        this.disposables.push(
            terminalService.onDidCloseTerminal(() => {
                this.replActive = undefined;
            }),
        );

        await this.replActive;
    }

    public async getExecutableInfo(resource?: Uri, args: string[] = []): Promise<PythonExecInfo> {
        const pythonSettings = this.configurationService.getSettings(resource);
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        const interpreterPath = interpreter?.path ?? pythonSettings.pythonPath;
        const command = this.platformService.isWindows ? interpreterPath.replace(/\\/g, '/') : interpreterPath;
        const launchArgs = pythonSettings.terminal.launchArgs;
        return buildPythonExecInfo(command, [...launchArgs, ...args]);
    }

    // Overridden in subclasses, see djangoShellCodeExecution.ts
    public async getExecuteFileArgs(resource?: Uri, executeArgs: string[] = []): Promise<PythonExecInfo> {
        return this.getExecutableInfo(resource, executeArgs);
    }
    private getTerminalService(resource: Resource, options?: { newTerminalPerFile: boolean }): ITerminalService {
        return this.terminalServiceFactory.getTerminalService({
            resource,
            title: this.terminalTitle,
            newTerminalPerFile: options?.newTerminalPerFile,
        });
    }
    private async setCwdForFileExecution(file: Uri, options?: { newTerminalPerFile: boolean }) {
        const pythonSettings = this.configurationService.getSettings(file);
        if (!pythonSettings.terminal.executeInFileDir) {
            return;
        }
        const fileDirPath = path.dirname(file.fsPath);
        if (fileDirPath.length > 0) {
            if (this.platformService.isWindows && /[a-z]\:/i.test(fileDirPath)) {
                const currentDrive =
                    typeof this.workspace.rootPath === 'string'
                        ? this.workspace.rootPath.replace(/\:.*/g, '')
                        : undefined;
                const fileDrive = fileDirPath.replace(/\:.*/g, '');
                if (fileDrive !== currentDrive || this.hasRanOutsideCurrentDrive) {
                    this.hasRanOutsideCurrentDrive = true;
                    await this.getTerminalService(file).sendText(`${fileDrive}:`);
                }
            }
            await this.getTerminalService(file, options).sendText(
                `cd ${fileDirPath.fileToCommandArgumentForPythonExt()}`,
            );
        }
    }
}
