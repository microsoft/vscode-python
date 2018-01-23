// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IPlatformService } from '../../common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../common/terminal/types';
import { IConfigurationService } from '../../common/types';
import { IDisposableRegistry } from '../../common/types';
import { ICodeExecutionService } from '../../terminals/types';

@injectable()
export class TerminalCodeExecutionProvider implements ICodeExecutionService {
    protected terminalTitle: string;
    private _terminalService: ITerminalService;
    private replActive?: Promise<boolean>;
    private get terminalService(): ITerminalService {
        if (!this._terminalService) {
            this._terminalService = this.terminalServiceFactory.getTerminalService(this.terminalTitle);
            this.disposables.push(this.terminalService.onDidCloseTerminal(() => {
                this.replActive = undefined;
            }));
        }
        return this._terminalService;
    }
    constructor( @inject(ITerminalServiceFactory) protected readonly terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) protected readonly configurationService: IConfigurationService,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) protected readonly disposables: Disposable[],
        @inject(IPlatformService) protected readonly platformService: IPlatformService) {

    }
    public async executeFile(file: Uri) {
        const pythonSettings = this.configurationService.getSettings(file);

        this.setCwdForFileExecution(file);

        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const filePath = file.fsPath.indexOf(' ') > 0 ? `"${file.fsPath}"` : file.fsPath;
        const launchArgs = pythonSettings.terminal.launchArgs;

        this.terminalService.sendCommand(command, launchArgs.concat(filePath));
    }

    public async execute(code: string, resource?: Uri): Promise<void> {
        if (!code || code.trim().length === 0) {
            return;
        }

        await this.ensureRepl();
        this.terminalService.sendText(code);
    }

    public getReplCommandArgs(resource?: Uri): { command: string, args: string[] } {
        const pythonSettings = this.configurationService.getSettings(resource);
        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const args = pythonSettings.terminal.launchArgs.slice();
        return { command, args };
    }

    private setCwdForFileExecution(file: Uri) {
        const pythonSettings = this.configurationService.getSettings(file);
        if (!pythonSettings.terminal.executeInFileDir) {
            return;
        }
        const fileDirPath = path.dirname(file.fsPath);
        const wkspace = this.workspace.getWorkspaceFolder(file);
        if (wkspace && fileDirPath !== wkspace.uri.fsPath && fileDirPath.length > 0) {
            const escapedPath = fileDirPath.indexOf(' ') > 0 ? `"${fileDirPath}"` : fileDirPath;
            this.terminalService.sendText(`cd ${escapedPath}`);
        }
    }

    private async ensureRepl(resource?: Uri) {
        if (this.replActive && await this.replActive!) {
            return;
        }
        this.replActive = new Promise<boolean>(resolve => {
            const replCommandArgs = this.getReplCommandArgs(resource);
            this.terminalService.sendCommand(replCommandArgs.command, replCommandArgs.args);

            // Give python repl time to start before we start sending text.
            setTimeout(() => resolve(true), 1000);
        });

        await this.replActive;
    }
}
