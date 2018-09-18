// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-template-strings

import { injectable, unmanaged } from 'inversify';
import * as path from 'path';
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, Uri, WorkspaceFolder } from 'vscode';
import { InvalidPythonPathInDebuggerServiceId } from '../../application/diagnostics/checks/invalidPythonPathInDebugger';
import { IDiagnosticsService, IInvalidPythonPathInDebuggerService } from '../../application/diagnostics/types';
import { IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IConfigurationService } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { BaseAttachRequestArguments, BaseLaunchRequestArguments, DebuggerType } from '../Common/Contracts';

export type PythonLaunchDebugConfiguration<T extends BaseLaunchRequestArguments> = DebugConfiguration & T;
export type PythonAttachDebugConfiguration<T extends BaseAttachRequestArguments> = DebugConfiguration & T;

@injectable()
export abstract class BaseConfigurationProvider<L extends BaseLaunchRequestArguments, A extends BaseAttachRequestArguments> implements DebugConfigurationProvider {
    constructor(@unmanaged() public debugType: DebuggerType, protected serviceContainer: IServiceContainer) { }
    public async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        const workspaceFolder = this.getWorkspaceFolder(folder);

        if (debugConfiguration.request === 'attach') {
            await this.provideAttachDefaults(workspaceFolder, debugConfiguration as PythonAttachDebugConfiguration<A>);
        } else {
            const config = debugConfiguration as PythonLaunchDebugConfiguration<L>;
            const diagnosticService = this.serviceContainer.get<IInvalidPythonPathInDebuggerService>(IDiagnosticsService, InvalidPythonPathInDebuggerServiceId);
            if (!await diagnosticService.validatePythonPath(config.pythonPath, workspaceFolder)) {
                // Returning an invalid configuration will cause VSC to display `launch.json` and stop launching the debugger..
                // tslint:disable-next-line:no-any
                return {} as any;
            }
            const numberOfSettings = Object.keys(config);

            if ((config.noDebug === true && numberOfSettings.length === 1) || numberOfSettings.length === 0) {
                const defaultProgram = this.getProgram();

                config.name = 'Launch';
                config.type = this.debugType;
                config.request = 'launch';
                config.program = defaultProgram ? defaultProgram : '';
                config.env = {};
            }

            await this.provideLaunchDefaults(workspaceFolder, config);
        }

        const dbgConfig = (debugConfiguration as (BaseLaunchRequestArguments | BaseAttachRequestArguments));
        if (Array.isArray(dbgConfig.debugOptions)) {
            dbgConfig.debugOptions = dbgConfig.debugOptions!.filter((item, pos) => dbgConfig.debugOptions!.indexOf(item) === pos);
        }
        return debugConfiguration;
    }
    protected async provideAttachDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonAttachDebugConfiguration<A>): Promise<void> {
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
        if (!debugConfiguration.host) {
            debugConfiguration.host = 'localhost';
        }
    }
    protected async provideLaunchDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonLaunchDebugConfiguration<L>): Promise<void> {
        this.resolveAndUpdatePythonPath(workspaceFolder, debugConfiguration);
        if (typeof debugConfiguration.cwd !== 'string' && workspaceFolder) {
            debugConfiguration.cwd = workspaceFolder.fsPath;
        }
        if (typeof debugConfiguration.envFile !== 'string' && workspaceFolder) {
            const envFile = workspaceFolder ? path.join(workspaceFolder.fsPath, '.env') : '';
            debugConfiguration.envFile = envFile;
        }
        if (typeof debugConfiguration.stopOnEntry !== 'boolean') {
            debugConfiguration.stopOnEntry = false;
        }
        if (!debugConfiguration.console) {
            debugConfiguration.console = 'integratedTerminal';
        }
        // If using a terminal, then never open internal console.
        if (debugConfiguration.console !== 'none' && !debugConfiguration.internalConsoleOptions) {
            debugConfiguration.internalConsoleOptions = 'neverOpen';
        }
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
    }
    private getWorkspaceFolder(folder: WorkspaceFolder | undefined): Uri | undefined {
        if (folder) {
            return folder.uri;
        }
        const program = this.getProgram();
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!Array.isArray(workspaceService.workspaceFolders) || workspaceService.workspaceFolders.length === 0) {
            return program ? Uri.file(path.dirname(program)) : undefined;
        }
        if (workspaceService.workspaceFolders.length === 1) {
            return workspaceService.workspaceFolders[0].uri;
        }
        if (program) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(Uri.file(program));
            if (workspaceFolder) {
                return workspaceFolder.uri;
            }
        }
    }
    private getProgram(): string | undefined {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        const editor = documentManager.activeTextEditor;
        if (editor && editor.document.languageId === PYTHON_LANGUAGE) {
            return editor.document.fileName;
        }
    }
    private resolveAndUpdatePythonPath(workspaceFolder: Uri | undefined, debugConfiguration: PythonLaunchDebugConfiguration<L>): void {
        if (!debugConfiguration) {
            return;
        }
        if (debugConfiguration.pythonPath === '${config:python.pythonPath}' || !debugConfiguration.pythonPath) {
            const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            const pythonPath = configService.getSettings(workspaceFolder).pythonPath;
            debugConfiguration.pythonPath = pythonPath;
        }
    }
}
