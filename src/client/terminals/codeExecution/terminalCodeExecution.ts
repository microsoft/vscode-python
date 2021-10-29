// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { IPlatformService } from '../../common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../common/terminal/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { buildPythonExecInfo, PythonExecInfo } from '../../pythonEnvironments/exec';
import { ICodeExecutionService } from '../../terminals/types';

@injectable()
export class TerminalCodeExecutionProvider implements ICodeExecutionService {
    protected terminalTitle!: string;
    private _terminalService!: ITerminalService;
    private replActive?: Promise<boolean>;
    constructor(
        @inject(ITerminalServiceFactory) protected readonly terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) protected readonly configurationService: IConfigurationService,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) protected readonly disposables: Disposable[],
        @inject(IPlatformService) protected readonly platformService: IPlatformService,
    ) {}

    public async executeFile(file: Uri) {
        await this.setCwdForFileExecution(file);
        const { command, args } = await this.getExecuteFileArgs(file, [file.fsPath.fileToCommandArgument()]);

        await this.getTerminalService(file).sendCommand(command, args);
    }

    public async execute(code: string, resource?: Uri): Promise<void> {
        if (!code || code.trim().length === 0) {
            return;
        }

        await this.initializeRepl();
        await this.getTerminalService(resource).sendText(code);
    }
    public async initializeRepl(resource?: Uri) {
        if (this.replActive && (await this.replActive)) {
            await this._terminalService.show();
            return;
        }
        this.replActive = new Promise<boolean>(async (resolve) => {
            const replCommandArgs = await this.getExecutableInfo(resource);
            await this.getTerminalService(resource).sendCommand(replCommandArgs.command, replCommandArgs.args);

            // Give python repl time to start before we start sending text.
            setTimeout(() => resolve(true), 1000);
        });

        await this.replActive;
    }

    public async getExecutableInfo(resource?: Uri, args: string[] = []): Promise<PythonExecInfo> {
        const pythonSettings = this.configurationService.getSettings(resource);
        const command = this.platformService.isWindows
            ? pythonSettings.pythonPath.replace(/\\/g, '/')
            : pythonSettings.pythonPath;
        const launchArgs = pythonSettings.terminal.launchArgs;
        return buildPythonExecInfo(command, [...launchArgs, ...args]);
    }

    // Overridden in subclasses, see djangoShellCodeExecution.ts
    public async getExecuteFileArgs(resource?: Uri, executeArgs: string[] = []): Promise<PythonExecInfo> {
        return this.getExecutableInfo(resource, executeArgs);
    }
    private getTerminalService(resource?: Uri): ITerminalService {
        if (!this._terminalService) {
            this._terminalService = this.terminalServiceFactory.getTerminalService({
                resource,
                title: this.terminalTitle,
            });
            this.disposables.push(
                this._terminalService.onDidCloseTerminal(() => {
                    this.replActive = undefined;
                }),
            );
        }
        return this._terminalService;
    }
    private async setCwdForFileExecution(file: Uri) {
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
                if (fileDrive !== currentDrive) {
                    await this.getTerminalService(file).sendText(`${fileDrive}:`);
                }
            }
            await this.getTerminalService(file).sendText(`cd ${fileDirPath.fileToCommandArgument()}`);
        }
    }
}
