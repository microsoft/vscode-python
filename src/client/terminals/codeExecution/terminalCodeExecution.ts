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
import { IConfigurationService } from '../../common/types';
import { IDisposableRegistry } from '../../common/types';
import { ICodeExecutionService } from '../../terminals/types';

@injectable()
export class TerminalCodeExecutionProvider implements ICodeExecutionService {
    protected terminalTitle: string;
    private _terminalService: ITerminalService;
    private replActive?: Promise<boolean>;
    constructor( @inject(ITerminalServiceFactory) protected readonly terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) protected readonly configurationService: IConfigurationService,
        @inject(IWorkspaceService) protected readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) protected readonly disposables: Disposable[],
        @inject(IPlatformService) protected readonly platformService: IPlatformService) {

    }
    public async executeFile(file: Uri) {
        const pythonSettings = this.configurationService.getSettings(file);

        await this.setCwdForFileExecution(file);

        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const launchArgs = pythonSettings.terminal.launchArgs;

        await this.getTerminalService(file).sendCommand(command, launchArgs.concat(file.fsPath.fileToCommandArgument()));
    }

    public async execute(code: string, resource?: Uri): Promise<void> {
        if (!code || code.trim().length === 0) {
            return;
        }

        await this.initializeRepl();
        await this.getTerminalService(resource).sendText(code);
    }
    public async initializeRepl(resource?: Uri) {
        if (this.replActive && await this.replActive!) {
            await this._terminalService!.show();
            return;
        }
        this.replActive = new Promise<boolean>(async resolve => {
            const replCommandArgs = this.getReplCommandArgs(resource);
            await this.getTerminalService(resource).sendCommand(replCommandArgs.command, replCommandArgs.args);

            // Give python repl time to start before we start sending text.
            setTimeout(() => resolve(true), 1000);
        });

        await this.replActive;
    }
    public getReplCommandArgs(resource?: Uri): { command: string, args: string[] } {
        const pythonSettings = this.configurationService.getSettings(resource);
        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const args = pythonSettings.terminal.launchArgs.slice();
        return { command, args };
    }
    private getTerminalService(resource?: Uri): ITerminalService {
        if (!this._terminalService) {
            this._terminalService = this.terminalServiceFactory.getTerminalService(resource, this.terminalTitle);
            this.disposables.push(this._terminalService.onDidCloseTerminal(() => {
                this.replActive = undefined;
            }));
        }
        return this._terminalService;
    }
    private async setCwdForFileExecution(file: Uri) {
        const pythonSettings = this.configurationService.getSettings(file);
        if (!pythonSettings.terminal.executeInFileDir) {
            return;
        }
        const fileDirPath = path.dirname(file.fsPath);
        const wkspace = this.workspace.getWorkspaceFolder(file);
        if (wkspace && fileDirPath !== wkspace.uri.fsPath && fileDirPath.length > 0) {
            await this.getTerminalService(file).sendText(`cd ${fileDirPath.toCommandArgument()}`);
        }
    }
}
