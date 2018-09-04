// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DiagnosticSeverity, WorkspaceFolder } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { IFileSystem } from '../../../common/platform/types';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

const InvalidDebuggerTypeMessage = 'Your launch.json file needs to be updated to change the "pythonExperimental" debug ' +
    'configurations to use the "python" debugger type, otherwise Python debugging may ' +
    'not work. Would you like to automatically update your launch.json file now?';

export class InvalidDebuggerTypeDiagnostic extends BaseDiagnostic {
    constructor(message) {
        super(DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            message, DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder);
    }
}

export const InvalidDebuggerTypeDiagnosticsServiceId = 'InvalidDebuggerTypeDiagnosticsServiceId';

const CommandName = 'python.debugger.replaceExperimental';

@injectable()
export class InvalidDebuggerTypeDiagnosticsService extends BaseDiagnosticsService {
    protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>;
    protected readonly fs: IFileSystem;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super([DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer);
        this.messageService = serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(IDiagnosticHandlerService, DiagnosticCommandPromptHandlerServiceId);
        const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        cmdManager.registerCommand(CommandName, this.fixLaunchJson, this);
    }
    public async diagnose(): Promise<IDiagnostic[]> {
        if (await this.isExperimentalDebuggerUsed()) {
            return [new InvalidDebuggerTypeDiagnostic(InvalidDebuggerTypeMessage)];
        } else {
            return [];
        }
    }
    public async handle(diagnostics: IDiagnostic[]): Promise<void> {
        // This class can only handle one type of diagnostic, hence just use first item in list.
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
            return;
        }
        const diagnostic = diagnostics[0];
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: 'Yes, update launch.json',
                command: commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: 'python.debugger.replaceExperimental' })
            },
            {
                prompt: 'No, I will do it later'
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
    private async isExperimentalDebuggerUsed() {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!workspaceService.hasWorkspaceFolders) {
            return false;
        }

        const results = await Promise.all(workspaceService.workspaceFolders!.map(workspaceFolder => this.isExperimentalDebuggerUsedInWorkspace(workspaceFolder)));
        return results.filter(used => used === true).length > 0;
    }
    private getLaunchJsonFile(workspaceFolder: WorkspaceFolder) {
        return path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
    }
    private async isExperimentalDebuggerUsedInWorkspace(workspaceFolder: WorkspaceFolder) {
        const launchJson = this.getLaunchJsonFile(workspaceFolder);
        if (!await this.fs.fileExists(launchJson)) {
            return false;
        }

        const fileContents = await this.fs.readFile(launchJson);
        return fileContents.indexOf('"pythonExperimental"') > 0;
    }
    private async fixLaunchJson() {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!workspaceService.hasWorkspaceFolders) {
            return false;
        }

        await Promise.all(workspaceService.workspaceFolders!.map(workspaceFolder => this.fixLaunchJsonInWorkspace(workspaceFolder)));
    }
    private async fixLaunchJsonInWorkspace(workspaceFolder: WorkspaceFolder) {
        if (!await this.isExperimentalDebuggerUsedInWorkspace(workspaceFolder)) {
            return;
        }

        const launchJson = this.getLaunchJsonFile(workspaceFolder);
        let fileContents = await this.fs.readFile(launchJson);
        const debuggerType = new RegExp('"pythonExperimental"', 'g');
        const debuggerLabel = new RegExp('"Python Experimental:', 'g');

        fileContents = fileContents.replace(debuggerType, '"python"');
        fileContents = fileContents.replace(debuggerLabel, '"Python:');

        await this.fs.writeFile(launchJson, fileContents);
    }
}
